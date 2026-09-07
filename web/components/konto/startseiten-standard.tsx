"use client";

// Konto → Benutzer: Startseiten-Standard je Rolle (Lastenheft §2.1, 0402).
//
// Minimal-UI: Rolle wählen, sehen, ob ein Standard gesetzt ist, und „Mein
// aktuelles Layout als Standard für diese Rolle speichern" bzw. „Standard
// entfernen". Neue Nutzer der Rolle erben den Standard, und „Zurücksetzen" auf
// der Startseite fällt darauf zurück. Der Server verlangt MANAGE_TENANT — die
// Seite blendet den Abschnitt für andere aus, geschützt ist er dort (Wurzel 3).
//
// „Aktuelles Layout" = das wirksame Layout des ADMINS (GET /dashboard-layout).
// Enthält es Kacheln, die die Zielrolle nicht sehen darf (Umsatz für cleaner),
// filtert die Normalisierung sie beim Rendern für diese Rolle heraus — der
// Standard bleibt trotzdem vollständig gespeichert, falls die Rolle das Recht
// später bekommt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { UserRole } from "@/lib/account";
import { KACHEL_IDS } from "@/lib/dashboard-katalog";
import {
  anordnungAusLayout,
  layoutAusAnordnung,
} from "@/lib/dashboard-layout-normalisierung";
import {
  type RollenStandardAntwort,
  deleteRollenStandard,
  getDashboardLayout,
  getRollenStandard,
  putRollenStandard,
} from "@/lib/dashboard-layout";

// Alle Rollen der DB (RollenName im Backend). Admin steht bewusst dabei: auch
// ein zweiter Admin erbt einen Standard, wenn er noch kein eigenes Layout hat.
const ROLLEN: UserRole[] = ["admin", "co_admin", "shift_lead", "owner", "staff", "cleaner"];

export function StartseitenStandard() {
  const t = useTranslations("dashboard.kacheln");
  const tRollen = useTranslations("account.roles");
  const [rolle, setRolle] = useState<UserRole>("staff");
  const [stand, setStand] = useState<RollenStandardAntwort | null>(null);
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [laedt, laden] = useTransition();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    laden(async () => {
      const res = await getRollenStandard(rolle);
      if (res.ok) {
        setStand(res.data);
        setLadefehler(null);
      } else {
        setStand(null);
        setLadefehler(res.error);
        console.error("[dashboard-layout] Rollen-Standard laden fehlgeschlagen", {
          rolle,
          fehler: res.error,
          status: res.status,
        });
      }
    });
  }, [rolle]);

  async function alsStandardSpeichern() {
    setBusy(true);
    const eigen = await getDashboardLayout();
    if (!eigen.ok) {
      setBusy(false);
      toast.error(t("speicherfehler", { fehler: eigen.error }));
      return;
    }
    // Das wirksame Layout des Admins, über ALLE Katalog-Kacheln normalisiert
    // (der Admin darf alles sehen) — bei `null` der Katalog-Standard.
    const layout = layoutAusAnordnung(anordnungAusLayout(eigen.data.layout, KACHEL_IDS));
    const res = await putRollenStandard(rolle, layout);
    setBusy(false);
    if (res.ok) {
      setStand(res.data);
      toast.success(t("rollenStandardGespeichert", { rolle: tRollen(rolle) }));
    } else {
      console.error("[dashboard-layout] Rollen-Standard setzen fehlgeschlagen", {
        rolle,
        fehler: res.error,
        status: res.status,
        requestId: res.requestId,
      });
      toast.error(t("speicherfehler", { fehler: res.error }));
    }
  }

  async function entfernen() {
    setBusy(true);
    const res = await deleteRollenStandard(rolle);
    setBusy(false);
    if (res.ok) {
      setStand(res.data);
      toast.success(t("rollenStandardEntfernt", { rolle: tRollen(rolle) }));
    } else {
      console.error("[dashboard-layout] Rollen-Standard entfernen fehlgeschlagen", {
        rolle,
        fehler: res.error,
        status: res.status,
        requestId: res.requestId,
      });
      toast.error(t("speicherfehler", { fehler: res.error }));
    }
  }

  const gesetzt = stand?.layout ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <Icon icon="ph:squares-four" className="mt-0.5 size-5 text-muted-foreground" />
        <div>
          <h3 className="font-display text-lg font-extrabold">{t("rollenStandardTitel")}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">{t("rollenStandardIntro")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <Label htmlFor="startseiten-standard-rolle">{t("rollenStandardRolle")}</Label>
        <NativeSelect
          id="startseiten-standard-rolle"
          value={rolle}
          onChange={(e) => setRolle(e.target.value as UserRole)}
          disabled={busy}
        >
          {ROLLEN.map((r) => (
            <option key={r} value={r}>
              {tRollen(r)}
            </option>
          ))}
        </NativeSelect>
      </div>

      <p className="text-sm">
        {laedt ? (
          <span className="text-muted-foreground">{t("rollenStandardLaedt")}</span>
        ) : ladefehler ? (
          <span className="text-destructive">{t("ladefehler", { fehler: ladefehler })}</span>
        ) : gesetzt ? (
          t("rollenStandardGesetzt", {
            rolle: tRollen(rolle),
            kacheln: gesetzt.kacheln.length,
            ausgeblendet: gesetzt.ausgeblendet.length,
          })
        ) : (
          <span className="text-muted-foreground">
            {t("rollenStandardKeiner", { rolle: tRollen(rolle) })}
          </span>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={alsStandardSpeichern} disabled={busy || laedt}>
          <Icon icon={busy ? "ph:circle-notch" : "ph:floppy-disk"} className={`size-4 ${busy ? "animate-spin" : ""}`} />
          {t("rollenStandardSpeichern", { rolle: tRollen(rolle) })}
        </Button>
        {gesetzt && (
          <Button variant="outline" onClick={entfernen} disabled={busy || laedt}>
            <Icon icon="ph:trash" className="size-4" />
            {t("rollenStandardEntfernen")}
          </Button>
        )}
      </div>
    </section>
  );
}
