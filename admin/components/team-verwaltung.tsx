"use client";

// Backoffice-Team: wer Zugang hat, wer eingeladen ist, wer ihn wieder verloren
// hat.
//
// Der Zugang hier ist der einzige mandantenübergreifende der Plattform —
// deshalb zeigt die Liste bewusst AUCH entzogene Zugänge (Historie), markiert
// offene Einladungen und macht die Rolle unmissverständlich: „Voller Zugriff"
// darf freigeben und sperren, „Support" liest und bearbeitet Anfragen.
//
// Sichtbarkeit ≠ Berechtigung: Änderungen erlaubt der Server nur einem
// platform_admin, und er weist Selbst-Änderungen sowie das Entfernen des
// letzten Vollzugangs ab. Die Oberfläche blendet solche Aktionen nur zusätzlich
// aus, damit niemand in einen sicheren Fehler läuft.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import type { PlatformRole, TeamMember } from "@/lib/backoffice";
import { einladen, team, zugangAendern } from "@/lib/team-actions";

const ROLLE_LABEL: Record<PlatformRole, string> = {
  platform_admin: "Voller Zugriff",
  platform_support: "Support",
};

const ROLLE_ERKLAERUNG: Record<PlatformRole, string> = {
  platform_admin:
    "Sieht alles, darf freigeben, sperren und Team-Zugänge vergeben.",
  platform_support:
    "Sieht alles Lesende und bearbeitet Support-Anfragen — keine Freigaben, keine Sperren.",
};

export function TeamVerwaltung({
  eigeneUserId,
  darfSchreiben,
}: {
  eigeneUserId: string;
  darfSchreiben: boolean;
}) {
  const [liste, setListe] = useState<TeamMember[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await team();
    if (res.ok) setListe(res.data.items);
    else toast.error(res.fehler);
    setGeladen(true);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Team</h1>
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        Zugänge zum Backoffice. Wer hier steht, sieht die Daten aller Betriebe —
        entsprechend sparsam vergeben.
      </p>

      {darfSchreiben && (
        <Einladen
          aufEingeladen={async (neuerLink) => {
            setLink(neuerLink);
            await laden();
          }}
        />
      )}

      {link && (
        <div className="mt-4 max-w-3xl rounded-2xl border border-dashed border-foreground/40 p-4">
          <p className="text-sm font-semibold">
            Einladungslink (bitte persönlich weitergeben)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Die E-Mail konnte nicht versendet werden. Der Link ist 72 Stunden
            gültig und nur einmal verwendbar.
          </p>
          <code className="mt-2 block break-all rounded-xl bg-muted/60 p-3 text-xs">
            {link}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link kopiert.");
            }}
            className="mt-3 rounded-full border border-border px-4 py-1.5 text-xs font-medium transition-colors hover:border-foreground"
          >
            Kopieren
          </button>
        </div>
      )}

      {!geladen ? (
        <p className="mt-8 text-sm text-muted-foreground">Wird geladen …</p>
      ) : (
        <ul className="mt-8 max-w-3xl divide-y divide-border rounded-2xl border border-border">
          {liste.map((m) => (
            <Zeile
              key={m.user_id}
              mitglied={m}
              istSelbst={m.user_id === eigeneUserId}
              darfSchreiben={darfSchreiben}
              aufAenderung={laden}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Einladen({
  aufEingeladen,
}: {
  aufEingeladen: (link: string | null) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [rolle, setRolle] = useState<PlatformRole>("platform_support");
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || laeuft) return;
    setLaeuft(true);
    const res = await einladen(email.trim(), rolle, notiz.trim() || undefined);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setEmail("");
    setNotiz("");
    toast.success(
      res.data.ergebnis === "freigeschaltet"
        ? "Bestehendes Konto freigeschaltet."
        : res.data.mail_versendet
          ? "Einladung versendet."
          : "Einladung erstellt — Link unten weitergeben.",
    );
    if (res.data.hinweis && !res.data.mail_versendet) {
      toast.message(res.data.hinweis);
    }
    await aufEingeladen(res.data.invite_link);
  }

  return (
    <form
      onSubmit={absenden}
      className="mt-8 max-w-3xl rounded-2xl border border-border p-5"
    >
      <p className="text-sm font-semibold">Kolleg:in einladen</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Hat die Adresse schon ein Konto, wird sie sofort freigeschaltet. Sonst
        bekommt sie einen Link, über den sie ihr Passwort selbst setzt — wir
        vergeben nie ein Passwort für andere.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <label className="min-w-[16rem] flex-1">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            E-Mail
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground"
          />
        </label>
        <label className="min-w-[12rem]">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Rolle
          </span>
          <RollenAuswahl
            wert={rolle}
            aufAenderung={setRolle}
            className="w-full rounded-xl px-3.5 py-2 text-sm"
          />
        </label>
        <label className="min-w-[14rem] flex-1">
          <span className="mb-1.5 block text-xs text-muted-foreground">
            Notiz (optional)
          </span>
          <input
            type="text"
            maxLength={200}
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="z. B. Werkstudentin Support"
            className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2 text-sm outline-none focus-visible:border-foreground"
          />
        </label>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {ROLLE_ERKLAERUNG[rolle]}
      </p>

      <button
        type="submit"
        disabled={laeuft}
        className="mt-4 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {laeuft ? "Wird eingeladen …" : "Einladen"}
      </button>
    </form>
  );
}

/**
 * Rollen-Auswahl mit eigenem Pfeil.
 *
 * Der native Select-Pfeil klebt je nach Plattform am Text bzw. am Rand — daher
 * `appearance-none` plus ein eigenes Chevron mit echtem Abstand (pr-9). So
 * sieht die Auswahl in jedem Browser gleich aus.
 */
function RollenAuswahl({
  wert,
  aufAenderung,
  gesperrt = false,
  className = "",
}: {
  wert: PlatformRole;
  aufAenderung: (rolle: PlatformRole) => void;
  gesperrt?: boolean;
  className?: string;
}) {
  return (
    <span className="relative inline-flex items-center">
      <select
        value={wert}
        disabled={gesperrt}
        onChange={(e) => aufAenderung(e.target.value as PlatformRole)}
        className={`appearance-none border border-border bg-transparent pr-9 outline-none focus-visible:border-foreground disabled:opacity-50 ${className}`}
      >
        <option value="platform_support">Support</option>
        <option value="platform_admin">Voller Zugriff</option>
      </select>
      <Icon
        icon="ph:caret-down"
        aria-hidden
        className="pointer-events-none absolute right-3 size-3.5 text-muted-foreground"
      />
    </span>
  );
}

function Zeile({
  mitglied,
  istSelbst,
  darfSchreiben,
  aufAenderung,
}: {
  mitglied: TeamMember;
  istSelbst: boolean;
  darfSchreiben: boolean;
  aufAenderung: () => Promise<void>;
}) {
  const [laeuft, setLaeuft] = useState(false);

  async function aendern(felder: {
    platform_role?: PlatformRole;
    active?: boolean;
  }) {
    setLaeuft(true);
    const res = await zugangAendern(mitglied.user_id, felder);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success("Gespeichert.");
    await aufAenderung();
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-4">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">
            {mitglied.email ?? mitglied.user_id}
          </span>
          {istSelbst && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
              Du
            </span>
          )}
          {!mitglied.active && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[0.6875rem] font-medium text-destructive">
              Zugang entzogen
            </span>
          )}
          {mitglied.invite_pending && (
            <span className="rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-medium text-background">
              Einladung offen
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {ROLLE_LABEL[mitglied.platform_role]}
          {mitglied.note ? ` · ${mitglied.note}` : ""}
          {mitglied.last_sign_in_at
            ? ` · zuletzt aktiv ${new Date(mitglied.last_sign_in_at).toLocaleDateString("de-DE")}`
            : " · noch nie angemeldet"}
        </span>
      </span>

      {darfSchreiben && !istSelbst && (
        <span className="flex shrink-0 items-center gap-2">
          <RollenAuswahl
            wert={mitglied.platform_role}
            gesperrt={laeuft}
            aufAenderung={(r) => void aendern({ platform_role: r })}
            className="rounded-full px-3 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void aendern({ active: !mitglied.active })}
            className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-foreground disabled:opacity-50"
          >
            <Icon
              icon={mitglied.active ? "ph:prohibit" : "ph:arrow-counter-clockwise"}
              className="size-3.5"
            />
            {mitglied.active ? "Zugang entziehen" : "Wieder aktivieren"}
          </button>
        </span>
      )}
    </li>
  );
}
