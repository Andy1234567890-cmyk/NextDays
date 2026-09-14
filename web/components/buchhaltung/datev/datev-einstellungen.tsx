"use client";

// DATEV-Einstellungen (Buchhaltung → DATEV): Beraternummer, Mandant,
// Kontenrahmen, Sachkontenlänge, WJ-Beginn, Standardkonten, Personenkonten-
// Schema, BU-Schlüssel je Steuersatz, Festschreibung. Kein Feld ist
// vorbelegt (Wurzel 4) — was fehlt, zeigt die Liste `fehlendeFelder` des
// Backends, und der Export verweigert mit 422, bis alles steht.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";
import { saveDatevSettings } from "@/lib/buchhaltung-datev";
import type {
  DatevSettings,
  DatevSettingsInput,
  Kontenrahmen,
} from "@/lib/buchhaltung-datev-typen";

type BuZeile = { satz: string; bu: string };

function mapZuZeilen(map: Record<string, string> | null): BuZeile[] {
  if (!map) return [];
  return Object.entries(map)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([satz, bu]) => ({ satz, bu }));
}

function zeilenZuMap(zeilen: BuZeile[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const z of zeilen) {
    const satz = z.satz.trim().replace(",", ".");
    if (satz !== "") map[satz] = z.bu.trim();
  }
  return map;
}

const FELD_KEYS: Record<string, string> = {
  berater_nummer: "beraterNummer",
  mandanten_nummer: "mandantenNummer",
  kontenrahmen: "kontenrahmen",
  sachkontenlaenge: "sachkontenlaenge",
  wirtschaftsjahr_beginn_monat: "wirtschaftsjahrBeginnMonat",
  standard_erloeskonto: "standardErloeskonto",
  standard_aufwandskonto: "standardAufwandskonto",
  standard_finanzkonto: "standardFinanzkonto",
  debitor_konto_start: "debitorKontoStart",
  kreditor_konto_start: "kreditorKontoStart",
  bu_schluessel_erloes: "buSchluesselErloes",
  bu_schluessel_aufwand: "buSchluesselAufwand",
  festschreibung: "festschreibung",
};

export function feldLabel(t: ReturnType<typeof useTranslations>, feld: string): string {
  const key = FELD_KEYS[feld];
  return key ? t(`datevPage.feld.${key}`) : feld;
}

export function DatevEinstellungen({ settings }: { settings: DatevSettings }) {
  const t = useTranslations("finance");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(!settings.configured);

  const [beraterNummer, setBeraterNummer] = useState(settings.beraterNummer?.toString() ?? "");
  const [mandantenNummer, setMandantenNummer] = useState(settings.mandantenNummer?.toString() ?? "");
  const [kontenrahmen, setKontenrahmen] = useState<Kontenrahmen | "">(settings.kontenrahmen ?? "");
  const [sachkontenlaenge, setSachkontenlaenge] = useState(settings.sachkontenlaenge?.toString() ?? "");
  const [wjMonat, setWjMonat] = useState(settings.wirtschaftsjahrBeginnMonat?.toString() ?? "");
  const [erloes, setErloes] = useState(settings.standardErloeskonto ?? "");
  const [aufwand, setAufwand] = useState(settings.standardAufwandskonto ?? "");
  const [finanz, setFinanz] = useState(settings.standardFinanzkonto ?? "");
  const [debitorStart, setDebitorStart] = useState(settings.debitorKontoStart?.toString() ?? "");
  const [kreditorStart, setKreditorStart] = useState(settings.kreditorKontoStart?.toString() ?? "");
  const [buErloes, setBuErloes] = useState<BuZeile[]>(mapZuZeilen(settings.buSchluesselErloes));
  const [buAufwand, setBuAufwand] = useState<BuZeile[]>(mapZuZeilen(settings.buSchluesselAufwand));
  const [festschreibung, setFestschreibung] = useState(settings.festschreibung ?? false);

  const monate = Array.from({ length: 12 }, (_, i) => i + 1);

  async function speichern() {
    setFehler(null);
    const pflicht = [beraterNummer, mandantenNummer, kontenrahmen, sachkontenlaenge, wjMonat,
      erloes, aufwand, finanz, debitorStart, kreditorStart];
    if (pflicht.some((v) => v === "") || buErloes.length === 0 || buAufwand.length === 0) {
      setFehler(t("datevPage.settings.errorMissing"));
      return;
    }
    const input: DatevSettingsInput = {
      beraterNummer: Number(beraterNummer),
      mandantenNummer: Number(mandantenNummer),
      kontenrahmen: kontenrahmen as Kontenrahmen,
      sachkontenlaenge: Number(sachkontenlaenge),
      wirtschaftsjahrBeginnMonat: Number(wjMonat),
      standardErloeskonto: erloes.trim(),
      standardAufwandskonto: aufwand.trim(),
      standardFinanzkonto: finanz.trim(),
      debitorKontoStart: Number(debitorStart),
      kreditorKontoStart: Number(kreditorStart),
      buSchluesselErloes: zeilenZuMap(buErloes),
      buSchluesselAufwand: zeilenZuMap(buAufwand),
      // Zuordnung Zahlungskonto → Sachkonto bleibt hier unverändert (kein Editor
      // in dieser Fassung); ohne Eintrag gilt das Standard-Finanzkonto.
      finanzkonten: settings.finanzkonten ?? {},
      festschreibung,
    };
    setBusy(true);
    const res = await saveDatevSettings(input);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      toast.error(res.error);
      return;
    }
    toast.success(t("datevPage.settings.saved"));
    setBearbeiten(false);
    router.refresh();
  }

  if (!bearbeiten) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg font-extrabold">{t("datevPage.settings.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("datevPage.settings.subtitle")}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setBearbeiten(true)}>
            <Icon icon="ph:pencil-simple" className="size-4" />
            {t("datevPage.settings.edit")}
          </Button>
        </div>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Wert label={t("datevPage.feld.beraterNummer")} wert={settings.beraterNummer} />
          <Wert label={t("datevPage.feld.mandantenNummer")} wert={settings.mandantenNummer} />
          <Wert label={t("datevPage.feld.kontenrahmen")} wert={settings.kontenrahmen} />
          <Wert label={t("datevPage.feld.sachkontenlaenge")} wert={settings.sachkontenlaenge} />
          <Wert label={t("datevPage.feld.wirtschaftsjahrBeginnMonat")} wert={settings.wirtschaftsjahrBeginnMonat} />
          <Wert label={t("datevPage.feld.standardErloeskonto")} wert={settings.standardErloeskonto} />
          <Wert label={t("datevPage.feld.standardAufwandskonto")} wert={settings.standardAufwandskonto} />
          <Wert label={t("datevPage.feld.standardFinanzkonto")} wert={settings.standardFinanzkonto} />
          <Wert label={t("datevPage.feld.debitorKontoStart")} wert={settings.debitorKontoStart} />
          <Wert label={t("datevPage.feld.kreditorKontoStart")} wert={settings.kreditorKontoStart} />
          <Wert
            label={t("datevPage.feld.festschreibung")}
            wert={settings.festschreibung ? t("datevPage.yes") : t("datevPage.no")}
          />
        </dl>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div>
        <h3 className="font-display text-lg font-extrabold">{t("datevPage.settings.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("datevPage.settings.subtitle")}</p>
      </div>

      {settings.fehlendeFelder.length > 0 && (
        <div className="rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <p className="font-medium">{t("datevPage.settings.missingTitle")}</p>
          <p>{settings.fehlendeFelder.map((f) => feldLabel(t, f)).join(", ")}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Feld label={t("datevPage.feld.beraterNummer")} hinweis={t("datevPage.hint.beraterNummer")} t={t}>
          <Input inputMode="numeric" value={beraterNummer} onChange={(e) => setBeraterNummer(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.mandantenNummer")} hinweis={t("datevPage.hint.mandantenNummer")} t={t}>
          <Input inputMode="numeric" value={mandantenNummer} onChange={(e) => setMandantenNummer(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.kontenrahmen")} hinweis={t("datevPage.hint.kontenrahmen")} t={t}>
          <NativeSelect value={kontenrahmen} onChange={(e) => setKontenrahmen(e.target.value as Kontenrahmen | "")}>
            <option value="">{t("datevPage.settings.choose")}</option>
            <option value="SKR03">SKR03</option>
            <option value="SKR04">SKR04</option>
          </NativeSelect>
        </Feld>
        <Feld label={t("datevPage.feld.sachkontenlaenge")} hinweis={t("datevPage.hint.sachkontenlaenge")} t={t}>
          <NativeSelect value={sachkontenlaenge} onChange={(e) => setSachkontenlaenge(e.target.value)}>
            <option value="">{t("datevPage.settings.choose")}</option>
            {[4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </NativeSelect>
        </Feld>
        <Feld label={t("datevPage.feld.wirtschaftsjahrBeginnMonat")} hinweis={t("datevPage.hint.wirtschaftsjahrBeginnMonat")} t={t}>
          <NativeSelect value={wjMonat} onChange={(e) => setWjMonat(e.target.value)}>
            <option value="">{t("datevPage.settings.choose")}</option>
            {monate.map((m) => (
              <option key={m} value={m}>{t(`datevPage.month.${m}`)}</option>
            ))}
          </NativeSelect>
        </Feld>
        <Feld label={t("datevPage.feld.standardErloeskonto")} hinweis={t("datevPage.hint.standardErloeskonto")} t={t}>
          <Input inputMode="numeric" value={erloes} onChange={(e) => setErloes(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.standardAufwandskonto")} hinweis={t("datevPage.hint.standardAufwandskonto")} t={t}>
          <Input inputMode="numeric" value={aufwand} onChange={(e) => setAufwand(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.standardFinanzkonto")} hinweis={t("datevPage.hint.standardFinanzkonto")} t={t}>
          <Input inputMode="numeric" value={finanz} onChange={(e) => setFinanz(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.debitorKontoStart")} hinweis={t("datevPage.hint.debitorKontoStart")} t={t}>
          <Input inputMode="numeric" value={debitorStart} onChange={(e) => setDebitorStart(e.target.value)} />
        </Feld>
        <Feld label={t("datevPage.feld.kreditorKontoStart")} hinweis={t("datevPage.hint.kreditorKontoStart")} t={t}>
          <Input inputMode="numeric" value={kreditorStart} onChange={(e) => setKreditorStart(e.target.value)} />
        </Feld>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={festschreibung} onCheckedChange={setFestschreibung} id="datev-festschreibung" />
          <Label htmlFor="datev-festschreibung">{t("datevPage.feld.festschreibung")}</Label>
          <InfoHinweis text={t("datevPage.hint.festschreibung")} ariaLabel={`${t("datevPage.settings.infoAria")} ${t("datevPage.feld.festschreibung")}`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BuEditor
          titel={t("datevPage.feld.buSchluesselErloes")}
          hinweis={t("datevPage.hint.buSchluesselErloes")}
          zeilen={buErloes}
          setZeilen={setBuErloes}
          t={t}
        />
        <BuEditor
          titel={t("datevPage.feld.buSchluesselAufwand")}
          hinweis={t("datevPage.hint.buSchluesselAufwand")}
          zeilen={buAufwand}
          setZeilen={setBuAufwand}
          t={t}
        />
      </div>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      <div className="flex items-center justify-end gap-2">
        {settings.configured && (
          <Button type="button" variant="ghost" onClick={() => setBearbeiten(false)} disabled={busy}>
            {t("datevPage.cancel")}
          </Button>
        )}
        <Button type="button" onClick={speichern} disabled={busy}>
          {busy && <Icon icon="ph:circle-notch" className="size-4 animate-spin" />}
          {t("datevPage.settings.save")}
        </Button>
      </div>
    </Card>
  );
}

function Feld({
  label,
  hinweis,
  children,
  t,
}: {
  label: string;
  hinweis: string;
  children: ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label>{label}</Label>
        <InfoHinweis text={hinweis} ariaLabel={`${t("datevPage.settings.infoAria")} ${label}`} />
      </div>
      {children}
    </div>
  );
}

function Wert({ label, wert }: { label: string; wert: string | number | null | undefined }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{wert === null || wert === undefined || wert === "" ? "—" : String(wert)}</dd>
    </div>
  );
}

function BuEditor({
  titel,
  hinweis,
  zeilen,
  setZeilen,
  t,
}: {
  titel: string;
  hinweis: string;
  zeilen: BuZeile[];
  setZeilen: (z: BuZeile[]) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Label>{titel}</Label>
        <InfoHinweis text={hinweis} ariaLabel={`${t("datevPage.settings.infoAria")} ${titel}`} />
      </div>
      {zeilen.map((z, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            placeholder={t("datevPage.settings.buSatzPlaceholder")}
            value={z.satz}
            onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, satz: e.target.value } : x)))}
            className="w-28"
            aria-label={t("datevPage.settings.buSatz")}
          />
          <span className="text-sm text-muted-foreground">%</span>
          <Icon icon="ph:arrow-right" className="size-4 text-muted-foreground" />
          <Input
            inputMode="numeric"
            placeholder={t("datevPage.settings.buKeyPlaceholder")}
            value={z.bu}
            onChange={(e) => setZeilen(zeilen.map((x, j) => (j === i ? { ...x, bu: e.target.value } : x)))}
            className="w-24"
            aria-label={t("datevPage.settings.buKey")}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("datevPage.settings.buRemove")}
            onClick={() => setZeilen(zeilen.filter((_, j) => j !== i))}
          >
            <Icon icon="ph:trash" className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setZeilen([...zeilen, { satz: "", bu: "" }])}
      >
        <Icon icon="ph:plus" className="size-4" />
        {t("datevPage.settings.buAdd")}
      </Button>
    </div>
  );
}
