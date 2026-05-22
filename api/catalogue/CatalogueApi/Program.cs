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
app.UseStaticFiles();
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
        where.Add("(to_tsvector('simple', w.title) @@ plainto_tsquery('simple', @search) OR lower(a.name) LIKE @searchLike OR lower(h.call_number) LIKE @searchLike OR h.book_id::text LIKE @searchLike OR h.book_number::text LIKE @searchLike)");
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
            e.publication_year AS year, e.language,
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

// Single book by call number — must come before /edit route match order doesn't matter in MapGet
app.MapGet("/api/books/{callNumber}", async (IDbConnection db, string callNumber) =>
{
    const string sql = @"
        SELECT h.id, h.book_id, h.call_number, h.prefix, h.cover_url,
               w.id AS work_id, w.title,
               a.name AS author,
               s.term AS subject, s.prefix AS subject_prefix,
               e.publication_year AS year, e.language,
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

    const string dcSql = @"SELECT url FROM digital_copies dc JOIN editions e ON e.id = dc.edition_id JOIN holdings h ON h.edition_id = e.id WHERE upper(h.call_number) = upper(@callNumber)";
    var digitalCopies = (await db.QueryAsync<string>(dcSql, new { callNumber })).ToList();

    var book = MapBook(row);
    return Results.Ok(new {
        book.id, book.bookId, book.callNumber, book.prefix, book.coverUrl, book.hasCover,
        book.workId, book.title, book.author, book.subject, book.subjectPrefix,
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
               h.acquisition_date::text AS acquisition_date, h.cover_url, h.subject_id,
               w.id AS work_id, w.title, w.subtitle, w.normalized_title,
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
        LEFT JOIN subjects s ON s.id = h.subject_id
        WHERE upper(h.call_number) = upper(@callNumber)
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
            subjectId = row.subject_id == null ? (Guid?)null : (Guid)row.subject_id,
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
        await db.ExecuteAsync(
            @"UPDATE works SET title=@Title, subtitle=@Subtitle, description=@Description, work_type=@WorkType, series=@Series WHERE id=@workId",
            new { dto.Title, dto.Subtitle, dto.Description, dto.WorkType, dto.Series, workId = (Guid)ids.work_id },
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
        Guid? subjectId = Guid.TryParse(dto.SubjectId, out var sid) ? sid : (Guid?)null;

        await db.ExecuteAsync(
            @"UPDATE holdings SET
                location=@Location, barcode=@Barcode, copy_notes=@CopyNotes,
                availability_status=@AvailabilityStatus,
                acquisition_date=CASE WHEN @acqDate IS NULL THEN NULL ELSE @acqDate::date END,
                cover_url=@CoverUrl, subject_id=@subjectId,
                call_number=COALESCE(NULLIF(@CallNumber,''), call_number),
                prefix=COALESCE(NULLIF(@Prefix,''), prefix),
                book_number=COALESCE(NULLIF(@BookNumber,''), book_number)
              WHERE id=@holdingId",
            new { dto.Location, dto.Barcode, dto.CopyNotes, dto.AvailabilityStatus, acqDate, dto.CoverUrl,
                  subjectId, dto.CallNumber, dto.Prefix, dto.BookNumber, holdingId = (Guid)ids.holding_id },
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

// Cover: upload file or set URL
app.MapPost("/api/books/{callNumber}/cover", async (IDbConnection db, HttpContext ctx, string callNumber) =>
{
    var form = await ctx.Request.ReadFormAsync();
    var urlValue = form["url"].FirstOrDefault();
    var file = form.Files.GetFile("file");

    string? newCoverUrl = null;

    if (file != null && file.Length > 0)
    {
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp")
            return Results.BadRequest("Unsupported image format");

        var guid = Guid.NewGuid().ToString("N");
        var fileName = $"{guid}{ext}";
        var uploadsPath = Path.Combine(app.Environment.WebRootPath, "uploads", "covers");
        Directory.CreateDirectory(uploadsPath);
        var filePath = Path.Combine(uploadsPath, fileName);

        using (var stream = File.Create(filePath))
            await file.CopyToAsync(stream);

        newCoverUrl = $"/uploads/covers/{fileName}";
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

// File upload (PDF/EPUB) → digital_copies
app.MapPost("/api/books/{callNumber}/files", async (IDbConnection db, HttpContext ctx, string callNumber) =>
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

    var guid = Guid.NewGuid().ToString("N");
    var fileName = $"{guid}{ext}";
    var uploadsPath = Path.Combine(app.Environment.WebRootPath, "uploads", "files");
    Directory.CreateDirectory(uploadsPath);
    var filePath = Path.Combine(uploadsPath, fileName);

    using (var stream = File.Create(filePath))
        await file.CopyToAsync(stream);

    var fileUrl = $"/uploads/files/{fileName}";
    var format = ext == ".pdf" ? "PDF" : "EPUB";

    await db.ExecuteAsync(
        @"INSERT INTO digital_copies (id, edition_id, provider, url, format, access, retrieved_at) VALUES (gen_random_uuid(), @editionId, 'upload', @fileUrl, @format, 'local', now())",
        new { editionId, fileUrl, format });

    return Results.Ok(new { url = fileUrl });
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
    language = (string?)r.language,
    publisher = (string?)r.publisher,
    publisherCity = (string?)r.publisher_city,
    notes = (string?)null,
    coverUrl = (string?)r.cover_url,
    hasCover = r.cover_url != null && !string.IsNullOrEmpty((string?)r.cover_url),
    workId = (Guid)r.work_id,
    added = DateTime.UtcNow.ToString("yyyy-MM-dd")
};

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

record DigitalCopyDto(string? Provider, string Url, string? Format, string? Access);
