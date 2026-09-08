// Beleg einer Abrechnung — die App-Fassung des PDFs, das das Web-Portal aus
// demselben Datensatz rendert (Vorlage: Hostaway „Monthly Owner Statement":
// Kopf mit Logo und Parteien, KENNZAHLEN, VERMIETUNG, VERRECHNUNGSPOSTEN,
// Summenblock). Daten: `GET /public-portal/statements/{id}` — der Server
// maskiert für den Eigentümer Gastpreis und Verwaltungs-Ertrag (§4.2); was
// hier `null` ist, wird als „—" gezeigt, nie als 0 (Wurzel 4).
//
// KEIN PDF IN DER APP: das PDF entsteht im Web über einen Browser-Renderer
// (Playwright in der Next-Route), den es im Python-Backend nicht gibt. Die App
// zeigt den Beleg nativ und bietet „Teilen" (Text) an — ehrlicher als ein
// Knopf „PDF", der keinen erzeugen kann. Der Zusammenfassungstext wird HIER
// gebaut; es gibt keine zweite Kopie der Zahlen.
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Share, View } from "react-native";

import { useT } from "@/contexts/SprachContext";
import { Icon } from "@/components/ui/Icon";
import { Kachel, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { betragKurz, grundText } from "@/lib/kalender-aufenthalte";
import { kanalAusQuelle, kanalLabel } from "@/lib/kanaele";
import { type Beleg, type BelegZeile, getOwnerStatement } from "@/lib/ownerPortal";
import { type Uebersetzer, ausIso, datumKurz, spanneLesbar } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Route = { params: { id: string; titel: string } };

/** Betrag oder „—". */
function geld(txt: Uebersetzer, wert: number | null | undefined, currency: string): string {
  return wert === null || wert === undefined ? betragKurz(txt) : formatCurrency(wert, currency, 2);
}

/** Eigentümer-Anteil einer Zeile in Owner-Währung (umgerechnet, sonst Quellwährung). */
export function zeilenAnteil(z: BelegZeile, ownerCurrency: string): { betrag: number | null; currency: string } {
  if (z.owner_payout_converted !== null) return { betrag: z.owner_payout_converted, currency: ownerCurrency };
  return { betrag: z.owner_payout, currency: z.currency };
}

/** Σ der gezeigten Anteile — null, sobald eine Zeile keinen Betrag hat. */
export function summeAnteile(rows: readonly BelegZeile[], ownerCurrency: string): number | null {
  let s = 0;
  for (const r of rows) {
    const a = zeilenAnteil(r, ownerCurrency);
    if (a.betrag === null || a.currency !== ownerCurrency) return null;
    s += a.betrag;
  }
  return rows.length ? s : 0;
}

/** Kanalname aus Zeile — Portalname vor Code. */
function kanalName(z: BelegZeile): string {
  const kanal = kanalAusQuelle(z.ota_name ?? z.channel);
  return kanal ? kanalLabel(kanal, z.ota_name ?? z.channel) : (z.ota_name ?? z.channel);
}

/** Klartext für „Teilen" — dieselben Zahlen, die der Screen zeigt. */
export function belegAlsText(txt: Uebersetzer, b: Beleg, titel: string): string {
  const cur = b.summary.owner_currency;
  const zeilen = [
    titel,
    txt("teilen.zeitraum", { spanne: spanneLesbar(txt, b.period_from, b.period_to) }),
    b.header.invoice_number ? txt("teilen.belegNr", { nummer: b.header.invoice_number }) : null,
    b.header.pm_name ? txt("teilen.verwaltung", { name: b.header.pm_name }) : null,
    "",
    txt("teilen.buchungen", { anzahl: b.summary.booking_count }),
    txt("teilen.anteile", { betrag: geld(txt, summeAnteile(b.rental_rows, cur), cur) }),
    b.summary.expenses_from_owner
      ? txt("teilen.abzuege", { betrag: geld(txt, b.summary.expenses_from_owner, cur) })
      : null,
    b.summary.expenses_to_owner
      ? txt("teilen.gutschriften", { betrag: geld(txt, b.summary.expenses_to_owner, cur) })
      : null,
    b.summary.recurring_from_owner
      ? txt("teilen.abzuegeWiederkehrend", { betrag: geld(txt, b.summary.recurring_from_owner, cur) })
      : null,
    b.summary.recurring_to_owner
      ? txt("teilen.gutschriftenWiederkehrend", { betrag: geld(txt, b.summary.recurring_to_owner, cur) })
      : null,
    txt("teilen.auszahlung", { betrag: geld(txt, b.summary.owner_payout, cur) }),
  ];
  return zeilen.filter((z): z is string => z !== null).join("\n");
}

export default function AbrechnungDetail({ route }: { route: Route }) {
  const txt = useT();
  const t = useTheme();
  const { id, titel } = route.params;
  const [beleg, setBeleg] = useState<Beleg | null>(null);
  // Welche Buchungszeile ihre Rechenkette zeigt (Portal-Abzug, Provision,
  // Pauschale, Gebühren). Gemeldet 08.09.2026: „OTA-Gebühren, alles fehlt" —
  // der Beleg nannte je Zeile nur den Endbetrag, also eine Behauptung ohne
  // Herleitung. Immer offen wäre die Liste unlesbar, darum je Zeile aufklappbar.
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getOwnerStatement(id);
    if (res.ok) setBeleg(res.data);
    else setFehler(res.error);
    setLaedt(false);
  }, [id]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const teilen = async () => {
    if (!beleg) return;
    try {
      await Share.share({ message: belegAlsText(txt, beleg, titel), title: titel });
    } catch {
      // Abgebrochen vom Nutzer — kein Fehler.
    }
  };

  const cur = beleg?.summary.owner_currency ?? "";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
    >
      {fehler ? (
        <Kachel>
          <Txt v="title">Beleg nicht geladen</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            {fehler}
          </Txt>
        </Kachel>
      ) : null}
      {laedt && !beleg ? (
        <Kachel>
          <Spinner />
        </Kachel>
      ) : null}

      {beleg ? (
        <>
          {/* Kopf: Verwaltung links (Logo), Eigentümer rechts, Zeitraum */}
          <Kachel>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View style={{ flex: 1 }}>
                {beleg.header.pm_logo_url ? (
                  <Image
                    source={{ uri: beleg.header.pm_logo_url }}
                    style={{ width: 120, height: 36, marginBottom: 8 }}
                    resizeMode="contain"
                    accessibilityLabel={beleg.header.pm_name ?? "Logo"}
                  />
                ) : null}
                {beleg.header.pm_name ? <Txt v="title">{beleg.header.pm_name}</Txt> : null}
                {beleg.header.pm_address ? (
                  <Txt v="xs" soft>
                    {beleg.header.pm_address}
                  </Txt>
                ) : null}
                {beleg.header.pm_email ? (
                  <Txt v="xs" soft>
                    {beleg.header.pm_email}
                  </Txt>
                ) : null}
              </View>
              <Pressable onPress={() => void teilen()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Teilen">
                <Icon n="share" s={22} c={t.palette.ink} />
              </Pressable>
            </View>
            <View style={{ height: 1, backgroundColor: t.palette.line, marginVertical: 12 }} />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Txt v="eyebrow" soft>
                  Eigentümer
                </Txt>
                <Txt v="sm" style={{ marginTop: 2 }}>
                  {beleg.header.owner_name ?? "—"}
                </Txt>
                {beleg.header.owner_email ? (
                  <Txt v="xs" soft>
                    {beleg.header.owner_email}
                  </Txt>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="eyebrow" soft>
                  {txt("allg.zeitraum")}
                </Txt>
                <Txt v="sm" style={{ marginTop: 2 }}>
                  {spanneLesbar(txt, beleg.period_from, beleg.period_to)}
                </Txt>
                {beleg.invoice_date ? (
                  <Txt v="xs" soft>
                    {txt("abr.belegdatumAm", {
                      datum: datumKurz(txt, beleg.invoice_date),
                      jahr: ausIso(beleg.invoice_date).getFullYear(),
                    })}
                  </Txt>
                ) : null}
                {beleg.header.invoice_number ? (
                  <Txt v="xs" soft>
                    {txt("abr.belegNr", { nummer: beleg.header.invoice_number })}
                  </Txt>
                ) : null}
              </View>
            </View>
          </Kachel>

          {/* Kennzahlen */}
          <Kachel>
            <Txt v="eyebrow" soft style={{ marginBottom: 10 }}>
              Kennzahlen
            </Txt>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Kennzahl titel={txt("kennzahl.auszahlung")} wert={geld(txt, beleg.summary.owner_payout, cur)} gross />
              <Kennzahl titel={txt("allg.buchungen")} wert={String(beleg.summary.booking_count)} />
            </View>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              <Kennzahl titel={txt("abr.anteileVermietung")} wert={geld(txt, summeAnteile(beleg.rental_rows, cur), cur)} />
              <Kennzahl
                titel={txt("abr.verrechnungsposten")}
                wert={geld(
                  txt,
                  beleg.summary.expenses_to_owner -
                    beleg.summary.expenses_from_owner +
                    beleg.summary.recurring_to_owner -
                    beleg.summary.recurring_from_owner,
                  cur,
                )}
              />
            </View>
            {beleg.summary.owner_payout === null ? (
              <Txt v="xs" faint style={{ marginTop: 10 }}>
                {grundText(txt, beleg.summary.payout_unbekannt)}
              </Txt>
            ) : null}
          </Kachel>

          {/* Vermietung */}
          <Kachel pad={0}>
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <Txt v="eyebrow" soft>
                Vermietung
              </Txt>
            </View>
            {beleg.rental_rows.length === 0 ? (
              <Txt v="sm" soft style={{ padding: 16, paddingTop: 4 }}>
                {txt("abr.keineBuchungen")}
              </Txt>
            ) : (
              beleg.rental_rows.map((z, i) => (
                <Buchungszeile
                  key={z.reservation_id}
                  z={z}
                  cur={cur}
                  erste={i === 0}
                  mitObjekt={beleg.listing_rows.length > 1}
                  offen={offeneZeile === z.reservation_id}
                  auf={() =>
                    setOffeneZeile((alt) => (alt === z.reservation_id ? null : z.reservation_id))
                  }
                />
              ))
            )}
          </Kachel>

          {/* Verrechnungsposten */}
          {beleg.expenses.length > 0 || beleg.recurring.length > 0 ? (
            <Kachel pad={0}>
              <View style={{ padding: 16, paddingBottom: 8 }}>
                <Txt v="eyebrow" soft>
                  {txt("abr.verrechnungsposten")}
                </Txt>
              </View>
              {beleg.expenses.map((p, i) => (
                <Posten
                  key={p.id}
                  titel={p.concept}
                  unter={`${datumKurz(txt, p.date)}${p.category ? ` · ${p.category}` : ""}`}
                  betrag={p.signed_amount}
                  currency={p.currency ?? beleg.summary.currency}
                  erste={i === 0}
                />
              ))}
              {beleg.recurring.map((p, i) => (
                <Posten
                  key={p.item_id}
                  titel={p.label}
                  unter={`${p.anzahl} × ${formatCurrency(p.einzelbetrag, p.currency, 2)}`}
                  betrag={p.betrag}
                  currency={p.currency}
                  erste={i === 0 && beleg.expenses.length === 0}
                />
              ))}
            </Kachel>
          ) : null}

          {/* Summenblock */}
          <Kachel>
            <SummenZeile label={`Anteile aus Vermietung (${beleg.rental_rows.length})`} wert={geld(txt, summeAnteile(beleg.rental_rows, cur), cur)} />
            {beleg.summary.pauschalen_gesamt ? (
              <SummenZeile
                label={txt("abr.darinPauschalen")}
                wert={`−${geld(txt, beleg.summary.pauschalen_gesamt, cur)}`}
                gedaempft
              />
            ) : null}
            {beleg.summary.expenses_from_owner ? (
              <SummenZeile label={txt("abr.abzuegePosten")} wert={`−${geld(txt, beleg.summary.expenses_from_owner, cur)}`} />
            ) : null}
            {beleg.summary.expenses_to_owner ? (
              <SummenZeile label={txt("abr.gutschriftenPosten")} wert={`+${geld(txt, beleg.summary.expenses_to_owner, cur)}`} />
            ) : null}
            {beleg.summary.recurring_from_owner ? (
              <SummenZeile label={txt("abr.abzuegeWiederkehrend")} wert={`−${geld(txt, beleg.summary.recurring_from_owner, cur)}`} />
            ) : null}
            {beleg.summary.recurring_to_owner ? (
              <SummenZeile label={txt("abr.gutschriftenWiederkehrend")} wert={`+${geld(txt, beleg.summary.recurring_to_owner, cur)}`} />
            ) : null}
            <View style={{ height: 1, backgroundColor: t.palette.line, marginVertical: 8 }} />
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Txt v="title" style={{ flex: 1 }}>
                Auszahlung ({cur})
              </Txt>
              <Txt v="h2">{geld(txt, beleg.summary.owner_payout, cur)}</Txt>
            </View>
            {beleg.header.notes ? (
              <Txt v="xs" faint style={{ marginTop: 10 }}>
                {beleg.header.notes}
              </Txt>
            ) : null}
          </Kachel>
        </>
      ) : null}
    </ScrollView>
  );
}

function Kennzahl({ titel, wert, gross }: { titel: string; wert: string; gross?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt v="xs" soft numberOfLines={1}>
        {titel}
      </Txt>
      <Txt v={gross ? "h1" : "title"} numberOfLines={1} style={{ marginTop: 2 }}>
        {wert}
      </Txt>
    </View>
  );
}

function Posten({
  titel,
  unter,
  betrag,
  currency,
  erste,
}: {
  titel: string;
  unter: string;
  betrag: number;
  currency: string;
  erste: boolean;
}) {
  const t = useTheme();
  const vz = betrag < 0 ? "−" : "+";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: erste ? 0 : 1,
        borderTopColor: t.palette.line,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt v="sm" numberOfLines={1}>
          {titel}
        </Txt>
        <Txt v="xs" soft numberOfLines={1}>
          {unter}
        </Txt>
      </View>
      <Txt v="sm" style={{ fontFamily: t.fonts.semibold }} color={betrag < 0 ? t.palette.accent : t.palette.ink}>
        {vz}
        {formatCurrency(Math.abs(betrag), currency, 2)}
      </Txt>
    </View>
  );
}

function SummenZeile({ label, wert, gedaempft }: { label: string; wert: string; gedaempft?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }}>
      <Txt v="sm" soft={gedaempft} style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt v="sm" soft={gedaempft}>
        {wert}
      </Txt>
    </View>
  );
}

/**
 * Eine Buchung im Beleg: Kopfzeile mit Anteil, aufgeklappt die volle Kette.
 *
 * WELCHE ZAHLEN HIER STEHEN (§4.2): `auszahlungsbasis` ist der Gastpreis NACH
 * Portal-Abzug — den Gastpreis selbst und die Portal-Provision einzeln sieht
 * der Eigentümer nicht, die sind Betriebssicht und kommen vom Server als
 * `null`. Was fehlt, wird weggelassen statt mit 0 gefüllt (Wurzel 4).
 */
function Buchungszeile({
  z,
  cur,
  erste,
  mitObjekt,
  offen,
  auf,
}: {
  z: BelegZeile;
  cur: string;
  erste: boolean;
  mitObjekt: boolean;
  offen: boolean;
  auf: () => void;
}) {
  const t = useTheme();
  const txt = useT();
  const anteil = zeilenAnteil(z, cur);
  const wc = z.currency;
  const zeilen: { k: string; v: string; minus?: boolean }[] = [];
  if (z.auszahlungsbasis !== null) {
    zeilen.push({ k: txt("abr.nachPortalabzug"), v: geld(txt, z.auszahlungsbasis, wc) });
  }
  if (z.portal_provision !== null) {
    zeilen.push({ k: txt("abr.portalProvision"), v: geld(txt, z.portal_provision, wc), minus: true });
  }
  for (const g of z.gebuehren) {
    // Der Betrag ist NUR bei eigenen Gebühren sichtbar; die des Betriebs und
    // durchlaufende Posten (Kurtaxe) maskiert der Server (§4.2) — sie kommen
    // als `null` an. Dort steht deshalb kein „k. A.", das behauptete eine
    // fehlende Zahl: es steht, WEM die Gebühr gehört. Nur die eigene Gebühr
    // verändert den Anteil und bekommt ein Vorzeichen.
    const eigen = g.gehoert_zu === "eigentuemer";
    zeilen.push({
      k: g.label,
      v: eigen
        ? geld(txt, g.betrag, wc)
        : g.betrag !== null
          ? geld(txt, g.betrag, wc)
          : g.gehoert_zu === "durchlauf"
            ? txt("abr.durchlaufend")
            : txt("abr.ueberVerwaltung"),
      minus: eigen ? false : g.betrag !== null && g.gehoert_zu === "betrieb",
    });
  }
  if (z.pauschale !== null && z.pauschale !== 0) {
    zeilen.push({ k: txt("abr.pauschale"), v: geld(txt, z.pauschale, wc), minus: true });
  }
  if (z.verwaltungsprovision !== null) {
    zeilen.push({ k: txt("abr.verwaltungsprovision"), v: geld(txt, z.verwaltungsprovision, wc), minus: true });
  }
  if (z.gebuehren_an_eigentuemer !== null && z.gebuehren_an_eigentuemer !== 0) {
    zeilen.push({ k: txt("abr.gebuehrenAnSie"), v: geld(txt, z.gebuehren_an_eigentuemer, wc) });
  }

  return (
    <View style={{ borderTopWidth: erste ? 0 : 1, borderTopColor: t.palette.line }}>
      <Pressable
        onPress={auf}
        accessibilityRole="button"
        accessibilityState={{ expanded: offen }}
        style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 }}
      >
        <View style={{ flex: 1 }}>
          <Txt v="sm" numberOfLines={1}>
            {z.guest ?? txt("allg.gast")}
          </Txt>
          <Txt v="xs" soft numberOfLines={1}>
            {z.check_in ? datumKurz(txt, z.check_in) : "—"} · {z.nights}{" "}
            {txt(z.nights === 1 ? "allg.nacht" : "allg.naechte")} ·{" "}
            {kanalName(z)}
          </Txt>
          {mitObjekt && z.listing ? (
            <Txt v="xs" faint numberOfLines={1}>
              {z.listing}
            </Txt>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
            {geld(txt, anteil.betrag, anteil.currency)}
          </Txt>
          {z.payout_unbekannt ? (
            <Txt v="xs" faint>
              {grundText(txt, z.payout_unbekannt)}
            </Txt>
          ) : null}
        </View>
        {zeilen.length > 0 ? (
          <View style={{ marginLeft: 8 }}>
            <Icon n={offen ? "caretdown" : "fwd"} s={14} c={t.palette.faint} />
          </View>
        ) : null}
      </Pressable>

      {offen && zeilen.length > 0 ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 5 }}>
          {zeilen.map((r2, k) => (
            <View key={`${r2.k}-${k}`} style={{ flexDirection: "row", alignItems: "center" }}>
              <Txt v="xs" soft style={{ flex: 1 }} numberOfLines={1}>
                {r2.minus ? "− " : ""}
                {r2.k}
              </Txt>
              <Txt v="xs" soft>
                {r2.v}
              </Txt>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: t.palette.line, marginVertical: 3 }} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Txt v="xs" style={{ flex: 1, fontFamily: t.fonts.semibold }}>
              {txt("abr.ihrAnteil")}
            </Txt>
            <Txt v="xs" style={{ fontFamily: t.fonts.semibold }}>
              {geld(txt, anteil.betrag, anteil.currency)}
            </Txt>
          </View>
        </View>
      ) : null}
    </View>
  );
}
