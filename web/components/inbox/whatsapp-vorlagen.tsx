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
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  WhatsAppVorlagenEditor,
  type VorlagenForm,
} from "@/components/inbox/whatsapp-vorlagen-editor";
import {
  createWhatsAppTemplate,
  hideWhatsAppTemplate,
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
  // Ausgeblendete sind normalerweise weg. Der Schalter holt sie zurück ins
  // Bild — ohne ihn wäre das Ausblenden eine Einbahnstraße.
  const [zeigeAusgeblendete, setZeigeAusgeblendete] = useState(false);

  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const [form, setForm] = useState<VorlagenForm>(LEER);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const res = await listWhatsAppTemplates(zeigeAusgeblendete);
    if (res.ok) {
      setItems(res.data.items);
      setLadefehler("");
    } else {
      setItems([]);
      setLadefehler(res.error);
    }
  }, [zeigeAusgeblendete]);

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

  /** Der Papierkorb blendet in myNextDays aus; bei Meta bleibt die Vorlage
   *  samt Freigabe bestehen. Löschen dort wäre endgültig und ist deshalb kein
   *  Nebeneffekt dieses Knopfes. */
  async function ausblenden(tpl: WhatsAppTemplate, hidden: boolean) {
    setLaeuft(true);
    const res = await hideWhatsAppTemplate(tpl.name, tpl.language, hidden);
    if (res.ok) {
      toast.success(hidden ? t("waTemplateHidden") : t("waTemplateShown"));
      if (hidden && editing?.id === tpl.id) reset();
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZeigeAusgeblendete((v) => !v)}
            >
              <Icon
                icon={zeigeAusgeblendete ? "ph:eye-slash" : "ph:eye"}
                className="size-4"
              />
              {zeigeAusgeblendete ? t("waHiddenOff") : t("waHiddenOn")}
            </Button>
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
                className={`flex items-start gap-4 rounded-2xl border p-4 ${
                  tpl.hidden
                    ? "border-dashed border-border bg-muted/40 opacity-70"
                    : "border-border"
                }`}
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
                  disabled={!darfBearbeitet(tpl.status)}
                  title={
                    darfBearbeitet(tpl.status)
                      ? t("waTemplateEdit")
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
                  title={tpl.hidden ? t("waTemplateShow") : t("waTemplateHide")}
                  onClick={() => void ausblenden(tpl, !tpl.hidden)}
                >
                  <Icon
                    icon={tpl.hidden ? "ph:eye" : "ph:eye-slash"}
                    className="size-4"
                  />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <WhatsAppVorlagenEditor
        editing={editing}
        form={form}
        onForm={setForm}
        fehler={fehler}
        laeuft={laeuft}
        onSpeichern={() => void speichern()}
        onAbbrechen={reset}
      />
    </div>
  );
}
