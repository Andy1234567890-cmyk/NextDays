"use client";

// Reiter „Zugang": Einladungsstand, letzter Login, Konto seit — und die
// Handlungen Einladung erneut senden, Zugang sperren/freischalten (Taskilo
// AppAccessTab). Rollen und feingranulare Rechte bleiben im Benutzerkonto;
// die App-Anmeldung (PIN, App-Rechte) kommt mit der Mitarbeiter-App.
//
// STEMPEL-TERMINAL (Vertrag §6, Backend §3.1)
// -------------------------------------------
// Dazu kommt der Terminal-Zugang: Stempel-ID (vier Ziffern) und PIN (vier bis
// sechs Ziffern) für die Stempeluhr am Terminal. Die PIN wird serverseitig
// gehasht (pbkdf2) und NIE wieder ausgeliefert — die Oberfläche kennt deshalb
// nur `hat_terminal_pin: boolean` und kann sie ausschliesslich NEU setzen,
// nicht anzeigen. Ein Feld, das eine gespeicherte PIN vorspiegelt, wäre eine
// Falschaussage (Wurzel 4).
//
// Die Stempel-ID darf leer bleiben: der Server vergibt dann die nächste freie.
// Ist die eingegebene ID schon belegt, antwortet er 409 `stempel_id_vergeben` —
// der Code wird über `personal.fehlercode.*` übersetzt, nicht als Rohtext
// ausgegeben.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { activateManagedUser, deactivateManagedUser } from "@/lib/account";
import { einladungErneutSenden } from "@/lib/einladung";
import { terminalZugangEntfernen, terminalZugangSetzen } from "@/lib/personal-betrieb";
import type { PersonUebersicht } from "@/lib/personal-typen";
import { formatDateTime } from "@/lib/utils";

export function AkteZugang({
  u,
  stempelId = null,
  hatTerminalPin = false,
  kannVerwalten = false,
}: {
  u: PersonUebersicht;
  /** Aus `Akte.stempel_id` (§3.1) — `null` heißt „kein Terminal-Zugang". */
  stempelId?: string | null;
  /** Aus `Akte.hat_terminal_pin` (§3.1). Die PIN selbst kommt nie zurück. */
  hatTerminalPin?: boolean;
  /** `manage_personal` — nur damit ist der Terminal-Abschnitt überhaupt sichtbar. */
  kannVerwalten?: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function einladen() {
    setBusy(true);
    const res = await einladungErneutSenden(u.user_id);
    setBusy(false);
    if (res.ok) toast.success(t("kartei.einladungGesendet", { email: u.email ?? "" }));
    else toast.error(res.error);
    router.refresh();
  }

  async function sperren(aktiv: boolean) {
    if (!aktiv && !window.confirm(t("kartei.sperrenFrage", { name: u.full_name ?? "" }))) return;
    setBusy(true);
    const res = aktiv ? await activateManagedUser(u.user_id) : await deactivateManagedUser(u.user_id);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    if (!res.data.login_gesperrt && !aktiv) toast.warning(t("kartei.sperrenTeilerfolg"));
    else toast.success(aktiv ? t("kartei.freigeschaltet") : t("kartei.gesperrtMeldung"));
    router.refresh();
  }

  const einladungFarbe: Record<NonNullable<PersonUebersicht["einladung"]>, string> = {
    keine: "bg-secondary text-muted-foreground",
    offen: "bg-amber-100 text-amber-800",
    abgelaufen: "bg-destructive/10 text-destructive",
    angenommen: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("kartei.zugangStatus")}</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("kartei.zugang")}</dt>
            <dd>
              <span className={`rounded-full px-2 py-0.5 text-xs ${u.is_active ? "bg-emerald-100 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>
                {u.is_active ? t("kartei.aktiv") : t("mitarbeiter.gesperrt")}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("kartei.einladung")}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {u.einladung && <span className={`rounded-full px-2 py-0.5 text-xs ${einladungFarbe[u.einladung]}`}>{t(`einladungStand.${u.einladung}`)}</span>}
              {u.einladung_am && <span className="text-xs text-muted-foreground">{formatDateTime(u.einladung_am, locale)}</span>}
              {u.eingeladen_von_name && <span className="text-xs text-muted-foreground">· {t("kartei.eingeladenVon", { name: u.eingeladen_von_name })}</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("kartei.letzterLogin")}</dt>
            <dd>{u.letzter_login ? formatDateTime(u.letzter_login, locale) : t("kartei.nieAngemeldet")}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("kartei.kontoSeit")}</dt>
            <dd>{u.konto_seit ? formatDateTime(u.konto_seit, locale) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("kartei.email")}</dt>
            <dd>{u.email ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" disabled={busy || !u.email} onClick={einladen}>
            <Icon icon="ph:envelope-simple" className="mr-1 size-4" />
            {u.einladung === "angenommen" ? t("kartei.passwortLinkSenden") : t("kartei.einladungSenden")}
          </Button>
          {u.is_active ? (
            <Button variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={() => sperren(false)}>
              <Icon icon="ph:lock" className="mr-1 size-4" />
              {t("kartei.zugangSperren")}
            </Button>
          ) : (
            <Button className="rounded-full" disabled={busy} onClick={() => sperren(true)}>
              <Icon icon="ph:lock-open" className="mr-1 size-4" />
              {t("kartei.zugangFreischalten")}
            </Button>
          )}
          <Link href={`/konto/nutzer/${u.user_id}`} className="inline-flex items-center rounded-full border px-3 text-sm hover:bg-secondary">
            {t("kartei.rechteImKonto")}
          </Link>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("kartei.sperrenHint")}</p>
      </section>

      {kannVerwalten && (
        <TerminalZugang
          userId={u.user_id}
          name={u.full_name ?? ""}
          stempelId={stempelId}
          hatPin={hatTerminalPin}
        />
      )}

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("kartei.appZugang")}</h2>
        <p className="text-sm text-muted-foreground">{t("kartei.appZugangHint")}</p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
          <li>{t("kartei.appPunktPlan")}</li>
          <li>{t("kartei.appPunktStempeln")}</li>
          <li>{t("kartei.appPunktAntraege")}</li>
        </ul>
      </section>
    </div>
  );
}

/**
 * Stempel-Terminal: Stempel-ID + PIN setzen/ändern und entfernen (§3.1).
 *
 * Der Server ist die Wahrheit über Vergabe und Format: er vergibt die nächste
 * freie ID, wenn das Feld leer bleibt, und antwortet 409 `stempel_id_vergeben`,
 * wenn die gewünschte belegt ist. Die Oberfläche prüft deshalb nur, was sie
 * ohne Kenntnis des Bestandes wirklich prüfen kann — die ZIFFERNFORM — und
 * überlässt alles andere der Antwort, statt eine Vergabe zu simulieren.
 */
function TerminalZugang({
  userId,
  name,
  stempelId,
  hatPin,
}: {
  userId: string;
  name: string;
  stempelId: string | null;
  hatPin: boolean;
}) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(false);
  const [id, setId] = useState(stempelId ?? "");
  const [pin, setPin] = useState("");

  const idOk = id === "" || /^\d{4}$/.test(id);
  const pinOk = /^\d{4,6}$/.test(pin);

  /** Fehlercode aus `details.code` übersetzen, sonst die Servermeldung zeigen. */
  function melden(fehler: string, details?: Record<string, unknown>) {
    const code = typeof details?.code === "string" ? details.code : null;
    toast.error(code ? t(`fehlercode.${code}`) : fehler);
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!idOk || !pinOk) return;
    setBusy(true);
    const res = await terminalZugangSetzen(userId, { stempel_id: id || null, pin });
    setBusy(false);
    if (!res.ok) return void melden(res.error, res.details);
    toast.success(t("akte.terminal.gesetztMeldung", { id: res.data.stempel_id }));
    setPin("");
    setId(res.data.stempel_id);
    setForm(false);
    router.refresh();
  }

  async function entfernen() {
    if (!window.confirm(t("akte.terminal.entfernenFrage", { name }))) return;
    setBusy(true);
    const res = await terminalZugangEntfernen(userId);
    setBusy(false);
    if (!res.ok) return void melden(res.error, res.details);
    toast.success(t("akte.terminal.entferntMeldung"));
    setId("");
    setPin("");
    setForm(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-1 font-display text-lg font-extrabold">{t("akte.terminal.titel")}</h2>
      <p className="text-sm text-muted-foreground">{t("akte.terminal.hint")}</p>

      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t("akte.terminal.stempelId")}</dt>
          <dd className="tabular-nums">{stempelId ?? t("akte.terminal.keineId")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t("akte.terminal.pin")}</dt>
          <dd>
            {hatPin ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                {t("akte.terminal.pinGesetzt")}
              </span>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>

      {form ? (
        <form onSubmit={speichern} className="mt-4 flex flex-col gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("akte.terminal.stempelId")}</span>
            <Input
              inputMode="numeric"
              maxLength={4}
              value={id}
              onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 4))}
              aria-invalid={!idOk}
            />
            <span className="text-xs text-muted-foreground">{t("akte.terminal.stempelIdHint")}</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{hatPin ? t("akte.terminal.pinNeu") : t("akte.terminal.pin")}</span>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-invalid={pin !== "" && !pinOk}
              required
            />
            <span className="text-xs text-muted-foreground">{t("akte.terminal.pinHint")}</span>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => {
                setForm(false);
                setPin("");
                setId(stempelId ?? "");
              }}
            >
              {t("abbrechen")}
            </Button>
            <Button type="submit" className="rounded-full" disabled={busy || !idOk || !pinOk}>
              {t("speichern")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => setForm(true)}>
            <Icon icon="ph:identification-card" className="mr-1 size-4" />
            {stempelId ? t("akte.terminal.aendern") : t("akte.terminal.setzen")}
          </Button>
          {stempelId && (
            <Button variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={entfernen}>
              <Icon icon="ph:trash" className="mr-1 size-4" />
              {t("akte.terminal.entfernen")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
