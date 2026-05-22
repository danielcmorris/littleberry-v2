// Cover placeholders + book card components.
// All exposed on window for cross-script use.

// CallNumberCover — subtle textured paper placeholder w/ the call number stamped.
// Uses CSS gradients only (no SVG art) per the visual system.
function CallNumberCover({ book, ratio = "2/3", small = false, t }) {
  const i18n = window.LIBRARY_I18N[t || "en"];
  // Stable per-book rotation/offset so the same book always renders identically.
  const seed = book.id * 9301 + 49297;
  const rot = ((seed % 100) - 50) / 50 * 1.6; // -1.6 .. 1.6 deg
  const xOff = ((seed >> 3) % 8) - 4;
  return (
    <div className="cover cover--placeholder" style={{ aspectRatio: ratio }}>
      <div className="cover-bg" />
      <div className="cover-frame" />
      <div className="cover-stamp">
        <div className="cover-stamp-inner"
             style={{ transform: `translateX(${xOff}px) rotate(${rot}deg)` }}>
          <div className="cover-stamp-top">{i18n.placeholder_cover_top}</div>
          <div className="cover-stamp-call">{book.call_number}</div>
          <div className="cover-stamp-bar" />
          <div className="cover-stamp-mid">{i18n.placeholder_cover_mid}</div>
        </div>
      </div>
      {!small && (
        <div className="cover-foot">
          <span className="cover-foot-title">{book.title}</span>
          <span className="cover-foot-author">{book.author.split(" ").slice(-2).join(" ")}</span>
        </div>
      )}
    </div>
  );
}

// HasCover — the "real" cover. In the prototype we don't have actual cover files,
// so we render a tinted swatch keyed off the subject + a tiny title overprint.
// This stands in for an <img> bound to /covers/{call_number}.jpg.
function HasCover({ book, ratio = "2/3" }) {
  const subj = (window.LIBRARY_SUBJECTS || []).find(s => s.key === book.subject);
  const tile = subj?.tile || "#1a4480";
  return (
    <div className="cover cover--real" style={{ aspectRatio: ratio, background: tile }}>
      <div className="cover-real-rule" />
      <div className="cover-real-title">{book.title}</div>
      <div className="cover-real-author">{book.author.toUpperCase()}</div>
      <div className="cover-real-mark">{book.call_number}</div>
    </div>
  );
}

function Cover({ book, ratio, small, lang }) {
  return book.has_cover
    ? <HasCover book={book} ratio={ratio} small={small} />
    : <CallNumberCover book={book} ratio={ratio} small={small} t={lang} />;
}

// BookCard — used in grids. Click → opens detail modal.
function BookCard({ book, onOpen, lang, size = "md" }) {
  const i18n = window.LIBRARY_I18N[lang];
  const isNew = book.added >= "2026-05-15"; // last week
  return (
    <button className={`bookcard bookcard--${size}`} onClick={() => onOpen(book)}>
      <div className="bookcard-cover">
        <Cover book={book} lang={lang} />
        {isNew && <span className="bookcard-newbadge">{i18n.new_label}</span>}
      </div>
      <div className="bookcard-meta">
        <div className="bookcard-call">{book.call_number}</div>
        <div className="bookcard-title">{book.title}</div>
        <div className="bookcard-author">{book.author}</div>
        <div className="bookcard-year">{book.year}</div>
      </div>
    </button>
  );
}

Object.assign(window, { Cover, CallNumberCover, HasCover, BookCard });
