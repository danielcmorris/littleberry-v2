using System.Data;
using Amazon;
using Amazon.S3;
using Amazon.S3.Transfer;
using CatalogueApi.Services;
using Dapper;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddJsonFile("/run/secrets/appsettings.json", optional: true, reloadOnChange: false);

builder.Services.AddScoped<IDbConnection>(_ =>
    new NpgsqlConnection(builder.Configuration.GetConnectionString("Postgres")));
builder.Services.AddSingleton<AwsS3Service>();

builder.Services.AddCors(opt =>
    opt.AddDefaultPolicy(p => p
        .AllowAnyOrigin()
        .AllowAnyHeader()
        .AllowAnyMethod()));

var app = builder.Build();
app.UseCors();
app.UseStaticFiles();
app.UseHttpsRedirection();

// ── Endpoints ──────────────────────────────────────────────────────────
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Admin stats
app.MapGet("/api/admin/stats", async (IDbConnection db) =>
{
    var subjects  = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM subjects");
    var authors   = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM authors");
    var files     = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM digital_copies")
                  + await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM media");
    var catalog   = await db.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM holdings");
    return Results.Ok(new { subjects, authors, files, catalog, requests = 0, shipments = 0 });
});

app.MapGet("/api/admin/catalog", async (IDbConnection db,
    // global search
    string? search,
    // per-column text contains filters
    string? callNumberContains, string? titleContains, string? authorContains,
    string? subjectContains, string? publisherContains,
    // year range
    int? yearMin, int? yearMax,
    // boolean presence filters: true = must have, false = must not have, null = no filter
    bool? hasImage, bool? hasImageFalse,
    bool? hasDigital, bool? hasDigitalFalse,
    bool? hasEnrichment, bool? hasEnrichmentFalse,
    // sort + page
    string? sort, string? dir, int page = 1, int pageSize = 100) =>
{
    var offset = (page - 1) * pageSize;
    var conditions = new List<string>();
    var parameters = new DynamicParameters();
    parameters.Add("pageSize", pageSize);
    parameters.Add("offset", offset);

    // Global full-text search
    if (!string.IsNullOrWhiteSpace(search))
    {
        conditions.Add("(to_tsvector('simple', w.title || ' ' || coalesce(a.name, '')) @@ plainto_tsquery('simple', @search) OR upper(h.call_number) LIKE upper('%' || @search || '%'))");
        parameters.Add("search", search.Trim());
    }

    // Per-column text filters (ILIKE contains)
    if (!string.IsNullOrWhiteSpace(callNumberContains))  { conditions.Add("upper(h.call_number) LIKE upper('%' || @callNumberContains || '%')");  parameters.Add("callNumberContains", callNumberContains.Trim()); }
    if (!string.IsNullOrWhiteSpace(titleContains))       { conditions.Add("w.title ILIKE '%' || @titleContains || '%'");                           parameters.Add("titleContains", titleContains.Trim()); }
    if (!string.IsNullOrWhiteSpace(authorContains))      { conditions.Add("a.name ILIKE '%' || @authorContains || '%'");                           parameters.Add("authorContains", authorContains.Trim()); }
    if (!string.IsNullOrWhiteSpace(subjectContains))     { conditions.Add("s.term ILIKE '%' || @subjectContains || '%'");                          parameters.Add("subjectContains", subjectContains.Trim()); }
    if (!string.IsNullOrWhiteSpace(publisherContains))   { conditions.Add("p.name ILIKE '%' || @publisherContains || '%'");                        parameters.Add("publisherContains", publisherContains.Trim()); }

    // Year range
    if (yearMin.HasValue) { conditions.Add("e.publication_year >= @yearMin"); parameters.Add("yearMin", yearMin.Value); }
    if (yearMax.HasValue) { conditions.Add("e.publication_year <= @yearMax"); parameters.Add("yearMax", yearMax.Value); }

    // Boolean filters
    if (hasImage == true)        conditions.Add("(h.cover_url IS NOT NULL AND h.cover_url != '')");
    if (hasImageFalse == true)   conditions.Add("(h.cover_url IS NULL OR h.cover_url = '')");
    if (hasDigital == true)      conditions.Add("EXISTS(SELECT 1 FROM digital_copies dc WHERE dc.edition_id = e.id)");
    if (hasDigitalFalse == true) conditions.Add("NOT EXISTS(SELECT 1 FROM digital_copies dc WHERE dc.edition_id = e.id)");
    if (hasEnrichment == true)      conditions.Add("(e.raw_metadata IS NOT NULL AND e.raw_metadata::text != '{}')");
    if (hasEnrichmentFalse == true) conditions.Add("(e.raw_metadata IS NULL OR e.raw_metadata::text = '{}')");

    var where = conditions.Count > 0 ? "WHERE " + string.Join(" AND ", conditions) : "";

    var sortMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        ["callNumber"]    = "h.call_number",
        ["title"]         = "w.title",
        ["author"]        = "a.name",
        ["subject"]       = "s.term",
        ["year"]          = "e.publication_year",
        ["publisher"]     = "p.name",
        ["hasImage"]      = "(h.cover_url IS NOT NULL AND h.cover_url != '')",
        ["hasDigital"]    = "EXISTS(SELECT 1 FROM digital_copies dc2 WHERE dc2.edition_id = e.id)",
        ["hasEnrichment"] = "(e.raw_metadata IS NOT NULL AND e.raw_metadata::text != '{}')"
    };

    var sortExpr = sortMap.TryGetValue(sort ?? "", out var sc) ? sc : "h.call_number";
    var sortDirection = (dir ?? "asc").ToLowerInvariant() == "desc" ? "DESC NULLS LAST" : "ASC NULLS LAST";

    var countSql = $@"
        SELECT COUNT(*)
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = w.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        {where}";

    var dataSql = $@"
        SELECT h.id, h.call_number, h.prefix, h.book_number,
               w.title, a.name AS author, s.term AS subject,
               e.publication_year AS year, p.name AS publisher,
               (h.cover_url IS NOT NULL AND h.cover_url != '') AS has_image,
               EXISTS(SELECT 1 FROM digital_copies dc WHERE dc.edition_id = e.id) AS has_digital,
               (e.raw_metadata IS NOT NULL AND e.raw_metadata::text != '{{}}') AS has_enrichment
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = w.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        {where}
        ORDER BY {sortExpr} {sortDirection}
        LIMIT @pageSize OFFSET @offset";

    var total = await db.ExecuteScalarAsync<long>(countSql, parameters);
    var rows  = await db.QueryAsync(dataSql, parameters);

    return Results.Ok(new {
        total,
        page,
        pageSize,
        totalPages = (int)Math.Ceiling((double)total / pageSize),
        items = rows.Select(r => new {
            id            = (Guid)r.id,
            callNumber    = (string?)r.call_number ?? "",
            prefix        = (string?)r.prefix ?? "",
            bookNumber    = (string?)r.book_number ?? "",
            title         = (string?)r.title ?? "",
            author        = (string?)r.author ?? "",
            subject       = (string?)r.subject ?? "",
            year          = r.year == null ? (int?)null : (int)r.year,
            publisher     = (string?)r.publisher,
            hasImage      = (bool)r.has_image,
            hasDigital    = (bool)r.has_digital,
            hasEnrichment = (bool)r.has_enrichment
        })
    });
});

// Stats
app.MapGet("/api/stats", async (IDbConnection db) =>
{
    var total = await db.ExecuteScalarAsync<long>(
        "SELECT COUNT(*) FROM holdings WHERE availability_status IS NULL OR availability_status NOT IN ('missing', 'withdrawn', 'lost')");
    var withCover = await db.ExecuteScalarAsync<long>(
        "SELECT COUNT(*) FROM holdings WHERE cover_url IS NOT NULL AND (availability_status IS NULL OR availability_status NOT IN ('missing', 'withdrawn', 'lost'))");
    return Results.Ok(new { totalBooks = total, booksWithCover = withCover });
});

// Subjects
app.MapGet("/api/subjects", async (IDbConnection db) =>
{
    const string sql = @"
        SELECT s.id, s.term, s.prefix, s.last_book_number,
               COUNT(DISTINCT h.id) AS book_count
        FROM subjects s
        LEFT JOIN works w ON w.subject_id = s.id
        LEFT JOIN editions e ON e.work_id = w.id
        LEFT JOIN holdings h ON h.edition_id = e.id
        GROUP BY s.id, s.term, s.prefix, s.last_book_number
        ORDER BY s.term";
    var rows = await db.QueryAsync(sql);
    return Results.Ok(rows.Select(r => new {
        id = (Guid)r.id,
        term = (string)r.term,
        prefix = (string?)r.prefix,
        lastBookNumber = r.last_book_number == null ? (int?)null : (int)r.last_book_number,
        bookCount = (long)r.book_count
    }));
});

// Create subject
app.MapPost("/api/subjects", async (IDbConnection db, SubjectDto dto) =>
{
    if (string.IsNullOrWhiteSpace(dto.Term) || string.IsNullOrWhiteSpace(dto.Prefix))
        return Results.BadRequest("Term and Prefix are required.");
    var id = Guid.NewGuid();
    await db.ExecuteAsync(
        "INSERT INTO subjects (id, term, prefix, last_book_number) VALUES (@id, @Term, @Prefix, @LastBookNumber)",
        new { id, dto.Term, dto.Prefix, dto.LastBookNumber });
    return Results.Created($"/api/subjects/{id}",
        new { id, term = dto.Term, prefix = dto.Prefix, lastBookNumber = dto.LastBookNumber, bookCount = 0 });
});

// Update subject
app.MapPut("/api/subjects/{id:guid}", async (IDbConnection db, Guid id, SubjectDto dto) =>
{
    if (string.IsNullOrWhiteSpace(dto.Term) || string.IsNullOrWhiteSpace(dto.Prefix))
        return Results.BadRequest("Term and Prefix are required.");
    var affected = await db.ExecuteAsync(
        "UPDATE subjects SET term=@Term, prefix=@Prefix, last_book_number=@LastBookNumber WHERE id=@id",
        new { dto.Term, dto.Prefix, dto.LastBookNumber, id });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
});

// Delete subject (only if no works reference it)
app.MapDelete("/api/subjects/{id:guid}", async (IDbConnection db, Guid id) =>
{
    var worksCount = await db.ExecuteScalarAsync<int>(
        "SELECT COUNT(*) FROM works WHERE subject_id = @id", new { id });
    if (worksCount > 0) return Results.BadRequest("Subject has associated works and cannot be deleted.");
    var affected = await db.ExecuteAsync("DELETE FROM subjects WHERE id = @id", new { id });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
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
        // Full-text search across title + author combined so multi-word queries like
        // "Pessoa poetry" match books where each token appears in either field.
        // The LIKE fallback catches call numbers and partial-word matches.
        where.Add(@"(
            to_tsvector('simple', w.title || ' ' || coalesce(a.name, '')) @@ plainto_tsquery('simple', @search)
            OR lower(h.call_number) LIKE @searchLike
            OR h.book_id::text LIKE @searchLike
            OR h.book_number::text LIKE @searchLike
        )");
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
        LEFT JOIN subjects s ON s.id = w.subject_id
        {whereClause}";

    var dataSql = $@"
        SELECT DISTINCT ON (h.id)
            h.id, h.book_id, h.call_number, h.prefix, h.cover_url,
            w.id AS work_id, w.seq_id, w.title,
            a.name AS author,
            s.term AS subject, s.prefix AS subject_prefix,
            e.publication_year AS year, e.language,
            p.name AS publisher, p.place AS publisher_city,
            h.book_number,
            EXISTS(SELECT 1 FROM digital_copies dc WHERE dc.edition_id = e.id) AS has_digital
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = w.subject_id
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
               w.id AS work_id, w.seq_id, w.title, w.subtitle, w.description, w.series,
               a.name AS author,
               s.term AS subject, s.prefix AS subject_prefix,
               e.publication_year AS year, e.language,
               e.isbn_10, e.isbn_13, e.page_count, e.physical_description,
               p.name AS publisher, p.place AS publisher_city,
               h.book_number
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = w.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        WHERE upper(h.call_number) = upper(@callNumber)
           OR (  regexp_replace(upper(h.call_number), '[0-9]', '', 'g') = regexp_replace(upper(@callNumber), '[0-9]', '', 'g')
            AND  NULLIF(regexp_replace(h.call_number, '[^0-9]', '', 'g'), '')::bigint
               = NULLIF(regexp_replace(@callNumber,   '[^0-9]', '', 'g'), '')::bigint )
        LIMIT 1";

    var row = await db.QueryFirstOrDefaultAsync(sql, new { callNumber });
    if (row == null) return Results.NotFound();

    const string dcSql = @"SELECT url FROM digital_copies dc JOIN editions e ON e.id = dc.edition_id JOIN holdings h ON h.edition_id = e.id
        WHERE upper(h.call_number) = upper(@callNumber)
           OR (  regexp_replace(upper(h.call_number), '[0-9]', '', 'g') = regexp_replace(upper(@callNumber), '[0-9]', '', 'g')
            AND  NULLIF(regexp_replace(h.call_number, '[^0-9]', '', 'g'), '')::bigint
               = NULLIF(regexp_replace(@callNumber,   '[^0-9]', '', 'g'), '')::bigint )";
    var digitalCopies = (await db.QueryAsync<string>(dcSql, new { callNumber })).ToList();

    var book = MapBook(row);
    return Results.Ok(new {
        book.id, book.bookId, book.callNumber, book.prefix, book.coverUrl, book.hasCover,
        book.workId, book.seqId, book.title,
        subtitle   = (string?)row.subtitle,
        description = (string?)row.description,
        series     = (string?)row.series,
        isbn10     = (string?)row.isbn_10,
        isbn13     = (string?)row.isbn_13,
        pageCount  = row.page_count == null ? (int?)null : (int)row.page_count,
        book.author, book.subject, book.subjectPrefix,
        book.year, book.language, book.publisher, book.publisherCity, book.notes,
        digitalCopies
    });
});

// Book detail by seq_id (slug routing)
app.MapGet("/api/works/{seqId:long}", async (IDbConnection db, long seqId) =>
{
    const string sql = @"
        SELECT h.id, h.book_id, h.call_number, h.prefix, h.cover_url,
               w.id AS work_id, w.seq_id, w.title, w.subtitle, w.description, w.series,
               a.name AS author,
               s.term AS subject, s.prefix AS subject_prefix,
               e.publication_year AS year, e.language,
               e.isbn_10, e.isbn_13, e.page_count, e.physical_description,
               p.name AS publisher, p.place AS publisher_city,
               h.book_number
        FROM works w
        JOIN editions e ON e.work_id = w.id
        JOIN holdings h ON h.edition_id = e.id
        LEFT JOIN work_authors wa ON wa.work_id = w.id AND wa.ord = 1
        LEFT JOIN authors a ON a.id = wa.author_id
        LEFT JOIN subjects s ON s.id = w.subject_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        WHERE w.seq_id = @seqId
        LIMIT 1";

    var row = await db.QueryFirstOrDefaultAsync(sql, new { seqId });
    if (row == null) return Results.NotFound();

    const string dcSql = @"
        SELECT dc.url FROM digital_copies dc
        JOIN editions e ON e.id = dc.edition_id
        JOIN works w ON w.id = e.work_id
        WHERE w.seq_id = @seqId";
    var digitalCopies = (await db.QueryAsync<string>(dcSql, new { seqId })).ToList();

    var book = MapBook(row);
    return Results.Ok(new {
        book.id, book.bookId, book.callNumber, book.prefix, book.coverUrl, book.hasCover,
        book.workId, book.seqId, book.title,
        subtitle    = (string?)row.subtitle,
        description = (string?)row.description,
        series      = (string?)row.series,
        isbn10      = (string?)row.isbn_10,
        isbn13      = (string?)row.isbn_13,
        pageCount   = row.page_count == null ? (int?)null : (int)row.page_count,
        book.author, book.subject, book.subjectPrefix,
        book.year, book.language, book.publisher, book.publisherCity, book.notes,
        digitalCopies
    });
});

// Full editable record
app.MapGet("/api/books/{callNumber}/edit", async (IDbConnection db, string callNumber) =>
{
    const string sql = @"
        SELECT h.id, h.call_number, h.prefix, h.book_number, h.book_id,
               h.barcode, h.location, h.copy_notes, h.availability_status,
               h.acquisition_date::text AS acquisition_date, h.cover_url,
               w.id AS work_id, w.title, w.subtitle, w.normalized_title,
               w.subject_id,
               w.language AS work_language, w.description, w.work_type, w.series,
               e.id AS edition_id, e.publication_year, e.language AS edition_language,
               e.isbn_10, e.isbn_13, e.lccn, e.oclc,
               e.page_count, e.physical_description, e.raw_metadata::text AS raw_metadata,
               p.id AS publisher_id, p.name AS publisher_name, p.place AS publisher_place,
               s.term AS subject_term, s.prefix AS subject_prefix
        FROM holdings h
        JOIN editions e ON e.id = h.edition_id
        JOIN works w ON w.id = e.work_id
        LEFT JOIN publishers p ON p.id = e.publisher_id
        LEFT JOIN subjects s ON s.id = w.subject_id
        WHERE upper(h.call_number) = upper(@callNumber)
           OR (  regexp_replace(upper(h.call_number), '[0-9]', '', 'g') = regexp_replace(upper(@callNumber), '[0-9]', '', 'g')
            AND  NULLIF(regexp_replace(h.call_number, '[^0-9]', '', 'g'), '')::bigint
               = NULLIF(regexp_replace(@callNumber,   '[^0-9]', '', 'g'), '')::bigint )
        LIMIT 1";

    var row = await db.QueryFirstOrDefaultAsync(sql, new { callNumber });
    if (row == null) return Results.NotFound();

    var workId = (Guid)row.work_id;
    var editionId = (Guid)row.edition_id;

    var authors = await db.QueryAsync(
        @"SELECT a.id, a.name, wa.ord, wa.role FROM authors a JOIN work_authors wa ON wa.author_id = a.id WHERE wa.work_id = @workId ORDER BY wa.ord",
        new { workId });

    var digitalCopies = await db.QueryAsync(
        @"SELECT id, provider, url, format, verified, access FROM digital_copies WHERE edition_id = @editionId",
        new { editionId });

    var media = await db.QueryAsync(
        @"SELECT id, type, url, local_path, caption FROM media WHERE edition_id = @editionId",
        new { editionId });

    object? enrichment = null;
    var rawMeta = (string?)row.raw_metadata;
    if (!string.IsNullOrEmpty(rawMeta))
    {
        try { enrichment = System.Text.Json.JsonSerializer.Deserialize<object>(rawMeta); }
        catch { enrichment = null; }
    }

    return Results.Ok(new {
        holding = new {
            id = (Guid)row.id,
            callNumber = (string?)row.call_number,
            prefix = (string?)row.prefix,
            bookNumber = (string?)row.book_number,
            bookId = row.book_id == null ? (int?)null : (int)row.book_id,
            barcode = (string?)row.barcode,
            location = (string?)row.location,
            copyNotes = (string?)row.copy_notes,
            availabilityStatus = (string?)row.availability_status,
            acquisitionDate = (string?)row.acquisition_date,
            coverUrl = (string?)row.cover_url,
        },
        work = new {
            id = workId,
            title = (string?)row.title,
            subtitle = (string?)row.subtitle,
            normalizedTitle = (string?)row.normalized_title,
            language = (string?)row.work_language,
            description = (string?)row.description,
            workType = (string?)row.work_type,
            series = (string?)row.series,
            subjectId = row.subject_id == null ? (Guid?)null : (Guid)row.subject_id,
        },
        edition = new {
            id = editionId,
            publicationYear = row.publication_year == null ? (int?)null : (int)row.publication_year,
            language = (string?)row.edition_language,
            isbn10 = (string?)row.isbn_10,
            isbn13 = (string?)row.isbn_13,
            lccn = (string?)row.lccn,
            oclc = (string?)row.oclc,
            pageCount = row.page_count == null ? (int?)null : (int)row.page_count,
            physicalDescription = (string?)row.physical_description,
        },
        publisher = row.publisher_id == null ? null : (object)new {
            id = (Guid)row.publisher_id,
            name = (string?)row.publisher_name,
            place = (string?)row.publisher_place,
        },
        authors = authors.Select(a => new {
            id = (Guid)a.id,
            name = (string?)a.name,
            ord = a.ord == null ? (int?)null : (int)a.ord,
            role = (string?)a.role,
        }),
        subject = row.subject_id == null ? null : (object)new {
            id = (Guid)row.subject_id,
            term = (string?)row.subject_term,
            prefix = (string?)row.subject_prefix,
        },
        digitalCopies = digitalCopies.Select(dc => new {
            id = (Guid)dc.id,
            provider = (string?)dc.provider,
            url = (string?)dc.url,
            format = (string?)dc.format,
            verified = dc.verified == null ? (bool?)null : (bool)dc.verified,
            access = (string?)dc.access,
        }),
        media = media.Select(m => new {
            id = (Guid)m.id,
            type = (string?)m.type,
            url = (string?)m.url,
            localPath = (string?)m.local_path,
            caption = (string?)m.caption,
        }),
        enrichment,
    });
});

// Create new book (works → editions → holdings, with optional publisher)
app.MapPost("/api/books", async (IDbConnection db, BookCreateDto dto) =>
{
    if (string.IsNullOrWhiteSpace(dto.Prefix) || string.IsNullOrWhiteSpace(dto.BookNumber))
        return Results.BadRequest("Prefix and BookNumber are required.");

    var callNumber = dto.Prefix + dto.BookNumber;

    var exists = await db.ExecuteScalarAsync<int>(
        "SELECT COUNT(*) FROM holdings WHERE upper(call_number) = upper(@callNumber)", new { callNumber });
    if (exists > 0) return Results.Conflict($"Call number {callNumber} already exists.");

    if (db.State != ConnectionState.Open) db.Open();
    using var txn = db.BeginTransaction();
    try
    {
        var workId = Guid.NewGuid();
        var normalizedTitle = dto.Title.Trim().ToLowerInvariant();
        Guid? subjectId = Guid.TryParse(dto.SubjectId, out var sid) ? sid : (Guid?)null;
        await db.ExecuteAsync(
            @"INSERT INTO works (id, title, subtitle, description, work_type, series, normalized_title, subject_id)
              VALUES (@workId, @Title, @Subtitle, @Description, @WorkType, @Series, @normalizedTitle, @subjectId)",
            new { workId, dto.Title, dto.Subtitle, dto.Description, dto.WorkType, dto.Series, normalizedTitle, subjectId }, txn);

        Guid? publisherId = null;
        if (!string.IsNullOrWhiteSpace(dto.PublisherName))
        {
            publisherId = Guid.NewGuid();
            await db.ExecuteAsync(
                "INSERT INTO publishers (id, name, place) VALUES (@publisherId, @PublisherName, @PublisherPlace)",
                new { publisherId, dto.PublisherName, dto.PublisherPlace }, txn);
        }

        var editionId = Guid.NewGuid();
        await db.ExecuteAsync(
            @"INSERT INTO editions (id, work_id, publisher_id, publication_year, language,
                isbn_10, isbn_13, lccn, oclc, page_count, physical_description)
              VALUES (@editionId, @workId, @publisherId, @PublicationYear, @Language,
                @Isbn10, @Isbn13, @Lccn, @Oclc, @PageCount, @PhysicalDescription)",
            new { editionId, workId, publisherId, dto.PublicationYear, dto.Language,
                  dto.Isbn10, dto.Isbn13, dto.Lccn, dto.Oclc, dto.PageCount, dto.PhysicalDescription }, txn);

        var holdingId = Guid.NewGuid();
        string? acqDate = string.IsNullOrWhiteSpace(dto.AcquisitionDate) ? null : dto.AcquisitionDate;
        await db.ExecuteAsync(
            @"INSERT INTO holdings (id, edition_id, call_number, prefix, book_number,
                location, barcode, copy_notes, availability_status,
                acquisition_date, cover_url)
              VALUES (@holdingId, @editionId, @callNumber, @Prefix, @BookNumber,
                @Location, @Barcode, @CopyNotes, @AvailabilityStatus,
                CASE WHEN @acqDate IS NULL THEN NULL ELSE @acqDate::date END,
                @CoverUrl)",
            new { holdingId, editionId, callNumber, dto.Prefix, dto.BookNumber,
                  dto.Location, dto.Barcode, dto.CopyNotes, dto.AvailabilityStatus,
                  acqDate, dto.CoverUrl }, txn);

        if (subjectId.HasValue && int.TryParse(dto.BookNumber, out var bookNumInt))
            await db.ExecuteAsync(
                "UPDATE subjects SET last_book_number = GREATEST(last_book_number, @bookNumInt) WHERE id = @subjectId",
                new { bookNumInt, subjectId }, txn);

        txn.Commit();
        return Results.Created($"/api/books/{callNumber}",
            new { callNumber, prefix = dto.Prefix, bookNumber = dto.BookNumber });
    }
    catch
    {
        txn.Rollback();
        throw;
    }
});

// Update book (work + edition + holding + publisher)
app.MapPut("/api/books/{callNumber}", async (IDbConnection db, string callNumber, BookUpdateDto dto) =>
{
    const string lookupSql = @"
        SELECT h.id AS holding_id, h.edition_id, e.work_id, e.publisher_id
        FROM holdings h JOIN editions e ON e.id = h.edition_id
        WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1";
    var ids = await db.QueryFirstOrDefaultAsync(lookupSql, new { callNumber });
    if (ids == null) return Results.NotFound();

    if (db.State != ConnectionState.Open) db.Open();
    using var txn = db.BeginTransaction();
    try
    {
        Guid? subjectId = Guid.TryParse(dto.SubjectId, out var sid) ? sid : (Guid?)null;
        await db.ExecuteAsync(
            @"UPDATE works SET title=@Title, subtitle=@Subtitle, description=@Description, work_type=@WorkType, series=@Series, subject_id=@subjectId WHERE id=@workId",
            new { dto.Title, dto.Subtitle, dto.Description, dto.WorkType, dto.Series, subjectId, workId = (Guid)ids.work_id },
            txn);

        await db.ExecuteAsync(
            @"UPDATE editions SET publication_year=@PublicationYear, language=@Language, isbn_10=@Isbn10, isbn_13=@Isbn13, lccn=@Lccn, oclc=@Oclc, page_count=@PageCount, physical_description=@PhysicalDescription WHERE id=@editionId",
            new { dto.PublicationYear, dto.Language, dto.Isbn10, dto.Isbn13, dto.Lccn, dto.Oclc, dto.PageCount, dto.PhysicalDescription, editionId = (Guid)ids.edition_id },
            txn);

        if (ids.publisher_id != null)
        {
            await db.ExecuteAsync(
                @"UPDATE publishers SET name=@PublisherName, place=@PublisherPlace WHERE id=@publisherId",
                new { dto.PublisherName, dto.PublisherPlace, publisherId = (Guid)ids.publisher_id },
                txn);
        }

        string? acqDate = string.IsNullOrWhiteSpace(dto.AcquisitionDate) ? null : dto.AcquisitionDate;

        await db.ExecuteAsync(
            @"UPDATE holdings SET
                location=@Location, barcode=@Barcode, copy_notes=@CopyNotes,
                availability_status=@AvailabilityStatus,
                acquisition_date=CASE WHEN @acqDate IS NULL THEN NULL ELSE @acqDate::date END,
                cover_url=@CoverUrl,
                call_number=COALESCE(NULLIF(@CallNumber,''), call_number),
                prefix=COALESCE(NULLIF(@Prefix,''), prefix),
                book_number=COALESCE(NULLIF(@BookNumber,''), book_number)
              WHERE id=@holdingId",
            new { dto.Location, dto.Barcode, dto.CopyNotes, dto.AvailabilityStatus, acqDate, dto.CoverUrl,
                  dto.CallNumber, dto.Prefix, dto.BookNumber, holdingId = (Guid)ids.holding_id },
            txn);

        txn.Commit();
        return Results.NoContent();
    }
    catch
    {
        txn.Rollback();
        throw;
    }
});

// Sibling holdings (same edition)
app.MapGet("/api/books/{callNumber}/siblings", async (IDbConnection db, string callNumber) =>
{
    var rows = await db.QueryAsync(
        @"SELECT h.call_number, h.prefix, h.book_number
          FROM holdings h
          WHERE h.edition_id = (
              SELECT h2.edition_id FROM holdings h2 WHERE upper(h2.call_number) = upper(@callNumber) LIMIT 1
          )
          ORDER BY h.call_number",
        new { callNumber });
    return Results.Ok(rows.Select(r => new {
        callNumber = (string?)r.call_number ?? "",
        prefix     = (string?)r.prefix ?? "",
        bookNumber = (string?)r.book_number ?? "",
    }));
});

// Add a new holding under the same edition
app.MapPost("/api/books/{callNumber}/holdings", async (IDbConnection db, string callNumber, NewHoldingDto dto) =>
{
    var newCallNumber = dto.Prefix + dto.BookNumber;
    var exists = await db.ExecuteScalarAsync<int>(
        "SELECT COUNT(*) FROM holdings WHERE upper(call_number) = upper(@newCallNumber)", new { newCallNumber });
    if (exists > 0) return Results.Conflict($"Call number {newCallNumber} already exists.");

    var source = await db.QueryFirstOrDefaultAsync(
        @"SELECT h.edition_id, w.subject_id
          FROM holdings h
          JOIN editions e ON e.id = h.edition_id
          JOIN works w ON w.id = e.work_id
          WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1",
        new { callNumber });
    if (source == null) return Results.NotFound();

    Guid? subjectId = source.subject_id == null ? (Guid?)null : (Guid)source.subject_id;
    await db.ExecuteAsync(
        @"INSERT INTO holdings (id, edition_id, call_number, prefix, book_number)
          VALUES (gen_random_uuid(), @editionId, @newCallNumber, @Prefix, @BookNumber)",
        new { editionId = (Guid)source.edition_id, newCallNumber, dto.Prefix, dto.BookNumber });

    if (subjectId.HasValue && int.TryParse(dto.BookNumber, out var bookNumInt))
        await db.ExecuteAsync(
            "UPDATE subjects SET last_book_number = GREATEST(last_book_number, @bookNumInt) WHERE id = @subjectId",
            new { bookNumInt, subjectId });

    return Results.Created($"/api/books/{newCallNumber}",
        new { callNumber = newCallNumber, prefix = dto.Prefix, bookNumber = dto.BookNumber });
});

// Delete a holding (only when multiple holdings share the same edition)
app.MapDelete("/api/books/{callNumber}", async (IDbConnection db, string callNumber) =>
{
    var siblingCount = await db.ExecuteScalarAsync<int>(
        @"SELECT COUNT(*) FROM holdings WHERE edition_id = (
              SELECT edition_id FROM holdings WHERE upper(call_number) = upper(@callNumber) LIMIT 1
          )", new { callNumber });
    if (siblingCount <= 1) return Results.BadRequest("Cannot delete the only holding for this edition.");

    var affected = await db.ExecuteAsync(
        "DELETE FROM holdings WHERE upper(call_number) = upper(@callNumber)", new { callNumber });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
});

// Add digital copy
app.MapPost("/api/books/{callNumber}/digital", async (IDbConnection db, string callNumber, DigitalCopyDto dto) =>
{
    var editionId = await db.QueryFirstOrDefaultAsync<Guid?>(
        @"SELECT h.edition_id FROM holdings h WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1",
        new { callNumber });
    if (editionId == null) return Results.NotFound();

    await db.ExecuteAsync(
        @"INSERT INTO digital_copies (id, edition_id, provider, url, format, access, retrieved_at) VALUES (gen_random_uuid(), @editionId, @Provider, @Url, @Format, @Access, now())",
        new { editionId, dto.Provider, dto.Url, dto.Format, dto.Access });
    return Results.Created($"/api/books/{callNumber}/digital", null);
});

// Delete digital copy
app.MapDelete("/api/books/{callNumber}/digital/{id}", async (IDbConnection db, string callNumber, Guid id) =>
{
    var affected = await db.ExecuteAsync(
        @"DELETE FROM digital_copies WHERE id = @id AND edition_id IN (SELECT h.edition_id FROM holdings h WHERE upper(h.call_number) = upper(@callNumber))",
        new { id, callNumber });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
});

// Add author to work (find-or-create author, then upsert work_authors)
app.MapPost("/api/books/{callNumber}/authors", async (IDbConnection db, string callNumber, AuthorDto dto) =>
{
    var ids = await db.QueryFirstOrDefaultAsync(
        @"SELECT e.work_id FROM holdings h JOIN editions e ON e.id = h.edition_id WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1",
        new { callNumber });
    if (ids == null) return Results.NotFound();
    var workId = (Guid)ids.work_id;

    var authorId = await db.QueryFirstOrDefaultAsync<Guid?>(
        @"SELECT id FROM authors WHERE lower(name) = lower(@name) LIMIT 1",
        new { dto.Name });
    if (authorId == null)
    {
        authorId = Guid.NewGuid();
        var normalized = dto.Name.Trim().ToLower();
        await db.ExecuteAsync(
            @"INSERT INTO authors (id, name, normalized_name) VALUES (@authorId, @name, @normalized)",
            new { authorId, name = dto.Name.Trim(), normalized });
    }

    var maxOrd = await db.ExecuteScalarAsync<int?>(
        @"SELECT MAX(ord) FROM work_authors WHERE work_id = @workId", new { workId }) ?? 0;
    var role = string.IsNullOrWhiteSpace(dto.Role) ? null : dto.Role.Trim();

    await db.ExecuteAsync(
        @"INSERT INTO work_authors (work_id, author_id, ord, role) VALUES (@workId, @authorId, @ord, @role)
          ON CONFLICT (work_id, author_id) DO UPDATE SET role = @role",
        new { workId, authorId, ord = maxOrd + 1, role });

    return Results.Created($"/api/books/{callNumber}/authors", new { id = authorId, name = dto.Name.Trim(), ord = maxOrd + 1, role });
});

// Remove author from work
app.MapDelete("/api/books/{callNumber}/authors/{authorId:guid}", async (IDbConnection db, string callNumber, Guid authorId) =>
{
    var workId = await db.QueryFirstOrDefaultAsync<Guid?>(
        @"SELECT e.work_id FROM holdings h JOIN editions e ON e.id = h.edition_id WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1",
        new { callNumber });
    if (workId == null) return Results.NotFound();
    var affected = await db.ExecuteAsync(
        @"DELETE FROM work_authors WHERE work_id = @workId AND author_id = @authorId",
        new { workId, authorId });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
});

// Remove cover
app.MapDelete("/api/books/{callNumber}/cover", async (IDbConnection db, string callNumber) =>
{
    var affected = await db.ExecuteAsync(
        @"UPDATE holdings SET cover_url = NULL WHERE upper(call_number) = upper(@callNumber)",
        new { callNumber });
    return affected > 0 ? Results.NoContent() : Results.NotFound();
});

// Cover: upload file to S3 (falls back to local disk when AWS not configured) or set URL
app.MapPost("/api/books/{callNumber}/cover", async (IDbConnection db, HttpContext ctx, AwsS3Service s3, string callNumber) =>
{
    var form = await ctx.Request.ReadFormAsync();
    var urlValue = form["url"].FirstOrDefault();
    var file = form.Files.GetFile("file");

    string? newCoverUrl = null;

    if (file != null && file.Length > 0)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".gif" && ext != ".webp")
            return Results.BadRequest("Unsupported image format");

        var timestamp = DateTime.UtcNow.ToString("yyyyMMddTHHmmss");
        var fileName = $"{timestamp}{ext}";

        if (s3.IsConfigured)
        {
            var key = $"library/{callNumber.ToUpper()}/{fileName}";
            using var stream = file.OpenReadStream();
            newCoverUrl = await s3.UploadAsync(stream, key, file.ContentType);
        }
        else
        {
            var uploadsPath = Path.Combine(app.Environment.WebRootPath, "uploads", "covers");
            Directory.CreateDirectory(uploadsPath);
            using var stream = File.Create(Path.Combine(uploadsPath, fileName));
            await file.CopyToAsync(stream);
            newCoverUrl = $"/uploads/covers/{fileName}";
        }
    }
    else if (!string.IsNullOrWhiteSpace(urlValue))
    {
        newCoverUrl = urlValue;
    }
    else
    {
        return Results.BadRequest("Provide either a file or a url");
    }

    await db.ExecuteAsync(
        @"UPDATE holdings SET cover_url = @newCoverUrl WHERE upper(call_number) = upper(@callNumber)",
        new { newCoverUrl, callNumber });

    return Results.Ok(new { coverUrl = newCoverUrl });
});

// File upload (PDF/EPUB) → S3 (falls back to local disk) → digital_copies
app.MapPost("/api/books/{callNumber}/files", async (IDbConnection db, HttpContext ctx, AwsS3Service s3, string callNumber) =>
{
    var editionId = await db.QueryFirstOrDefaultAsync<Guid?>(
        @"SELECT h.edition_id FROM holdings h WHERE upper(h.call_number) = upper(@callNumber) LIMIT 1",
        new { callNumber });
    if (editionId == null) return Results.NotFound();

    var form = await ctx.Request.ReadFormAsync();
    var file = form.Files.GetFile("file");
    if (file == null || file.Length == 0) return Results.BadRequest("No file provided");

    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
    if (ext != ".pdf" && ext != ".epub")
        return Results.BadRequest("Only PDF and EPUB files are accepted");

    var timestamp = DateTime.UtcNow.ToString("yyyyMMddTHHmmss");
    var fileName = $"{timestamp}{ext}";
    var format = ext == ".pdf" ? "PDF" : "EPUB";
    string fileUrl;

    if (s3.IsConfigured)
    {
        var key = $"library/{callNumber.ToUpper()}/{fileName}";
        using var stream = file.OpenReadStream();
        fileUrl = await s3.UploadAsync(stream, key, file.ContentType);
    }
    else
    {
        var uploadsPath = Path.Combine(app.Environment.WebRootPath, "uploads", "files");
        Directory.CreateDirectory(uploadsPath);
        using var stream = File.Create(Path.Combine(uploadsPath, fileName));
        await file.CopyToAsync(stream);
        fileUrl = $"/uploads/files/{fileName}";
    }

    await db.ExecuteAsync(
        @"INSERT INTO digital_copies (id, edition_id, provider, url, format, access, retrieved_at) VALUES (gen_random_uuid(), @editionId, 'upload', @fileUrl, @format, 'local', now())",
        new { editionId, fileUrl, format });

    return Results.Ok(new { url = fileUrl });
});

app.MapFallbackToFile("index.html");

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
    language = (string?)r.language,
    publisher = (string?)r.publisher,
    publisherCity = (string?)r.publisher_city,
    notes = (string?)null,
    coverUrl = (string?)r.cover_url,
    hasCover = r.cover_url != null && !string.IsNullOrEmpty((string?)r.cover_url),
    workId = (Guid)r.work_id,
    seqId = ((IDictionary<string, object>)r).TryGetValue("seq_id", out var sid) ? (long?)sid : null,
    added = DateTime.UtcNow.ToString("yyyy-MM-dd"),
    hasDigital = ((IDictionary<string, object>)r).TryGetValue("has_digital", out var hd) && hd is true
};

record BookCreateDto(
    string Title, string? Subtitle, string? Description,
    string? WorkType, string? Series,
    int? PublicationYear, string? Language,
    string? Isbn10, string? Isbn13, string? Lccn, string? Oclc,
    int? PageCount, string? PhysicalDescription,
    string? PublisherName, string? PublisherPlace,
    string Prefix, string BookNumber,
    string? Location, string? Barcode, string? CopyNotes,
    string? AvailabilityStatus, string? AcquisitionDate, string? CoverUrl,
    string? SubjectId
);

record BookUpdateDto(
    string Title, string? Subtitle, string? Description,
    string? WorkType, string? Series,
    int? PublicationYear, string? Language,
    string? Isbn10, string? Isbn13, string? Lccn, string? Oclc,
    int? PageCount, string? PhysicalDescription,
    string? PublisherName, string? PublisherPlace,
    string? Location, string? Barcode, string? CopyNotes,
    string? AvailabilityStatus, string? AcquisitionDate, string? CoverUrl,
    string? SubjectId, string? CallNumber, string? Prefix, string? BookNumber
);

record SubjectDto(string Term, string Prefix, int LastBookNumber);
record DigitalCopyDto(string? Provider, string Url, string? Format, string? Access);
record NewHoldingDto(string Prefix, string BookNumber);
record AuthorDto(string Name, string? Role);
