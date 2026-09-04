"use client";

// Konto → Benutzer → Detailseite eines Benutzers.
//
// Aufbau (Abschnitte mit je einem Bearbeiten-Sheet von rechts):
//   Kopf                       Name, Zugangs-Status, Deaktivieren/Aktivieren, Löschen
//   Kontaktdaten               Vor-/Nachname, E-Mail, zwei Telefonnummern
//   Zusätzliche Informationen  Sprache der E-Mails, gesprochene Sprachen, Anmerkung
//   Rolle und Berechtigungen   Rolle + die tatsächlich gesetzten Rechte
//   Zugewiesene Objekte        nur für Rollen MIT Objektbezug (owner/staff/cleaner)
//
// WAS HIER BEWUSST NICHT NOCHMAL GEBAUT IST:
// Die Abrechnung eines Eigentümers (Provisionssatz, Mindestprovision,
// Pauschalen, Gültigkeitszeiträume) lebt in der Eigentümer-Kartei
// (`owners`/`owner_billing_terms`, /eigentuemer). Sie hier als zweites
// Eingabefeld zu wiederholen hieße, zwei Schreibwege auf dieselbe Zahl zu haben
// — beim nächsten Feld liefen sie auseinander. Der Satz wird deshalb ANGEZEIGT
// (echter Wert aus der Kartei, „—" wenn keiner vereinbart ist, nie eine 0) und
// mit einem Link auf die Kartei zum Bearbeiten verwiesen.
//
// Warum es die Objektzuweisung hier trotzdem gibt: sie hängt am LOGIN
// (`owner_property_assignments`/`staff_property_assignments`), nicht an der
// Kartei — sie ist genau die Frage „was sieht dieser Zugang".
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@nextdays/ui/avatar";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import {
  type TenantUser,
  activateManagedUser,
  deactivateManagedUser,
  deleteManagedUser,
  setOwnerProperties,
  setStaffProperties,
} from "@/lib/account";
import { einladungErneutSenden } from "@/lib/einladung";
import type { Property } from "@/lib/properties";
import { initialsOf } from "@/lib/initials";

import { BenutzerKontaktSheet, namenTeilen } from "./benutzer-kontakt-sheet";
import {
  BenutzerObjekteSheet,
  ObjektBild,
  objektAdresse,
} from "./benutzer-objekte-sheet";
import { BenutzerRolleSheet } from "./benutzer-rolle-sheet";
import { BenutzerZusatzSheet } from "./benutzer-zusatz-sheet";
import { ZugangsStatus } from "./zugangs-status";
import {
  GENERAL_PERMISSIONS,
  INBOX_PERMISSIONS,
  PM_PERMISSIONS,
} from "./user-wizard-data";

type Abschnitt = "kontakt" | "zusatz" | "rolle" | "objekte" | null;

export function BenutzerDetail({
  user,
  properties,
  zugewiesen,
  provisionProObjekt,
  ownerId,
  tenantCountry,
}: {
  user: TenantUser;
  /** Alle Objekte des Kontos (Auswahl im Zuweisen-Sheet). */
  properties: Property[];
  /** IDs der aktuell zugewiesenen Objekte. */
  zugewiesen: string[];
  /** Effektiver Provisionssatz je Objekt aus der Eigentümer-Kartei.
   *  Ein fehlender Eintrag heißt „kein Satz vereinbart" → „—", nie 0 %. */
  provisionProObjekt: Record<string, number | null>;
  /** Verknüpfte Eigentümer-Kartei (`owners.id`) oder null. */
  ownerId: string | null;
  /** Land des Betriebs (ISO-2) für die Telefon-Vorwahl. */
  tenantCountry: string | null;
}) {
  const t = useTranslations("account");
  const tPermissions = useTranslations("permissions");
  // Gespeichert, aber ohne Wirkung: das PM-Dach (`access_pm_features`) filtert
  // `pm_*`/`inbox_*` heraus, wenn es fehlt — und die Rolle „Eigentümer" kann es
  // nicht tragen. Die Differenz zwischen gespeichert und wirksam war bisher
  // nirgends benannt.
  const wirkungslos = (user.stored_permissions ?? []).filter(
    (id) => !user.permissions.includes(id),
  );
  const tObj = useTranslations("objects.meta.status");
  const locale = useLocale();
  const router = useRouter();
  const [offen, setOffen] = useState<Abschnitt>(null);
  const [busy, setBusy] = useState(false);

  const name = namenTeilen(user.full_name);
  const rolleMitObjekten =
    user.role === "owner" ||
    user.role === "staff" ||
    user.role === "cleaner" ||
    user.role === "shift_lead";
  const aktiv = user.is_active !== false;

  const prozent = (wert: number | null | undefined) =>
    wert === null || wert === undefined
      ? "—"
      : new Intl.NumberFormat(locale, {
          style: "percent",
          maximumFractionDigits: 2,
        }).format(wert / 100);

  async function statusUmschalten() {
    setBusy(true);
    const res = aktiv
      ? await deactivateManagedUser(user.user_id)
      : await activateManagedUser(user.user_id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Der Anmeldedienst kann abweichen (Teilerfolg). Das wird BENANNT, nicht
    // als „erledigt" ausgegeben — sonst hält der Betreiber einen offenen
    // Zugang für gesperrt (Wurzel 5).
    const wieGewuenscht = aktiv ? res.data.login_gesperrt : !res.data.login_gesperrt;
    if (wieGewuenscht) {
      toast.success(aktiv ? t("userDetail.deactivated") : t("userDetail.activated"));
    } else {
      toast.warning(
        aktiv
          ? t("userDetail.deactivatedLoginPending")
          : t("userDetail.activatedLoginPending"),
      );
    }
    router.refresh();
  }

  async function loeschen() {
    const label = user.full_name || user.email || "";
    if (!window.confirm(t("userDetail.confirmDelete", { name: label }))) return;
    setBusy(true);
    const res = await deleteManagedUser(user.user_id);
    setBusy(false);
    if (res.ok) {
      toast.success(t("users.deleted"));
      router.push("/konto/nutzer");
    } else {
      toast.error(res.error);
    }
  }

  async function einladungSenden() {
    setBusy(true);
    const res = await einladungErneutSenden(user.user_id);
    setBusy(false);
    if (res.ok) toast.success(t("users.inviteResent", { email: user.email ?? "" }));
    else toast.error(res.error || t("users.inviteResendFailed"));
  }

  /** Eine einzelne Zuweisung aufheben (Replace ohne diese ID). */
  async function zuweisungAufheben(propertyId: string) {
    const rest = zugewiesen.filter((id) => id !== propertyId);
    setBusy(true);
    const res =
      user.role === "owner"
        ? await setOwnerProperties(user.user_id, rest)
        : await setStaffProperties(user.user_id, rest);
    setBusy(false);
    if (res.ok) {
      toast.success(t("userDetail.assignmentRemoved"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  const zugewieseneObjekte = properties.filter((p) => zugewiesen.includes(p.id));

  return (
    // pb-20: der Support-Chat schwebt unten rechts. Ohne diesen Abstand liegt
    // das „…"-Menü der LETZTEN Tabellenzeile darunter und ist nicht klickbar
    // (live gesehen) — ein Bedienelement, das man nicht erreicht, ist keines.
    <div className="flex flex-1 flex-col gap-6 pb-20">
      {/* --- Kopf ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/konto/nutzer"
          aria-label={t("userDetail.back")}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:caret-left" className="size-5" />
        </Link>
        <Avatar className="size-10 shrink-0">
          {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
          <AvatarFallback>
            {initialsOf(user.full_name || user.email || "?")}
          </AvatarFallback>
        </Avatar>
        <h2 className="font-display text-xl font-extrabold">
          {user.full_name || user.email || t("userDetail.unnamed")}
        </h2>
        <ZugangsStatus aktiv={aktiv} seit={user.deactivated_at ?? null} />
        <div className="ml-auto flex items-center gap-2">
          {user.role !== "admin" && (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void statusUmschalten()}
              >
                {aktiv ? t("userDetail.deactivate") : t("userDetail.activate")}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("userDetail.moreActions")}
                    disabled={busy}
                  >
                    <Icon icon="ph:dots-three-vertical" className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => void einladungSenden()}>
                    <Icon icon="ph:envelope-simple" />
                    {t("users.resendInvite")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => void loeschen()}
                  >
                    <Icon icon="ph:trash" />
                    {t("users.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* Ein deaktivierter Zugang wird ERKLÄRT, nicht nur bebadgt: der Betreiber
          soll wissen, was die Sperre wirklich bewirkt. */}
      {!aktiv && (
        <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          {t("userDetail.deactivatedHint")}
        </p>
      )}

      {/* --- Kontaktdaten --------------------------------------------------- */}
      <Abschnittskarte
        titel={t("userDetail.contact")}
        onEdit={() => setOffen("kontakt")}
        editLabel={t("userDetail.editContact")}
      >
        <Feld label={t("userWizard.firstName")} wert={name.vorname} />
        <Feld label={t("userWizard.lastName")} wert={name.nachname} />
        <Feld label={t("userWizard.email")} wert={user.email} />
        <Feld label={t("userWizard.phone")} wert={user.phone} />
        <Feld label={t("userWizard.extraPhone")} wert={user.additional_phone} />
        {/* Nur wenn gesetzt: eine Zeile „Nummern werden angezeigt" wäre die
            Wiederholung des Normalfalls. */}
        {user.hide_phones && (
          <Feld
            label={t("userDetail.colStatus")}
            wert={t("userWizard.hidePhones")}
          />
        )}
      </Abschnittskarte>

      {/* --- Zusätzliche Informationen -------------------------------------- */}
      <Abschnittskarte
        titel={t("userDetail.extra")}
        onEdit={() => setOffen("zusatz")}
        editLabel={t("userDetail.editExtra")}
      >
        <Feld
          label={t("users.emailLanguage")}
          wert={
            user.preferred_language
              ? new Intl.DisplayNames([locale], { type: "language" }).of(
                  user.preferred_language,
                ) ?? user.preferred_language
              : null
          }
        />
        <Feld
          label={t("userWizard.spokenLanguages")}
          wert={(user.spoken_languages ?? []).join(", ")}
        />
        <Feld label={t("userWizard.notes")} wert={user.notes} />
      </Abschnittskarte>

      {/* --- Rolle und Berechtigungen --------------------------------------- */}
      <Abschnittskarte
        titel={t("userDetail.roleAndPermissions")}
        onEdit={() => setOffen("rolle")}
        editLabel={t("userDetail.editRole")}
        spalten={1}
      >
        <div className="flex flex-col gap-4">
          <span className="inline-flex w-fit rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
            {user.role
              ? user.role === "owner"
                ? t("roles.ownerShort")
                : t(`roles.${user.role}`)
              : "—"}
          </span>
          <RechteGruppe
            titel={t("users.generalPermissions")}
            ids={GENERAL_PERMISSIONS.map((p) => p.id)}
            gesetzt={user.permissions}
          />
          <RechteGruppe
            titel={t("userDetail.pmPermissions")}
            ids={PM_PERMISSIONS.map((p) => p.id)}
            gesetzt={user.permissions}
          />
          <RechteGruppe
            titel={t("userDetail.inboxPermissions")}
            ids={INBOX_PERMISSIONS.map((p) => p.id)}
            gesetzt={user.permissions}
          />
          {/* Diese Seite zeigt die WIRKSAMEN Rechte — was die Person kann. Ohne
              den Hinweis unten verschweigt sie aber, dass gespeicherte Rechte
              wirkungslos sind: das PM-Dach (`access_pm_features`) filtert alle
              `pm_*`/`inbox_*` heraus, und die Rolle „Eigentümer" kann das Dach
              nicht tragen. Live standen bei einem Eigentümer 6 Rechte in der
              Datenbank und 2 auf dieser Seite — die Differenz war nirgends
              erklärt, und genau das ließ die Rechteverwaltung kaputt aussehen. */}
          {wirkungslos.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                {t("userDetail.ohneWirkung", { anzahl: wirkungslos.length })}
              </p>
              {/* Die Rechte BENENNEN, nicht nur zählen: „4 Berechtigungen
                  wirken nicht" lässt den Betreiber im Dunkeln, welche gemeint
                  sind — er kann daraufhin nichts entscheiden. */}
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {wirkungslos.map((id) => (
                  <li key={id} className="text-sm line-through opacity-60">
                    {tPermissions(`${id}.label`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Abschnittskarte>

      {/* --- Zugewiesene Objekte -------------------------------------------- */}
      {rolleMitObjekten && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-extrabold">
                {t("userDetail.assignedProperties")}
              </h3>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {user.role === "owner"
                  ? t("userDetail.assignHintOwner")
                  : t("userDetail.assignHintStaff")}
              </p>
            </div>
            <Button
              className="shrink-0"
              onClick={() => setOffen("objekte")}
              disabled={busy}
            >
              {t("userDetail.assignProperty")}
            </Button>
          </div>

          {zugewieseneObjekte.length === 0 ? (
            <p className="rounded-(--radius) border border-border p-4 text-sm text-muted-foreground">
              {t("userDetail.noAssignedProperties")}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-(--radius) border border-border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">
                      {t("userDetail.colProperty")}
                    </th>
                    {ownerId && (
                      <th className="p-3 font-medium">
                        {t("userDetail.colCommission")}
                      </th>
                    )}
                    <th className="p-3 font-medium">
                      {t("userDetail.colStatus")}
                    </th>
                    <th className="w-12 p-3" />
                  </tr>
                </thead>
                <tbody>
                  {zugewieseneObjekte.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="p-3">
                        <Link
                          href={`/objekte/${p.id}`}
                          className="flex items-center gap-3"
                        >
                          <ObjektBild property={p} />
                          <span className="flex min-w-0 flex-col leading-tight">
                            <span className="truncate font-medium">
                              {p.title}
                            </span>
                            {objektAdresse(p) && (
                              <span className="truncate text-xs text-muted-foreground">
                                {objektAdresse(p)}
                              </span>
                            )}
                          </span>
                        </Link>
                      </td>
                      {ownerId && (
                        <td className="p-3 tabular-nums">
                          {prozent(provisionProObjekt[p.id])}
                        </td>
                      )}
                      <td className="p-3">{tObj(p.status)}</td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={t("userDetail.moreActions")}
                              disabled={busy}
                            >
                              <Icon
                                icon="ph:dots-three-vertical"
                                className="size-4"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {ownerId && (
                              <DropdownMenuItem asChild>
                                <Link href={`/eigentuemer/${ownerId}`}>
                                  <Icon icon="ph:percent" />
                                  {t("userDetail.editPayoutTerms")}
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() => void zuweisungAufheben(p.id)}
                            >
                              <Icon icon="ph:link-break" />
                              {t("userDetail.unassign")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ohne Kartei gibt es keinen Provisionssatz — das wird gesagt, statt
              eine leere Spalte zu zeigen oder 0 % zu behaupten. */}
          {user.role === "owner" && !ownerId && (
            <p className="text-xs text-muted-foreground">
              {t("userDetail.noOwnerRecord")}
            </p>
          )}
        </section>
      )}

      {offen === "kontakt" && (
        <BenutzerKontaktSheet
          user={user}
          land={tenantCountry}
          onClose={() => {
            setOffen(null);
            router.refresh();
          }}
        />
      )}
      {offen === "zusatz" && (
        <BenutzerZusatzSheet
          user={user}
          onClose={() => {
            setOffen(null);
            router.refresh();
          }}
        />
      )}
      {offen === "rolle" && (
        <BenutzerRolleSheet
          user={user}
          onClose={() => {
            setOffen(null);
            router.refresh();
          }}
        />
      )}
      {offen === "objekte" && user.role && (
        <BenutzerObjekteSheet
          userId={user.user_id}
          role={user.role}
          properties={properties}
          zugewiesen={zugewiesen}
          onClose={() => {
            setOffen(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/* ---------- Bausteine ---------- */

function Abschnittskarte({
  titel,
  onEdit,
  editLabel,
  spalten = 3,
  children,
}: {
  titel: string;
  onEdit: () => void;
  editLabel: string;
  spalten?: 1 | 3;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-(--radius) border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-sm font-extrabold">{titel}</h3>
        <button
          type="button"
          onClick={onEdit}
          aria-label={editLabel}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Icon icon="ph:pencil-simple" className="size-4" />
        </button>
      </div>
      <div
        className={
          spalten === 1
            ? "mt-3"
            : "mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {children}
      </div>
    </section>
  );
}

/** Ein Nur-Lese-Feld. Leer bleibt „—" — kein erfundener Platzhaltertext. */
function Feld({ label, wert }: { label: string; wert: string | null | undefined }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="truncate text-sm">{wert?.trim() ? wert : "—"}</span>
    </div>
  );
}

/** Die GESETZTEN Rechte einer Gruppe. Nicht gesetzte werden weggelassen — eine
 *  Liste mit 43 Einträgen, von denen 4 ein Häkchen tragen, liest niemand. */
function RechteGruppe({
  titel,
  ids,
  gesetzt,
}: {
  titel: string;
  ids: string[];
  gesetzt: string[];
}) {
  const tPerm = useTranslations("permissions");
  const aktive = ids.filter((id) => gesetzt.includes(id));
  if (aktive.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h4 className="text-xs text-muted-foreground">{titel}</h4>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {aktive.map((id) => (
          <li key={id} className="flex items-start gap-1.5 text-sm">
            <Icon
              icon="ph:check"
              className="mt-0.5 size-4 shrink-0 text-accent"
              aria-hidden
            />
            {tPerm(`${id}.label`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
