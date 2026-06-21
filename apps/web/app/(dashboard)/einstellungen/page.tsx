// Einstellungen — Konto-/Firmen-Einstellungen.
// Der Channel-Manager hat eine eigene Seite (/channels, Sidebar-Link) und ist
// daher hier bewusst NICHT mehr eingebettet (keine Dopplung).
export const dynamic = "force-dynamic";

export default function EinstellungenPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Einstellungen</h1>
        <p className="text-sm text-muted-foreground">
          Konto- und Firmen-Einstellungen.
        </p>
      </header>

      <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        Den Channel-Manager findest du jetzt im Hauptmenü unter „Channel
        Manager".
      </p>
    </div>
  );
}
