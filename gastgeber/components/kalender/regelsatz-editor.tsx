"use client";

// Regelsatz-Editor (Vorbild: Airbnbs Dialog „Regeln bearbeiten" /
// „Neue Regeln erstellen", aufgenommen am 06.09.2026, siehe
// docs/AIRBNB-MULTIKALENDER-ANALYSE.md Abschnitt G).
//
// Aufbau dort und hier gleich:
//   Kopf     Name (Pflicht) · Farbe aus acht festen Farben
//   Preise   Preis pro Nacht (% Senkung/Erhöhung)
//            Rabatte für die Aufenthaltsdauer
//            Last-minute-Rabatte
//            Frühbucher-Rabatte
//   Verfüg.  Länge des Aufenthalts (Mindest-/Höchstaufenthalt)
//            Check-in- und Check-out-Tage (je sieben Wochentage)
//   Fuß      Diese Reihe von Regeln löschen · Abbrechen · Speichern
//
// Die Bereiche sind Aufklapp-Zeilen; zugeklappt steht dort die
// Zusammenfassung, genau wie im Vorbild.
//
// Was der Regelsatz bei uns wirklich tut, steht in Migration 0572: Name,
// Farbe, Preisänderung und die Aufenthaltsregeln liegen an der Saison, die
// Rabatte hängen mit `season_id` daran. Beim Zuweisen eines Zeitraums werden
// die Regeln je Tag materialisiert und an die Portale gemeldet — deshalb ist
// hier nichts erfunden, was hinterher nur in der Oberfläche stünde.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";

import type { Rabatt, RegelsatzEingabe, Saison } from "@/lib/kalender";
import {
  aendereRegelsatz,
  legeRabattAn,
  legeRegelsatzAn,
  loescheRabatt,
  loescheRegelsatz,
} from "@/lib/kalender-actions";

/** Die acht Farben des Vorbilds — als Werte, damit die Farbe im Raster passt. */
const FARBEN = [
  { key: "rot", hex: "#c13515" },
  { key: "braun", hex: "#8b5e34" },
  { key: "orange", hex: "#e07912" },
  { key: "gelb", hex: "#d4a017" },
  { key: "gruen", hex: "#2e7d32" },
  { key: "blau", hex: "#1a73a7" },
  { key: "lila", hex: "#6b4bb3" },
  { key: "rosa", hex: "#c2185b" },
] as const;

/**
 * Die Stufen, aus denen das Vorbild den Längenrabatt wählen lässt — keine
 * freie Nächtezahl. Eine Liste statt eines Zahlenfelds, weil genau diese
 * Stufen an die Portale gehen (Airbnb `STAYED_AT_LEAST_X_DAYS`).
 */
const DAUER_STUFEN = [2, 3, 4, 5, 6, 7, 14, 21, 28, 35, 42, 56, 70, 84] as const;

/** 0 = Montag … 6 = Sonntag, wie im Backend (0572). */
const WOCHENTAGE = [0, 1, 2, 3, 4, 5, 6] as const;

type Abschnitt =
  | "preis"
  | "dauer"
  | "lastminute"
  | "fruehbucher"
  | "laenge"
  | "tage";

export function RegelsatzEditor({
  saison,
  propertyId,
  rabatte,
  offen,
  onSchliessen,
  onGespeichert,
}: {
  /** Null = neuer Regelsatz. */
  saison: Saison | null;
  propertyId: string;
  /** Rabatte, die zu diesem Regelsatz gehören. */
  rabatte: Rabatt[];
  offen: boolean;
  onSchliessen: () => void;
  onGespeichert: () => void;
}) {
  const t = useTranslations("kalender");
  const [name, setName] = useState(saison?.name ?? "");
  const [farbe, setFarbe] = useState(saison?.color ?? FARBEN[0].hex);
  const [richtung, setRichtung] = useState<"erhoehung" | "senkung">(
    (saison?.amount ?? 0) < 0 ? "senkung" : "erhoehung",
  );
  const [prozent, setProzent] = useState(
    saison ? String(Math.abs(saison.amount)) : "",
  );
  const [minStay, setMinStay] = useState(saison?.min_stay?.toString() ?? "");
  const [maxStay, setMaxStay] = useState(saison?.max_stay?.toString() ?? "");
  const [keineAnreise, setKeineAnreise] = useState<number[]>(
    saison?.closed_arrival_weekdays ?? [],
  );
  const [keineAbreise, setKeineAbreise] = useState<number[]>(
    saison?.closed_departure_weekdays ?? [],
  );
  // Mindestaufenthalt je ANREISETAG (0576). Der Schalter ist AN, sobald auch
  // nur ein Wochentag einen eigenen Wert trägt — ein Regelsatz, der ihn hat,
  // darf ihn beim Öffnen nicht zugeklappt verstecken.
  const [jeAnreisetag, setJeAnreisetag] = useState(
    Object.keys(saison?.min_stay_by_weekday ?? {}).length > 0,
  );
  const [minJeTag, setMinJeTag] = useState<Record<number, string>>(() => {
    const aus: Record<number, string> = {};
    for (const [tag, naechte] of Object.entries(saison?.min_stay_by_weekday ?? {})) {
      aus[Number(tag)] = String(naechte);
    }
    return aus;
  });
  const [aufgeklappt, setAufgeklappt] = useState<Abschnitt | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Neue Rabatte werden erst nach dem Speichern des Satzes angelegt — vorher
  // gibt es keine `season_id`, an die sie gehören könnten.
  const [neuerRabatt, setNeuerRabatt] = useState<{
    typ: Rabatt["discount_type"];
    prozent: string;
    wert: string;
  } | null>(null);

  function umschalten(a: Abschnitt) {
    setAufgeklappt(aufgeklappt === a ? null : a);
  }

  function wochentagUmschalten(liste: number[], tag: number): number[] {
    return liste.includes(tag)
      ? liste.filter((x) => x !== tag)
      : [...liste, tag].sort();
  }

  const eingabe = (): RegelsatzEingabe => ({
    name: name.trim(),
    color: farbe,
    mode: "percent",
    amount:
      (richtung === "senkung" ? -1 : 1) *
      Math.abs(Number(prozent.replace(",", ".")) || 0),
    min_stay: minStay ? Number(minStay) : null,
    max_stay: maxStay ? Number(maxStay) : null,
    closed_arrival_weekdays: keineAnreise,
    closed_departure_weekdays: keineAbreise,
    // Ausgeschalteter Schalter heißt „keine Wochentagsregel" und geht als
    // leeres Objekt hinaus — nur so lässt sich eine gesetzte Regel wieder
    // aufheben (derselbe Gegenzustand wie bei den Wochentag-Sperren, Wurzel 1).
    min_stay_by_weekday: jeAnreisetag ? minStayJeTag() : {},
  });

  /** Die gefüllten Wochentag-Felder als `{ "0": 7 }`; leere bleiben weg. */
  function minStayJeTag(): Record<string, number> {
    const aus: Record<string, number> = {};
    for (const tag of WOCHENTAGE) {
      const wert = Number(minJeTag[tag] ?? "");
      if (wert >= 1) aus[String(tag)] = Math.round(wert);
    }
    return aus;
  }

  async function speichern() {
    if (!name.trim()) {
      toast.error(t("editorNamePflicht"));
      return;
    }
    setLaeuft(true);
    const res = saison
      ? await aendereRegelsatz(saison.id, eingabe())
      : await legeRegelsatzAn(propertyId, eingabe());
    if (!res.ok) {
      setLaeuft(false);
      toast.error(res.fehler);
      return;
    }
    // Ein im Editor angelegter Rabatt hängt an dem gerade gespeicherten Satz.
    if (neuerRabatt) {
      const wert = Number(neuerRabatt.wert) || 0;
      const r = await legeRabattAn(propertyId, {
        season_id: res.data.id,
        discount_type: neuerRabatt.typ,
        discount_bps: Math.round(
          (Number(neuerRabatt.prozent.replace(",", ".")) || 0) * 100,
        ),
        min_nights: neuerRabatt.typ === "length_of_stay" ? wert : null,
        lead_min_days: neuerRabatt.typ === "early_booker" ? wert : null,
        lead_max_days: neuerRabatt.typ === "last_minute" ? wert : null,
      });
      if (!r.ok) {
        setLaeuft(false);
        // Der Satz IST gespeichert — das sagt die Meldung, statt einen
        // sauberen Fehlschlag zu behaupten (Wurzel 5).
        toast.error(t("editorRabattFehler", { fehler: r.fehler }));
        onGespeichert();
        return;
      }
    }
    setLaeuft(false);
    toast.success(t("gespeichert"));
    onGespeichert();
    onSchliessen();
  }

  async function loeschen() {
    if (!saison) return;
    setLaeuft(true);
    const res = await loescheRegelsatz(saison.id);
    setLaeuft(false);
    if (res.ok) {
      toast.success(t("editorGeloescht"));
      onGespeichert();
      onSchliessen();
    } else {
      toast.error(res.fehler);
    }
  }

  async function rabattLoeschen(id: string) {
    setLaeuft(true);
    const res = await loescheRabatt(propertyId, id);
    setLaeuft(false);
    if (res.ok) {
      toast.success(t("editorRabattGeloescht"));
      onGespeichert();
    } else {
      toast.error(res.fehler);
    }
  }

  const zusammenfassungPreis = prozent
    ? richtung === "senkung"
      ? t("regelPreissenkung", { prozent })
      : t("regelPreiserhoehung", { prozent })
    : "";

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      {/* Maße am Vorbild abgenommen (06.09.2026): Dialog 1032 px breit,
          Formularspalte 608 px, Hilfekarte 312 px rechts daneben, Innenabstand
          56 px. Unter 1128 px fällt die Karte unter das Formular — dort ist
          kein Platz für zwei Spalten, und die Anleitung ist der Teil, der
          warten kann. */}
      <DialogContent
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto p-6 pt-16 sm:max-w-[64.5rem] sm:p-14 sm:pt-20"
      >
        {/* Der Schließknopf sitzt im Vorbild oben LINKS als runder Umriss
            (30 px), nicht oben rechts wie sonst in unseren Dialogen. In einem
            Dialog dieser Breite steht rechts oben die Hilfekarte; ein X daneben
            läse sich als deren Schließknopf. */}
        <DialogClose
          aria-label={t("schliessen")}
          className="absolute start-5 top-5 flex size-8 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:start-6 sm:top-10"
        >
          <Icon icon="ph:x" className="size-4" aria-hidden="true" />
        </DialogClose>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 lg:max-w-[38rem]">
            <DialogTitle className="font-display text-2xl font-extrabold leading-[1.875rem]">
              {saison ? t("editorTitelBearbeiten") : t("editorTitelNeu")}
            </DialogTitle>
            <DialogDescription className="mt-2">
              {t("editorUntertitel")}
            </DialogDescription>

            {/* Name und Farbe stehen im Vorbild NEBENEINANDER: der Name ist ein
                schmales Feld (242 px), die acht Farben füllen den Rest. */}
            <div className="mt-6 flex flex-wrap items-start gap-6">
              <div className="w-full sm:w-[15rem]">
                <label htmlFor="regelsatz-name" className="block font-medium">
                  {t("editorName")}
                </label>
                <input
                  id="regelsatz-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder={t("editorNamePlatzhalter")}
                  className="mt-2 h-[2.875rem] w-full rounded-xl border border-border bg-background px-4 outline-none focus-visible:border-foreground"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t("editorFarbe")}</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {FARBEN.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-label={t(`farbe_${f.key}`)}
                      aria-pressed={farbe === f.hex}
                      onClick={() => setFarbe(f.hex)}
                      // Der Kreis trägt die Farbe mit 30 % Deckkraft und einen
                      // Rand derselben Farbe — voll gesättigt wären acht Punkte
                      // ein Ampelbrett und die Auswahl schwerer zu sehen als
                      // der Farbton selbst (Vorbild: rgba(…, .3) + 1 px Rand).
                      style={{
                        backgroundColor: `${f.hex}4d`,
                        borderColor: farbe === f.hex ? `${f.hex}99` : undefined,
                      }}
                      className={`size-6 rounded-full border transition-shadow ${
                        farbe === f.hex
                          ? "shadow-[0_0_0_4px_var(--color-background),0_0_0_5px_var(--color-foreground)]"
                          : "border-muted-foreground/60"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Preisgestaltung */}
            <h3 className="mt-8 font-display text-2xl font-extrabold leading-[1.875rem]">
              {t("editorPreisgestaltung")}
            </h3>

        <Zeile
          titel={t("editorPreisProNacht")}
          zusammenfassung={zusammenfassungPreis}
          offen={aufgeklappt === "preis"}
          onUmschalten={() => umschalten("preis")}
        >
          <p className="text-sm text-muted-foreground">{t("editorPreisHinweis")}</p>
          <div className="mt-3 flex items-center gap-2">
            <input
              value={prozent}
              onChange={(e) => setProzent(e.target.value)}
              inputMode="decimal"
              aria-label={t("regelProzent")}
              className="h-11 w-24 rounded-xl border border-border bg-background px-3 tabular-nums outline-none focus-visible:border-foreground"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <select
              value={richtung}
              onChange={(e) =>
                setRichtung(e.target.value as "erhoehung" | "senkung")
              }
              aria-label={t("editorRichtung")}
              className="h-11 flex-1 rounded-xl border border-border bg-background px-3 outline-none focus-visible:border-foreground"
            >
              <option value="erhoehung">{t("editorErhoehung")}</option>
              <option value="senkung">{t("editorSenkung")}</option>
            </select>
          </div>
        </Zeile>

        <RabattZeile
          titel={t("editorDauerRabatte")}
          hinweis={t("editorDauerHinweis")}
          typ="length_of_stay"
          rabatte={rabatte.filter((r) => r.discount_type === "length_of_stay")}
          offen={aufgeklappt === "dauer"}
          onUmschalten={() => umschalten("dauer")}
          neuerRabatt={neuerRabatt}
          setNeuerRabatt={setNeuerRabatt}
          onLoeschen={rabattLoeschen}
          laeuft={laeuft}
        />

        <RabattZeile
          titel={t("editorLastMinute")}
          hinweis={t("editorLastMinuteHinweis")}
          typ="last_minute"
          rabatte={rabatte.filter((r) => r.discount_type === "last_minute")}
          offen={aufgeklappt === "lastminute"}
          onUmschalten={() => umschalten("lastminute")}
          neuerRabatt={neuerRabatt}
          setNeuerRabatt={setNeuerRabatt}
          onLoeschen={rabattLoeschen}
          laeuft={laeuft}
        />

        <RabattZeile
          titel={t("editorFruehbucher")}
          hinweis={t("editorFruehbucherHinweis")}
          typ="early_booker"
          rabatte={rabatte.filter((r) => r.discount_type === "early_booker")}
          offen={aufgeklappt === "fruehbucher"}
          onUmschalten={() => umschalten("fruehbucher")}
          neuerRabatt={neuerRabatt}
          setNeuerRabatt={setNeuerRabatt}
          onLoeschen={rabattLoeschen}
          laeuft={laeuft}
        />

        <p className="mt-3 text-sm text-muted-foreground">
          {t("editorSmartHinweis")}
        </p>

            {/* Verfügbarkeit */}
            <h3 className="mt-8 font-display text-2xl font-extrabold leading-[1.875rem]">
              {t("verfuegbarkeit")}
            </h3>

        <Zeile
          titel={t("editorLaenge")}
          zusammenfassung={
            minStay || maxStay || jeAnreisetag
              ? [
                  minStay ? t("editorMinKurz", { naechte: minStay }) : null,
                  maxStay ? t("editorMaxKurz", { naechte: maxStay }) : null,
                  jeAnreisetag && Object.keys(minStayJeTag()).length > 0
                    ? t("editorMinJeTagKurz", {
                        anzahl: Object.keys(minStayJeTag()).length,
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : ""
          }
          offen={aufgeklappt === "laenge"}
          onUmschalten={() => umschalten("laenge")}
        >
          <p className="text-sm text-muted-foreground">{t("editorLaengeHinweis")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="text-sm">
              {t("editorMindestaufenthalt")}
              <input
                value={minStay}
                onChange={(e) => setMinStay(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 tabular-nums outline-none focus-visible:border-foreground"
              />
            </label>
            <label className="text-sm">
              {t("editorHoechstaufenthalt")}
              <input
                value={maxStay}
                onChange={(e) => setMaxStay(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 tabular-nums outline-none focus-visible:border-foreground"
              />
            </label>
          </div>

          {/* Mindestaufenthalt je ANREISETAG (0576) — im Vorbild der Schalter
              „Passe den Mindestaufenthalt an den Tag des Check-in an". Ein Haus
              verlangt samstags sieben Nächte und mittwochs drei; mit einem
              einzigen Wert war das nicht zu sagen. Ein leeres Feld heißt „für
              diesen Anreisetag gilt der Wert oben" — nicht null Nächte. */}
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={jeAnreisetag}
              onChange={(e) => setJeAnreisetag(e.target.checked)}
              className="size-4 accent-foreground"
            />
            {t("editorMinJeAnreisetag")}
          </label>
          {jeAnreisetag && (
            <div className="mt-3 space-y-2">
              {WOCHENTAGE.map((tag) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm">
                    {t("editorAnreiseAm", { tag: t(`wochentag_${tag}`) })}
                  </span>
                  <input
                    value={minJeTag[tag] ?? ""}
                    onChange={(e) =>
                      setMinJeTag({
                        ...minJeTag,
                        [tag]: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    inputMode="numeric"
                    placeholder={minStay || t("editorNichtGesetzt")}
                    aria-label={t("editorAnreiseAm", { tag: t(`wochentag_${tag}`) })}
                    className="h-11 w-24 rounded-xl border border-border bg-background px-3 tabular-nums outline-none focus-visible:border-foreground"
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("naechteKurz")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Zeile>

        <Zeile
          titel={t("editorTage")}
          zusammenfassung={
            keineAnreise.length + keineAbreise.length === 0
              ? ""
              : t("editorTageZusammenfassung", {
                  an: keineAnreise.length,
                  ab: keineAbreise.length,
                })
          }
          offen={aufgeklappt === "tage"}
          onUmschalten={() => umschalten("tage")}
        >
          <p className="text-sm text-muted-foreground">{t("editorTageHinweis")}</p>
          {(
            [
              ["editorKeineAnreise", keineAnreise, setKeineAnreise],
              ["editorKeineAbreise", keineAbreise, setKeineAbreise],
            ] as const
          ).map(([label, liste, setzen]) => (
            <div key={label} className="mt-3">
              <p className="text-sm font-medium">{t(label)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {WOCHENTAGE.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={liste.includes(tag)}
                    onClick={() => setzen(wochentagUmschalten(liste, tag))}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                      liste.includes(tag)
                        ? "bg-foreground text-background"
                        : "border border-border hover:bg-muted"
                    }`}
                  >
                    {t(`wochentag_${tag}`)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </Zeile>

          </div>

          {/* Rechte Spalte. Sie WECHSELT ihren Inhalt — genau wie im Vorbild
              (am 06.09.2026 durch echtes Anklicken gemessen; ein Klick per
              Skript löst den Wechsel dort nicht aus, deshalb war er im ersten
              Durchgang unsichtbar): solange kein Abschnitt offen ist, stehen
              die drei Schritte da; sobald einer geöffnet wird, steht dort die
              Erklärung zu genau diesem Abschnitt. `sticky` hält sie im Blick,
              während links gescrollt wird. */}
          <aside className="w-full shrink-0 rounded-2xl border border-border p-6 lg:sticky lg:top-4 lg:w-[19.5rem]">
            {aufgeklappt ? (
              <>
                <h3 className="font-display text-lg font-extrabold">
                  {t(`editorInfo_${aufgeklappt}_titel`)}
                </h3>
                <p className="mt-4 text-sm leading-relaxed">
                  {t(`editorInfo_${aufgeklappt}_text`)}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-extrabold">
                  {t("editorHilfeTitel")}
                </h3>
                <ol className="mt-4 space-y-4">
                  {["editorHilfe1", "editorHilfe2", "editorHilfe3"].map((k, i) => (
                    <li key={k} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-medium text-background"
                      >
                        {i + 1}
                      </span>
                      <span className="text-sm leading-relaxed">{t(k)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </aside>
        </div>

          {/* Fuß — im Vorbild „Abbrechen" als unterstrichener Textlink
              links, „Speichern" als voller Knopf rechts (Radius 8 px,
              18 px/500, Innenabstand 16/32). Das Löschen steht daneben, weil
              es die Kehrseite des Speicherns ist und nicht in die Hilfekarte
              gehört. */}
          <div className="mt-8 flex items-center gap-6 border-t border-border pt-6">
            <button
              type="button"
              onClick={onSchliessen}
              disabled={laeuft}
              className="font-medium underline underline-offset-4 hover:opacity-70 disabled:opacity-40"
            >
              {t("abbrechen")}
            </button>
            {saison && (
              <button
                type="button"
                onClick={() => void loeschen()}
                disabled={laeuft}
                className="font-medium text-rose-700 underline underline-offset-4 hover:opacity-70 disabled:opacity-40"
              >
                {t("editorLoeschen")}
              </button>
            )}
            <button
              type="button"
              onClick={() => void speichern()}
              disabled={laeuft || !name.trim()}
              className="ms-auto rounded-lg bg-foreground px-8 py-4 text-lg font-medium text-background transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
            >
              {laeuft ? t("wirdGespeichert") : t("speichern")}
            </button>
          </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eine Aufklapp-Zeile mit Titel und Zusammenfassung (wie im Vorbild). */
function Zeile({
  titel,
  zusammenfassung,
  offen,
  onUmschalten,
  children,
}: {
  titel: string;
  zusammenfassung: string;
  offen: boolean;
  onUmschalten: () => void;
  children: React.ReactNode;
}) {
  // Im Vorbild ist die Zeile 68 px hoch und trägt NUR den Titel; eine
  // Unterzeile „Nicht gesetzt" gibt es dort nicht — sie stünde unter fünf von
  // sechs Zeilen und sagte nichts, was der leere Abschnitt nicht selbst sagt.
  // Steht dagegen ein Wert, ist er die nützlichste Information der Zeile.
  const gesetzt = zusammenfassung.trim().length > 0;
  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onUmschalten}
        aria-expanded={offen}
        className="flex min-h-[4.25rem] w-full items-center justify-between gap-3 py-4 text-start"
      >
        <span>
          <span className="block">{titel}</span>
          {!offen && gesetzt && (
            <span className="block text-sm text-muted-foreground">
              {zusammenfassung}
            </span>
          )}
        </span>
        <Icon
          icon={offen ? "ph:caret-up" : "ph:caret-down"}
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </button>
      {offen && <div className="mt-3">{children}</div>}
    </div>
  );
}

type NeuerRabatt = {
  typ: Rabatt["discount_type"];
  prozent: string;
  wert: string;
} | null;

/** Aufklapp-Zeile für eine Rabattart mit Liste und einem Neu-Formular. */
function RabattZeile({
  titel,
  hinweis,
  typ,
  rabatte,
  offen,
  onUmschalten,
  neuerRabatt,
  setNeuerRabatt,
  onLoeschen,
  laeuft,
}: {
  titel: string;
  hinweis: string;
  typ: Rabatt["discount_type"];
  rabatte: Rabatt[];
  offen: boolean;
  onUmschalten: () => void;
  neuerRabatt: NeuerRabatt;
  setNeuerRabatt: (r: NeuerRabatt) => void;
  onLoeschen: (id: string) => void;
  laeuft: boolean;
}) {
  const t = useTranslations("kalender");
  const eigener = neuerRabatt?.typ === typ ? neuerRabatt : null;

  return (
    <Zeile
      titel={titel}
      zusammenfassung={
        rabatte.length === 0
          ? ""
          : rabatte
              .map((r) => t("regelRabatt", { wert: `${r.discount_bps / 100} %` }))
              .join(" · ")
      }
      offen={offen}
      onUmschalten={onUmschalten}
    >
      <p className="text-sm text-muted-foreground">{hinweis}</p>

      <ul className="mt-3 space-y-2">
        {rabatte.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-sm"
          >
            <span>
              {t("regelRabatt", { wert: `${r.discount_bps / 100} %` })}
              {r.min_nights ? ` · ${t("editorAbNaechten", { naechte: r.min_nights })}` : ""}
              {r.lead_min_days ? ` · ${t("regelImVorausTage", { tage: r.lead_min_days })}` : ""}
              {r.lead_max_days ? ` · ${t("regelLastMinute", { tage: r.lead_max_days })}` : ""}
            </span>
            <button
              type="button"
              onClick={() => onLoeschen(r.id)}
              disabled={laeuft}
              aria-label={t("editorRabattLoeschen")}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <Icon icon="ph:trash" className="size-4" />
            </button>
          </li>
        ))}
      </ul>

      {eigener ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={eigener.prozent}
            onChange={(e) =>
              setNeuerRabatt({ ...eigener, prozent: e.target.value })
            }
            inputMode="decimal"
            aria-label={t("regelProzent")}
            className="h-10 w-20 rounded-xl border border-border bg-background px-3 tabular-nums outline-none"
          />
          <span className="text-sm text-muted-foreground">%</span>
          {typ === "length_of_stay" ? (
            <select
              value={eigener.wert}
              onChange={(e) => setNeuerRabatt({ ...eigener, wert: e.target.value })}
              aria-label={t("editorDauerWaehlen")}
              className="h-10 flex-1 rounded-xl border border-border bg-background px-3 outline-none"
            >
              <option value="">{t("editorDauerWaehlen")}</option>
              {DAUER_STUFEN.map((n) => (
                <option key={n} value={n}>
                  {n % 7 === 0
                    ? t("editorStufeWochen", { wochen: n / 7 })
                    : t("editorStufeNaechte", { naechte: n })}
                </option>
              ))}
            </select>
          ) : (
            <span className="flex flex-1 items-center gap-2">
              <input
                value={eigener.wert}
                onChange={(e) =>
                  setNeuerRabatt({ ...eigener, wert: e.target.value.replace(/\D/g, "") })
                }
                inputMode="numeric"
                aria-label={t("editorTageZahl")}
                className="h-10 w-20 rounded-xl border border-border bg-background px-3 tabular-nums outline-none"
              />
              <span className="text-sm text-muted-foreground">
                {typ === "early_booker"
                  ? t("editorTageVoraus")
                  : t("editorTageVorAnkunft")}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setNeuerRabatt(null)}
            className="text-sm underline underline-offset-4"
          >
            {t("abbrechen")}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNeuerRabatt({ typ, prozent: "", wert: "" })}
          className="mt-3 text-sm font-medium underline underline-offset-4 hover:opacity-70"
        >
          {t("editorRabattHinzufuegen")}
        </button>
      )}
      {eigener && (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("editorRabattWirdMitGespeichert")}
        </p>
      )}
    </Zeile>
  );
}
