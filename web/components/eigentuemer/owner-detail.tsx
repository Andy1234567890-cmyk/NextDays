"use client";

// Eigentümer-Detail (Agentur-Sicht): Stammdaten, Auszahlungs-/Provisions-
// Einstellungen und Objekt-Zuordnung (Anteil + Provisions-Override je Objekt).
// useState-Formular + Server-Actions (Muster wie objekte/location-form).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
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
  const [busy, setBusy] = useState(false);
  // Eigener Busy-Zustand für die Einladung: sie darf den Speichern-Button
  // nicht sperren und umgekehrt.
  const [einladend, setEinladend] = useState(false);
  // Mehrfachauswahl der nachträglichen Objektzuordnung. Eigener Busy-Zustand,
  // damit sie weder das Speichern der Stammdaten noch die Einladung blockiert.
  const [auswahl, setAuswahl] = useState<string[]>([]);
  const [objektSuche, setObjektSuche] = useState("");
  const [zuordnend, setZuordnend] = useState(false);

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
    if (auswahl.length === 0) return;
    setZuordnend(true);
    const res = await assignOwnerProperties(owner.id, auswahl);
    setZuordnend(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOwner(res.data);
    setAuswahl([]);
    setObjektSuche("");
    toast.success(t("propertiesAssigned", { count: auswahl.length }));
    // Die Liste der zuordenbaren Objekte kommt aus der Server-Komponente und
    // ist jetzt veraltet (die eben zugeordneten sind nicht mehr frei).
    router.refresh();
  }

  async function updateLink(
    propertyId: string,
    share: number,
    commission: number | null,
  ) {
    const res = await assignOwnerProperty(owner.id, {
      property_id: propertyId,
      ownership_share: share,
      commission_override_pct: commission,
    });
    if (res.ok) setOwner(res.data);
    else toast.error(res.error);
  }

  async function unassign(propertyId: string) {
    const res = await unassignOwnerProperty(owner.id, propertyId);
    if (res.ok) setOwner(res.data);
    else toast.error(res.error);
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
          <Field label={t("fields.commission")}>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={owner.default_commission_pct}
              onChange={(e) =>
                set("default_commission_pct", Number(e.target.value))
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
            <ObjektMehrfachauswahl
              objekte={unassigned}
              selected={auswahl}
              onChange={setAuswahl}
              suche={objektSuche}
              onSucheChange={setObjektSuche}
              disabled={zuordnend}
              emptyText={t("noFreeProperties")}
            />
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
                <Field label={t("fields.share")} className="w-28">
                  <Input
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
                <Field label={t("fields.commissionOverride")} className="w-36">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    placeholder={`${owner.default_commission_pct}`}
                    defaultValue={link.commission_override_pct ?? ""}
                    onBlur={(e) =>
                      void updateLink(
                        link.property_id,
                        link.ownership_share,
                        e.target.value === "" ? null : Number(e.target.value),
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
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
