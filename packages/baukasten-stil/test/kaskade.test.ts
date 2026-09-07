import { describe, expect, test } from "bun:test";
import {
  brauchtBezug,
  darstellungFuer,
  hatLayout,
  herkunft,
  layoutStil,
  codeCssZerlegen,
  linkLesen,
  overlayLesen,
  textStil,
  rahmenAttribute,
  rahmenStil,
  stilCss,
} from "../src/index";

describe("Kaskade Desktop → Tablet → Mobil", () => {
  const s = {
    stil: { opazitaet: 0.5, radius: { alle: 24 }, grenze: { breite: 1, farbe: "rolle:border" } },
    layout_richtung: "zeile",
    layout_abstand: 32,
    je_geraet: {
      tablet: { stil: { opazitaet: 0.8 }, layout_abstand: 16 },
      mobil: { stil: { radius: { alle: 8 } } },
    },
  };
  test("Desktop ist die Grundfassung", () => {
    const d = darstellungFuer(s, "desktop");
    expect(d.stil?.opazitaet).toBe(0.5);
    expect(d.layout_abstand).toBe(32);
  });
  test("Tablet überschreibt feldweise und behält den Rest", () => {
    const d = darstellungFuer(s, "tablet");
    expect(d.stil?.opazitaet).toBe(0.8);
    expect(d.stil?.radius).toEqual({ alle: 24 });
    expect(d.stil?.grenze?.farbe).toBe("rolle:border");
    expect(d.layout_abstand).toBe(16);
  });
  test("Mobil erbt vom Tablet, nicht direkt vom Desktop", () => {
    const d = darstellungFuer(s, "mobil");
    expect(d.stil?.opazitaet).toBe(0.8);
    expect(d.stil?.radius).toEqual({ alle: 8 });
    expect(d.layout_abstand).toBe(16);
  });
  test("eine Reihe stapelt auf dem Telefon — außer man setzt sie dort", () => {
    expect(darstellungFuer(s, "tablet").layout_richtung).toBe("zeile");
    expect(darstellungFuer(s, "mobil").layout_richtung).toBe("spalte");
    const ausdruecklich = { ...s, je_geraet: { mobil: { layout_richtung: "zeile" } } };
    expect(darstellungFuer(ausdruecklich, "mobil").layout_richtung).toBe("zeile");
  });
  test("Herkunft eines Werts", () => {
    expect(herkunft(s, "mobil", ["stil", "opazitaet"])).toEqual({ quelle: "tablet", eigen: false });
    expect(herkunft(s, "mobil", ["stil", "radius"])).toEqual({ quelle: "mobil", eigen: true });
    expect(herkunft(s, "tablet", ["stil", "grenze"])).toEqual({ quelle: "desktop", eigen: false });
    expect(herkunft(s, "desktop", ["transform", "rotation"])).toBeNull();
  });
  test("Desktop-Schlüssel in je_geraet wird ignoriert", () => {
    const d = darstellungFuer({ je_geraet: { desktop: { stil: { opazitaet: 0.1 } } } }, "desktop");
    expect(d.stil).toBeUndefined();
  });
});

describe("Lesen prüft erneut (Wurzel 8) und erfindet nichts (Wurzel 4)", () => {
  test("ungültige Werte fallen heraus, gültige bleiben", () => {
    const d = darstellungFuer(
      {
        stil: { opazitaet: 7, radius: { alle: 9999 }, grenze: { breite: 1, farbe: "red" }, ueberlauf: "verborgen" },
        position: { typ: "absolut", oben: "10px; } body { display:none", ebene: 99999 },
        transform: { rotation: "90" },
      },
      "desktop",
    );
    expect(d.stil).toEqual({ ueberlauf: "verborgen" });
    expect(d.position).toEqual({ typ: "absolut" });
    expect(d.transform).toBeUndefined();
  });
  test("leere Settings ergeben kein CSS", () => {
    expect(stilCss({}, { rahmen: ".a", layout: ".a > .l" })).toBe("");
    expect(rahmenStil({ opacity: 0.3, radius: 20, rotation: 45 }, "desktop")).toEqual({});
  });
  test("Bild-Füllung: nur http(s)/relativ, ohne Ausbruchszeichen", () => {
    expect(
      rahmenStil({ stil: { fuellung: { art: "bild", url: "javascript:alert(1)" } } }, "desktop"),
    ).toEqual({});
    const e = rahmenStil(
      { stil: { fuellung: { art: "bild", url: 'https://x.de/a.jpg")</style><b', auflage: 0.4 } } },
      "desktop",
    );
    expect(e["background-image"]).toBe(
      'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("https://x.de/a.jpg/styleb")',
    );
  });
  test("Maß: Modus ohne Pflichtwert wird verworfen", () => {
    expect(darstellungFuer({ groesse: { breite: { modus: "fest" } } }, "desktop").groesse).toBeUndefined();
    expect(darstellungFuer({ groesse: { hoehe: { modus: "inhalt" } } }, "desktop").groesse).toEqual({
      hoehe: { modus: "inhalt" },
    });
  });
});

describe("CSS des Rahmens", () => {
  test("Altbestand-Hintergrund (0432) bleibt, Füllung des Inspektors gewinnt", () => {
    const alt = { background_color: "#112233", background_image_url: "https://x.de/b.jpg", background_overlay: 0.3 };
    expect(rahmenStil(alt, "desktop")).toEqual({
      "background-color": "#112233",
      "background-image": 'linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url("https://x.de/b.jpg")',
      "background-size": "cover",
      "background-position": "center",
    });
    const mit = { ...alt, stil: { fuellung: { art: "farbe", farbe: "rolle:primary" } } };
    expect(rahmenStil(mit, "desktop")["background-color"]).toBe("var(--primary)");
    expect(rahmenStil(mit, "desktop")["background-image"]).toBe("none");
  });
  test("Verlauf, Radius je Ecke, Grenze je Seite, Schatten gestapelt", () => {
    const e = rahmenStil(
      {
        stil: {
          fuellung: { art: "verlauf", winkel: 90, stufen: [{ farbe: "#000000", position: 0 }, { farbe: "#ffffff", position: 100 }] },
          radius: { oben_links: 160, oben_rechts: 160, unten_rechts: 18, unten_links: 18 },
          grenze: { breite: 2, farbe: "#222222", art: "dashed", seiten: ["oben", "unten"] },
          schatten: [{ y: 1, weich: 2, farbe: "#00000040" }, { y: 2, weich: 4, farbe: "#00000040", innen: true }],
        },
      },
      "desktop",
    );
    expect(e["background-image"]).toBe("linear-gradient(90deg, #000000 0%, #ffffff 100%)");
    expect(e["border-radius"]).toBe("160px 160px 18px 18px");
    expect(e["border-top"]).toBe("2px dashed #222222");
    expect(e["border-bottom"]).toBe("2px dashed #222222");
    expect(e.border).toBeUndefined();
    expect(e["box-shadow"]).toBe("0px 1px 2px 0px #00000040, inset 0px 2px 4px 0px #00000040");
  });
  test("Größe: Spaltenanteil weicht einer eigenen Breite", () => {
    expect(rahmenStil({}, "desktop", { span: 4 })["flex-basis"]?.startsWith("33.333")).toBe(true);
    const e = rahmenStil({ groesse: { breite: { modus: "fest", wert: 320 } } }, "desktop", { span: 4 });
    expect(e.width).toBe("320px");
    expect(e["flex-basis"]).toBe("320px");
    expect(rahmenStil({ groesse: { breite: { modus: "fuellen" } } }, "desktop")["flex-grow"]).toBe("1");
    expect(rahmenStil({ groesse: { hoehe: { modus: "viewport", wert: 100 } } }, "desktop").height).toBe("100vh");
    expect(rahmenStil({ groesse: { seitenverhaeltnis: "16 /9" } }, "desktop")["aspect-ratio"]).toBe("16 / 9");
  });
  test("Position: Kanten nur außerhalb von relativ", () => {
    expect(rahmenStil({ position: { typ: "relativ", oben: "10px", ebene: 3 } }, "desktop")).toEqual({
      position: "relative",
      "z-index": "3",
    });
    expect(rahmenStil({ position: { typ: "klebend", oben: "0px" } }, "desktop")).toEqual({
      position: "sticky",
      top: "0px",
    });
    expect(brauchtBezug([{}, { position: { typ: "absolut" } }])).toBe(true);
    expect(brauchtBezug([{ je_geraet: { mobil: { position: { typ: "absolut" } } } }])).toBe(true);
    expect(brauchtBezug([{}])).toBe(false);
  });
  test("Sichtbar Nein: live weg, im Editor durchscheinend", () => {
    const s = { stil: { sichtbar: false } };
    expect(rahmenStil(s, "desktop").display).toBe("none");
    expect(rahmenStil(s, "desktop", { editor: true })).toEqual({ opacity: "0.4" });
  });
  test("Transform-Kette und Scroll-Versatz", () => {
    const e = rahmenStil(
      {
        transform: { rotation: -3, skalierung: 1.1, versatz_y: "-8px", ursprung: "top left", perspektive: 800 },
        scroll: { anker: "kontakt", versatz_y: 80 },
      },
      "desktop",
    );
    expect(e.transform).toBe("translate(0px, -8px) rotate(-3deg) scale(1.1)");
    expect(e["transform-origin"]).toBe("top left");
    expect(e.perspective).toBe("800px");
    expect(e["scroll-margin-top"]).toBe("80px");
  });
});

describe("Layout und Attribute", () => {
  test("layoutStil wie der bisherige Renderer, hatLayout sieht auch Geräte-Overrides", () => {
    expect(layoutStil({ layout_richtung: "zeile", layout_verteilen: "zwischen", layout_umbruch: true, layout_abstand: 24 }, "desktop")).toEqual({
      "flex-direction": "row",
      "justify-content": "space-between",
      "flex-wrap": "wrap",
      gap: "24px",
    });
    expect(hatLayout({})).toBe(false);
    expect(hatLayout({ je_geraet: { mobil: { layout_abstand: 8 } } })).toBe(true);
  });
  test("Rahmen-Attribute: Element, Anker, Aria", () => {
    expect(rahmenAttribute({})).toEqual({ tag: "div" });
    expect(
      rahmenAttribute({ scroll: { anker: "kontakt" }, a11y: { tag: "section", label: " Kontakt ", tab_index: -1, fuer_leser_verborgen: true } }),
    ).toEqual({ tag: "section", id: "kontakt", "aria-label": "Kontakt", tabIndex: -1, "aria-hidden": true });
    expect(rahmenAttribute({ a11y: { tag: "button" } })).toEqual({ tag: "div" });
  });
});

describe("stilCss", () => {
  test("Grundregel plus Media-Queries nur mit Unterschieden", () => {
    const css = stilCss(
      {
        stil: { radius: { alle: 24 }, opazitaet: 1 },
        layout_richtung: "zeile",
        je_geraet: { tablet: { stil: { radius: { alle: 12 } } } },
      },
      { rahmen: '[data-block-index="3"]', layout: '[data-block-index="3"]>[data-layout]' },
    );
    expect(css).toBe(
      '[data-block-index="3"]{opacity:1;border-radius:24px}' +
        '[data-block-index="3"]>[data-layout]{flex-direction:row}' +
        '@media (max-width:1023px){[data-block-index="3"]{border-radius:12px}}' +
        '@media (max-width:767px){[data-block-index="3"]>[data-layout]{flex-direction:column}}',
    );
  });
  test("Editor-Kopf nennt die Geräte mit eigenen Werten", () => {
    const css = stilCss(
      { stil: { opazitaet: 0.5 }, je_geraet: { mobil: { stil: { opazitaet: 1 } } } },
      { rahmen: ".x" },
      { editor: true },
    );
    expect(css.startsWith("/* .x: desktop+mobil */")).toBe(true);
    expect(css).toContain("@media (max-width:767px){.x{opacity:1}}");
    expect(css).not.toContain("1023px");
  });
  test("verschwundene Eigenschaft wird zurückgesetzt", () => {
    const css = stilCss(
      { stil: { sichtbar: true }, je_geraet: { mobil: { stil: { sichtbar: false } } } },
      { rahmen: ".x" },
    );
    expect(css).toBe("@media (max-width:767px){.x{display:none}}");
  });
});


describe("Link am Element", () => {
  test("gültige Adresse wird zum <a>, neuer Tab mit rel", () => {
    const s = { link: { href: "/kontakt", neuer_tab: true } };
    expect(linkLesen(s)).toEqual({ href: "/kontakt", neuer_tab: true });
    const a = rahmenAttribute(s);
    expect(a.tag).toBe("a");
    expect(a.href).toBe("/kontakt");
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });
  test("javascript: wird verworfen, linkErlaubt=false lässt das Element", () => {
    expect(linkLesen({ link: { href: "javascript:alert(1)" } })).toBeUndefined();
    expect(rahmenAttribute({ link: { href: "https://a.de" } }, { linkErlaubt: false }).tag).toBe("div");
    expect(rahmenAttribute({ link: { href: "https://a.de" }, a11y: { tag: "section" } }).tag).toBe("a");
  });
});


describe("Text am Element", () => {
  const s = {
    text: { schrift: "ueberschrift", farbe: "rolle:primary", groesse: "3.5rem", gewicht: 600, laufweite: "-0.035em", zeilenhoehe: "1.02em", ausrichtung: "center", balance: true, kuerzen: 2 },
    je_geraet: { mobil: { text: { groesse: "2rem", ausrichtung: "start" } } },
  };
  test("Desktop: alle Eigenschaften als CSS", () => {
    const e = textStil(s, "desktop");
    expect(e["font-family"]).toContain("--txt-h1-font");
    expect(e.color).toBe("var(--primary)");
    expect(e["font-size"]).toBe("3.5rem");
    expect(e["font-weight"]).toBe("600");
    expect(e["text-align"]).toBe("center");
    expect(e["text-wrap"]).toBe("balance");
    expect(e["-webkit-line-clamp"]).toBe("2");
  });
  test("Mobil überschreibt Größe und Ausrichtung, erbt den Rest", () => {
    const e = textStil(s, "mobil");
    expect(e["font-size"]).toBe("2rem");
    expect(e["text-align"]).toBe("start");
    expect(e["font-weight"]).toBe("600");
  });
  test("ungültige Werte fallen heraus", () => {
    const e = textStil({ text: { groesse: "62", gewicht: 450, farbe: "red", dekoration: "underline" } }, "desktop");
    expect(e["font-size"]).toBeUndefined();
    expect(e["font-weight"]).toBeUndefined();
    expect(e.color).toBeUndefined();
    expect(e["text-decoration-line"]).toBe("underline");
  });
  test("stilCss schreibt die Textregel nur mit Selektor", () => {
    const css = stilCss(s, { rahmen: "[data-block-index=\"1\"]", text: "[data-block-index=\"1\"] :is(h1,p)" });
    expect(css).toContain(":is(h1,p){");
    expect(css).toContain("font-size:3.5rem");
    expect(css).toContain("@media (max-width:767px)");
    expect(stilCss(s, { rahmen: "[data-block-index=\"1\"]" })).not.toContain("font-size");
  });
});

describe("Vollerfassung 06.09.2026: 3D, Cursor, Link-Abschnitt, Google Bot", () => {
  test("Transform 3D: Tiefe, Drehung X/Y, Rückseite, Raum", () => {
    const e = rahmenStil(
      { transform: { rotation: 10, rotation_x: 20, rotation_y: -30, tiefe: 50, rueckseite: "verborgen", raum_3d: true, perspektive: 800 } },
      "desktop",
    );
    expect(e.transform).toBe("translateZ(50px) rotate(10deg) rotateX(20deg) rotateY(-30deg)");
    expect(e["backface-visibility"]).toBe("hidden");
    expect(e["transform-style"]).toBe("preserve-3d");
    expect(e.perspective).toBe("800px");
  });
  test("Cursor live, nicht im Editor, nur bekannte Werte", () => {
    expect(rahmenStil({ cursor: "grab" }, "desktop").cursor).toBe("grab");
    expect(rahmenStil({ cursor: "grab" }, "desktop", { editor: true }).cursor).toBeUndefined();
    expect(rahmenStil({ cursor: "url(x)" }, "desktop").cursor).toBeUndefined();
  });
  test("Link-Abschnitt hängt #anker an — außer die Adresse trägt schon einen", () => {
    expect(rahmenAttribute({ link: { href: "/preise", anker: "kontakt" } }).href).toBe("/preise#kontakt");
    expect(rahmenAttribute({ link: { href: "/preise#oben", anker: "kontakt" } }).href).toBe("/preise#oben");
    expect(linkLesen({ link: { href: "/a", anker: "Kontakt!" } })).toEqual({ href: "/a", neuer_tab: false });
  });
  test("Google Bot: data-nosnippet nur bei true", () => {
    expect(rahmenAttribute({ a11y: { nosnippet: true } })).toEqual({ tag: "div", "data-nosnippet": "" });
    expect(rahmenAttribute({ a11y: { nosnippet: false } })).toEqual({ tag: "div" });
  });
});

describe("Vollerfassung 06.09.2026 Teil 2: Stile+, OpenType, Raster, Link, Effekte", () => {
  test("Mischmodus, Filter, Überlauf X/Y, Zeiger, Auswahl, Tippfarbe", () => {
    const e = rahmenStil(
      {
        stil: {
          mischmodus: "multiply",
          filter: { weichzeichnen: 4, helligkeit: 120, kontrast: 100, graustufen: 50 },
          ueberlauf_x: "scrollen",
          ueberlauf_y: "verborgen",
          zeiger_ereignisse: false,
          text_auswahl: false,
          tippfarbe: "#00000000",
        },
      },
      "desktop",
    );
    expect(e["mix-blend-mode"]).toBe("multiply");
    expect(e.filter).toBe("blur(4px) brightness(120%) grayscale(50%)");
    expect(e["overflow-x"]).toBe("auto");
    expect(e["overflow-y"]).toBe("hidden");
    expect(e["pointer-events"]).toBe("none");
    expect(e["user-select"]).toBe("none");
    expect(e["-webkit-tap-highlight-color"]).toBe("#00000000");
    // Im Editor bleiben Zeiger-Ereignisse an — sonst wäre das Element unklickbar.
    expect(rahmenStil({ stil: { zeiger_ereignisse: false } }, "desktop", { editor: true })["pointer-events"]).toBeUndefined();
  });
  test("OpenType als font-feature-settings, unbekannte Tags fallen heraus", () => {
    expect(textStil({ text: { opentype: ["tnum", "liga", "xxxx", "tnum"] } }, "desktop")["font-feature-settings"]).toBe('"tnum" 1, "liga" 1');
  });
  test("Raster-Layout", () => {
    const e = layoutStil({ layout_typ: "raster", raster_spalten: 3, raster_abstand_x: 24, raster_abstand_y: 8 }, "desktop");
    expect(e.display).toBe("grid");
    expect(e["grid-template-columns"]).toBe("repeat(3, minmax(0, 1fr))");
    expect(e.gap).toBe("8px 24px");
    expect(hatLayout({ layout_typ: "raster" })).toBe(true);
  });
  test("Link: Parameter vor Anker, rel gemischt mit neuem Tab", () => {
    const a = rahmenAttribute({ link: { href: "/preise?x=1", parameter: "utm_source=mail", anker: "oben", rel: ["nofollow"], neuer_tab: true } });
    expect(a.href).toBe("/preise?x=1&utm_source=mail#oben");
    expect(a.rel).toBe("nofollow noopener noreferrer");
    expect(a.target).toBe("_blank");
    expect(rahmenAttribute({ link: { href: "/a", parameter: "böse wert" } }).href).toBe("/a");
  });
  test("Effekte: Hover/Press als Regeln, Erscheinen/Tempo als Marker — nicht im Editor", () => {
    const s = {
      effekte: {
        erscheinen: { art: "hochgleiten", dauer: 500 },
        hover: { skalierung: 1.05, dauer: 300 },
        druck: { skalierung: 0.95 },
        schleife: { art: "schweben" },
        scroll_tempo: 120,
      },
    };
    const css = stilCss(s, { rahmen: '[data-block-index="3"]' });
    expect(css).toContain(':hover{transform:scale(1.05)}');
    expect(css).toContain(':active{transform:scale(0.95)}');
    expect(css).toContain("animation:bk-schweben 2000ms ease-in-out infinite");
    expect(css).toContain("opacity 500ms ease 0ms");
    const a = rahmenAttribute(s);
    expect(a["data-erscheinen"]).toBe("hochgleiten");
    expect(a["data-scroll-tempo"]).toBe("120");
    const im = rahmenAttribute(s, { editor: true });
    expect(im["data-erscheinen"]).toBeUndefined();
    const editorCss = stilCss(s, { rahmen: "x" }, { editor: true });
    expect(editorCss).toContain(":hover");
    expect(editorCss).not.toContain("animation:");
  });
});

describe("Style-Panel Etappe 5 (06.09.2026): Fill-Formen, Maske, Auswahl, Textstile", () => {
  test("Radial- und Conic-Verlauf mit Mittelpunkt", () => {
    const stufen = [
      { farbe: "#ffffff", position: 0 },
      { farbe: "#000000", position: 100 },
    ];
    const radial = rahmenStil(
      { stil: { fuellung: { art: "verlauf", form: "radial", lage: "top left", stufen } } },
      "desktop",
    );
    expect(radial["background-image"]).toBe(
      "radial-gradient(circle at top left, #ffffff 0%, #000000 100%)",
    );
    const konisch = rahmenStil(
      { stil: { fuellung: { art: "verlauf", form: "konisch", winkel: 90, stufen } } },
      "desktop",
    );
    expect(konisch["background-image"]).toBe(
      "conic-gradient(from 90deg at center, #ffffff 0%, #000000 100%)",
    );
    // Ohne Form bleibt es linear — der Bestand ändert sich nicht (Wurzel 1).
    const linear = rahmenStil({ stil: { fuellung: { art: "verlauf", stufen } } }, "desktop");
    expect(linear["background-image"]).toStartWith("linear-gradient(180deg");
  });

  test("Maske als Verlauf, umgekehrt getauscht; Start ≥ Ende fällt heraus", () => {
    const e = rahmenStil({ stil: { maske: { art: "linear", winkel: 90, start: 10, ende: 80 } } }, "desktop");
    expect(e["mask-image"]).toBe("linear-gradient(90deg, black 10%, transparent 80%)");
    expect(e["-webkit-mask-image"]).toBe(e["mask-image"]);
    const um = rahmenStil({ stil: { maske: { art: "radial", start: 0, ende: 100, umkehren: true } } }, "desktop");
    expect(um["mask-image"]).toBe("radial-gradient(circle, transparent 0%, black 100%)");
    expect(rahmenStil({ stil: { maske: { start: 80, ende: 20 } } }, "desktop")["mask-image"]).toBeUndefined();
  });

  test("Selection wird eine eigene Regel, keine Zeile am Rahmen", () => {
    const css = stilCss(
      { stil: { auswahl_farbe: "#ffffff", auswahl_hintergrund: "rolle:primary" } },
      { rahmen: ".b" },
    );
    expect(css).toContain(".b ::selection{color:#ffffff;background-color:var(--primary)}");
    expect(css).toContain(".b ::-moz-selection{");
  });

  test("Textstil-Rolle bringt die Theme-Variablen, die Familie schlägt sie", () => {
    const rolle = textStil({ text: { schrift: "h2" } }, "desktop");
    expect(rolle["font-family"]).toBe("var(--txt-h2-font, inherit)");
    expect(rolle["font-size"]).toBe("var(--txt-h2-size, inherit)");
    expect(rolle["text-shadow"]).toBe("var(--txt-h2-shadow, none)");
    const familie = textStil({ text: { schrift: "h2", schriftfamilie: "Lora" } }, "desktop");
    expect(familie["font-family"]).toBe("'Lora', Georgia, serif");
    // Eine Familie außerhalb des Katalogs wird verworfen, nicht geraten.
    expect(textStil({ text: { schriftfamilie: "Comic Sans MS" } }, "desktop")["font-family"]).toBeUndefined();
  });
});

describe("Style-Panel Etappe 5: Effekte Drag/Lightbox/Ticker/Scroll-Transform", () => {
  const s = {
    effekte: {
      ziehen: { frei: false, achse: "x", zurueck: true },
      lichtkasten: { max_breite: 900, innenabstand: 10, ebene: 20, hintergrund: "#111111" },
      ticker: { tempo: 150, richtung: "rechts", hover: "stopp", ziehbar: true },
      scroll_transform: { ausloeser: "ebene_sichtbar", nach: { opazitaet: 0.2 } },
    },
  };
  test("Marker fürs Live-Skript — nicht im Editor", () => {
    const a = rahmenAttribute(s);
    expect(a["data-ziehen"]).toBe("x");
    expect(a["data-ziehen-zurueck"]).toBe("");
    expect(JSON.parse(a["data-lichtkasten"]!)).toEqual({ b: 900, p: 10, z: 20, g: "#111111" });
    expect(a["data-ticker-lauf"]).toBe("rechts:150:1");
    expect(JSON.parse(a["data-scroll-transform"]!).a).toBe("ebene_sichtbar");
    expect(rahmenAttribute(s, { editor: true })["data-ziehen"]).toBeUndefined();
  });
  test("CSS: Ticker-Band, Hover-Stopp, Zieh-Rückweg, Zoom-Zeiger", () => {
    const css = stilCss(s, { rahmen: ".b" });
    expect(css).toContain("animation:bk-ticker-rechts var(--bk-ticker-dauer, 20s) linear infinite");
    expect(css).toContain(".b:hover [data-ticker]{animation-play-state:paused}");
    expect(css).toContain(".b[data-zieht]{transition:none;cursor:grabbing}");
    expect(css).toContain(".b img{cursor:zoom-in}");
    // Im Editor läuft nichts davon — sonst zappelt die Fläche beim Bearbeiten.
    const imEditor = stilCss(s, { rahmen: ".b" }, { editor: true });
    expect(imEditor).not.toContain("bk-ticker");
    expect(imEditor).not.toContain("zoom-in");
  });
  test("Ziehen setzt touch-action und Auswahl-Sperre, Ticker kappt den Überlauf", () => {
    const e = rahmenStil(s, "desktop");
    expect(e["touch-action"]).toBe("pan-y");
    expect(e["user-select"]).toBe("none");
    expect(e.overflow).toBe("hidden");
    expect(rahmenStil(s, "desktop", { editor: true })["touch-action"]).toBeUndefined();
  });
});

describe("Style-Panel Etappe 5: Overlay, Cursor-Bild, Codeüberschreibung", () => {
  test("Overlay: Lage, Klick-Marker, im Editor immer offen", () => {
    const s = {
      overlay: {
        typ: "relativ",
        ausloeser: "klick",
        position: "unten",
        ausrichten: "mitte",
        versatz_y: 12,
        schliessen: "klick",
        breite: 320,
        inhalt: { de: "Mehr dazu" },
      },
    };
    const css = stilCss(s, { rahmen: ".b" });
    expect(css).toContain(".b{position:relative}");
    expect(css).toContain("width:320px");
    expect(css).toContain(".b > [data-overlay][data-offen]{display:block}");
    const a = rahmenAttribute(s);
    expect(a["data-overlay-ausloeser"]).toBe("klick");
    expect(a["data-overlay-schliessen"]).toBe("klick");
    expect(stilCss(s, { rahmen: ".b" }, { editor: true })).toContain(
      ".b > [data-overlay]{display:block}",
    );
    // Ein Overlay ohne Text gibt es nicht.
    expect(overlayLesen({ overlay: { inhalt: {} } })).toBeUndefined();
  });

  test("Eigener Cursor mit Hotspot, Web-Cursor als Rückfall", () => {
    const e = rahmenStil(
      { cursor: "pointer", cursor_bild: { url: "/m/hand.png", x: 4, y: 6 } },
      "desktop",
    );
    expect(e.cursor).toBe('url("/m/hand.png") 4 6, pointer');
    // javascript:-Adresse fällt heraus, der Web-Cursor bleibt.
    expect(
      rahmenStil({ cursor: "grab", cursor_bild: { url: "javascript:1" } }, "desktop").cursor,
    ).toBe("grab");
  });

  test("Codeüberschreibung: Allowlist, verbotene Werte, letzte Zeile gewinnt", () => {
    const { paare, fehler } = codeCssZerlegen(
      "color: red; behavior: x; background-image: url(https://x); margin-top:4px",
    );
    expect(paare).toEqual([
      ["color", "red"],
      ["margin-top", "4px"],
    ]);
    expect(fehler).toEqual(["behavior: x", "background-image: url(https://x)"]);
    // Sie schlägt die Zeile des Inspektors — dafür ist sie da.
    const e = rahmenStil(
      { stil: { opazitaet: 0.5 }, code: { css: "opacity: 1; z-index: 3" } },
      "desktop",
    );
    expect(e.opacity).toBe("1");
    expect(e["z-index"]).toBe("3");
  });
});
