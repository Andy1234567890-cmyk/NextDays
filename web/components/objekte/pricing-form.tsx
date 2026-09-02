"use client";

// Preis-Seite eines Objekts (Pricing, Etappe 1).
//  Nightly price: Grundpreis (Währung, Dynamic, Wochentag), Aufschlag je Portal,
//  Extra-Gast-Aufschlag, Kurzaufenthalts-Aufschlag.
//  Length of stay: Wochen-/Monats-/eigene Längenpreise.
// Gespeichert per updateProperty() in type_attributes.pricing.
//
// ZWEI Dinge liegen bewusst NICHT im Preis-Blob, weil sie echte Preisregeln mit
// Bedingungen sind und dort nur wie welche AUSSAHEN:
//   * Aktionen → `property_discounts` (lib/promotions.ts).
//   * Extras   → `property_addons` (lib/addons.ts). Der frühere Blob `addOns`
//     wurde von NIEMANDEM gelesen — nicht vom Resolver, nicht von der
//     Buchungsstrecke, nicht von der Rechnung; der Betrieb pflegte Extras, die
//     im Gast-Angebot nie erschienen (behoben 04.08.2026).
//
// Jeder Editor trägt oben die Zeile „Gilt für · Nicht unterstützt von"
// (PortalReichweite) — gerechnet vom Server aus derselben Quelle, aus der der
// Sync sendet. Ohne sie sieht eine Eingabe, die kein Portal je bekommt, genauso
// verbindlich aus wie der Grundpreis.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  EditorShell,
  Field,
  Footer,
  Hint,
  useSaver,
} from "@/components/objekte/editor-primitives";
import {
  PreisAbschnitt,
  PreisBadge,
  PreisChip,
  PreisHinzufuegen,
  PreisKarte,
  PreisLeer,
  PreisSeitenkopf,
  PreisSpalte,
  PreisSymbolAktion,
  PreisTextAktion,
} from "@/components/objekte/pricing/preis-bausteine";
import { RatePlanWizard } from "@/components/objekte/rate-plan-wizard";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { Input } from "@nextdays/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import { AirbnbGebuehrenImport } from "@/components/objekte/pricing/airbnb-gebuehren-import";
import { EinschraenkungenEditor } from "@/components/objekte/pricing/einschraenkungen-editor";
import { ExtraEditor } from "@/components/objekte/pricing/extra-editor";
import { GebuehrAuswahl } from "@/components/objekte/pricing/gebuehr-auswahl";
import { GebuehrEditor } from "@/components/objekte/pricing/gebuehren-editor";
import {
  PortalReichweite,
  PortalReichweiteChip,
} from "@/components/objekte/pricing/portal-reichweite";
import { PreiseUebernehmen } from "@/components/objekte/pricing/preise-uebernehmen";
import { PromotionAuswahl } from "@/components/objekte/pricing/promotion-auswahl";
import { PromotionEditor } from "@/components/objekte/pricing/promotion-editor";
import { PromotionEinschraenkungen } from "@/components/objekte/pricing/promotion-einschraenkungen";
import {
  LokaleSteuerEditor,
  MwStEditor,
} from "@/components/objekte/pricing/steuern-editoren";
import {
  type Currency,
  type Fee,
  type LengthPrice,
  type Pricing,
  type StayKind,
  type Tax,
  type TaxKind,
  CURRENCY_OPTIONS,
  FEE_BASIS_KEYS,
  STAY_KIND_KEYS,
  TAX_KIND_KEYS,
  TAXABLE_BASE_PRICE,
  WEEKDAY_LABELS,
  currencySymbol,
  feeDisplayName,
  fmtPrice,
  lengthPerNight,
  lengthTotal,
  readPricing,
  taxAmountBasis,
  taxDisplayName,
} from "@/lib/pricing-meta";
import {
  deleteAddon,
  listAddons,
  updateAddon,
  type Addon,
} from "@/lib/addons";
import { channelLabel, channelLogoLoose } from "@/lib/channel-logos";
import {
  getAbgabenStatus,
  listChannelConnections,
  setPortalPriceAdjustment,
  type AbgabeLiveStand,
  type AbgabePostenStatus,
  type StoredChannelConnection,
} from "@/lib/channex";
import { getDpSettings } from "@/lib/dynamic-pricing";
import { getProperty, type Property, updateProperty } from "@/lib/properties";
import {
  deletePromotion,
  listPromotions,
  type Promotion,
} from "@/lib/promotions";
import {
  deleteRatePlan,
  listRatePlans,
  setBasePrice,
  updateRatePlan,
  type RatePlan,
} from "@/lib/rates";
import { useRealtime } from "@/lib/use-realtime";

/** Sync-Stand der Abgaben eines Objekts, wie der Server ihn liefert. */
type AbgabenStatus = {
  currency_missing: boolean;
  portals: string[];
  items: AbgabePostenStatus[];
};

/** Was die Kopfzeile „Gilt für · Nicht unterstützt von" in einem Editor braucht.
 *  Als EIN Objekt durchgereicht, damit nicht jeder Editor zwei zusätzliche
 *  Parameter trägt — und damit ein neuer Editor die Zeile nicht vergisst. */
type Reichweite = { status: AbgabePostenStatus[] | null; portale: string[] };

type Section =
  | "currency"
  | "base"
  | "extraGuest"
  | "shortStay"
  | { length: StayKind; id?: string }
  // Auswahlschritt VOR dem Gebühren-Formular („neue oder bestehende Gebühr"),
  // wie im Branchenstandard `assign-fee`.
  | "feePick"
  // `vorlage` = übernommene Gebühr aus der Auswahlliste (neue Kennung, gleiche
  // Felder). Nur bei `fee: "new"` gesetzt.
  | { fee: string | "new"; vorlage?: Fee }
  | { restrict: "fee" | "tax"; id: string }
  // Kanal-Einschränkung einer Promotion — eigener Dialog wie bei Gebühr/Steuer,
  // erreichbar über das Zeilenmenü.
  | { promoRestrict: string }
  // Auswahlschritt VOR dem Promotion-Formular („neue oder bestehende") —
  // dieselbe Form wie bei den Gebühren.
  | "promoPick"
  | { tax: TaxKind; id?: string }
  | { promo: string | "new" }
  // Extra = Zeile aus `property_addons` (echter Katalog), nicht mehr der tote
  // Preis-Blob-Eintrag.
  | { extra: string | "new" }
  | "taxInfo"
  | "baseLabel"
  // Seitenmenü: Preise von einem anderen eigenen Objekt übernehmen.
  | "copyPricing"
  | null;

export function PricingForm({ initial }: { initial: Property }) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [p, setP] = useState<Property>(initial);
  const [section, setSection] = useState<Section>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const pr = readPricing(p.type_attributes);

  // Grundpreis-Wahrheit ist rate_plans (Resolver/Channex lesen NUR dort) — die
  // Anzeige spiegelt den Plan, nicht die type_attributes-Kopie. Ein Objekt = eine
  // Einheit; es kann mehrere Rate-Pläne haben (z. B. BAR/B&B) — dann gibt es keinen
  // EINEN Objekt-Grundpreis, die Pläne werden im Kalender („Preise") gepflegt.
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const loadPlans = useCallback(async () => {
    const res = await listRatePlans(p.id);
    if (res.ok) setPlans(res.data.items);
  }, [p.id]);
  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);
  useRealtime({
    table: "rate_plans",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadPlans(),
  });
  // Dynamic Pricing aktiv? Dann sind die verkauften Tagespreise die dynamischen
  // — der Grundpreis hier ist nur der Anker. Ohne diesen Hinweis liest sich die
  // Seite als „das Objekt kostet 129 €", während Kalender/Portale längst andere
  // Tagespreise führen.
  const [dpEnabled, setDpEnabled] = useState(false);
  const loadDp = useCallback(async () => {
    const res = await getDpSettings(p.id);
    if (res.ok) setDpEnabled(Boolean(res.data.enabled));
  }, [p.id]);
  useEffect(() => {
    void loadDp();
  }, [loadDp]);
  useRealtime({
    table: "dp_settings",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadDp(),
  });
  // Kanal-Pläne (`portal_scope`, 0272) zählen NICHT als Verkaufspläne: sie
  // tragen den Aufschlag EINES Portals und werden in „Preisänderung je Portal"
  // gepflegt — sie verkaufen nichts und dürfen deshalb nicht als Grundpreis
  // gelten.
  const verkaufsplaene = plans.filter((pl) => !pl.portal_scope);
  // Der Grundpreis hängt am ÄLTESTEN Plan ohne portal_scope, unabhängig von
  // der ANZAHL der Pläne. Vorher galt `verkaufsplaene.length > 1 ? null`, und
  // das wurde falsch, als das Backend anfing, für jede Portal-Ratenkategorie
  // (Bookings „Wochenrate", `portal_raten_plaene.py`) einen ZWEITEN normalen
  // Plan anzulegen: dieser zweite Plan schaltete die Grundpreis-Eingabe
  // ersatzlos ab, der Betrieb konnte seinen eigenen Standardpreis nicht mehr
  // bearbeiten — obwohl er nichts an seinem Preismodell geändert hat, sondern
  // nur eine Portal-Rate dazubekam.
  // Warum [0] wirklich der Grundpreis ist: das Backend sortiert die Liste
  // aufsteigend nach created_at (rates/service.py `.order("created_at")`), also
  // steht der gewachsene Standardpreis vorn und eine später angelegte
  // Portal-Rate kann ihn nicht verdrängen.
  const basePlan = verkaufsplaene[0] ?? null;
  // Ein abgeleiteter Plan (`rate_mode === "derived"`) hat KEINEN eigenen
  // Basispreis — er erbt ihn vom Parent, und das Backend weist einen
  // base_price-PATCH darauf mit 422 ab. Ist der aelteste Plan ausgerechnet ein
  // solcher, waere die Grundpreis-Karte eine Eingabe, die nie speichert; dann
  // bleibt sie weg und die Pflege laeuft ueber die Plan-Liste/den Kalender.
  const isDerivedBase = basePlan?.rate_mode === "derived";
  // Ein Kanal-Plan MIT Aufschlag ist eine echte Preisänderung je Portal und
  // gehört in seine Karte, nicht in die Plan-Liste. Ein Kanal-Plan mit 0 %
  // dagegen ist gar keine Preisänderung: er wurde vom Steuer-Sync angelegt, um
  // ein portal-eigenes Steuer-Set zu tragen, und ist bei 17 von 18 Objekten
  // nicht einmal am Kanal gemappt — er verkauft nichts. Ihn anzuzeigen wären 17
  // wirkungslose Zeilen, also bleibt er unsichtbar.
  //
  // Sichtbar werden muss dagegen jeder Plan, der eine echte PORTAL-RATE ist:
  // ein eigener Ratenplan wie Bookings „Wochenrate", der dort mit eigenem Preis
  // und eigenem Mindestaufenthalt verkauft (`portal_raten_plaene`). Solche
  // Pläne tragen KEIN portal_scope — sie sind normale Verkaufspläne mit
  // `send_to_portals` und stehen deshalb ohnehin schon in `verkaufsplaene`.
  //
  // Warum das der richtige Schnitt ist (live belegt 23.08.2026): bei
  // „Rævlingehuset" stand im Booking-Kalender an der Standard Rate min_stay 3
  // in jeder Spalte, an der „Wochenrate" LEER — und über diese Rate kam um
  // 11:46 eine 1-Nacht-Buchung (1.820 DKK). Gefehlt hat nicht die Anzeige des
  // Steuer-Vehikels, sondern ein eigener Plan für die Wochenrate.

  // Währung ist zentral am OBJEKT eingestellt (properties.currency, 0161) und
  // gilt für alle Rate-Plans. Anzeige-Priorität: Objektwährung → (Bestand) Plan-
  // /pricing-Währung. Leer/unbekannt rendert symbollos (lib/currency), nie ein
  // erfundenes € (Wurzel 4).
  const cur = ((p.currency ?? basePlan?.currency ?? pr.currency) || "") as
    | Currency
    | "";
  const shownBasePrice = basePlan ? basePlan.base_price : pr.basePrice;

  // Zentrale Objektwährung setzen: schreibt properties.currency; das Backend
  // zieht alle Rate-Plans dieses Objekts mit (Wurzel 1) und resynct die Portale.
  async function saveCurrency(next: Currency): Promise<true | string> {
    const res = await updateProperty(p.id, { currency: next });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    void loadPlans();
    return true;
  }

  // Welcher Posten kommt bei welchem verbundenen Portal NICHT an? Gerechnet vom
  // Server aus derselben Quelle, aus der der Sync sendet (`ota_abgaben`) — die
  // Oberfläche führt dazu KEINE eigene Regeltabelle, sonst behauptete der Chip
  // „geht raus", wo der Sync den Posten wegließe.
  const [abgaben, setAbgaben] = useState<AbgabenStatus | null>(null);
  const loadAbgaben = useCallback(async () => {
    const res = await getAbgabenStatus(p.id);
    // Bei Fehler bleibt der Stand LEER, nicht „alles synchron": ein nicht
    // ladbarer Status darf nicht als Erfolgsmeldung aussehen (Wurzel 4).
    setAbgaben(res.ok ? res.data : null);
  }, [p.id]);
  useEffect(() => {
    void loadAbgaben();
  }, [loadAbgaben]);
  // channex_channel_connection ist für authenticated gesperrt (Wurzel 6,
  // Migration 0337) — Portal-Kontoverbindung, Vertriebsdaten nach §4.3. Ein Abo
  // liefert kein Event mehr, und KEINE offene Tabelle bildet das Verbinden oder
  // Trennen eines Portals ab; ein Umhängen wäre ein stiller Ersatz. Ersatzlos
  // gestrichen.
  // Entfällt: verbindet der Betrieb in einer ANDEREN Sitzung ein Portal, steht
  // der Portal-Chip bis zum nächsten Seitenaufruf auf dem alten Stand — genau
  // das, was der frühere Kommentar hier vermeiden wollte. Es ist der ehrlichere
  // Zustand als ein Abo, das sich verbindet und nie ein Event liefert.

  // Fehler beim Übertragen eines Postens auf weitere Objekte. Er entsteht NACH
  // dem Speichern — also nachdem der Editor-Dialog geschlossen wurde. Deshalb
  // liegt er hier auf der Seite: im Dialog wäre die Meldung an eine Fläche
  // geheftet, die es in dem Moment nicht mehr gibt, und ein fehlgeschlagenes
  // Verteilen sähe wie ein erfolgreiches aus (Wurzel 5 — nichts verschlucken).
  const [verteilFehler, setVerteilFehler] = useState<string | null>(null);

  const reichweite: Reichweite = {
    status: abgaben?.items ?? null,
    portale: abgaben?.portals ?? [],
  };

  /** Portale, bei denen dieser Posten von Hand gepflegt werden muss. */
  function manualPortals(key: string): string[] {
    return abgaben?.items.find((x) => x.key === key)?.manual_portals ?? [];
  }

  /** Was beim Portal WIRKLICH steht (zurückgelesen, siehe PortalStandChip). */
  function portalStand(key: string): AbgabeLiveStand[] {
    return abgaben?.items.find((x) => x.key === key)?.live ?? [];
  }

  // KEIN „Beim Portal prüfen"-Knopf mehr. Der zurückgelesene Stand (`live`,
  // oben) bleibt und speist weiter den Chip an der Zeile — er kommt aus
  // `ota_gebuehren_stand`, gefüllt vom Hintergrund-Job. Ein Knopf, der die
  // Prüfung von Hand auslöst, gehört nicht in diese Maske: der Aggregator
  // reicht asynchron weiter (15–45 Minuten bei Airbnb gemessen), ein Klick
  // konnte also nur denselben alten Stand erneut bestätigen.
  /** Warum ein Posten dort von Hand gepflegt werden muss — gesetzt bei Aktionen
   *  UND bei Preisen nach Aufenthaltsdauer (Gebühren/Steuern erklärt der Chip
   *  über das Portal selbst). Der Grund kommt als SCHLÜSSEL vom Server und wird
   *  hier übersetzt; der Schlüsselraum heißt aus historischen Gründen
   *  `promoReason`, die Texte sind aber allgemein gehalten. */
  function manualReason(key: string): string | undefined {
    const posten = abgaben?.items.find((x) => x.key === key);
    if (!posten) return undefined;
    const teile: string[] = [];
    if (posten.reason) teile.push(t(`pricingForm.promoReason.${posten.reason}`));
    // Airbnb hat einen ZWEITEN Weg (eigene Rabattregeln) mit eigenen Grenzen.
    // Scheitert dort etwas anderes als am Tagespreis, muss beides dastehen —
    // sonst schickt der Hinweis den Betrieb in die falsche Richtung.
    if (posten.airbnb_reason && posten.airbnb_reason !== posten.reason) {
      teile.push(
        t("pricingForm.promoReasonAirbnb", {
          grund: t(`pricingForm.promoReason.${posten.airbnb_reason}`),
        }),
      );
    }
    return teile.length > 0 ? teile.join(" · ") : undefined;
  }

  // Promotions liegen in property_discounts (eigene Zeilen mit Bedingungen),
  // nicht im Preis-Blob — deshalb eine eigene Liste mit eigenem Abo.
  const [promos, setPromos] = useState<Promotion[]>([]);
  const loadPromos = useCallback(async () => {
    const res = await listPromotions(p.id);
    if (res.ok) setPromos(res.data);
  }, [p.id]);
  useEffect(() => {
    void loadPromos();
  }, [loadPromos]);
  // KEIN Realtime-Abo auf `property_discounts`: die Tabelle ist bewusst gesperrt
  // (0185 — `revoke select … from anon, authenticated`, damit ein eingeloggter
  // cleaner mit dem anon-Key keine Rabatte lesen und keine schreiben kann,
  // Wurzel 6). Ohne `select` für `authenticated` wäre ein Abo eine stumme
  // Attrappe: die Seite sähe live aus und aktualisierte nie. Einen Grant dafür
  // nachzuziehen wäre der falsche Weg — stattdessen wird nach jeder EIGENEN
  // Änderung neu geladen (`loadPromos` im Editor-Callback und beim Löschen).
  // Preis dieser Entscheidung, bewusst in Kauf genommen: die Änderung eines
  // ZWEITEN Nutzers erscheint erst beim nächsten Laden der Seite.

  // Extras kommen aus dem ECHTEN Katalog (`property_addons`) — derselben Quelle,
  // aus der der Preis-Resolver rechnet und die Buchungsstrecke verkauft. Der
  // frühere Blob-Eintrag `pr.addOns` wurde von niemandem gelesen.
  const [extras, setExtras] = useState<Addon[]>([]);
  const loadExtras = useCallback(async () => {
    const res = await listAddons(p.id);
    if (res.ok) setExtras(res.data.items);
  }, [p.id]);
  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);
  useRealtime({
    table: "property_addons",
    filter: `property_id=eq.${p.id}`,
    onChange: () => void loadExtras(),
  });

  /** Extra aktiv/inaktiv schalten — im Standard ein eigener Menüpunkt neben
   *  Bearbeiten, weil „vorübergehend nicht anbieten" der häufigere Fall ist als
   *  Löschen (das die Zeile samt Foto mitnimmt). */
  async function extraUmschalten(extra: Addon) {
    const res = await updateAddon(extra.id, { active: !extra.active });
    if (!res.ok) {
      setVerteilFehler(res.error);
      return;
    }
    void loadExtras();
  }

  async function extraLoeschen(id: string) {
    // Löschen nimmt Übersetzungen und Fotos mit — anders als „Deaktivieren" ist
    // das nicht zurückzunehmen (Projekt-Muster: window.confirm).
    if (!window.confirm(t("pricingForm.extraConfirmDelete"))) return;
    const res = await deleteAddon(id);
    if (!res.ok) {
      // Nicht verschlucken: sonst bliebe die Zeile stehen und niemand wüsste,
      // warum (Wurzel 5).
      setVerteilFehler(res.error);
      return;
    }
    void loadExtras();
  }

  async function promoLoeschen(id: string) {
    const res = await deletePromotion(p.id, id);
    if (!res.ok) {
      // Nicht verschlucken: sonst bliebe die Zeile stehen und niemand wüsste,
      // warum (Wurzel 5).
      setVerteilFehler(res.error);
      return;
    }
    void loadPromos();
    void loadAbgaben();
  }

  async function save(next: Pricing): Promise<true | string> {
    const res = await updateProperty(p.id, {
      type_attributes: { ...p.type_attributes, pricing: next },
    });
    if (!res.ok) return res.error;
    setP(res.data);
    setSection(null);
    // Der Sync-Stand hängt an den gerade gespeicherten Posten — ohne diesen
    // Aufruf zeigte der Chip den Stand VOR der Änderung.
    void loadAbgaben();
    // Basispreis in rate_plans persistieren — die eine Preis-Wahrheit (Resolver,
    // Channex, Kalender). Auch 0 wird gespiegelt (Zurücksetzen muss wirken);
    // ohne gewählte Währung kein Push (Backend lehnt leere Währung ab, 422).
    //
    // ZWEI Wege, weil das Backend zwei verschiedene Endpunkte anbietet:
    //   * Gibt es noch KEINEN Plan, muss einer entstehen → `setBasePrice`
    //     (Upsert `PUT /rates/base-price`). Nur der kann anlegen.
    //   * Gibt es schon einen, wird GENAU DIESER gepatcht → `updateRatePlan`.
    // Warum nicht immer `setBasePrice`: dessen Server-Guard wirft 409, sobald
    // das Objekt mehr als einen Plan hat („Dieses Objekt hat mehrere
    // Preispläne"). Eine Portal-Ratenkategorie (Bookings „Wochenrate") ist so
    // ein zweiter Plan — über `setBasePrice` wäre der Grundpreis danach nur
    // noch mit einer 409-Meldung speicherbar. `updateRatePlan` kennt diesen
    // Guard nicht und fasst nur die ID an, die wir ihm geben; Name und
    // min_stay des Plans bleiben unberührt (Wurzel 1: fremde Pflege-Zustände).
    //
    // Beim PATCH geht die Währung ABSICHTLICH nicht mit: sie wird zentral am
    // Objekt gepflegt (0161), und ein mitgeschickter Wert wird vom Server nur
    // gegen die Objektwährung geprüft (422 bei Abweichung) — er kann sie nicht
    // setzen. Ein Altbestands-Plan mit abweichender Plan-Währung liesse sich
    // damit gar nicht mehr speichern. Nur beim ERSTEN Anlegen ist die Währung
    // nötig, weil `setBasePrice` sie am Objekt festschreibt, wenn dort noch
    // keine steht.
    if (next.currency) {
      const rp = basePlan
        ? await updateRatePlan(basePlan.id, { basePrice: next.basePrice })
        : await setBasePrice(p.id, next.basePrice, next.currency);
      if (!rp.ok) return rp.error;
      void loadPlans();
    }
    return true;
  }

  return (
    <PreisSpalte>
      <PreisSeitenkopf
        title={t("pricingForm.pageTitle")}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisSymbolAktion
                icon="ph:dots-three"
                label={t("pricingForm.actions")}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-80">
              <DropdownMenuItem onClick={() => setSection("copyPricing")}>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {t("pricingForm.copyPricingTitle")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("pricingForm.copyPricingSubtitle")}
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Ein Posten wurde gespeichert, ließ sich aber nicht auf alle gewählten
          Objekte übertragen. Die Meldung steht HIER und nicht im Editor: der ist
          nach dem Speichern zu, und ein fehlgeschlagenes Verteilen sähe sonst
          wie ein erfolgreiches aus. Sie bleibt stehen, bis der nächste Vorgang
          sie ersetzt — ein Toast wäre weg, bevor man ihn gelesen hat. */}
      {verteilFehler && (
        <p
          role="alert"
          className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {verteilFehler}
        </p>
      )}

      {/* Zentrale Objektwährung — gilt für ALLE Preispläne dieses Objekts
          (FeWo wie Hotel). Eine Stelle, kein Setzen je Rate-Plan (Channex:
          1 Objekt = 1 Währung, Migration 0161). */}
      <section className="pb-16">
        <BlockCard
          title={t("pricingForm.currencyTitle")}
          hint={t("pricingForm.currencyHint")}
          hasValue={Boolean(cur)}
          onEdit={() => setSection("currency")}
        >
          {cur ? (
            <PreisChip>
              {CURRENCY_OPTIONS.find((o) => o.value === cur)?.label ?? cur}
            </PreisChip>
          ) : null}
        </BlockCard>
      </section>

      {/* Nightly price */}
      <PreisAbschnitt
        title={t("pricingForm.nightlyPriceTitle")}
        hint={t("pricingForm.nightlyPriceHint")}
      >
        {/* Der Grundpreis ist der Preis des ältesten Verkaufsplans und bleibt
            immer bearbeitbar — auch wenn daneben eine Portal-Ratenkategorie
            steht (Bookings „Wochenrate"). Nur wenn es überhaupt keinen Plan
            gibt und auch kein `pricing`-Blob-Wert existiert, wäre die Karte
            leer; `basePlan === null` heißt dann „noch nichts angelegt", und
            genau dafür schreibt `save()` per `setBasePrice` den ersten Plan.
            Die abgeleiteten Pläne (BAR/B&B) werden weiter datumsgenau im
            Kalender gepflegt, die Liste darunter steht in jedem Fall. */}
        {!isDerivedBase && (
          <BlockCard
            title={t("pricingForm.basePriceTitle")}
            hint={t("pricingForm.basePriceHint")}
            hasValue
            onEdit={() => setSection("base")}
          >
            <PreisChip>
              {fmtPrice(shownBasePrice, cur, locale)}
              <PortalReichweiteChip schluessel="base_price" {...reichweite} />
            </PreisChip>
          </BlockCard>
        )}

        {dpEnabled && (
          <PreisKarte
            className="border-accent/40 bg-accent/5"
            title={
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-accent">⚡</span>
                {t("pricingForm.dynamicActiveTitle")}
              </span>
            }
            hint={t("pricingForm.dynamicActiveHint")}
            action={
              <PreisTextAktion asChild>
                <a href={`/dynamic-pricing/${p.id}`}>
                  {t("pricingForm.dynamicActiveOpen")}
                </a>
              </PreisTextAktion>
            }
          />
        )}

        {/* Alle Verkaufspläne — auch die, die einer Portal-Rate entsprechen
            (Bookings „Wochenrate" & Co., s. Kommentar bei `verkaufsplaene`).
            Der reine Portal-Aufschlag bleibt in seiner Karte darunter. */}
        <RatePlanList
          plans={verkaufsplaene}
          currency={cur}
          onCreate={() => setWizardOpen(true)}
          onDeleted={() => void loadPlans()}
        />

        {/* Hier dagegen ALLE Pläne: die Karte liest die Kanal-Pläne
            (`portal_scope`), um den Aufschlag je Portal anzuzeigen. */}
        <PortalAdjustmentsCard propertyId={p.id} plans={plans} />

        <BlockCard
          title={t("pricingForm.extraGuestTitle")}
          hint={t("pricingForm.extraGuestHint")}
          hasValue={pr.extraGuestCharge > 0}
          onEdit={() => setSection("extraGuest")}
        >
          {pr.extraGuestCharge > 0 ? (
            <PreisChip>
              {t("pricingForm.extraGuestPill", { price: fmtPrice(pr.extraGuestCharge, cur, locale), guest: pr.extraGuestFrom + 1 })}
              <PortalReichweiteChip schluessel="extra_guest" {...reichweite} />
            </PreisChip>
          ) : null}
        </BlockCard>

        <BlockCard
          title={t("pricingForm.shortStayTitle")}
          hint={t("pricingForm.shortStayHint")}
          hasValue={pr.shortStayMaxNights > 0}
          onEdit={() => setSection("shortStay")}
          localOnly
        >
          {pr.shortStayMaxNights > 0 ? (
            <PreisChip>{t("pricingForm.shortStayPill", { price: fmtPrice(pr.shortStaySurcharge, cur, locale), nights: pr.shortStayMaxNights })}</PreisChip>
          ) : null}
        </BlockCard>
      </PreisAbschnitt>

      {/* Length of stay prices */}
      {/* Preise nach Aufenthaltsdauer. KEIN „nur Direktbuchungen": ein Wochen-/
          Monatspreis IST ein Längenrabatt und geht über Airbnbs eigene
          Rabattregel (`STAYED_AT_LEAST_X_DAYS`) an das Portal. Wo das nicht
          geht, sagt es der Chip „Manuelle Synchronisierung" an der ZEILE — mit
          den Logos der betroffenen Portale, gerechnet vom Server. */}
      <PreisAbschnitt
        title={t("pricingForm.lengthPricesTitle")}
        hint={t("pricingForm.lengthPricesHint")}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisHinzufuegen label={t("pricingForm.add")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSection({ length: "weekly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.weeklyPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.weeklyPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "monthly" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.monthlyPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.monthlyPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ length: "custom" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.customLengthPriceLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.customLengthPriceDesc")}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {pr.lengthPrices.length === 0 ? (
          <PreisLeer>{t("pricingForm.lengthPricesEmpty")}</PreisLeer>
        ) : (
          pr.lengthPrices.map((lp) => (
            <PreisKarte
              key={lp.id}
              title={t(STAY_KIND_KEYS[lp.kind])}
              hint={t("pricingForm.minNightsOrMore", { nights: lp.minNights })}
              action={
                <div className="flex shrink-0 items-center">
                  <PreisSymbolAktion
                    label={t("pricingForm.edit")}
                    onClick={() => setSection({ length: lp.kind, id: lp.id })}
                  />
                  <PreisSymbolAktion
                    icon="ph:trash"
                    label={t("pricingForm.remove")}
                    onClick={() => save({ ...pr, lengthPrices: pr.lengthPrices.filter((x) => x.id !== lp.id) })}
                  />
                </div>
              }
            >
              {/* Beide Zahlen, und zwar in dieser Reihenfolge: der Standard
                  führt den GESAMTPREIS des Aufenthalts („kr 2835"), weil man so
                  einkauft. Gespeichert und gerechnet wird der Nachtpreis — er
                  steht daneben, damit niemand rätselt, was bei 9 Nächten
                  passiert (dann gilt weiter der Nachtpreis). */}
              <PreisChip>
                {fmtPrice(lengthTotal(lp.pricePerNight, lp.minNights), cur, locale)}
              </PreisChip>
              <PreisChip>
                {t("pricingForm.pricePerNight", { price: fmtPrice(lp.pricePerNight, cur, locale) })}
              </PreisChip>
              <ManuellerSyncChip
                portale={manualPortals(lp.id)}
                grund={manualReason(lp.id)}
              />
            </PreisKarte>
          ))
        )}
      </PreisAbschnitt>

      {/* Fees */}
      <ListSection
        title={t("pricingForm.feesTitle")}
        hint={t("pricingForm.feesHint")}
        onAdd={() => setSection("feePick")}
        empty={t("pricingForm.feesEmpty")}
        items={pr.fees}
        render={(f) => (
          <ListRow
            key={f.id}
            title={feeDisplayName(f, locale)}
            pill={feeSummary(f, cur, locale, t)}
            badge={
              (f.portalScope ?? []).length > 0
                ? t("pricingForm.restrictedSuffix")
                : undefined
            }
            manualPortals={manualPortals(f.id)}
            live={portalStand(f.id)}
            onEdit={() => setSection({ fee: f.id })}
            onRestrict={() => setSection({ restrict: "fee", id: f.id })}
            onDelete={() => save({ ...pr, fees: pr.fees.filter((x) => x.id !== f.id) })}
          />
        )}
        /* Ohne Objektwährung überträgt der Abgaben-Sync GAR NICHTS. Das ist ein
           Befund über das Objekt, kein Chip an jedem Posten — deshalb einmal
           unter der Liste und nicht zwanzigmal in den Zeilen. */
        footer={
          abgaben?.currency_missing && pr.fees.length + pr.taxes.length > 0 ? (
            <PreisLeer>{t("pricingForm.abgabenNoCurrency")}</PreisLeer>
          ) : undefined
        }
      />

      {/* HIER STAND „Wem gehören die Gebühren?" — ein reiner Verweis auf
          „Buchhaltung → Abrechnungsregeln", bestehend aus einem Satz und einem
          Knopf. Am 12.08.2026 entfernt: die Zuordnung gilt betriebsweit
          (`cleaning_fee` kommt im Live-Bestand an 18 Objekten von 16
          Eigentümern vor — EINE Entscheidung, nicht 18), sie gehört also nicht
          an das einzelne Objekt, und ein Wegweiser an dieser Stelle kostet nur
          Höhe in einer Maske, in der der Betrieb Beträge pflegt.

          Die ZUORDNUNG selbst ist unberührt (`fee_classification`, gepflegt
          unter „Abrechnungsregeln") — die Abrechnung braucht sie weiter, und ohne
          sie verweigert `gebuehren_zuordnen` die Rechnung, statt zu raten.

          Die i18n-Schlüssel `ownerBilling.classifyMovedHint`/`…MovedLink` sind
          damit unbenutzt und in allen 24 Sprachdateien gelöscht.
          `classifyTitle` BLEIBT — er trägt weiter die Überschrift auf der
          Abrechnungsregeln-Seite und in den Reporting-Einstellungen. */}

      {/* Was bei Airbnb schon hinterlegt ist, muss der Betrieb nicht abtippen.
          Rendert nichts, wenn das Objekt nicht bei Airbnb hängt oder dort
          nichts Zusätzliches steht. */}
      <AirbnbGebuehrenImport
        propertyId={p.id}
        anzahlGebuehren={pr.fees.length}
        onUebernommen={(fees) => {
          // Die Übernahme schreibt SERVERSEITIG (über den regulären
          // Objekt-Update-Weg, inklusive Validierung und Abgaben-Sync). Hier
          // wird nur die Anzeige nachgezogen — kein zweites Speichern, das den
          // gerade geschriebenen Stand überschreiben würde.
          setP((alt) => ({
            ...alt,
            type_attributes: {
              ...alt.type_attributes,
              pricing: { ...readPricing(alt.type_attributes), fees },
            },
          }));
          void loadAbgaben();
        }}
      />

      {/* Taxes */}
      <PreisAbschnitt
        title={t("pricingForm.taxesTitle")}
        hint={t("pricingForm.taxesHint")}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisHinzufuegen label={t("pricingForm.add")} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {/* Es gibt genau EINE USt je Objekt — ist sie angelegt, führt der
                  Eintrag nicht zu einer zweiten, sondern gar nicht mehr weiter. */}
              <DropdownMenuItem
                disabled={pr.taxes.some((x) => x.kind === "vat")}
                onClick={() => setSection({ tax: "vat" })}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.vatLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.vatDesc")}</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSection({ tax: "local" })}>
                <div className="flex flex-col">
                  <span className="font-medium">{t("pricingForm.localTaxLabel")}</span>
                  <span className="text-xs text-muted-foreground">{t("pricingForm.localTaxDesc")}</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      >
        {pr.taxes.length === 0 ? (
          <PreisLeer>{t("pricingForm.taxesEmpty")}</PreisLeer>
        ) : (
          pr.taxes.map((tx) => (
            <ListRow
              key={tx.id}
              title={
                tx.kind === "vat"
                  ? t("pricingForm.vatLabel")
                  : taxDisplayName(tx, locale) || t(TAX_KIND_KEYS[tx.kind])
              }
              pill={taxSummary(tx, cur, locale, t)}
              badge={
                (tx.portalScope ?? []).length > 0
                  ? t("pricingForm.restrictedSuffix")
                  : undefined
              }
              manualPortals={manualPortals(tx.id)}
              onEdit={() => setSection({ tax: tx.kind, id: tx.id })}
              onRestrict={() => setSection({ restrict: "tax", id: tx.id })}
              onDelete={() => save({ ...pr, taxes: pr.taxes.filter((x) => x.id !== tx.id) })}
            />
          ))
        )}
      </PreisAbschnitt>

      {/* Promotions — eigene Zeilen in property_discounts, KEIN Preis-Blob:
          eine Promotion ist eine Preisregel mit Bedingungen, die der Resolver
          auswertet und die über den Tagespreis bzw. Airbnbs Rabattregeln an die
          Portale geht. Deshalb steht hier auch kein „nur Direktbuchungen". */}
      <ListSection
        title={t("pricingForm.promotionsTitle")}
        hint={t("pricingForm.promotionsHint")}
        onAdd={() => setSection("promoPick")}
        empty={t("pricingForm.promotionsEmpty")}
        items={promos}
        render={(pm) => (
          <ListRow
            key={pm.id}
            title={promoName(pm, locale) || t("pricingForm.promoUnnamed")}
            pill={promoSummary(pm, cur, locale, t)}
            badge={pm.active ? undefined : t("pricingForm.promoInactiveBadge")}
            manualPortals={manualPortals(pm.id)}
            manualReason={manualReason(pm.id)}
            onEdit={() => setSection({ promo: pm.id })}
            onRestrict={() => setSection({ promoRestrict: pm.id })}
            onDelete={() => void promoLoeschen(pm.id)}
          />
        )}
      />

      {/* Extras — Zeilen aus `property_addons` (echter Katalog), NICHT aus dem
          Preis-Blob: der frühere Blob-Eintrag `addOns` wurde von niemandem
          gelesen, also erschien kein einziges dort gepflegtes Extra im
          Gast-Angebot. „nur Direktbuchungen" stimmt weiterhin — ein Portal hat
          für ein dazubuchbares Extra kein Feld. */}
      <ListSection
        title={t("pricingForm.extrasTitle")}
        hint={t("pricingForm.extrasHint")}
        localOnly
        onAdd={() => setSection({ extra: "new" })}
        empty={t("pricingForm.extrasEmpty")}
        items={extras}
        render={(a) => (
          <ListRow
            key={a.id}
            title={addonName(a, locale) || t("pricingForm.extraUnnamed")}
            badge={
              a.active ? t("pricingForm.activated") : t("pricingForm.extraInactiveBadge")
            }
            badgeTone={a.active ? "success" : "info"}
            pill={extraSummary(a, cur, locale, t)}
            onEdit={() => setSection({ extra: a.id })}
            onToggle={() => void extraUmschalten(a)}
            toggleLabel={
              a.active
                ? t("pricingForm.extraDeactivate")
                : t("pricingForm.extraActivate")
            }
            onDelete={() => void extraLoeschen(a.id)}
          />
        )}
      />

      {/* Other information */}
      <PreisAbschnitt title={t("pricingForm.otherInfoTitle")}>
        <BlockCard
          title={t("pricingForm.taxInfoTitle")}
          hint={t("pricingForm.taxInfoHint")}
          hasValue={Boolean(pr.businessTaxId || pr.totRegistrationId)}
          onEdit={() => setSection("taxInfo")}
        >
          {(pr.businessTaxId || pr.totRegistrationId) && (
            <PreisChip>{[pr.businessTaxId, pr.totRegistrationId].filter(Boolean).join(" · ")}</PreisChip>
          )}
        </BlockCard>
        <BlockCard
          title={t("pricingForm.baseLabelTitle")}
          hint={t("pricingForm.baseLabelHint")}
          hasValue={Boolean(pr.basePriceLabel)}
          onEdit={() => setSection("baseLabel")}
        >
          {pr.basePriceLabel && <PreisChip>{pr.basePriceLabel}</PreisChip>}
        </BlockCard>
      </PreisAbschnitt>

      {/* Editoren */}
      {section === "currency" && (
        <CurrencyEditor current={cur} onSave={saveCurrency} onClose={() => setSection(null)} />
      )}
      {section === "base" && (
        <BaseEditor
          reichweite={reichweite}
          dpEnabled={dpEnabled}
          propertyId={p.id}
          // Editor mit der Plan-Wahrheit vorbelegen (rate_plans), nicht mit der
          // type_attributes-Kopie — sonst editiert man einen veralteten Wert.
          pr={basePlan ? { ...pr, basePrice: basePlan.base_price, currency: (basePlan.currency || pr.currency) as Pricing["currency"] } : pr}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "extraGuest" && (
        <ExtraGuestEditor
          pr={pr}
          reichweite={reichweite}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "shortStay" && (
        <ShortStayEditor
          pr={pr}
          reichweite={reichweite}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "length" in section && (
        <LengthEditor
          pr={pr}
          reichweite={reichweite}
          kind={section.length}
          editId={section.id}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section === "feePick" && (
        <GebuehrAuswahl
          propertyId={p.id}
          summary={(f) => feeSummary(f, cur, locale, t)}
          onNew={() => setSection({ fee: "new" })}
          onPick={(f) => setSection({ fee: "new", vorlage: f })}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "fee" in section && (
        <GebuehrEditor
          pr={pr}
          propertyId={p.id}
          editId={section.fee === "new" ? undefined : section.fee}
          vorlage={section.vorlage}
          onSave={save}
          onApplyError={setVerteilFehler}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "restrict" in section && (
        <EinschraenkungenEditor
          pr={pr}
          propertyId={p.id}
          kind={section.restrict}
          id={section.id}
          onSave={save}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "tax" in section && (
        section.tax === "vat" ? (
          <MwStEditor pr={pr} onSave={save} onClose={() => setSection(null)} />
        ) : (
          <LokaleSteuerEditor
            pr={pr}
            propertyId={p.id}
            editId={section.id}
            onSave={save}
            onApplyError={setVerteilFehler}
            onClose={() => setSection(null)}
          />
        )
      )}
      {section && typeof section === "object" && "promo" in section && (
        <PromotionEditor
          propertyId={p.id}
          currency={cur}
          vorhanden={
            section.promo === "new"
              ? undefined
              : promos.find((x) => x.id === section.promo)
          }
          onSaved={() => {
            setSection(null);
            void loadPromos();
            // Der Sync-Stand hängt an den Bedingungen der Promotion — ohne
            // diesen Aufruf zeigte der Chip den Stand VOR der Änderung.
            void loadAbgaben();
          }}
          onApplyError={setVerteilFehler}
          onClose={() => setSection(null)}
        />
      )}
      {section === "promoPick" && (
        <PromotionAuswahl
          propertyId={p.id}
          summary={(pm) => promoSummary(pm, cur, locale, t)}
          nameOf={promoName}
          onNew={() => setSection({ promo: "new" })}
          onApplied={() => {
            setSection(null);
            void loadPromos();
            void loadAbgaben();
          }}
          onError={setVerteilFehler}
          onClose={() => setSection(null)}
        />
      )}
      {section && typeof section === "object" && "promoRestrict" in section && (() => {
        const pm = promos.find((x) => x.id === section.promoRestrict);
        return pm ? (
          <PromotionEinschraenkungen
            propertyId={p.id}
            promotion={pm}
            onSaved={() => {
              setSection(null);
              void loadPromos();
              void loadAbgaben();
            }}
            onClose={() => setSection(null)}
          />
        ) : null;
      })()}
      {section && typeof section === "object" && "extra" in section && (
        <ExtraEditor
          propertyId={p.id}
          currency={cur}
          vorhanden={
            section.extra === "new"
              ? undefined
              : extras.find((x) => x.id === section.extra)
          }
          naechsteReihenfolge={extras.length}
          status={reichweite.status}
          portale={reichweite.portale}
          onSaved={() => {
            setSection(null);
            void loadExtras();
          }}
          onClose={() => setSection(null)}
        />
      )}
      {section === "taxInfo" && <TaxInfoEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
      {section === "baseLabel" && <BaseLabelEditor pr={pr} onSave={save} onClose={() => setSection(null)} />}
      {section === "copyPricing" && (
        <PreiseUebernehmen
          propertyId={p.id}
          onDone={() => {
            setSection(null);
            toast.success(t("pricingForm.copyPricingDone"));
            // Der ganze Preis-Block ist neu — Objekt, Pläne und Sync-Stand neu
            // laden. Ohne das zeigte die Seite die alten Gebühren weiter, und der
            // Betrieb hielte die Übernahme für gescheitert.
            void (async () => {
              const res = await getProperty(p.id);
              if (res.ok) setP(res.data);
            })();
            void loadPlans();
            void loadAbgaben();
          }}
          onClose={() => setSection(null)}
        />
      )}

      {wizardOpen && (
        <RatePlanWizard
          propertyId={p.id}
          plans={plans}
          currency={cur}
          onDone={() => {
            setWizardOpen(false);
            toast.success(t("pricingForm.planCreated"));
            void loadPlans();
          }}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </PreisSpalte>
  );
}

// Generische Listen-Sektion (Fees/Promotions/Add-ons): Titel + Add + Liste.
function ListSection<T>({
  title,
  hint,
  onAdd,
  empty,
  items,
  render,
  localOnly,
  footer,
  extraAction,
}: {
  title: string;
  hint: string;
  onAdd: () => void;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
  localOnly?: boolean;
  /** Hinweis UNTER der Liste (gilt für die Liste als Ganzes, nicht je Zeile). */
  footer?: React.ReactNode;
  /** Zusätzliche Aktion LINKS neben „Hinzufügen" (z. B. „Beim Portal prüfen").
   *  Sie gehört zum Abschnitt, nicht zur Zeile: geprüft wird immer das ganze
   *  Objekt auf einmal, ein Knopf je Gebühr wären N Portal-Anfragen. */
  extraAction?: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <PreisAbschnitt
      title={title}
      hint={hint}
      badge={
        localOnly ? <PreisBadge>{t("pricingForm.directBookingsOnly")}</PreisBadge> : undefined
      }
      action={
        <div className="flex items-center gap-2">
          {extraAction}
          <PreisHinzufuegen label={t("pricingForm.add")} onClick={onAdd} />
        </div>
      }
    >
      {items.length === 0 ? <PreisLeer>{empty}</PreisLeer> : items.map(render)}
      {footer}
    </PreisAbschnitt>
  );
}

// Gastseitiger Name einer Promotion in der gewünschten Sprache, sonst der
// erste gepflegte. Ohne Rückfall stünde die Zeile leer da, obwohl ein Name
// existiert (nur in einer anderen Sprache).
function promoName(pm: Promotion, locale: string): string {
  return pm.name?.[locale]?.trim() || Object.values(pm.name ?? {})[0]?.trim() || "";
}

/** Dasselbe für ein Extra: `property_addons.name` ist mehrsprachig. */
function addonName(a: Addon, locale: string): string {
  return a.name?.[locale]?.trim() || Object.values(a.name ?? {})[0]?.trim() || "";
}

/** Zusammenfassung eines Extras für die Listenzeile: Betrag, Basis, und wo es
 *  überhaupt kaufbar ist. Die Flächen gehören dazu — ein Extra ohne Fläche sieht
 *  in der Liste sonst genauso fertig aus wie ein verkauftes. */
function extraSummary(
  a: Addon,
  cur: Currency | "",
  locale: string,
  t: (key: string) => string,
): string {
  const teile = [
    fmtPrice(a.price, cur, locale),
    t(`pricingForm.extraBasis.${a.basis}`),
  ];
  if (a.tax_rate != null) teile.push(`${a.tax_rate} %`);
  if (a.mandatory) teile.push(t("pricingForm.extraMandatoryShort"));
  teile.push(
    a.appears_in.length > 0
      ? a.appears_in.map((s) => t(`pricingForm.extraSurface.${s}`)).join(", ")
      : t("pricingForm.extraNoSurfaceShort"),
  );
  return teile.join(" · ");
}

// Zusammenfassung einer Promotion für die Listenzeile: der Rabatt plus der
// Hinweis, dass Bedingungen daran hängen — genau die Form des Branchenstandards
// („20% mit Bedingungen"). Welche Bedingungen es sind, steht im Editor; in der
// Zeile wären fünf Achsen unlesbar.
function promoSummary(
  pm: Promotion,
  cur: Currency | "",
  locale: string,
  t: (key: string) => string,
): string {
  const wert =
    pm.discount_kind === "fixed"
      ? fmtPrice(pm.discount_amount ?? 0, cur, locale)
      : `${Math.round((pm.discount_bps ?? 0) / 100)}%`;
  const hatBedingung =
    pm.min_nights != null ||
    pm.lead_min_days != null ||
    pm.lead_max_days != null ||
    (pm.stay_ranges ?? []).length > 0 ||
    Boolean(pm.booked_from) ||
    Boolean(pm.booked_to) ||
    (pm.promo_codes ?? []).length > 0;
  const teile = [wert];
  if (hatBedingung) teile.push(t("pricingForm.withConditionsSuffix"));
  if ((pm.portal_scope ?? []).length > 0) {
    teile.push(t("pricingForm.restrictedSuffix"));
  }
  return teile.join(" · ");
}

// Zusammenfassung einer Gebühr für die Listenzeile. Prozent und Betrag lesen
// sich unterschiedlich: ein Prozentsatz ist immer einmalig auf den Zimmerpreis,
// eine Basis dranzuschreiben wäre falsch.
function feeSummary(
  f: Fee,
  cur: Currency | "",
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  const teile: string[] = [];
  if ((f.mode ?? "amount") === "percent") {
    teile.push(`${f.amount}%`);
    teile.push(t("pricingForm.feeModePercentShort"));
  } else {
    teile.push(fmtPrice(f.amount, cur, locale));
    // Zwei Achsen („Einmaliger Betrag · Pro Nacht") aus denselben Schlüsseln, die
    // die Auswahlfelder im Editor tragen. Hier stand bis 04.08.2026 deutscher
    // Klartext aus einer Konstanten — in einer dänischen Oberfläche las die Zeile
    // „Einmalig pro Aufenthalt".
    teile.push(...FEE_BASIS_KEYS[f.basis].map((key) => t(key)));
  }
  if (f.taxRate != null) {
    teile.push(t("pricingForm.taxRateSuffix", { rate: f.taxRate }));
  }
  if (f.optional) teile.push(t("pricingForm.optionalSuffix"));
  // Gültigkeit und „nur Abrechnung" gehören in die Zeile: eine Gebühr „ab
  // 01.08." sieht sonst aus wie eine, die immer galt.
  if (f.validFrom) {
    teile.push(t("pricingForm.feeValidFromSuffix", { date: fmtDatum(f.validFrom, locale) }));
  }
  if (f.validUntil) {
    teile.push(t("pricingForm.feeValidUntilSuffix", { date: fmtDatum(f.validUntil, locale) }));
  }
  if (f.ownerStatementOnly) teile.push(t("pricingForm.feeOwnerStatementOnlySuffix"));
  if ((f.portalScope ?? []).length > 0) {
    teile.push(t("pricingForm.restrictedSuffix"));
  }
  return teile.join(" · ");
}

/** ISO-Datum in der Sprache der Oberfläche; unlesbar → wie gespeichert. */
function fmtDatum(iso: string, locale: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(locale);
}

// Zusammenfassung einer Steuer für die Listenzeile: Wert plus die Angaben, die
// den Betrag erst eindeutig machen — bei Beträgen die Basis („pro Gast · pro
// Nacht"), bei Prozentsätzen die gewählte Bemessungsgrundlage.
function taxSummary(
  tx: Tax,
  cur: Currency | "",
  locale: string,
  t: (key: string) => string,
): string {
  const teile: string[] = [];
  if (tx.mode === "percent") {
    teile.push(`${tx.value}%`);
    const basis = tx.taxableBase ?? [];
    if (basis.length > 0) {
      // Die Grundlage sind Kategorien, keine einzelnen Gebühren — mehrere
      // Gebührenarten fallen beim Portal auf dieselbe Kategorie.
      teile.push(
        basis
          .map((item) =>
            item === TAXABLE_BASE_PRICE
              ? t("pricingForm.taxableBasePrice")
              : t(`pricingForm.taxableBaseCategory.${item}`),
          )
          .join(", "),
      );
    }
  } else {
    const { charge, period } = taxAmountBasis(tx);
    teile.push(fmtPrice(tx.value, cur, locale));
    teile.push(
      charge === "PerPerson"
        ? t("pricingForm.chargePerPerson")
        : t("pricingForm.chargeSingle"),
    );
    teile.push(
      period === "PerNight"
        ? t("pricingForm.periodPerNight")
        : t("pricingForm.periodPerStay"),
    );
  }
  if (tx.includedInPrice) teile.push(t("pricingForm.includedInPriceSuffix"));
  return teile.join(" · ");
}

// Eine Listenzeile mit Pill + Bearbeiten/Löschen.
function ListRow({
  title,
  pill,
  badge,
  badgeTone,
  manualPortals,
  manualReason,
  live,
  onEdit,
  onDelete,
  onRestrict,
  onToggle,
  toggleLabel,
}: {
  title: string;
  pill: string;
  badge?: string;
  /** `info` (Standard) = Einschränkung/Umfang, `success` = aktiv geschaltet. */
  badgeTone?: "info" | "success";
  /** Portale, die diesen Posten NICHT automatisch bekommen — dort muss er im
   *  Extranet gepflegt werden. Kommt gerechnet vom Server (Wurzel 4: die Zeile
   *  behauptet nichts, was der Sync nicht belegt). */
  manualPortals?: string[];
  /** Warum diese Portale den Posten nicht bekommen (nur bei Promotions). Ohne
   *  den Grund liest sich der Chip als „geht dort nicht" ohne Hinweis darauf,
   *  was daran zu ändern wäre. */
  manualReason?: string;
  /** Zurückgelesener Stand beim Portal (leer = noch nie geprüft). */
  live?: AbgabeLiveStand[];
  onEdit: () => void;
  onDelete: () => void;
  /** Gesetzt bei Gebühren/Steuern: die Kanal-Einschränkung ist ein EIGENER
   *  Dialog neben Bearbeiten und Entfernen — sie gehört nicht zum Posten
   *  selbst, sondern regelt, wohin er geht. */
  onRestrict?: () => void;
  /** Gesetzt bei Extras: aktiv/inaktiv schalten. Eigener Menüpunkt wie im
   *  Standard, weil „vorübergehend nicht anbieten" der häufigere Fall ist als
   *  Löschen — das nimmt Übersetzungen und Fotos mit. */
  onToggle?: () => void;
  toggleLabel?: string;
}) {
  const t = useTranslations("objects");
  // Ein Menü, sobald es mehr als Bearbeiten und Entfernen gibt — sonst zwei
  // Symbole direkt in der Zeile (Branchenstandard).
  const menue = Boolean(onRestrict || onToggle);
  return (
    <PreisKarte
      title={title}
      badge={badge ? <PreisBadge tone={badgeTone}>{badge}</PreisBadge> : undefined}
      action={
        menue ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PreisSymbolAktion
                icon="ph:dots-three-vertical"
                label={t("pricingForm.actions")}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Icon icon="ph:pencil-simple" className="size-4" />
                {t("pricingForm.edit")}
              </DropdownMenuItem>
              {onToggle && (
                <DropdownMenuItem onClick={onToggle}>
                  <Icon icon="ph:eye-slash" className="size-4" />
                  {toggleLabel}
                </DropdownMenuItem>
              )}
              {onRestrict && (
                <DropdownMenuItem onClick={onRestrict}>
                  <Icon icon="ph:arrows-in-line-vertical" className="size-4" />
                  {t("pricingForm.restrictionsTitle")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onDelete}>
                <Icon icon="ph:trash" className="size-4" />
                {t("pricingForm.remove")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex shrink-0 items-center">
            <PreisSymbolAktion label={t("pricingForm.edit")} onClick={onEdit} />
            <PreisSymbolAktion icon="ph:trash" label={t("pricingForm.remove")} onClick={onDelete} />
          </div>
        )
      }
    >
      <PreisChip>{pill}</PreisChip>
      <ManuellerSyncChip portale={manualPortals ?? []} grund={manualReason} />
      <PortalStandChip stand={live ?? []} />
    </PreisKarte>
  );
}

/** Was beim Portal WIRKLICH steht — zurückgelesen, nicht behauptet.
 *
 *  Der Chip daneben („Manuelle Synchronisierung") sagt, wohin ein Posten NICHT
 *  geht. Dieser sagt, was am Inserat steht: derselbe Betrag (grün), ein anderer
 *  (dann mit BEIDEN Zahlen — ohne die fremde müsste der Betrieb im Extranet
 *  nachsehen, was gemeint ist) oder gar keiner.
 *
 *  Warum das eine eigene Aussage ist: am 11.08.2026 stand am Airbnb-Inserat
 *  eine Reinigungsgebühr von 1.590 DKK, bei uns 795 — und die Seite zeigte
 *  beide Seiten als in Ordnung. Ein „gesendet" ist kein „angekommen". */
function PortalStandChip({ stand }: { stand: AbgabeLiveStand[] }) {
  const t = useTranslations("objects");
  const locale = useLocale();
  if (stand.length === 0) return null;
  return (
    <>
      {stand.map((s) => (
        <PreisChip key={`${s.portal}-${s.status}`} tone={TON_JE_STAND[s.status]}>
          {t(`pricingForm.portalStand.${s.status}`)}
          <span className="inline-flex flex-wrap items-center gap-2">
            <PortalMarke code={s.portal} name={channelLabel(s.portal)} nurLogo />
          </span>
          {/* Der fremde Betrag gehört in den Chip, nicht in einen Tooltip: er
              IST der Befund. Fehlt die Währung, rendert `fmtPrice` symbollos
              statt einen Euro zu erfinden (Wurzel 4). */}
          {s.status === "abweichend" && s.amount !== null && (
            <span className="border-l border-border pl-2">
              {t("pricingForm.portalStandAbweichung", {
                dort: fmtPrice(s.amount, (s.currency ?? "") as Currency | "", locale),
              })}
            </span>
          )}
        </PreisChip>
      ))}
    </>
  );
}

/** Farbton je Stand. „fehlt" ist kein Fehler des Betriebs, sondern ein offener
 *  Punkt — deshalb neutral-warnend, nicht rot wie ein falscher Betrag. */
const TON_JE_STAND: Record<AbgabeLiveStand["status"], "ok" | "warn" | "muted"> = {
  online: "ok",
  abweichend: "warn",
  fehlt: "muted",
};

/** „Manuelle Synchronisierung" mit den Logos der betroffenen Portale — genau so
 *  führt es der Branchenstandard direkt am Posten. Der Chip erscheint NUR, wenn
 *  ein verbundenes Portal den Posten wirklich nicht nimmt; ohne echtes
 *  Markenlogo bleibt es beim Namen.
 *
 *  EIGENE Komponente, weil ihn zwei Listen tragen: Gebühren/Steuern/Aktionen
 *  über `ListRow` und die Preise nach Aufenthaltsdauer über ihre eigene Karte.
 *  Zwei Kopien wären zwei Wahrheiten über Bedingung und Wortlaut. */
function ManuellerSyncChip({
  portale,
  grund,
}: {
  portale: string[];
  /** Warum diese Portale den Posten nicht bekommen (Aktionen/Längenpreise).
   *  Ohne den Grund liest sich der Chip als „geht dort nicht" ohne Hinweis
   *  darauf, was daran zu ändern wäre. */
  grund?: string;
}) {
  const t = useTranslations("objects");
  if (portale.length === 0) return null;
  return (
    <PreisChip>
      {t("pricingForm.manualSyncLabel")}
      {/* Eigene Reihe mit 0.5rem Abstand: die echten Logos sind Wortmarken
          unterschiedlicher Breite und klebten mit dem Chip-Abstand von 0.25rem
          aneinander wie ein Wort. */}
      <span className="inline-flex flex-wrap items-center gap-2">
        {portale.map((code) => (
          <PortalMarke key={code} code={code} name={channelLabel(code)} nurLogo />
        ))}
      </span>
      {grund && (
        <span className="border-l border-border pl-2 text-muted-foreground">
          {grund}
        </span>
      )}
    </PreisChip>
  );
}

// --- Karten/Bausteine ------------------------------------------------------

function BlockCard({
  title,
  hint,
  hasValue,
  onEdit,
  localOnly,
  children,
}: {
  title: string;
  hint: string;
  /** Ist schon etwas eingerichtet? Dann führt der Stift hinein (Branchen-
   *  standard), sonst steht dort das Wort „Hinzufügen" — der Stift an einer
   *  leeren Karte behauptete, es gäbe etwas zu ändern. */
  hasValue?: boolean;
  onEdit: () => void;
  localOnly?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations("objects");
  return (
    <PreisKarte
      title={title}
      hint={hint}
      badge={
        localOnly ? <PreisBadge>{t("pricingForm.directBookingsOnly")}</PreisBadge> : undefined
      }
      action={
        hasValue ? (
          <PreisSymbolAktion label={t("pricingForm.edit")} onClick={onEdit} />
        ) : (
          <PreisTextAktion label={t("pricingForm.add")} onClick={onEdit} />
        )
      }
    >
      {children}
    </PreisKarte>
  );
}

// Geld-Eingabe mit Währungssuffix.
function MoneyInput({
  value,
  onChange,
  currency,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  // Wurzel 4: "" = noch keine Währung gewählt → Symbol bleibt leer, kein EUR.
  currency: Currency | "";
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
      <span className="text-sm text-muted-foreground">{currencySymbol(currency)}</span>
    </div>
  );
}

// --- Editoren ---------------------------------------------------------------

function CurrencyEditor({
  current,
  onSave,
  onClose,
}: {
  current: Currency | "";
  onSave: (next: Currency) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  // Vorbelegung nur mit einem gültigen Code; leer bleibt leer (kein erfundenes
  // Default-€, Wurzel 4) — Speichern ist dann deaktiviert.
  const [v, setV] = useState<Currency | "">(current);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.currencyTitle")}
      subtitle={t("pricingForm.currencyEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={error}
          onCancel={onClose}
          onSave={() => v && run(v)}
          disabled={!v}
        />
      }
    >
      <Field label={t("pricingForm.currencyLabel")}>
        <Select value={v || undefined} onValueChange={(val) => setV(val as Currency)}>
          <SelectTrigger>
            <SelectValue placeholder={t("pricingForm.currencyNotSet")} />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Hint>{t("pricingForm.currencyEditorHint")}</Hint>
    </EditorShell>
  );
}

function BaseEditor({
  pr,
  reichweite,
  dpEnabled,
  propertyId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  reichweite: Reichweite;
  /** Ist Dynamic Pricing für DIESES Objekt an? Der Standard schreibt den echten
   *  Zustand in den Editor („Dynamic Pricing: AUS" + Einstellungen) — ein reiner
   *  Werbehinweis lässt offen, ob die Tagespreise gerade automatisch entstehen. */
  dpEnabled: boolean;
  propertyId: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.basePriceTitle")}
      subtitle={t("pricingForm.baseEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <PortalReichweite schluessel="base_price" {...reichweite} />

      {/* Währung wird zentral am Objekt gepflegt (Sektion „Währung" oben) und
          gilt für alle Preispläne — hier nur read-only, kein zweites Select. */}
      <Field label={t("pricingForm.currencyLabel")}>
        <div className="rounded-(--radius) border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {v.currency
            ? (CURRENCY_OPTIONS.find((o) => o.value === v.currency)?.label ?? v.currency)
            : t("pricingForm.currencyNotSet")}
        </div>
      </Field>

      {/* Echter Zustand statt Werbetext, und der Link führt auf DIESES Objekt.
          Vorher stand hier ein Satz über Dynamic Pricing im Allgemeinen mit einem
          Link auf die Übersicht — wer wissen wollte, ob die 450 kr überhaupt noch
          der verkaufte Preis sind, erfuhr es hier nicht. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) bg-accent/10 p-3 text-sm">
        <span className="flex items-center gap-2">
          <Icon icon="ph:lightning" className="size-4 shrink-0 text-accent" />
          <span className="font-medium">
            {dpEnabled
              ? t("pricingForm.dynamicStateOn")
              : t("pricingForm.dynamicStateOff")}
          </span>
        </span>
        <Link
          href={`/dynamic-pricing/${propertyId}`}
          className="font-semibold text-accent underline"
        >
          {t("pricingForm.dynamicSettings")}
        </Link>
        <span className="w-full text-xs text-muted-foreground">
          {dpEnabled
            ? t("pricingForm.dynamicStateOnHint")
            : t("pricingForm.dynamicStateOffHint")}
        </span>
      </div>

      <Field
        label={t("pricingForm.basePricePerNightLabel")}
        // Mit Wochentagspreisen wird der eine Grundpreis nicht mehr verkauft: es
        // gilt der Preis des jeweiligen Tages. Der Standard sperrt das Feld dann,
        // statt zwei widersprüchliche Zahlen editierbar zu lassen.
        hint={v.customByWeekday ? t("pricingForm.baseDisabledByWeekday") : undefined}
      >
        <MoneyInput
          value={v.basePrice}
          currency={v.currency}
          disabled={v.customByWeekday}
          onChange={(n) => setV({ ...v, basePrice: n })}
        />
      </Field>

      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">{t("pricingForm.customByWeekdayLabel")}</span>
        <Switch checked={v.customByWeekday} onCheckedChange={(c) => setV({ ...v, customByWeekday: c })} />
      </label>

      {v.customByWeekday && (
        <div className="flex flex-col gap-2">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="w-8 text-sm text-muted-foreground">{d.label}</span>
              <MoneyInput
                value={v.weekdayPrices[d.key]}
                currency={v.currency}
                onChange={(n) => setV({ ...v, weekdayPrices: { ...v.weekdayPrices, [d.key]: n } })}
              />
            </div>
          ))}
        </div>
      )}
    </EditorShell>
  );
}

// Portal-Logo + Name eines verbundenen Portals; ohne echtes Logo nur der Name.
// KEIN generisches Ersatz-Icon (ausdrückliche Vorgabe, lib/channel-logos): ein
// Platzhalter-Symbol sähe nach „irgendein Kanal" aus.
function PortalMarke({
  code,
  name,
  nurLogo,
}: {
  code: string;
  name: string;
  /** Im Chip „Manuelle Synchronisierung" stehen bis zu drei Portale neben
   *  Fließtext — dort trägt nur das Logo, der Name würde die Zeile sprengen.
   *  Ohne Logo bleibt der Name, sonst stünde da nichts. */
  nurLogo?: boolean;
}) {
  const logo = channelLogoLoose(code) ?? channelLogoLoose(name);
  if (nurLogo) {
    // Feste HÖHE, freie Breite: die echten Logos sind teils Wortmarken
    // (Booking.com, Expedia). In ein 16×16-Quadrat gequetscht werden sie zu
    // einem grauen Strich — man sieht, dass da etwas ist, aber nicht welches
    // Portal. Genau die Information trägt der Chip aber.
    return logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={name}
        title={name}
        className="h-4 w-auto max-w-16 shrink-0 self-center rounded-sm object-contain"
      />
    ) : (
      // Ohne Logo trägt der Name dieselbe optische Masse wie ein Logo (gleiche
      // Höhe, kleine Fläche) — als Fließtext zwischen zwei Bildern wirkte die
      // Reihe gekippt.
      <span
        title={name}
        className="inline-flex h-4 shrink-0 items-center rounded-sm bg-background px-1 text-[0.6875rem] font-medium leading-none text-foreground"
      >
        {name}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-2">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" className="size-4 shrink-0 rounded-sm object-contain" />
      )}
      <span className="truncate text-sm font-medium">{name}</span>
    </span>
  );
}

function PortalAdjustmentsCard({
  propertyId,
  plans,
}: {
  propertyId: string;
  plans: RatePlan[];
}) {
  // Preisänderung je Portal (Lodgify-Modell „Aufschlag"): Karte zeigt nur die
  // gesetzten Aufschläge als Chips, der Stift öffnet ein Sheet mit allen
  // verbundenen Portalen. Technisch ist jeder Aufschlag ein automatisch
  // gepflegter Kanal-Plan (portal_scope) auf die effektive Tageskurve GENAU
  // dieses Portals — er ersetzt den früheren „Mark-up", der eine Attrappe war.
  // Werte kommen aus `plans` (Realtime auf rate_plans hält sie frisch).
  const t = useTranslations("objects");
  const [conns, setConns] = useState<StoredChannelConnection[] | null>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    void (async () => {
      const res = await listChannelConnections(propertyId);
      if (res.ok) setConns(res.data.items);
    })();
  }, [propertyId]);

  const wert = (portal: string): number =>
    plans.find((pl) => pl.portal_scope === portal)?.offset_percent ?? 0;
  // JEDES verbundene Portal steht hier, auch mit 0 % — nicht nur die mit Wert.
  // Vorher filterte diese Zeile auf `!== 0`, und damit war ein Portal ohne
  // Aufschlag in der ganzen Oberfläche unsichtbar: der Kanal-Plan
  // („Grundpreis · BookingCom", portal_scope) erscheint bewusst NICHT in der
  // Preisplan-Liste (s. `verkaufsplaene`), also gab es überhaupt keine Stelle,
  // an der man ihn sehen oder anfassen konnte.
  //
  // Alle verbundenen Kanäle zu zeigen ist zudem Branchenstandard (recherchiert
  // 13.08.2026): Lodgify „set a mark-up for each OTA the rental is connected
  // to", Guesty „for each booking channel, enter the percentage", Hostaway mit
  // einer Alle-Kanäle-Tabelle, Cloudbeds mit einer Zeile je Zimmertyp. Kein
  // Anbieter versteckt einen Kanal, weil sein Wert 0 ist — die Liste hängt an
  // der VERBINDUNG, nicht am Vorhandensein eines Wertes.
  const portale = conns ?? [];

  return (
    <>
      <PreisKarte
        title={t("pricingForm.portalAdjustmentTitle")}
        hint={t("pricingForm.portalAdjustmentHint")}
        action={
          <PreisSymbolAktion
            label={t("pricingForm.edit")}
            disabled={!conns?.length}
            onClick={() => setOffen(true)}
          />
        }
      >
        {conns !== null && conns.length === 0 ? (
          <PreisLeer>{t("pricingForm.portalAdjustmentNone")}</PreisLeer>
        ) : (
          portale.map((c) => {
            const v = wert(c.portal_code);
            const logo = channelLogoLoose(c.portal_code) ?? channelLogoLoose(c.portal);
            return (
              <span key={c.portal_code} title={c.portal}>
                <PreisChip>
                  {v > 0 ? "+" : ""}
                  {v}%
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={c.portal} className="size-4 rounded-sm object-contain" />
                  ) : (
                    c.portal
                  )}
                </PreisChip>
              </span>
            );
          })
        )}
      </PreisKarte>
      {offen && conns && (
        <PortalAdjustmentsEditor
          propertyId={propertyId}
          conns={conns}
          wert={wert}
          onClose={() => setOffen(false)}
        />
      )}
    </>
  );
}

function PortalAdjustmentsEditor({
  propertyId,
  conns,
  wert,
  onClose,
}: {
  propertyId: string;
  conns: StoredChannelConnection[];
  wert: (portal: string) => number;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [entwurf, setEntwurf] = useState<Record<string, string>>(() =>
    Object.fromEntries(conns.map((c) => [c.portal_code, String(wert(c.portal_code))])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ein Speichern für alle Portale; jedes Portal ist ein eigener
  // Endpoint-Aufruf (eigener Kanal-Plan). Ein Fehler bricht ab und lässt das
  // Sheet offen — bereits gespeicherte Portale bleiben gespeichert (Teilstand
  // ist sichtbar, weil die Karte per Realtime folgt).
  //
  // JEDER Wert geht raus, auch ein unveränderter. Vorher wurde gegen den Wert
  // in unserer DB verglichen und bei Gleichheit gar nichts gesendet — „bei uns
  // gleich" heißt aber nicht „beim Portal angekommen". Genau so stand ein
  // Aufschlag von 5 % in der Oberfläche, während der Kanal ihn nie erhalten
  // hatte, und Speichern schloss nur das Fenster. Der Endpunkt ist idempotent.
  const speichern = async () => {
    const zuAendern: Array<[string, number]> = [];
    for (const c of conns) {
      const roh = entwurf[c.portal_code] ?? "";
      const n = Number(roh.trim().replace(",", "."));
      if (roh.trim() === "" || !Number.isFinite(n) || n < -99 || n > 500) {
        setError(t("pricingForm.portalAdjustmentInvalid"));
        return;
      }
      zuAendern.push([c.portal_code, n]);
    }
    if (zuAendern.length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    for (const [portal, prozent] of zuAendern) {
      const res = await setPortalPriceAdjustment(propertyId, portal, prozent);
      if (!res.ok) {
        setBusy(false);
        setError(res.error);
        return;
      }
    }
    setBusy(false);
    toast.success(t("pricingForm.portalAdjustmentSaved"));
    onClose();
  };

  return (
    <EditorShell
      title={t("pricingForm.portalAdjustmentTitle")}
      subtitle={t("pricingForm.portalAdjustmentEditorSubtitle")}
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => void speichern()} />
      }
    >
      {conns.map((c) => (
        <Field key={c.portal_code} label={<PortalMarke code={c.portal_code} name={c.portal} />}>
          <div className="relative">
            <Input
              value={entwurf[c.portal_code] ?? ""}
              onChange={(e) =>
                setEntwurf((prev) => ({ ...prev, [c.portal_code]: e.target.value }))
              }
              inputMode="decimal"
              className="pr-8"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
        </Field>
      ))}
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <Icon icon="ph:arrow-elbow-down-right" className="mt-0.5 size-4 shrink-0" />
        <span>{t("pricingForm.portalAdjustmentDirectNote")}</span>
      </p>
    </EditorShell>
  );
}

function ExtraGuestEditor({
  pr,
  reichweite,
  onSave,
  onClose,
}: {
  pr: Pricing;
  reichweite: Reichweite;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.extraGuestTitle")}
      subtitle={t("pricingForm.extraGuestEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <PortalReichweite schluessel="extra_guest" {...reichweite} />

      <Field label={t("pricingForm.extraGuestTitle")}>
        <MoneyInput value={v.extraGuestCharge} currency={v.currency} onChange={(n) => setV({ ...v, extraGuestCharge: n })} />
      </Field>
      <Field label={t("pricingForm.extraGuestFromLabel")}>
        <Select value={String(v.extraGuestFrom)} onValueChange={(val) => setV({ ...v, extraGuestFrom: Number(val) })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={String(n)}>{t("pricingForm.guestCount", { count: n })}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </EditorShell>
  );
}

function ShortStayEditor({
  pr,
  reichweite,
  onSave,
  onClose,
}: {
  pr: Pricing;
  reichweite: Reichweite;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.shortStayTitle")}
      subtitle={t("pricingForm.shortStayHint")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <PortalReichweite schluessel="short_stay" {...reichweite} />

      <Field label={t("pricingForm.shortStayMaxLabel")}>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={v.shortStayMaxNights}
            onChange={(e) => setV({ ...v, shortStayMaxNights: Number(e.target.value) || 0 })}
          />
          <span className="text-sm text-muted-foreground">{t("pricingForm.nightsUnit")}</span>
        </div>
      </Field>
      <Field label={t("pricingForm.surchargePerNightLabel")}>
        <MoneyInput value={v.shortStaySurcharge} currency={v.currency} onChange={(n) => setV({ ...v, shortStaySurcharge: n })} />
      </Field>
    </EditorShell>
  );
}

function LengthEditor({
  pr,
  reichweite,
  kind,
  editId,
  onSave,
  onClose,
}: {
  pr: Pricing;
  reichweite: Reichweite;
  kind: StayKind;
  editId?: string;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const existing = editId ? pr.lengthPrices.find((x) => x.id === editId) : undefined;
  const defaultMin = kind === "weekly" ? 7 : kind === "monthly" ? 30 : 14;
  const [minNights, setMinNights] = useState(existing?.minNights ?? defaultMin);
  const [price, setPrice] = useState(existing?.pricePerNight ?? 0);
  // GESAMTPREIS ist das Eingabefeld des Standards („Wöchentlicher Gesamtpreis
  // kr 2835"), weil man so einkauft und weil so auch die Portale ihre
  // Wochenpreise führen. Gespeichert wird weiter der NACHTPREIS: nur er ist
  // eindeutig, wenn die Regel „7 Nächte ODER MEHR" heißt, und nur ihn liest der
  // Preis-Resolver. Beide Felder hängen aneinander — wer eines tippt, sieht das
  // andere sofort, statt raten zu müssen, welche Zahl gilt.
  const [gesamt, setGesamt] = useState<string>(
    existing ? String(lengthTotal(existing.pricePerNight, existing.minNights)) : "",
  );
  const { busy, error, run } = useSaver(onSave);

  /** Gesamtpreis geändert → Nachtpreis nachziehen. */
  function gesamtSetzen(text: string, naechte = minNights) {
    setGesamt(text);
    const zahl = Number(text.replace(",", "."));
    setPrice(Number.isFinite(zahl) && zahl > 0 ? lengthPerNight(zahl, naechte) : 0);
  }

  /** Nächtezahl geändert → der Gesamtpreis bleibt, der Nachtpreis folgt. Der
   *  Betrieb hat den Gesamtpreis eingegeben; ihn beim Ändern der Nächtezahl
   *  umzurechnen wäre eine Preisänderung, die niemand angefordert hat. */
  function naechteSetzen(naechte: number) {
    setMinNights(naechte);
    gesamtSetzen(gesamt, naechte);
  }

  function commit() {
    const entry: LengthPrice = {
      id: existing?.id ?? crypto.randomUUID(),
      kind,
      minNights,
      pricePerNight: price,
    };
    const list = existing
      ? pr.lengthPrices.map((x) => (x.id === entry.id ? entry : x))
      : [...pr.lengthPrices, entry];
    run({ ...pr, lengthPrices: list });
  }

  return (
    <EditorShell
      title={t(STAY_KIND_KEYS[kind])}
      subtitle={t("pricingForm.lengthEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={commit} disabled={price <= 0} />}
    >
      <PortalReichweite schluessel="length_prices" {...reichweite} />

      <Field label={t("pricingForm.minNightsLabel")}>
        <Input
          type="number"
          min={1}
          value={minNights}
          onChange={(e) => naechteSetzen(Number(e.target.value) || 1)}
          disabled={kind !== "custom"}
        />
      </Field>
      <Field
        label={t("pricingForm.lengthTotalLabel")}
        hint={t("pricingForm.lengthTotalHint", { nights: minNights })}
        required
      >
        <div className="flex items-center gap-2">
          <Input
            inputMode="decimal"
            value={gesamt}
            placeholder="0"
            onChange={(e) => gesamtSetzen(e.target.value)}
          />
          <span className="min-w-8 text-sm text-muted-foreground">
            {currencySymbol(pr.currency)}
          </span>
        </div>
      </Field>
      {/* Der abgeleitete Nachtpreis, nicht editierbar: er ist der gespeicherte
          Wert, aber die Eingabe ist der Gesamtpreis. Zwei tippbare Felder für
          eine Zahl hießen „welches gewinnt?". */}
      <Field label={t("pricingForm.reducedPricePerNightLabel")}>
        <div className="rounded-(--radius) border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {price > 0 ? fmtPrice(price, pr.currency, locale) : "—"}
        </div>
      </Field>
    </EditorShell>
  );
}

// --- Etappe-2-Editoren ------------------------------------------------------

function TaxInfoEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.taxInfoTitle")}
      subtitle={t("pricingForm.taxInfoEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.businessTaxIdLabel")}>
        <Input value={v.businessTaxId} onChange={(e) => setV({ ...v, businessTaxId: e.target.value })} placeholder={t("pricingForm.taxIdPlaceholder")} />
      </Field>
      <Field label={t("pricingForm.totRegistrationIdLabel")}>
        <Input value={v.totRegistrationId} onChange={(e) => setV({ ...v, totRegistrationId: e.target.value })} placeholder={t("pricingForm.taxIdPlaceholder")} />
      </Field>
    </EditorShell>
  );
}

function BaseLabelEditor({
  pr,
  onSave,
  onClose,
}: {
  pr: Pricing;
  onSave: (next: Pricing) => Promise<true | string>;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [v, setV] = useState(pr);
  const { busy, error, run } = useSaver(onSave);
  return (
    <EditorShell
      title={t("pricingForm.baseLabelEditorTitle")}
      subtitle={t("pricingForm.baseLabelEditorSubtitle")}
      onClose={onClose}
      footer={<Footer busy={busy} error={error} onCancel={onClose} onSave={() => run(v)} />}
    >
      <Field label={t("pricingForm.nameLabel")}>
        <Input
          value={v.basePriceLabel}
          maxLength={100}
          onChange={(e) => setV({ ...v, basePriceLabel: e.target.value })}
          placeholder={t("pricingForm.baseLabelPlaceholder")}
        />
      </Field>
    </EditorShell>
  );
}

// Preisplan-Liste (SiteMinder „Rate plans"): eine Zeile je Plan mit Modus,
// Grundpreis bzw. „berechnet" (abgeleitet), Mindestaufenthalt und Aktionen.
// Preise selbst werden datumsgenau im Kalender gepflegt — von hier führt nur
// der Deep-Link dorthin.
function RatePlanList({
  plans,
  currency,
  onCreate,
  onDeleted,
}: {
  plans: RatePlan[];
  currency: Currency | "";
  onCreate: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("objects");
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Welcher Plan wird gerade im Mindestaufenthalt-Sheet gepflegt? */
  const [minStayEdit, setMinStayEdit] = useState<RatePlan | null>(null);
  /** Welcher Plan wird gerade im Preis-Sheet gepflegt? */
  const [priceEdit, setPriceEdit] = useState<RatePlan | null>(null);

  const offsetLabel = (p: RatePlan): string => {
    const parts: string[] = [];
    if (p.offset_amount != null && p.offset_amount !== 0) {
      parts.push(`${p.offset_amount > 0 ? "+" : ""}${fmtPrice(p.offset_amount, currency, locale)}`);
    }
    if (p.offset_percent != null && p.offset_percent !== 0) {
      parts.push(`${p.offset_percent > 0 ? "+" : ""}${p.offset_percent} %`);
    }
    return parts.length ? parts.join(" · ") : "1:1";
  };

  // Portal-Freigabe umschalten. Sie war vorher eine EINBAHNSTRASSE: der Wizard
  // fragt „Diesen Preis an die Buchungsportale senden" ab, die Plan-Liste zeigte
  // das Ergebnis aber nirgends und bot keinen Weg zurück. Das PATCH-Feld gab es
  // längst (`updateRatePlan`), nur keine Oberfläche dafür.
  const toggleSend = async (p: RatePlan) => {
    setBusy(p.id);
    setErr(null);
    const res = await updateRatePlan(p.id, { sendToPortals: !p.send_to_portals });
    setBusy(null);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.success(
      t(p.send_to_portals ? "pricingForm.planPortalOff" : "pricingForm.planPortalOn"),
    );
    onDeleted(); // lädt die Liste neu (derselbe Weg wie nach dem Löschen)
  };

  const remove = async (id: string) => {
    // Löschen nimmt auch die Datumspreise des Plans mit — Fehlklick auf das
    // Trash-Icon darf das nicht still tun (Projekt-Muster: window.confirm).
    if (!window.confirm(t("pricingForm.planConfirmDelete"))) return;
    setBusy(id);
    setErr(null);
    const res = await deleteRatePlan(id);
    setBusy(null);
    // 409 = Basis-Plan hat abgeleitete Kinder (Server-Guard) — Meldung zeigen.
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.success(t("pricingForm.planDeleted"));
    onDeleted();
  };

  return (
    <PreisKarte
      title={t("pricingForm.plansTitle")}
      hint={t("pricingForm.plansHint")}
      action={
        <div className="flex shrink-0 items-center">
          <PreisTextAktion asChild>
            <a href="/kalender?view=rates">{t("pricingForm.openCalendar")}</a>
          </PreisTextAktion>
          <PreisTextAktion onClick={onCreate}>
            <Icon icon="ph:plus" className="size-4" />
            {t("pricingForm.planCreate")}
          </PreisTextAktion>
        </div>
      }
    >
      {err && <p className="w-full text-[0.8125rem] leading-5 text-destructive">{err}</p>}

      <ul className="flex w-full flex-col divide-y">
        {plans.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="flex min-w-0 flex-1 items-center gap-1.5">
              <span className="min-w-0 truncate text-[0.8125rem] font-medium leading-5">
                {p.name}
              </span>
              {/* Was diese Zeile IST, muss ablesbar sein. Ein zusaetzlicher Plan
                  mit `send_to_portals` ist keine hausinterne Preisvariante,
                  sondern entspricht einer Ratenkategorie beim Portal (Bookings
                  „Wochenrate") — mit eigenem Preis und eigenem
                  Mindestaufenthalt. Ohne diese Kennzeichnung sieht er aus wie
                  ein beliebiger zweiter Preis, und niemand versteht, warum sein
                  min_stay dort drueben etwas anderes bewirkt als am Grundpreis.
                  Der Grundpreis selbst ([0]) traegt das Badge nicht: er geht
                  ohnehin immer an alle Portale und ist keine eigene Kategorie. */}
              {p.id !== plans[0]?.id
                && (p.send_to_portals || istLangzeitRate(p.name)) ? (
                <PreisBadge>{t("pricingForm.planPortalRate")}</PreisBadge>
              ) : null}
            </span>
            <PreisChip>
              {p.rate_mode === "derived"
                ? t("pricingForm.planModeDerived", {
                    parent: p.derived_from_name ?? "",
                    offset: offsetLabel(p),
                  })
                : t("pricingForm.planModeManual")}
            </PreisChip>
            {/* Preis: BEARBEITBAR, nicht nur angezeigt. Eine Portal-Rate wie
                Bookings „Wochenrate" ist erst ein RABATT, wenn ihr Nachtpreis
                unter dem Grundpreis liegt. Erbt sie den Grundpreis und laesst
                sich hier nicht senken, ist sie ein zweiter Standardpreis —
                genau der live gemessene Zustand (beide Booking-Raten trugen
                denselben Betrag). Die Zahl ist deshalb ein Knopf, gleiches
                Muster wie der Mindestaufenthalt daneben.
                AUSNAHME abgeleiteter Plan: er hat keinen eigenen Basispreis
                (Waehrung und Basis gehoeren dem Parent), und das Backend weist
                ein `base_price`-PATCH mit 422 ab. Dort bleibt der Preis Text —
                eine Eingabe, die nie speichern kann, waere eine Attrappe. */}
            {p.rate_mode === "derived" ? (
              <span className="w-24 shrink-0 text-right text-[0.8125rem] leading-5 tabular-nums">
                {t("pricingForm.planDerivedPrice")}
              </span>
            ) : (
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => setPriceEdit(p)}
                title={t("pricingForm.planPriceEdit")}
                className="w-24 shrink-0 rounded-full px-2 py-0.5 text-right text-[0.8125rem] leading-5 tabular-nums underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
              >
                {fmtPrice(p.base_price, (p.currency || "") as Currency | "", locale)}
              </button>
            )}
            {/* Mindestaufenthalt: BEARBEITBAR, nicht nur angezeigt. Booking
                fuehrt Restriktionen auf RATE-Ebene — jede Ratenkategorie
                braucht ihren eigenen Wert, und eine „Wochenrate" ohne
                min_stay 7 verkauft dort Einzelnaechte zum Wochenpreis (live
                belegt 23.08.2026: 1-Nacht-Buchung ueber die Wochenrate).
                Die Zahl ist deshalb ein Knopf, kein Text. */}
            <button
              type="button"
              disabled={busy === p.id}
              onClick={() => setMinStayEdit(p)}
              title={t("pricingForm.planMinStayEdit")}
              className="w-28 shrink-0 rounded-full px-2 py-0.5 text-right text-xs leading-4 text-muted-foreground underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground disabled:opacity-50"
            >
              {t("pricingForm.planMinStay", { nights: p.min_stay })}
            </button>
            {/* Portal-Freigabe: nur bei ZUSÄTZLICHEN Plänen. Der Grundpreis geht
                ohnehin immer an die Portale (channels._selected_rate_plan_ids
                nimmt ihn ungefragt mit) — dort wäre ein Schalter eine Lüge.
                Bei einer PORTAL-RATE ebenso: ihre Ratenkategorie verkauft beim
                Portal bereits (der Betrieb hat sie im Extranet angelegt), und
                sie bekommt dort ihren Preis und ihren Mindestaufenthalt.
                „Nur direkt" waere dort schlicht falsch — und die Folge des
                Schalters ist nicht „nicht senden", sondern „ohne
                Restriktionen verkaufen lassen": genau der Zustand, ueber den am
                23.08.2026 eine 1-Nacht-Buchung an einem Objekt mit
                Mindestaufenthalt 3 kam. Ob eine Portal-Rate zugeordnet wird,
                haengt deshalb serverseitig nicht mehr am Flag
                (`objekt_kanal.freigegebene_plaene_zuordnen`), und hier gibt es
                keinen Schalter, der etwas anderes behauptet. */}
            {plans.length > 1 && p.id !== plans[0]?.id
              && !istLangzeitRate(p.name) ? (
              <button
                type="button"
                disabled={busy === p.id}
                onClick={() => void toggleSend(p)}
                title={t(
                  p.send_to_portals
                    ? "pricingForm.planPortalOnHint"
                    : "pricingForm.planPortalOffHint",
                )}
                className="shrink-0 rounded-full px-2 py-0.5 text-xs leading-4 transition-colors disabled:opacity-50"
              >
                <PreisChip>
                  <Icon
                    icon={p.send_to_portals ? "ph:broadcast" : "ph:prohibit"}
                    className="size-3.5"
                  />
                  {t(
                    p.send_to_portals
                      ? "pricingForm.planPortalYes"
                      : "pricingForm.planPortalNo",
                  )}
                </PreisChip>
              </button>
            ) : null}
            <PreisSymbolAktion
              icon="ph:trash"
              label={t("pricingForm.planDelete")}
              disabled={busy === p.id}
              onClick={() => void remove(p.id)}
            />
          </li>
        ))}
      </ul>

      {minStayEdit && (
        <PlanMinStayEditor
          plan={minStayEdit}
          onClose={() => setMinStayEdit(null)}
          onSaved={() => {
            setMinStayEdit(null);
            onDeleted(); // laedt die Liste neu (derselbe Weg wie nach dem Loeschen)
          }}
        />
      )}

      {priceEdit && (
        <PlanPriceEditor
          plan={priceEdit}
          locale={locale}
          onClose={() => setPriceEdit(null)}
          onSaved={() => {
            setPriceEdit(null);
            onDeleted(); // laedt die Liste neu (derselbe Weg wie nach dem Loeschen)
          }}
        />
      )}
    </PreisKarte>
  );
}

// Mindestaufenthalt EINES Preisplans pflegen. Eigenes Sheet statt Inline-Feld,
// weil der Wert an die Portale geht und dort auf Ratenebene wirkt — das
// verdient eine Erklaerung neben der Eingabe, die in eine 7rem breite Zelle
// nicht passt. Geschrieben wird per `updateRatePlan({ minStay })`, also GENAU
// dieser Plan; Preis, Name und Portal-Freigabe bleiben unberuehrt (Wurzel 1).
//
// Was hier NICHT passiert: der datumsgenaue Mindestaufenthalt
// (`rate_plan_min_stay_overrides`, Kalender). Der hier gesetzte Wert ist der
// Default des Plans, den ein Datums-Override punktuell ueberschreibt.
function PlanMinStayEditor({
  plan,
  onClose,
  onSaved,
}: {
  plan: RatePlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("objects");
  // Als Text gehalten, damit das Feld beim Loeschen der Ziffer leer sein darf
  // statt auf eine erfundene 1 zu springen (Wurzel 4: kein Ersatzwert).
  const [v, setV] = useState(String(plan.min_stay));
  const { busy, error, run } = useSaver(async () => {
    const naechte = Number.parseInt(v, 10);
    if (!Number.isFinite(naechte) || naechte < 1 || naechte > 365) {
      return t("pricingForm.planMinStayInvalid");
    }
    const res = await updateRatePlan(plan.id, { minStay: naechte });
    if (!res.ok) return res.error;
    toast.success(t("pricingForm.planMinStaySaved"));
    onSaved();
    return true;
  });
  return (
    <EditorShell
      title={t("pricingForm.planMinStayEditorTitle")}
      subtitle={t("pricingForm.planMinStayEditorSubtitle", { plan: plan.name })}
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => void run()} />
      }
    >
      <Field
        label={t("pricingForm.planMinStayLabel")}
        hint={t("pricingForm.planMinStayFieldHint")}
      >
        <Input
          type="number"
          min={1}
          max={365}
          inputMode="numeric"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      </Field>
      <Hint>{t("pricingForm.planMinStayPortalHint")}</Hint>
    </EditorShell>
  );
}

// Ist der Plan-Name eine Wochen-/Monatsrate? Nur fuer den ZUSATZ-Hinweis im
// Preis-Sheet, nicht fuer Logik: bei einer Wochenrate ist der hier gesetzte
// Betrag der RABATT-Preis pro Nacht, und das ist beim Eintippen die
// entscheidende Information. Der Name ist die einzige Quelle dafuer — die
// Portal-Rate wird lokal mit dem Titel der Portal-Ratenkategorie angelegt
// (`portal_raten_plaene.py`), eine eigene Spalte „das ist eine Wochenrate"
// gibt es nicht. Erkannt wird deshalb bewusst nur der Name, in den Sprachen,
// in denen die Portale diese Kategorien benennen; greift die Erkennung nicht,
// fehlt lediglich ein Zusatzsatz — es wird nichts falsch gespeichert.
function istLangzeitRate(name: string): boolean {
  const n = name.toLowerCase();
  return [
    "woche",
    "wochen",
    "week",
    "weekly",
    "uge",
    "ugentlig",
    "monat",
    "month",
    "monthly",
    "maaned",
  ].some((wort) => n.includes(wort));
}

// Preis EINES Preisplans pflegen. Eigenes Sheet statt Inline-Feld, aus demselben
// Grund wie beim Mindestaufenthalt: der Wert geht an die Buchungsportale und
// wirkt dort auf Ratenebene — das braucht eine Erklaerung neben der Eingabe.
// Geschrieben wird per `updateRatePlan({ basePrice })`, also GENAU der Preis
// dieses Plans; Name, Mindestaufenthalt und Portal-Freigabe bleiben unberuehrt
// (Wurzel 1). Das Backend reiht danach `reconcile_rate_plan_prices` ein, das
// die Preiskurve dieses Plans an die Portale pusht
// (`rates/service.py` -> `channel_manager/ari_push.py`).
//
// Was hier NICHT passiert: die datumsgenauen Preise
// (`rate_plan_price_overrides`, Kalender). Der hier gesetzte Betrag ist der
// Grundwert des Plans, den ein Datums-Preis punktuell ueberschreibt.
//
// Abgeleitete Plaene erreichen dieses Sheet nicht (die Liste zeigt dort Text) —
// sie haben keinen eigenen Basispreis und das Backend weist ihren
// `base_price`-PATCH mit 422 ab.
function PlanPriceEditor({
  plan,
  locale,
  onClose,
  onSaved,
}: {
  plan: RatePlan;
  locale: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("objects");
  // Waehrung kommt AUS DEM PLAN (Wurzel 4: nie ein hartes Symbol, nie ein
  // EUR-Ersatzwert). Fehlt sie, rendert `currencySymbol` symbollos statt zu
  // raten — die Zahl bleibt eingebbar, nur das Symbol fehlt.
  const cur = (plan.currency || "") as Currency | "";
  // Als Text gehalten, damit das Feld beim Loeschen der Ziffer leer sein darf
  // statt auf eine erfundene 0 zu springen (Wurzel 4: kein Ersatzwert).
  const [v, setV] = useState(String(plan.base_price));
  const { busy, error, run } = useSaver(async () => {
    // Komma wie Punkt akzeptieren: die meisten der 27 Laender tippen das
    // Dezimalkomma. Nur die Eingabe wird normalisiert, gespeichert wird eine
    // Zahl.
    const betrag = Number.parseFloat(v.replace(",", "."));
    if (!Number.isFinite(betrag) || betrag <= 0) {
      return t("pricingForm.planPriceInvalid");
    }
    const res = await updateRatePlan(plan.id, { basePrice: betrag });
    if (!res.ok) return res.error;
    toast.success(t("pricingForm.planPriceSaved"));
    onSaved();
    return true;
  });
  return (
    <EditorShell
      title={t("pricingForm.planPriceEditorTitle")}
      subtitle={t("pricingForm.planPriceEditorSubtitle", { plan: plan.name })}
      onClose={onClose}
      footer={
        <Footer busy={busy} error={error} onCancel={onClose} onSave={() => void run()} />
      }
    >
      <Field
        label={t("pricingForm.planPriceLabel", {
          currency: currencySymbol(cur, locale),
        })}
        hint={t("pricingForm.planPriceFieldHint")}
      >
        <Input
          type="number"
          min={0}
          step="0.01"
          inputMode="decimal"
          value={v}
          onChange={(e) => setV(e.target.value)}
        />
      </Field>
      <Hint>{t("pricingForm.planPricePortalHint")}</Hint>
      {/* Bei einer Wochen-/Monatsrate zusaetzlich sagen, WOFUER der Betrag
          steht: er ist der Rabattpreis pro Nacht, nicht der Preis der ganzen
          Woche. Ohne diesen Satz tippt man leicht den Wochen-GESAMTpreis ein
          und verkauft sieben Naechte zum Preis von einer. Keine Prozentzahl
          und keine Empfehlung — welcher Abstand zum Grundpreis richtig ist,
          entscheidet der Betrieb. */}
      {istLangzeitRate(plan.name) && <Hint>{t("pricingForm.planPriceDiscountHint")}</Hint>}
    </EditorShell>
  );
}
