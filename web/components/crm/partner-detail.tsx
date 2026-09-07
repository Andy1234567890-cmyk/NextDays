"use client";

// Partner-Kartei: Stammdaten (Anschrift getrennt, Ansprechpartner) und die
// Deals des Partners — Rabattart, Wert, Code (kopierbar), Gültigkeit, QR:
// hochgeladenes Bild (signierte URL aus dem privaten Bucket) oder, wenn keins
// da ist, der aus dem Code erzeugte QR (PNG vom Server).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Segmented } from "@nextdays/ui/segmented";
import {
  createDeal,
  dealQrPng,
  dealQrUrl,
  deleteDeal,
  deletePartner,
  updateDeal,
  updatePartner,
  uploadDealQr,
} from "@/lib/crm";
import type { Deal, DiscountKind, Partner } from "@/lib/crm-meta";
import { formatCurrency } from "@/lib/currency";

import { type Adresse, AdresseFelder } from "./adresse-felder";

export function PartnerDetail({
  partner,
  initialDeals,
}: {
  partner: Partner;
  initialDeals: Deal[] | null;
}) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Stammdaten
  const [name, setName] = useState(partner.name);
  const [adresse, setAdresse] = useState<Adresse>({
    street: partner.street,
    house_number: partner.house_number,
    postal_code: partner.postal_code,
    city: partner.city,
    country: partner.country,
  });
  const [contactName, setContactName] = useState(partner.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(partner.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(partner.contact_phone ?? "");

  // Deals
  const [deals, setDeals] = useState<Deal[]>(initialDeals ?? []);
  const [neuOffen, setNeuOffen] = useState(false);

  function stammdatenSpeichern() {
    if (!name.trim()) {
      setError(t("partner.nameFehlt"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await updatePartner(partner.id, {
        name: name.trim(),
        ...adresse,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
      });
      if (res.ok) {
        toast.success(t("partner.gespeichert"));
        router.refresh();
      } else setError(res.error);
    });
  }

  function partnerLoeschen() {
    if (!window.confirm(t("partner.loeschenFrage", { name: partner.name, deals: deals.length }))) return;
    startTransition(async () => {
      const res = await deletePartner(partner.id);
      if (res.ok) {
        toast.success(t("partner.geloescht"));
        router.push("/crm/partner");
        router.refresh();
      } else setError(res.error);
    });
  }

  const feld = "flex flex-col gap-1";
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Icon icon="ph:storefront" className="size-5" />
            {partner.name}
          </h2>
          <Button variant="ghost" className="text-destructive" onClick={partnerLoeschen} disabled={pending}>
            <Icon icon="ph:trash" className="size-4" />
            {t("allgemein.loeschen")}
          </Button>
        </div>
        <label className={feld}>
          <span className={label}>{t("partner.name")}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <AdresseFelder wert={adresse} onChange={(p) => setAdresse((a) => ({ ...a, ...p }))} />
        <div className="grid grid-cols-3 gap-3">
          <label className={feld}>
            <span className={label}>{t("partner.ansprechpartner")}</span>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </label>
          <label className={feld}>
            <span className={label}>{t("partner.kontaktEmail")}</span>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </label>
          <label className={feld}>
            <span className={label}>{t("partner.kontaktTelefon")}</span>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </label>
        </div>
        {partner.address && (
          <p className="text-xs text-muted-foreground">
            {t("partner.altAnschrift")}: {partner.address}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={stammdatenSpeichern} disabled={pending}>
            {t("allgemein.speichern")}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{t("deals.title", { n: deals.length })}</h3>
          <Button onClick={() => setNeuOffen((v) => !v)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("deals.neu")}
          </Button>
        </div>
        {neuOffen && (
          <DealForm
            partnerId={partner.id}
            onCreated={(d) => {
              setDeals((alt) => [d, ...alt]);
              setNeuOffen(false);
              router.refresh();
            }}
            onCancel={() => setNeuOffen(false)}
          />
        )}
        {initialDeals === null && (
          <p className="text-sm text-destructive">{t("deals.ladenFehlgeschlagen")}</p>
        )}
        {deals.length === 0 ? (
          <p className="rounded-(--radius) border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("deals.leer")}
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {deals.map((d) => (
              <DealKarte
                key={d.id}
                deal={d}
                onChanged={(neu) => {
                  setDeals((alt) => alt.map((x) => (x.id === neu.id ? neu : x)));
                  router.refresh();
                }}
                onDeleted={(id) => {
                  setDeals((alt) => alt.filter((x) => x.id !== id));
                  router.refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// --- Deal anlegen -------------------------------------------------------------

function DealForm({
  partnerId,
  onCreated,
  onCancel,
}: {
  partnerId: string;
  onCreated: (d: Deal) => void;
  onCancel: () => void;
}) {
  const t = useTranslations("crm");
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<DiscountKind>("percent");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("");
  const [code, setCode] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [error, setError] = useState<string | null>(null);

  function anlegen() {
    const wert = Number(value);
    if (!value || Number.isNaN(wert) || wert < 0) {
      setError(t("deals.wertFehlt"));
      return;
    }
    if (kind === "fixed" && !currency.trim()) {
      // Wurzel 4: die Währung wird NICHT aus dem Konto geraten.
      setError(t("deals.waehrungFehlt"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await createDeal(partnerId, {
        discount_kind: kind,
        discount_value: wert,
        currency: kind === "fixed" ? currency.trim().toUpperCase() : null,
        discount_code: code.trim() || null,
        gueltig_von: von || null,
        gueltig_bis: bis || null,
      });
      if (res.ok) {
        toast.success(t("deals.angelegt"));
        onCreated(res.data);
      } else setError(res.error);
    });
  }

  const feld = "flex flex-col gap-1";
  const label = "text-xs font-medium text-muted-foreground";
  return (
    <Card className="flex flex-col gap-3 p-4">
      <Segmented<DiscountKind>
        value={kind}
        variant="solid"
        onChange={setKind}
        options={[
          { value: "percent", label: t("deals.artProzent") },
          { value: "fixed", label: t("deals.artFix") },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className={feld}>
          <span className={label}>{kind === "percent" ? t("deals.prozent") : t("deals.betrag")}</span>
          <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
        {kind === "fixed" && (
          <label className={feld}>
            <span className={label}>{t("deals.waehrung")}</span>
            <Input
              value={currency}
              maxLength={3}
              placeholder="DKK"
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </label>
        )}
        <label className={feld}>
          <span className={label}>{t("deals.code")}</span>
          <Input value={code} maxLength={64} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className={feld}>
          <span className={label}>{t("deals.gueltigVon")}</span>
          <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className={feld}>
          <span className={label}>{t("deals.gueltigBis")}</span>
          <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">{t("deals.codeHinweis")}</p>
      <div className="flex items-center gap-2">
        <Button onClick={anlegen} disabled={pending}>
          {t("deals.anlegen")}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>
          {t("allgemein.abbrechen")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Card>
  );
}

// --- Deal-Karte ----------------------------------------------------------------

function DealKarte({
  deal,
  onChanged,
  onDeleted,
}: {
  deal: Deal;
  onChanged: (d: Deal) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [qr, setQr] = useState<string | null>(null);
  const [qrFehler, setQrFehler] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // QR-Vorschau: hochgeladenes Bild (signierte URL) vor erzeugtem QR (Code).
  useEffect(() => {
    let aktiv = true;
    setQr(null);
    setQrFehler(null);
    const laden = async () => {
      if (deal.hat_qr_bild) {
        const res = await dealQrUrl(deal.id);
        if (!aktiv) return;
        if (res.ok) setQr(res.data.url);
        else setQrFehler(res.error);
        return;
      }
      if (deal.discount_code) {
        const res = await dealQrPng(deal.id);
        if (!aktiv) return;
        if (res.ok) setQr(res.data);
        else setQrFehler(res.error);
      }
    };
    void laden();
    return () => {
      aktiv = false;
    };
  }, [deal.id, deal.hat_qr_bild, deal.discount_code, deal.updated_at]);

  async function codeKopieren() {
    if (!deal.discount_code) return;
    await navigator.clipboard.writeText(deal.discount_code);
    toast.success(t("deals.codeKopiert"));
  }

  function hochladen(file: File) {
    setError(null);
    startTransition(async () => {
      const res = await uploadDealQr(deal.id, file);
      if (res.ok) {
        toast.success(t("deals.qrHochgeladen"));
        onChanged(res.data);
      } else setError(res.error);
    });
  }

  function gastportalUmschalten() {
    startTransition(async () => {
      const res = await updateDeal(deal.id, { im_gastportal_sichtbar: !deal.im_gastportal_sichtbar });
      if (res.ok) onChanged(res.data);
      else setError(res.error);
    });
  }

  function loeschen() {
    if (!window.confirm(t("deals.loeschenFrage"))) return;
    startTransition(async () => {
      const res = await deleteDeal(deal.id);
      if (res.ok) {
        toast.success(t("deals.geloescht"));
        onDeleted(deal.id);
      } else setError(res.error);
    });
  }

  const wert =
    deal.discount_kind === "percent"
      ? `${deal.discount_value.toLocaleString(locale)} %`
      : formatCurrency(deal.discount_value, deal.currency, locale);
  const datum = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" }) : null;
  const gueltig =
    deal.gueltig_von || deal.gueltig_bis
      ? t("deals.gueltigkeit", { von: datum(deal.gueltig_von) ?? "…", bis: datum(deal.gueltig_bis) ?? "…" })
      : t("deals.unbefristet");

  return (
    <Card className="flex gap-4 p-4">
      <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) border border-border bg-white">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- signierte/data-URL, kein statisches Asset
          <img src={qr} alt={t("deals.qrAlt")} className="size-full object-contain" />
        ) : qrFehler ? (
          <span className="p-2 text-center text-xs text-destructive">{qrFehler}</span>
        ) : (
          <span className="p-2 text-center text-xs text-muted-foreground">{t("deals.keinQr")}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{wert}</p>
            <p className="text-xs text-muted-foreground">{gueltig}</p>
          </div>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={loeschen} disabled={pending}>
            <Icon icon="ph:trash" className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded bg-secondary px-2 py-1 text-sm">
            {deal.discount_code ?? t("deals.ohneCode")}
          </code>
          {deal.discount_code && (
            <Button variant="outline" size="sm" onClick={codeKopieren}>
              <Icon icon="ph:copy" className="size-4" />
              {t("deals.kopieren")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept=".png,.jpg,.jpeg,.svg,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) hochladen(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={pending}>
            <Icon icon="ph:upload-simple" className="size-4" />
            {deal.hat_qr_bild ? t("deals.qrErsetzen") : t("deals.qrHochladen")}
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={deal.im_gastportal_sichtbar}
              onChange={gastportalUmschalten}
              disabled={pending}
            />
            {t("deals.imGastportal")}
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          {deal.hat_qr_bild ? t("deals.qrQuelleUpload") : deal.discount_code ? t("deals.qrQuelleErzeugt") : t("deals.qrQuelleKeine")}
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Card>
  );
}
