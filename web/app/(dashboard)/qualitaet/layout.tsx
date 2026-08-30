// Qualität als EIGENER Hauptmenüpunkt, nicht als Unterpunkt der Bewertungen.
//
// So macht es Hostaway auch (`Hosting Quality`, eigener Eintrag mit
// new-Abzeichen, nur für Admins) — und der Grund ist nicht Geschmack: die
// Auswertung beantwortet eine andere Frage als die Liste. Die Liste ist
// Tagesgeschäft („was muss ich beantworten"), die Auswertung ist Rückblick
// („wo stehen wir, woran liegt es"). Wer sie als fünften Reiter neben die
// Liste hängt, versteckt sie hinter einer Arbeit, die nie fertig wird.
export default function QualitaetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-6">
      {children}
    </div>
  );
}
