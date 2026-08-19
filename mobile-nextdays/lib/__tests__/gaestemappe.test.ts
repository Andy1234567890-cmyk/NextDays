// Tests der Gästemappe (lib/gaestemappe.ts).
//
// DER ANLASS: Die Texte entstehen im Web in einem Rich-Text-Editor und liegen
// als HTML in `type_attributes.messaging`. Die App zeigt und bearbeitet
// Klartext. Zwei Dinge müssen dabei stimmen, sonst verliert der Betrieb Text,
// ohne es zu merken:
//   1. Die Rundreise HTML → Klartext → HTML darf den Text nicht wachsen lassen
//      oder Gliederung verlieren (Absätze, Listen).
//   2. Das Speichern EINES Blocks in EINER Sprache darf die anderen Blöcke,
//      die anderen Sprachen und die übrigen `type_attributes` nicht löschen.
export {};

type Modul = typeof import("../gaestemappe");
const {
  anzahlGepflegt,
  gepflegteSprachen,
  hatFormatierung,
  htmlZuText,
  leseGaestemappe,
  mappeSchreiben,
  textZuHtml,
}: Modul = require("../gaestemappe");

describe("htmlZuText", () => {
  it("macht aus Absätzen Leerzeilen und aus <br> einen Umbruch", () => {
    expect(htmlZuText("<p>Erste Zeile<br>Zweite Zeile</p><p>Neuer Absatz</p>")).toBe(
      "Erste Zeile\nZweite Zeile\n\nNeuer Absatz",
    );
  });

  it("setzt Listenmarken und hält die Punkte einer Liste zusammen", () => {
    expect(htmlZuText("<ul><li>Ruhe ab 22 Uhr</li><li>Nicht rauchen</li></ul>")).toBe(
      "- Ruhe ab 22 Uhr\n- Nicht rauchen",
    );
    expect(htmlZuText('<ol start="3"><li>Dritter</li><li>Vierter</li></ol>')).toBe(
      "3. Dritter\n4. Vierter",
    );
  });

  it("rettet das Link-Ziel in den Klartext", () => {
    expect(htmlZuText('<p>Siehe <a href="https://x.dk/plan">Anfahrtsplan</a></p>')).toBe(
      "Siehe Anfahrtsplan (https://x.dk/plan)",
    );
  });

  it("löst Entitäten auf und wirft Formatierungs-Tags weg", () => {
    expect(htmlZuText("<p><strong>WLAN</strong>: Gast &amp; Haus</p>")).toBe("WLAN: Gast & Haus");
  });

  it("bleibt bei leerem Wert leer, nicht undefined", () => {
    expect(htmlZuText("")).toBe("");
  });
});

describe("Rundreise Klartext → HTML → Klartext", () => {
  const faelle = [
    "Schlüssel liegt im Schlüsselkasten.",
    "Erste Zeile\nZweite Zeile",
    "Absatz eins\n\nAbsatz zwei",
    "- Ruhe ab 22 Uhr\n- Nicht rauchen",
    "1. Ankommen\n2. Code eingeben",
  ];

  it.each(faelle)("ist ab der ersten Generation stabil: %s", (text) => {
    const html = textZuHtml(text);
    expect(htmlZuText(html)).toBe(text);
    // Zweite Generation: derselbe Text, nicht ein wachsender.
    expect(htmlZuText(textZuHtml(htmlZuText(html)))).toBe(text);
  });

  it("escapet spitze Klammern statt sie als Markup zu speichern", () => {
    const html = textZuHtml("Notfall: <Feuerwehr> 112");
    expect(html).toBe("<p>Notfall: &lt;Feuerwehr&gt; 112</p>");
    expect(htmlZuText(html)).toBe("Notfall: <Feuerwehr> 112");
  });

  it("macht aus einem leeren Entwurf einen leeren Wert, kein leeres p", () => {
    expect(textZuHtml("   \n  ")).toBe("");
  });
});

describe("hatFormatierung", () => {
  it("meldet, was Klartext nicht halten kann", () => {
    expect(hatFormatierung("<p><strong>Fett</strong></p>")).toBe(true);
    expect(hatFormatierung('<p><a href="https://x.dk">Link</a></p>')).toBe(true);
    expect(hatFormatierung("<ul><li>Eins<ul><li>Tiefer</li></ul></li></ul>")).toBe(true);
  });

  it("meldet nichts bei Absätzen und einfachen Listen", () => {
    expect(hatFormatierung("<p>Nur Text</p>")).toBe(false);
    expect(hatFormatierung("<ul><li>Eins</li><li>Zwei</li></ul>")).toBe(false);
    expect(hatFormatierung("")).toBe(false);
  });
});

describe("leseGaestemappe", () => {
  it("füllt fehlende Blöcke und Sprachen mit Leerwerten", () => {
    const mappe = leseGaestemappe({ messaging: { rules: { de: "<p>Ruhe</p>" } } });
    expect(mappe.rules).toEqual({ de: "<p>Ruhe</p>", en: "", da: "" });
    expect(mappe.wifi).toEqual({ de: "", en: "", da: "" });
  });

  it("erträgt fehlende oder fremdgeformte Daten", () => {
    expect(leseGaestemappe(undefined).checkIn).toEqual({ de: "", en: "", da: "" });
    expect(leseGaestemappe({ messaging: "kaputt" }).checkIn).toEqual({ de: "", en: "", da: "" });
    expect(leseGaestemappe({ messaging: { checkIn: { de: 7 } } }).checkIn.de).toBe("");
  });

  it("zählt nur Sprachen mit echtem Text (leeres HTML zählt nicht)", () => {
    const mappe = leseGaestemappe({
      messaging: { rules: { de: "<p>Ruhe</p>", en: "<p><br></p>", da: "" } },
    });
    expect(gepflegteSprachen(mappe.rules)).toEqual(["de"]);
    expect(anzahlGepflegt(mappe)).toBe(1);
  });
});

describe("mappeSchreiben", () => {
  const objekt = {
    id: "p1",
    type_attributes: {
      policies: { policyName: "Standard" },
      messaging: {
        rules: { de: "<p>Ruhe</p>", en: "<p>Quiet</p>" },
        wifi: { de: "<p>Netz: Haus</p>" },
      },
    },
  } as never;

  it("ersetzt genau einen Text und behält alles andere", () => {
    const attrs = mappeSchreiben(objekt, "rules", "da", "<p>Ro</p>") as {
      policies: unknown;
      messaging: Record<string, Record<string, string>>;
    };
    // Der Gegenzustand: andere Sprache, anderer Block, fremde Attribute.
    expect(attrs.messaging.rules).toEqual({ de: "<p>Ruhe</p>", en: "<p>Quiet</p>", da: "<p>Ro</p>" });
    expect(attrs.messaging.wifi.de).toBe("<p>Netz: Haus</p>");
    expect(attrs.policies).toEqual({ policyName: "Standard" });
  });

  it("lässt stehen, was die App nicht kennt (vierte Sprache, fremder Block)", () => {
    const fremd = {
      id: "p2",
      type_attributes: {
        messaging: {
          rules: { de: "<p>Ruhe</p>", sv: "<p>Tystnad</p>" },
          // Ein Block, den diese Feldliste (noch) nicht kennt.
          parking: { de: "<p>Stellplatz 4</p>" },
        },
      },
    } as never;
    const attrs = mappeSchreiben(fremd, "rules", "en", "<p>Quiet</p>") as {
      messaging: Record<string, Record<string, string>>;
    };
    expect(attrs.messaging.rules).toEqual({
      de: "<p>Ruhe</p>",
      sv: "<p>Tystnad</p>",
      en: "<p>Quiet</p>",
    });
    expect(attrs.messaging.parking.de).toBe("<p>Stellplatz 4</p>");
  });

  it("normalisiert einen Alt-Block, der als reiner String vorliegt", () => {
    const alt = {
      id: "p3",
      type_attributes: { messaging: { wifi: "Netz: Haus, Passwort: 1234" } },
    } as never;
    const attrs = mappeSchreiben(alt, "wifi", "en", "<p>Wifi: Haus</p>") as {
      messaging: Record<string, Record<string, string>>;
    };
    expect(attrs.messaging.wifi).toEqual({
      de: "Netz: Haus, Passwort: 1234",
      en: "<p>Wifi: Haus</p>",
    });
  });

  it("erträgt ein messaging, das gar keine Map ist", () => {
    const kaputt = { id: "p4", type_attributes: { messaging: "kaputt" } } as never;
    const attrs = mappeSchreiben(kaputt, "rules", "de", "<p>Ruhe</p>") as {
      messaging: Record<string, Record<string, string>>;
    };
    expect(attrs.messaging.rules).toEqual({ de: "<p>Ruhe</p>", en: "", da: "" });
  });

  it("legt einen Block an, der vorher nie gepflegt war", () => {
    const attrs = mappeSchreiben(objekt, "emergency", "de", "<p>112</p>") as {
      messaging: Record<string, Record<string, string>>;
    };
    expect(attrs.messaging.emergency).toEqual({ de: "<p>112</p>", en: "", da: "" });
  });
});
