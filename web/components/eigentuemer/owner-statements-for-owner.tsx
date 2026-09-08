"use client";

// Eigentümer-Detailseite = Owner-Statements-Oberfläche (Hostaway-Layout) für
// GENAU diesen Eigentümer: Tabs „Create & Edit" / „Manage statements", „Neu"
// erzeugt direkt ein Statement für diesen Owner. Zusätzlich ein dezenter Zugang
// zu den Stammdaten/Auszahlungs-Einstellungen des Eigentümers.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { OwnerMasterSheet } from "@/components/eigentuemer/owner-master-sheet";
import { OwnerRealtime } from "@/components/eigentuemer/owner-realtime";
import { StatementEditor } from "@/components/owner-statements/statement-editor";
import { StatementManage } from "@/components/owner-statements/statement-manage";
import { Button } from "@nextdays/ui/button";
import type { Owner } from "@/lib/owners";
import {
  generateStatement,
  getStatement,
  previewStatement,
  type Statement,
  type StatementListItem,
} from "@/lib/owner-statements";
import { COLUMN_ORDER_STANDARD } from "@/lib/owner-statements-spalten";
import { monatsAnfangIso, monatsEndeIso } from "@/lib/dates";

type PropOption = { id: string; title: string };

export function OwnerStatementsForOwner({
  owner,
  statements,
  initialStatement = null,
  properties,
}: {
  owner: Owner;
  statements: StatementListItem[];
  initialStatement?: Statement | null;
  properties: PropOption[];
}) {
  const t = useTranslations("ownerStatements");
  const router = useRouter();
  const [tab, setTab] = useState<"edit" | "manage">("edit");
  const [current, setCurrent] = useState<Statement | null>(initialStatement);
  const [list, setList] = useState<StatementListItem[]>(statements);
  // Realtime liefert über router.refresh() frische Props — ohne Sync bliebe
  // die „Verwalten"-Liste für immer auf dem Mount-Stand (Abrechnungen anderer
  // Sessions erschienen nie).
  useEffect(() => {
    setList(statements);
  }, [statements]);
  const [masterOpen, setMasterOpen] = useState(false);
  // Die Objekte, die diesem Eigentümer WIRKLICH gehören.
  //
  // `properties` kommt aus `/owners/{id}/available-properties` und heißt
  // „zuordenbar": seine Objekte PLUS alle herrenlosen des Betriebs. Für den
  // Zuordnungs-Dialog ist genau das richtig, für die ABRECHNUNG ist es falsch
  // — ein Verrechnungsposten oder ein Vertrag auf einem fremden (nur gerade
  // freien) Objekt verrechnet Kosten, die nichts mit dieser Auszahlung zu tun
  // haben, und zieht über `properties.currency` sogar eine fremde Währung in
  // die Abrechnung. Maßgeblich ist deshalb `owner.properties`
  // (= `owner_properties`, die echte Zuordnung), nicht die Auswahlliste.
  //
  // Die Titel stammen weiterhin aus `properties`: dort stehen sie, und
  // `owner.properties` trägt nur IDs. Fehlt ein Titel, steht die ID da — sie
  // ist unschön, aber wahr; ein erfundener Platzhalter wäre es nicht (Wurzel 4).
  const titelById = new Map(properties.map((p) => [p.id, p.title]));
  const eigeneObjekte: PropOption[] = owner.properties.map((l) => ({
    id: l.property_id,
    title: titelById.get(l.property_id) ?? l.property_id,
  }));
  const previewLoaded = useRef(false);
  // current in einer ref spiegeln, damit der Realtime-Callback den aktuellen
  // Stand sieht (kein Stale-Closure), ohne das Abo neu aufzubauen.
  const currentRef = useRef<Statement | null>(current);
  currentRef.current = current;

  // Leeres Statement-Gerüst als Startanzeige, bis die Live-Vorschau geladen ist.
  const ownerAddress =
    [
      [owner.street, owner.house_number].filter(Boolean).join(" "),
      [owner.postal_code, owner.city].filter(Boolean).join(" "),
      owner.country,
    ]
      .filter(Boolean)
      .join(", ") || null;
  const draft: Statement = {
    id: "",
    tenant_id: owner.tenant_id,
    owner_id: owner.id,
    period_from: firstOfMonth(),
    period_to: lastOfMonth(),
    basis: "check_in",
    reservation_statuses: ["confirmed", "completed"],
    status: "draft",
    kind: "invoice",
    commission_pct: owner.default_commission_pct,
    invoice_date: null,
    due_date: null,
    supply_country: null,
    buyer_vat_id: owner.vat_id,
    tax: { category: "S", rate: 0, net: 0, tax: 0, gross: 0, exemption_reason: null },
    cancels_statement_id: null,
    cancelled_by_statement_id: null,
    header: {
      pm_name: null,
      pm_email: null,
      pm_phone: null,
      pm_address: null,
      pm_tax_id: null,
      pm_logo_url: null,
      owner_name: owner.name,
      owner_company: owner.company,
      owner_email: owner.email,
      owner_phone: owner.phone,
      owner_address: ownerAddress,
      owner_tax_id: owner.tax_id,
      invoice_number: null,
      notes: null,
    },
    summary: {
      total_price: 0,
      total_payout: 0,
      expenses_total: 0,
      expenses_to_owner: 0,
      expenses_from_owner: 0,
      owner_payout: 0,
      pm_payout: 0,
      // Leerzustand-Platzhalter (alle Betraege 0) — keine erfundene Waehrung
      // (Wurzel 4); die echte Waehrung kommt mit der ersten realen Abrechnung.
      currency: "",
      booking_count: 0,
      owner_currency: "",
      pm_payout_by_currency: [],
      totals_by_currency: [],
      // Leerzustand, noch nichts gerechnet — kein Grund für eine fehlende
      // Auszahlung, also auch kein Hinweis (der käme erst mit echten Daten).
      payout_unbekannt: null,
      // Kein Grund, also auch kein Detail: im Leerzustand gibt es keine
      // Buchung, an der etwas fehlen koennte.
      payout_unbekannt_detail: null,
      payout_unbekannt_buchung: null,
      // Wiederkehrende Posten und Pauschalen gibt es erst mit Buchungen im
      // Zeitraum; `null` bei den Pauschalen heißt „nicht gerechnet", nicht 0.
      recurring_to_owner: 0,
      recurring_from_owner: 0,
      pauschalen_gesamt: null,
    },
    rental_rows: [],
    listing_rows: [],
    ohne_objekt: {
      expenses_to_owner: 0,
      expenses_from_owner: 0,
      recurring_to_owner: 0,
      recurring_from_owner: 0,
    },
    expenses: [],
    recurring: [],
    // Vor dem ersten Abruf kennt der Entwurf keine Miteigentümer — der Server
    // liefert sie mit der Vorschau (0601).
    miteigentuemer: [],
    // 0603: alle Objekte, bis der Nutzer auswählt.
    property_ids: null,
    objekte: [],
    // 0604: Platzhalter bis zur ersten Vorschau — dieselbe erste Stufe wie die
    // Server-Kette (Eigentümer), sonst deren Ende (`en`). Kein Deutsch.
    language: owner.language ?? "en",
    sort_key: "check_in",
    sort_dir: "asc",
    column_order: COLUMN_ORDER_STANDARD,
    created_at: null,
    updated_at: null,
  };

  // Lokaler Monat, nicht UTC (`lib/dates.lokalIso`): `toISOString()` machte
  // aus dem 1. September in Kopenhagen den 31. August (live 07.09.2026).
  function firstOfMonth(): string {
    return monatsAnfangIso();
  }
  function lastOfMonth(): string {
    return monatsEndeIso();
  }

  // Live-Auswertung (Umsatz/Aktivität) laden — ohne zu speichern. Der Editor
  // ruft das bei Zeitraum-/Filter-Änderung erneut auf.
  async function loadPreview(opts?: {
    period_from?: string;
    period_to?: string;
    basis?: Statement["basis"];
    reservation_statuses?: string[];
    commission_pct?: number;
    property_ids?: string[];
    language?: string;
    sort_key?: Statement["sort_key"];
    sort_dir?: Statement["sort_dir"];
    column_order?: Statement["column_order"];
  }) {
    // Fallback ist der ZULETZT geladene Stand (current), nicht das statische
    // draft — sonst verwirft eine Zeitraum-Änderung den jeweils anderen Wert
    // (Von ändern setzt Bis zurück und umgekehrt).
    const base = current ?? draft;
    // Ohne manuellen Override KEIN commission_pct senden → das Backend nimmt die
    // je Objekt in den Stammdaten konfigurierte Provision (Override bzw. Default).
    const res = await previewStatement({
      owner_id: owner.id,
      period_from: opts?.period_from ?? base.period_from,
      period_to: opts?.period_to ?? base.period_to,
      basis: opts?.basis ?? base.basis,
      reservation_statuses:
        opts?.reservation_statuses ?? base.reservation_statuses,
      commission_pct: opts?.commission_pct ?? null,
      // 0603/0604: Objektauswahl, Sprache und Sortierung der Vorschau bleiben
      // über Neuberechnungen erhalten — wie Zeitraum und Filter.
      property_ids: opts?.property_ids ?? base.property_ids ?? [],
      language: opts?.language ?? base.language,
      sort_key: opts?.sort_key ?? base.sort_key,
      sort_dir: opts?.sort_dir ?? base.sort_dir,
      column_order: opts?.column_order ?? base.column_order,
    });
    if (res.ok) setCurrent(res.data);
    else toast.error(res.error);
  }

  // Beim Öffnen: Vorschau für den aktuellen Monat laden (nur wenn keine echte
  // Abrechnung vorgegeben ist und Objekte verknüpft sind).
  useEffect(() => {
    if (initialStatement || previewLoaded.current) return;
    previewLoaded.current = true;
    if (owner.properties.length > 0) void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createNew() {
    const res = await generateStatement({
      owner_id: owner.id,
      period_from: firstOfMonth(),
      period_to: lastOfMonth(),
      reservation_statuses: ["confirmed", "completed"],
      // Kein Override → Provision je Objekt aus den Stammdaten.
      commission_pct: null,
    });
    if (res.ok) {
      setCurrent(res.data);
      setList((prev) => [
        {
          id: res.data.id,
          owner_id: owner.id,
          owner_name: owner.name,
          period_from: res.data.period_from,
          period_to: res.data.period_to,
          status: res.data.status,
          owner_payout: res.data.summary.owner_payout,
          pm_payout: res.data.summary.pm_payout,
          currency: res.data.summary.currency,
          invoice_number: res.data.header.invoice_number,
          property_ids: res.data.property_ids,
          created_at: res.data.created_at,
        },
        ...prev,
      ]);
      setTab("edit");
      toast.success(t("created"));
    } else toast.error(res.error);
  }

  async function openStatement(id: string) {
    const res = await getStatement(id);
    if (res.ok) {
      setCurrent(res.data);
      setTab("edit");
    } else toast.error(res.error);
  }

  // Realtime-Änderung an Owner/Objekten/Buchungen/Ausgaben/Abrechnungen:
  // Server-Components neu laden (Stammdaten + Liste) und die aktive Ansicht
  // aktualisieren — offene echte Abrechnung neu holen, sonst Vorschau neu rechnen.
  function handleRealtime() {
    router.refresh();
    const cur = currentRef.current;
    if (cur && cur.id) {
      void getStatement(cur.id).then((r) => {
        if (r.ok) setCurrent(r.data);
      });
    } else if (owner.properties.length > 0) {
      void loadPreview();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <OwnerRealtime onChange={handleRealtime} />
      {/* Kopf: zurück + Owner-Name + Stammdaten-Zugang */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/eigentuemer" className="w-fit text-sm text-muted-foreground hover:text-foreground">
            ← {t("title")}
          </Link>
          <h1 className="font-display text-2xl font-extrabold">{owner.name}</h1>
        </div>
        <Button variant="outline" onClick={() => setMasterOpen(true)}>
          <Icon icon="ph:user-gear" className="size-4" />
          {t("masterData")}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("edit")}
          className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === "edit"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.createEdit")}
        </button>
        <button
          type="button"
          onClick={() => setTab("manage")}
          className={`-mb-px border-b-2 pb-3 text-sm font-medium transition-colors ${
            tab === "manage"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("tabs.manage")}
        </button>
      </div>

      {tab === "edit" ? (
        <StatementEditor
          statement={current ?? draft}
          properties={eigeneObjekte}
          onChange={setCurrent}
          onListChange={setList}
          onReprice={loadPreview}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <Button onClick={() => void createNew()}>
              <Icon icon="ph:plus" className="size-4" />
              {t("new")}
            </Button>
          </div>
          <StatementManage items={list} onOpen={openStatement} onListChange={setList} />
        </div>
      )}

      <OwnerMasterSheet
        owner={owner}
        open={masterOpen}
        onClose={() => setMasterOpen(false)}
        properties={properties}
      />
    </div>
  );
}
