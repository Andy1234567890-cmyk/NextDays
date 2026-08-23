// Neutraler Hinweis, wenn eine Domain zu keinem Betrieb gehört oder noch keine
// Seite veröffentlicht ist. Bewusst inhaltsleer: hier darf KEIN fremder Inhalt
// und kein Marktplatz-Ersatz erscheinen — die Adresse gehört niemandem, den wir
// kennen.
export function NichtEingerichtet() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-display text-xl font-semibold">
        Diese Seite ist noch nicht eingerichtet
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        Für diese Adresse ist noch keine Buchungs-Site veröffentlicht.
      </p>
    </div>
  );
}
