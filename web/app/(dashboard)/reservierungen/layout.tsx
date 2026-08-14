// Sub-Layout der PM-Fläche. Reicht den Inhalt unverändert durch — die
// Auth-Prüfung liegt im übergeordneten (dashboard)/layout.
//
// FRÜHER STAND HIER EINE ZWEITE NAVIGATION (PmModuleShell/PmModuleNav):
// „Kontrollzentrum · Unterkünfte · Aufgaben · Bilder · Warnungen · Zeitleiste ·
// Reporting" plus „Einstellungen · Team · App · Slack". Sieben ihrer elf Punkte
// standen wortgleich in der Haupt-Sidebar links daneben — zwei Navspalten
// nebeneinander, die teils dieselben Ziele hatten. Entfernt am 14.08.2026 auf
// ausdrückliche Ansage.
//
// Die vier Seiten, die ausschließlich dort verlinkt waren (/reservierungen/
// bilder, /warnungen, /app, /slack), bleiben bestehen und sind weiterhin über
// ihre Adresse erreichbar — bewusst ohne Menüeintrag (Entscheidung vom
// 14.08.2026). Wer sie wieder sichtbar machen will, hängt sie in
// components/app-sidebar.tsx ein, nicht in eine neue zweite Leiste.
export default function ReservierungenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
