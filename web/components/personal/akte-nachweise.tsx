"use client";

// Reiter „Qualifikationen": oben die Einsatz-Qualifikationen (Arbeitsbereich ×
// Stufe — was der Dienstplan prüft), darunter die Nachweise der Taskilo-Kartei:
// Ausbildung, Zertifikate (mit Ablauf), Sprachen, Fähigkeiten, Berufserfahrung.
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
import { createNachweis, deleteKarteiEintrag, updateNachweis } from "@/lib/personal";
import { type Dokument, NACHWEIS_ARTEN, type Nachweis, type NachweisArt, type NachweisInput } from "@/lib/personal-typen";
import { formatDate } from "@/lib/utils";

import { Feld, Leer, Modal, ReiterKopf, ZustandBadge, feldOderGeleert } from "./kartei-helfer";

const SPRACHSTUFEN = ["a1", "a2", "b1", "b2", "c1", "c2", "muttersprache"] as const;
const KOENNENSSTUFEN = ["grund", "fortgeschritten", "experte"] as const;

export function AkteNachweise({
  userId,
  nachweise,
  dokumente,
  kannBearbeiten,
}: {
  userId: string;
  nachweise: Nachweis[];
  dokumente: Dokument[];
  kannBearbeiten: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [dialog, setDialog] = useState<{ n: Nachweis | null; art: NachweisArt } | null>(null);

  async function loeschen(n: Nachweis) {
    if (!window.confirm(t("kartei.loeschenFrage", { titel: n.titel }))) return;
    const res = await deleteKarteiEintrag("nachweise", n.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const stufeText = (n: Nachweis) => {
    if (!n.stufe) return "";
    if (n.art === "sprache" && (SPRACHSTUFEN as readonly string[]).includes(n.stufe)) return t(`kartei.sprachstufe.${n.stufe}`);
    if (n.art === "faehigkeit" && (KOENNENSSTUFEN as readonly string[]).includes(n.stufe)) return t(`kartei.koennensstufe.${n.stufe}`);
    return n.stufe;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {NACHWEIS_ARTEN.map((art) => {
        const liste = nachweise.filter((n) => n.art === art);
        return (
          <section key={art} className="rounded-2xl border bg-card p-4">
            <ReiterKopf titel={t(`nachweisArt.${art}`)} onNeu={kannBearbeiten ? () => setDialog({ n: null, art }) : undefined} />
            {liste.length === 0 ? (
              <Leer text={t("kartei.keineNachweise")} />
            ) : (
              <ul className="divide-y text-sm">
                {liste.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-3 py-2">
                    {n.ablauf_am && <ZustandBadge zustand={n.zustand} />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">
                        {n.titel}
                        {stufeText(n) ? <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">{stufeText(n)}</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {n.stelle ?? ""}
                        {n.von || n.bis ? ` · ${n.von ? formatDate(n.von, locale) : ""}${n.bis ? ` – ${formatDate(n.bis, locale)}` : ""}` : ""}
                        {n.ablauf_am ? ` · ${t("akte.ablauf", { datum: formatDate(n.ablauf_am, locale) })}` : ""}
                        {n.kennung ? ` · ${n.kennung}` : ""}
                        {n.dokument_titel ? ` · ${n.dokument_titel}` : ""}
                      </div>
                      {n.notiz && <p className="text-xs">{n.notiz}</p>}
                    </div>
                    {kannBearbeiten && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setDialog({ n, art })}>{t("kartei.bearbeiten")}</Button>
                        <Button variant="ghost" size="icon" aria-label={t("loeschen")} onClick={() => loeschen(n)}>
                          <Icon icon="ph:trash" className="size-4" />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {dialog && <NachweisDialog userId={userId} n={dialog.n} art={dialog.art} dokumente={dokumente} onClose={() => setDialog(null)} />}
    </div>
  );
}

function NachweisDialog({ userId, n, art, dokumente, onClose }: { userId: string; n: Nachweis | null; art: NachweisArt; dokumente: Dokument[]; onClose: () => void }) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    titel: n?.titel ?? "",
    stelle: n?.stelle ?? "",
    stufe: n?.stufe ?? "",
    von: n?.von ?? "",
    bis: n?.bis ?? "",
    ablauf_am: n?.ablauf_am ?? "",
    kennung: n?.kennung ?? "",
    notiz: n?.notiz ?? "",
    dokument_id: n?.dokument_id ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: Record<string, unknown> = { art, titel: f.titel.trim() };
    for (const k of ["stelle", "stufe", "von", "bis", "ablauf_am", "kennung", "notiz", "dokument_id"] as const) feldOderGeleert(body, geleert, k, f[k]);
    setBusy(true);
    const res = n ? await updateNachweis(n.id, { ...(body as NachweisInput), geleert }) : await createNachweis(userId, body as NachweisInput);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
    onClose();
  }

  const stelleLabel = art === "ausbildung" ? t("kartei.institution") : art === "erfahrung" ? t("kartei.arbeitgeber") : t("kartei.aussteller");
  return (
    <Modal titel={n ? t("kartei.nachweisBearbeiten") : t(`nachweisArt.${art}`)} onClose={onClose} onSubmit={absenden} busy={busy || !f.titel.trim()}>
      <Feld label={art === "sprache" ? t("kartei.sprache") : art === "erfahrung" ? t("akte.felder.position") : t("akte.felder.dokTitel")}>
        <Input value={f.titel} onChange={(e) => set("titel", e.target.value)} required />
      </Feld>
      {art !== "sprache" && art !== "faehigkeit" && (
        <Feld label={stelleLabel}><Input value={f.stelle} onChange={(e) => set("stelle", e.target.value)} /></Feld>
      )}
      {art === "sprache" && (
        <Feld label={t("kartei.niveau")}>
          <NativeSelect value={f.stufe} onChange={(e) => set("stufe", e.target.value)}>
            <option value="">—</option>
            {SPRACHSTUFEN.map((s) => <option key={s} value={s}>{t(`kartei.sprachstufe.${s}`)}</option>)}
          </NativeSelect>
        </Feld>
      )}
      {art === "faehigkeit" && (
        <Feld label={t("kartei.niveau")}>
          <NativeSelect value={f.stufe} onChange={(e) => set("stufe", e.target.value)}>
            <option value="">—</option>
            {KOENNENSSTUFEN.map((s) => <option key={s} value={s}>{t(`kartei.koennensstufe.${s}`)}</option>)}
          </NativeSelect>
        </Feld>
      )}
      {art === "ausbildung" && <Feld label={t("kartei.note")}><Input value={f.stufe} onChange={(e) => set("stufe", e.target.value)} /></Feld>}
      {(art === "ausbildung" || art === "erfahrung") && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label={t("von")}><DatePicker value={f.von} onChange={(v) => set("von", v)} /></Feld>
          <Feld label={t("bis")}><DatePicker value={f.bis} onChange={(v) => set("bis", v)} /></Feld>
        </div>
      )}
      {art === "zertifikat" && (
        <div className="grid grid-cols-2 gap-2">
          <Feld label={t("kartei.ausgestelltAm")}><DatePicker value={f.von} onChange={(v) => set("von", v)} /></Feld>
          <Feld label={t("akte.felder.ablauf_am")}><DatePicker value={f.ablauf_am} onChange={(v) => set("ablauf_am", v)} /></Feld>
        </div>
      )}
      {art === "zertifikat" && <Feld label={t("kartei.kennung")}><Input value={f.kennung} onChange={(e) => set("kennung", e.target.value)} /></Feld>}
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
