"use client";

// Konto → Umzug (eigener Tab): „Von Lodgify wechseln", in ZWEI Schritten:
//   1) Anmelden → alle Objekte werden aufgelistet.
//   2) Der Kunde HAKT die gewünschten Objekte an und importiert nur diese.
// Das Passwort wird nur für die einmalige Anmeldung genutzt und nicht gespeichert.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelLodgifyLogin,
  importSelectedLodgify,
  previewLodgify,
  submit2FACode,
  type ImportOutcome,
  type PreviewItem,
} from "@/lib/lodgify";

export function KontoUmzugSection() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState<PreviewItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  // 2FA: wenn Lodgify einen SMS-Code verlangt, halten wir die sessionId und
  // zeigen ein Code-Feld.
  const [twoFaSession, setTwoFaSession] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  function applyItems(data: PreviewItem[]) {
    setItems(data);
    setSelected(
      new Set(data.filter((i) => !i.alreadyImported).map((i) => i.lodgifyId)),
    );
    if (data.length === 0) toast.info("Keine Objekte in Lodgify gefunden.");
  }

  async function onPreview() {
    if (!email.trim() || !password) {
      toast.error("Lodgify-E-Mail und -Passwort eingeben.");
      return;
    }
    setLoadingPreview(true);
    setItems(null);
    setOutcome(null);
    setTwoFaSession(null);
    try {
      const res = await previewLodgify({ email, password });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPassword(""); // Passwort sofort aus dem State entfernen.
      if (res.data.kind === "needs_2fa") {
        // Lodgify verlangt SMS-Code → Code-Feld zeigen.
        setTwoFaSession(res.data.sessionId);
        toast.info("Lodgify hat dir einen Bestätigungscode per SMS geschickt.");
        return;
      }
      applyItems(res.data.items);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onSubmitCode() {
    if (!twoFaSession || !code.trim()) {
      toast.error("Bitte den Code aus der SMS eingeben.");
      return;
    }
    setVerifying(true);
    try {
      const res = await submit2FACode({ sessionId: twoFaSession, code });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setTwoFaSession(null);
      setCode("");
      applyItems(res.data);
    } finally {
      setVerifying(false);
    }
  }

  async function onCancel2fa() {
    if (twoFaSession) void cancelLodgifyLogin(twoFaSession);
    setTwoFaSession(null);
    setCode("");
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectableIds(): number[] {
    return (items ?? []).filter((i) => !i.alreadyImported).map((i) => i.lodgifyId);
  }
  const allSelected =
    selectableIds().length > 0 &&
    selectableIds().every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(selectableIds()));
  }

  async function onImport() {
    const chosen = (items ?? [])
      .filter((i) => selected.has(i.lodgifyId) && !i.alreadyImported)
      .map((i) => i.raw);
    if (chosen.length === 0) {
      toast.error("Wähle mindestens ein Objekt aus.");
      return;
    }
    setImporting(true);
    try {
      const res = await importSelectedLodgify(chosen);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOutcome(res.data);
      if (res.data.imported > 0) {
        toast.success(`${res.data.imported} Objekte importiert.`);
        // Importierte Objekte in der Liste als „bereits vorhanden" markieren.
        const importedNames = new Set(
          res.data.results.filter((r) => r.status === "imported").map((r) => r.name),
        );
        setItems((prev) =>
          (prev ?? []).map((i) =>
            importedNames.has(i.name) ? { ...i, alreadyImported: true } : i,
          ),
        );
        setSelected(new Set());
      }
      if (res.data.failed > 0) {
        toast.error(`${res.data.failed} Objekte konnten nicht importiert werden.`);
      }
    } finally {
      setImporting(false);
    }
  }

  const chosenCount = (items ?? []).filter(
    (i) => selected.has(i.lodgifyId) && !i.alreadyImported,
  ).length;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h2 className="font-display text-xl font-extrabold">Umzug von Lodgify</h2>
        <p className="text-sm text-muted-foreground">
          Melde dich mit deinen Lodgify-Zugangsdaten an — wir zeigen dir alle deine
          Objekte, und du wählst aus, welche du übernehmen möchtest. Dein Passwort
          wird nur für die einmalige Anmeldung genutzt und nicht gespeichert.
        </p>
      </div>

      {/* Schritt 1: Anmelden */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="lg-email">Lodgify-E-Mail</Label>
            <Input
              id="lg-email"
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loadingPreview || importing}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="lg-pw">Lodgify-Passwort</Label>
            <Input
              id="lg-pw"
              type="password"
              autoComplete="off"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onPreview();
              }}
              disabled={loadingPreview || importing}
            />
          </div>
        </div>
        <Button
          onClick={onPreview}
          disabled={loadingPreview || importing}
          className="self-start"
        >
          {loadingPreview ? (
            <span className="flex items-center gap-2">
              <Icon icon="svg-spinners:180-ring" className="size-4" />
              Objekte werden geladen …
            </span>
          ) : items ? (
            "Erneut laden"
          ) : (
            "Objekte anzeigen"
          )}
        </Button>
        {loadingPreview && (
          <p className="text-xs text-muted-foreground">
            Das kann eine Minute dauern — wir melden uns bei Lodgify an und lesen
            deine Objekte aus.
          </p>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Icon icon="ph:shield-check" className="mt-0.5 size-3.5 shrink-0" />
          Nutzt du „mit Google/Apple anmelden" bei Lodgify? Dann hast du kein
          Passwort — dieser Import funktioniert nur mit E-Mail-Login.
        </p>
      </div>

      {/* Schritt 1b: 2FA/SMS-Code (nur wenn Lodgify ihn verlangt) */}
      {twoFaSession && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-card p-5">
          <div className="flex items-center gap-2 font-semibold">
            <Icon icon="ph:device-mobile" className="size-5 text-primary" />
            Bestätigungscode eingeben
          </div>
          <p className="text-sm text-muted-foreground">
            Lodgify hat dir einen Code per SMS geschickt. Gib ihn hier ein, um die
            Anmeldung abzuschließen.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="lg-2fa">SMS-Code</Label>
              <Input
                id="lg-2fa"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="z. B. 123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onSubmitCode();
                }}
                disabled={verifying}
              />
            </div>
            <Button onClick={onSubmitCode} disabled={verifying} className="shrink-0">
              {verifying ? (
                <span className="flex items-center gap-2">
                  <Icon icon="svg-spinners:180-ring" className="size-4" />
                  Prüfe …
                </span>
              ) : (
                "Code bestätigen"
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={onCancel2fa}
              disabled={verifying}
              className="shrink-0"
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Schritt 2: Auswählen + importieren */}
      {items && items.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="size-4 rounded border-border"
                disabled={importing || selectableIds().length === 0}
              />
              Alle auswählen
            </label>
            <Button onClick={onImport} disabled={importing || chosenCount === 0}>
              {importing ? (
                <span className="flex items-center gap-2">
                  <Icon icon="svg-spinners:180-ring" className="size-4" />
                  Importiere …
                </span>
              ) : (
                `${chosenCount} Objekte importieren`
              )}
            </Button>
          </div>

          <ul className="flex flex-col divide-y divide-border">
            {items.map((it) => (
              <li key={it.lodgifyId} className="flex items-center gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(it.lodgifyId) && !it.alreadyImported}
                  onChange={() => toggle(it.lodgifyId)}
                  disabled={it.alreadyImported || importing}
                  className="size-4 shrink-0 rounded border-border"
                />
                {it.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.imageUrl}
                    alt=""
                    className="size-11 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon icon="ph:house" className="size-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{it.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[
                      it.areaSqm ? `${it.areaSqm} m²` : null,
                      it.maxGuests ? `${it.maxGuests} Gäste` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {it.alreadyImported && (
                  <span className="shrink-0 text-xs text-emerald-600">
                    ✓ bereits importiert
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ergebnis des letzten Imports */}
      {outcome && outcome.results.some((r) => r.status === "error") && (
        <div className="flex flex-col gap-1 rounded-2xl border border-destructive/30 bg-card p-5 text-sm">
          <div className="font-semibold text-destructive">
            {outcome.failed} Objekte mit Fehler:
          </div>
          <ul className="list-disc pl-5 text-muted-foreground">
            {outcome.results
              .filter((r) => r.status === "error")
              .map((r, i) => (
                <li key={i}>
                  {r.name} — {r.error}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
