using System.Data;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IDbConnection>(_ =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("Postgres")));

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p
        .AllowAnyOrigin()
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseHttpsRedirection();

// ── Endpoints ──────────────────────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Stats
app.MapGet("/api/stats", async (IDbConnection db) =>
{
    var total = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM holdings");
    var withCover = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM holdings WHERE cover_url IS NOT NULL");
    return Results.Ok(new { totalBooks = total, booksWithCover = withCover });
});

// Subjects
app.MapGet("/api/subjects", async (IDbConnection db) =>
{
    const string sql = @"
        SELECT s.id, s.term, s.prefix,
               COUNT(h.id) AS book_count
        FROM subjects s
        LEFT JOIN holdings h ON h.subject_id = s.id
        GROUP BY s.id, s.term, s.prefix
        ORDER BY s.term";
    var rows = await db.QueryAsync(sql);
    return Results.Ok(rows.Select(r => new {
        id = (Guid)r.id,
        term = (string)r.term,
        prefix = (string?)r.prefix,
        bookCount = (long)r.book_count
    }));
});

// Authors index
app.MapGet("/api/authors", async (IDbConnection db, string? letter, int page = 1, int pageSize = 200) =>
{
    var offset = (page - 1) * pageSize;
    var sql = string.IsNullOrEmpty(letter)
        ? @"SELECT a.id, a.name, a.normalized_name, COUNT(wa.work_id) AS book_count
            FROM authors a
            JOIN work_authors wa ON wa.author_id = a.id
            GROUP BY a.id, a.name, a.normalized_name
            ORDER BY a.normalized_name
            LIMIT @pageSize OFFSET @offset"
        : @"SELECT a.id, a.name, a.normalized_name, COUNT(wa.work_id) AS book_count
            FROM authors a
            JOIN work_authors wa ON wa.author_id = a.id
            WHERE lower(a.name) LIKE @prefix
            GROUP BY a.id, a.name, a.normalized_name
            ORDER BY a.normalized_name
            LIMIT @pageSize OFFSET @offset";
    var rows = await db.QueryAsync(sql, new {
        pageSize,
        offset,
        prefix = string.IsNullOrEmpty(letter) ? null : letter.ToLower() + "%"
    });
    return Results.Ok(rows.Select(r => new {
        id = (Guid)r.id,
        name = (string)r.name,
        normalizedName = (string?)r.normalized_name,
        bookCount = (long)r.book_count
    }));
});

// Book list with search / filter
app.MapGet("/api/books", async (IDbConnection db,
    string? search, string? subject, string? author,
    int page = 1, int pageSize = 24) =>
{
    var offset = (page - 1) * pageSize;
    var where = new List<string>();
    var parameters = new DynamicParameters();
    parameters.Add("pageSize", pageSize);
    parameters.Add("offset", offset);

    if (!string.IsNullOrWhiteSpace(search))
    {
        where.Add("(to_tsvector('simple', w.title) @@ plainto_tsquery('simple', @search) OR lower(a.name) LIKE @searchLike OR lower(h.call_number) LIKE @searchLike)");
        parameters.Add("search", search.Trim());
        parameters.Add("searchLike", "%" + search.Trim().ToLower() + "%");
    }
    if (!string.IsNullOrWhiteSpace(subject))
    {
        where.Add("lower(s.term) = lower(@subject)");
        parameters.Add("subject", subject.Trim());
    }
    if (!string.IsNullOrWhiteSpace(author))
    {
        where.Add("lower(a.name) = lower(@author)");
        parameters.Add("author", author.Trim());
    }

    var whereClause = where.Count > 0 ? "WHERE " + string.Join(" AND ", where) : "";

    var countSql = $@"
        SELECT COUNT(DISTINCT h.id)
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = h.subject_id
        {whereClause}";

    var dataSql = $@"
        SELECT DISTINCT ON (h.id)
            h.id, h.book_id, h.call_number, h.prefix, h.cover_url,
            w.id AS work_id, w.title,
            a.name AS author,
            s.term AS subject, s.prefix AS subject_prefix,
            e.publication_year AS year,
            p.name AS publisher, p.place AS publisher_city,
            h.book_number,
            EXISTS(SELECT 1 FROM digital_copies dc WHERE dc.edition_id = e.id) AS has_digital
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = h.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        {whereClause}
        ORDER BY h.id, h.book_id DESC NULLS LAST
        LIMIT @pageSize OFFSET @offset";

    var total = await db.ExecuteScalarAsync<long>(countSql, parameters);
    var rows = await db.QueryAsync(dataSql, parameters);

    var books = rows.Select(MapBook).ToList();

    return Results.Ok(new {
        total,
        page,
        pageSize,
        totalPages = (int)Math.Ceiling((double)total / pageSize),
        items = books
    });
});

// Single book by call number
app.MapGet("/api/books/{callNumber}", async (IDbConnection db, string callNumber) =>
{
    const string sql = @"
        SELECT h.id, h.book_id, h.call_number, h.prefix, h.cover_url,
               w.id AS work_id, w.title,
               a.name AS author,
               s.term AS subject, s.prefix AS subject_prefix,
               e.publication_year AS year,
               p.name AS publisher, p.place AS publisher_city,
               h.book_number
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = h.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        WHERE upper(h.call_number) = upper(@callNumber)
        LIMIT 1";

    var row = await db.QueryFirstOrDefaultAsync(sql, new { callNumber });
    if (row == null) return Results.NotFound();

    // Get digital copies
    const string dcSql = @"SELECT url FROM digital_copies dc JOIN editions e ON e.id = dc.edition_id JOIN holdings h ON h.edition_id = e.id WHERE upper(h.call_number) = upper(@callNumber)";
    var digitalCopies = (await db.QueryAsync<string>(dcSql, new { callNumber })).ToList();

    var book = MapBook(row);
    return Results.Ok(new {
        book.id, book.bookId, book.callNumber, book.prefix, book.coverUrl, book.hasCover,
        book.workId, book.title, book.author, book.subject, book.subjectPrefix,
        book.year, book.publisher, book.publisherCity, book.notes,
        digitalCopies
    });
});

app.Run();

static dynamic MapBook(dynamic r) => new {
    id = (Guid)r.id,
    bookId = r.book_id == null ? (int?)null : (int)r.book_id,
    callNumber = (string?)r.call_number,
    prefix = (string?)r.prefix,
    title = (string?)r.title,
    author = (string?)r.author,
    subject = (string?)r.subject,
    subjectPrefix = (string?)r.subject_prefix,
    year = r.year == null ? (int?)null : (int)r.year,
    publisher = (string?)r.publisher,
    publisherCity = (string?)r.publisher_city,
    notes = (string?)null,
    coverUrl = (string?)r.cover_url,
    hasCover = r.cover_url != null && !string.IsNullOrEmpty((string?)r.cover_url),
    workId = (Guid)r.work_id,
    added = DateTime.UtcNow.ToString("yyyy-MM-dd") // will be replaced with real date later
};
