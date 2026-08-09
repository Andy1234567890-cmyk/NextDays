"use client";

// Eigentümer-Liste + Anlage-Dialog (Agentur-Sicht). Karten je Eigentümer mit
// Stammdaten-Kurzinfo, Provision und Objekt-Anzahl; Klick öffnet das Detail.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  createOwner,
  deleteOwner,
  type FreieObjektOption,
  type OwnerListItem,
} from "@/lib/owners";
import { ObjektMehrfachauswahl } from "@/components/objekt-mehrfachauswahl";
import { SprachAuswahl } from "@/components/sprache-auswahl";

export function OwnersList({
  initial,
  loadError,
  freieObjekte,
  freieObjekteError,
  canManage = false,
}: {
  initial: OwnerListItem[];
  loadError: string | null;
  /** Objekte ohne Eigentümer — die einzigen, die beim Anlegen zuweisbar sind
   *  (ein Objekt gehört genau EINEM Eigentümer, Migration 0073). */
  freieObjekte: FreieObjektOption[];
  /** Grund, falls die Objektliste nicht geladen werden konnte. Wird im Dialog
   *  ANGEZEIGT statt zu einer leeren Liste zu werden: „keine freien Objekte"
   *  und „Liste nicht geladen" sind zwei verschiedene Aussagen, und die zweite
   *  als die erste auszugeben wäre der Fallback, den es hier nicht gibt. */
  freieObjekteError: string | null;
  /** manage_owners vorhanden? Nur dann Schreib-Aktionen zeigen (reine UX —
   *  der echte Schutz sitzt im MANAGE_OWNERS-geschützten Backend-Router). */
  canManage?: boolean;
}) {
  const t = useTranslations("owners");
  const router = useRouter();
  // Props direkt rendern — useState(initial) würde die Liste beim Mount
  // einfrieren und die frischen Server-Props nach jedem Realtime-
  // router.refresh() ignorieren (Liste bliebe für immer stehen).
  const owners = initial;
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<OwnerListItem | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && (
          <Button onClick={() => setCreating(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("new")}
          </Button>
        )}
      </div>

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : owners.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:user-circle-gear" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyHint")}</p>
          {canManage && (
            <Button onClick={() => setCreating(true)}>
              <Icon icon="ph:plus" className="size-4" />
              {t("new")}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {owners.map((o) => (
            // Karte = Container mit Link-OVERLAY statt <button> um die Card:
            // ein Lösch-Button IN einem Button wäre ungültiges HTML. Das
            // Overlay liegt unter dem Lösch-Icon (z-Index), der Icon-Klick
            // trifft also nie den Link — keine versehentliche Navigation.
            <Card
              key={o.id}
              className="relative flex flex-col gap-2 p-5 transition-shadow focus-within:shadow-md hover:shadow-md"
            >
              <Link
                href={`/eigentuemer/${o.id}`}
                className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="sr-only">{o.name}</span>
              </Link>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
                  <Icon icon="ph:user" className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{o.name}</p>
                  {o.company && (
                    <p className="truncate text-xs text-muted-foreground">
                      {o.company}
                    </p>
                  )}
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${t("delete")} — ${o.name}`}
                    // z-10 hebt das Icon über das Link-Overlay; stopPropagation
                    // zusätzlich, damit kein Klick nach oben durchschlägt.
                    className="relative z-10 ml-auto size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleting(o);
                    }}
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </Button>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {o.email ?? "—"}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {t("commissionShort")}: {commissionLabel(o)}
                </span>
                <span>{t("propertyCount", { count: o.property_count })}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateOwnerDialog
          freieObjekte={freieObjekte}
          freieObjekteError={freieObjekteError}
          onClose={() => setCreating(false)}
          onCreated={(id, eingeladen) => {
            toast.success(eingeladen ? t("createdInvited") : t("created"));
            router.push(`/eigentuemer/${id}`);
          }}
        />
      )}

      {deleting && (
        <DeleteOwnerDialog
          owner={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/**
 * Bestätigung vor dem Löschen eines Eigentümers.
 *
 * Ehrlichkeit über die Folgen (live gegen die DB geprüft): Objekt-Zuordnungen
 * (`owner_properties`) UND Eigentümer-Abrechnungen (`owner_statements`) hängen
 * per `on delete cascade` am Eigentümer und verschwinden mit ihm; Ausgaben
 * (`owner_expenses.owner_id`) werden auf null gesetzt. Das Backend lehnt das
 * NICHT ab — es gibt keinen Konflikt-Fall, nur 404 (fremder/unbekannter Owner).
 * Deshalb der zusätzliche Irreversibel-Hinweis.
 *
 * `router.refresh()` nach Erfolg ist hier PFLICHT, nicht Notnagel: `owners`
 * ist für `authenticated` vollständig gesperrt (Migration 0337, Wurzel 6 —
 * IBAN/CPR/PII) und liegt nicht in `supabase_realtime`. Es gibt für diese
 * Seite also KEINE Realtime-Quelle, die das Delete-Event tragen könnte; ein
 * Abo darauf wäre eine stumme Attrappe und ein Re-Grant der falsche Weg.
 * Ohne dieses Refresh blieb die Karte bis zum manuellen Neuladen stehen.
 * Gleiches Muster wie `buchhaltung/new-customer-button.tsx` (customers ist
 * durch dieselbe Migration gesperrt).
 */
function DeleteOwnerDialog({
  owner,
  onClose,
}: {
  owner: OwnerListItem;
  onClose: () => void;
}) {
  const t = useTranslations("owners");
  const tIrreversible = useTranslations("finance.StornoInvoice");
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const res = await deleteOwner(owner.id);
    if (res.ok) {
      toast.success(t("deleted"));
      onClose();
      router.refresh();
      return;
    }
    // Backend-Fehler sichtbar machen (z. B. 404 „nicht gefunden", 403 ohne
    // Berechtigung) — nicht stumm scheitern. Dialog bleibt offen.
    setBusy(false);
    toast.error(res.error);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <div className="flex flex-col gap-4">
          <DialogTitle>{t("delete")}</DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-2">
              <span className="font-semibold text-foreground">{owner.name}</span>
              <span>{t("deleteConfirm")}</span>
              <span>{tIrreversible("noticeIrreversible")}</span>
            </div>
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : (
                <Icon icon="ph:trash" className="size-4" />
              )}
              {t("delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateOwnerDialog({
  freieObjekte,
  freieObjekteError,
  onClose,
  onCreated,
}: {
  freieObjekte: FreieObjektOption[];
  freieObjekteError: string | null;
  onClose: () => void;
  /** `eingeladen` = der Server hat den Versand der Einladungsmail bestätigt. */
  onCreated: (id: string, eingeladen: boolean) => void;
}) {
  const t = useTranslations("owners");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Objekte, die diesem Eigentümer SOFORT gehören sollen. Optional: ein
  // Eigentümer darf ohne Objekte angelegt werden (das Objekt wird oft erst
  // später erfasst). Die Auswahl geht im selben Aufruf mit — nicht als zweiter
  // Request, der scheitern und einen Eigentümer ohne seine Objekte
  // zurücklassen könnte.
  const [objektIds, setObjektIds] = useState<string[]>([]);
  const [objektSuche, setObjektSuche] = useState("");
  // Sprache der Abrechnungs-/Benachrichtigungsmails an diesen Eigentümer.
  // Vorbelegt mit der Sprache, in der der Betreiber gerade arbeitet — sichtbar
  // im Feld und mit einem Griff änderbar. Sie hier gleich mit zu erfassen ist
  // wichtiger als bei anderen Stammdaten: der Eigentümer bekommt Mails, sobald
  // ihm ein Objekt zugeordnet ist, auch ganz ohne Login.
  const uiLocale = useLocale();
  const [language, setLanguage] = useState(uiLocale);
  // Portalzugang gleich mit einrichten. Ohne E-Mail-Adresse gibt es keinen
  // Einmal-Link — die Option ist dann gesperrt und sagt auch, warum
  // (statt still übersprungen zu werden).
  const [portalzugang, setPortalzugang] = useState(false);
  const [busy, setBusy] = useState(false);
  const hatEmail = email.trim().length > 0;
  // Der Zugang wird nur angefordert, wenn er auch möglich ist. Bliebe das
  // Häkchen nach dem Löschen der Adresse gesetzt, liefe der Aufruf in ein 422.
  const zugangAnfordern = portalzugang && hatEmail;

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await createOwner({
      name: name.trim(),
      email: email.trim() || null,
      language: language || null,
      portalzugang: zugangAnfordern,
      property_ids: objektIds,
    });
    setBusy(false);
    if (res.ok) {
      // Ehrliche Rückmeldung: „Einladung verschickt" nur, wenn der Server den
      // Versand auch bestätigt. Sonst die schlichte Anlage-Meldung.
      onCreated(res.data.id, res.data.einladung_versendet === true);
    } else toast.error(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      {/* Etwas breiter als die reinen Stammdaten-Felder und in der Höhe
          begrenzt: die Objektliste hat ihren eigenen Scrollbereich, der Dialog
          selbst darf bei 18+ Objekten nicht über den Bildschirm hinauswachsen. */}
      <Card
        className="flex max-h-[90dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-extrabold">{t("newTitle")}</h2>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-name">{t("fields.name")}</Label>
          <Input
            id="owner-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholders.name")}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-email">{t("fields.email")}</Label>
          <Input
            id="owner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("placeholders.email")}
          />
        </div>
        <SprachAuswahl
          id="owner-new-lang"
          value={language}
          onChange={setLanguage}
          label={t("fields.emailLanguage")}
          hint={t("emailLanguageHint")}
        />
        {/* Portalzugang: optional, weil ein Eigentümer seine Abrechnungsmails
            auch ohne Login bekommt. Ohne E-Mail-Adresse gesperrt statt still
            übersprungen — der Grund steht daneben. */}
        <div className="flex flex-col gap-1">
          <label
            className={`flex items-start gap-2 ${
              hatEmail ? "" : "opacity-60"
            }`}
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={zugangAnfordern}
              disabled={!hatEmail}
              onChange={(e) => setPortalzugang(e.target.checked)}
            />
            <span className="text-sm font-medium">{t("portalAccess")}</span>
          </label>
          <p className="text-xs text-muted-foreground">
            {hatEmail ? t("portalAccessHint") : t("portalAccessNeedsEmail")}
          </p>
        </div>
        {/* Objektzuweisung — optional, aber sofort. Zur Auswahl stehen nur
            Objekte OHNE Eigentümer: ein Objekt gehört genau einem (0073), und
            ein bereits vergebenes hier anzubieten hieße, den Betreiber in einen
            409 laufen zu lassen. Umgehängt wird beim bisherigen Eigentümer. */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("assignProperties")}</span>
          <p className="text-xs text-muted-foreground">
            {t("assignPropertiesHint")}
          </p>
          {freieObjekteError ? (
            // Ein Ladefehler ist NICHT „keine freien Objekte". Ihn als leere
            // Liste auszugeben wäre die Falschaussage, der Betrieb habe alle
            // Objekte vergeben — deshalb steht hier der Grund.
            <p className="rounded-(--radius) border border-destructive/40 p-4 text-sm text-destructive">
              {freieObjekteError}
            </p>
          ) : (
            <ObjektMehrfachauswahl
              objekte={freieObjekte}
              selected={objektIds}
              onChange={setObjektIds}
              suche={objektSuche}
              onSucheChange={setObjektSuche}
              disabled={busy}
              emptyText={t("noFreeProperties")}
            />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? t("saving") : t("create")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Effektive Provision für die Karte: einheitlich → ein Wert, sonst Spanne.
// Ohne zugeordnete Objekte (min/max null) der Owner-Default.
function commissionLabel(o: OwnerListItem): string {
  const lo = o.commission_min;
  const hi = o.commission_max;
  if (lo == null || hi == null) return `${o.default_commission_pct}%`;
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}
