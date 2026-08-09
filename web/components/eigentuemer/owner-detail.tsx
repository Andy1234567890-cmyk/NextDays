"use client";

// Eigentümer-Detail (Agentur-Sicht): Stammdaten, Auszahlungs-/Provisions-
// Einstellungen und Objekt-Zuordnung (Anteil + Provisions-Override je Objekt).
// useState-Formular + Server-Actions (Muster wie objekte/location-form).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { COUNTRIES, vatIdLabel } from "@nextdays/ui/countries";
import { ObjektMehrfachauswahl } from "@/components/objekt-mehrfachauswahl";
import { SprachAuswahl } from "@/components/sprache-auswahl";
import {
  assignOwnerProperties,
  assignOwnerProperty,
  deleteOwner,
  inviteOwnerPortal,
  unassignOwnerProperty,
  updateOwner,
  type FreieObjektOption,
  type Owner,
  type OwnerInput,
} from "@/lib/owners";

type PropOption = FreieObjektOption;

export function OwnerDetail({
  initial,
  properties,
  embedded = false,
}: {
  initial: Owner;
  properties: PropOption[];
  embedded?: boolean;
}) {
  const t = useTranslations("owners");
  const tCountry = useTranslations("countries");
  const router = useRouter();
  const [owner, setOwner] = useState<Owner>(initial);
  // Frische Server-Props übernehmen. `useState(initial)` liest den Wert NUR
  // beim ersten Mount: nach `router.refresh()` (eigene Zuordnung) oder einer
  // Änderung in einem anderen Tab lieferte der Server längst die neue Liste,
  // während diese Maske weiter den Mount-Stand zeigte — die Zuordnung war in
  // der DB, die Oberfläche behauptete das Gegenteil. Die Maske hängt in einem
  // Sheet, das beim Schließen NICHT abgebaut wird, deshalb kann der Mount
  // beliebig lange zurückliegen.
  //
  // Der Vergleich auf `updated_at` + Objektliste statt auf Objektidentität:
  // die Server-Komponente liefert bei jedem Refresh ein NEUES Objekt, ein
  // reines `[initial]` würde also auch dann überschreiben, wenn sich nichts
  // geändert hat — und dabei ungespeicherte Eingaben des Nutzers verwerfen.
  const initialSignatur = `${initial.updated_at ?? ""}|${initial.properties
    .map((p) => `${p.property_id}:${p.ownership_share}:${p.commission_override_pct ?? ""}`)
    .sort()
    .join(",")}`;
  useEffect(() => {
    setOwner(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, initialSignatur]);
  const [busy, setBusy] = useState(false);
  // Eigener Busy-Zustand für die Einladung: sie darf den Speichern-Button
  // nicht sperren und umgekehrt.
  const [einladend, setEinladend] = useState(false);
  // Mehrfachauswahl der nachträglichen Objektzuordnung. Eigener Busy-Zustand,
  // damit sie weder das Speichern der Stammdaten noch die Einladung blockiert.
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [objektSuche, setObjektSuche] = useState("");
  const [zuordnend, setZuordnend] = useState(false);
  // Letzter Fehlschlag der Zuordnung, sichtbar AM Panel. Ein Toast allein
  // reicht nicht: er verschwindet, und genau die Meldung „diese Objekte
  // gehören schon X" ist die, die der Betreiber lesen und abarbeiten muss.
  const [zuordnenFehler, setZuordnenFehler] = useState<string | null>(null);

  /**
   * Portalzugang nachträglich einrichten.
   *
   * Der zweite Weg neben dem Häkchen im Anlege-Dialog — für Eigentümer, die
   * schon da sind. Legt einen Login mit der Rolle `owner` an, verschickt die
   * Einladungsmail in der hier gepflegten Sprache und verknüpft
   * `owners.user_id`. Idempotent: existiert zu der Adresse bereits ein Login
   * im Betrieb, wird dieser verknüpft statt ein zweiter angelegt.
   */
  async function portalzugangEinladen() {
    setEinladend(true);
    const res = await inviteOwnerPortal(owner.id);
    setEinladend(false);
    if (res.ok) {
      setOwner(res.data);
      toast.success(t("portalAccessInvited"));
    } else toast.error(res.error);
  }

  const titleById = new Map(properties.map((p) => [p.id, p.title]));
  const unassigned = properties.filter(
    (p) => !owner.properties.some((l) => l.property_id === p.id),
  );

  function set<K extends keyof Owner>(key: K, value: Owner[K]) {
    setOwner((o) => ({ ...o, [key]: value }));
  }

  async function save() {
    setBusy(true);
    const input: OwnerInput = {
      name: owner.name,
      company: owner.company,
      email: owner.email,
      phone: owner.phone,
      language: owner.language,
      street: owner.street,
      house_number: owner.house_number,
      postal_code: owner.postal_code,
      city: owner.city,
      country: owner.country,
      tax_id: owner.tax_id,
      vat_id: owner.vat_id,
      iban: owner.iban,
      bic: owner.bic,
      bank_name: owner.bank_name,
      account_holder: owner.account_holder,
      default_commission_pct: owner.default_commission_pct,
      default_payout_method: owner.default_payout_method,
      statement_frequency: owner.statement_frequency,
      notes: owner.notes,
    };
    const res = await updateOwner(owner.id, input);
    setBusy(false);
    if (res.ok) {
      setOwner(res.data);
      toast.success(t("saved"));
    } else toast.error(res.error);
  }

  async function remove() {
    if (!window.confirm(t("deleteConfirm"))) return;
    const res = await deleteOwner(owner.id);
    if (res.ok) {
      toast.success(t("deleted"));
      // `refresh()` VOR dem `push`: die Zielliste liegt im Router-Cache des
      // Clients und zeigte den gerade gelöschten Eigentümer sonst weiter.
      // `owners` ist für authenticated gesperrt (0337) und trägt daher kein
      // Realtime-Event, das den Cache von selbst entwerten könnte.
      router.refresh();
      router.push("/eigentuemer");
    } else toast.error(res.error);
  }

  /**
   * Mehrere Objekte auf einmal zuordnen.
   *
   * Vorher stand hier ein Dropdown, das je Klick GENAU EIN Objekt zuordnete —
   * bei 18 Objekten 18 Aufrufe. Jetzt geht die ganze Auswahl in EINEM Request
   * raus (`assignOwnerProperties`): entweder alle oder keines. Ein Objekt, das
   * inzwischen einem anderen Eigentümer gehört, lässt den Aufruf mit 409
   * scheitern und wird im Fehlertext NAMENTLICH genannt — kein stilles
   * Überspringen, bei dem der Betreiber später selbst suchen müsste.
   */
  async function assignMany() {
    // Doppelklick-Schutz VOR dem Seiteneffekt (Wurzel 2): ohne ihn setzen zwei
    // schnelle Klicks zwei Requests ab. Der zweite lief in die Vorab-Prüfung
    // des Dienstes und meldete „gehört bereits einem anderen Eigentümer" —
    // eine Fehlermeldung für eine Zuordnung, die gerade erfolgreich war.
    if (auswahl.length === 0 || zuordnend) return;
    setZuordnend(true);
    // Die Auswahl festhalten: `res` kann sie nicht mehr liefern, und der
    // Zähler in der Erfolgsmeldung muss die WIRKLICH gesendete Menge nennen.
    const gesendet = auswahl.length;
    const res = await assignOwnerProperties(owner.id, auswahl);
    setZuordnend(false);
    if (!res.ok) {
      // Sichtbar UND stehenbleibend: der Text nennt bei einem Konflikt die
      // betroffenen Objekte samt fremdem Eigentümer. Ein Toast, der nach drei
      // Sekunden verschwindet, ist bei 18 Objekten nicht lesbar — deshalb
      // bleibt der Fehler zusätzlich als Zeile am Panel stehen (Wurzel 5:
      // kein Fehlschlag darf als Erfolg durchgehen). Die Auswahl bleibt
      // erhalten, damit der Nutzer korrigieren statt neu anhaken muss.
      setZuordnenFehler(res.error);
      toast.error(res.error);
      return;
    }
    setZuordnenFehler(null);
    setOwner(res.data);
    setAuswahl([]);
    setObjektSuche("");
    toast.success(t("propertiesAssigned", { count: gesendet }));
    // Die Liste der zuordenbaren Objekte kommt aus der Server-Komponente und
    // ist jetzt veraltet (die eben zugeordneten sind nicht mehr frei).
    // `owner_properties` ist für `authenticated` gesperrt (Wurzel 6, 0337) und
    // trägt daher kein Realtime-Event — `refresh()` ist hier der einzige Weg,
    // nicht eine vermeidbare Zusatzrunde.
    router.refresh();
  }

  async function updateLink(
    propertyId: string,
    share: number,
    commission: number | null,
  ) {
    // `Number("")` ist 0 und `Number("abc")` ist NaN — beides würde als echter
    // Anteil gespeichert bzw. vom Server mit 422 abgewiesen. Ein Feld, das der
    // Nutzer leert, darf keinen erfundenen Wert bekommen (Wurzel 4): der alte
    // Wert bleibt stehen und die Maske sagt, was zu tun ist.
    if (!Number.isFinite(share)) {
      toast.error(t("shareInvalid"));
      setOwner((o) => ({ ...o }));
      return;
    }
    const res = await assignOwnerProperty(owner.id, {
      property_id: propertyId,
      ownership_share: share,
      commission_override_pct: commission,
    });
    if (res.ok) setOwner(res.data);
    else {
      toast.error(res.error);
      // Der Server hat NICHT gespeichert — die Felder sind unkontrolliert und
      // zeigen sonst weiter den eingetippten Wert, der nirgends steht. Ein
      // Zustands-Neuaufbau setzt sie auf den zuletzt bestätigten Stand zurück.
      setOwner((o) => ({ ...o }));
    }
  }

  async function unassign(propertyId: string) {
    const res = await unassignOwnerProperty(owner.id, propertyId);
    if (res.ok) {
      setOwner(res.data);
      // Das Objekt ist wieder frei und gehört zurück in die Auswahlliste, die
      // aus der Server-Komponente kommt.
      router.refresh();
    } else toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        {embedded ? (
          <span />
        ) : (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => router.push("/eigentuemer")}
              className="w-fit text-sm text-muted-foreground hover:text-foreground"
            >
              ← {t("title")}
            </button>
            <h1 className="font-display text-3xl font-extrabold">{owner.name}</h1>
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void remove()}>
            <Icon icon="ph:trash" className="size-4" />
            {t("delete")}
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {/* Stammdaten */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">{t("sections.master")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.name")}>
            <Input value={owner.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label={t("fields.company")}>
            <Input
              value={owner.company ?? ""}
              onChange={(e) => set("company", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.email")}>
            <Input
              type="email"
              value={owner.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.phone")}>
            <Input
              value={owner.phone ?? ""}
              onChange={(e) => set("phone", e.target.value || null)}
            />
          </Field>
          {/* Nicht in <Field> gewickelt: das rendert ein <label> um seine
              Kinder, und <SprachAuswahl> bringt bereits ein eigenes
              <label for> mit — verschachtelte Labels sind ungültiges HTML und
              brechen die Screenreader-Zuordnung. */}
          <SprachAuswahl
            id="owner-lang"
            value={owner.language ?? ""}
            onChange={(v) => set("language", v || null)}
            label={t("fields.emailLanguage")}
            hint={t("emailLanguageHint")}
            allowEmpty
          />
          <Field label={t("fields.street")}>
            <Input
              value={owner.street ?? ""}
              onChange={(e) => set("street", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.houseNumber")}>
            <Input
              value={owner.house_number ?? ""}
              onChange={(e) => set("house_number", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.postalCode")}>
            <Input
              value={owner.postal_code ?? ""}
              onChange={(e) => set("postal_code", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.city")}>
            <Input
              value={owner.city ?? ""}
              onChange={(e) => set("city", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.country")}>
            <NativeSelect
              value={owner.country ?? ""}
              onChange={(e) => set("country", e.target.value || null)}
            >
              <option value="">—</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {tCountry(c.code)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("fields.taxId")}>
            <Input
              value={owner.tax_id ?? ""}
              onChange={(e) => set("tax_id", e.target.value || null)}
            />
          </Field>
          <Field label={vatIdLabel(owner.country)}>
            <Input
              value={owner.vat_id ?? ""}
              onChange={(e) => set("vat_id", e.target.value || null)}
            />
          </Field>
        </div>
      </Card>

      {/* Portalzugang — der Login, mit dem dieser Eigentümer seine
          Abrechnungen selbst einsehen kann. Getrennt von den Stammdaten,
          weil beides auseinanderlaufen darf: die Abrechnungspartei gibt es
          auch ohne Zugang. */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">
          {t("sections.portalAccess")}
        </h2>
        {owner.user_id ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:check-circle" className="size-4 text-primary" />
            {t("portalAccessActive")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="max-w-lg text-sm text-muted-foreground">
              {owner.email
                ? t("portalAccessHint")
                : t("portalAccessNeedsEmail")}
            </p>
            <Button
              variant="outline"
              onClick={() => void portalzugangEinladen()}
              // Ohne gespeicherte Adresse gibt es keinen Einmal-Link. Das
              // Backend antwortet mit 422; der Button ist deshalb gesperrt,
              // statt in einen vermeidbaren Fehler zu laufen.
              disabled={einladend || !owner.email}
            >
              {einladend ? (
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
              ) : (
                <Icon icon="ph:envelope-simple" className="size-4" />
              )}
              {t("portalAccessInvite")}
            </Button>
          </div>
        )}
      </Card>

      {/* Auszahlung / Provision */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">{t("sections.payout")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.accountHolder")}>
            <Input
              value={owner.account_holder ?? ""}
              onChange={(e) => set("account_holder", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.iban")}>
            <Input
              value={owner.iban ?? ""}
              onChange={(e) => set("iban", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.bic")}>
            <Input
              value={owner.bic ?? ""}
              onChange={(e) => set("bic", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.bankName")}>
            <Input
              value={owner.bank_name ?? ""}
              onChange={(e) => set("bank_name", e.target.value || null)}
            />
          </Field>
          <Field
            label={t("fields.commission")}
            info={t("info.commission")}
            infoAria={t("info.aria", { feld: t("fields.commission") })}
          >
            {/* Leeres Feld = KEIN Satz vereinbart (null), nicht 0 %. Vorher
                stand hier zwangsläufig eine Zahl, und ein nie ausgefüllter
                Satz sah aus wie „0 % vereinbart" — die Abrechnung zahlte dem
                Eigentümer daraufhin 100 % aus (Wurzel 4). `Number("")` wäre 0
                und genau dieser erfundene Wert. */}
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={owner.default_commission_pct ?? ""}
              placeholder={t("commissionNotAgreed")}
              onChange={(e) =>
                set(
                  "default_commission_pct",
                  e.target.value.trim() === ""
                    ? null
                    : Number(e.target.value),
                )
              }
            />
          </Field>
          <Field label={t("fields.payoutMethod")}>
            <Input
              value={owner.default_payout_method ?? ""}
              onChange={(e) => set("default_payout_method", e.target.value || null)}
            />
          </Field>
          <Field label={t("fields.statementFrequency")}>
            <NativeSelect
              value={owner.statement_frequency}
              onChange={(e) =>
                set(
                  "statement_frequency",
                  e.target.value as Owner["statement_frequency"],
                )
              }
            >
              <option value="none">{t("frequency.none")}</option>
              <option value="monthly">{t("frequency.monthly")}</option>
            </NativeSelect>
          </Field>
        </div>
        <Field label={t("fields.notes")}>
          <Textarea
            value={owner.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
          />
        </Field>
      </Card>

      {/* Objekt-Zuordnung */}
      <Card className="flex flex-col gap-4 p-6">
        <h2 className="font-display text-lg font-extrabold">
          {t("sections.properties")}
        </h2>

        {/* Objekte hinzufügen — dieselbe Mehrfachauswahl wie im Anlege-Dialog
            (`components/objekt-mehrfachauswahl.tsx`). Vorher stand hier ein
            Dropdown für EIN Objekt je Klick; es gibt jetzt nur noch EINEN Weg,
            Objekte zuzuweisen. Zur Auswahl stehen nur zuordenbare Objekte —
            `unassigned` sind die freien aus `available-properties` abzüglich
            der bereits zugeordneten. */}
        {unassigned.length > 0 && (
          <div className="flex flex-col gap-3 rounded-(--radius) border border-border p-4">
            <span className="text-sm font-medium">{t("addProperty")}</span>
            {/* Eigener Zähltext: „0/18 ausgewählt" las der Betreiber als
                „0 von 18 Objekten gehören diesem Eigentümer" und hielt seine
                bestehende Zuordnung für verschwunden. Hier steht jetzt, dass
                es um die AUSWAHL zum Hinzufügen geht; die bereits zugeordneten
                Objekte stehen darunter mit eigener Überschrift. */}
            <ObjektMehrfachauswahl
              objekte={unassigned}
              selected={auswahl}
              onChange={setAuswahl}
              suche={objektSuche}
              onSucheChange={setObjektSuche}
              disabled={zuordnend}
              emptyText={t("noFreeProperties")}
              countLabel={(n, m) => t("assignableCount", { count: n, total: m })}
            />
            {zuordnenFehler && (
              <p
                role="alert"
                className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {zuordnenFehler}
              </p>
            )}
            <div className="flex justify-end">
              <Button
                onClick={() => void assignMany()}
                disabled={zuordnend || auswahl.length === 0}
              >
                {zuordnend ? (
                  <Icon icon="ph:spinner" className="size-4 animate-spin" />
                ) : (
                  <Icon icon="ph:plus" className="size-4" />
                )}
                {t("assignSelected", { count: auswahl.length })}
              </Button>
            </div>
          </div>
        )}

        {owner.properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noProperties")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Sagt ausdrücklich, WAS diese Liste ist: die dem Eigentümer
                zugeordneten Objekte — im Unterschied zur Auswahl darüber. */}
            <p className="text-sm font-medium text-muted-foreground">
              {t("assignedHeading", { count: owner.properties.length })}
            </p>
            {owner.properties.map((link) => (
              <div
                key={link.property_id}
                className="flex flex-wrap items-end gap-4 rounded-(--radius) border border-border p-4"
              >
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {titleById.get(link.property_id) ?? link.property_id}
                  </p>
                </div>
                {/* Breite auf den LÄNGSTEN Übersetzungstext ausgelegt, nicht
                    auf den deutschen: „Anteil (%)" ist kurz, estnisch/maltesisch
                    deutlich länger. Zu schmal + Info-Symbol = zweizeiliger Kopf
                    und versetzte „i". */}
                <Field
                  label={t("fields.share")}
                  className="w-40"
                  info={t("info.share")}
                  infoAria={t("info.aria", { feld: t("fields.share") })}
                >
                  {/* `key` am bestätigten Wert: das Feld ist unkontrolliert
                      (Tippen ohne Rundreise zum Server). Ohne den Schlüssel
                      behielte es nach einem abgelehnten Speichern den
                      eingetippten Wert und zeigte eine Zahl, die nirgends
                      gespeichert ist. Ändert sich der bestätigte Wert, baut
                      React das Feld neu auf. */}
                  <Input
                    key={`share-${link.property_id}-${link.ownership_share}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    defaultValue={link.ownership_share}
                    onBlur={(e) =>
                      void updateLink(
                        link.property_id,
                        Number(e.target.value),
                        link.commission_override_pct,
                      )
                    }
                  />
                </Field>
                <Field
                  label={t("fields.commissionOverride")}
                  className="w-40"
                  info={t("info.commissionOverride")}
                  infoAria={t("info.aria", {
                    feld: t("fields.commissionOverride"),
                  })}
                >
                  {/* Leeres Feld = KEIN Override (null), nicht 0: dann gilt der
                      Owner-Standard, den der Platzhalter anzeigt. `Number("")`
                      wäre 0 und damit eine erfundene Null-Provision. */}
                  <Input
                    key={`comm-${link.property_id}-${link.commission_override_pct ?? ""}`}
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    // Der Platzhalter zeigt, was ohne Override gilt: der
                    // Owner-Standard. Ist auch der nicht vereinbart, steht
                    // dort der Hinweis statt eines wörtlichen „null".
                    placeholder={
                      owner.default_commission_pct == null
                        ? t("commissionNotAgreed")
                        : `${owner.default_commission_pct}`
                    }
                    defaultValue={link.commission_override_pct ?? ""}
                    onBlur={(e) =>
                      void updateLink(
                        link.property_id,
                        link.ownership_share,
                        e.target.value.trim() === ""
                          ? null
                          : Number(e.target.value),
                      )
                    }
                  />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void unassign(link.property_id)}
                  aria-label={t("removeProperty")}
                >
                  <Icon icon="ph:x" className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  className,
  info,
  infoAria,
  children,
}: {
  label: string;
  className?: string;
  /** Erklärtext hinter einem „i" — für Felder, deren Wirkung man nicht rät
   *  (Provisions-Override, Eigentumsanteil). */
  info?: string;
  infoAria?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      {/* `min-w-0` + `truncate` am TEXT, nicht `nowrap` an der Zeile: bei einer
          Übersetzung, die selbst für die verbreiterte Spalte zu lang ist,
          bricht das Label dann nicht zweizeilig um (was das „i" versetzt) und
          läuft auch nicht über den Rand hinaus — es wird gekürzt, während das
          Info-Symbol seinen Platz behält. Der vollständige Text bleibt über
          `title` und das Info-Symbol erreichbar. */}
      <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <span className="min-w-0 truncate" title={label}>
          {label}
        </span>
        {info && infoAria && <InfoHinweis text={info} ariaLabel={infoAria} />}
      </span>
      {children}
    </label>
  );
}
