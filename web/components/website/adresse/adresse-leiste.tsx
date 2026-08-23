"use client";

// Adresse der Kunden-Website: eigene Domains.
//
// Bisher hatte `lib/site-config` die Domain-Aktionen, aber keine Oberfläche —
// der Kunde konnte seine Domain nicht eintragen. Die TLS-Einrichtung läuft über
// Cloudflare for SaaS; das Backend kapselt das und liefert die zwei DNS-Einträge
// zurück, die der Kunde bei seinem Anbieter setzen muss.
//
// Der Status ist gespiegelter Cloudflare-Zustand, keine eigene Vermutung: solange
// dort „pending" steht, steht hier „pending". Ein „aktiv", das wir selbst
// gefolgert hätten, wäre eine Falschaussage über eine fremde Anlage.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import {
  type CustomDomain,
  addDomain,
  removeDomain,
  syncDomain,
} from "@/lib/site-config";

import { EinstellungenKopf } from "../einstellungen/rahmen";

export function AdresseLeiste({ domains }: { domains: CustomDomain[] }) {
  const t = useTranslations("website");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [neu, setNeu] = useState("");
  // Die DNS-Einträge kommen NUR in der Antwort auf das Hinzufügen mit (das
  // Backend gibt sie nicht dauerhaft aus). Deshalb hier merken, damit der Kunde
  // sie nicht verliert, wenn er die Seite noch nicht verlassen hat.
  const [frischeEintraege, setFrischeEintraege] = useState<CustomDomain | null>(
    null,
  );

  function hinzufuegen(e: React.FormEvent) {
    e.preventDefault();
    const domain = neu.trim();
    if (!domain) return;
    start(async () => {
      const res = await addDomain(domain);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setNeu("");
      setFrischeEintraege(res.data);
      toast.success(t("adresse.hinzugefuegt"));
      router.refresh();
    });
  }

  function fuehreAus(
    aktion: () => Promise<{ ok: boolean; error?: string }>,
    erfolg: string,
  ) {
    start(async () => {
      const res = await aktion();
      if (!res.ok) {
        toast.error(res.error ?? t("adresse.fehlgeschlagen"));
        return;
      }
      toast.success(erfolg);
      router.refresh();
    });
  }

  return (
    // Kein eigenes `max-w`/Padding mehr: Breite und Abstand gehören der
    // Inhaltsspalte des Einstellungen-Rahmens. Zwei Begrenzungen übereinander
    // ergaben einen doppelten Innenabstand und eine Spalte, die schmaler war
    // als vorgesehen.
    <div className="flex flex-col gap-6">
      <EinstellungenKopf
        titel={t("einstellungen.adresse.titel")}
        beschreibung={t("einstellungen.adresse.hinweis")}
      />
      <section className="flex flex-col gap-3">
        <form onSubmit={hinzufuegen} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("adresse.eigeneDomain")}</span>
            <Input
              value={neu}
              onChange={(e) => setNeu(e.target.value)}
              placeholder="www.meine-ferienwohnung.de"
              maxLength={253}
            />
          </label>
          <Button type="submit" disabled={pending || !neu.trim()}>
            {t("adresse.hinzufuegen")}
          </Button>
        </form>

        {domains.length === 0 ? (
          <p className="rounded-(--radius) border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("adresse.keineDomain")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {domains.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius) border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.domain}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`adresse.status.${d.status}`)}
                    {d.ssl_status ? ` · TLS: ${d.ssl_status}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      fuehreAus(
                        () => syncDomain(d.id),
                        t("adresse.statusAktualisiert"),
                      )
                    }
                  >
                    <Icon icon="ph:arrows-clockwise" className="size-4" />
                    {t("adresse.pruefen")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    title={t("adresse.entfernen")}
                    onClick={() =>
                      fuehreAus(
                        () => removeDomain(d.id),
                        t("adresse.entfernt"),
                      )
                    }
                  >
                    <Icon icon="ph:trash" className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* DNS-Einträge der zuletzt hinzugefügten Domain. */}
      {frischeEintraege && frischeEintraege.dns_records.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-(--radius) border border-border p-4">
          <div>
            <h4 className="font-medium">{t("adresse.dnsTitel")}</h4>
            <p className="text-sm text-muted-foreground">
              {t("adresse.dnsHinweis", { domain: frischeEintraege.domain })}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-md text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1 pr-4">{t("adresse.dnsTyp")}</th>
                  <th className="py-1 pr-4">{t("adresse.dnsName")}</th>
                  <th className="py-1">{t("adresse.dnsWert")}</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {frischeEintraege.dns_records.map((r, i) => (
                  <tr key={`${r.type}-${i}`} className="border-t border-border">
                    <td className="py-1.5 pr-4">{r.type}</td>
                    <td className="py-1.5 pr-4 break-all">{r.name}</td>
                    <td className="py-1.5 break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
