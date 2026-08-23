// Logo einer Kunden-Site.
//
// UNVERHANDELBAR: hier steht NIE das myNextDays-Logo. Diese Seiten gehören dem
// Betrieb und werden von seinen Gästen gesehen; unsere PMS-Marke hat dort nichts
// zu suchen (Zwei-Marken-Regel).
//
// Vorher fiel diese Komponente ohne Kunden-Logo auf `mnd_lockup.svg` zurück —
// jeder Betrieb, der noch kein Logo hochgeladen hatte, zeigte seinen Gästen
// unsere Wortmarke in der Kopfzeile. Live gesehen am 23.08.2026 in der
// Entwurfs-Vorschau.
//
// Ohne Kunden-Logo wird deshalb NICHTS gerendert. Die Kopfzeile zeigt dann den
// Namen des Betriebs als Wortmarke (siehe site-header) — das ist der ehrliche
// Zustand „noch kein Logo", nicht der Ersatz durch eine fremde Marke.

export function Logo({
  heightRem = 2.25,
  src,
  alt,
}: {
  heightRem?: number;
  /** Logo des Betriebs aus dem Branding. Fehlt es, wird nichts gezeigt. */
  src?: string | null;
  alt?: string | null;
}) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      style={{ height: `${heightRem}rem`, width: "auto", flexShrink: 0 }}
    />
  );
}
