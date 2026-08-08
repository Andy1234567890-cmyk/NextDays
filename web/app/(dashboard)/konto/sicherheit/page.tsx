"use client";

// Konto → Sicherheit, ANGEBUNDEN an den FastAPI-auth-Slice:
// echte Konto-Daten, E-Mail/Name/Passwort ändern, TOTP-2FA (Authenticator-App).
// SMS-2FA folgt erst mit einem SMS-Provider — Karte zeigt „demnächst".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type Account,
  type TotpEnroll,
  getAccount,
  totpDisable,
  totpEnroll,
  totpVerify,
  updateEmail,
  updateName,
  updatePassword,
} from "@/lib/account";

type Panel = null | "email" | "name" | "password" | "totp" | "totp-disable";

export default function SicherheitPage() {
  const t = useTranslations("account");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);

  async function reload() {
    const res = await getAccount();
    if (res.ok) setAccount(res.data);
    setLoading(false);
  }
  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <h2 className="font-display text-2xl font-extrabold">Sicherheit</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("security.loading")}</p>
      ) : !account ? (
        <Card className="p-5 text-sm text-destructive">
          Konto-Daten konnten nicht geladen werden. Ist das Backend erreichbar?
        </Card>
      ) : (
        <>
          {/* Berechtigungsnachweise */}
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-extrabold">
              Berechtigungsnachweise
            </h3>

            <Card className="flex flex-row items-start justify-between p-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  E-Mail und Benutzername
                </span>
                <span className="text-sm text-muted-foreground">
                  {account.email ?? "—"}
                  {account.full_name ? ` · ${account.full_name}` : ""}
                </span>
              </div>
              <div className="flex gap-1">
                <EditButton
                  label={t("security.editUsername")}
                  onClick={() => setPanel("name")}
                />
                <EditButton
                  label={t("security.editEmail")}
                  icon="ph:envelope-simple"
                  onClick={() => setPanel("email")}
                />
              </div>
            </Card>

            <Card className="flex flex-row items-start justify-between p-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">Passwort</span>
                <span className="text-sm text-muted-foreground">
                  {account.has_password ? "••••••••" : "Kein Passwort gesetzt"}
                </span>
              </div>
              <EditButton
                label={t("security.editPassword")}
                onClick={() => setPanel("password")}
              />
            </Card>
          </section>

          {/* Zwei-Faktor-Authentifizierung */}
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="font-display text-lg font-extrabold">
                Zwei-Faktor-Authentifizierung (2FA)
              </h3>
              <p className="text-sm text-muted-foreground">
                Schützt dein Konto mit einem zweiten Faktor zusätzlich zum
                Passwort.
              </p>
            </div>

            {/* Authenticator-App (TOTP) — voll funktionsfähig */}
            <Card className="flex flex-row items-start justify-between p-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  Authentifizierungs-App
                </span>
                <span className="text-sm text-muted-foreground">
                  Verwendet einen Einmalcode aus einer App wie Google
                  Authenticator oder Authy.
                </span>
                {account.totp_enabled && (
                  <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                    <Icon icon="ph:check-circle" className="size-3.5" />
                    Aktiv
                  </span>
                )}
              </div>
              {account.totp_enabled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-destructive"
                  onClick={() => setPanel("totp-disable")}
                >
                  Deaktivieren
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-accent"
                  onClick={() => setPanel("totp")}
                >
                  Aktivieren
                </Button>
              )}
            </Card>

            {/* SMS — erst mit Provider verfügbar */}
            <Card className="flex flex-row items-start justify-between p-5 opacity-70">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  SMS 2-Faktor-Verifizierung
                </span>
                <span className="text-sm text-muted-foreground">
                  Einmaliger SMS-Code. Verfügbar, sobald ein SMS-Anbieter
                  konfiguriert ist.
                </span>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                demnächst
              </span>
            </Card>
          </section>
        </>
      )}

      {/* Bearbeiten-Panels */}
      <NameSheet
        open={panel === "name"}
        current={account?.full_name ?? ""}
        onClose={() => setPanel(null)}
        onSaved={reload}
      />
      <EmailSheet
        open={panel === "email"}
        current={account?.email ?? ""}
        needsCurrent={account?.has_password ?? true}
        onClose={() => setPanel(null)}
        onSaved={reload}
      />
      <PasswordSheet
        open={panel === "password"}
        needsCurrent={account?.has_password ?? true}
        onClose={() => setPanel(null)}
        onSaved={reload}
      />
      <TotpSheet
        open={panel === "totp"}
        onClose={() => setPanel(null)}
        onSaved={reload}
      />
      <TotpDisableSheet
        open={panel === "totp-disable"}
        onClose={() => setPanel(null)}
        onSaved={reload}
      />
    </div>
  );
}

function EditButton({
  label,
  icon = "ph:pencil-simple",
  onClick,
}: {
  label: string;
  icon?: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className="shrink-0 text-muted-foreground"
      onClick={onClick}
    >
      <Icon icon={icon} className="size-4" />
    </Button>
  );
}

// --- Panels ----------------------------------------------------------------

function PanelShell({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl font-extrabold">
            {title}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

function NameSheet({
  open,
  current,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(current), [current, open]);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateName(value);
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else setError(res.error);
  }

  return (
    <PanelShell open={open} onClose={onClose} title={t("security.editUsername")}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={busy || !value.trim()}>
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </PanelShell>
  );
}

function EmailSheet({
  open,
  current,
  needsCurrent,
  onClose,
  onSaved,
}: {
  open: boolean;
  current: string;
  needsCurrent: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [value, setValue] = useState(current);
  const [currentPw, setCurrentPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setValue(current);
    setCurrentPw("");
    setError(null);
  }, [current, open]);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updateEmail(value, currentPw || undefined);
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else setError(res.error);
  }

  return (
    <PanelShell
      open={open}
      onClose={onClose}
      title={t("security.editEmail")}
      description={t("security.emailAppliesNow")}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          type="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      {needsCurrent && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email-cur">{t("security.currentPassword")}</Label>
          <Input
            id="email-cur"
            type="password"
            autoComplete="current-password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        onClick={save}
        disabled={busy || !value.trim() || (needsCurrent && !currentPw)}
      >
        {busy ? "Speichern…" : "Speichern"}
      </Button>
    </PanelShell>
  );
}

function PasswordSheet({
  open,
  needsCurrent,
  onClose,
  onSaved,
}: {
  open: boolean;
  needsCurrent: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCurrentPw("");
    setNewPw("");
    setError(null);
  }, [open]);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await updatePassword(newPw, needsCurrent ? currentPw : undefined);
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else setError(res.error);
  }

  return (
    <PanelShell open={open} onClose={onClose} title={t("security.editPassword")}>
      {needsCurrent && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cur">{t("security.currentPassword")}</Label>
          <Input
            id="cur"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            autoComplete="current-password"
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new">{t("security.newPassword")}</Label>
        <Input
          id="new"
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          autoComplete="new-password"
        />
        <span className="text-xs text-muted-foreground">
          Mindestens 8 Zeichen.
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={busy || newPw.length < 8}>
        {busy ? "Speichern…" : "Passwort ändern"}
      </Button>
    </PanelShell>
  );
}

function TotpSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [enroll, setEnroll] = useState<TotpEnroll | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Beim Öffnen Enrollment starten (Secret + QR holen).
  useEffect(() => {
    if (!open) {
      setEnroll(null);
      setCode("");
      setRecovery(null);
      setError(null);
      return;
    }
    (async () => {
      const res = await totpEnroll();
      if (res.ok) setEnroll(res.data);
      else setError(res.error);
    })();
  }, [open]);

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await totpVerify(code);
    setBusy(false);
    if (res.ok) {
      setRecovery(res.data.recovery_codes);
      onSaved();
    } else setError(res.error);
  }

  return (
    <PanelShell
      open={open}
      onClose={onClose}
      title={t("security.setupAuthApp")}
      description={t("security.setupAuthAppHint")}
    >
      {recovery ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-emerald-700">
            2FA ist aktiv. Bewahre diese Wiederherstellungscodes sicher auf:
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-(--radius) border p-3 font-mono text-sm">
            {recovery.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button onClick={onClose}>Fertig</Button>
        </div>
      ) : enroll ? (
        <>
          {/* QR-Code (Data-URL aus dem Backend). <img> statt next/image, weil
              Data-URLs sich damit ohne Loader rendern lassen. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.qr_data_url}
            alt={t("security.qrAlt")}
            className="mx-auto size-44 rounded-(--radius) border bg-white p-2"
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              Oder manuell eingeben:
            </span>
            <code className="break-all rounded bg-secondary px-2 py-1 text-xs">
              {enroll.secret}
            </code>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">{t("security.sixDigitCode")}</Label>
            <Input
              id="code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={verify} disabled={busy || code.length < 6}>
            {busy ? "Prüfen…" : "Aktivieren"}
          </Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          {error ?? "Einrichtung wird vorbereitet …"}
        </p>
      )}
    </PanelShell>
  );
}

function TotpDisableSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCode("");
    setError(null);
  }, [open]);

  async function disable() {
    setBusy(true);
    setError(null);
    const res = await totpDisable(code);
    setBusy(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else setError(res.error);
  }

  return (
    <PanelShell
      open={open}
      onClose={onClose}
      title={t("security.disable2fa")}
      description={t("security.disable2faHint")}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dcode">Code</Label>
        <Input
          id="dcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        variant="outline"
        className="text-destructive"
        onClick={disable}
        disabled={busy || code.length < 6}
      >
        {busy ? "…" : t("security.disable2fa")}
      </Button>
    </PanelShell>
  );
}
