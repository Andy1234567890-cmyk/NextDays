"use client";

// Die beiden mittleren Schritte des Regel-Assistenten (0440): Auslöser und
// Aktion. Eigene Datei, weil `regel-dialog.tsx` sonst über 400 Zeilen läge und
// die Rahmenlogik (welcher Schritt, speichern, abbrechen) zwischen zwei langen
// Formularen verschwände.
import { useTranslations } from "next-intl";

import type { Ausloeser } from "@/lib/site-regeln";

import { EFFEKTE, POSITIONEN } from "./vorlagen";

type Art = "popup" | "top_bar" | "effect" | "script";

function Kasten({
  titel,
  hinweis,
  an,
  umschalten,
  kinder,
}: {
  titel: string;
  hinweis?: string;
  an: boolean;
  umschalten: (an: boolean) => void;
  kinder: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={an}
          onChange={(e) => umschalten(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-sm font-medium">{titel}</span>
          {hinweis ? (
            <span className="block text-xs text-muted-foreground">
              {hinweis}
            </span>
          ) : null}
        </span>
      </label>
      {an ? <div className="mt-3 flex flex-col gap-3 pl-7">{kinder}</div> : null}
    </div>
  );
}

export function AusloeserSchritt({
  wert,
  setzen,
  seiten,
  zielseiten,
  setZielseiten,
}: {
  wert: Ausloeser;
  setzen: (a: Ausloeser) => void;
  seiten: Array<{ slug: string; title: string }>;
  zielseiten: string[];
  setZielseiten: (s: string[]) => void;
}) {
  const t = useTranslations("website");
  const setzeTeil = (teil: Partial<Ausloeser>) => setzen({ ...wert, ...teil });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">{t("regeln.ausloeserHinweis")}</p>

      <Kasten
        titel={t("regeln.ausloeser.geraet")}
        an={Boolean(wert.geraet)}
        umschalten={(an) => setzeTeil({ geraet: an ? "mobile" : undefined })}
        kinder={
          <select
            value={wert.geraet ?? "mobile"}
            onChange={(e) =>
              setzeTeil({ geraet: e.target.value as "desktop" | "mobile" })
            }
            className="w-48 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="mobile">{t("regeln.geraet.mobile")}</option>
            <option value="desktop">{t("regeln.geraet.desktop")}</option>
          </select>
        }
      />

      <Kasten
        titel={t("regeln.ausloeser.zeit")}
        hinweis={t("regeln.zeitHinweis")}
        an={Boolean(wert.zeit)}
        umschalten={(an) =>
          setzeTeil({
            zeit: an
              ? { ganztags: true, wiederholung: "keine", zeitzone: "Europe/Copenhagen" }
              : undefined,
          })
        }
        kinder={
          <>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-xs">
                {t("regeln.von")}
                <input
                  type="date"
                  value={wert.zeit?.start_datum ?? ""}
                  onChange={(e) =>
                    setzeTeil({ zeit: { ...wert.zeit, start_datum: e.target.value } })
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t("regeln.bis")}
                <input
                  type="date"
                  value={wert.zeit?.end_datum ?? ""}
                  onChange={(e) =>
                    setzeTeil({ zeit: { ...wert.zeit, end_datum: e.target.value } })
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wert.zeit?.ganztags !== false}
                onChange={(e) =>
                  setzeTeil({ zeit: { ...wert.zeit, ganztags: e.target.checked } })
                }
              />
              {t("regeln.ganztags")}
            </label>
            {wert.zeit?.ganztags === false ? (
              <div className="flex flex-wrap gap-3">
                <input
                  type="time"
                  value={wert.zeit?.von ?? ""}
                  onChange={(e) =>
                    setzeTeil({ zeit: { ...wert.zeit, von: e.target.value } })
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <input
                  type="time"
                  value={wert.zeit?.bis ?? ""}
                  onChange={(e) =>
                    setzeTeil({ zeit: { ...wert.zeit, bis: e.target.value } })
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            ) : null}
            <select
              value={wert.zeit?.wiederholung ?? "keine"}
              onChange={(e) =>
                setzeTeil({
                  zeit: {
                    ...wert.zeit,
                    wiederholung: e.target
                      .value as NonNullable<Ausloeser["zeit"]>["wiederholung"],
                  },
                })
              }
              className="w-56 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {["keine", "taeglich", "woechentlich", "monatlich", "jaehrlich"].map(
                (w) => (
                  <option key={w} value={w}>
                    {t(`regeln.wiederholung.${w}`)}
                  </option>
                ),
              )}
            </select>
          </>
        }
      />

      <Kasten
        titel={t("regeln.ausloeser.besuche")}
        an={Boolean(wert.besuche)}
        umschalten={(an) =>
          setzeTeil({ besuche: an ? { modus: "first" } : undefined })
        }
        kinder={
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={wert.besuche?.modus ?? "first"}
              onChange={(e) =>
                setzeTeil({
                  besuche: {
                    modus: e.target.value as "first" | "min",
                    anzahl: wert.besuche?.anzahl ?? 2,
                  },
                })
              }
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="first">{t("regeln.besuche.erst")}</option>
              <option value="min">{t("regeln.besuche.abLabel")}</option>
            </select>
            {wert.besuche?.modus === "min" ? (
              <input
                type="number"
                min={2}
                max={50}
                value={wert.besuche?.anzahl ?? 2}
                onChange={(e) =>
                  setzeTeil({
                    besuche: { modus: "min", anzahl: Number(e.target.value) },
                  })
                }
                className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        }
      />

      <Kasten
        titel={t("regeln.ausloeser.ort")}
        hinweis={t("regeln.ortHinweis")}
        an={Boolean(wert.ort)}
        umschalten={(an) =>
          setzeTeil({ ort: an ? { land: "DK", radius_km: 50 } : undefined })
        }
        kinder={
          <div className="flex flex-wrap gap-3">
            <input
              value={wert.ort?.ort ?? ""}
              onChange={(e) => setzeTeil({ ort: { ...wert.ort, ort: e.target.value } })}
              placeholder={t("regeln.ortPlatzhalter")}
              className="w-56 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={wert.ort?.land ?? ""}
              onChange={(e) =>
                setzeTeil({ ort: { ...wert.ort, land: e.target.value.toUpperCase() } })
              }
              maxLength={2}
              placeholder="DK"
              className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-sm uppercase"
            />
            <input
              type="number"
              min={5}
              max={500}
              value={wert.ort?.radius_km ?? 50}
              onChange={(e) =>
                setzeTeil({ ort: { ...wert.ort, radius_km: Number(e.target.value) } })
              }
              className="w-24 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        }
      />

      <Kasten
        titel={t("regeln.ausloeser.kampagne")}
        hinweis={t("regeln.kampagneHinweis")}
        an={Boolean(wert.kampagne)}
        umschalten={(an) =>
          setzeTeil({ kampagne: an ? { parameter: {}, exakt: true } : undefined })
        }
        kinder={
          <KampagnenFelder
            parameter={wert.kampagne?.parameter ?? {}}
            setzen={(p) =>
              setzeTeil({ kampagne: { parameter: p, exakt: wert.kampagne?.exakt ?? true } })
            }
          />
        }
      />

      <div className="rounded-2xl border border-border p-4">
        <p className="text-sm font-medium">{t("regeln.zielseiten")}</p>
        <p className="text-xs text-muted-foreground">
          {t("regeln.zielseitenHinweis")}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {seiten.map((s) => {
            const an = zielseiten.includes(s.slug);
            return (
              <button
                key={s.slug || "home"}
                type="button"
                onClick={() =>
                  setZielseiten(
                    an
                      ? zielseiten.filter((x) => x !== s.slug)
                      : [...zielseiten, s.slug],
                  )
                }
                className={
                  "rounded-full border px-3 py-1 text-xs transition " +
                  (an
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-secondary")
                }
              >
                {s.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Kampagnen-Parameter als Paare.
 *
 *  Bewusst als freie Paare und nicht als UTM-Formular mit drei festen Feldern:
 *  Duda hat beides, und das feste Formular kann genau die drei Google-Namen.
 *  Wer aus einer Mail mit `?aktion=fruehjahr` kommt, wäre damit ausgesperrt. */
function KampagnenFelder({
  parameter,
  setzen,
}: {
  parameter: Record<string, string>;
  setzen: (p: Record<string, string>) => void;
}) {
  const t = useTranslations("website");
  const paare = Object.entries(parameter);
  return (
    <div className="flex flex-col gap-2">
      {paare.map(([k, v], i) => (
        <div key={`${k}-${i}`} className="flex gap-2">
          <input
            value={k}
            onChange={(e) => {
              const neu: Record<string, string> = {};
              paare.forEach(([kk, vv], j) =>
                Object.assign(neu, { [j === i ? e.target.value : kk]: vv }),
              );
              setzen(neu);
            }}
            placeholder="utm_source"
            className="w-44 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={v}
            onChange={(e) => setzen({ ...parameter, [k]: e.target.value })}
            placeholder="newsletter"
            className="w-44 rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      ))}
      {paare.length < 5 ? (
        <button
          type="button"
          onClick={() => setzen({ ...parameter, "": "" })}
          className="self-start rounded-full border border-border px-3 py-1 text-xs transition hover:bg-secondary"
        >
          {t("regeln.parameterHinzufuegen")}
        </button>
      ) : null}
    </div>
  );
}

export function AktionsSchritt({
  art,
  setArt,
  aktion,
  setAktion,
  popups,
  sprachen,
}: {
  art: Art;
  setArt: (a: Art) => void;
  aktion: Record<string, unknown>;
  setAktion: (a: Record<string, unknown>) => void;
  popups: Array<{ id: string; title: string }>;
  sprachen: string[];
}) {
  const t = useTranslations("website");
  const setzeTeil = (teil: Record<string, unknown>) =>
    setAktion({ ...aktion, ...teil });
  const text = (aktion.text ?? {}) as Record<string, string>;
  const knopfText = (aktion.knopf_text ?? {}) as Record<string, string>;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {(["popup", "top_bar", "effect", "script"] as Art[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArt(a)}
            className={
              "rounded-2xl border px-3 py-3 text-sm transition " +
              (art === a
                ? "border-foreground bg-secondary"
                : "border-border hover:bg-secondary/40")
            }
          >
            {t(`regeln.aktion.${a}`)}
          </button>
        ))}
      </div>

      {art === "popup" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("regeln.welchesPopup")}</span>
            <select
              value={String(aktion.page_id ?? "")}
              onChange={(e) => setzeTeil({ page_id: e.target.value })}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("regeln.bitteWaehlen")}</option>
              {popups.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            {popups.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                {t("regeln.keinPopup")}
              </span>
            ) : null}
          </label>

          <div>
            <p className="text-sm font-medium">{t("regeln.position")}</p>
            {/* Das 3×3-Raster wie bei Duda. Eine Stelle im Fenster zeigt man,
                statt sie zu benennen — „unten rechts" in einer Auswahlliste
                muss man sich vorstellen, hier sieht man es. */}
            <div className="mt-2 grid w-28 grid-cols-3 gap-1 rounded-xl border border-border p-2">
              {POSITIONEN.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={t(`regeln.pos.${p}`)}
                  onClick={() => setzeTeil({ position: p })}
                  className={
                    "flex size-7 items-center justify-center rounded transition " +
                    (aktion.position === p
                      ? "bg-foreground"
                      : "hover:bg-secondary")
                  }
                >
                  <span
                    className={
                      "size-1.5 rounded-full " +
                      (aktion.position === p ? "bg-background" : "bg-muted-foreground")
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">{t("regeln.wannZeigen")}</legend>
            {(["sofort", "verzoegert", "verlassen", "scroll"] as const).map((z) => (
              <label key={z} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={(aktion.zeitpunkt ?? "sofort") === z}
                  onChange={() => setzeTeil({ zeitpunkt: z })}
                />
                {t(`regeln.zeitpunkt.${z}`)}
                {(z === "verzoegert" || z === "scroll") &&
                aktion.zeitpunkt === z ? (
                  <input
                    type="number"
                    min={1}
                    max={z === "scroll" ? 100 : 120}
                    value={Number(aktion.wert ?? (z === "scroll" ? 50 : 5))}
                    onChange={(e) => setzeTeil({ wert: Number(e.target.value) })}
                    className="w-20 rounded-xl border border-border bg-background px-2 py-1 text-sm"
                  />
                ) : null}
              </label>
            ))}
          </fieldset>
        </>
      ) : null}

      {art === "top_bar" ? (
        <>
          {sprachen.map((s) => (
            <label key={s} className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {s}
              </span>
              <input
                value={text[s] ?? ""}
                onChange={(e) => setzeTeil({ text: { ...text, [s]: e.target.value } })}
                placeholder={t("regeln.leistePlatzhalter")}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          ))}
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("regeln.knopfText")}</span>
              <input
                value={knopfText[sprachen[0] ?? "de"] ?? ""}
                onChange={(e) =>
                  setzeTeil({
                    knopf_text: { ...knopfText, [sprachen[0] ?? "de"]: e.target.value },
                  })
                }
                className="w-48 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{t("regeln.knopfZiel")}</span>
              <input
                value={String(aktion.knopf_url ?? "")}
                onChange={(e) => setzeTeil({ knopf_url: e.target.value })}
                placeholder="/angebote"
                className="w-64 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-2 text-sm">
              {t("regeln.hintergrund")}
              <input
                type="color"
                value={String(aktion.hintergrund ?? "#111827")}
                onChange={(e) => setzeTeil({ hintergrund: e.target.value })}
                className="size-9 rounded border border-border"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              {t("regeln.schriftfarbe")}
              <input
                type="color"
                value={String(aktion.schrift ?? "#ffffff")}
                onChange={(e) => setzeTeil({ schrift: e.target.value })}
                className="size-9 rounded border border-border"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={aktion.schliessbar !== false}
                onChange={(e) => setzeTeil({ schliessbar: e.target.checked })}
              />
              {t("regeln.schliessbar")}
            </label>
          </div>
        </>
      ) : null}

      {art === "effect" ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            {EFFEKTE.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setzeTeil({ effekt: e })}
                className={
                  "rounded-2xl border px-3 py-3 text-sm transition " +
                  (aktion.effekt === e
                    ? "border-foreground bg-secondary"
                    : "border-border hover:bg-secondary/40")
                }
              >
                {t(`regeln.effekt.${e}`)}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm">
            {t("regeln.dauer")}
            <input
              type="number"
              min={0}
              max={120}
              value={Number(aktion.dauer_sekunden ?? 15)}
              onChange={(e) => setzeTeil({ dauer_sekunden: Number(e.target.value) })}
              className="w-24 rounded-xl border border-border bg-background px-2 py-1 text-sm"
            />
            <span className="text-xs text-muted-foreground">
              {t("regeln.dauerHinweis")}
            </span>
          </label>
        </>
      ) : null}

      {art === "script" ? (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("regeln.eigenerCode")}</span>
          {/* Der Warnsatz steht ÜBER dem Feld, nicht darunter: er soll gelesen
              werden, bevor jemand etwas einfügt. */}
          <span className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground">
            {t("regeln.codeWarnung")}
          </span>
          <textarea
            value={String(aktion.code ?? "")}
            onChange={(e) => setzeTeil({ code: e.target.value })}
            rows={10}
            maxLength={20000}
            spellCheck={false}
            className="rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs"
          />
        </label>
      ) : null}
    </div>
  );
}
