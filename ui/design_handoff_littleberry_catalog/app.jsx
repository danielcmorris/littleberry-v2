// Main app: header + view router + tweaks.

const PALETTES = {
  cobalt: { name: "Cobalt", accent: "#1a4480", deep: "#102a55", paper: "#f7f3e9", ink: "#15192b", gold: "#c8a951" },
  indigo: { name: "Indigo", accent: "#1e2a5e", deep: "#0d1840", paper: "#f5f1e8", ink: "#0d1230", gold: "#b85c38" },
  lisbon: { name: "Lisbon", accent: "#3a6ea5", deep: "#234a73", paper: "#fafaf1", ink: "#161d2b", gold: "#d4a574" },
  heritage: { name: "Heritage", accent: "#2d5a3d", deep: "#1a3d2a", paper: "#f5efe1", ink: "#181a18", gold: "#a04444" }
};

const DENSITY = {
  compact: { card: 140, gap: 14, pad: 18 },
  comfortable: { card: 180, gap: 22, pad: 28 },
  spacious: { card: 220, gap: 32, pad: 40 }
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paletteKey": "cobalt",
  "density": "comfortable",
  "lang": "en"
} /*EDITMODE-END*/;

function Header({ lang, setTweak, onNav, view, query, setQuery }) {
  const i18n = window.LIBRARY_I18N[lang];
  const items = [
  { k: "home", label: i18n.nav_home },
  { k: "authors", label: i18n.nav_authors },
  { k: "subjects", label: i18n.nav_subjects }];

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="brand" onClick={() => onNav("home")}>
          <img className="brand-mark" src="assets/pfsa-logo.png" alt="PFSA" />
          <div className="brand-text">
            <div className="brand-title" style={{ margin: "0px 0px 10px" }}>{i18n.site}</div>
            <div className="brand-tag" style={{ lineHeight: "1", padding: "0px", margin: "0px" }}>{i18n.tagline}</div>
          </div>
        </button>
        <nav className="nav">
          {items.map((it) =>
          <button key={it.k}
          className={`nav-item ${view === it.k ? "is-active" : ""}`}
          onClick={() => onNav(it.k)}>
              {it.label}
            </button>
          )}
        </nav>
        <div className="site-tools">
          <div className="search-wrap">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              className="search-input"
              placeholder={i18n.search_placeholder}
              value={query}
              onFocus={() => onNav("search")}
              onChange={(e) => {setQuery(e.target.value);onNav("search");}} />
            
          </div>
          <button className="lang-toggle" onClick={() => setTweak("lang", lang === "en" ? "pt" : "en")}>
            <span className="lang-toggle-active">{i18n.lang_label}</span>
            <span className="lang-toggle-sep">/</span>
            <span className="lang-toggle-other">{i18n.lang_other}</span>
          </button>
        </div>
      </div>
      <div className="site-header-rule" aria-hidden="true" />
    </header>);

}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const palette = PALETTES[t.paletteKey] || PALETTES.cobalt;
  const density = DENSITY[t.density] || DENSITY.comfortable;
  const lang = t.lang;
  const books = window.LIBRARY_BOOKS;

  const [view, setView] = React.useState("home");
  const [payload, setPayload] = React.useState(null);
  const [openBook, setOpenBook] = React.useState(null);
  const [query, setQuery] = React.useState("");

  const onNav = (v, p) => {
    if (v === "book") {setOpenBook(p);return;}
    setView(v);setPayload(p || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onOpen = (b) => setOpenBook(b);

  // CSS variables driven off the active palette + density.
  const styleVars = {
    "--accent": palette.accent,
    "--deep": palette.deep,
    "--paper": palette.paper,
    "--ink": palette.ink,
    "--gold": palette.gold,
    "--card-w": density.card + "px",
    "--gap": density.gap + "px",
    "--pad": density.pad + "px"
  };

  const featured = books.find((b) => b.id === 1) || books[0];

  return (
    <div className="biblio" style={styleVars}>
      <Header lang={lang} setTweak={setTweak} onNav={onNav} view={view}
      query={query} setQuery={setQuery} />

      <main className="site-main">
        {view === "home" &&
        <>
            <window.Hero book={featured} lang={lang} onOpen={onOpen} />
            <window.NewArrivals books={books} lang={lang} onOpen={onOpen} />
            <window.SubjectTiles books={books} lang={lang} onNav={onNav} />
            <window.AuthorIndex books={books} lang={lang} onNav={onNav} />
          </>
        }
        {view === "subjects" &&
        <window.SubjectTiles books={books} lang={lang} onNav={onNav} />
        }
        {view === "authors" &&
        <window.AuthorIndex books={books} lang={lang} onNav={onNav} />
        }
        {view === "subject" && payload &&
        <window.SubjectView subject={payload} books={books} lang={lang}
        onOpen={onOpen} onNav={onNav} />
        }
        {view === "author" && payload &&
        <window.AuthorView author={payload} books={books} lang={lang}
        onOpen={onOpen} onNav={onNav} />
        }
        {view === "search" &&
        <window.SearchView query={query} setQuery={setQuery} books={books}
        lang={lang} onOpen={onOpen} onNav={onNav} />
        }
      </main>

      <footer className="site-foot">
        <div className="site-foot-rule" aria-hidden="true" />
        <div className="site-foot-inner">
          <div className="site-foot-l">
            <span className="brand-glyph" aria-hidden="true" />
            <span>LittleBerry · 12,424 books on the shelves</span>
          </div>
          <div className="site-foot-r">{window.LIBRARY_I18N[lang].footer}</div>
        </div>
      </footer>

      {openBook &&
      <window.DetailModal book={openBook} books={books} lang={lang}
      onClose={() => setOpenBook(null)} onNav={onNav} />
      }

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakColor label="Palette" value={PALETTES[t.paletteKey].accent}
        options={Object.keys(PALETTES).map((k) => [PALETTES[k].accent, PALETTES[k].gold, PALETTES[k].paper])}
        onChange={(v) => {
          const accent = Array.isArray(v) ? v[0] : v;
          const key = Object.keys(PALETTES).find((k) => PALETTES[k].accent === accent) || "cobalt";
          setTweak("paletteKey", key);
        }} />
        <div style={{
          fontSize: 10, color: "rgba(41,38,27,.5)",
          letterSpacing: ".02em", marginTop: -4
        }}>{PALETTES[t.paletteKey].name}</div>
        <TweakSection label="Density" />
        <TweakRadio label="Layout" value={t.density}
        options={[
        { value: "compact", label: "Compact" },
        { value: "comfortable", label: "Comfort" },
        { value: "spacious", label: "Spacious" }]
        }
        onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Language" />
        <TweakRadio label="UI" value={t.lang}
        options={[
        { value: "en", label: "English" },
        { value: "pt", label: "Português" }]
        }
        onChange={(v) => setTweak("lang", v)} />
      </TweaksPanel>
    </div>);

}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);