"use client";

// Konto → Sicherheit, ANGEBUNDEN an den FastAPI-auth-Slice:
// echte Konto-Daten, E-Mail/Name/Passwort ändern und die Zwei-Faktor-
// Authentifizierung (Authenticator-App, SMS, Passkey, Wiederherstellungscodes).
// Die 2FA-Verwaltung liegt in components/konto/zwei-faktor-section.tsx.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

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
import { ZweiFaktorSection } from "@/components/konto/zwei-faktor-section";
import {
  type Account,
  getAccount,
  updateEmail,
  updateName,
  updatePassword,
} from "@/lib/account";
import { type MfaStatus, getMfaStatus } from "@/lib/mfa";

type Panel = null | "email" | "name" | "password";

export default function SicherheitPage() {
  const t = useTranslations("account");
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);

  // Ladefehler wird ANGEZEIGT statt verschluckt: eine leere Seite sähe aus wie
  // „kein Faktor eingerichtet" und wäre eine Falschaussage (Wurzel 4/5).
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  // 2FA-Zustand kommt AUSSCHLIESSLICH aus /auth/mfa/status (GoTrue ist die
  // Quelle der Wahrheit) — nie aus dem Konto-Objekt abgeleitet.
  const [mfa, setMfa] = useState<MfaStatus | null>(null);

  const reload = useCallback(async () => {
    const [res, mfaRes] = await Promise.all([getAccount(), getMfaStatus()]);
    if (res.ok) {
      setAccount(res.data);
      setLadefehler(null);
    } else {
      setLadefehler(res.error);
    }
    if (mfaRes.ok) setMfa(mfaRes.data);
    else setMfa(null);
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="flex flex-col gap-10">
      <h2 className="font-display text-2xl font-extrabold">{t("security.title")}</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("security.loading")}</p>
      ) : !account ? (
        <Card className="p-5 text-sm text-destructive" role="alert">
          {ladefehler ?? t("security.loadFailed")}
        </Card>
      ) : (
        <>
          {/* Berechtigungsnachweise */}
          <section className="flex flex-col gap-3">
            <h3 className="font-display text-lg font-extrabold">
              {t("security.credentials")}
            </h3>

            <Card className="flex flex-row items-start justify-between p-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold">
                  {t("security.emailAndUsername")}
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
                <span className="text-sm font-semibold">
                  {t("security.password")}
                </span>
                <span className="text-sm text-muted-foreground">
                  {account.has_password ? "••••••••" : t("security.noPassword")}
                </span>
              </div>
              <EditButton
                label={t("security.editPassword")}
                onClick={() => setPanel("password")}
              />
            </Card>
          </section>

          {/* Zwei-Faktor-Authentifizierung (alle vier Faktoren).
              Ohne Status wird NICHTS behauptet — eine leere Faktorliste sähe
              aus wie „nichts eingerichtet" und wäre eine Falschaussage. */}
          {mfa ? (
            <ZweiFaktorSection
              status={mfa}
              hatPasswort={account.has_password}
              onGeaendert={reload}
            />
          ) : (
            <Card className="p-5 text-sm text-destructive" role="alert">
              {t("security.twoFactor.statusFailed")}
            </Card>
          )}
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
        <Label htmlFor="name">{t("security.nameLabel")}</Label>
        <Input id="name" value={value} onChange={(e) => setValue(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={busy || !value.trim()}>
        {busy ? t("security.saving") : t("security.save")}
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
        <Label htmlFor="email">{t("security.emailLabel")}</Label>
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
        {busy ? t("security.saving") : t("security.save")}
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
          {t("security.passwordMin")}
        </span>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={save} disabled={busy || newPw.length < 8}>
        {busy ? t("security.saving") : t("security.changePassword")}
      </Button>
    </PanelShell>
  );
}
