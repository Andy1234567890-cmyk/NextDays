"use client";

// Der Assistent für eine Regel (0440).
//
// Vier Schritte, wie bei Duda: Vorlage → Auslöser → Aktion → Name & Speichern.
// Es gibt nur DIESEN einen Weg, auf dem eine Regel entsteht — auch die
// Vorlagen-Kacheln führen hier hinein und belegen bloß Felder vor. Ein zweiter,
// „schneller" Weg wäre eine zweite Stelle, an der Regeln unvollständig
// entstehen können.
//
// Beim BEARBEITEN startet der Assistent direkt bei den Auslösern: die Vorlage
// ist dann eine Frage aus der Vergangenheit.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createRegel,
  updateRegel,
  type Ausloeser,
  type Regel,
} from "@/lib/site-regeln";

import { AktionsSchritt, AusloeserSchritt } from "./schritte";
import { VORLAGEN, type Vorlage } from "./vorlagen";

type Schritt = "vorlage" | "ausloeser" | "aktion" | "name";
type Art = "popup" | "top_bar" | "effect" | "script";

export function RegelDialog({
  regel,
  seiten,
  popups,
  sprachen,
  onFertig,
  onAbbruch,
}: {
  /** Gesetzt = bearbeiten, `null` = neu. */
  regel: Regel | null;
  seiten: Array<{ slug: string; title: string }>;
  /** Die Pop-up-Seiten des Betriebs — Auswahl für die Pop-up-Aktion. */
  popups: Array<{ id: string; title: string }>;
  sprachen: string[];
  onFertig: () => void;
  onAbbruch: () => void;
}) {
  const t = useTranslations("website");
  const [schritt, setSchritt] = useState<Schritt>(
    regel ? "ausloeser" : "vorlage",
  );
  const [art, setArt] = useState<Art>((regel?.action_type as Art) ?? "popup");
  const [ausloeser, setAusloeser] = useState<Ausloeser>(regel?.triggers ?? {});
  const [aktion, setAktion] = useState<Record<string, unknown>>(
    regel?.action ?? { art: "popup", zeitpunkt: "sofort" },
  );
  const [zielseiten, setZielseiten] = useState<string[]>(regel?.seiten ?? []);
  const [name, setName] = useState(regel?.name ?? "");
  const [einmal, setEinmal] = useState(regel?.einmal_je_besucher ?? true);
  const [wiederTage, setWiederTage] = useState<string>(
    regel?.wieder_nach_tagen ? String(regel.wieder_nach_tagen) : "",
  );
  const [pending, start] = useTransition();

  function vorlageWaehlen(v: Vorlage) {
    setAusloeser(v.triggers);
    if (v.art) {
      setArt(v.art);
      setAktion(grundAktion(v.art));
    }
    setSchritt("ausloeser");
  }

  function speichern() {
    if (!name.trim()) {
      toast.error(t("regeln.nameFehlt"));
      return;
    }
    start(async () => {
      const eingabe = {
        name: name.trim(),
        triggers: ausloeser,
        action: { ...aktion, art },
        seiten: zielseiten,
        einmal_je_besucher: einmal,
        wieder_nach_tagen: wiederTage ? Number(wiederTage) : null,
      };
      const res = regel
        ? await updateRegel(regel.id, eingabe)
        : await createRegel(eingabe);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(t("regeln.gespeichert"));
        onFertig();
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("regeln.neueRegel")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onAbbruch();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">
            {regel ? t("regeln.regelBearbeiten") : t("regeln.neueRegel")}
          </h2>
          <button
            type="button"
            onClick={onAbbruch}
            aria-label={t("regeln.abbrechen")}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {schritt === "vorlage" ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {t("regeln.vorlageWaehlen")}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {VORLAGEN.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => vorlageWaehlen(v)}
                    className="flex flex-col items-start gap-2 rounded-2xl border border-border p-4 text-left transition hover:border-foreground hover:bg-secondary/40"
                  >
                    <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                      <Icon icon={v.symbol} className="size-5" />
                    </span>
                    <span className="text-sm font-medium">
                      {t(`regeln.vorlage.${v.id}`)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`regeln.vorlageHinweis.${v.id}`)}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {schritt === "ausloeser" ? (
            <AusloeserSchritt
              wert={ausloeser}
              setzen={setAusloeser}
              seiten={seiten}
              zielseiten={zielseiten}
              setZielseiten={setZielseiten}
            />
          ) : null}

          {schritt === "aktion" ? (
            <AktionsSchritt
              art={art}
              setArt={(neu: Art) => {
                setArt(neu);
                setAktion(grundAktion(neu));
              }}
              aktion={aktion}
              setAktion={setAktion}
              popups={popups}
              sprachen={sprachen}
            />
          ) : null}

          {schritt === "name" ? (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">
                  {t("regeln.nameLabel")}
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder={t("regeln.namePlatzhalter")}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <span className="text-xs text-muted-foreground">
                  {t("regeln.nameHinweis")}
                </span>
              </label>

              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-medium">
                  {t("regeln.haeufigkeit")}
                </legend>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={einmal}
                    onChange={() => setEinmal(true)}
                  />
                  {t("regeln.einmalBesucher")}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!einmal}
                    onChange={() => setEinmal(false)}
                  />
                  {t("regeln.einmalSitzung")}
                </label>
                <label className="mt-1 flex items-center gap-2 text-sm">
                  <span>{t("regeln.wiederNachLabel")}</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={wiederTage}
                    onChange={(e) => setWiederTage(e.target.value)}
                    className="w-20 rounded-xl border border-border bg-background px-2 py-1 text-sm"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  {t("regeln.wiederNachHinweis")}
                </p>
              </fieldset>
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => {
              const reihe: Schritt[] = regel
                ? ["ausloeser", "aktion", "name"]
                : ["vorlage", "ausloeser", "aktion", "name"];
              const i = reihe.indexOf(schritt);
              if (i <= 0) onAbbruch();
              else setSchritt(reihe[i - 1]!);
            }}
            className="rounded-full border border-border px-4 py-2 text-sm transition hover:bg-secondary"
          >
            {t("regeln.zurueck")}
          </button>
          {schritt === "name" ? (
            <button
              type="button"
              disabled={pending}
              onClick={speichern}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {t("regeln.speichern")}
            </button>
          ) : schritt === "vorlage" ? null : (
            <button
              type="button"
              onClick={() =>
                setSchritt(schritt === "ausloeser" ? "aktion" : "name")
              }
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition hover:opacity-90"
            >
              {t("regeln.weiter")}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

/** Die Grundbelegung je Aktionsart.
 *
 *  Sie steht hier und nicht im Backend, weil sie eine Frage der Bedienung ist:
 *  „sofort" ist die harmloseste Voreinstellung für ein Pop-up, 15 Sekunden die
 *  für einen Effekt. Das Backend hat eigene Voreinstellungen für den Fall, dass
 *  eine Regel ohne Oberfläche entsteht. */
function grundAktion(art: Art): Record<string, unknown> {
  if (art === "top_bar") return { art, text: {}, schliessbar: true };
  if (art === "effect") return { art, effekt: "schnee", dauer_sekunden: 15 };
  if (art === "script") return { art, code: "" };
  return { art, zeitpunkt: "sofort", position: "mitte" };
}
