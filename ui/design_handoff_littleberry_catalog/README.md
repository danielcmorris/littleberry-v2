# Handoff: LittleBerry — J.A. Freitas Library Catalogue

## Overview

A public-facing catalogue interface for the J.A. Freitas Library — a Portuguese fraternal library of ~12,400 mostly old, mostly Portuguese-language books, run by the Portuguese Fraternal Society of America (PFSA). The interface lets visitors browse new arrivals, drill into a book's full bibliographic record, navigate by author or by subject, and search the catalogue. ~10% of titles have scanned cover images; the rest use a textured paper placeholder with the call number stamped on it.

The product is called **LittleBerry**. The library it serves is the **J.A. Freitas Library** (founded 1964).

## About the design files

The files in this bundle are **design references created in HTML/React** — high-fidelity prototypes showing intended look, content, interactions and tone. They are **not production code** to drop in.

The task is to recreate these designs in **Angular** (target stack — see "Angular implementation notes" below), using its established patterns, component library, data fetching layer, and routing. The React code in this bundle is for reference; translate the component structure into Angular components and the state into Angular signals or services.

Real backing data and cover images will replace the in-memory sample array (`data.js`) and the colored-swatch "real cover" stand-ins.

## Angular implementation notes

The reference is React + inline-JSX prototypes. Here's how each piece should map into Angular (use the most recent version available — Angular 17+ idioms assumed; signals + standalone components + new control flow).

### Component split

Each React component in the bundle becomes a standalone Angular component. Suggested module layout:

```
src/app/
  catalogue/
    home/                 home.component.ts(html|scss)     ← <Hero>+<NewArrivals>+<SubjectTiles>+<AuthorIndex> stitched together
    hero/                 hero.component
    new-arrivals/         new-arrivals.component           ← the magazine grid
    subject-tiles/        subject-tiles.component
    author-index/         author-index.component
    subject-view/         subject-view.component           ← filtered grid
    author-view/          author-view.component            ← filtered grid
    search-view/          search-view.component
    detail-modal/         detail-modal.component
    book-card/            book-card.component
    cover/                cover.component                  ← dispatches between has-cover img and placeholder
    cover-placeholder/    cover-placeholder.component      ← the textured call-number stamp
  shared/
    header/               header.component
    footer/               footer.component
  core/
    books.service.ts      data access (HttpClient → backend)
    i18n.tokens.ts        the EN/PT string catalog
    book.model.ts         the Book interface
    subject.model.ts
```

All components should be `standalone: true`. Use Angular's new control flow blocks (`@if`, `@for`, `@switch`) rather than `*ngIf` / `*ngFor`.

### State

- **Local view state** (`view`, `payload`, `openBook`, `query`, `lang`) → component `signal()`s. Don't reach for NgRx/Signal Store unless the project already uses one — this UI is small.
- **Route-driven state preferred over signals.** The current view, the open book, the search query, the language — all of these are linkable. Wire them through the Angular Router instead of holding them in a top-level component:
  - `/library` (home), `/authors`, `/subjects`, `/search?q=…`, `/author/:name`, `/subject/:key`
  - Modal as a query param: `?book=J2128`. Open/close maps to navigating with/without the query param. This makes the back button work correctly.
  - Language is `/:lang/…` or `?lang=pt` — pick one and stick with it.
- **Book list** comes from `BooksService` (HttpClient → real backend). Expose results as signals or as observables piped through `toSignal()`.

### Bindings to watch

- The hero CTA, "open in modal", and the modal's inner author/subject links → Angular Router navigations (`routerLink` or `router.navigate(...)`), not local state mutation.
- The header search input → bind `[(ngModel)]` (or a reactive `FormControl`) and feed a `debounceTime(150)` then call `router.navigate(['/search'], { queryParams: { q } })`.
- Lang toggle button → flips `lang` route segment / query param. Persist with `localStorage` so refresh keeps the choice.

### i18n

Two options, depending on what the codebase already uses:

1. **`@angular/localize` + `i18n` attributes** — proper static extraction, two compiled bundles. Heavier setup but production-correct.
2. **`@ngx-translate/core`** — runtime JSON catalog, easy language toggle at runtime. Matches the prototype's behavior more closely (the user can flip EN/PT instantly without reloading).

Either way, lift the string table at the bottom of this README into `assets/i18n/en.json` and `pt.json` and reference keys via the chosen mechanism.

`Book.subject` is a stable English key (`"Literature"`); display labels come from the subject metadata table (it has the PT translation). Same for `subject_pt` on the book itself when relevant — but prefer driving display strictly off the subject key so the metadata table stays the single source of truth.

### Styling

CSS doesn't need to change. Keep the same custom-property scheme:

- Drop the existing `<style>` block from `Library.html` into `src/styles.scss` (or `styles.css`).
- Define `--accent`, `--paper`, `--ink`, `--gold`, etc. on `:root` (or on a `.theme-cobalt` wrapper if you want themable later).
- Component-scoped styles can use the same vars freely.
- Use Angular's `:host` selector for the root of each component's scoped CSS.
- The Cormorant Garamond / DM Sans / JetBrains Mono fonts can be loaded via the same Google Fonts link in `index.html` — no font-loading library needed.

`container-type: inline-size` on the cover wrapper + `cqw` font sizing in the placeholder must be preserved — that's how the call-number stamp scales for both hero-size and thumbnail-size covers. No Angular wrinkle here, but be careful that view-encapsulated styles don't break the container-query relationship (Angular's default `ViewEncapsulation.Emulated` keeps it intact; `ShadowDom` mode may not).

### Modal

Use Angular CDK's `Overlay` for the detail modal — it handles the scrim, focus trap, scroll lock, and Esc-to-close out of the box. Mount the modal component into the overlay portal when `?book=…` is in the URL; close it (and `router.navigate([], { queryParams: { book: null }, queryParamsHandling: 'merge' })`) on scrim click, Esc, or the X button.

Alternative: a plain `<dialog>` element with `showModal()` works fine if you don't need CDK in the project.

### Animations

Most of the prototype uses plain CSS transitions on `:hover`. Keep them.

For the modal you can either skip entry animation (current behavior) or use Angular's `@angular/animations` `:enter` / `:leave` triggers with a 200ms opacity fade on the scrim. Optional.

### Tweaks (prototype-only)

Don't port the floating tweaks panel. Pick Cobalt + comfortable + EN (or whatever the client signs off on) and hardcode it.

### Forms

There are no forms in this catalogue beyond the search input — `FormControl` with `valueChanges.pipe(debounceTime(150))` is plenty.

### Suggested Angular libraries

- **Routing**: built-in `@angular/router` (use loadComponent for lazy chunks once view count grows)
- **HTTP**: built-in `@angular/common/http` with `provideHttpClient(withFetch())`
- **Modal/overlay**: `@angular/cdk/overlay` (already a peer of `@angular/material` if you ever add it)
- **i18n**: `@angular/localize` for static; `@ngx-translate/core` for runtime toggle
- **No UI kit needed.** Don't pull in Angular Material — the design is bespoke and Material's defaults will fight you.

### Map of React idioms → Angular

| React (in this bundle)          | Angular equivalent                            |
|---------------------------------|-----------------------------------------------|
| `useState(x)`                    | `signal(x)`                                   |
| `useEffect(() => …, [dep])`      | `effect(() => …)` or lifecycle hook + `effect`|
| `props.children`                 | `<ng-content>`                                |
| `<X foo={bar}/>`                 | `<app-x [foo]="bar" />`                       |
| `onClick={fn}`                   | `(click)="fn()"`                              |
| `lang === 'en' ? a : b`          | `@if (lang() === 'en') { a } @else { b }`     |
| `array.map(item => <X .../>)`    | `@for (item of array; track item.id) { … }`   |
| inline `style={{...}}`           | `[style.--accent]="palette.accent"` (per-property) or `[ngStyle]` |
| `Object.assign(window, …)`       | Just `export` from the file                   |

### Critical translation gotchas

- The `Cover` component decides between `<img>` and the placeholder based on `book.has_cover`. Implement this as `@if (book.has_cover) { <img …> } @else { <app-cover-placeholder [book]="book" /> }` — not as a CSS toggle.
- The placeholder's per-book rotation/x-offset is a deterministic seed off `book.id`. Compute it once in the component (in a `computed()`) and bind into a `[style.transform]`.
- The footer string ("LittleBerry · 12,424 books on the shelves") is hardcoded in the prototype because `books.length` was the sample-data size (24). In production, query the actual catalogue count from the backend and interpolate it: `LittleBerry · {{ totalBooks | number }} books on the shelves`.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, layout, and interaction patterns are decided. Recreate the UI pixel-close using the target codebase's libraries and patterns. Two areas are intentionally placeholder:

- The "real cover" component renders a colored swatch with overprinted title/author/call-number. In production this should be replaced by `<img src="/covers/{call_number}.jpg">` with a graceful fallback to the textured placeholder for books with no scan.
- Sample data is 23 books. Production reads from the real catalogue (~12,400 entries) plus the per-book scrape JSON.

## Visual system

### Brand & aesthetic

Portuguese azulejo-inspired — cobalt blue + warm paper + brass-gold accents, with a quiet tile motif decorating hero areas. Library/archive feel without being stuffy. Logo is the PFSA olive-wreath mark.

### Type pairing

- **Display / titles**: Cormorant Garamond (Google Fonts), weights 400–700, also italic 400/500. Used for book titles, hero titles, section headings, modal titles, author signature.
- **UI / body**: DM Sans, weights 400/500/600/700. Used for nav, body text, buttons, labels.
- **Mono / metadata**: JetBrains Mono, weights 400/500/600. Used for call numbers, dates, lookup-source labels, "kicker" subtitles, eyebrow text.

### Color palette (default "Cobalt" theme)

| Token        | Value      | Used for                                    |
|--------------|------------|---------------------------------------------|
| `--accent`   | `#1a4480`  | Primary cobalt — links, call numbers, CTAs, subject tiles |
| `--deep`     | `#102a55`  | Pressed/hover state of accent buttons       |
| `--paper`    | `#f7f3e9`  | Page background, modal background           |
| `--ink`      | `#15192b`  | Primary text                                |
| `--gold`     | `#c8a951`  | Brass accent — "NEW" badge, hero dot, decorative tile, gold rule in footer |

Three alternate palettes (Indigo, Lisbon, Heritage) ship as tweakable variants — see `app.jsx`'s `PALETTES` const. For production, ship Cobalt as the only theme unless the client wants user-selectable themes.

Supporting colors used in tile components (each subject gets its own shade, all in the cobalt family):

| Subject     | Tile color |
|-------------|------------|
| Literature  | `#1a4480`  |
| Poetry      | `#2c5f9e`  |
| History     | `#1d3a6e`  |
| Religion    | `#3a5c8c`  |
| Travel      | `#446aa3`  |
| Drama       | `#234876`  |
| Education   | `#2a5187`  |
| Philosophy  | `#1e3565`  |

### Spacing & density

The prototype exposes 3 density settings (compact / comfortable / spacious) that drive `--card-w`, `--gap`, `--pad`. Comfortable is the default. Production can hardcode comfortable unless you want this as a user preference.

- Comfortable: card min-width `180px`, grid gap `22px`, section pad `28px`

### Borders, radii, shadows

- Card/cover border-radius: `1px` (almost-sharp — feels like a printed book)
- Hero/modal/filter-head border-radius: `4px`
- Tile/button border-radius: `4–7px`
- Book covers have a layered drop shadow:
  `drop-shadow(0 6px 14px rgba(0,0,0,0.13)) drop-shadow(0 2px 4px rgba(0,0,0,0.08))`
- Hero cover (larger): `drop-shadow(0 12px 24px rgba(0,0,0,0.15)) drop-shadow(0 4px 8px rgba(0,0,0,0.1))`

### The azulejo tile motif

Used as a quiet decorative pattern on the hero area. Implemented as a CSS-only multi-layer gradient (no SVG, no image asset) — see `.hero-azulejo` / `.azulejo-bg` in `Library.html`. Reproduce verbatim or replace with a real SVG tile pattern if the codebase prefers. Opacity is held to ~5–12% so it never competes with content.

### Decorative shapes used

- **Diamond tiles** (rotated squares) in section-header decorations
- **Concentric circle/diamond** patterns inside subject tiles, drawn with `::before`/`::after` + a `.subject-tile-pattern` grid (4 nested divs)
- **Repeating tile rule** in the footer (alternating cobalt + gold blocks every 64px)

## Bilingual

The UI supports English (default) and Portuguese with a one-click toggle in the header. All copy lives in `data.js` under `window.LIBRARY_I18N.en` / `.pt`. In production, route through the codebase's i18n layer (next-intl, react-i18next, vue-i18n, Rails I18n, etc.). String catalog is reproduced at the bottom of this README.

Books carry separate `subject_pt` and `title_pt` fields when relevant; pick the language-appropriate field at render time.

## Screens / views

### 1. Header (persistent, sticky)

Stays pinned to the top across all views. Background is `--paper` at 92% with `backdrop-filter: blur(12px) saturate(140%)`. Bottom edge is a soft horizontal accent rule fading at both ends.

Layout: `display: flex; align-items: center; gap: 24px; padding: 14px 32px; max-width: 1320px; margin: 0 auto`.

Contents in order:
- **Brand block**: PFSA olive-wreath logo (44px tall, width auto) + library name "The J.A. Freitas Library" (Cormorant 18px / 600) + tagline "FOUNDED IN 1964 — OVER 12,000 WORKS DOCUMENTING THE PORTUGUESE EXPERIENCE" (DM Sans 9px / uppercase / 60% ink / line-clamped to 2 lines)
- **Nav**: text buttons "Library / Authors / Subjects" (13px / 500). Active state: cobalt text on 8%-cobalt background pill.
- **Spacer** (`margin-left: auto` on tools block)
- **Search input**: 200px wide, 8/12/8/30 padding, magnifying-glass glyph at left. Focus → moves to dedicated Search view. Live filter.
- **Lang toggle**: `EN / PT` pill, JetBrains Mono, 11px. Active language is cobalt+bold; the other is dimmed.

### 2. Home

Stacks four sections:

#### 2a. Featured hero

A wide card (border-radius 4px, faint azulejo background pattern) with a 2-column inner layout: `280px` cover on the left, full-width body on the right.

Right column, top to bottom:
- Kicker: gold dot + "FEATURED THIS WEEK" in JetBrains Mono 10.5px uppercase, cobalt
- Title: Cormorant Garamond, `clamp(36px, 4.2vw, 56px) / 600`, ink, balanced wrap
- "by *Author*" — Cormorant 22px, author italic + cobalt
- Notes paragraph: 15px DM Sans, 78% ink, max-width 56ch
- Meta grid: three rows with dotted thin rule above each — Published / Subject / Call Number
- CTA: cobalt button "View record →" — pressing it opens the detail modal for the featured book

Hero cover gets a slightly larger drop shadow than catalogue cards.

#### 2b. New arrivals (magazine grid)

Magazine-style 4-column grid. The single newest book occupies a 2×2 cell (top-left), spanning the height of two rows of standard cards. The next 8 cards flow into the remaining cells. Cards arrange themselves to use `align-self: start` so they don't stretch.

Each grid cell holds a `BookCard` + a date stamp below it (DM Mono 10.5px, formatted "14 May 2026" in EN or "14 mai 2026" in PT).

Books added within the last 7 days carry a **NEW** badge (gold pill, top-right of the cover, 9px JetBrains Mono uppercase). The single newest card uses a bigger title and a larger cover drop-shadow.

Section header: serif H2 "Recent additions" (32px) + mono sub "Catalogued this month · N books" + decorative diamond cluster on the right (two cobalt, one gold).

#### 2c. Browse by subject (azulejo mosaic)

4-column grid of square tiles (`aspect-ratio: 1/1`, 8px gap). Each tile:
- Tinted with a per-subject color (table above)
- Decorative concentric layers: a centered rotated square + centered circle (both at 30% width, white at low opacity), plus 4 large circles in a 2×2 grid each at ~22% margin
- Top-left: small `prefix` letter (e.g. "L" for Literature)
- Bottom-left: subject name (Cormorant Garamond, `clamp(22px, 2.3cqw, 30px)`) + count line ("12 books")

Hover: subtle 1.015× scale.

#### 2d. Authors index

Two-column grid (`36px 60px` gap). Each cell shows:
- A serif letter glyph (Cormorant 56px / 500 cobalt) inside a `56px` column with a vertical rule on its right
- An author list to its right: each row has the author name (Cormorant 16px) on the left and a small mono count on the right ("3 books"). Dotted underline. Hover → cobalt.

Authors are sorted by last token of the name; entries grouped by initial of last name. "Anonymous" is filtered out.

### 3. Author view (filtered list)

A breadcrumb ("← Library") + a full-width banner head (cobalt or near-ink background, 56/48 padding, circles+diamonds decorative pattern in 8 columns at 16% opacity) + a catalogue grid below.

Banner head contents:
- Kicker mono "By author"
- Title in Cormorant `clamp(40px, 5vw, 64px)` / 600 / white
- Count + subjects under the title in mono

Below: catalogue grid (auto-fill, min `--card-w`, gap `--gap`) of `BookCard` items.

### 4. Subject view (filtered list)

Same banner-head structure as Author view but the banner uses the per-subject tile color as background. Kicker mono "By subject"; title is the subject name; count line shows total + call-number prefix.

### 5. Search view

Same banner-head shell as Author/Subject. Inside the banner the title slot is a large translucent search box (Cormorant 28px / placeholder italic / white background at 10% opacity / 1.5px white-30% border). Live-filters across title, author, call_number, subject, subject_pt as the user types. Results render in the same catalogue grid. Empty query shows a "—" count and no grid. Non-empty with no matches shows "Nothing matches that query." in big italic serif.

### 6. Book detail modal

Opens over any view when a card or hero CTA is clicked. Scrim is `rgba(15,25,50,0.55)` with `backdrop-filter: blur(6px)`. Card is `1080px` max width, `--paper` background, 4px radius, max-height `calc(100vh - 48px)`, scrolls internally. Close-X button top-right (32px circle, 5%-black bg). Esc and scrim-click both close.

Two-column body (`280px 1fr`, 56px gap, 56px padding):

**Left column:**
- Book cover at full column width
- Call-number strip: a 6%-cobalt block with a 3px cobalt left border, "CALL NUMBER" mono label on the left, the call number (mono 16px / 600 cobalt) on the right
- Digital-copy chip:
  - If `digital_copies[]` is non-empty: gold-tinted box with a pulsing gold dot + "Digital copy available" + ↗ arrow → opens external link in new tab
  - Otherwise: transparent box with dashed muted border + "No digital copy located" in italic

**Right column:**
- Kicker mono "Catalogue record" in cobalt
- Title in Cormorant `clamp(34px, 3.8vw, 48px)` / 600 / balanced wrap
- "by *Author Name*" — Cormorant 18px, author is a button styled as cobalt italic with a thin underline, clicking it navigates to Author view (closes modal first)
- Definition list with thin top rules between rows: Published / Publisher / Subject / Notes
  - Subject is a chip-style button (swatch + name) that navigates to Subject view
- "Other titles by this author" footer rail: up to 4 thumb cards (each a mini cover + title in 13px Cormorant + year in mono). Clicking re-opens the modal for that book.

### 7. Footer

Soft accent rule on top (alternating cobalt + transparent + gold + transparent blocks every 64px, opacity 50%, masked by a faint horizontal gradient). Two-column footer text in JetBrains Mono 11.5px, 50% ink:

- Left: a small rotated cobalt diamond glyph + `LittleBerry · 12,424 books on the shelves`
- Right: provenance line — `Catalogued by hand. Cross-referenced with BNP, LoC, Google Books, and Internet Archive.` (the PT version translates "Catalogado à mão. Referenciado com BNP, LoC, Google Books e Internet Archive.")

## Cover system

Two cover components, both honoring `aspectRatio: 2/3` and bordered by the same drop-shadow stack.

### Real cover (≈10% of books, `book.has_cover === true`)

Production: a `<img>` of the scanned cover, with `object-fit: cover`, no padding.

In the prototype this is stood in by `cover--real`: a colored swatch (subject's tile color) with the book title (Cormorant, clamp 11–22px via container queries) and author (mono, 7–11px) overprinted in white, plus a 2px white rule at the top and a small call-number stamp in the bottom-right corner.

### Placeholder cover (no scan)

A textured paper rectangle. Construction:
- Background: stacked repeating linear gradients on warm cream — gives a horizontal pinstripe texture suggesting laid paper, plus two soft radial gradients top-left/bottom-right
- Inset frame: 14px inset border in 25%-cobalt, with solid 3px cobalt bars on top/bottom edges
- **The call-number stamp**: centered cartouche
  - "BIBLIOTECA" eyebrow (mono, very tight letter-spacing, clamp 7–10px)
  - The call number itself in a bordered, paper-white box (mono, clamp 14–32px via container queries, 1.5px 40%-cobalt border)
  - A 2px gold rule
  - The Portuguese-italic word "no cover yet" (Cormorant italic, 11px, 50% ink) → in PT "sem capa"
- The whole stamp is rotated and offset slightly by a deterministic per-book seed (rotation ±1.6°, x-offset ±4px) so different placeholders feel hand-stamped rather than identical
- Bottom: a dashed-rule strip with book title (Cormorant italic 9.5px) and last 2 words of the author name (mono uppercase 7.5px), both ellipsis-truncated

In production this is purely CSS — no per-book images need to be generated. Pass the book record and the call number renders automatically.

### Critical CSS

The cover wrapper has `container-type: inline-size`. Inside, font sizes use `cqw` (container-query-width) units so the stamp and overprint scale with the cover's actual width — works for both the big hero cover (~280px) and the thumbnail-sized covers in the "other by author" rail (~80px). If the target framework doesn't support container queries, swap to viewport units or a JS-driven `--scale` CSS variable.

## Interactions & behavior

### Navigation
- Clicking any `BookCard` or hero CTA opens the detail modal
- Modal: clicking author link or subject chip closes modal first, then navigates (`setTimeout(navigate, 50)` so the modal-close animation runs)
- Modal: clicking "Other titles by this author" cards re-opens the modal for the new book (no view navigation)
- Header nav buttons switch views; the Library button always returns home
- Crumb "← Library" at the top of filter views returns home
- Brand area is a button → home

### Search
- Focusing the header search input switches to the Search view (so live results appear without forcing the user to leave home)
- Typing dispatches both `setQuery` and `onNav('search')` on every keystroke
- Search matches across title, author, call_number, subject (en), and subject_pt
- Empty input → no results shown, count displays "—"

### Tweaks (prototype-only)

Three controls in a floating bottom-right panel: palette swatches (4 options), density radio (3 options), language radio (2 options). These exist as a designer-facing tool to compare variants. **Don't ship them.** Pick one palette/density combo for production and hardcode it.

### Animations
- Cards hover: `translateY(-3px)` over .15s
- Hero CTA hover: deeper blue + `translateX(2px)`
- Subject tiles hover: `scale(1.015)`
- Digital-copy dot: 2s pulse on the gold availability indicator
- No modal entry animation in the latest pass — the prototype uses instant mount/unmount. Add a 200ms opacity fade on the scrim if it feels right.

### Responsive (≤ 880px)
- Hero stacks (cover above body)
- Arrivals grid becomes 2 columns; the hero card spans both
- Modal grid stacks single-column
- Author index becomes single-column
- Subject mosaic becomes 2 columns
- Header gap shrinks to 16px

## State management

What this UI needs from the backend:

1. **List of books** (paginated, but home only needs latest ~10 and per-author/per-subject views need their slice). Each book object shape:
   ```
   id, call_number, prefix, title, title_pt, author, author_raw,
   subject (canonical English key), subject_pt,
   year, publisher, publisher_city, notes,
   has_cover (bool), added (ISO date),
   digital_copies (string[] of URLs)
   ```
2. **Optional admin payload** (not visible in this UI) — the raw scrape JSON for verification later: `lookups.{bnp,google_books,loc,internet_archive,open_library,bn_digital,cultura_acores}` plus `digital_copies_found[]` and `processing_metadata`. The current public UI hides these per spec — but they're available on the book record and should be wired to an admin-only verification view in a follow-up.
3. **Static subject metadata** — the 8 subject keys + their PT translation + tile color + call-number prefix. Currently in `window.LIBRARY_SUBJECTS`.
4. **i18n strings** — currently in `window.LIBRARY_I18N`.

Local UI state:
- `view`: one of `home | authors | subjects | author | subject | search`
- `payload`: the author name or subject key when in a filter view
- `openBook`: the book object currently in the modal, or null
- `query`: the search input string
- `lang`: 'en' | 'pt'

For production, prefer URL-driven state so author/subject/search views are linkable (e.g. `/author/Eça%20de%20Queirós`, `/subject/Literature`, `/search?q=…`, `/book/J2128`). Modal can be `?book=J2128` query param.

## Design tokens

```css
/* Colors (Cobalt theme) */
--accent: #1a4480;
--deep:   #102a55;
--paper:  #f7f3e9;
--ink:    #15192b;
--gold:   #c8a951;

/* Type */
--serif: "Cormorant Garamond", "Adobe Garamond", "EB Garamond", Georgia, serif;
--sans:  "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--mono:  "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;

/* Density (comfortable, default) */
--card-w: 180px;
--gap:    22px;
--pad:    28px;
```

Recurring measurements:
- Site max-width: `1320px`
- Page horizontal padding: `32px`
- Section bottom margin: `72px`
- Magazine grid: `repeat(4, 1fr)`, hero spans 2 cols × 2 rows
- Catalogue grid: `repeat(auto-fill, minmax(var(--card-w), 1fr))`
- Cover aspect: `2 / 3`
- Modal: max-width `1080px`, left col `280px`, gap `56px`, padding `56px`

## Assets

- `assets/pfsa-logo.png` (234×120, transparent PNG) — provided by client. The PFSA olive-wreath mark.
- No cover images are bundled. Real covers will live at `/covers/{call_number}.{jpg|png}` (or wherever the codebase's media pipeline puts them) — the `Cover` component should `<img>` when `has_cover === true` and fall back to the placeholder otherwise.

## Files in this bundle

- `Library.html` — entry point. All CSS is inline in `<style>`. Loads React + Babel and the four component/data scripts.
- `app.jsx` — `App` and `Header`. Owns view state, palette/density/lang tweaks, the view router.
- `views.jsx` — `Hero`, `NewArrivals`, `SubjectTiles`, `AuthorIndex`, `SubjectView`, `AuthorView`, `SearchView`, `DetailModal`. Plus tiny helpers (`fmtDate`, `groupBy`, `lastName`).
- `covers.jsx` — `Cover`, `HasCover` (real-cover stand-in), `CallNumberCover` (textured placeholder), `BookCard`.
- `data.js` — sample books, subject metadata, i18n strings.
- `tweaks-panel.jsx` — vendored utility from the prototype tool. Not needed in production; safe to delete during reimplementation.
- `assets/pfsa-logo.png` — brand asset.

## Full string catalog (for i18n)

| Key | EN | PT |
|-----|-----|-----|
| site | The J.A. Freitas Library | Biblioteca J.A. Freitas |
| tagline | Founded in 1964 — over 12,000 works documenting the Portuguese experience | Fundada em 1964 — mais de 12.000 obras a documentar a experiência portuguesa |
| nav_home | Library | Acervo |
| nav_authors | Authors | Autores |
| nav_subjects | Subjects | Assuntos |
| nav_search | Search | Pesquisar |
| new_arrivals | Recent additions | Aquisições recentes |
| new_arrivals_sub | Catalogued this month | Catalogados este mês |
| hero_kicker | Featured this week | Em destaque |
| view_book | View record | Ver registo |
| by | by | por |
| on_shelves | books on the shelves | livros nas estantes |
| browse_by | Browse by subject | Navegar por assunto |
| browse_by_sub | Eight categories spanning the collection | Oito categorias que abrangem o acervo |
| authors_h | Authors | Autores |
| authors_sub | Catalogued writers in the collection | Escritores catalogados |
| books_count | books | livros |
| book_count_one | book | livro |
| detail_record | Catalogue record | Registo bibliográfico |
| detail_published | Published | Publicado |
| detail_publisher | Publisher | Editora |
| detail_subject | Subject | Assunto |
| detail_call | Call number | Cota |
| detail_notes | Notes | Notas |
| detail_digital | Digital copy available | Cópia digital disponível |
| detail_no_digital | No digital copy located | Sem cópia digital localizada |
| detail_other | Other titles by this author | Outras obras deste autor |
| search_placeholder | Search titles, authors, call numbers… | Procurar títulos, autores, cotas… |
| search_results | results | resultados |
| search_no_results | Nothing matches that query. | Nenhum resultado. |
| placeholder_cover_top | BIBLIOTECA | BIBLIOTECA |
| placeholder_cover_mid | no cover yet | sem capa |
| footer | Catalogued by hand. Cross-referenced with BNP, LoC, Google Books, and Internet Archive. | Catalogado à mão. Referenciado com BNP, LoC, Google Books e Internet Archive. |
| sect_authors | By author | Por autor |
| sect_subjects | By subject | Por assunto |
| new_label | NEW | NOVO |

## Out of scope / suggested follow-ups

- **Admin verification flow** — surface the raw scrape lookups (BNP, LoC, Google Books, IA, Open Library, BN Digital) for staff to confirm matches and merge data. The scrape JSON is per-book; an admin view should let a librarian pick which match is "the truth" for a given record.
- **Cover upload UI** — let staff drag-drop a cover scan for a book, replacing the placeholder.
- **Full catalogue / pagination view** — the prototype doesn't surface "all 12,400 books" in one grid. A paginated/virtualized catalogue view is the obvious next thing.
- **Author disambiguation** — current grouping is naive (last token of name). A real implementation will need an `authors` table with canonical IDs.
