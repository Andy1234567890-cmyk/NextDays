"use client";

// Promotion-Editor der Preise-Seite, im Umfang des Branchenstandards (live
// abgelesen 03.08.2026, Lodgify `/pricing/<id>` → Promotions):
//
//   Betrag (Prozent | Pauschalbetrag) · Art der Aktion (Mindestaufenthalt,
//   Frühbucher, Last Minute — KOMBINIERBAR) · Aufenthaltsdaten (mehrere
//   Zeiträume) · Daten der Buchung · Angebotscodes · Name/Beschreibung/Foto
//
// Die Kanal-Einschränkung liegt NICHT hier, sondern in einem eigenen Dialog
// (promotion-einschraenkungen.tsx) — genau wie im Standard, wo sie über das
// Zeilenmenü erreichbar ist (Bearbeiten · Einschränkungen · Entfernen).
//
// Anders als der Standard ist die Promotion bei uns NICHT „nur Direktbuchungen":
//   * Zeitraum-Promotions gehen über den gesendeten TAGESPREIS an jedes
//     verbundene Portal.
//   * Mindestaufenthalt/Frühbucher/Last Minute gehen bei Airbnb über dessen
//     eigene Rabattregeln (`default_pricing_rules`).
// Beides erledigt der Server nach dem Speichern; die Grenzen, die Airbnb dabei
// setzt, stehen als Hinweis direkt am Feld — sonst sieht eine Eingabe gültig
// aus, die kein Portal je bekommt.
import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";

import { Icon } from "@iconify/react";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import { ZuAnderenObjekten } from "@/components/objekte/pricing/zu-anderen-objekten";
import { Input } from "@nextdays/ui/input";
import { RichTextEditor } from "@nextdays/ui/rich-text-editor";
import { Segmented } from "@nextdays/ui/segmented";
import { Switch } from "@nextdays/ui/switch";
import { currencySymbol, type Currency } from "@/lib/pricing-meta";
import { uploadPropertyImage } from "@/lib/properties";
import {
  applyPromotionToProperties,
  createPromotion,
  updatePromotion,
  type DiscountKind,
  type Promotion,
  type PromotionInput,
  type StayRange,
} from "@/lib/promotions";

/** Angebotscode: der Standard begrenzt das Feld auf 15 Zeichen, der Server
 *  ebenso. Dieselbe Grenze hier, damit die Eingabe nicht erst beim Speichern
 *  scheitert. */
const CODE_MAX = 15;
/** Frühbucher-Vorlauf, den Airbnb annimmt (Vielfache von 28 oder 30 Tagen). */
const AIRBNB_VORLAUF = [28, 30, 56, 60, 84, 90];
const AIRBNB_LAST_MINUTE_MAX = 28;

export function PromotionEditor({
  propertyId,
  currency,
  vorhanden,
  onSaved,
  onApplyError,
  onClose,
}: {
  propertyId: string;
  currency: Currency | "";
  /** Bestehende Promotion (Bearbeiten) oder `undefined` (Neu). */
  vorhanden?: Promotion;
  onSaved: () => void;
  /** Fehler beim Übertragen auf weitere Objekte — gemeldet an die SEITE, weil
   *  dieser Dialog nach erfolgreichem Speichern nicht mehr steht. */
  onApplyError: (error: string | null) => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();

  const [kind, setKind] = useState<DiscountKind>(
    vorhanden?.discount_kind ?? "percent",
  );
  const [prozent, setProzent] = useState<number>(
    vorhanden ? Math.round((vorhanden.discount_bps ?? 0) / 100) : 10,
  );
  const [betrag, setBetrag] = useState<number>(vorhanden?.discount_amount ?? 0);
  const [aktiv, setAktiv] = useState<boolean>(vorhanden?.active ?? true);
  const [minNaechte, setMinNaechte] = useState<number | null>(
    vorhanden?.min_nights ?? null,
  );
  const [vorlaufMin, setVorlaufMin] = useState<number | null>(
    vorhanden?.lead_min_days ?? null,
  );
  const [vorlaufMax, setVorlaufMax] = useState<number | null>(
    vorhanden?.lead_max_days ?? null,
  );
  const [zeitraeume, setZeitraeume] = useState<StayRange[]>(
    vorhanden?.stay_ranges ?? [],
  );
  const [buchungVon, setBuchungVon] = useState<string>(vorhanden?.booked_from ?? "");
  const [buchungBis, setBuchungBis] = useState<string>(vorhanden?.booked_to ?? "");
  const [codes, setCodes] = useState<string[]>(vorhanden?.promo_codes ?? []);
  const [codeEingabe, setCodeEingabe] = useState("");
  const [name, setName] = useState<string>(
    vorhanden?.name?.[locale] ?? Object.values(vorhanden?.name ?? {})[0] ?? "",
  );
  const [beschreibung, setBeschreibung] = useState<string>(
    vorhanden?.description_html ?? "",
  );
  const [foto, setFoto] = useState<string | null>(vorhanden?.photo_url ?? null);
  const [fotoBusy, setFotoBusy] = useState(false);
  const [fotoFehler, setFotoFehler] = useState<string | null>(null);
  const [ziele, setZiele] = useState<string[]>([]);

  const { busy, error, run } = useSaver(speichern);

  function eingabe(): PromotionInput {
    return {
      // Aus dieser Oberfläche immer `promotion`: die Kurven-Typen dürfen je
      // Objekt nur EINMAL aktiv sein, eine Sommer- UND eine Winteraktion mit
      // Mindestaufenthalt wären damit unmöglich (siehe lib/promotions.ts).
      discount_type: "promotion",
      discount_kind: kind,
      // `discount_bps` nur bei Prozent: bei einer Pauschale wird die Spalte
      // nicht gelesen, ein mitgesendeter Satz wäre ein erfundener Wert.
      ...(kind === "percent" ? { discount_bps: Math.round(prozent * 100) } : {}),
      discount_amount: kind === "fixed" ? betrag : null,
      active: aktiv,
      min_nights: minNaechte,
      lead_min_days: vorlaufMin,
      lead_max_days: vorlaufMax,
      stay_ranges: zeitraeume,
      booked_from: buchungVon || null,
      booked_to: buchungBis || null,
      promo_codes: codes,
      // Die anderen Sprachen der bestehenden Zeile bleiben stehen — hier wird
      // nur die aktuelle gepflegt, nicht die Übersetzung anderer gelöscht.
      name: { ...(vorhanden?.name ?? {}), [locale]: name.trim() },
      description_html: beschreibung || null,
      photo_url: foto,
    };
  }

  async function speichern(): Promise<true | string> {
    const res = vorhanden
      ? await updatePromotion(propertyId, vorhanden.id, eingabe())
      : await createPromotion(propertyId, eingabe());
    if (!res.ok) return res.error;
    // Übertragen auf weitere Objekte erst NACH dem Speichern — vorher gibt es
    // die Promotion am Quell-Objekt noch nicht. Der Fehler geht an die SEITE:
    // dieser Dialog ist dann schon geschlossen.
    if (ziele.length > 0) {
      const verteilt = await applyPromotionToProperties(
        propertyId,
        res.data.id,
        ziele,
      );
      onApplyError(verteilt.ok ? null : verteilt.error);
    }
    onSaved();
    return true;
  }

  function codeHinzufuegen() {
    const code = codeEingabe.trim().toUpperCase();
    if (!code || codes.includes(code)) {
      setCodeEingabe("");
      return;
    }
    setCodes([...codes, code]);
    setCodeEingabe("");
  }

  async function fotoWaehlen(file: File) {
    setFotoBusy(true);
    setFotoFehler(null);
    const res = await uploadPropertyImage(propertyId, file, "promotion");
    setFotoBusy(false);
    if (!res.ok) {
      // Nicht verschlucken: ohne Meldung sähe der leere Rahmen wie „kein Foto
      // gewählt" aus, obwohl der Upload gescheitert ist (Wurzel 5).
      setFotoFehler(res.error);
      return;
    }
    setFoto(res.data.url);
  }

  const wertOk = kind === "percent" ? prozent >= 1 : betrag > 0;
  // Ein Betrag ohne Objektwährung ist nicht speicherbar (der Server lehnt ihn
  // ab) — der Hinweis steht am Feld, statt erst beim Speichern zu erscheinen.
  const waehrungFehlt = kind === "fixed" && !currency;

  return (
    <EditorShell
      title={
        vorhanden ? t("pricingForm.promoEditTitle") : t("pricingForm.promoAddTitle")
      }
      subtitle={t("pricingForm.promoEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => void run()}
          disabled={!name.trim() || !wertOk || waehrungFehlt}
        />
      }
    >
      {/* Betrag */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.amountSectionTitle")}
        </h3>
        <Segmented
          value={kind}
          onChange={(m) => setKind(m as DiscountKind)}
          variant="solid"
          block
          options={[
            { value: "percent" as const, label: t("pricingForm.feeModePercent") },
            { value: "fixed" as const, label: t("pricingForm.feeModeAmount") },
          ]}
        />
        {kind === "percent" ? (
          <Field label={t("pricingForm.rateLabel")} required>
            <div className="relative">
              <Input
                type="number"
                min={1}
                max={100}
                step="1"
                value={prozent}
                placeholder={t("pricingForm.percentOfBasePlaceholder")}
                onChange={(e) =>
                  setProzent(
                    Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))),
                  )
                }
                className="pr-8"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                %
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("pricingForm.promoValueHint")}
            </p>
          </Field>
        ) : (
          <Field label={t("pricingForm.amountLabel")} required>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={betrag}
                onChange={(e) => setBetrag(Number(e.target.value) || 0)}
              />
              {/* Währung kommt aus dem Objekt, ist hier keine Wahl. Ohne
                  gewählte Objektwährung bleibt die Fläche leer statt „€". */}
              <span className="min-w-8 text-sm text-muted-foreground">
                {currencySymbol(currency)}
              </span>
            </div>
          </Field>
        )}
        {waehrungFehlt && <Hint>{t("pricingForm.promoCurrencyMissing")}</Hint>}
        {kind === "fixed" && <Hint>{t("pricingForm.promoFixedPortalHint")}</Hint>}
      </section>

      {/* Bedingungen — im Standard eine eigene Überschrift über den drei
          Bedingungs-Blöcken (Angebotscodes, Aufenthaltsdaten, Daten der
          Buchung), danach erst „Art der Aktion". */}
      <h3 className="font-display text-lg font-extrabold">
        {t("pricingForm.promoConditionsTitle")}
      </h3>
      {/* Angebotscodes */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.promoCodesTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.promoCodesHint")}
        </p>
        <div className="flex items-center gap-2">
          <Input
            value={codeEingabe}
            maxLength={CODE_MAX}
            placeholder={t("pricingForm.promoCodePlaceholder")}
            onChange={(e) => setCodeEingabe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                codeHinzufuegen();
              }
            }}
          />
          <span className="shrink-0 text-xs text-muted-foreground">
            {codeEingabe.length}/{CODE_MAX}
          </span>
          <button
            type="button"
            onClick={codeHinzufuegen}
            disabled={!codeEingabe.trim()}
            className="shrink-0 text-sm font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            {t("pricingForm.add")}
          </button>
        </div>
        {codes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {codes.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-3 py-1.5 text-sm"
              >
                {code}
                <button
                  type="button"
                  aria-label={t("pricingForm.remove")}
                  onClick={() => setCodes(codes.filter((x) => x !== code))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Icon icon="ph:x" className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {codes.length > 0 && <Hint>{t("pricingForm.promoCodesAirbnb")}</Hint>}
      </section>

      {/* Aufenthaltsdaten */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.promoStayDatesTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.promoStayDatesHint")}
        </p>
        {zeitraeume.map((z, i) => (
          // Schlüssel ist die POSITION, nicht der Inhalt: mit dem Datum im
          // Schlüssel montiert React die Zeile bei jeder Eingabe neu — der Fokus
          // springt dann mitten im Tippen aus dem Feld.
          <div key={i} className="flex items-center gap-2">
            <Input
              type="date"
              value={z.from}
              onChange={(e) =>
                setZeitraeume(
                  zeitraeume.map((x, j) =>
                    j === i ? { ...x, from: e.target.value } : x,
                  ),
                )
              }
            />
            <span className="text-sm text-muted-foreground">–</span>
            <Input
              type="date"
              value={z.to}
              onChange={(e) =>
                setZeitraeume(
                  zeitraeume.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)),
                )
              }
            />
            <button
              type="button"
              aria-label={t("pricingForm.remove")}
              onClick={() => setZeitraeume(zeitraeume.filter((_, j) => j !== i))}
              className="shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Icon icon="ph:trash" className="size-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setZeitraeume([...zeitraeume, { from: "", to: "" }])}
          className="w-fit text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          {t("pricingForm.promoAddStayRange")}
        </button>
      </section>

      {/* Daten der Buchung */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.promoBookingDatesTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.promoBookingDatesHint")}
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={buchungVon}
            onChange={(e) => setBuchungVon(e.target.value)}
          />
          <span className="text-sm text-muted-foreground">–</span>
          <Input
            type="date"
            value={buchungBis}
            onChange={(e) => setBuchungBis(e.target.value)}
          />
        </div>
        {(buchungVon || buchungBis) && (
          <Hint>{t("pricingForm.promoBookingDatesAirbnb")}</Hint>
        )}
      </section>

      {/* Art der Aktion — kombinierbar (UND), genau wie im Standard */}
      <section className="flex flex-col gap-3">
        <h3 className="font-display text-lg font-extrabold">
          {t("pricingForm.promoKindTitle")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("pricingForm.promoKindHint")}
        </p>

        <BedingungsZeile
          label={t("pricingForm.promoMinNightsLabel")}
          suffix={t("pricingForm.nightsSuffix")}
          value={minNaechte}
          min={1}
          onChange={setMinNaechte}
        />
        <BedingungsZeile
          label={t("pricingForm.promoEarlyBirdLabel")}
          suffix={t("pricingForm.daysSuffix")}
          value={vorlaufMin}
          min={0}
          onChange={setVorlaufMin}
        />
        {vorlaufMin != null && !AIRBNB_VORLAUF.includes(vorlaufMin) && (
          <Hint>
            {t("pricingForm.promoEarlyBirdAirbnb", {
              werte: AIRBNB_VORLAUF.join(", "),
            })}
          </Hint>
        )}
        <BedingungsZeile
          label={t("pricingForm.promoLastMinuteLabel")}
          suffix={t("pricingForm.daysSuffix")}
          value={vorlaufMax}
          min={0}
          onChange={setVorlaufMax}
        />
        {vorlaufMax != null && vorlaufMax > AIRBNB_LAST_MINUTE_MAX && (
          <Hint>
            {t("pricingForm.promoLastMinuteAirbnb", { max: AIRBNB_LAST_MINUTE_MAX })}
          </Hint>
        )}
        {/* Zwei Bedingungen gleichzeitig sind erlaubt und wirken UND-verknüpft —
            nur bei Airbnb trägt eine Regel genau EINE Schwelle. */}
        {[minNaechte, vorlaufMin, vorlaufMax].filter((x) => x != null).length > 1 && (
          <Hint>{t("pricingForm.promoCombinedAirbnb")}</Hint>
        )}
      </section>

      {/* Darstellung */}
      <Field label={t("pricingForm.promoNameLabel")} hint={t("pricingForm.promoNameHint")} required>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("pricingForm.promoNamePlaceholder")}
        />
      </Field>
      <RichTextEditor
        value={beschreibung}
        onChange={setBeschreibung}
        placeholder={t("pricingForm.internalDescriptionPlaceholder")}
      />

      <Field label={t("pricingForm.promoPhotoLabel")} hint={t("pricingForm.promoPhotoHint")}>
        <div className="flex items-center gap-3">
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="" className="size-full object-cover" />
            ) : (
              <Icon icon="ph:image" className="size-5 text-muted-foreground" />
            )}
          </span>
          <label className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">
            {fotoBusy ? t("pricingForm.promoPhotoBusy") : t("pricingForm.promoPhotoPick")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void fotoWaehlen(file);
              }}
            />
          </label>
          {foto && (
            <button
              type="button"
              onClick={() => setFoto(null)}
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              {t("pricingForm.remove")}
            </button>
          )}
        </div>
      </Field>
      {fotoFehler && (
        <p role="alert" className="text-sm text-destructive">
          {fotoFehler}
        </p>
      )}

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.promoActiveLabel")}</span>
        <Switch checked={aktiv} onCheckedChange={setAktiv} />
      </label>

      <ZuAnderenObjekten
        propertyId={propertyId}
        kind="promotion"
        selected={ziele}
        onChange={setZiele}
      />
    </EditorShell>
  );
}

/** Eine Bedingung: Schalter + Zahl. Aus heißt „keine Grenze" (null), nicht 0 —
 *  0 Nächte wären ein Rabatt auf alles. */
function BedingungsZeile({
  label,
  suffix,
  value,
  min,
  onChange,
}: {
  label: string;
  suffix: string;
  value: number | null;
  min: number;
  onChange: (next: number | null) => void;
}) {
  const an = value != null;
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <Switch
          checked={an}
          onCheckedChange={(c) => onChange(c ? Math.max(min, 1) : null)}
        />
      </label>
      {an && (
        <div className="relative">
          <Input
            type="number"
            min={min}
            step="1"
            value={value ?? min}
            onChange={(e) =>
              onChange(Math.max(min, Math.round(Number(e.target.value) || 0)))
            }
            className="pr-16"
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        </div>
      )}
    </div>
  );
}
