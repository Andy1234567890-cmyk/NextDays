"use client";

// Reiter „Compliance": die rechtlichen Nachweise (Arbeitserlaubnis,
// Gesundheitszeugnis, Führungszeugnis, Datenschutz, Betriebsvereinbarung,
// Belehrung) als Dokumente mit Status, Nummer, Behörde, Ausstellung, Ablauf —
// dazu Sicherheitsschulungen mit Gültigkeit (Taskilo ComplianceTab).
// Die Dokumente selbst liegen im Dokumente-Reiter; hier steht der Status.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { createSchulung, deleteKarteiEintrag, dokumentAendern, dokumentAnfragen, updateSchulung } from "@/lib/personal";
import { COMPLIANCE_ARTEN, type Dokument, type DokumentArt, type Schulung, type SchulungInput } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

import { Feld, Leer, Modal, ReiterKopf, ZustandBadge, feldOderGeleert } from "./kartei-helfer";

const DOK_ZUSTAND: Record<Dokument["zustand"], "gueltig" | "laeuft_ab" | "abgelaufen" | "ohne_ablauf"> = {
  gueltig: "gueltig",
  laeuft_ab: "laeuft_ab",
  abgelaufen: "abgelaufen",
  offen: "ohne_ablauf",
};

export function AkteCompliance({
  userId,
  dokumente,
  schulungen,
  kannBearbeiten,
}: {
  userId: string;
  dokumente: Dokument[];
  schulungen: Schulung[];
  kannBearbeiten: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [dokDialog, setDokDialog] = useState<{ d: Dokument | null; art: DokumentArt } | null>(null);
  const [schDialog, setSchDialog] = useState<{ s: Schulung | null } | null>(null);

  async function schulungLoeschen(s: Schulung) {
    if (!window.confirm(t("kartei.loeschenFrage", { titel: s.titel }))) return;
    const res = await deleteKarteiEintrag("schulungen", s.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-2xl border bg-card p-4">
        <ReiterKopf titel={t("kartei.nachweisePflicht")} hint={t("kartei.complianceHint")} />
        <ul className="divide-y text-sm">
          {COMPLIANCE_ARTEN.map((art) => {
            const doks = dokumente.filter((d) => d.art === art);
            return (
              <li key={art} className="py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 font-medium">{t(`dokArt.${art}`)}</span>
                  {doks.length === 0 && <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{t("kartei.nichtHinterlegt")}</span>}
                  {kannBearbeiten && (
                    <Button variant="outline" size="sm" className="rounded-full" onClick={() => setDokDialog({ d: null, art })}>
                      <Icon icon="ph:plus" className="mr-1 size-4" />
                      {t("kartei.erfassen")}
                    </Button>
                  )}
                </div>
                {doks.map((d) => (
                  <div key={d.id} className="mt-2 flex flex-wrap items-center gap-3 rounded-lg bg-secondary/40 p-2">
                    <ZustandBadge zustand={d.zustand === "offen" ? "ohne_ablauf" : DOK_ZUSTAND[d.zustand]} />
                    <div className="min-w-0 flex-1">
                      <div>{d.titel}{!d.eingereicht ? ` · ${t("dokZustand.offen")}` : ""}</div>
                      <div className="text-xs text-muted-foreground">
                        {d.dokument_nummer ? `${t("kartei.dokumentNummer")}: ${d.dokument_nummer}` : ""}
                        {d.behoerde ? ` · ${d.behoerde}` : ""}
                        {d.ausgestellt_am ? ` · ${t("kartei.ausgestelltAm")}: ${formatDate(d.ausgestellt_am, locale)}` : ""}
                        {d.ablauf_am ? ` · ${t("akte.ablauf", { datum: formatDate(d.ablauf_am, locale) })}` : ""}
                        {d.geprueft_am ? ` · ${t("akte.geprueft")}` : ""}
                      </div>
                    </div>
                    {d.download_url && <a href={d.download_url} target="_blank" rel="noreferrer" className="text-xs underline">{t("akte.oeffnen")}</a>}
                    {kannBearbeiten && <Button variant="ghost" size="sm" onClick={() => setDokDialog({ d, art })}>{t("kartei.bearbeiten")}</Button>}
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <ReiterKopf titel={t("kartei.schulungen")} hint={t("kartei.schulungenHint")} onNeu={kannBearbeiten ? () => setSchDialog({ s: null }) : undefined} />
        {schulungen.length === 0 ? (
          <Leer text={t("kartei.keineSchulungen")} />
        ) : (
          <ul className="divide-y text-sm">
            {schulungen.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
                <ZustandBadge zustand={s.zustand} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.titel}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(s.abgeschlossen_am, locale)}
                    {s.trainer ? ` · ${s.trainer}` : ""}
                    {s.gueltig_bis ? ` · ${t("akte.ablauf", { datum: formatDate(s.gueltig_bis, locale) })}` : ""}
                    {s.dokument_titel ? ` · ${s.dokument_titel}` : ""}
                  </div>
                  {s.notiz && <p className="text-xs">{s.notiz}</p>}
                </div>
                {kannBearbeiten && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setSchDialog({ s })}>{t("kartei.bearbeiten")}</Button>
                    <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => schulungLoeschen(s)}>
                      <Icon icon="ph:trash" className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {dokDialog && <NachweisDokDialog userId={userId} d={dokDialog.d} art={dokDialog.art} onClose={() => setDokDialog(null)} />}
      {schDialog && <SchulungDialog userId={userId} s={schDialog.s} dokumente={dokumente} onClose={() => setSchDialog(null)} />}
    </div>
  );
}

/** Compliance-Nachweis = Dokument-Eintrag mit Nummer/Behörde/Ausstellung; die
 *  Datei kommt über den Dokumente-Reiter („Datei zuordnen"). */
function NachweisDokDialog({ userId, d, art, onClose }: { userId: string; d: Dokument | null; art: DokumentArt; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    titel: d?.titel ?? t(`dokArt.${art}`),
    dokument_nummer: d?.dokument_nummer ?? "",
    behoerde: d?.behoerde ?? "",
    ausgestellt_am: d?.ausgestellt_am ?? "",
    ablauf_am: d?.ablauf_am ?? "",
    notiz: d?.notiz ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = {
      titel: f.titel.trim(),
      dokument_nummer: f.dokument_nummer.trim() || null,
      behoerde: f.behoerde.trim() || null,
      ausgestellt_am: f.ausgestellt_am || null,
      ablauf_am: f.ablauf_am || null,
      notiz: f.notiz.trim() || null,
    };
    const res = d ? await dokumentAendern(d.id, body) : await dokumentAnfragen(userId, { art, ...body });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={t(`dokArt.${art}`)} onClose={onClose} onSubmit={absenden} busy={busy || !f.titel.trim()}>
      <Feld label={t("akte.felder.dokTitel")}><Input value={f.titel} onChange={(e) => set("titel", e.target.value)} required /></Feld>
      <Feld label={t("kartei.dokumentNummer")}><Input value={f.dokument_nummer} onChange={(e) => set("dokument_nummer", e.target.value)} /></Feld>
      <Feld label={t("kartei.behoerde")}><Input value={f.behoerde} onChange={(e) => set("behoerde", e.target.value)} /></Feld>
      <div className="grid grid-cols-2 gap-2">
        <Feld label={t("kartei.ausgestelltAm")}><DatePicker value={f.ausgestellt_am} onChange={(v) => set("ausgestellt_am", v)} /></Feld>
        <Feld label={t("akte.felder.ablauf_am")}><DatePicker value={f.ablauf_am} onChange={(v) => set("ablauf_am", v)} /></Feld>
      </div>
      <Feld label={t("notiz")}><Textarea rows={2} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} /></Feld>
      {!d && <p className="text-xs text-muted-foreground">{t("kartei.dateiSpaeter")}</p>}
    </Modal>
  );
}

function SchulungDialog({ userId, s, dokumente, onClose }: { userId: string; s: Schulung | null; dokumente: Dokument[]; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    titel: s?.titel ?? "",
    trainer: s?.trainer ?? "",
    abgeschlossen_am: s?.abgeschlossen_am ?? new Date().toISOString().slice(0, 10),
    gueltig_bis: s?.gueltig_bis ?? "",
    notiz: s?.notiz ?? "",
    dokument_id: s?.dokument_id ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { titel: f.titel.trim(), abgeschlossen_am: f.abgeschlossen_am };
    for (const k of ["trainer", "gueltig_bis", "notiz", "dokument_id"] as const) feldOderGeleert(body, geleert, k, f[k]);
    setBusy(true);
    const res = s ? await updateSchulung(s.id, { ...(body as SchulungInput), geleert }) : await createSchulung(userId, body as SchulungInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  return (
    <Modal titel={s ? t("kartei.schulungBearbeiten") : t("kartei.schulungNeu")} onClose={onClose} onSubmit={absenden} busy={busy || !f.titel.trim() || !f.abgeschlossen_am}>
      <Feld label={t("kartei.schulungTitel")}><Input value={f.titel} onChange={(e) => set("titel", e.target.value)} required placeholder={t("kartei.schulungBeispiel")} /></Feld>
      <Feld label={t("kartei.trainer")}><Input value={f.trainer} onChange={(e) => set("trainer", e.target.value)} /></Feld>
      <div className="grid grid-cols-2 gap-2">
        <Feld label={t("kartei.abgeschlossenAm")}><DatePicker value={f.abgeschlossen_am} onChange={(v) => set("abgeschlossen_am", v)} /></Feld>
        <Feld label={t("akte.felder.ablauf_am")}><DatePicker value={f.gueltig_bis} onChange={(v) => set("gueltig_bis", v)} /></Feld>
      </div>
      <Feld label={t("notiz")}><Textarea rows={2} value={f.notiz} onChange={(e) => set("notiz", e.target.value)} /></Feld>
      <Feld label={t("akte.tabs.dokumente")}>
        <NativeSelect value={f.dokument_id} onChange={(e) => set("dokument_id", e.target.value)}>
          <option value="">—</option>
          {dokumente.map((d) => <option key={d.id} value={d.id}>{d.titel}</option>)}
        </NativeSelect>
      </Feld>
    </Modal>
  );
}
