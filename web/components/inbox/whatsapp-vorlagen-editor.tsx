"use client";

// Der Editor des Reiters „WhatsApp-Vorlagen" — bewusst eine eigene Datei, weil
// Liste und Formular zwei getrennte Aufgaben sind und die Liste sonst hinter
// dem Formular verschwindet.
//
// Gestaltung nach dem Muster der übrigen Formulare im Haus: jedes Feld hat eine
// Beschriftung ÜBER sich, nicht nur einen Platzhaltertext — der verschwindet
// beim Tippen, und dann weiß niemand mehr, was in dem Feld steht. Hinweise
// stehen dort, wo sie gebraucht werden, und nicht als graue Zeilenkette
// zwischen den Feldern.
//
// Der Platzhalter-Knopf sitzt in einer Leiste UNTER dem Textfeld, wie im
// Nachbarreiter: dort wird er beim Schreiben gebraucht, und der Dialog gibt den
// Cursor beim Schließen zurück.
import { useRef } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { FeldDialogKnopf } from "@/components/inbox/feld-picker";
import type { WhatsAppTemplate } from "@/lib/whatsapp-api";

/** Metas Grenzen für den Fließtext und die Fußzeile einer Vorlage. */
const MAX_BODY = 1024;
const MAX_FOOTER = 60;

export type VorlagenForm = {
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  body: string;
  footer: string;
};

/** Beschriftung + Feld als eine Einheit — überall gleich aufgebaut. */
function Feld({
  label,
  hinweis,
  children,
}: {
  label: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hinweis && (
        <span className="text-xs leading-relaxed text-muted-foreground">
          {hinweis}
        </span>
      )}
    </label>
  );
}

export function WhatsAppVorlagenEditor({
  editing,
  form,
  onForm,
  fehler,
  laeuft,
  onSpeichern,
  onAbbrechen,
}: {
  editing: WhatsAppTemplate | null;
  form: VorlagenForm;
  onForm: (aendern: (f: VorlagenForm) => VorlagenForm) => void;
  fehler: string | null;
  laeuft: boolean;
  onSpeichern: () => void;
  onAbbrechen: () => void;
}) {
  const t = useTranslations("inbox");
  const textfeld = useRef<HTMLTextAreaElement | null>(null);

  /** Platzhalter an der Cursorposition einsetzen, nicht am Ende: sie stehen
   *  fast immer mitten im Satz („Hallo {{guest_name}},"). */
  function platzhalterEinfuegen(platzhalter: string) {
    const feld = textfeld.current;
    if (!feld) {
      onForm((f) => ({ ...f, body: f.body + platzhalter }));
      return;
    }
    const start = feld.selectionStart ?? feld.value.length;
    const ende = feld.selectionEnd ?? start;
    const neu = feld.value.slice(0, start) + platzhalter + feld.value.slice(ende);
    onForm((f) => ({ ...f, body: neu }));
    // Cursor hinter den eingefügten Platzhalter — sonst tippt man beim
    // Weiterschreiben mitten hinein.
    requestAnimationFrame(() => {
      feld.focus();
      const pos = start + platzhalter.length;
      feld.setSelectionRange(pos, pos);
    });
  }

  const zuLang = form.body.length > MAX_BODY;

  return (
    <div className="col-span-12 lg:col-span-5">
      <div className="sticky top-0 flex flex-col rounded-2xl border border-border bg-card">
        <header className="border-b border-border px-5 py-4">
          <h3 className="font-display text-base font-extrabold">
            {editing ? t("waTemplateEdit") : t("waTemplateNew")}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("waTemplateReviewHint")}
          </p>
        </header>

        <div className="flex flex-col gap-5 px-5 py-5">
          <Feld
            label={t("waLabelName")}
            hinweis={editing ? t("waTemplateNameLocked") : t("waTemplateNameHint")}
          >
            <Input
              value={form.name}
              onChange={(e) => onForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="buchung_bestaetigt"
              // Name und Sprache sind bei Meta nach dem Anlegen fest. Gesperrt
              // statt stillschweigend ignoriert.
              disabled={Boolean(editing)}
            />
          </Feld>

          <div className="grid grid-cols-2 gap-4">
            <Feld label={t("waTemplateLanguage")}>
              <NativeSelect
                value={form.language}
                onChange={(e) =>
                  onForm((f) => ({ ...f, language: e.target.value }))
                }
                disabled={Boolean(editing)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="da">Dansk</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="it">Italiano</option>
                <option value="nl">Nederlands</option>
                <option value="pl">Polski</option>
                <option value="sv">Svenska</option>
              </NativeSelect>
            </Feld>
            <Feld label={t("waTemplateCategory")}>
              <NativeSelect
                value={form.category}
                onChange={(e) =>
                  onForm((f) => ({
                    ...f,
                    category: e.target.value as VorlagenForm["category"],
                  }))
                }
                disabled={Boolean(editing)}
              >
                <option value="UTILITY">{t("waCategoryUtility")}</option>
                <option value="MARKETING">{t("waCategoryMarketing")}</option>
                <option value="AUTHENTICATION">{t("waCategoryAuth")}</option>
              </NativeSelect>
            </Feld>
          </div>

          <Feld label={t("waLabelBody")} hinweis={t("waTemplateBodyHint")}>
            {/* Textfeld und Leiste sitzen in EINEM Rahmen, damit der
                Platzhalter-Knopf sichtbar zum Feld gehört und nicht wie ein
                verirrter Link darunter steht. */}
            <div
              className={`flex flex-col rounded-(--radius) border bg-background focus-within:ring-2 focus-within:ring-accent/40 ${
                zuLang ? "border-destructive" : "border-border"
              }`}
            >
              <textarea
                ref={textfeld}
                className="min-h-44 w-full resize-y bg-transparent p-3 text-sm outline-none"
                value={form.body}
                onChange={(e) => onForm((f) => ({ ...f, body: e.target.value }))}
                placeholder={t("waTemplateBody")}
                data-testid="wa-template-body"
              />
              <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
                <FeldDialogKnopf onInsert={platzhalterEinfuegen} />
                <span
                  className={`px-1 text-xs tabular-nums ${
                    zuLang ? "font-semibold text-destructive" : "text-muted-foreground"
                  }`}
                >
                  {form.body.length} / {MAX_BODY}
                </span>
              </div>
            </div>
          </Feld>

          <Feld label={t("waLabelFooter")} hinweis={t("waFooterHint")}>
            <Input
              value={form.footer}
              maxLength={MAX_FOOTER}
              onChange={(e) => onForm((f) => ({ ...f, footer: e.target.value }))}
              placeholder={t("waFooterPlaceholder")}
            />
          </Feld>

          {fehler && (
            <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fehler}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
          {editing && (
            <Button type="button" variant="outline" onClick={onAbbrechen}>
              {t("waTemplateCancel")}
            </Button>
          )}
          <Button
            type="button"
            onClick={onSpeichern}
            disabled={laeuft || zuLang || !form.body.trim()}
          >
            {t("waTemplateSave")}
          </Button>
        </footer>
      </div>
    </div>
  );
}
