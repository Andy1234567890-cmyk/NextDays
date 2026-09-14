'use client';

// Card „Positionen" des Beleg-Editors (Rechnung UND Angebot).
//
// Seit 0698 auf Übernachtungsbetriebe zugeschnitten (Hotel, Ferienobjekt,
// Camping): jede Position trägt eine ABRECHNUNGSBASIS (pauschal · je Nacht ·
// je Person · je Person und Nacht · je Stück) statt einer Freitext-Einheit
// aus dem Handwerk („Stk", „m²", „lfm"). Die Menge folgt aus Basis × Nächte
// (Aufenthalt im Belegkopf) × Personen und bleibt überschreibbar. Der
// Steuersatz wird je Kategorie aus den Stammdaten des Betriebs vorbelegt
// (Übernachtung → Übernachtungssatz, Leistung → Regelsatz, Abgabe → 0 %);
// fehlt der Satz, bleibt das Feld leer und rot — kein erfundener Wert.
// „Aus Preisliste" ersetzt den Lager-Inventar-Wähler und den Stub-Endpunkt
// „Leistung suchen oder neu erstellen" (speicherte nie).
// Geteilte States/Handler kommen als Props; Produkt-anlegen-Popover unverändert.

import { Icon } from '@iconify/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  computeItemTotalNet,
  syncGrossFromNet,
  zeilenBetraege,
} from '@/components/finance/create-invoice/calc';
import {
  type AufenthaltErgebnis,
  AufenthaltDialog,
} from '@/components/finance/create-invoice/aufenthalt-dialog';
import {
  PreislisteDialog,
  type PreislisteUebernahme,
} from '@/components/finance/create-invoice/preisliste-dialog';
import {
  type PreislisteEintrag,
  type PreislisteQuelle,
  usePreisliste,
} from '@/components/finance/create-invoice/use-preisliste';
import type { NewProductValues } from '@/components/inventory/NewProductModal';
import {
  POSITIONS_BASEN,
  type PositionsBasis,
  basisAusEinheit,
  mengeAusBasis,
  steuersatzFuer,
} from '@/lib/positions-basis';
import { NativeSelect } from '@nextdays/ui/native-select';
import { naechteJeZeile } from '@/components/finance/create-invoice/aufenthalt-zeilen';
import { AufenthaltZeile } from '@/components/finance/create-invoice/aufenthalt-zeile';
import { ZusatzleistungAuswahl } from '@/components/finance/create-invoice/zusatzleistung-auswahl';
import type { QuoteItem } from '@/services/quoteService';
import { getQuote } from '@/lib/pricing';

type ItemsCardProps = {
  uid: string;
  items: QuoteItem[];
  setItems: Dispatch<SetStateAction<QuoteItem[]>>;
  /** Regelsatz des Betriebs (Frühstück, Reinigung …); 0 heißt „nicht gesetzt" im Bestand. */
  taxRate: number;
  /** Übernachtungssatz des Betriebs; null = nicht hinterlegt. */
  lodgingTaxRate: number | null;
  /** Nächte aus dem Aufenthalt im Belegkopf (0 = kein Aufenthalt gesetzt). */
  naechte: number;
  /** Personen aus dem Belegkopf (0 = nicht gesetzt). */
  personen: number;
  /** Objekt für die Preisliste (Gebühren/Zusatzleistungen/Abgaben); null = alle. */
  objektId: string | null;
  setObjektId: (id: string | null) => void;
  /** Aufenthalt bepreisen (0701): Vorbelegung aus dem Kopf + Rückgabe in den Kopf. */
  aufenthaltVon?: string;
  aufenthaltBis?: string;
  onAufenthalt?: (e: { propertyId: string; checkIn: string; checkOut: string; guests: number; currency: string }) => void;
  /** Personen der Übernachtungszeile → Belegkopf (eine Personenzahl je Beleg). */
  onPersonen?: (n: number) => void;
  showNet: boolean;
  setShowNet: Dispatch<SetStateAction<boolean>>;
  formatCurrency: (amount: number) => string;
  // Belegwährung — für Preisliste und Fremdwährungs-Hinweis (kein €-Hardcode).
  currency?: string;
  documentLanguage?: string;
  popoverOpenIds: Set<string>;
  handleDescriptionChange: (index: number, id: string, value: string) => void;
  handleItemChange: (
    index: number,
    field: keyof QuoteItem,
    value: string | number | boolean,
  ) => void;
  removeItem: (index: number) => void;
  setDismissedCreatePromptIds: Dispatch<SetStateAction<Set<string>>>;
  setNewProduct: Dispatch<SetStateAction<NewProductValues>>;
  setCreateProductForIndex: Dispatch<SetStateAction<number | null>>;
  setCreateProductOpen: Dispatch<SetStateAction<boolean>>;
};

// Spaltenraster der Positionstabelle — EINE Definition für Kopf und Zeilen.
// Vorher standen feste `style={{width}}`-Pixel je Spalte: bei 1200 px Viewport
// mit offener Seitenleiste blieben der Beschreibung 110 px („Übernachtun…"),
// und der Spaltenkopf brach um. minmax(12rem,1fr) hält die Beschreibung immer
// lesbar; unter `lg` bricht die Zeile auf zwei Reihen (Beschreibung oben,
// Zahlenfelder darunter).
const RASTER =
  'grid grid-cols-1 lg:grid-cols-[minmax(12rem,1fr)_8.5rem_4.5rem_7rem_4.5rem_6rem_2.25rem] gap-3';
const RASTER_RABATT =
  'grid grid-cols-1 lg:grid-cols-[minmax(12rem,1fr)_8.5rem_4.5rem_7rem_4.5rem_4.5rem_6rem_2.25rem] gap-3';

/** Netto/Brutto-Segment im Kartenkopf. */
function NettoBruttoSchalter({
  showNet,
  setShowNet,
}: {
  showNet: boolean;
  setShowNet: Dispatch<SetStateAction<boolean>>;
}) {
  const t = useTranslations('finance');
  const knopf = (aktiv: boolean) =>
    `px-3 py-1 ${aktiv ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted'}`;
  return (
    <div
      role="radiogroup"
      aria-label={t('itemsCard.priceDisplay')}
      className="inline-flex overflow-hidden rounded-full border border-border text-sm"
    >
      <button type="button" role="radio" aria-checked={showNet} className={knopf(showNet)} onClick={() => setShowNet(true)}>
        {t('itemsCard.net')}
      </button>
      <button type="button" role="radio" aria-checked={!showNet} className={knopf(!showNet)} onClick={() => setShowNet(false)}>
        {t('itemsCard.gross')}
      </button>
    </div>
  );
}

function SpaltenKopf({
  raster,
  rabattAktiv,
  anzeigeArt,
}: {
  raster: string;
  rabattAktiv: boolean;
  anzeigeArt: string;
}) {
  const t = useTranslations('finance');
  return (
    <div className={`${raster} hidden rounded-lg bg-muted px-4 py-2 font-medium text-muted-foreground text-sm lg:grid`}>
      <div>{t('itemsCard.columnServiceItem')}</div>
      <div>{t('itemsCard.columnBasis')}</div>
      <div>{t('itemsCard.columnQuantity')}</div>
      <div>
        {t('itemsCard.columnPrice')} <small>({anzeigeArt})</small>
      </div>
      <div>{t('itemsCard.columnVat')}</div>
      {rabattAktiv && <div>{t('itemsCard.columnDiscount')}</div>}
      <div className="text-right">{t('itemsCard.columnAmount')}</div>
      <div />
    </div>
  );
}

function neueId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export default function ItemsCard({
  items,
  setItems,
  taxRate,
  lodgingTaxRate,
  naechte,
  personen,
  objektId,
  setObjektId,
  aufenthaltVon = '',
  aufenthaltBis = '',
  onAufenthalt,
  onPersonen,
  showNet,
  setShowNet,
  formatCurrency,
  currency,
  documentLanguage,
  popoverOpenIds,
  handleDescriptionChange,
  handleItemChange,
  removeItem,
  setDismissedCreatePromptIds,
  setNewProduct,
  setCreateProductForIndex,
  setCreateProductOpen,
}: ItemsCardProps) {
  const t = useTranslations('finance');
  const [preislisteOffen, setPreislisteOffen] = useState(false);
  // „Preis berechnen" einer Aufenthaltszeile: der Resolver-Dialog öffnet mit
  // Objekt/Zeitraum DIESER Zeile und ersetzt sie durch seine Zeilen.
  const [aufenthaltFuer, setAufenthaltFuer] = useState<number | null>(null);
  const aufenthaltZeile = aufenthaltFuer === null ? null : (items[aufenthaltFuer] ?? null);
  // Nur eine Gruppe im Dialog zeigen (Knopf „Kurtaxe / Abgabe" → 'abgabe').
  const [gruppeFilter, setGruppeFilter] = useState<PreislisteQuelle | null>(null);
  // Preisliste einmal je Objekt/Sprache — Dialog UND Schnellknöpfe lesen daraus.
  const preisliste = usePreisliste(objektId, documentLanguage);
  // Zweite, UNGEFILTERTE Liste für die Zeilenebene (0702): jede Übernachtungs-
  // zeile hat ihr eigenes Objekt, das vom Objekt des Belegkopfs abweichen darf —
  // die kopfgefilterte Liste kennt dessen Zusatzleistungen nicht.
  const zeilenListe = usePreisliste(null, documentLanguage);
  const { laden_: zeilenLaden } = zeilenListe;
  const hatUebernachtung = items.some(it => it.category === 'Aufenthalt');
  useEffect(() => {
    if (hatUebernachtung) void zeilenLaden();
  }, [hatUebernachtung, zeilenLaden]);
  const [suche, setSuche] = useState('');
  // Rabatt-Spalte erst zeigen, wenn ein Rabatt gesetzt ist oder der Nutzer sie will.
  const [rabattSichtbar, setRabattSichtbar] = useState(false);
  // Zeilen, deren erweiterte Beschreibung der Nutzer geöffnet hat.
  const [beschreibungOffen, setBeschreibungOffen] = useState<Set<string>>(new Set());
  const rabattAktiv = rabattSichtbar || items.some(it => (it.discountPercent ?? 0) > 0);

  // Regelsatz: im Bestand steht 0 für „nicht gesetzt" (use-invoice-loaders) —
  // 0 % ist aber auch ein gültiger Satz (Kleinunternehmer). Wir behandeln den
  // Regelsatz als gesetzt, sobald er eine Zahl ist; leer bleibt nur der
  // Übernachtungssatz, wenn der Betrieb ihn nicht hinterlegt hat.
  const saetze = { lodging: lodgingTaxRate, standard: Number.isFinite(taxRate) ? taxRate : null };
  const basisLabel = useCallback(
    (basis: PositionsBasis) => t(`itemsCard.basis.${basis}`),
    [t],
  );

  function positionHinzufuegen(vorlage: Partial<QuoteItem> & { basis: PositionsBasis }) {
    const menge =
      vorlage.quantity ?? mengeAusBasis(vorlage.basis, naechte, personen) ?? 1;
    const preis = vorlage.unitPrice ?? 0;
    const neu: QuoteItem = {
      id: neueId(),
      description: vorlage.description ?? '',
      quantity: menge,
      unitPrice: preis,
      total: computeItemTotalNet(menge, preis),
      unit: vorlage.unit || basisLabel(vorlage.basis),
      basis: vorlage.basis,
      category: vorlage.category,
      extendedDescription: vorlage.extendedDescription,
      inventoryItemId: vorlage.inventoryItemId,
      discountPercent: 0,
      // undefined = Feld leer + rot; bewusst kein Ersatzwert (Wurzel 4).
      taxRate: vorlage.taxRate,
      // Aufenthalt der Zeile (0702) — beim Knopf „Übernachtung" aus dem Kopf vorbelegt.
      propertyId: vorlage.propertyId,
      propertyTitle: objektTitel(vorlage.propertyId),
      checkIn: vorlage.checkIn,
      checkOut: vorlage.checkOut,
      parentItemId: vorlage.parentItemId,
    };
    setItems(prev => [...prev, neu]);
  }

  // Vorbelegung des Resolver-Dialogs: die Zeile, für die gerechnet wird, sonst der Kopf.
  function dialogVorgabe(): { objektId: string | null; von: string; bis: string } {
    return {
      objektId: aufenthaltZeile?.propertyId ?? objektId,
      von: aufenthaltZeile?.checkIn ?? aufenthaltVon,
      bis: aufenthaltZeile?.checkOut ?? aufenthaltBis,
    };
  }

  // Neue Aufenthaltszeile: Objekt und Zeitraum aus dem Belegkopf vorbelegt
  // (0702) — leer bleibt leer, nichts wird erfunden (Wurzel 4).
  function neueAufenthaltsVorlage(): Partial<QuoteItem> & { basis: PositionsBasis } {
    const propertyId = objektId ?? undefined;
    return {
      description: autoBeschreibung(objektTitel(propertyId)),
      basis: 'per_night',
      category: 'Aufenthalt',
      taxRate: steuersatzFuer('lodging', saetze) ?? undefined,
      propertyId,
      checkIn: aufenthaltVon || undefined,
      checkOut: aufenthaltBis || undefined,
    };
  }

  // Resolver-Zeilen → Positionen (netto; der Resolver liefert brutto).
  // lodging → je Nacht (Menge = Nächte); tax (Kurtaxe) → 0 %; Rest → pauschal.
  function aufenthaltUebernehmen(e: AufenthaltErgebnis) {
    const naechteNeu = e.quote.nights || 1;
    const netto = (brutto: number, satz: number | null) =>
      satz == null ? brutto : brutto / (1 + satz / 100);
    // Die Übernachtungszeile trägt Objekt und Zeitraum des Dialogs (0702); alle
    // übrigen Resolver-Zeilen (Gebühren, Abgaben, Zusatzleistungen) hängen als
    // Kinder an ihr — sie gehören zu DIESEM Aufenthalt, nicht zum Beleg.
    const logisId = neueId();
    const neue: QuoteItem[] = e.quote.lines
      .filter(z => z.amount !== 0)
      .map(z => {
        const kind = z.kind ?? '';
        const istLogis = kind === 'lodging';
        const istAbgabe = kind === 'tax';
        const satz = istAbgabe ? 0 : steuersatzFuer(istLogis ? 'lodging' : 'service', saetze);
        const menge = istLogis ? naechteNeu : 1;
        const einzel = netto(z.amount, satz) / menge;
        return {
          id: istLogis ? logisId : neueId(),
          description: z.label,
          quantity: menge,
          unitPrice: einzel,
          total: computeItemTotalNet(menge, einzel),
          unit: basisLabel(istLogis ? 'per_night' : 'per_stay'),
          basis: istLogis ? 'per_night' : 'per_stay',
          category: istLogis ? 'Aufenthalt' : istAbgabe ? 'Abgabe' : 'Leistung',
          discountPercent: 0,
          taxRate: satz ?? undefined,
          propertyId: e.propertyId,
          propertyTitle: objektTitel(e.propertyId),
          checkIn: istLogis ? e.checkIn : undefined,
          checkOut: istLogis ? e.checkOut : undefined,
          parentItemId: istLogis ? undefined : logisId,
        };
      });
    // Die berechneten Zeilen ersetzen die Zeile, für die gerechnet wurde, an
    // ihrer Stelle; leere Startzeilen (ohne Beschreibung oder Preis) weichen.
    const ersetzt = aufenthaltZeile?.id;
    setItems(prev => {
      const rest = prev.filter(
        it => it.id !== ersetzt && (it.description.trim() !== '' && it.unitPrice !== 0),
      );
      const stelle = prev.findIndex(it => it.id === ersetzt);
      const vorne = stelle < 0 ? rest.length : rest.filter(it => prev.indexOf(it) < stelle).length;
      return [...rest.slice(0, vorne), ...neue, ...rest.slice(vorne)];
    });
    setObjektId(e.propertyId);
    onAufenthalt?.({ propertyId: e.propertyId, checkIn: e.checkIn, checkOut: e.checkOut, guests: e.guests, currency: e.quote.currency });
    setAufenthaltFuer(null);
  }

  // Objekttitel zur ID — nur ANZEIGE (Vorschau/PDF); gespeichert wird die ID,
  // den Titel liefert beim Laden das Backend (Wurzel 4: eine Quelle).
  const objektTitel = (id?: string) => zeilenListe.objekte.find(o => o.id === id)?.title;
  const autoBeschreibung = (titel?: string) =>
    titel ? `${t('itemsCard.stayDescription')} · ${titel}` : t('itemsCard.stayDescription');

  // Nächte je Zeile (0702): eigener Zeitraum vor dem der Übernachtung, an der
  // die Zeile hängt, vor dem Belegkopf.
  const naechteMap = naechteJeZeile(items, naechte);
  const zeilenNaechte = (it: QuoteItem) => naechteMap.get(it.id) ?? naechte;

  /** Mengen aller Zeilen an ihre jeweiligen Nächte anpassen (Stück/pauschal bleiben). */
  function mengenNachfuehren(liste: QuoteItem[]): QuoteItem[] {
    const karte = naechteJeZeile(liste, naechte);
    let geaendert = false;
    const next = liste.map(it => {
      if (!it.basis || it.basis === 'per_unit' || it.basis === 'per_stay') return it;
      const menge = mengeAusBasis(it.basis, karte.get(it.id) ?? naechte, personen);
      if (menge === null || menge === it.quantity) return it;
      geaendert = true;
      return { ...it, quantity: menge, total: computeItemTotalNet(menge, it.unitPrice) };
    });
    return geaendert ? next : liste;
  }

  // Preis je Nacht AUTOMATISCH aus dem Ratenplan, sobald Objekt, Zeitraum und
  // Personen einer Übernachtungszeile stehen (14.09.2026). Vorher blieb die
  // Zeile auf 0 und nur der Dialog „Preis aus Objekt berechnen" kannte den
  // Resolver — genau die Handarbeit, die 0701 abschaffen sollte. Es wird
  // ausschließlich die Logis-Zeile des Resolvers übernommen (Gebühren/Abgaben
  // holt der Dialog); ein von Hand getippter Preis wird nicht überschrieben —
  // dazu merkt sich `autoPreise`, welchen Wert die Automatik zuletzt setzte.
  // Ohne Preis im Ratenplan (`priceless`) bleibt 0 stehen und der Nutzer sieht
  // es als Hinweis — kein Ersatzwert (Wurzel 4).
  const autoPreise = useRef(new Map<string, number>());
  const letzteAnfrage = useRef(new Map<string, string>());
  function preisAusRatenplan(
    zeileId: string,
    propertyId: string,
    checkIn: string,
    checkOut: string,
    gaeste: number,
  ) {
    if (gaeste <= 0 || checkOut <= checkIn) return;
    const schluessel = `${propertyId}|${checkIn}|${checkOut}|${gaeste}`;
    letzteAnfrage.current.set(zeileId, schluessel);
    void getQuote({ property_id: propertyId, check_in: checkIn, check_out: checkOut, guests: gaeste, channel: 'website' })
      .then(res => {
        // Zwischenzeitlich weitergetippt → dieses Ergebnis ist veraltet.
        if (letzteAnfrage.current.get(zeileId) !== schluessel) return;
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        if (res.data.priceless) {
          toast.warning(t('itemsCard.aufenthalt.keinPreis'));
          return;
        }
        const logis = res.data.lines.find(z => z.kind === 'lodging');
        const naechteNeu = res.data.nights || 1;
        if (!logis) return;
        setItems(prev =>
          prev.map(it => {
            if (it.id !== zeileId) return it;
            const vorher = autoPreise.current.get(zeileId);
            if (it.unitPrice !== 0 && it.unitPrice !== vorher) return it; // Handeingabe bleibt
            const satz = it.taxRate ?? steuersatzFuer('lodging', saetze);
            // Der Resolver liefert brutto; der Editor rechnet netto.
            const netto = satz == null ? logis.amount : logis.amount / (1 + satz / 100);
            const einzel = Math.round((netto / naechteNeu) * 100) / 100;
            autoPreise.current.set(zeileId, einzel);
            return {
              ...it,
              unitPrice: einzel,
              quantity: naechteNeu,
              total: computeItemTotalNet(naechteNeu, einzel),
              taxRate: it.taxRate ?? satz ?? undefined,
            };
          }),
        );
      });
  }

  // Personen der Zeile = Personen des Belegs; danach Preis der Zeile neu holen,
  // weil Belegungspreise/Zuschläge an der Personenzahl hängen.
  function personenSetzen(index: number, n: number) {
    onPersonen?.(n);
    const it = items[index];
    if (it?.propertyId && it.checkIn && it.checkOut) {
      preisAusRatenplan(it.id, it.propertyId, it.checkIn, it.checkOut, n);
    }
  }

  // Objekt/Zeitraum EINER Übernachtungszeile ändern. Der Belegkopf folgt der
  // Zeile (wie beim Dialog „Aufenthalt bepreisen"), sobald beides vollständig
  // ist — unvollständige Eingaben dürfen den Kopf nicht leeren.
  function aufenthaltSetzen(
    index: number,
    patch: Pick<QuoteItem, 'propertyId' | 'checkIn' | 'checkOut'>,
  ) {
    setItems(prev =>
      mengenNachfuehren(
        prev.map((it, i) => {
          if (i !== index) return it;
          const titel = objektTitel(patch.propertyId);
          // Die Beschreibung der Position ist der Aufenthalt selbst („Übernachtung
          // · Objekt") — sie folgt dem Objekt, solange der Nutzer sie nicht
          // eigenhändig geändert hat.
          const auto = it.description === '' || it.description === autoBeschreibung(it.propertyTitle);
          return {
            ...it,
            ...patch,
            propertyTitle: titel,
            description: auto ? autoBeschreibung(titel) : it.description,
          };
        }),
      ),
    );
    if (patch.propertyId) setObjektId(patch.propertyId);
    if (patch.propertyId && patch.checkIn && patch.checkOut && patch.checkOut > patch.checkIn) {
      onAufenthalt?.({
        propertyId: patch.propertyId,
        checkIn: patch.checkIn,
        checkOut: patch.checkOut,
        guests: personen,
        // Leer = „Währung unverändert"; die Zeile kennt keine eigene (Wurzel 4).
        currency: '',
      });
      const zeile = items[index];
      if (zeile) preisAusRatenplan(zeile.id, patch.propertyId, patch.checkIn, patch.checkOut, personen);
    }
  }

  // Zusatzleistung des Objekts als eigene Position DIREKT hinter ihrer
  // Übernachtung (nicht am Ende) — sonst steht sie im Beleg neben fremden Zeilen.
  function zusatzleistungHinzufuegen(
    einfuegeNach: number,
    eltern: QuoteItem,
    eintrag: PreislisteEintrag,
  ) {
    const menge =
      mengeAusBasis(eintrag.basis, zeilenNaechte(eltern), personen) ?? 1;
    const preis = Number(eintrag.unitPrice) || 0;
    const neu: QuoteItem = {
      id: neueId(),
      description: eintrag.name,
      extendedDescription: eintrag.description || undefined,
      quantity: menge,
      unitPrice: preis,
      total: computeItemTotalNet(menge, preis),
      unit: eintrag.unit || basisLabel(eintrag.basis),
      basis: eintrag.basis,
      category: 'Leistung',
      discountPercent: 0,
      // null → undefined: Feld bleibt leer und rot, kein erfundener Satz (Wurzel 4).
      taxRate: eintrag.taxRate === null ? undefined : Number(eintrag.taxRate),
      inventoryItemId: eintrag.id,
      parentItemId: eltern.id,
      propertyId: eltern.propertyId,
    };
    setItems(prev => [
      ...prev.slice(0, einfuegeNach + 1),
      neu,
      ...prev.slice(einfuegeNach + 1),
    ]);
    if (eintrag.currency && currency && eintrag.currency !== currency) {
      toast.warning(t('itemsCard.foreignCurrencyWarning', { currency: eintrag.currency }));
    } else {
      toast.success(t('itemsCard.serviceAdded'));
    }
  }

  // Zusatzleistungen des Objekts einer Gruppe (0702) — nur die am Objekt
  // hinterlegten, aktiven Einträge der Preisliste.
  function zusatzleistungenFuer(elter: QuoteItem | null): PreislisteEintrag[] {
    if (!elter?.propertyId) return [];
    return (zeilenListe.eintraege ?? []).filter(
      z => z.quelle === 'zusatzleistung' && z.propertyId === elter.propertyId,
    );
  }

  // Zu welcher Übernachtung gehört die Zeile an `index` — und ist sie die
  // LETZTE ihrer Gruppe? Der Knopf „+ Zusatzleistung" steht am Ende der Gruppe
  // (Guesty gruppiert je Einheit in einem eigenen Abschnitt), nicht an der
  // Kopfzeile; eine neue Leistung landet damit hinter den bestehenden.
  function gruppenElter(index: number): QuoteItem | null {
    const it = items[index];
    if (it.category === 'Aufenthalt') return it;
    return it.parentItemId ? (items.find(x => x.id === it.parentItemId) ?? null) : null;
  }
  function istGruppenEnde(index: number, elter: QuoteItem | null): boolean {
    if (!elter) return false;
    const naechste = items[index + 1];
    return !naechste || naechste.parentItemId !== elter.id;
  }

  // Zeile löschen: Zusatzleistungen einer entfallenen Übernachtung bleiben
  // STEHEN und verlieren nur ihre Zuordnung — ein stiller Kaskaden-Löscher
  // nähme dem Nutzer vereinbarte Posten, ohne dass er es sieht.
  function zeileEntfernen(index: number) {
    const entfernt = items[index];
    if (entfernt && items.some(it => it.parentItemId === entfernt.id)) {
      setItems(prev =>
        prev.map(it =>
          it.parentItemId === entfernt.id ? { ...it, parentItemId: undefined } : it,
        ),
      );
    }
    removeItem(index);
  }

  function basisSetzen(index: number, basis: PositionsBasis) {
    setItems(prev =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const menge = mengeAusBasis(basis, naechte, personen) ?? it.quantity;
        return {
          ...it,
          basis,
          unit: basisLabel(basis),
          quantity: menge,
          total: computeItemTotalNet(menge, it.unitPrice),
        };
      }),
    );
  }

  function ausPreisliste(e: PreislisteUebernahme) {
    // Prozent-Einträge (Servicegebühr 3 %, Kurtaxe 5 % …): Betrag aus den
    // Übernachtungszeilen des Belegs, als pauschale Zeile mit Menge 1.
    let preis = e.unitPrice;
    let basis = e.basis;
    if (e.percent !== null) {
      const uebernachtungNetto = items
        .filter(it => it.category === 'Aufenthalt')
        .reduce((s, it) => s + (it.total || 0), 0);
      if (uebernachtungNetto <= 0) {
        toast.error(t('itemsCard.percentNeedsStay'));
        return;
      }
      preis = Math.round(uebernachtungNetto * e.percent) / 100;
      basis = 'per_stay';
    }
    positionHinzufuegen({
      description: e.description,
      extendedDescription: e.extendedDescription,
      unitPrice: preis,
      taxRate: e.taxRate ?? undefined,
      basis,
      unit: e.unit || undefined,
      inventoryItemId: e.quelleId || undefined,
      category: e.quelle === 'abgabe' ? 'Abgabe' : undefined,
    });
    if (e.currency && currency && e.currency !== currency) {
      toast.warning(t('itemsCard.foreignCurrencyWarning', { currency: e.currency }));
    } else {
      toast.success(t('itemsCard.serviceAdded'));
    }
  }

  // Aus einem Preislisten-Eintrag eine Übernahme bauen (wie der Dialog es tut).
  function alsUebernahme(e: PreislisteEintrag): PreislisteUebernahme {
    return {
      description: e.name,
      extendedDescription: e.description || undefined,
      unitPrice: Number(e.unitPrice) || 0,
      percent: e.percent === null ? null : Number(e.percent),
      taxRate: e.taxRate === null ? null : Number(e.taxRate),
      basis: e.basis,
      unit: e.unit,
      quelleId: e.id,
      quelle: e.quelle,
      currency: e.currency,
    };
  }

  // „Kurtaxe / Abgabe": nimmt die am OBJEKT gepflegte Abgabe (Objekt → Preise →
  // Steuern). Genau eine → direkt übernehmen; mehrere → Auswahl im Dialog;
  // keine → leere Abgabenzeile plus Hinweis, wo sie gepflegt wird.
  async function kurtaxeHinzufuegen() {
    const eintraege = await preisliste.laden_();
    const abgaben = eintraege.filter(e => e.quelle === 'abgabe');
    if (abgaben.length === 1) {
      ausPreisliste(alsUebernahme(abgaben[0]));
      return;
    }
    if (abgaben.length > 1) {
      setGruppeFilter('abgabe');
      setPreislisteOffen(true);
      return;
    }
    positionHinzufuegen({
      description: t('itemsCard.levyDescription'),
      basis: 'per_guest_night',
      category: 'Abgabe',
      taxRate: steuersatzFuer('levy', saetze) ?? undefined,
    });
    toast.info(t('itemsCard.levyNotConfigured'));
  }

  const raster = rabattAktiv ? RASTER_RABATT : RASTER;
  const anzeigeArt = showNet ? t('itemsCard.net') : t('itemsCard.gross');
  const kopfHinweis =
    naechte > 0
      ? t('itemsCard.headerHint', { nights: naechte, guests: personen })
      : t('itemsCard.headerHintNoStay');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center">
            <Icon icon="lucide:calculator" className="mr-2 h-5 w-5 text-accent" />
            {t('itemsCard.title')}
          </CardTitle>
          <NettoBruttoSchalter showNet={showNet} setShowNet={setShowNet} />
        </div>
        <p className="mt-1 text-muted-foreground text-sm">{kopfHinweis}</p>
      </CardHeader>
      <CardContent>
        {/* Positions-Steuerleiste: links die drei Schnellpositionen + Preisliste,
            rechts die Suche. Rabatte stehen unter der Tabelle. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => positionHinzufuegen(neueAufenthaltsVorlage())}
          >
            <Icon icon="lucide:bed-double" className="mr-1.5 h-4 w-4" />
            {t('itemsCard.addStay')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => void kurtaxeHinzufuegen()}
          >
            <Icon icon="lucide:landmark" className="mr-1.5 h-4 w-4" />
            {t('itemsCard.addLevy')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() =>
              positionHinzufuegen({
                basis: 'per_unit',
                taxRate: steuersatzFuer('service', saetze) ?? undefined,
              })
            }
          >
            <Icon icon="lucide:plus" className="mr-1.5 h-4 w-4" />
            {t('itemsCard.addItem')}
          </Button>
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-accent text-white hover:bg-accent/90"
            onClick={() => setPreislisteOffen(true)}
          >
            <Icon icon="lucide:list" className="mr-1.5 h-4 w-4" />
            {t('itemsCard.fromPriceList')}
          </Button>

          {/* Schnellsuche in der Preisliste */}
          <div className="relative ml-auto w-full sm:w-72">
            <Icon
              icon="lucide:search"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              value={suche}
              onChange={e => setSuche(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setPreislisteOffen(true);
                }
              }}
              onFocus={() => {
                if (suche.trim().length >= 2) setPreislisteOffen(true);
              }}
              placeholder={t('itemsCard.searchServicePlaceholder')}
              className="h-8 pl-9 text-sm"
            />
          </div>
        </div>

        <AufenthaltDialog
          open={aufenthaltFuer !== null}
          onClose={() => setAufenthaltFuer(null)}
          onUebernehmen={aufenthaltUebernehmen}
          {...dialogVorgabe()}
          personen={personen}
          documentLanguage={documentLanguage}
        />
        <PreislisteDialog
          open={preislisteOffen}
          onClose={() => {
            setPreislisteOffen(false);
            setGruppeFilter(null);
            setSuche('');
          }}
          daten={preisliste}
          gruppeFilter={gruppeFilter}
          onUebernehmen={ausPreisliste}
          belegWaehrung={currency}
          standardTaxRate={saetze.standard}
          basisLabel={basisLabel}
          vorgabeSuche={suche.trim() || undefined}
          objektId={objektId}
          setObjektId={setObjektId}
        />

        {/* Spaltenkopf nur für Standardzeilen — Aufenthaltszeilen beschriften ihre Felder selbst. */}
        {items.some(it => it.category !== 'Aufenthalt') && (
          <SpaltenKopf raster={raster} rabattAktiv={rabattAktiv} anzeigeArt={anzeigeArt} />
        )}

        {/* Positionsliste */}
        <div className="space-y-2">
          {items.map((item, index) => {
            const { satzFehlt, unitPriceDisplay, totalNet, totalGross } = zeilenBetraege(
              item,
              taxRate,
              showNet,
            );
            const basis: PositionsBasis = item.basis ?? basisAusEinheit(item.unit);
            const istUebernachtung = item.category === 'Aufenthalt';
            const elter = gruppenElter(index);
            const gruppenEnde = istGruppenEnde(index, elter);
            // Zusatzleistungen des Objekts DIESER Gruppe (0702) — nur die am
            // Objekt hinterlegten, aktiven Einträge der Preisliste.
            const zusatzleistungen = gruppenEnde ? zusatzleistungenFuer(elter) : [];
            return (
              <div
                key={item.id}
                className={`rounded-lg border border-border bg-card ${
                  item.parentItemId ? 'ml-6 border-l-2 border-l-border bg-muted/30' : ''
                }`}
              >
                {istUebernachtung ? (
                  <AufenthaltZeile
                    item={item}
                    objekte={zeilenListe.objekte}
                    personen={personen}
                    onPersonen={n => personenSetzen(index, n)}
                    anzeigeArt={anzeigeArt}
                    preisAnzeige={Number.isFinite(unitPriceDisplay) ? Number(unitPriceDisplay.toFixed(2)) : 0}
                    betragAnzeige={formatCurrency(showNet ? totalNet : totalGross)}
                    rabattAktiv={rabattAktiv}
                    entfernenGesperrt={items.length === 1}
                    onAufenthalt={patch => aufenthaltSetzen(index, patch)}
                    onPreis={wert => handleItemChange(index, 'unitPrice', wert)}
                    onSteuer={wert =>
                      setItems(prev => prev.map((it, i) => (i === index ? { ...it, taxRate: wert } : it)))
                    }
                    onRabatt={wert =>
                      setItems(prev =>
                        prev.map((it, i) => (i === index ? { ...it, discountPercent: wert } : it)),
                      )
                    }
                    onEntfernen={() => zeileEntfernen(index)}
                  />
                ) : (
                <div
                  className={`${raster} items-end p-4 hover:bg-muted/50`}
                >
                  <div className="min-w-0">
                    <div className="sr-only">
                      <Label>{t('itemsCard.descriptionLabel')}</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label={t('itemsCard.descriptionHintAriaLabel')}
                            className="inline-flex cursor-help"
                          >
                            <Icon icon="lucide:info" className="h-4 w-4 text-accent" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="max-w-xs text-sm">
                          <p>{t('itemsCard.descriptionHint')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Popover
                      open={popoverOpenIds.has(item.id)}
                      onOpenChange={open => {
                        if (!open) {
                          setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                        }
                      }}
                    >
                      <div className="relative">
                        <Input
                          value={item.description}
                          onChange={e =>
                            handleDescriptionChange(index, item.id, e.target.value)
                          }
                          placeholder={
                            item.category === 'discount'
                              ? t('itemsCard.discountPlaceholder')
                              : t('itemsCard.serviceDescriptionPlaceholder')
                          }
                        />

                        <PopoverAnchor />
                      </div>
                      <PopoverContent side="bottom" align="start">
                        <div className="text-sm">
                          <div className="mb-2 font-medium">{t('itemsCard.saveAsProductQuestion')}</div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-accent text-white hover:bg-accent/90"
                              onClick={() => {
                                // Steuersatz der Position bzw. der Rechnung
                                // uebernehmen - KEIN 19-%-Ersatzwert (Wurzel 4).
                                const rate = item.taxRate ?? taxRate;
                                const name = item.description || '';
                                const unit = (item.unit as string) || basisLabel(basis);
                                const sellingNet = Number.isFinite(item.unitPrice)
                                  ? item.unitPrice
                                  : 0;
                                setNewProduct({
                                  name,
                                  imageUrl: '',
                                  sku: '',
                                  category: 'Artikel',
                                  unit,
                                  stock: 0,
                                  taxRate: rate,
                                  purchaseNet: 0,
                                  purchaseGross: 0,
                                  sellingNet,
                                  sellingGross: Number(
                                    syncGrossFromNet(sellingNet, rate).toFixed(2),
                                  ),
                                  description: '',
                                  internalNote: '',
                                });
                                setCreateProductForIndex(index);
                                setCreateProductOpen(true);
                                setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                              }}
                            >
                              {t('itemsCard.createProduct')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDismissedCreatePromptIds(prev => new Set(prev).add(item.id))
                              }
                            >
                              {t('itemsCard.later')}
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <div className="sr-only">
                      <Label>{t('itemsCard.columnBasis')}</Label>
                    </div>
                    <NativeSelect
                      value={basis}
                      onChange={e => basisSetzen(index, e.target.value as PositionsBasis)}
                      disabled={item.category === 'discount'}
                      aria-label={t('itemsCard.columnBasis')}
                    >
                      {POSITIONS_BASEN.map(b => (
                        <option key={b} value={b}>
                          {basisLabel(b)}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <div className="sr-only">
                      <Label>{t('itemsCard.columnQuantity')}</Label>
                    </div>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e =>
                        handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                      title={
                        basis === 'per_night' || basis === 'per_guest_night' || basis === 'per_guest'
                          ? t('itemsCard.quantityFromHeader')
                          : undefined
                      }
                    />
                  </div>
                  <div>
                    <div className="sr-only">
                      <Label>
                        {t('itemsCard.columnPrice')}
                        <small className="font-normal text-muted-foreground">
                          {' '}
                          ({anzeigeArt})
                        </small>
                      </Label>
                    </div>
                    <Input
                      type="number"
                      value={
                        Number.isFinite(unitPriceDisplay)
                          ? Number(unitPriceDisplay.toFixed(2))
                          : 0
                      }
                      onChange={e =>
                        handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                      className="h-8 w-28 px-2 text-sm md:w-32"
                    />
                  </div>
                  <div>
                    <div className="sr-only">
                      <Label>{t('itemsCard.vatPercent')}</Label>
                    </div>
                    {/* Freies Zahlenfeld 0-100 statt fester Satzliste: das PMS
                        laeuft in allen 27 EU-Staaten (DK 25 %, LU 17 %, SE 12/6 %).
                        Vorbelegt wird aus den STAMMDATEN des Betriebs (Übernachtungs-
                        satz / Regelsatz / Abgabe 0 %) — fehlt der Satz, bleibt das
                        Feld leer und rot; wir erfinden keinen (Wurzel 4). */}
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={satzFehlt ? '' : item.taxRate}
                      placeholder={satzFehlt ? t('itemsCard.taxMissingShort') : undefined}
                      className={satzFehlt && item.category !== 'discount' ? 'border-destructive bg-destructive/10 ring-1 ring-destructive/40' : ''}
                      title={satzFehlt ? t('itemsCard.taxMissingHint') : undefined}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setItems(prev =>
                          prev.map((it, i) =>
                            i === index
                              ? {
                                ...it,
                                // Leeres Feld = Satz fehlt (rot); ungueltig laesst den
                                // Satz unveraendert - kein erfundener Ersatzwert.
                                taxRate: e.target.value === ''
                                  ? undefined
                                  : Number.isFinite(v)
                                    ? Math.max(0, Math.min(100, v))
                                    : it.taxRate,
                              }
                              : it,
                          ),
                        );
                      }}
                      disabled={item.category === 'discount'}
                    />
                  </div>
                  {rabattAktiv && (
                    <div>
                      <div className="sr-only">
                        <Label>{t('itemsCard.discountPercent')}</Label>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={item.category === 'discount' ? 0 : (item.discountPercent ?? 0)}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setItems(prev =>
                            prev.map((it, i) =>
                              i === index
                                ? {
                                  ...it,
                                  discountPercent: Number.isFinite(v)
                                    ? Math.max(0, Math.min(100, v))
                                    : 0,
                                }
                                : it,
                            ),
                          );
                        }}
                        disabled={item.category === 'discount'}
                      />
                    </div>
                  )}
                  <div className="text-right">
                    <div className="sr-only">
                      <Label>{t('itemsCard.columnAmount')}</Label>
                    </div>
                    <div
                      className={`flex h-10 items-center justify-end font-medium text-sm ${item.category === 'discount' ? 'text-destructive' : ''}`}
                    >
                      {formatCurrency(showNet ? totalNet : totalGross)}
                    </div>
                  </div>
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => zeileEntfernen(index)}
                      className="w-full text-destructive hover:bg-destructive/10"
                      disabled={items.length === 1}
                    >
                      <Icon icon="lucide:x" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                )}

                {(item.extendedDescription || beschreibungOffen.has(item.id)) && (
                  <div className="px-4 pb-3">
                    <textarea
                      autoFocus={!item.extendedDescription}
                      placeholder={t('itemsCard.extendedDescriptionPlaceholder')}
                      value={item.extendedDescription || ''}
                      onChange={e => {
                        setItems(prev =>
                          prev.map((it, i) =>
                            i === index ? { ...it, extendedDescription: e.target.value } : it,
                          ),
                        );
                      }}
                      className="w-full resize-none rounded-md border border-border px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                      rows={2}
                    />
                  </div>
                )}

                {/* Kleine Textknöpfe der Zeile in EINER Leiste — vorher stand
                    jeder in einem eigenen Block und die Karte wuchs je Zeile
                    um zwei fast leere Zeilen. */}
                <div className="flex flex-wrap items-center gap-4 px-4 pb-3 text-xs">
                  {!(item.extendedDescription || beschreibungOffen.has(item.id)) &&
                    item.description.trim().length > 0 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-accent"
                        onClick={() => setBeschreibungOffen(prev => new Set(prev).add(item.id))}
                      >
                        + {t('itemsCard.addExtendedDescription')}
                      </button>
                    )}
                  {istUebernachtung && onAufenthalt && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-accent"
                      onClick={() => setAufenthaltFuer(index)}
                    >
                      <Icon icon="lucide:calculator" className="mr-1 inline h-3.5 w-3.5" />
                      {t('itemsCard.preisBerechnen')}
                    </button>
                  )}
                  {gruppenEnde && elter?.propertyId && (
                    <ZusatzleistungAuswahl
                      eintraege={zusatzleistungen}
                      propertyId={elter.propertyId}
                      belegWaehrung={currency}
                      basisLabel={basisLabel}
                      onWaehlen={eintrag => zusatzleistungHinzufuegen(index, elter, eintrag)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rabatte: selten gebraucht, deshalb klein unter der Tabelle */}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-muted-foreground"
            onClick={() => {
              const newItem: QuoteItem = {
                id: neueId(),
                description: t('itemsCard.totalDiscount'),
                quantity: 1,
                unitPrice: 0,
                total: 0,
                category: 'discount',
                basis: 'per_stay',
                // KEIN fester Steuersatz: der Rabatt mindert die Bemessungs-
                // grundlage mit dem geltenden Satz (?? taxRate in calc/Payload)
                // — fest 0 % ließe die USt auf der unrabattierten Basis stehen
                // (überhöhter Ausweis, §14c-Risiko).
              };
              setItems(prev => [...prev, newItem]);
            }}
          >
            <Icon icon="lucide:percent" className="mr-1 h-3.5 w-3.5" />
            {t('itemsCard.addTotalDiscount')}
          </Button>
          {!rabattAktiv && (
            <Button
              type="button"
              variant="link"
              className="h-auto px-0 text-muted-foreground"
              onClick={() => setRabattSichtbar(true)}
            >
              {t('itemsCard.showDiscountColumn')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
