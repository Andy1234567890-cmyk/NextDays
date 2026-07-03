# Framer — vollständige Funktionsreferenz (Bau-Vorlage für den Website-Builder)

> Recherche-Basis für den white-label Page-Builder in `builder/` + Editor in `apps/web`.
> Quellen: offizielle Framer-Doku (framer.com/help, /academy, /developers, /updates),
> framer.university, Community. Erhoben 2026-07. Referenz ist verbindlich (Framer-Klon).
> Status-Legende: ✅ vorhanden · 🟡 teilweise · ❌ fehlt.

## 0. Editor-Grundgerüst (3-Spalten)
Layers/Pages/Assets links · Device-Frame-Canvas Mitte · Properties-Inspektor rechts · Tools oben+unten.

---

## 1. Canvas & Breakpoints
- **Pan:** Space+Drag, Hand-Tool (H), Trackpad-2-Finger. ✅ (Hand-Tool klickbar gebaut)
- **Zoom:** Cmd/Ctrl+Wheel (zum Cursor), Pinch, +/−, Shift+0=100%, Shift+1=Fit alle, Shift+2=Fit Selection. 🟡 (Fit alle ✅, Shortcuts teils)
- **Breakpoints:** Desktop 1200 (primär/parent), Tablet 810, Phone 390; Custom erlaubt. Desktop-first-Kaskade, Overrides blau. Frames nebeneinander. ✅ (Multi-Frame + freies Verschieben gebaut)
- **Snapping/Guides:** rote Ausrichtungslinien (Kanten/Center fluchten), pinke/magenta Abstandsmaße, Alt=Measure-on-hover, Distribution-Guides. 🟡 (rote Linien voll durchgezogen + pinke Maße gebaut; Alt-Measure + Distribution fehlen)
- **Selektion:** blaue Outline + Label; Doppelklick=tiefer, Esc=Parent; Shift=Multi; Nudge (Pfeile 1px/Shift 10px). 🟡

## 2. Insert / einfügbare Elemente
- **Öffnen:** Insert-Button / `I`, Suchfeld, Drag-Drop.
- **Layout:** Frame (F, draw), Stack (Auto-Layout), Grid. 🟡 (Frame ✅; Stack/Grid/Masonry ✅ als Editor-Container — rudimentär, werden nicht persistiert)
- **Basic:** Text (T), Image (Fill/Fit/Stretch/Tile, Alt, lazy, AVIF/WebP), Video (Autoplay/Loop/Muted/Controls/Poster), SVG/Vector (Path-Edit, Icon-Sets), Embed (URL-iframe / HTML-Script). 🟡 (Hero/Abstand-Blöcke ✅, Rest ❌)
- **Components:** Master/Instance (nur Frame/Stack konvertierbar), Variants, Overrides via Property-Controls, Slots (ComponentInstance). ❌
- **Ready-made:** Ticker, Nav, Carousel, Accordion, Form, Lottie. ❌
- **Shortcuts:** I=Insert, F=Frame, T=Text, ⌘⌥I=Image, ⌘⌥K=Component, ⌘K=Palette.

## 3. Layout-System (CSS-Abbildung)
- **Frame** = position:relative + Kinder absolute (Pins). **Stack** = flexbox. **Grid** = css-grid.
- **Stack:** Direction (row/col), Distribute (start/center/end/space-between/around/evenly → justify-content), Align (→ align-items), Gap, Padding (uniform/per-side), Wrap. 🟡 (Basis-Container ✅, nicht persistiert; volle Steuerung offen)
- **Grid:** columns/rows (repeat(n,1fr)), gap, margins, maxWidth; per-Item colSpan/rowSpan. 🟡 (Basis-Container ✅, nicht persistiert; per-Item-Spans offen)
- **Sizing (W & H unabhängig):** Fixed | Relative(%) | Fill(flex:1 / 100%) | Fit(fit-content) | Viewport(vw/vh); + Min/Max; Aspect-Ratio-Lock. 🟡 (Frame Fixed ✅)
- **Pins/Constraints:** Top/Right/Bottom/Left an/aus + Center-H/V; gegenüberliegend gepinnt = stretch. Position-Typ: relative/absolute/fixed/sticky. 🟡 (Pins-Widget ✅, Position-Typen ❌)
- **Responsive:** jedes Property pro Breakpoint überschreibbar (Delta-Override, Vererbung groß→klein). 🟡

## 4. Style-/Properties-Inspektor (rechts, kontextsensitiv)
Fast JEDE Property hat das **⊕-Bind-Badge** (Variable binden). 🟡 (nur Opazität/Sichtbar/Füllen/Überlauf)
- **Position/Size, Layout, Typography, Fill, Border, Radius, Shadow, Effects, CSS-Styles, Transform, Scroll-Section, Accessibility, Code-Overrides, Component-Props.**
- **CSS-Styles:** Opacity ✅, Visible ✅, Overflow ✅, Blending 🟡, Filters ❌, Blur ❌, Mask ❌, Z-Index 🟡, Pointer-Events 🟡, User-Select 🟡.

## 5. Variables & Conditional Values (Set Variable)
- **Typen:** Text, FormattedText, Number, Boolean, Option/Enum, Color, Image, Date, Link, Event, Reference, Multi-Reference.
- **Eigenschaften:** Number(default/min/max/step/unit/displayStepper), Boolean(default/enabledTitle/disabledTitle), Text(default/placeholder/maxLength/textArea), Enum(options/titles/segmented), Color(default/optional), universell title/description/hidden.
- **Query-Param** (auto-slug aus Name) + Default-Fallback; via Query-Param/Interaktion zur Laufzeit änderbar.
- **Kaskade:** ⊕ → Set Variable → Variablenliste → Bedingung/Transform. 🟡 (Kaskade gebaut)
- **Bedingungen** (typabhängig): Presence (isSet/isntSet); Equality (equals/doesntEqual); Text (startsWith/endsWith/contains + negiert); Number (>/</≥/≤/isEven/isOdd); Transforms (asPlainText/formatNumber/formatDate/Convert).
- **Conditional-Dialog** (z.B. "Overflow"): Variable-Chip · Bedingung-Select · Vergleichswert · **Dann/Wenn ja** + **Wenn Nein** (Wert-Selects, verschachtelbar) · **Fallback/Zurückgreifen** · Convert=Mapping+Fallback. ❌ **← nächster Bau**
- **Auflösung:** Wert = (QueryParam > Interaktion > Default) → op/transform/convert → Branch/Match → sonst Fallback.

## 6. Interactions & Animations
- **Variants:** Component-States (Default/Hover/Pressed/custom), Auto-Animate zwischen Zuständen. ❌
- **Triggers:** Click, ClickStart, MouseEnter/Leave, Appear, Scroll (Layer/Section-in-View, Direction), Time, Exit, Key, Custom-Event. ❌
- **Actions:** Set Variant, Set Variable, Show Overlay, Navigate, Open URL, Scroll To, Trigger Event. ❌
- **Transitions:** Instant; Tween (Duration/Delay/Ease: Linear/In/Out/InOut/Bezier); Spring (Physics: Stiffness/Damping/Mass | Time: Duration/Bounce). ❌
- **Effects:** Appear, Hover, Press, Scroll, Scroll-Speed/Parallax, Sticky/Pin, Cursor (Replace/Follow). Props: Scale/Offset/Rotation/Opacity. 🟡 (Hover/Press/Appear/Scroll/Parallax ✅ im Editor via motion/react — nicht persistiert; Sticky/Cursor ❌)
- **Overlay-Trigger-Conditions:** Repeat/Cookie/URL-Param/Visited/Start-End/Form-Submit/Link-Click; And/Or.

## 7. Visuelle Effekte (stapelbare Style-Blöcke)
- **Gradients:** Linear/Radial/Conic, Multi-Stop, Angle, Canvas-Handles. ❌
- **Filters:** Blur/Brightness/Contrast/Saturate/Hue/Invert/Grayscale/Sepia (Slider). ❌
- **Backdrop-Blur** (Glassmorphism). ❌
- **Shadows:** mehrere Layer, outer/inner, X/Y/Blur/Spread/Color. 🟡 (einfacher Schatten)
- **Mask:** alpha/luminance, Gradient/Image/SVG, stapelbar. ❌
- **Blending:** 16 mix-blend-modes. 🟡
- **Border:** Width (uniform/per-side), Color/Gradient, Style (solid/dashed/dotted/double), Position (inside/center/outside). 🟡 (Border-Popup ✅)
- **Radius:** uniform/per-corner, %, Squircle/Smooth-Corners. ✅ (all/per-corner + Drag-Handles)
- **Shapes/Vectors:** Rectangle(R)/Ellipse(O)/Pen, Path-Edit, Boolean (Union/Subtract/Intersect/Exclude), Vector-Sets, SVG-Import. ❌
- **Text-Effekte:** Gradient-Text, Text-Stroke, Text-Shadow. ❌

## 8. CMS / Collections
- **Modell:** Collection → Item(id/slug/draft/fieldData) → Field. 13 Feldtypen: string, formattedText, number, boolean, date, color, image, file, link, enum, collectionReference, multiCollectionReference, array/gallery.
- **Collection List** (gestalte 1. Card → repliziert), **Collection/Detail Page** (`/objekte/:slug`).
- **Filter/Sort** (source/sorting[]/filters[]/limit/offset/pagination) + interaktives Filtern via Varianten.
- **Import/Export** CSV/JSON; **managed Collection + Sync-Adapter** für Live-Daten (unser Supabase/API-Fall).
- **Projekt-Mapping:** Objekte/Inserate = managed Collection; Preis+Währung getrennt (kein €-Hardcode). ❌

## 9. Pages / Publishing / Domains / SEO
- **Pages:** web/cms/design/404; Home=`/`; nesting; auto-slug; CMS-Route `path + :slug`. 🟡
- **Publishing:** Publish→Version; Staging (base-domain) vs Production (custom); Deploy/Rollback; Version-History. 🟡
- **Domains:** apex→2×A, www/sub→CNAME; SSL auto; keine AAAA; www↔non-www + HTTP→HTTPS auto. 🟡 (Custom-Domain-TLS-Fundament da)
- **SEO:** per-Page title/description/og-image/noindex; auto sitemap/robots/canonical; Redirects (wildcard/capture/named, 301); JSON-LD manuell. 🟡
- **Site-Settings:** title/desc/language/favicon/og; analytics; custom-code (head/body); password-protection. 🟡
- **Localization:** unbegrenzte Locales (24 Sprachen!), AI-Translate, `/es`-URLs, übersetzte Paths, hreflang, Auto-Locale-Redirect (Accept-Language), Locale→Currency (kein €-Hardcode). ❌

## 10. Design-System / Tokens
- **Color Styles:** name (/=Ordner), light (Pflicht) + dark (optional), RGBA (Alpha=Opacity). `Brand/Primary`→`--primary`. ❌
- **Text Styles:** tag (h1-h6/p), font/size/lineHeight/letterSpacing, color-ref, minWidth + breakpoints[] (max 4, groß→klein). ❌
- **Fonts:** web(Google)/custom(WOFF2-Upload)/variable(Achsen); Subsetting. 🟡 (Google-Fonts-Picker + Runtime-Laden ✅ via /api/google-fonts; Upload/variable/Subsetting ❌)
- **Themes:** light/dark/auto pro Page/Section (Section überschreibt); `data-theme`-Attribut. ❌
- **Zusatz-Tokens** (nicht Framer-nativ): spacing/radius/borderWidth/shadow — rem statt px.

---

## Bereits gebaut (Ist-Stand `apps/web/components/website/editor/`)
Multi-Frame-Breakpoints + freies Verschieben + Snapping-Guides (rot durchgezogen + pink) · Hand-Tool ·
Radius all/per-corner + Drag-Handles · Border-Popup · Opacity/Visible/Fill/Overflow ⊕-Bindung +
Set-Variable-Kaskade · Variables-Editor (zentriert) · Zusatz-Stile-Popover (15 Einträge) ·
Stack/Grid/Masonry-Container (rudimentär) · Effects-Sektion (Hover/Press/Appear/Scroll/Parallax) ·
Google-Fonts-Picker (global + je Element). Persistenz-Grenze: nur die 10 Block-Typen (ARCHITECTURE §12).

## Priorisierter Bauplan (nächste Schritte)
1. **Conditional-Value-Dialog** ("Overflow"-Dialog) mit echter Wirkung — direkt dran (§5).
2. **⊕-Bind an ALLE Properties** verallgemeinern (§4).
3. **Layout-System:** Stack/Grid + Sizing-Modi (Fill/Fit/Relative/vw) + Position-Typen (§3).
4. **Insert-Elemente:** Text/Image/Video/Embed/SVG als echte Blöcke (§2).
5. **Visuelle Effekte:** Gradients/Filters/Backdrop-Blur/Mask/Blending vervollständigen (§7).
6. **CMS-Collections:** Objekte als managed Collection + Collection-List/Detail (§8).
7. **Interactions/Variants/Effects** (§6).
8. **Design-System:** Color/Text-Styles + Fonts + Themes (§10).
9. **Publishing/SEO/Localization** ausbauen (§9).
