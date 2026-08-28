"use client";

// „Neue Seite" mit Typ-Auswahl (0433).
//
// Vier Typen mit Symbol, Namen und ERKLÄRUNGSSATZ — das Muster ist bei Hostaway
// abgelesen und es ist gut: ohne die Erklärung weiß niemand, was ein
// „Navigations-Ordner" ist, und die Frage landet im Support. Sie kostet eine
// Zeile.
//
// Bewusst NUR vier: Hostaway hat fünf (dazu „Page Builder" — Layout vorplanen,
// bevor man gestaltet). Bei uns IST der Abschnitts-Stapel dieser Planungsschritt,
// ein zweiter Modus davor wäre eine Ebene ohne Inhalt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import type {
  NavArea,
  Page,
  PageType,
  PopupTrigger,
} from "@/lib/site-pages";

/** Typ → Symbol. Die Texte stehen in den Sprachdateien.
 *
 *  EXPORTIERT, weil die Seitenliste dieselben Symbole braucht: sie zeichnete
 *  bis 27.08.2026 jede Seite als Blatt, also Ordner, Pop-up, externen Link und
 *  404 gleich (Prüfbericht B8). Zwei Tabellen wären beim nächsten Seitentyp
 *  auseinandergelaufen. */
export const TYP_SYMBOL: Record<PageType, string> = {
  normal: "ph:file",
  external: "ph:arrow-square-out",
  folder: "ph:folder",
  popup: "ph:chat-centered-dots",
  post: "ph:newspaper",
  error404: "ph:warning",
};

/** Reihenfolge der Auswahl: der Regelfall zuerst, die Fehlerseite zuletzt —
 *  sie wird genau einmal angelegt und danach nie wieder. */
const TYPEN: PageType[] = [
  "normal",
  "external",
  "folder",
  "post",
  "popup",
  "error404",
];

/** Seiten-Vorlagen (0434). Reihenfolge nach Häufigkeit, nicht alphabetisch:
 *  „Über uns" und „Kontakt" legt fast jeder Betrieb an.
 *
 *  Muss mit `VORLAGEN_REIHENFOLGE` in
 *  `apps/api/src/features/site_config/seiten_vorlagen.py` übereinstimmen — ein
 *  Name, den nur diese Liste kennt, bringt einen 422 beim Anlegen. */
const VORLAGEN = [
  "ueber_uns",
  "kontakt",
  "anfahrt",
  "hausordnung",
  "umgebung",
  "faq",
];

/** Pop-up-Vorlagen (0440). Eigene Liste und nicht dieselbe wie oben: die
 *  Kataloge im Backend sind getrennt (`popup_vorlagen.py` vs.
 *  `seiten_vorlagen.py`), weil ein ganzseitiger Abschnitts-Satz in einem
 *  Fenster nichts verloren hat.
 *
 *  Reihenfolge wie im Backend: erst die leere, dann die drei häufigsten. Muss
 *  mit `NAMEN` in `popup_vorlagen.py` übereinstimmen — ein Name, den nur diese
 *  Liste kennt, bringt einen 422 beim Anlegen. */
const POPUP_VORLAGEN = [
  "leer",
  "willkommen",
  "angebot",
  "letzte_chance",
  "anfrage",
  "kontakt",
  "anfahrt",
  "verfuegbarkeit",
  "neues_objekt",
  "bewertung",
  "social",
  "mehr_infos",
];

export function NeueSeite({
  bereich,
  pages,
  pending,
  onAnlegen,
  onAbbrechen,
}: {
  bereich: NavArea;
  /** Für die Ordner-Auswahl und um zu erkennen, ob es schon eine 404-Seite
   *  gibt: es darf nur eine geben (UNIQUE in 0433), und ein Formular, das dann
   *  mit 409 antwortet, ist schlechter als eine Auswahl ohne diesen Eintrag. */
  pages: Page[];
  pending: boolean;
  onAnlegen: (
    titel: string,
    typ: PageType,
    externalUrl: string | null,
    parentId: string | null,
    popup: {
      trigger: PopupTrigger;
      value: number | null;
      device: "mobile" | "desktop" | null;
      once: boolean;
    } | null,
    template: string | null,
  ) => void;
  onAbbrechen: () => void;
}) {
  const t = useTranslations("website");
  const [typ, setTyp] = useState<PageType>("normal");
  const [titel, setTitel] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ordnerId, setOrdnerId] = useState("");
  // Seiten-Vorlage (0434). Leer = leere Seite, der bisherige Zustand.
  const [vorlage, setVorlage] = useState("");
  // Pop-up-Auslöser (0437). Der Standard ist „nach 5 Sekunden": der Fall, den
  // fast jeder meint, und der einzige, der auf jedem Gerät funktioniert.
  const [ausloeser, setAusloeser] = useState<PopupTrigger>("delay");
  const [ausloeserWert, setAusloeserWert] = useState(5);

  const hat404 = pages.some((p) => p.page_type === "error404");
  const ordner = pages.filter((p) => p.page_type === "folder");
  const auswahl = TYPEN.filter((v) => v !== "error404" || !hat404);

  // Ein externer Menüpunkt braucht eine Adresse — sonst zeigt er ins Leere.
  // Die Prüfung hier ist die Rückmeldung, das Backend ist die Kontrolle.
  const adresseFehlt = typ === "external" && !adresse.trim();
  // Mit Vorlage darf der Titel leer bleiben — er kommt dann von dort. Ohne
  // Vorlage ist er Pflicht, sonst hieße die Seite in der Liste nichts.
  const bereit =
    (Boolean(titel.trim()) || Boolean(vorlage)) && !adresseFehlt && !pending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!bereit) return;
        onAnlegen(
          titel.trim(),
          typ,
          typ === "external" ? adresse.trim() : null,
          // Ein Ordner und die Fehlerseite hängen an keinem Ordner (CHECK 0433).
          typ === "normal" || typ === "external" ? ordnerId || null : null,
          typ === "popup"
            ? {
                trigger: ausloeser,
                value: ausloeser === "exit" ? null : ausloeserWert,
                device: null,
                once: true,
              }
            : null,
          // Eine Vorlage gibt es nur für echte Seiten: ein Ordner hat keinen
          // Inhalt, ein externer Menüpunkt zeigt nach außen, und die
          // Fehlerseite gestaltet man selbst.
          // Eine Vorlage gibt es für echte Seiten UND für Pop-ups — aus zwei
          // verschiedenen Katalogen, die das Backend am Seitentyp
          // auseinanderhält.
          typ === "normal" || typ === "popup" ? vorlage || null : null,
        );
      }}
      className="flex flex-col gap-2 px-4 pb-3"
    >
      <div className="flex flex-col gap-1">
        {auswahl.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={typ === v}
            onClick={() => setTyp(v)}
            className={
              "flex items-start gap-2 rounded-(--radius) border px-2 py-1.5 text-left transition " +
              (typ === v
                ? "border-foreground bg-secondary"
                : "border-border hover:bg-secondary/60")
            }
          >
            <Icon
              icon={TYP_SYMBOL[v]}
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold">
                {t(`seiten.typ.${v}.name`)}
              </span>
              <span className="block text-xs text-muted-foreground">
                {t(`seiten.typ.${v}.hinweis`)}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* Die Vorlage steht ÜBER dem Titel: wer eine wählt, bekommt den Titel
          geschenkt und muss ihn nicht erst tippen. */}
      {typ === "normal" || typ === "popup" ? (
        <NativeSelect
          value={vorlage}
          onChange={(e) => setVorlage(e.target.value)}
          aria-label={t("seiten.vorlage.label")}
        >
          <option value="">{t("seiten.vorlage.keine")}</option>
          {(typ === "popup" ? POPUP_VORLAGEN : VORLAGEN).map((v) => (
            <option key={v} value={v}>
              {t(
                typ === "popup"
                  ? `seiten.popupVorlage.${v}`
                  : `seiten.vorlage.${v}`,
              )}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <Input
        value={titel}
        maxLength={200}
        placeholder={
          vorlage
            ? t(
                typ === "popup"
                  ? `seiten.popupVorlage.${vorlage}`
                  : `seiten.vorlage.${vorlage}`,
              )
            : t("seiten.titelPlatzhalter")
        }
        onChange={(e) => setTitel(e.target.value)}
      />

      {/* Ein Beitrag braucht beim Anlegen nichts außer dem Titel: Datum, Autor
          und Titelbild trägt der Kunde im Beitrag selbst nach — dort sieht er,
          was er beschreibt. Ein Formular mit fünf Feldern VOR dem Schreiben
          wäre eine Hürde vor der eigentlichen Arbeit. */}
      {typ === "popup" ? (
        <>
          <NativeSelect
            value={ausloeser}
            onChange={(e) => setAusloeser(e.target.value as PopupTrigger)}
            aria-label={t("seiten.popup.ausloeser")}
          >
            {(["delay", "exit", "scroll"] as const).map((v) => (
              <option key={v} value={v}>
                {t(`seiten.popup.trigger.${v}`)}
              </option>
            ))}
          </NativeSelect>
          {/* Der Zahlenwert nur, wo er etwas bedeutet: bei „Verlassensabsicht"
              gibt es nichts einzustellen. */}
          {ausloeser !== "exit" ? (
            <label className="flex items-center gap-2 text-xs">
              <input
                type="number"
                min={1}
                max={ausloeser === "scroll" ? 100 : 120}
                value={ausloeserWert}
                onChange={(e) =>
                  setAusloeserWert(Number(e.target.value) || 1)
                }
                className="w-20 rounded-(--radius) border border-border bg-transparent px-2 py-1"
              />
              {t(
                ausloeser === "scroll"
                  ? "seiten.popup.einheitProzent"
                  : "seiten.popup.einheitSekunden",
              )}
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("seiten.popup.hinweis")}
          </p>
        </>
      ) : null}

      {typ === "external" ? (
        <>
          <Input
            value={adresse}
            maxLength={2000}
            placeholder="https://…"
            onChange={(e) => setAdresse(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("seiten.typ.external.adresseHinweis")}
          </p>
        </>
      ) : null}

      {/* Die Ordner-Auswahl erscheint nur, wenn es Ordner GIBT und der Typ dort
          hineinpassen kann. Eine leere Auswahl wäre ein Feld, das nichts kann. */}
      {ordner.length > 0 && (typ === "normal" || typ === "external") ? (
        <NativeSelect
          value={ordnerId}
          onChange={(e) => setOrdnerId(e.target.value)}
          aria-label={t("seiten.typ.folder.zuordnen")}
        >
          <option value="">{t("seiten.typ.folder.keiner")}</option>
          {ordner.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </NativeSelect>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!bereit}>
          {t("seiten.anlegen")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAbbrechen}
        >
          {t("seiten.abbrechen")}
        </Button>
      </div>
      {/* `bereich` steht im Formular nicht als Feld: er kommt von der
          Abschnittsüberschrift, unter der geklickt wurde. Ihn hier noch einmal
          zu fragen wäre dieselbe Angabe zweimal. */}
      <input type="hidden" value={bereich} readOnly />
    </form>
  );
}
