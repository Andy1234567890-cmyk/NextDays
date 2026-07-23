"use client";

// Abschnitt „Login & Sicherheit" im Airbnb-Muster: zwei Tabs (Anmeldung /
// Geteilter Zugriff). Tab Anmeldung: 2FA-Einrichten-Karte oben, dann Passwort
// (Re-Auth beim Ändern, Wurzel 7) und 2FA (echter TOTP-Enroll-Flow). Bereiche
// ohne Backend (Geräteverlauf, geteilter Zugriff) zeigen ehrlich „in
// Vorbereitung" statt toter Buttons (Wurzel 5).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import type { Account } from "@/lib/konto";
import { updatePassword } from "@/lib/konto-actions";

import { Geraeteverlauf } from "./geraeteverlauf";
import { KontoZeile } from "./konto-zeile";
import { ZweiFaZeile } from "./zweifa-zeile";

type Tab = "login" | "shared";

export function SicherheitAbschnitt({ account }: { account: Account }) {
  const t = useTranslations("konto");
  const [tab, setTab] = useState<Tab>("login");

  return (
    <section>
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">
        {t("sicherheitTitel")}
      </h1>

      {/* Tabs */}
      <div className="mb-8 flex gap-6 border-b border-border">
        {(["login", "shared"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`relative -mb-px pb-3 text-[0.9375rem] transition-colors ${
              tab === key
                ? "font-semibold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(key === "login" ? "loginTab" : "sharedTab")}
            {tab === key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-foreground" />
            )}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <LoginTab account={account} />
      ) : (
        <SharedTab />
      )}
    </section>
  );
}

function LoginTab({ account }: { account: Account }) {
  const t = useTranslations("konto");

  const zweiFaAktiv = !!account.phone_verified_at;

  return (
    <div>
      {/* 2FA-Karte (Airbnb-Muster): „Jetzt einrichten" startet den Vollbild-
          Wizard (/zwei-faktor). Aktiv = Nummer per SMS verifiziert. */}
      {zweiFaAktiv ? (
        <div className="mb-10 flex items-start gap-4 rounded-2xl border border-border p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Icon icon="solar:verified-check-bold" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("zweiFaAktivTitel")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("zweiFaAktivText", { phone: account.phone ?? "" })}
            </p>
          </div>
          <Link
            href="/zwei-faktor"
            className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70"
          >
            {t("zweiFaVerwalten")}
          </Link>
        </div>
      ) : (
        <div className="mb-10 flex items-start gap-4 rounded-2xl border border-border p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white">
            <Icon icon="solar:lock-keyhole-bold" className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t("zweiFaKarteTitel")}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("zweiFaKarteText")}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Link
                href="/zwei-faktor"
                className="rounded-full bg-muted px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted/70"
              >
                {t("zweiFaJetztEinrichten")}
              </Link>
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-2 text-xl font-semibold">{t("abschnittAnmeldung")}</h2>
      <PasswortZeile account={account} />
      {/* Authenticator-App (TOTP) als zusätzlicher/alternativer 2. Faktor —
          neben SMS. Echter Enroll-Flow (QR → Code → Recovery-Codes). */}
      <ZweiFaZeile enabled={account.totp_enabled} />

      {/* Geräteverlauf — echte aktive Sitzungen aus auth.sessions */}
      <h2 className="mb-2 mt-10 text-xl font-semibold">
        {t("abschnittGeraete")}
      </h2>
      <p className="mb-4 max-w-lg text-sm text-muted-foreground">
        {t("geraeteBeschreibung")}
      </p>
      <Geraeteverlauf />
    </div>
  );
}

function PasswortZeile({ account }: { account: Account }) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktuell, setAktuell] = useState("");
  const [neu, setNeu] = useState("");

  function schliessen() {
    setOffen(false);
    setFehler(null);
    setAktuell("");
    setNeu("");
  }

  async function speichern() {
    setBusy(true);
    setFehler(null);
    const res = await updatePassword(aktuell, neu);
    setBusy(false);
    if (res.ok) {
      schliessen();
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  return (
    <KontoZeile
      label={t("passwort")}
      value="••••••••"
      hasValue={account.has_password}
      open={offen}
      dimmed={false}
      onOpen={() => setOffen(true)}
      onClose={schliessen}
    >
      <div className="max-w-lg space-y-4">
        {account.has_password && (
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("passwortAktuell")}
            </label>
            <Input
              type="password"
              value={aktuell}
              onChange={(e) => setAktuell(e.target.value)}
              disabled={busy}
              autoFocus
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium">
            {t("passwortNeu")}
          </label>
          <Input
            type="password"
            value={neu}
            onChange={(e) => setNeu(e.target.value)}
            disabled={busy}
          />
        </div>
        {fehler && <p className="text-sm text-destructive">{fehler}</p>}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={speichern}
            disabled={busy || neu.length < 8 || (account.has_password && !aktuell)}
          >
            {t("speichern")}
          </Button>
          <button
            type="button"
            onClick={schliessen}
            disabled={busy}
            className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
          >
            {t("abbrechen")}
          </button>
        </div>
      </div>
    </KontoZeile>
  );
}

function SharedTab() {
  const t = useTranslations("konto");
  return (
    <div>
      <h2 className="mb-2 text-xl font-semibold">{t("sharedTitel")}</h2>
      <p className="mb-6 max-w-lg text-sm text-muted-foreground">
        {t("sharedText")}
      </p>
      <div className="flex items-start gap-4 rounded-2xl border border-border p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
          <Icon icon="solar:users-group-rounded-line-duotone" className="size-6" />
        </span>
        <div>
          <p className="font-semibold">{t("sharedKarteTitel")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("sharedKarteText")}
          </p>
        </div>
      </div>
    </div>
  );
}
