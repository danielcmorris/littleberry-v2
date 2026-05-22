// Views + detail modal for the library catalogue.
// Receives `lang`, `books`, `onOpen(book)`, `onNav(view, payload)`, `density`.

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso, lang) {
  const d = new Date(iso + "T00:00:00");
  const months = {
    en: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    pt: ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]
  };
  return `${d.getDate()} ${months[lang][d.getMonth()]} ${d.getFullYear()}`;
}

function byAddedDesc(a, b) { return a.added < b.added ? 1 : -1; }

function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// ── Hero featured book (top of home) ────────────────────────────────────────

function Hero({ book, lang, onOpen }) {
  const i18n = window.LIBRARY_I18N[lang];
  const subj = window.LIBRARY_SUBJECTS.find(s => s.key === book.subject);
  return (
    <section className="hero">
      <div className="hero-azulejo" aria-hidden="true" />
      <div className="hero-inner">
        <button className="hero-cover" onClick={() => onOpen(book)}>
          <window.Cover book={book} lang={lang} />
        </button>
        <div className="hero-body">
          <div className="hero-kicker">
            <span className="hero-kicker-dot" />
            {i18n.hero_kicker}
          </div>
          <h1 className="hero-title">{book.title}</h1>
          <div className="hero-author">{i18n.by} <em>{book.author}</em></div>
          <div className="hero-notes">{book.notes}</div>
          <div className="hero-meta">
            <div className="hero-meta-row">
              <span className="hero-meta-k">{i18n.detail_published}</span>
              <span className="hero-meta-v">{book.year} · {book.publisher_city}</span>
            </div>
            <div className="hero-meta-row">
              <span className="hero-meta-k">{i18n.detail_subject}</span>
              <span className="hero-meta-v">{lang === "pt" ? subj?.pt : subj?.key}</span>
            </div>
            <div className="hero-meta-row">
              <span className="hero-meta-k">{i18n.detail_call}</span>
              <span className="hero-meta-v hero-call">{book.call_number}</span>
            </div>
          </div>
          <button className="hero-cta" onClick={() => onOpen(book)}>
            {i18n.view_book} <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}

// ── New arrivals — magazine grid ────────────────────────────────────────────

function NewArrivals({ books, lang, onOpen }) {
  const i18n = window.LIBRARY_I18N[lang];
  const recent = [...books].sort(byAddedDesc).slice(0, 9); // 1 hero (2x2) + 8 standard cells
  return (
    <section className="sect">
      <header className="sect-head">
        <div>
          <h2 className="sect-h">{i18n.new_arrivals}</h2>
          <div className="sect-sub">{i18n.new_arrivals_sub} · {books.filter(b => b.added >= "2026-05-01").length} {i18n.books_count}</div>
        </div>
        <div className="sect-dec">
          <div className="sect-dec-tile" /><div className="sect-dec-tile" /><div className="sect-dec-tile" />
        </div>
      </header>
      <div className="arrivals-grid">
        {recent.map((b, i) => (
          <div key={b.id} className={`arrival arrival-${i}`}>
            <window.BookCard book={b} onOpen={onOpen} lang={lang} size={i === 0 ? "lg" : "md"} />
            <div className="arrival-added">{fmtDate(b.added, lang)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Subject tiles — azulejo mosaic ──────────────────────────────────────────

function SubjectTiles({ books, lang, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  const counts = groupBy(books, b => b.subject);
  return (
    <section className="sect">
      <header className="sect-head">
        <div>
          <h2 className="sect-h">{i18n.browse_by}</h2>
          <div className="sect-sub">{i18n.browse_by_sub}</div>
        </div>
      </header>
      <div className="subject-mosaic">
        {window.LIBRARY_SUBJECTS.map(s => (
          <button key={s.key} className="subject-tile" style={{ background: s.tile }}
                  onClick={() => onNav("subject", s.key)}>
            <div className="subject-tile-pattern" aria-hidden="true">
              <div /><div /><div /><div />
            </div>
            <div className="subject-tile-body">
              <div className="subject-tile-prefix">{s.prefix}</div>
              <div className="subject-tile-name">{lang === "pt" ? s.pt : s.key}</div>
              <div className="subject-tile-count">{(counts.get(s.key) || []).length} {(counts.get(s.key) || []).length === 1 ? i18n.book_count_one : i18n.books_count}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Author roster — alpha index ─────────────────────────────────────────────

function lastName(author) {
  // Use the "raw" if it's already "Last, First" formatted; fall back to last token.
  return author.split(" ").pop();
}

function AuthorIndex({ books, lang, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  const grouped = groupBy(books.filter(b => b.author !== "Anonymous"), b => b.author);
  const authors = [...grouped.entries()]
    .map(([name, list]) => ({ name, list, key: lastName(name) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const letters = groupBy(authors, a => a.key[0].toUpperCase());
  const ordered = [...letters.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return (
    <section className="sect">
      <header className="sect-head">
        <div>
          <h2 className="sect-h">{i18n.authors_h}</h2>
          <div className="sect-sub">{i18n.authors_sub} · {authors.length}</div>
        </div>
      </header>
      <div className="author-index">
        {ordered.map(([letter, list]) => (
          <div key={letter} className="author-letter-block">
            <div className="author-letter">{letter}</div>
            <ul className="author-list">
              {list.map(a => (
                <li key={a.name}>
                  <button className="author-row" onClick={() => onNav("author", a.name)}>
                    <span className="author-row-name">{a.name}</span>
                    <span className="author-row-count">
                      {a.list.length} {a.list.length === 1 ? i18n.book_count_one : i18n.books_count}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Subject view (filtered grid) ────────────────────────────────────────────

function SubjectView({ subject, books, lang, onOpen, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  const subj = window.LIBRARY_SUBJECTS.find(s => s.key === subject);
  const list = books.filter(b => b.subject === subject);
  return (
    <section className="sect">
      <button className="crumb" onClick={() => onNav("home")}>← {i18n.nav_home}</button>
      <header className="filter-head" style={{ background: subj?.tile }}>
        <div className="filter-head-pattern" aria-hidden="true">
          <div /><div /><div /><div /><div /><div /><div /><div />
        </div>
        <div className="filter-head-inner">
          <div className="filter-head-kicker">{i18n.sect_subjects}</div>
          <h1 className="filter-head-title">{lang === "pt" ? subj?.pt : subj?.key}</h1>
          <div className="filter-head-count">
            {list.length} {list.length === 1 ? i18n.book_count_one : i18n.books_count}
            <span className="filter-head-prefix">· {i18n.detail_call} {subj?.prefix}</span>
          </div>
        </div>
      </header>
      <div className="catalog-grid">
        {list.map(b => <window.BookCard key={b.id} book={b} onOpen={onOpen} lang={lang} />)}
      </div>
    </section>
  );
}

// ── Author view ─────────────────────────────────────────────────────────────

function AuthorView({ author, books, lang, onOpen, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  const list = books.filter(b => b.author === author).sort((a, b) => a.year - b.year);
  const subjects = [...new Set(list.map(b => b.subject))];
  return (
    <section className="sect">
      <button className="crumb" onClick={() => onNav("home")}>← {i18n.nav_home}</button>
      <header className="filter-head filter-head--author">
        <div className="filter-head-inner">
          <div className="filter-head-kicker">{i18n.sect_authors}</div>
          <h1 className="filter-head-title">{author}</h1>
          <div className="filter-head-count">
            {list.length} {list.length === 1 ? i18n.book_count_one : i18n.books_count}
            <span className="filter-head-prefix">·  {subjects.map(s => lang === "pt"
              ? window.LIBRARY_SUBJECTS.find(x => x.key === s)?.pt : s).join(" · ")}</span>
          </div>
        </div>
      </header>
      <div className="catalog-grid">
        {list.map(b => <window.BookCard key={b.id} book={b} onOpen={onOpen} lang={lang} />)}
      </div>
    </section>
  );
}

// ── Search view ─────────────────────────────────────────────────────────────

function SearchView({ query, books, lang, onOpen, setQuery, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  const q = (query || "").trim().toLowerCase();
  const results = !q ? [] : books.filter(b =>
    b.title.toLowerCase().includes(q) ||
    b.author.toLowerCase().includes(q) ||
    b.call_number.toLowerCase().includes(q) ||
    b.subject.toLowerCase().includes(q) ||
    (b.subject_pt || "").toLowerCase().includes(q)
  );
  return (
    <section className="sect">
      <button className="crumb" onClick={() => onNav("home")}>← {i18n.nav_home}</button>
      <header className="filter-head filter-head--search">
        <div className="filter-head-inner">
          <div className="filter-head-kicker">{i18n.nav_search}</div>
          <input
            className="search-bigbox"
            value={query}
            placeholder={i18n.search_placeholder}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="filter-head-count">
            {q ? `${results.length} ${i18n.search_results}` : "—"}
          </div>
        </div>
      </header>
      {q && results.length === 0 && (
        <div className="empty">{i18n.search_no_results}</div>
      )}
      <div className="catalog-grid">
        {results.map(b => <window.BookCard key={b.id} book={b} onOpen={onOpen} lang={lang} />)}
      </div>
    </section>
  );
}

// ── Detail modal ────────────────────────────────────────────────────────────

function DetailModal({ book, books, lang, onClose, onNav }) {
  const i18n = window.LIBRARY_I18N[lang];
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, []);
  if (!book) return null;
  const subj = window.LIBRARY_SUBJECTS.find(s => s.key === book.subject);
  const other = books.filter(b => b.author === book.author && b.id !== book.id).slice(0, 4);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        <div className="modal-grid">
          <div className="modal-left">
            <div className="modal-cover-wrap">
              <window.Cover book={book} lang={lang} />
            </div>
            <div className="modal-call-strip">
              <span className="modal-call-k">{i18n.detail_call}</span>
              <span className="modal-call-v">{book.call_number}</span>
            </div>
            {book.digital_copies.length > 0 ? (
              <a className="modal-digital" href={book.digital_copies[0]} target="_blank" rel="noreferrer">
                <span className="modal-digital-dot" />
                {i18n.detail_digital}
                <span className="modal-digital-arrow">↗</span>
              </a>
            ) : (
              <div className="modal-digital modal-digital--none">
                {i18n.detail_no_digital}
              </div>
            )}
          </div>
          <div className="modal-right">
            <div className="modal-kicker">{i18n.detail_record}</div>
            <h2 className="modal-title">{book.title}</h2>
            <div className="modal-author">
              {i18n.by}{" "}
              <button className="modal-author-link" onClick={() => { onNav("author", book.author); onClose(); }}>
                {book.author}
              </button>
            </div>

            <dl className="modal-dl">
              <div>
                <dt>{i18n.detail_published}</dt>
                <dd>{book.year}</dd>
              </div>
              <div>
                <dt>{i18n.detail_publisher}</dt>
                <dd>{book.publisher}, {book.publisher_city}</dd>
              </div>
              <div>
                <dt>{i18n.detail_subject}</dt>
                <dd>
                  <button className="modal-subj-link" onClick={() => { onNav("subject", book.subject); onClose(); }}
                          style={{ "--tile": subj?.tile }}>
                    <span className="modal-subj-swatch" style={{ background: subj?.tile }} />
                    {lang === "pt" ? subj?.pt : subj?.key}
                  </button>
                </dd>
              </div>
              <div>
                <dt>{i18n.detail_notes}</dt>
                <dd className="modal-notes">{book.notes}</dd>
              </div>
            </dl>

            {other.length > 0 && (
              <div className="modal-other">
                <div className="modal-other-h">{i18n.detail_other}</div>
                <div className="modal-other-grid">
                  {other.map(b => (
                    <button key={b.id} className="modal-other-card"
                            onClick={() => { onClose(); setTimeout(() => onNav("book", b), 50); }}>
                      <div className="modal-other-cover">
                        <window.Cover book={b} small ratio="2/3" lang={lang} />
                      </div>
                      <div className="modal-other-meta">
                        <div className="modal-other-title">{b.title}</div>
                        <div className="modal-other-year">{b.year}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  Hero, NewArrivals, SubjectTiles, AuthorIndex,
  SubjectView, AuthorView, SearchView, DetailModal,
});
