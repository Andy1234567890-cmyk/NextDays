// Die Liste öffnete live mit „19.–22. Aug 2027", weil absteigend nach
// `check_in` sortiert wurde: oben stand, was am weitesten weg ist.
import {
  istAnstehend,
  sortiereBuchungen,
  type Sortierbar,
} from "@/lib/buchungs-reihenfolge";

const HEUTE = "2026-08-24";

function b(check_in: string, check_out: string, booked_at: string | null = null): Sortierbar {
  return { check_in, check_out, booked_at };
}

describe("istAnstehend", () => {
  it("zählt eine laufende Buchung dazu, nicht zur Vergangenheit", () => {
    // Angereist vorgestern, Abreise übermorgen: der Gast ist im Haus.
    expect(istAnstehend(b("2026-08-22", "2026-08-26"), HEUTE)).toBe(true);
  });

  it("zählt den Abreisetag selbst noch dazu — da ist Arbeit", () => {
    expect(istAnstehend(b("2026-08-20", HEUTE), HEUTE)).toBe(true);
  });

  it("gestern abgereist ist Vergangenheit", () => {
    expect(istAnstehend(b("2026-08-18", "2026-08-23"), HEUTE)).toBe(false);
  });
});

describe("sortiereBuchungen · anstehend", () => {
  it("stellt die nächste Anreise nach oben, nicht die späteste", () => {
    const liste = [
      b("2027-08-19", "2027-08-22"),
      b("2026-08-30", "2026-09-02"),
      b("2026-08-25", "2026-08-28"),
    ];
    const sortiert = sortiereBuchungen(liste, "anstehend", HEUTE);
    expect(sortiert.map((r) => r.check_in)).toEqual([
      "2026-08-25",
      "2026-08-30",
      "2027-08-19",
    ]);
  });

  it("hängt Vergangenes hinten an, die jüngste zuerst", () => {
    const liste = [
      b("2024-03-17", "2024-03-20"),
      b("2026-09-01", "2026-09-05"),
      b("2026-08-01", "2026-08-05"),
    ];
    const sortiert = sortiereBuchungen(liste, "anstehend", HEUTE);
    expect(sortiert.map((r) => r.check_in)).toEqual([
      "2026-09-01",
      "2026-08-01",
      "2024-03-17",
    ]);
  });

  it("blendet nichts aus — die Menge bleibt gleich", () => {
    const liste = [b("2024-01-01", "2024-01-03"), b("2027-08-19", "2027-08-22")];
    expect(sortiereBuchungen(liste, "anstehend", HEUTE)).toHaveLength(2);
  });

  it("lässt die Eingabeliste unberührt", () => {
    const liste = [b("2027-08-19", "2027-08-22"), b("2026-08-25", "2026-08-28")];
    sortiereBuchungen(liste, "anstehend", HEUTE);
    expect(liste[0].check_in).toBe("2027-08-19");
  });
});

describe("sortiereBuchungen · gebucht", () => {
  it("geht nach dem Buchungszeitpunkt des Gastes, nicht nach der Anreise", () => {
    const spaeteAnreiseFruehGebucht = b("2027-08-19", "2027-08-22", "2026-01-05T10:00:00Z");
    const naheAnreiseSpaetGebucht = b("2026-08-25", "2026-08-28", "2026-08-20T09:00:00Z");
    const sortiert = sortiereBuchungen(
      [spaeteAnreiseFruehGebucht, naheAnreiseSpaetGebucht],
      "gebucht",
      HEUTE,
    );
    expect(sortiert[0].check_in).toBe("2026-08-25");
  });

  it("schiebt Buchungen ohne Quell-Zeitstempel ans Ende statt sie vorzuziehen", () => {
    // Wurzel 5b: kein Rückfall auf `created_at`, kein erfundenes Datum — die
    // Zeile sagt „unbekannt" und steht deshalb hinten.
    const ohne = b("2026-08-25", "2026-08-28", null);
    const mit = b("2026-09-10", "2026-09-14", "2026-02-01T00:00:00Z");
    const sortiert = sortiereBuchungen([ohne, mit], "gebucht", HEUTE);
    expect(sortiert[0]).toBe(mit);
    expect(sortiert[1]).toBe(ohne);
  });
});
