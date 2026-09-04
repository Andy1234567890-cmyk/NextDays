"use client";

// Personal → Abwesenheit (Etappe 3): offene Anträge zuerst, dann der Zeitraum;
// Entscheidung zeigt die Konflikte (geplante Schichten, Urlaubssperre) VOR dem
// Klick. Urlaubskonten je Person und Krankenstand als Nebenspalten.
// Live über useRealtime auf personal_abwesenheiten.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { abwesenheitBeantragen, abwesenheitEntscheiden, abwesenheitStornieren, listAbwesenheiten } from "@/lib/personal";
import type { AbwesenheitPlus, AbwesenheitStatusPlus } from "@/lib/personal-betrieb-typen";
import {
  ABWESENHEIT_ARTEN,
  type AbwesenheitArt,
  type AbwesenheitListe,
  type Krankenstand,
  type PlanPerson,
  type Urlaubskonto,
} from "@/lib/personal-typen";
import { useRealtime } from "@/lib/use-realtime";
import { formatDate } from "@/lib/utils";

import { AbwesenheitenKalender } from "./abwesenheiten-kalender";

type Sicht = "offen" | "alle" | "kalender" | "konten" | "krank";

export function Abwesenheiten({
  initial,
  von,
  bis,
  urlaubskonten,
  krankenstand,
  kannEntscheiden,
  eigeneId,
  jahr,
  personalnummern = {},
  zone = "UTC",
}: {
  initial: AbwesenheitListe;
  von: string;
  bis: string;
  urlaubskonten: Urlaubskonto[];
  krankenstand: Krankenstand[];
  kannEntscheiden: boolean;
  eigeneId: string | null;
  jahr: number;
  /** user_id → Personalnummer, fuer die Zeilenbeschriftung der Gantt-Sicht.
   *  Optional, damit die Seite sie nachliefern kann, ohne dass die drei
   *  anderen Sichten davon abhaengen. */
  personalnummern?: Record<string, string | null>;
  /** Zeitzone des Betriebs — der Kalender nennt sie im Fusshinweis. */
  zone?: string;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [daten, setDaten] = useState(initial);
  const [sicht, setSicht] = useState<Sicht>("offen");
  const [neu, setNeu] = useState(false);
  /** Angeklickter Balken der Kalender-Sicht — zeigt den Antrag als Karte mit
   *  denselben Handlungen wie die Liste (Wurzel 9: derselbe Scope, keine
   *  zweite Entscheidungslogik). */
  const [detail, setDetail] = useState<AbwesenheitPlus | null>(null);

  const nachladen = useCallback(async () => {
    const res = await listAbwesenheiten(von, bis);
    if (res.ok) setDaten(res.data);
    router.refresh();
  }, [von, bis, router]);
  useRealtime({ table: "personal_abwesenheiten", onChange: nachladen });

  const name = (id: string) => daten.personen.find((p) => p.user_id === id)?.full_name ?? "—";
  const offen = daten.items.filter((a) => a.status === "beantragt");
  const liste = sicht === "offen" ? offen : daten.items;

  // Beide Handler nehmen die BREITERE Form (`AbwesenheitPlus`), weil sie auch
  // aus der Kalender-Sicht gerufen werden. Sie lesen ohnehin nur `id`,
  // `schichten_im_zeitraum` und `user_id` — Felder, die beide Formen tragen.
  async function entscheiden(a: AbwesenheitPlus, genehmigen: boolean) {
    let kommentar: string | undefined;
    if (!genehmigen) {
      const k = window.prompt(t("abwesenheit.ablehnGrund"));
      if (k === null) return;
      kommentar = k;
    }
    if (genehmigen && a.schichten_im_zeitraum > 0 && !window.confirm(t("abwesenheit.schichtenAbsagenFrage", { anzahl: a.schichten_im_zeitraum }))) return;
    const res = await abwesenheitEntscheiden(a.id, genehmigen, kommentar);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      genehmigen
        ? t("abwesenheit.genehmigtMeldung", { anzahl: res.data.schichten_im_zeitraum })
        : t("abwesenheit.abgelehntMeldung"),
    );
    void nachladen();
  }

  async function stornieren(a: AbwesenheitPlus) {
    if (!window.confirm(t("abwesenheit.stornierenFrage"))) return;
    const res = await abwesenheitStornieren(a.id);
    if (!res.ok) return void toast.error(res.error);
    void nachladen();
  }

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("abwesenheit.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("abwesenheit.subtitle", { offen: offen.length })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Sicht>
            value={sicht}
            onChange={setSicht}
            options={[
              { value: "offen", label: t("abwesenheit.sicht.offen", { anzahl: offen.length }) },
              { value: "alle", label: t("abwesenheit.sicht.alle") },
              { value: "kalender", label: t("abwesenheit.sicht.kalender") },
              { value: "konten", label: t("abwesenheit.sicht.konten") },
              { value: "krank", label: t("abwesenheit.sicht.krank") },
            ]}
          />
          <Button className="rounded-full" onClick={() => setNeu(true)}>
            <Icon icon="ph:plus" className="mr-1 size-4" />{t("abwesenheit.neu")}
          </Button>
        </div>
      </div>

      {(sicht === "offen" || sicht === "alle") && (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {liste.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t("abwesenheit.keine")}</li>}
          {liste.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
              <StatusBadge status={a.status} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {name(a.user_id)} · {t(`abwesenheitArt.${a.art}`)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(a.von, locale)} – {formatDate(a.bis, locale)} · {t("abwesenheit.tage", { tage: a.tage_berechnet })}
                  {a.halbtag_start ? ` · ${t("abwesenheit.halbtagStart")}` : ""}
                  {a.halbtag_ende ? ` · ${t("abwesenheit.halbtagEnde")}` : ""}
                  {a.grund ? ` · ${a.grund}` : ""}
                  {a.kommentar_entscheidung ? ` · ${t("abwesenheit.kommentar")}: ${a.kommentar_entscheidung}` : ""}
                </div>
              </div>
              {a.status === "beantragt" && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {a.schichten_im_zeitraum > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                      <Icon icon="ph:calendar-x" className="size-3" />{t("abwesenheit.schichtenBetroffen", { anzahl: a.schichten_im_zeitraum })}
                    </span>
                  )}
                  {a.urlaubssperre && (
                    <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                      <Icon icon="ph:prohibit" className="size-3" />{t("abwesenheit.sperre")}
                    </span>
                  )}
                  {kannEntscheiden && a.user_id !== eigeneId && (
                    <>
                      <Button size="sm" className="rounded-full" onClick={() => entscheiden(a, true)}>{t("genehmigen")}</Button>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => entscheiden(a, false)}>{t("ablehnen")}</Button>
                    </>
                  )}
                  {(a.user_id === eigeneId || kannEntscheiden) && (
                    <Button size="sm" variant="ghost" onClick={() => stornieren(a)}>{t("stornieren")}</Button>
                  )}
                </div>
              )}
              {a.status === "genehmigt" && kannEntscheiden && a.bis >= new Date().toISOString().slice(0, 10) && (
                <Button size="sm" variant="ghost" onClick={() => stornieren(a)}>{t("zuruecknehmen")}</Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {sicht === "kalender" && (
        <AbwesenheitenKalender
          /* Die Basis-Liste kennt `vorgenehmigt` noch nicht (Vertrag §1.5
             erweitert `AbwesenheitStatus` erst mit dem Backend-Nachzug). Die
             Zuweisung auf `AbwesenheitPlus` ist deshalb eine BREITERE Form,
             keine Umdeutung: jeder heute moegliche Status ist darin enthalten,
             und ein kuenftiges `vorgenehmigt` faellt nicht mehr durch. */
          eintraege={daten.items as AbwesenheitPlus[]}
          personen={daten.personen}
          personalnummern={personalnummern}
          zone={zone}
          onOeffnen={(a) => setDetail(a)}
        />
      )}

      {sicht === "konten" && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left">
              <tr>
                <th className="p-2">{t("dienstplan.person")}</th>
                <th className="p-2 text-right">{t("urlaub.anspruch")}</th>
                <th className="p-2 text-right">{t("urlaub.uebertrag")}</th>
                <th className="p-2 text-right">{t("urlaub.genommen")}</th>
                <th className="p-2 text-right">{t("urlaub.geplant")}</th>
                <th className="p-2 text-right">{t("urlaub.rest")}</th>
              </tr>
            </thead>
            <tbody>
              {urlaubskonten.map((k) => (
                <tr key={k.user_id} className="border-t">
                  <td className="p-2">{name(k.user_id)}{k.anteilig ? <span className="ml-1 text-xs text-muted-foreground">({t("urlaub.anteilig")})</span> : null}</td>
                  <td className="p-2 text-right">{k.anspruch}</td>
                  <td className="p-2 text-right">{k.uebertrag}</td>
                  <td className="p-2 text-right">{k.genommen}</td>
                  <td className="p-2 text-right">{k.geplant}</td>
                  <td className="p-2 text-right font-medium">{k.rest}</td>
                </tr>
              ))}
              {urlaubskonten.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{t("urlaub.keineKonten", { jahr })}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {sicht === "krank" && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left">
              <tr><th className="p-2">{t("dienstplan.person")}</th><th className="p-2 text-right">{t("krank.tage")}</th><th className="p-2 text-right">{t("krank.faelle")}</th></tr>
            </thead>
            <tbody>
              {krankenstand.map((k) => (
                <tr key={k.user_id} className="border-t"><td className="p-2">{k.full_name ?? "—"}</td><td className="p-2 text-right">{k.tage_krank}</td><td className="p-2 text-right">{k.faelle}</td></tr>
              ))}
              {krankenstand.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">{t("krank.keine")}</td></tr>}
            </tbody>
          </table>
          <p className="p-2 text-xs text-muted-foreground">{t("krank.zeitraum", { von: formatDate(von, locale), bis: formatDate(bis, locale) })}</p>
        </div>
      )}

      {detail && (
        <DetailDialog
          a={detail}
          name={name(detail.user_id)}
          kannEntscheiden={kannEntscheiden}
          eigeneId={eigeneId}
          onClose={() => setDetail(null)}
          onEntscheiden={async (genehmigen) => {
            setDetail(null);
            await entscheiden(detail, genehmigen);
          }}
          onStornieren={async () => {
            setDetail(null);
            await stornieren(detail);
          }}
        />
      )}

      {neu && (
        <AntragDialog
          personen={kannEntscheiden ? daten.personen : []}
          eigeneId={eigeneId}
          onClose={() => setNeu(false)}
          onSaved={() => { setNeu(false); void nachladen(); }}
        />
      )}
    </div>
  );
}

/**
 * Statusabzeichen.
 *
 * `vorgenehmigt` (§1.5, zweistufige Genehmigung) hat eine EIGENE Farbe und
 * wird bewusst nicht in „genehmigt" eingeordnet: die Leitung muss noch
 * entscheiden, und ein grünes Abzeichen würde eine Zusage anzeigen, die es
 * nicht gibt. Der Parameter nimmt die breitere Statusmenge, weil das Backend
 * sie liefert, sobald die Regel greift; ein unbekannter Wert bekommt eine
 * neutrale Fläche statt eines Absturzes (Wurzel 5).
 */
export function StatusBadge({ status }: { status: AbwesenheitStatusPlus }) {
  const t = useTranslations("personal");
  const farbe: Record<AbwesenheitStatusPlus, string> = {
    beantragt: "bg-amber-100 text-amber-800",
    vorgenehmigt: "bg-fuchsia-100 text-fuchsia-800",
    genehmigt: "bg-emerald-100 text-emerald-800",
    abgelehnt: "bg-destructive/10 text-destructive",
    storniert: "bg-secondary text-muted-foreground",
  };
  const schluessel = `abwesenheit.status.${status}`;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${farbe[status] ?? "bg-secondary text-muted-foreground"}`}>
      {t.has(schluessel) ? t(schluessel) : status}
    </span>
  );
}

/**
 * Antrag aus der Kalender-Sicht.
 *
 * Bewusst keine zweite Entscheidungslogik: der Dialog RUFT die Handler des
 * Listenpfads (`entscheiden`/`stornieren`) und zeigt nur, worüber entschieden
 * wird — inklusive der betroffenen Schichten und der Urlaubssperre, damit
 * beides VOR dem Klick sichtbar ist (dasselbe Versprechen wie in der Liste).
 */
function DetailDialog({
  a,
  name,
  kannEntscheiden,
  eigeneId,
  onClose,
  onEntscheiden,
  onStornieren,
}: {
  a: AbwesenheitPlus;
  name: string;
  kannEntscheiden: boolean;
  eigeneId: string | null;
  onClose: () => void;
  onEntscheiden: (genehmigen: boolean) => void | Promise<void>;
  onStornieren: () => void | Promise<void>;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const offen = a.status === "beantragt" || a.status === "vorgenehmigt";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-2">
          <StatusBadge status={a.status} />
          <h2 className="font-display text-lg font-extrabold">{name}</h2>
        </div>
        <dl className="grid gap-2 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">{t("abwesenheit.art")}</dt>
            <dd>{t(`abwesenheitArt.${a.art}`)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("abwesenheit.zeitraum")}</dt>
            <dd>
              {formatDate(a.von, locale)} – {formatDate(a.bis, locale)} ·{" "}
              {t("abwesenheit.tage", { tage: a.tage_berechnet })}
            </dd>
          </div>
          {a.grund && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("grund")}</dt>
              <dd>{a.grund}</dd>
            </div>
          )}
          {a.vorentschieden_von && a.vorentschieden_am && (
            <div>
              <dt className="text-xs text-muted-foreground">{t("abwesenheit.status.vorgenehmigt")}</dt>
              <dd>
                {t("abwesenheit.vorentschiedenVon", {
                  name: a.vorentschieden_von,
                  datum: formatDate(a.vorentschieden_am.slice(0, 10), locale),
                })}
              </dd>
            </div>
          )}
        </dl>
        {a.schichten_im_zeitraum > 0 && (
          <p className="mt-3 flex items-center gap-1 rounded-xl bg-amber-100 px-2 py-1 text-xs text-amber-800">
            <Icon icon="ph:calendar-x" className="size-3" />
            {t("abwesenheit.schichtenBetroffen", { anzahl: a.schichten_im_zeitraum })}
          </p>
        )}
        {a.urlaubssperre && (
          <p className="mt-1 flex items-center gap-1 rounded-xl bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <Icon icon="ph:prohibit" className="size-3" />
            {t("abwesenheit.sperre")}
          </p>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            {t("abbrechen")}
          </Button>
          {offen && kannEntscheiden && a.user_id !== eigeneId && (
            <>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => void onEntscheiden(false)}>
                {t("ablehnen")}
              </Button>
              <Button size="sm" className="rounded-full" onClick={() => void onEntscheiden(true)}>
                {t("genehmigen")}
              </Button>
            </>
          )}
          {(a.user_id === eigeneId || kannEntscheiden) && (
            <Button size="sm" variant="ghost" onClick={() => void onStornieren()}>
              {a.status === "genehmigt" ? t("zuruecknehmen") : t("stornieren")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AntragDialog({
  personen,
  eigeneId,
  onClose,
  onSaved,
  vorbelegt = "",
}: {
  /** Leer = nur für sich selbst. */
  personen: PlanPerson[];
  eigeneId: string | null;
  onClose: () => void;
  onSaved: () => void;
  /** Person vorbelegen (Akte-Reiter: Antrag FÜR diese Person). */
  vorbelegt?: string;
}) {
  const t = useTranslations("personal");
  const [f, setF] = useState({
    user_id: vorbelegt,
    art: "urlaub" as AbwesenheitArt,
    von: "",
    bis: "",
    halbtag_start: false,
    halbtag_ende: false,
    grund: "",
  });
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await abwesenheitBeantragen({
      user_id: f.user_id || null,
      art: f.art,
      von: f.von,
      bis: f.bis || f.von,
      halbtag_start: f.halbtag_start,
      halbtag_ende: f.halbtag_ende,
      grund: f.grund.trim() || null,
    });
    setBusy(false);
    if (!res.ok) {
      const code = res.details?.code;
      if (code === "anspruch") toast.error(t("abwesenheit.anspruchReichtNicht", { rest: String(res.details?.rest ?? "") }));
      else if (code === "urlaubssperre") toast.error(t("abwesenheit.sperreMeldung", { grund: String(res.details?.grund ?? "") }));
      else toast.error(res.error);
      return;
    }
    toast.success(res.data.status === "genehmigt" ? t("abwesenheit.eingetragen") : t("abwesenheit.beantragt"));
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <form onSubmit={absenden} className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("abwesenheit.neu")}</h2>
        <div className="flex flex-col gap-3 text-sm">
          {personen.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="font-medium">{t("dienstplan.person")}</span>
              <NativeSelect value={f.user_id} onChange={(e) => setF((x) => ({ ...x, user_id: e.target.value }))}>
                <option value="">{t("abwesenheit.fuerMich")}</option>
                {personen.filter((p) => p.user_id !== eigeneId).map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</option>)}
              </NativeSelect>
              <span className="text-xs text-muted-foreground">{t("abwesenheit.fuerAndereHint")}</span>
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("abwesenheit.art")}</span>
            <NativeSelect value={f.art} onChange={(e) => setF((x) => ({ ...x, art: e.target.value as AbwesenheitArt }))}>
              {ABWESENHEIT_ARTEN.map((a) => <option key={a} value={a}>{t(`abwesenheitArt.${a}`)}</option>)}
            </NativeSelect>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1"><span className="font-medium">{t("von")}</span><DatePicker value={f.von} onChange={(v) => setF((x) => ({ ...x, von: v }))} /></label>
            <label className="flex flex-col gap-1"><span className="font-medium">{t("bis")}</span><DatePicker value={f.bis} onChange={(v) => setF((x) => ({ ...x, bis: v }))} /></label>
          </div>
          <div className="flex items-center justify-between"><span>{t("abwesenheit.halbtagStart")}</span><Switch checked={f.halbtag_start} onCheckedChange={(v) => setF((x) => ({ ...x, halbtag_start: v }))} /></div>
          <div className="flex items-center justify-between"><span>{t("abwesenheit.halbtagEnde")}</span><Switch checked={f.halbtag_ende} onCheckedChange={(v) => setF((x) => ({ ...x, halbtag_ende: v }))} /></div>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("grund")}</span><Textarea rows={2} value={f.grund} onChange={(e) => setF((x) => ({ ...x, grund: e.target.value }))} /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>{t("abbrechen")}</Button>
          <Button type="submit" disabled={busy || !f.von} className="rounded-full">{t("abwesenheit.absenden")}</Button>
        </div>
        <Input type="hidden" value="" readOnly />
      </form>
    </div>
  );
}
