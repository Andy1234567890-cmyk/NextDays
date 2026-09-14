import type React from 'react';
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { DocumentSettings, ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';
import type { DocumentType } from '@/lib/document-utils';
import { detectDocumentType, getTranslatedDocumentTypeConfig } from '@/lib/document-utils';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/utils';
import { SimpleFooter } from './common/SimpleFooter';

// Vorlage „Aufenthalt" (TEMPLATE_STAY): das Angebot eines Hotels oder
// Ferienobjekts als Buchungsvorschau, nicht als Handelsbeleg. Aufgebaut nach
// dem, was Guesty-, Hostaway- und Hospitable-Quotes dem Gast zeigen
// (Recherche 14.09.2026): Haus mit Bild, Aufenthalt mit Check-in-/Check-out-
// Zeiten, Gäste, Preis wie im Buchungsportal (Bruttozeilen, eine MwSt.-Zeile),
// Zahlungsplan, Stornobedingungen, Hausregeln, Weg zur Annahme.
//
// Datenquelle: `data.stay` (buchhaltung.aufenthalt_kontext, 0701) — dieselbe
// Quelle wie die Annahmeseite des Gastes. Fehlt ein Teil (kein Bild, keine
// Kondition), fällt der Block weg; nichts wird erfunden (Wurzel 4).

export type StayContext = {
  property_id: string;
  title: string;
  city?: string | null;
  address?: string | null;
  postal_code?: string | null;
  country?: string | null;
  cover_url?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  house_rules?: string | null;
  payment_plan?: {
    due_now: number;
    due_later: number;
    balance_due_date?: string | null;
  } | null;
  cancellation?: {
    mode?: string | null;
    rules: { days_before_arrival: number; refund_percent: number }[];
  } | null;
};

type StayLabel = ReturnType<typeof useDocumentTranslation>['stay'];
type Geld = (betrag: number) => string;

interface StayTemplateProps {
  data: ProcessedPDFData;
  color?: string;
  logoSize?: number;
  pageMode?: 'single' | 'multi';
  documentType?: DocumentType;
  documentSettings?: DocumentSettings;
}

function naechteZwischen(von?: string | null, bis?: string | null): number {
  if (!von || !bis) return 0;
  const a = new Date(`${von}T00:00:00Z`).getTime();
  const b = new Date(`${bis}T00:00:00Z`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(Math.round((b - a) / 86_400_000), 0);
}

function Anschrift({ p }: { p: ProcessedPDFData['companyAddressParsed'] }) {
  return (
    <>
      {p.street && <div>{p.street}</div>}
      {(p.postalCode || p.city) && (
        <div>
          {p.postalCode} {p.city}
        </div>
      )}
    </>
  );
}

function Kopf({ data, logoSize }: { data: ProcessedPDFData; logoSize: number }) {
  const logo = typeof data.companyLogo === 'string' ? data.companyLogo : undefined;
  return (
    <div className="flex items-start justify-between px-10 pt-8 pb-4">
      <div>
        {logo && (
          <img
            src={logo}
            alt={data.companyName}
            className="w-auto object-contain"
            style={{ maxHeight: `${logoSize}px` }}
          />
        )}
      </div>
      <div className="text-right text-[11px] leading-relaxed text-gray-600">
        <div className="text-sm font-semibold text-gray-900">{data.companyName}</div>
        <Anschrift p={data.companyAddressParsed} />
        {data.companyPhone && <div>{data.companyPhone}</div>}
        {data.companyEmail && <div>{data.companyEmail}</div>}
      </div>
    </div>
  );
}

function Haus({
  data,
  stay,
  title,
  locale,
  s,
  t,
  gueltigBis,
}: {
  data: ProcessedPDFData;
  stay: StayContext | null;
  title: string;
  locale: string;
  s: StayLabel;
  t: ReturnType<typeof useDocumentTranslation>['t'];
  gueltigBis: string;
}) {
  const ort = stay
    ? [stay.address, [stay.postal_code, stay.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '';
  return (
    <div className="px-10">
      {stay?.cover_url && (
        <img src={stay.cover_url} alt={stay.title} className="h-56 w-full rounded-xl object-cover" />
      )}
      <div className="mt-5 flex items-end justify-between gap-6">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-gray-500">
            {title} · {data.quoteNumber || data.invoiceNumber}
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            {stay?.title || data.title || s('yourOffer')}
          </h1>
          {ort && <div className="mt-1 text-gray-600">{ort}</div>}
        </div>
        <div className="text-right text-[11px] text-gray-600">
          <div>
            {t('date')}: {formatDate(data.quoteDate || data.date, locale)}
          </div>
          {gueltigBis && (
            <div>
              {t('validUntil')}: {formatDate(gueltigBis, locale)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Empfaenger({ data, t }: { data: ProcessedPDFData; t: ReturnType<typeof useDocumentTranslation>['t'] }) {
  const anschreiben = data.processedHeadTextHtml || data.processedHeaderText;
  return (
    <div className="px-10 pt-6">
      <div className="text-[11px] text-gray-500">{t('recipient')}</div>
      <div className="font-medium text-gray-900">{data.customerName}</div>
      <Anschrift p={data.customerAddressParsed} />
      {anschreiben && (
        <div
          className="mt-4 text-[11px] leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: anschreiben }}
        />
      )}
    </div>
  );
}

function Kachel({ label, wert, zusatz }: { label: string; wert: string; zusatz?: string | null }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-gray-900">{wert}</div>
      {zusatz && <div className="text-[11px] text-gray-600">{zusatz}</div>}
    </div>
  );
}

function Aufenthalt({
  stay,
  stayFrom,
  stayTo,
  guestCount,
  locale,
  s,
}: {
  stay: StayContext | null;
  stayFrom: string | null;
  stayTo: string | null;
  guestCount: number | null;
  locale: string;
  s: StayLabel;
}) {
  if (!stayFrom && !stayTo && !guestCount) return null;
  const naechte = naechteZwischen(stayFrom, stayTo);
  const naechteText = naechte === 0 ? null : naechte === 1 ? s('oneNight') : s('nights', { count: naechte });
  return (
    <div className="mx-10 mt-5 grid grid-cols-3 gap-3">
      <Kachel
        label={s('arrival')}
        wert={stayFrom ? formatDate(stayFrom, locale) : '–'}
        zusatz={stay?.check_in_time ? `${s('checkInFrom')} ${stay.check_in_time}` : null}
      />
      <Kachel
        label={s('departure')}
        wert={stayTo ? formatDate(stayTo, locale) : '–'}
        zusatz={stay?.check_out_time ? `${s('checkOutUntil')} ${stay.check_out_time}` : null}
      />
      <Kachel label={s('guests')} wert={guestCount == null ? '–' : String(guestCount)} zusatz={naechteText} />
    </div>
  );
}

function Preise({
  data,
  geld,
  s,
  locale,
}: { data: ProcessedPDFData; geld: Geld; s: StayLabel; locale: string }) {
  // Bruttozeilen wie im Buchungsportal: Menge × Einzelpreis (netto) + MwSt.
  const zeilen = (data.items || []).map((it) => {
    const faktor = 1 + (it.taxRate || 0) / 100;
    const netto = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100);
    return { ...it, brutto: netto * faktor, einzelBrutto: it.unitPrice * faktor };
  });
  return (
    <div className="px-10 pt-6">
      <div className="mb-2 text-sm font-semibold text-gray-900">{s('priceOverview')}</div>
      <table className="w-full text-[11px]">
        <tbody>
          {zeilen.map((z, i) => (
            <tr key={z.id || i} className="border-b border-gray-100">
              {/* Zusatzleistungen (0702) stehen eingerückt unter ihrer Übernachtung,
                  die Übernachtung nennt Objekt und Zeitraum. */}
              <td className={`py-1.5 text-gray-800 ${z.parentItemId ? 'pl-4' : ''}`}>
                {z.description}
                {z.quantity !== 1 && (
                  <span className="text-gray-500">
                    {' '}· {z.quantity} {z.unit || `× ${geld(z.einzelBrutto)}`}
                  </span>
                )}
                {(() => {
                  const zeitraum =
                    z.checkIn && z.checkOut
                      ? `${formatDate(z.checkIn, locale)} – ${formatDate(z.checkOut, locale)}`
                      : '';
                  const text = [z.propertyTitle, zeitraum].filter(Boolean).join(' · ');
                  return text ? <div className="text-[10px] text-gray-500">{text}</div> : null;
                })()}
              </td>
              <td className="py-1.5 text-right text-gray-900">{geld(z.brutto)}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-3 text-sm font-semibold text-gray-900">{s('totalInclVat')}</td>
            <td className="pt-3 text-right text-sm font-semibold text-gray-900">{geld(data.total)}</td>
          </tr>
          {data.taxAmount > 0 && (
            <tr>
              <td className="text-[10px] text-gray-500">{s('vatIncluded')}</td>
              <td className="text-right text-[10px] text-gray-500">{geld(data.taxAmount)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function Zahlung({
  plan,
  depositAmount,
  gesamt,
  color,
  locale,
  geld,
  s,
}: {
  plan: StayContext['payment_plan'] | null;
  depositAmount: number | null;
  gesamt: number;
  color: string;
  locale: string;
  geld: Geld;
  s: StayLabel;
}) {
  const jetzt = plan ? plan.due_now : depositAmount;
  if (jetzt == null) return null;
  const rest = plan ? plan.due_later : Math.max(gesamt - jetzt, 0);
  const faellig = plan?.balance_due_date
    ? s('dueBy', { date: formatDate(plan.balance_due_date, locale) })
    : s('dueBeforeArrival');
  return (
    <div className="mx-10 mt-5 rounded-lg p-4" style={{ backgroundColor: `${color}12` }}>
      <div className="mb-1 text-sm font-semibold text-gray-900">{s('payment')}</div>
      <div className="flex justify-between text-[11px]">
        <span>{s('dueOnAcceptance')}</span>
        <span className="font-semibold">{geld(jetzt)}</span>
      </div>
      {rest > 0 && (
        <div className="flex justify-between text-[11px] text-gray-700">
          <span>
            {s('balance')} · {faellig}
          </span>
          <span>{geld(rest)}</span>
        </div>
      )}
    </div>
  );
}

function Bedingungen({ stay, s }: { stay: StayContext | null; s: StayLabel }) {
  const storno = stay?.cancellation || null;
  if (!storno && !stay?.house_rules) return null;
  return (
    <div className="mx-10 mt-5 grid grid-cols-2 gap-6 text-[11px] text-gray-700">
      {storno && (
        <div>
          <div className="mb-1 font-semibold text-gray-900">{s('cancellation')}</div>
          {storno.mode === 'non_refundable' && <div>{s('nonRefundable')}</div>}
          {storno.mode === 'refundable' && <div>{s('refundable')}</div>}
          {storno.mode === 'partial' &&
            storno.rules.map((r) => (
              <div key={r.days_before_arrival}>
                {s('partialRefund', { days: r.days_before_arrival, percent: r.refund_percent })}
              </div>
            ))}
        </div>
      )}
      {stay?.house_rules && (
        <div>
          <div className="mb-1 font-semibold text-gray-900">{s('houseRules')}</div>
          <div className="whitespace-pre-wrap">{stay.house_rules}</div>
        </div>
      )}
    </div>
  );
}

function Schluss({
  data,
  gueltigBis,
  locale,
  s,
}: {
  data: ProcessedPDFData;
  gueltigBis: string;
  locale: string;
  s: StayLabel;
}) {
  return (
    <div className="px-10 pt-5 text-[11px] leading-relaxed text-gray-700">
      {data.processedFooterText ? (
        <div dangerouslySetInnerHTML={{ __html: data.processedFooterText }} />
      ) : (
        <>
          <div className="font-semibold text-gray-900">{s('howToBook')}</div>
          <div>{s('howToBookText')}</div>
          {gueltigBis && <div>{s('offerValidUntil', { date: formatDate(gueltigBis, locale) })}</div>}
        </>
      )}
    </div>
  );
}

// Aufenthaltsfelder aus dem durchgereichten Beleg lesen (ProcessedPDFData ist
// offen typisiert; hier wird EINMAL geprüft, die Blöcke bekommen saubere Typen).
function aufenthaltAus(data: ProcessedPDFData) {
  const text = (w: unknown) => (typeof w === 'string' && w ? w : null);
  const zahl = (w: unknown) => (typeof w === 'number' ? w : null);
  return {
    stay: (data.stay as StayContext | null | undefined) ?? null,
    stayFrom: text(data.stayFrom),
    stayTo: text(data.stayTo),
    guestCount: zahl(data.guestCount),
    depositAmount: zahl(data.depositAmount),
    gueltigBis: text(data.validUntil) ?? text(data.dueDate) ?? '',
  };
}

export const StayTemplate: React.FC<StayTemplateProps> = ({
  data,
  color = '#b82028',
  logoSize = 50,
  documentType,
  documentSettings,
}) => {
  const language = documentSettings?.language || data.language || 'de';
  const { t, stay: s, dateLocale: locale } = useDocumentTranslation(language);
  const detectedType = documentType || detectDocumentType(data) || 'quote';
  const config = getTranslatedDocumentTypeConfig(detectedType, t, color);
  const { stay, stayFrom, stayTo, guestCount, depositAmount, gueltigBis } = aufenthaltAus(data);
  const geld: Geld = (betrag) => formatCurrency(betrag, data.currency || '');

  return (
    <div
      className="mx-auto w-full bg-white text-xs"
      style={{ fontFamily: 'Arial, sans-serif', width: '794px', maxWidth: '794px' }}
    >
      <div className="pdf-page relative flex flex-col" style={{ minHeight: '1123px' }}>
        <Kopf data={data} logoSize={logoSize} />
        <Haus data={data} stay={stay} title={config.title} locale={locale} s={s} t={t} gueltigBis={gueltigBis} />
        <Empfaenger data={data} t={t} />
        <Aufenthalt stay={stay} stayFrom={stayFrom} stayTo={stayTo} guestCount={guestCount} locale={locale} s={s} />
        <Preise data={data} geld={geld} s={s} locale={locale} />
        <Zahlung
          plan={stay?.payment_plan || null}
          depositAmount={depositAmount}
          gesamt={data.total}
          color={color}
          locale={locale}
          geld={geld}
          s={s}
        />
        <Bedingungen stay={stay} s={s} />
        <Schluss data={data} gueltigBis={gueltigBis} locale={locale} s={s} />
        <div className="mt-auto">
          <SimpleFooter data={data} color={color} showPageNumbers={false} />
        </div>
      </div>
    </div>
  );
};
