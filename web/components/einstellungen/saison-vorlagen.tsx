"use client";

// Saison-Vorlagen (ADR-0024, 0584): tenant-weit gepflegte Sätze aus Kategorien
// (Hochsaison +30 %, Nebensaison −10 % …) und Zeiträumen, die sich per
// Checkbox auf beliebig viele Objekte anwenden lassen. Anwenden erzeugt am
// Objekt eigenständige Saisons (Kopie, keine Verknüpfung) — gleicher Name am
// Objekt wird aktualisiert, nie dupliziert.
//
// Beträge stehen hier OHNE Währung: eine Vorlage gilt für Objekte mit
// verschiedenen Währungen; ein Fixpreis wird am Objekt in DESSEN Währung
// materialisiert (Wurzel 4 — kein erfundenes Symbol).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  ObjektMehrfachauswahl,
  type ObjektAuswahlEintrag,
} from "@/components/objekt-mehrfachauswahl";
import {
  type SeasonMode,
  type SeasonTemplate,
  type SeasonTemplateInput,
  type SeasonTemplateKategorie,
  type SeasonTemplateZeitraum,
  applySeasonTemplate,
  createSeasonTemplate,
  deleteSeasonTemplate,
  listSeasonTemplates,
  updateSeasonTemplate,
} from "@/lib/calendar";
import { useRealtime } from "@/lib/use-realtime";

// Pastell-Vorschläge für Kategorien; frei wählbar über das Farbfeld.
const KATEGORIE_FARBEN = [
  "#fca5a5", "#fdba74", "#fde68a", "#86efac",
  "#67e8f9", "#93c5fd", "#c4b5fd", "#f9a8d4",
];

export function SaisonVorlagen({
  initial,
  objekte,
}: {
  initial: SeasonTemplate[];
  /** Alle Objekte des Betriebs — für die Anwenden-Auswahl. */
  objekte: ObjektAuswahlEintrag[];
}) {
  const t = useTranslations("kalender.vorlagen");
  const [vorlagen, setVorlagen] = useState<SeasonTemplate[]>(initial);
  // null = zu; "neu" = anlegen; sonst die ID der bearbeiteten Vorlage.
  const [editor, setEditor] = useState<string | null>(null);
  const [anwendenId, setAnwendenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listSeasonTemplates();
    if (res.ok) setVorlagen(res.data.items);
    else toast.error(res.error);
  }, []);
  useRealtime({ table: "season_templates", onChange: () => void load() });

  const bearbeitet = vorlagen.find((v) => v.id === editor) ?? null;
  const anwenden = vorlagen.find((v) => v.id === anwendenId) ?? null;

  async function loeschen(v: SeasonTemplate) {
    if (!window.confirm(t("loeschenBestaetigen", { name: v.name }))) return;
    const res = await deleteSeasonTemplate(v.id);
    if (res.ok) {
      toast.success(t("geloescht"));
      void load();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("titel")}</h1>
          <p className="text-sm text-muted-foreground">{t("untertitel")}</p>
        </div>
        <Button className="shrink-0 gap-2" onClick={() => setEditor("neu")}>
          <Icon icon="ph:plus" className="size-4" />
          {t("neu")}
        </Button>
      </div>

      {vorlagen.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{t("leer")}</Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {vorlagen.map((v) => (
            <li key={v.id}>
              <Card className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-3.5 shrink-0 rounded-full ring-1 ring-border"
                    style={{ backgroundColor: v.farbe ?? "transparent" }}
                  />
                  <h2 className="flex-1 truncate font-display text-lg font-bold">{v.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {t("zeitraeumeAnzahl", { count: v.zeitraeume.length })}
                  </span>
                </div>
                {v.kategorien.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("keineKategorien")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {v.kategorien.map((k, i) => (
                      <li
                        key={`${k.name}-${i}`}
                        className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs"
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: k.color }}
                        />
                        <span className="font-medium">{k.name}</span>
                        <span className="text-muted-foreground">{kategorieLabel(k, t)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-auto flex flex-wrap justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditor(v.id)}>
                    {t("bearbeiten")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => void loeschen(v)}
                  >
                    {t("loeschen")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={v.kategorien.length === 0}
                    onClick={() => setAnwendenId(v.id)}
                  >
                    {t("anwenden")}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {editor !== null && (
        <VorlageDialog
          vorlage={bearbeitet}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            void load();
          }}
        />
      )}
      {anwenden && (
        <AnwendenDialog
          vorlage={anwenden}
          objekte={objekte}
          onClose={() => setAnwendenId(null)}
        />
      )}
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function kategorieLabel(k: SeasonTemplateKategorie, t: T): string {
  if (k.mode === "fixed") return t("fixpreisKurz", { amount: k.amount });
  return `${k.amount >= 0 ? "+" : ""}${k.amount} %`;
}

type KategorieForm = { name: string; mode: SeasonMode; amount: string; color: string };
type ZeitraumForm = { kategorie_index: number; start: string; end: string };

function VorlageDialog({
  vorlage,
  onClose,
  onSaved,
}: {
  /** null = neue Vorlage. */
  vorlage: SeasonTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("kalender.vorlagen");
  const [name, setName] = useState(vorlage?.name ?? "");
  const [farbe, setFarbe] = useState(vorlage?.farbe ?? KATEGORIE_FARBEN[5]);
  const [kategorien, setKategorien] = useState<KategorieForm[]>(
    vorlage
      ? vorlage.kategorien.map((k) => ({
          name: k.name, mode: k.mode, amount: String(k.amount), color: k.color,
        }))
      : [{ name: "", mode: "percent", amount: "", color: KATEGORIE_FARBEN[0] }],
  );
  const [zeitraeume, setZeitraeume] = useState<ZeitraumForm[]>(
    vorlage
      ? vorlage.zeitraeume.map((z) => ({
          kategorie_index: z.kategorie_index, start: z.start_date, end: z.end_date,
        }))
      : [],
  );
  const [saving, setSaving] = useState(false);

  function kategorieSetzen(i: number, patch: Partial<KategorieForm>) {
    setKategorien((prev) => prev.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));
  }
  function kategorieEntfernen(i: number) {
    setKategorien((prev) => prev.filter((_, idx) => idx !== i));
    // Zeiträume der entfernten Kategorie fallen weg, spätere rücken auf —
    // sonst zeigten sie auf die falsche Kategorie.
    setZeitraeume((prev) =>
      prev
        .filter((z) => z.kategorie_index !== i)
        .map((z) => (z.kategorie_index > i ? { ...z, kategorie_index: z.kategorie_index - 1 } : z)),
    );
  }
  function zeitraumSetzen(i: number, patch: Partial<ZeitraumForm>) {
    setZeitraeume((prev) => prev.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));
  }

  async function submit() {
    if (!name.trim()) {
      toast.error(t("nameFehlt"));
      return;
    }
    const kats: SeasonTemplateKategorie[] = [];
    for (const k of kategorien) {
      const amount = Number(k.amount);
      if (!k.name.trim() || k.amount === "" || Number.isNaN(amount)) {
        toast.error(t("kategorieUnvollstaendig"));
        return;
      }
      if (k.mode === "fixed" && amount < 0) {
        toast.error(t("kategorieUnvollstaendig"));
        return;
      }
      // Regelsatz-Felder (min_stay …) werden von dieser Maske nicht gesetzt
      // und bleiben beim Bearbeiten erhalten, wie die Vorlage sie trägt.
      const alt = vorlage?.kategorien.find((x) => x.name === k.name.trim());
      kats.push({
        ...(alt ?? {}),
        name: k.name.trim(), mode: k.mode, amount, color: k.color,
      });
    }
    const namen = kats.map((k) => k.name);
    if (new Set(namen).size !== namen.length) {
      toast.error(t("kategorieNamenDoppelt"));
      return;
    }
    const zr: SeasonTemplateZeitraum[] = [];
    for (const z of zeitraeume) {
      if (!z.start || !z.end || z.end < z.start || z.kategorie_index >= kats.length) {
        toast.error(t("zeitraumUngueltig"));
        return;
      }
      zr.push({ kategorie_index: z.kategorie_index, start_date: z.start, end_date: z.end });
    }
    const input: SeasonTemplateInput = {
      name: name.trim(), farbe, kategorien: kats, zeitraeume: zr,
    };
    setSaving(true);
    const res = vorlage
      ? await updateSeasonTemplate(vorlage.id, input)
      : await createSeasonTemplate(input);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(vorlage ? t("gespeichert") : t("angelegt"));
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <DialogTitle>{vorlage ? t("dialogBearbeiten") : t("dialogNeu")}</DialogTitle>
            <DialogDescription>{t("dialogHinweis")}</DialogDescription>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vorlage-name">{t("name")}</Label>
              <Input
                id="vorlage-name"
                value={name}
                placeholder={t("namePlatzhalter")}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vorlage-farbe">{t("farbe")}</Label>
              <input
                id="vorlage-farbe"
                type="color"
                value={farbe}
                onChange={(e) => setFarbe(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
              />
            </div>
          </div>

          {/* Kategorien */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("kategorien")}</Label>
              <button
                type="button"
                className="text-xs font-medium underline-offset-4 hover:underline"
                onClick={() =>
                  setKategorien((prev) => [
                    ...prev,
                    {
                      name: "", mode: "percent", amount: "",
                      color: KATEGORIE_FARBEN[prev.length % KATEGORIE_FARBEN.length],
                    },
                  ])
                }
              >
                {t("kategorieHinzufuegen")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("kategorienHinweis")}</p>
            <ul className="flex flex-col gap-2">
              {kategorien.map((k, i) => (
                <li key={i} className="grid items-center gap-2 sm:grid-cols-[auto_1fr_auto_6rem_auto]">
                  <input
                    type="color"
                    aria-label={t("farbe")}
                    value={k.color}
                    onChange={(e) => kategorieSetzen(i, { color: e.target.value })}
                    className="size-8 cursor-pointer rounded-full border border-border bg-transparent p-0.5"
                  />
                  <Input
                    aria-label={t("kategorieName")}
                    placeholder={t("kategorieNamePlatzhalter")}
                    value={k.name}
                    onChange={(e) => kategorieSetzen(i, { name: e.target.value })}
                  />
                  <div className="flex gap-0.5 rounded-full border border-border p-0.5">
                    {(["percent", "fixed"] as SeasonMode[]).map((mo) => (
                      <button
                        key={mo}
                        type="button"
                        onClick={() => kategorieSetzen(i, { mode: mo })}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          k.mode === mo
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {mo === "percent" ? t("modusProzent") : t("modusFix")}
                      </button>
                    ))}
                  </div>
                  <Input
                    type="number"
                    aria-label={k.mode === "percent" ? t("modusProzent") : t("modusFix")}
                    placeholder={k.mode === "percent" ? "+30" : "240"}
                    value={k.amount}
                    onChange={(e) => kategorieSetzen(i, { amount: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={t("kategorieEntfernen")}
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() => kategorieEntfernen(i)}
                  >
                    <Icon icon="ph:x" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Zeiträume */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("zeitraeume")}</Label>
              <button
                type="button"
                className="text-xs font-medium underline-offset-4 hover:underline disabled:opacity-50"
                disabled={kategorien.length === 0}
                onClick={() =>
                  setZeitraeume((prev) => [...prev, { kategorie_index: 0, start: "", end: "" }])
                }
              >
                {t("zeitraumHinzufuegen")}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{t("zeitraeumeHinweis")}</p>
            {zeitraeume.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("zeitraeumeLeer")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {zeitraeume.map((z, i) => (
                  <li key={i} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <NativeSelect
                      aria-label={t("kategorieName")}
                      value={String(z.kategorie_index)}
                      onChange={(e) =>
                        zeitraumSetzen(i, { kategorie_index: Number(e.target.value) })
                      }
                    >
                      {kategorien.map((k, ki) => (
                        <option key={ki} value={ki}>
                          {k.name || t("kategorieOhneName", { index: ki + 1 })}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input
                      type="date"
                      aria-label={t("von")}
                      value={z.start}
                      onChange={(e) => zeitraumSetzen(i, { start: e.target.value })}
                    />
                    <Input
                      type="date"
                      aria-label={t("bis")}
                      value={z.end}
                      min={z.start || undefined}
                      onChange={(e) => zeitraumSetzen(i, { end: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={t("zeitraumEntfernen")}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      onClick={() => setZeitraeume((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Icon icon="ph:x" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {t("abbrechen")}
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? t("speichert") : t("speichern")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AnwendenDialog({
  vorlage,
  objekte,
  onClose,
}: {
  vorlage: SeasonTemplate;
  objekte: ObjektAuswahlEintrag[];
  onClose: () => void;
}) {
  const t = useTranslations("kalender.vorlagen");
  const [ziele, setZiele] = useState<string[]>([]);
  const [suche, setSuche] = useState("");
  const [mitZeitraeumen, setMitZeitraeumen] = useState(vorlage.zeitraeume.length > 0);
  const [saving, setSaving] = useState(false);
  // Ohne Zeiträume gibt es nur „Kategorien anwenden" — der Server weist
  // „mit Zeiträumen" ohne Zeiträume mit 422 ab.
  const ohneZeitraeume = vorlage.zeitraeume.length === 0;

  // Grund-Slug des Servers → Übersetzungsschlüssel. Ein UNBEKANNTER Slug
  // (neuer Backend-Grund) fällt auf den generischen Text, statt next-intl mit
  // MISSING_MESSAGE die Seite zerlegen zu lassen. Flache Schlüssel, weil die
  // Sprachdateien flach gepflegt werden.
  const grundSchluessel: Record<string, string> = {
    kein_basispreis: "grundKeinBasispreis",
    basispreis_null: "grundBasispreisNull",
    teilweise_uebertragen: "grundTeilweiseUebertragen",
  };
  function grundText(grund: string): string {
    return t(grundSchluessel[grund] ?? "grundUnbekannt");
  }
  function objektName(id: string): string {
    return objekte.find((o) => o.id === id)?.title ?? id;
  }

  async function submit() {
    if (ziele.length === 0) {
      toast.error(t("anwendenZielFehlt"));
      return;
    }
    setSaving(true);
    const res = await applySeasonTemplate(
      vorlage.id, ziele, ohneZeitraeume ? false : mitZeitraeumen,
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { uebertragen, uebersprungen } = res.data;
    const details = uebersprungen
      .map((u) => `${objektName(u.property_id)} · ${u.kategorie}: ${grundText(u.grund)}`)
      .join("\n");
    if (uebertragen === 0) {
      toast.error(t("anwendenKeins"), { description: details || undefined });
      return;
    }
    if (uebersprungen.length > 0) {
      toast.warning(
        t("anwendenTeilweise", { count: uebertragen, skipped: uebersprungen.length }),
        { description: details },
      );
    } else {
      toast.success(t("anwendenErfolg", { count: uebertragen }));
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <DialogTitle>{t("anwendenTitel", { name: vorlage.name })}</DialogTitle>
            <DialogDescription>{t("anwendenHinweis")}</DialogDescription>
          </div>
          <ObjektMehrfachauswahl
            objekte={objekte}
            selected={ziele}
            onChange={setZiele}
            suche={suche}
            onSucheChange={setSuche}
            emptyText={t("keineObjekte")}
          />
          {ohneZeitraeume ? (
            <p className="text-sm text-muted-foreground">{t("anwendenOhneZeitraeume")}</p>
          ) : (
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Checkbox
                checked={mitZeitraeumen}
                onCheckedChange={(v) => setMitZeitraeumen(v === true)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{t("zeitraeumeMitnehmen")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("zeitraeumeMitnehmenHinweis")}
                </span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {t("abbrechen")}
            </Button>
            <Button onClick={submit} disabled={saving || ziele.length === 0}>
              {saving ? t("speichert") : t("anwenden")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
