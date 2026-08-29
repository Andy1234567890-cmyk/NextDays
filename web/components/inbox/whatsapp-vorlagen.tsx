"use client";

// Reiter „WhatsApp-Vorlagen" im Posteingang: Liste links, Editor rechts —
// dasselbe Muster wie der Reiter „Vorlagen" daneben.
//
// Der Unterschied zu jenem ist aber kein gestalterischer, sondern ein
// inhaltlicher, und er muss in der Oberfläche sichtbar sein:
//
//   * „Vorlagen"          = eigene Textbausteine. Frei formulierbar, sofort
//                           nutzbar, nur unsere Regeln.
//   * „WhatsApp-Vorlagen" = Metas geprüfte Vorlagen. Nur mit ihnen darf
//                           ausserhalb des 24-Stunden-Fensters überhaupt
//                           geschrieben werden, und über den Text entscheidet
//                           Metas Prüfung.
//
// Was Meta erlaubt und was nicht (Stand v25.0, Template-Management-Doku):
//   * Name und Sprache sind NACH dem Anlegen unveränderlich. Wer sie ändern
//     will, legt eine neue Vorlage an. Deshalb sind beide Felder im Editor
//     gesperrt, sobald eine bestehende Vorlage bearbeitet wird — ein Feld, das
//     sich ändern lässt und beim Speichern ignoriert wird, ist eine Lüge.
//   * Bearbeitbar sind nur APPROVED, REJECTED und PAUSED. Eine Vorlage in
//     Prüfung (PENDING) lässt Meta nicht anfassen.
//   * Eine freigegebene Vorlage höchstens zehnmal in 30 Tagen, einmal in
//     24 Stunden. Diese Zähler kennt nur Meta; sein Fehlertext wird deshalb
//     unverändert durchgereicht statt geraten.
//   * Jede Änderung geht erneut in die Prüfung — bis dahin gilt die alte
//     Fassung weiter.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { FeldPicker } from "@/components/inbox/feld-picker";
import {
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  listWhatsAppTemplates,
  rolloutWhatsAppTemplates,
  updateWhatsAppTemplate,
  type WhatsAppTemplate,
} from "@/lib/whatsapp-api";

/** Metas Status in Farbe. Unbekannte Werte bleiben neutral, statt eine falsche
 *  Zusicherung zu färben — Meta führt mehr Zustände, als wir hier kennen. */
function statusFarbe(status: string): string {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "bg-emerald-500/10 text-emerald-700";
    case "PENDING":
    case "PENDING_DELETION":
      return "bg-amber-500/10 text-amber-700";
    case "REJECTED":
    case "DISABLED":
    case "PAUSED":
      return "bg-red-500/10 text-red-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

/** Metas mitgelieferte Beispielvorlagen. Sie lassen sich weder ändern noch
 *  löschen — Meta antwortet mit „Beispielvorlagen können nicht bearbeitet oder
 *  gelöscht werden. (Meta-Code 100)".
 *
 *  Erkannt am Namen, weil die API kein Merkmal dafür liefert: die Felder
 *  `library_template_name`, `sub_category` und `parameter_format` sehen bei
 *  ihnen genauso aus wie bei eigenen Vorlagen (live geprüft). Trifft die Liste
 *  eine nicht, bleibt Metas Fehlertext die Rückfallebene — schlimmer als ein
 *  gesperrter Knopf ist einer, der nichts tut. */
const META_BEISPIELE = /^(hello_world|jaspers_market_)/;

function istMetaBeispiel(name: string): boolean {
  return META_BEISPIELE.test(name);
}

/** Nur diese Zustände lässt Meta bearbeiten. PENDING ist bewusst nicht dabei. */
function darfBearbeitet(status: string): boolean {
  return ["APPROVED", "REJECTED", "PAUSED"].includes(status.toUpperCase());
}

function textVon(tpl: WhatsAppTemplate, typ: "BODY" | "FOOTER"): string {
  return tpl.components?.find((c) => c.type?.toUpperCase() === typ)?.text ?? "";
}

const LEER = {
  name: "",
  language: "de",
  category: "UTILITY" as const,
  body: "",
  footer: "",
};

export function WhatsAppVorlagen() {
  const t = useTranslations("inbox");
  const [items, setItems] = useState<WhatsAppTemplate[] | null>(null);
  // null = noch nicht geladen, "" = geladen und in Ordnung. Der Fehler wird
  // angezeigt statt einer leeren Liste: „keine Vorlagen" und „Abruf
  // fehlgeschlagen" sind zwei verschiedene Aussagen.
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const [form, setForm] = useState<{
    name: string;
    language: string;
    category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
    body: string;
    footer: string;
  }>(LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const textfeld = useRef<HTMLTextAreaElement | null>(null);

  /** Platzhalter an der Cursorposition einsetzen, nicht am Ende: sie stehen
   *  fast immer mitten im Satz („Hallo {{guest_first_name}},"). */
  function platzhalterEinfuegen(platzhalter: string) {
    const feld = textfeld.current;
    if (!feld) {
      setForm((f) => ({ ...f, body: f.body + platzhalter }));
      return;
    }
    const start = feld.selectionStart ?? feld.value.length;
    const ende = feld.selectionEnd ?? start;
    const neu = feld.value.slice(0, start) + platzhalter + feld.value.slice(ende);
    setForm((f) => ({ ...f, body: neu }));
    // Cursor hinter den eingefügten Platzhalter — sonst tippt man beim
    // Weiterschreiben mitten hinein.
    requestAnimationFrame(() => {
      feld.focus();
      const pos = start + platzhalter.length;
      feld.setSelectionRange(pos, pos);
    });
  }

  const laden = useCallback(async () => {
    const res = await listWhatsAppTemplates();
    if (res.ok) {
      setItems(res.data.items);
      setLadefehler("");
    } else {
      setItems([]);
      setLadefehler(res.error);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  function reset() {
    setEditing(null);
    setForm(LEER);
    setFehler(null);
  }

  function bearbeiten(tpl: WhatsAppTemplate) {
    setEditing(tpl);
    setForm({
      name: tpl.name,
      language: tpl.language,
      category: (tpl.category?.toUpperCase() as typeof LEER.category) || "UTILITY",
      body: textVon(tpl, "BODY"),
      footer: textVon(tpl, "FOOTER"),
    });
    setFehler(null);
  }

  async function speichern() {
    setFehler(null);
    setLaeuft(true);
    const gemeinsam = { body: form.body, footer: form.footer || null };
    const res = editing
      ? await updateWhatsAppTemplate(editing.id, {
          ...gemeinsam,
          name: editing.name,
          language: editing.language,
        })
      : await createWhatsAppTemplate({
          ...gemeinsam,
          name: form.name.trim().toLowerCase().replace(/\s+/g, "_"),
          language: form.language,
          category: form.category,
        });
    if (res.ok) {
      toast.success(t("waTemplateSaved"));
      reset();
      await laden();
    } else {
      // Metas Ablehnungsgrund steht im Fehlertext und ist genauer als jede
      // eigene Formulierung — deshalb unverändert anzeigen, nicht ersetzen.
      setFehler(res.error);
    }
    setLaeuft(false);
  }

  async function loeschen(tpl: WhatsAppTemplate) {
    setLaeuft(true);
    const res = await deleteWhatsAppTemplate(tpl.name, tpl.id);
    if (res.ok) {
      toast.success(t("waTemplateDeleted"));
      if (editing?.id === tpl.id) reset();
      await laden();
    } else {
      toast.error(res.error);
    }
    setLaeuft(false);
  }

  async function ausrollen() {
    setLaeuft(true);
    const res = await rolloutWhatsAppTemplates();
    if (res.ok) {
      const { angelegt, uebersprungen, fehler: abgelehnt } = res.data;
      toast.success(
        t("waTemplatesRolloutDone", {
          neu: angelegt.length,
          vorhanden: uebersprungen.length,
        }),
      );
      // Ablehnungen einzeln zeigen: sie verschwinden sonst spurlos, und später
      // fehlt eine Vorlage ohne ersichtlichen Grund.
      for (const zeile of abgelehnt) toast.error(zeile);
      await laden();
    } else {
      toast.error(res.error);
    }
    setLaeuft(false);
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-12 gap-6 overflow-y-auto p-6">
      {/* Liste */}
      <div className="col-span-12 lg:col-span-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-lg font-extrabold">
            {t("tabWhatsAppTemplates")}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void ausrollen()}
            disabled={laeuft}
          >
            <Icon icon="ph:stack" className="size-4" />
            {t("waTemplatesRollout")}
          </Button>
        </div>
        <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
          {t("waTemplatesIntro")}
        </p>

        {ladefehler ? (
          <p className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            {ladefehler}
          </p>
        ) : items === null ? (
          <p className="text-sm text-muted-foreground">{t("waTemplatesLoading")}</p>
        ) : items.length === 0 ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("waTemplatesEmpty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-start gap-4 rounded-2xl border border-border p-4"
              >
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{tpl.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusFarbe(
                        tpl.status,
                      )}`}
                    >
                      {tpl.status}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {textVon(tpl, "BODY")}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {tpl.language.toUpperCase()}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {tpl.category}
                    </span>
                  </span>
                  {/* Der Ablehnungsgrund ist die einzige Auskunft darüber, was
                      Meta stört. Ihn zu verschweigen hiesse, den Betrieb raten
                      zu lassen. */}
                  {tpl.rejected_reason &&
                    tpl.rejected_reason.toUpperCase() !== "NONE" && (
                      <span className="mt-1 text-xs text-destructive">
                        {tpl.rejected_reason}
                      </span>
                    )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={
                    !darfBearbeitet(tpl.status) || istMetaBeispiel(tpl.name)
                  }
                  title={
                    istMetaBeispiel(tpl.name)
                      ? t("waTemplateSampleHint")
                      : darfBearbeitet(tpl.status)
                        ? undefined
                        : t("waTemplatePendingHint")
                  }
                  onClick={() => bearbeiten(tpl)}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={istMetaBeispiel(tpl.name)}
                  title={
                    istMetaBeispiel(tpl.name) ? t("waTemplateSampleHint") : undefined
                  }
                  onClick={() => void loeschen(tpl)}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Editor */}
      <div className="col-span-12 flex flex-col gap-4 rounded-2xl border border-border p-5 lg:col-span-5">
        <h3 className="font-semibold">
          {editing ? t("waTemplateEdit") : t("waTemplateNew")}
        </h3>

        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder={t("waTemplateName")}
          // Name und Sprache sind bei Meta nach dem Anlegen fest. Gesperrt
          // statt stillschweigend ignoriert.
          disabled={Boolean(editing)}
        />
        <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
          {editing ? t("waTemplateNameLocked") : t("waTemplateNameHint")}
        </p>

        <div className="flex gap-3">
          <select
            className="h-9 flex-1 rounded-(--radius) border border-input bg-background px-3 text-sm"
            value={form.language}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            disabled={Boolean(editing)}
            aria-label={t("waTemplateLanguage")}
          >
            <option value="de">de</option>
            <option value="en">en</option>
            <option value="da">da</option>
            <option value="fr">fr</option>
            <option value="es">es</option>
            <option value="it">it</option>
            <option value="nl">nl</option>
            <option value="pl">pl</option>
            <option value="sv">sv</option>
          </select>
          <select
            className="h-9 flex-1 rounded-(--radius) border border-input bg-background px-3 text-sm"
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category: e.target.value as typeof LEER.category,
              }))
            }
            disabled={Boolean(editing)}
            aria-label={t("waTemplateCategory")}
          >
            <option value="UTILITY">UTILITY</option>
            <option value="MARKETING">MARKETING</option>
            <option value="AUTHENTICATION">AUTHENTICATION</option>
          </select>
        </div>

        <textarea
          className="min-h-40 w-full rounded-(--radius) border border-input bg-background p-3 text-sm"
          ref={textfeld}
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          placeholder={t("waTemplateBody")}
          data-testid="wa-template-body"
        />
        <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
          {t("waTemplateBodyHint")}
        </p>

        {/* Derselbe Platzhalter-Katalog wie in Vorlagen und Automationen —
            es gibt nur diesen einen. Metas positionelle Form ({{1}}) entsteht
            erst beim Übertragen und ist hier bewusst nicht sichtbar. */}
        <FeldPicker onInsert={platzhalterEinfuegen} />

        <Input
          value={form.footer}
          onChange={(e) => setForm((f) => ({ ...f, footer: e.target.value }))}
          placeholder={t("waTemplateFooter")}
        />

        {fehler && <p className="text-sm text-destructive">{fehler}</p>}

        <div className="flex justify-end gap-2">
          {editing && (
            <Button type="button" variant="outline" onClick={reset}>
              {t("waTemplateCancel")}
            </Button>
          )}
          <Button type="button" onClick={() => void speichern()} disabled={laeuft}>
            {t("waTemplateSave")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("waTemplateReviewHint")}</p>
      </div>
    </div>
  );
}
