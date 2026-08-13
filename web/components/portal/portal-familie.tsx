"use client";

// Eigentümer-Portal · Familienzugänge verwalten (0389).
//
// Der Eigentümer lädt Angehörige und Freunde mit EIGENEM Login ein, statt sein
// Passwort zu teilen. Je Person und Objekt entscheidet er, was sie darf.
//
// Die Stufe „mit Berichten" ist bewusst NICHT vorbelegt: Umsatz, Abrechnung
// und Auszahlung sind Geschäftsdaten des Eigentümers, keine
// Familienangelegenheit. Ein Häkchen, das man bewusst setzt, ist der einzige
// Weg, auf dem er das wirklich entscheidet — vorbelegt wäre es eine
// Entscheidung, die niemand getroffen hat (Art. 25 Abs. 2 DSGVO).
//
// KEIN Realtime: `owner_family_members` hat kein SELECT-Grant für
// `authenticated` (0389), ein Abo wäre eine stumme Attrappe. Die Fläche
// schreibt die Server-Antwort direkt in ihren Zustand.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card, CardContent } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { PortalProperty } from "@/lib/portal";
import {
  type FamilienStufe,
  type FamilienZugang,
  aendereFamilienStufe,
  entferneFamilienzugang,
  ladeFamilienmitgliedEin,
} from "@/lib/portal-familie";

export function PortalFamilie({
  zugaenge,
  properties,
  error,
}: {
  zugaenge: FamilienZugang[];
  properties: PortalProperty[];
  error: string | null;
}) {
  const t = useTranslations("portal");
  const [liste, setListe] = useState<FamilienZugang[]>(zugaenge);
  const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [berichte, setBerichte] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [laeuft, setLaeuft] = useState<string | null>(null);

  const objektTitel = (id: string) =>
    properties.find((p) => p.id === id)?.title ?? "";

  async function einladen() {
    if (sendet) return;
    if (!propertyId || !name.trim() || !email.trim()) {
      toast.error(t("family.invite.incomplete"));
      return;
    }
    setSendet(true);
    const res = await ladeFamilienmitgliedEin({
      property_id: propertyId,
      email: email.trim(),
      full_name: name.trim(),
      access: berichte ? "nutzung_berichte" : "nutzung",
    });
    setSendet(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Ehrliche Rückmeldung (Wurzel 4): Gab es den Login schon, ging KEINE Mail
    // raus — dann darf hier nicht „Einladung verschickt" stehen.
    toast.success(
      res.data.einladung_versendet
        ? t("family.invite.sent")
        : t("family.invite.linked"),
    );
    setName("");
    setEmail("");
    setBerichte(false);
    setListe((alt) => [res.data.zugang, ...alt]);
  }

  async function stufeUmschalten(zugang: FamilienZugang) {
    if (laeuft) return;
    const neu: FamilienStufe =
      zugang.access === "nutzung_berichte" ? "nutzung" : "nutzung_berichte";
    setLaeuft(zugang.id);
    const res = await aendereFamilienStufe(zugang.id, neu);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setListe((alt) =>
      alt.map((z) => (z.id === zugang.id ? { ...z, access: neu } : z)),
    );
  }

  async function entfernen(zugang: FamilienZugang) {
    if (laeuft) return;
    setLaeuft(zugang.id);
    const res = await entferneFamilienzugang(zugang.id);
    setLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("family.removed"));
    setListe((alt) => alt.filter((z) => z.id !== zugang.id));
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-extrabold">
          {t("family.title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("family.hint")}</p>
      </header>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="familie-objekt">{t("family.invite.property")}</Label>
              <NativeSelect
                id="familie-objekt"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                disabled={sendet}
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="familie-name">{t("family.invite.name")}</Label>
              <Input
                id="familie-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={sendet}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="familie-email">{t("family.invite.email")}</Label>
              <Input
                id="familie-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sendet}
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4">
            <input
              type="checkbox"
              checked={berichte}
              onChange={(e) => setBerichte(e.target.checked)}
              disabled={sendet}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold">
                {t("family.invite.reportsLabel")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("family.invite.reportsHint")}
              </span>
            </span>
          </label>

          <div className="flex justify-end">
            <Button onClick={() => void einladen()} disabled={sendet}>
              {sendet ? t("family.invite.sending") : t("family.invite.submit")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {liste.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("family.empty")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {liste.map((z) => (
            <Card key={z.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{z.full_name || z.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {objektTitel(z.property_id)}
                    {z.access === "nutzung_berichte"
                      ? ` · ${t("family.level.reports")}`
                      : ` · ${t("family.level.use")}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => void stufeUmschalten(z)}
                    disabled={laeuft === z.id}
                  >
                    {z.access === "nutzung_berichte"
                      ? t("family.level.revokeReports")
                      : t("family.level.grantReports")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => void entfernen(z)}
                    disabled={laeuft === z.id}
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="size-4" />
                    {t("family.remove")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
