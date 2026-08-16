"use client";

// Darstellungs-Bausteine des Posteingangs: Kanal-Marke, Gast-Avatar, Status,
// Zeit- und Zeitraum-Formate, Kopfleisten-Aktionen. Aus `inbox-list.tsx`
// herausgelöst — die Datei war auf 2178 Zeilen gewachsen und mischte Seiten-
// gerüst, Konversation, Reservierungspanel und diese kleinen Bausteine.
// Rein darstellend: kein Laden, kein Zustand, keine Seiteneffekte.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import { kanalAbzeichen, otaIcon } from "@/lib/kanal-marke";


/** Initialen des Gastes (max. 2) für den Avatar — wie bei Lodgify/Hostaway. */
export function initialen(name: string | null): string {
  const teile = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (teile.length === 0) return "?";
  return teile
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Kanal-Bildmarke und -Farbe liegen in `lib/kanal-marke` — die Startseite
// rendert serverseitig und kann aus dieser `"use client"`-Datei keine Funktion
// aufrufen. Re-Export, damit die bestehenden Importstellen unverändert bleiben.
export { kanalAbzeichen, otaIcon } from "@/lib/kanal-marke";

/**
 * Kanal-Herkunft in der Listenzeile: das ECHTE Portal-Logo, wo es Breite hat.
 *
 * Der Versuch, es als 1-rem-Abzeichen an den Avatar zu heften, ist gescheitert:
 * „Booking.com" und Co. sind breite Wortmarken, in einen Kreis oder eine kleine
 * Kachel gequetscht werden sie zum Fleck. In der Meta-Zeile darf das Logo seine
 * natürliche Breite behalten und bleibt lesbar. Kanäle ohne echtes Logo
 * (WhatsApp, eigener Marktplatz) zeigen Bildmarke + Namen — kein geratenes
 * Marken-Logo (Regel „Portal-Logos nur echt").
 */
export function ChannelTag({ channel }: { channel: string | null }) {
  const logo = channelLogoLoose(channel);
  const marke = kanalAbzeichen(channel);
  // `channel` ist der rohe `ota_name` (Channex-Code „BookingCom") — angezeigt
  // wird der Klarname, nicht der Code.
  const label = channelLabelLoose(channel);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={label}
        title={label || undefined}
        className="h-3 w-auto max-w-[4.5rem] shrink-0 object-contain object-left"
      />
    );
  }
  if (!channel) return null;
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[0.7rem] ${marke.fg}`}>
      <Icon icon={marke.icon} className="size-3" />
      {label}
    </span>
  );
}

/**
 * Gast-Avatar (Initialen). Die Kanal-Herkunft steht als `ChannelTag` in der
 * Zeile, nicht als Abzeichen am Avatar.
 */
export function GuestAvatar({
  name,
  size = "md",
  unread,
  bildUrl,
}: {
  name: string | null;
  size?: "sm" | "md";
  unread?: boolean;
  /** Profilbild beim Portal (0295). Fehlt es, bleiben es die Initialen — nie
   *  ein Platzhalterbild, das ein Gesicht behauptet, das wir nicht haben. */
  bildUrl?: string | null;
}) {
  const box = size === "sm" ? "size-9" : "size-10";
  return (
    <span className={`relative ${box} shrink-0`}>
      {bildUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- Fremd-CDN
        // (a0.muscache.com); next/image bräuchte dafür einen konfigurierten
        // Remote-Host und würde jedes Gastfoto über unseren Optimizer leiten.
        <img
          src={bildUrl}
          alt=""
          className={`${box} rounded-full object-cover`}
          loading="lazy"
        />
      ) : (
        <span
          className={`flex ${box} items-center justify-center rounded-full bg-secondary text-xs font-bold text-muted-foreground`}
        >
          {initialen(name)}
        </span>
      )}
      {unread && (
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card" />
      )}
    </span>
  );
}

/** Kanal-Herkunft groß: echtes Portal-Logo, sonst das Kanal-Symbol. */
export function ChannelMark({ name }: { name: string | null }) {
  const logo = channelLogoLoose(name);
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name ?? ""}
        title={name ?? undefined}
        className="size-7 shrink-0 object-contain"
      />
    );
  }
  return (
    <span title={name ?? undefined} className="shrink-0">
      <Icon icon={otaIcon(name)} className="size-7 text-accent" />
    </span>
  );
}

/**
 * Reservierungsstatus als Pille in der Thread-Zeile (beide Vorbilder führen
 * ihn dort: eine stornierte Buchung darf man nicht erst nach dem Öffnen
 * erkennen). Werte kommen aus `channex_booking.status`.
 *
 * WICHTIG — das ist der Status der BUCHUNG, nicht der Lesestand der
 * Nachrichten. `new` heißt „Neubuchung, noch nicht als geändert/storniert
 * gemeldet", nicht „ungelesen". Live standen deshalb alle 22 Threads auf
 * „Neu", obwohl jeder einzelne gelesen war (`is_read = true`) — die Spalte
 * war als Lesestand gelesen worden und damit wertlos. Der Lesestand hat sein
 * eigenes Kennzeichen (`UngelesenBadge`), und der Normalfall `new` bekommt
 * hier gar keine Pille mehr: eine Auszeichnung, die auf JEDE Zeile zutrifft,
 * unterscheidet nichts und verdeckt nur die, die wirklich etwas sagen
 * (storniert/geändert).
 */
export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("inbox");
  const key = status.trim().toLowerCase();
  if (key === "new" || !key) return null;
  const farbe =
    key === "cancelled"
      ? "bg-destructive/10 text-destructive"
      : key === "modified"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  const label =
    key === "cancelled"
      ? t("filterStatusCancelled")
      : key === "modified"
        ? t("filterStatusModified")
        : status;
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${farbe}`}
    >
      {label}
    </span>
  );
}

/**
 * Ungelesene Nachrichten — das Kennzeichen, das im Posteingang wirklich zählt.
 *
 * Bewusst eine eigene Pille statt nur des Punkts am Avatar: über eine lange
 * Liste hinweg ist ein 10-px-Punkt am Bildrand nicht zu erfassen, und die
 * fettere Schrift allein unterscheidet gelesen/ungelesen zu schwach.
 */
export function UngelesenBadge() {
  const t = useTranslations("inbox");
  return (
    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-semibold text-accent-foreground">
      {t("unreadBadge")}
    </span>
  );
}

/**
 * „vor 5 Min." / „Gestern" / „1. Aug." / „3. Sept. 2025" — kurze Zeitangabe
 * rechts in der Thread-Zeile. Beide Vorbilder zeigen das Alter der letzten
 * Aktivität; ohne das lässt sich nicht erkennen, was frisch ist.
 *
 * Das JAHR steht dabei, sobald es nicht das laufende ist. Ohne diese
 * Unterscheidung sah eine Nachricht vom 3. September 2025 aus wie eine vom
 * 3. September dieses Jahres — live betraf das vier Threads am Listenende, die
 * damit ein Jahr zu frisch aussahen.
 */
export function kurzeZeit(iso: string | null, locale: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jetzt = new Date();
  const min = Math.round((jetzt.getTime() - d.getTime()) / 60_000);
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
  if (min < 1) return rel.format(0, "minute");
  if (min < 60) return rel.format(-min, "minute");
  if (min < 60 * 24) return rel.format(-Math.round(min / 60), "hour");
  if (min < 60 * 24 * 7) return rel.format(-Math.round(min / (60 * 24)), "day");
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === jetzt.getFullYear() ? {} : { year: "numeric" }),
  });
}

/**
 * Zeitstempel → Millisekunden zum SORTIEREN (nicht zum Anzeigen).
 *
 * Ein `localeCompare` auf der Rohzeichenkette reicht hier nicht: dieselbe
 * Sekunde kommt in zwei Schreibweisen an („…+00:00" aus der Datenbank, „…Z"
 * aus dem Portal-Import), und im Zeichenvergleich ist „Z" > „+". Leere oder
 * unlesbare Werte werden zu `0` (1970), damit sie bei „neueste zuerst" ans
 * ENDE fallen — als leerer String sortierten sie nach vorn. Bewusst eine
 * endliche Zahl statt `-Infinity`: die Differenz zweier `-Infinity` wäre
 * `NaN`, und ein `NaN`-Vergleich macht die Sortierung unbestimmt.
 */
export function zeitWert(iso: string | null): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

export function fmtRange(a: string | null, b: string | null, locale: string): string {
  if (!a) return "";
  const f = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  return b ? `${f(a)} - ${f(b)}` : f(a);
}

/**
 * Eine Zeile der Gästekarte.
 *
 * `always` hält die Zeile auch ohne Wert sichtbar (mit Feldnamen und „—"), wie
 * es Lodgify tut: der Nutzer sieht dann, dass das Feld existiert und die OTA es
 * nicht mitliefert — statt einer Karte, die je nach Buchung anders aussieht.
 */
export function DetailLine({
  icon,
  value,
  label,
  always,
}: {
  icon: string;
  value: string | null;
  label?: string;
  always?: boolean;
}) {
  if (!value && !always) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon icon={icon} className="size-5 shrink-0 text-muted-foreground" />
      {value ? (
        <span className="min-w-0 break-words">
          {label ? <span className="text-muted-foreground">{label}: </span> : null}
          {value}
        </span>
      ) : (
        <span className="min-w-0 break-words text-muted-foreground">
          {label ? `${label}: ` : ""}—
        </span>
      )}
    </div>
  );
}

/** Eintrag im Überlaufmenü der Kopfleiste — Icon UND Text. */
export function MenuAction({
  icon,
  label,
  destructive,
  onClick,
}: {
  icon: string;
  label: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm hover:bg-muted/50 " +
        (destructive ? "text-destructive" : "")
      }
    >
      <Icon
        icon={icon}
        className={"size-4 " + (destructive ? "" : "text-muted-foreground")}
      />
      {label}
    </button>
  );
}

export function HeadAction({
  icon,
  title,
  active,
  onClick,
}: {
  icon: string;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-(--radius) hover:bg-muted/60 " +
        (active ? "text-amber-500" : "")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}
