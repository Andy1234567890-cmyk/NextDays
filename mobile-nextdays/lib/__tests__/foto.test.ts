// Prüft die Auswertung des Bildwählers: Abbruch ist KEIN Fehler, ein fremdes
// Format wird abgelehnt statt umbenannt, und der Dateiname fällt sauber zurück.
import { auswerten } from "@/lib/foto";

describe("auswerten", () => {
  it("liefert die Datei mit uri, name und typ", () => {
    const e = auswerten({
      assets: [{ uri: "file:///a/b.jpg", fileName: "b.jpg", type: "image/jpeg" }],
    });
    expect(e).toEqual({
      art: "bild",
      bild: { uri: "file:///a/b.jpg", name: "b.jpg", type: "image/jpeg" },
    });
  });

  it("erfindet einen Namen aus dem Typ, wenn keiner mitkommt", () => {
    const e = auswerten({ assets: [{ uri: "file:///a", type: "image/png" }] });
    expect(e.art).toBe("bild");
    if (e.art === "bild") expect(e.bild.name).toBe("nachweis.png");
  });

  it("behandelt den Abbruch als eigenen Ausgang, nicht als Fehler", () => {
    expect(auswerten({ didCancel: true })).toEqual({ art: "abgebrochen" });
  });

  it("gibt die Systemmeldung weiter, statt sie zu ersetzen", () => {
    const e = auswerten({ errorCode: "camera_unavailable", errorMessage: "Keine Kamera" });
    expect(e).toEqual({ art: "fehler", text: "Keine Kamera" });
  });

  it("nennt die fehlende Freigabe beim Namen", () => {
    const e = auswerten({ errorCode: "permission" });
    expect(e.art).toBe("fehler");
    if (e.art === "fehler") expect(e.text).toMatch(/freigegeben/i);
  });

  it("lehnt ein Format ab, das der Server ohnehin verwirft", () => {
    // Kein Umbenennen auf image/jpeg: der Server prüft die echten Bytes und
    // antwortet mit 415 (Wurzel 4/8).
    const e = auswerten({ assets: [{ uri: "file:///a.heic", type: "image/heic" }] });
    expect(e.art).toBe("fehler");
    if (e.art === "fehler") expect(e.text).toMatch(/JPEG/);
  });

  it("ohne uri ist es kein Bild", () => {
    expect(auswerten({ assets: [{ type: "image/jpeg" }] }).art).toBe("fehler");
    expect(auswerten({}).art).toBe("fehler");
  });
});
