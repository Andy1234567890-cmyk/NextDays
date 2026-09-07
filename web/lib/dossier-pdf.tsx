"use client";

// Objektkartei als hochwertiges A4-Exposé — clientseitig via @react-pdf/renderer
// (kein Chromium, keine HTML→PDF-Route). Alle Beschriftungen kommen als
// i18n-Labels-Objekt herein (kein hart-kodierter Text), damit das PDF in der
// Sprache des Nutzers erscheint. Leere Felder → „—". Marke: Logo-Schwarz/Rot.
// @react-pdf wird erst zur Laufzeit dynamisch geladen (siehe buildDossierPdf),
// damit die native Loader-Kette nicht ins Server-/CSS-Bundling gerät.
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type {
  DossierFull,
  PlatformLaunch,
  ServiceAgreement,
  Tradesperson,
} from "@/lib/property-dossier";
import type { Property } from "@/lib/properties";

// Flache Label-Map, die der Button aus useTranslations füllt (Key → übersetzt).
export type DossierLabels = Record<string, string>;

// Markenfarben (Spiegel von app/globals.css: --primary/--accent).
const C = {
  ink: "#0a0a0a",
  accent: "#b82028",
  body: "#3a3733",
  muted: "#8a847d",
  faint: "#b8b2aa",
  hair: "#ece8e1",
  panel: "#faf8f4",
  white: "#ffffff",
} as const;

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.body,
    // Fester Kopf-/Fußraum gilt für JEDE Seite, auch nach dem Umbruch, damit
    // Inhalt nie am Blattrand klebt. Der Cover-Block zieht sich per negativem
    // Margin bündig an die obere Blattkante (nur auf Seite 1 vorhanden).
    paddingTop: 34,
    paddingBottom: 52,
    paddingHorizontal: 40,
    lineHeight: 1.45,
  },
  // Deckblatt-Kopf mit Cover-Foto und Titel-Overlay (randlos an die Blattkante).
  cover: {
    height: 210,
    position: "relative",
    backgroundColor: C.ink,
    marginTop: -34,
    marginHorizontal: -40,
  },
  coverImg: { width: "100%", height: 210, objectFit: "cover" },
  coverShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
    backgroundColor: "#0a0a0a",
    opacity: 0.55,
  },
  coverText: { position: "absolute", left: 40, right: 40, bottom: 22 },
  // Fallback-Kopf ohne Foto: schlichter dunkler Balken (randlos wie das Cover).
  plainHead: {
    backgroundColor: C.ink,
    marginTop: -34,
    marginHorizontal: -40,
    paddingHorizontal: 40,
    paddingTop: 34,
    paddingBottom: 26,
  },
  brand: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    letterSpacing: 2,
    color: C.accent,
    marginBottom: 6,
  },
  h1: { fontFamily: "Helvetica-Bold", fontSize: 22, color: C.white },
  place: { fontSize: 10, color: "#d8d3cc", marginTop: 3 },
  // Akzentlinie unter dem Cover — randlos, gleicher negativer Margin.
  accentBar: { height: 3, backgroundColor: C.accent, marginHorizontal: -40 },

  body: { paddingTop: 22 },

  // Sektion mit Nummern-Badge und Titel.
  section: { marginBottom: 15 },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.ink,
    color: C.white,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    lineHeight: 1,
    textAlign: "center",
    paddingTop: 4,
    marginRight: 8,
  },
  secTitle: { fontFamily: "Helvetica-Bold", fontSize: 11, color: C.ink, flexGrow: 1 },
  secRule: { height: 0.7, backgroundColor: C.hair, marginTop: 3, marginBottom: 7 },

  // Zweispaltiges Feld-Raster.
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", paddingRight: 14, marginBottom: 6 },
  cellFull: { width: "100%", marginBottom: 6 },
  label: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 9.5, color: C.ink, marginTop: 1 },
  valueEmpty: { fontSize: 9.5, color: C.faint, marginTop: 1 },

  // Karten für Listen (Verträge/Handwerker/Plattformen).
  card: {
    backgroundColor: C.panel,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    borderRadius: 2,
    paddingVertical: 8,
    paddingHorizontal: 11,
    marginBottom: 7,
  },
  cardTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, color: C.ink, marginBottom: 4 },
  empty: { fontSize: 9, color: C.faint, fontStyle: "italic" },

  ownerPanel: {
    backgroundColor: C.panel,
    borderRadius: 3,
    padding: 12,
  },
  ownerName: { fontFamily: "Helvetica-Bold", fontSize: 12, color: C.ink },
  ownerCompany: { fontSize: 9, color: C.muted, marginBottom: 6 },

  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.7,
    borderTopColor: C.hair,
    paddingTop: 6,
    fontSize: 7.5,
    color: C.faint,
  },
});

function val(
  v: string | number | boolean | null | undefined,
  L: DossierLabels,
): { text: string; empty: boolean } {
  if (v === null || v === undefined || v === "") return { text: "—", empty: true };
  if (typeof v === "boolean") return { text: v ? L.yes : L.no, empty: false };
  return { text: String(v), empty: false };
}

function Field({
  label,
  value,
  labels,
  full,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
  labels: DossierLabels;
  full?: boolean;
}) {
  const r = val(value, labels);
  return (
    <View style={full ? s.cellFull : s.cell}>
      <Text style={s.label}>{label}</Text>
      <Text style={r.empty ? s.valueEmpty : s.value}>{r.text}</Text>
    </View>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.section} wrap={false}>
      <View style={s.secHead}>
        {n > 0 ? <Text style={s.badge}>{n}</Text> : null}
        <Text style={s.secTitle}>{title}</Text>
      </View>
      <View style={s.secRule} />
      {children}
    </View>
  );
}

function DossierDoc({
  property,
  d,
  labels: L,
  coverUrl,
}: {
  property: Property;
  d: DossierFull;
  labels: DossierLabels;
  coverUrl: string | null;
}) {
  const o = d.owner;
  const a = d.access;
  const pr = d.process;
  const m = d.marketing;
  const hb = d.housebook;
  const em = d.emergency_authority;
  const sizeM2 = property.size_value ?? undefined;
  const place = [property.city, property.country].filter(Boolean).join(", ");

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {coverUrl ? (
          <View style={s.cover} fixed={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={coverUrl} style={s.coverImg} />
            <View style={s.coverShade} />
            <View style={s.coverText}>
              <Text style={s.brand}>{L.brand}</Text>
              <Text style={s.h1}>{property.title}</Text>
              {place ? <Text style={s.place}>{place}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={s.plainHead}>
            <Text style={s.brand}>{L.brand}</Text>
            <Text style={s.h1}>{property.title}</Text>
            {place ? <Text style={s.place}>{place}</Text> : null}
          </View>
        )}
        <View style={s.accentBar} />

        <View style={s.body}>
          <Section n={1} title={L["step.object_info"]}>
            <View style={s.grid}>
              <Field label={L.name} value={property.title} labels={L} />
              <Field label={L.type} value={property.property_type} labels={L} />
              <Field label={L.capacityPersons} value={property.max_guests} labels={L} />
              <Field label={L.capacitySqm} value={typeof sizeM2 === "number" ? sizeM2 : null} labels={L} />
              <Field label={L.bfeNumber} value={property.bfe_number} labels={L} />
              <Field
                label={L.boligtype}
                value={property.boligtype ? (L[`boligtype.${property.boligtype}`] ?? property.boligtype) : null}
                labels={L}
              />
            </View>
          </Section>

          <Section n={0} title={L["owner.heading"]}>
            {o ? (
              <View style={s.ownerPanel}>
                <Text style={s.ownerName}>{o.name}</Text>
                {o.company ? <Text style={s.ownerCompany}>{o.company}</Text> : null}
                <View style={s.grid}>
                  <Field label={L["owner.email"]} value={o.email} labels={L} />
                  <Field label={L["owner.phone"]} value={o.phone} labels={L} />
                  <Field label={L["owner.iban"]} value={o.iban} labels={L} />
                  <Field label={L["owner.bic"]} value={o.bic} labels={L} />
                  <Field label={L["owner.bankName"]} value={o.bank_name} labels={L} />
                  <Field label={L["owner.accountHolder"]} value={o.account_holder} labels={L} />
                  <Field label={L["owner.bankRegNr"]} value={o.bank_reg_nr} labels={L} />
                  <Field label={L["owner.bankKontoNr"]} value={o.bank_konto_nr} labels={L} />
                  <Field label={L["owner.taxId"]} value={o.tax_id} labels={L} />
                  <Field label={L["owner.vatId"]} value={o.vat_id} labels={L} />
                  <Field label={L["owner.cprNumber"]} value={o.cpr_number} labels={L} />
                  <Field label={L["owner.ownershipShare"]} value={o.ownership_share} labels={L} />
                </View>
              </View>
            ) : (
              <Text style={s.empty}>{L.noOwner}</Text>
            )}
          </Section>

          <Section n={2} title={L["step.process"]}>
            <View style={s.grid}>
              <Field label={L.firstMeeting} value={pr.first_meeting_at} labels={L} />
              <Field label={L.contractSent} value={pr.contract_sent_at} labels={L} />
              <Field label={L.contractSigned} value={pr.contract_signed_at} labels={L} />
              <Field label={L.invoiceSent} value={pr.onboarding_invoice_sent_at} labels={L} />
              <Field label={L.invoicePaid} value={pr.onboarding_invoice_paid_at} labels={L} />
            </View>
          </Section>

          <Section n={3} title={L["step.access"]}>
            <View style={s.grid}>
              <Field
                label={L.keyStatus}
                value={a.key_status ? (L[`keyStatus.${a.key_status}`] ?? a.key_status) : null}
                labels={L}
              />
              <Field label={L.keyPlacement} value={a.key_placement} labels={L} />
            </View>
          </Section>

          <Section n={4} title={L["step.service_agreements"]}>
            {d.service_agreements.length ? (
              d.service_agreements.map((x: ServiceAgreement, i) => (
                <View style={s.card} key={x.id ?? i} wrap={false}>
                  <Text style={s.cardTitle}>
                    {L[`serviceType.${x.service_type}`] ?? x.service_type}
                  </Text>
                  <View style={s.grid}>
                    <Field label={L.frequency} value={x.frequency} labels={L} />
                    <Field label={L.price} value={x.price} labels={L} />
                    <Field label={L.currency} value={x.currency} labels={L} />
                    <Field label={L.notes} value={x.notes} labels={L} full />
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.empty}>{L.empty}</Text>
            )}
          </Section>

          <Section n={5} title={L["step.tradespeople"]}>
            {d.tradespeople.length ? (
              d.tradespeople.map((x: Tradesperson, i) => (
                <View style={s.card} key={x.id ?? i} wrap={false}>
                  <Text style={s.cardTitle}>{L[`trade.${x.trade}`] ?? x.trade}</Text>
                  <View style={s.grid}>
                    <Field label={L.name} value={x.name} labels={L} />
                    <Field label={L.phone} value={x.phone} labels={L} />
                    <Field label={L.notes} value={x.notes} labels={L} full />
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.empty}>{L.empty}</Text>
            )}
            <View style={{ marginTop: 4 }}>
              <Text style={{ ...s.label, marginBottom: 4 }}>{L.authorityHeading}</Text>
              <View style={s.grid}>
                <Field
                  label={L.authorityMode}
                  value={em.authority_mode ? (L[`authorityMode.${em.authority_mode}`] ?? em.authority_mode) : null}
                  labels={L}
                />
                <Field label={L.authorityLimit} value={em.authority_limit} labels={L} />
                <Field label={L.currency} value={em.currency} labels={L} />
              </View>
            </View>
          </Section>

          <Section n={6} title={L["step.marketing"]}>
            <View style={s.grid}>
              <Field label={L.photographerBooked} value={m.photographer_booked_at} labels={L} />
              <Field label={L.mediaReceived} value={m.media_received_at} labels={L} />
              <Field label={L.siteWalkthrough} value={m.site_walkthrough_at} labels={L} />
              <Field label={L.defectsListSent} value={m.defects_list_sent_at} labels={L} />
            </View>
          </Section>

          <Section n={7} title={L["step.housebook"]}>
            <View style={s.grid}>
              <Field
                label={L.welcomeStatus}
                value={hb.welcome_text_status ? (L[`welcomeStatus.${hb.welcome_text_status}`] ?? hb.welcome_text_status) : null}
                labels={L}
              />
              <Field label={L.physicalPlaced} value={hb.physical_folder_placed} labels={L} />
              <Field label={L.secretTips} value={hb.secret_tips} labels={L} full />
            </View>
          </Section>

          <Section n={8} title={L["step.listing"]}>
            {d.platform_launches.length ? (
              d.platform_launches.map((p: PlatformLaunch, i) => (
                <View style={s.card} key={p.id ?? i} wrap={false}>
                  <Text style={s.cardTitle}>
                    {L[`platform.${p.platform}`] ?? p.platform}
                  </Text>
                  <View style={s.grid}>
                    <Field label={L.launchAt} value={p.launch_at} labels={L} />
                    <Field label={L.status} value={p.status} labels={L} />
                  </View>
                </View>
              ))
            ) : (
              <Text style={s.empty}>{L.empty}</Text>
            )}
          </Section>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {L.title} — {property.title}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Rendert die Objektkartei als PDF-Blob (clientseitig, kein Backend). Die
 *  Renderer-Fabrik `pdf` wird erst hier dynamisch geladen, damit @react-pdf
 *  nicht ins Server-/CSS-Bundling gerät. */
export async function buildDossierPdf(
  property: Property,
  d: DossierFull,
  labels: DossierLabels,
  coverUrl: string | null = null,
): Promise<Blob> {
  const { pdf } = await import("@react-pdf/renderer");
  return pdf(
    <DossierDoc property={property} d={d} labels={labels} coverUrl={coverUrl} />,
  ).toBlob();
}
