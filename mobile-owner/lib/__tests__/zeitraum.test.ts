import {
  datumKurz,
  isoKalenderwoche,
  datumLang,
  naechte,
  prozent,
  spanneLesbar,
  tagPlus,
  veraenderungPct,
  zeitraumGrenzen,
  zeitraumLegende,
} from "@/lib/zeitraum";
import { txt } from "@/lib/test-uebersetzer";

// Gleiche Erwartungen in UTC und Europe/Copenhagen — die CI läuft in UTC.
const heute = new Date(2026, 6, 8, 12); // Mi, 8. Juli 2026

describe("zeitraumGrenzen", () => {
  it("aktueller Monat = 1. bis Monatsende", () => {
    expect(zeitraumGrenzen("aktueller_monat", heute)).toEqual({ von: "2026-07-01", bis: "2026-07-31" });
  });
  it("letzter Monat auch über den Jahreswechsel", () => {
    expect(zeitraumGrenzen("letzter_monat", new Date(2026, 0, 15, 12))).toEqual({
      von: "2025-12-01",
      bis: "2025-12-31",
    });
  });
  it("letzte 12 Monate = zwölf volle Monate bis einschließlich des laufenden", () => {
    expect(zeitraumGrenzen("letzte_12_monate", heute)).toEqual({ von: "2025-08-01", bis: "2026-07-31" });
  });
  it("dieses und letztes Jahr", () => {
    expect(zeitraumGrenzen("dieses_jahr", heute)).toEqual({ von: "2026-01-01", bis: "2026-12-31" });
    expect(zeitraumGrenzen("letztes_jahr", heute)).toEqual({ von: "2025-01-01", bis: "2025-12-31" });
  });
});

describe("Formate", () => {
  it("datumLang / datumKurz", () => {
    expect(datumLang(txt, heute)).toBe("Mittwoch, 8. Juli");
    expect(datumKurz(txt, "2026-08-22")).toBe("Sa, 22. Aug");
  });
  it("spanneLesbar im Monat, über Monat und über Jahr", () => {
    expect(spanneLesbar(txt, "2026-08-22", "2026-08-26")).toBe("22.–26. August 2026");
    expect(spanneLesbar(txt, "2026-08-28", "2026-09-03")).toBe("28. Aug – 3. Sep 2026");
    expect(spanneLesbar(txt, "2025-12-28", "2026-01-03")).toBe("28. Dez 2025 – 3. Jan 2026");
    expect(spanneLesbar(txt, "2026-05-01", "2026-05-01")).toBe("1. Mai 2026");
  });
  it("zeitraumLegende", () => {
    expect(zeitraumLegende(txt, "2026-07-01", "2026-07-31")).toBe("Jul 2026");
    expect(zeitraumLegende(txt, "2025-08-01", "2026-07-31")).toBe("Aug 2025 – Jul 2026");
  });
  it("prozent mit Komma, null als Strich", () => {
    expect(prozent("de", 46.77)).toBe("46,8 %");
    expect(prozent("de", null)).toBe("—");
    // Englisch, Irisch und Maltesisch rechnen mit dem Punkt.
    expect(prozent("en", 46.77)).toBe("46.8 %");
  });
});

describe("Rechnen", () => {
  it("naechte und tagPlus über Monatsgrenzen", () => {
    expect(naechte("2026-08-22", "2026-08-26")).toBe(4);
    expect(naechte("2026-08-31", "2026-09-01")).toBe(1);
    expect(tagPlus("2026-08-31", 1)).toBe("2026-09-01");
    expect(tagPlus("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("veraenderungPct: null bei fehlendem oder Null-Vergleich", () => {
    expect(veraenderungPct(164, 100)).toBe(64);
    expect(veraenderungPct(50, 100)).toBe(-50);
    expect(veraenderungPct(500, 0)).toBeNull();
    expect(veraenderungPct(null, 100)).toBeNull();
    expect(veraenderungPct(100, null)).toBeNull();
  });
});

describe("isoKalenderwoche", () => {
  // Die Fälle, an denen sich ISO-8601 von der US-Zählung unterscheidet — und
  // zwar ausschliesslich dort. Elf Monate im Jahr liefern beide dasselbe.
  it("zählt nach ISO-8601, nicht nach der US-Variante", () => {
    expect(isoKalenderwoche("2026-01-01")).toBe(1); // Do → Woche 1
    expect(isoKalenderwoche("2026-06-29")).toBe(27); // Montag
    expect(isoKalenderwoche("2026-07-05")).toBe(27); // Sonntag DERSELBEN Woche
    expect(isoKalenderwoche("2026-07-06")).toBe(28); // nächster Montag
  });

  it("legt den Jahreswechsel in die Woche, zu der er gehört", () => {
    // 2027 beginnt an einem Freitag: der 01.01. gehört noch in die letzte
    // Woche von 2026, nicht in Woche 1. Genau hier läge die US-Zählung daneben.
    expect(isoKalenderwoche("2026-12-31")).toBe(53);
    expect(isoKalenderwoche("2027-01-01")).toBe(53);
    expect(isoKalenderwoche("2027-01-04")).toBe(1); // erster Montag
  });

  it("stimmt mit der Rechnung des Webs überein", () => {
    // Beide Seiten zeigen dieselbe Woche desselben Tages; liefen sie
    // auseinander, hiesse derselbe Aufenthalt in App und Portal anders.
    // Die Web-Variante steht in web/lib/dates.ts und rechnet identisch.
    const web = (iso: string) => {
      const d = new Date(iso + "T00:00:00Z");
      const wochentag = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - wochentag);
      const anfang = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil(((d.getTime() - anfang.getTime()) / 86_400_000 + 1) / 7);
    };
    for (const iso of ["2026-01-01", "2026-03-15", "2026-08-02", "2026-12-31"]) {
      expect(isoKalenderwoche(iso)).toBe(web(iso));
    }
  });
});
