"use client";

// Mittel- und rechte Spalte der API-Referenz: Parameter-Eingaben und
// Code-Panel, mit GETEILTEM Zustand.
//
// Referenz-UX: docs.lodgify.com/reference/* (live 22.08.2026). Dort ändert eine
// Eingabe im Parameter-Feld sofort den curl-Befehl rechts, und „Try It!" schickt
// genau diesen Aufruf ab. Genau das ist der Grund, warum beide Spalten EINE
// Komponente sind: zwei getrennte Komponenten müssten ihren Zustand über einen
// Umweg teilen, und dann driftet der angezeigte Befehl vom abgeschickten.
//
// Was NICHT hier liegt: der Schema-Baum für Körper und Antwort. Der kommt als
// `children` server-gerendert herein — so bleibt die 120 kB große Spec auf dem
// Server, und die Felderliste ist auch ohne JavaScript lesbar.
import { useMemo, useState } from "react";

import { Prosa } from "@/components/entwickler/doku";
import { SPRACH_LOGOS } from "@/components/entwickler/sprach-logos";
import { Icon } from "@/components/ui/icon";
import {
  SPRACHEN,
  type Eingaben,
  type SpracheId,
  anfrageDaten,
  antwortBeispiel,
  codeBeispiel,
} from "@/lib/api-codebeispiele";
import {
  erlaubteWerte,
  standardWert,
  typName,
} from "@/lib/openapi";

import type { Endpunkt } from "@/lib/openapi";

export type KonsoleLabels = {
  pfadParameter: string;
  queryParameter: string;
  headerParameter: string;
  koerper: string;
  antworten: string;
  erlaubt: string;
  pflicht: string;
  standard: string;
  sprache: string;
  zugang: string;
  tokenHinweis: string;
  ausprobieren: string;
  laeuft: string;
  anfrage: string;
  antwort: string;
  beispiel: string;
  kopieren: string;
  kopiert: string;
  fehlerNetz: string;
  keinToken: string;
};

type Antwortstand = {
  status: number | null;
  text: string;
  dauerMs: number;
};

function Feldzeile({
  name,
  typ,
  pflicht,
  beschreibung,
  erlaubt,
  standard,
  wert,
  onChange,
  labels,
}: {
  name: string;
  typ: string;
  pflicht: boolean;
  beschreibung?: string;
  erlaubt: string[];
  standard?: string;
  wert: string;
  onChange: (w: string) => void;
  labels: KonsoleLabels;
}) {
  return (
    <div className="grid gap-3 border-b border-border py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_11rem]">
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <code className="font-mono text-sm font-semibold">{name}</code>
          <span className="font-mono text-xs text-muted-foreground">{typ}</span>
          {pflicht ? (
            <span className="font-mono text-[0.6875rem] font-semibold text-destructive">
              {labels.pflicht}
            </span>
          ) : null}
          {standard !== undefined ? (
            <span className="text-xs text-muted-foreground">
              {labels.standard} {standard}
            </span>
          ) : null}
        </div>
        {beschreibung ? (
          <p className="mt-1 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
            <Prosa>{beschreibung}</Prosa>
          </p>
        ) : null}
        {erlaubt.length ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">{labels.erlaubt}</span>
            {erlaubt.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => onChange(w)}
                className="rounded bg-surface-warm px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground transition-colors hover:bg-surface-accent hover:text-accent"
              >
                {w}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Eingabefeld rechts neben der Beschreibung — wie bei ReadMe. Eine
          Auswahlliste, wo die Spec Werte kennt: dann muss niemand abtippen. */}
      <div className="sm:pt-0.5">
        {erlaubt.length ? (
          <select
            value={wert}
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs outline-none focus:border-accent"
          >
            <option value="">—</option>
            {erlaubt.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={wert}
            onChange={(e) => onChange(e.target.value)}
            placeholder={standard ?? ""}
            className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 font-mono text-xs outline-none placeholder:text-muted-foreground/60 focus:border-accent"
          />
        )}
      </div>
    </div>
  );
}

export function RefKonsole({
  endpunkt,
  basis,
  labels,
  kopf,
  children,
}: {
  endpunkt: Endpunkt;
  basis: string;
  labels: KonsoleLabels;
  /** Titel, Adresse und Beschreibung — server-gerendert, linke Spalte. */
  kopf?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [eingaben, setEingaben] = useState<Eingaben>({});
  const [token, setToken] = useState("");
  const [sprache, setSprache] = useState<SpracheId>("shell");
  const [gewaehlterCode, setGewaehlterCode] = useState(
    endpunkt.antworten[0]?.code ?? "200",
  );
  const [antwort, setAntwort] = useState<Antwortstand | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [kopiert, setKopiert] = useState(false);

  const setzen = (name: string, wert: string) =>
    setEingaben((alt) => ({ ...alt, [name]: wert }));

  const code = useMemo(
    () => codeBeispiel(endpunkt, sprache, basis, eingaben, token),
    [endpunkt, sprache, basis, eingaben, token],
  );

  const pfadParams = endpunkt.parameter.filter((p) => p.in === "path");
  const queryParams = endpunkt.parameter.filter((p) => p.in === "query");
  const headerParams = endpunkt.parameter.filter(
    (p) => p.in === "header" && p.name.toLowerCase() !== "authorization",
  );

  async function ausprobieren() {
    setLaeuft(true);
    setAntwort(null);
    const start = Date.now();
    const { url, init } = anfrageDaten(endpunkt, basis, eingaben, token);
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let schoen = text;
      try {
        schoen = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // Keine JSON-Antwort (z. B. ein Proxy-Fehler als HTML). Dann den
        // Rohtext zeigen, statt einen Parse-Fehler auszugeben — der Leser will
        // sehen, was zurückkam.
      }
      setAntwort({ status: res.status, text: schoen, dauerMs: Date.now() - start });
    } catch (fehler) {
      // Netzfehler oder CORS. Bewusst mit der echten Meldung: „hat nicht
      // geklappt" würde die Ursache verbergen, und die häufigste ist ein
      // fehlendes CORS-Recht oder eine Adresse, die nicht antwortet.
      setAntwort({
        status: null,
        text: `${labels.fehlerNetz}\n\n${fehler instanceof Error ? fehler.message : String(fehler)}`,
        dauerMs: Date.now() - start,
      });
    } finally {
      setLaeuft(false);
    }
  }

  async function kopieren() {
    try {
      await navigator.clipboard.writeText(code);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      setKopiert(false);
    }
  }

  const angezeigteAntwort = antwort
    ? antwort.text
    : antwortBeispiel(endpunkt, gewaehlterCode);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_26rem] xl:gap-10">
      {/* ── Mitte: Kopf, Parameter und Schemas ───────────────────────── */}
      <div className="min-w-0">
        {kopf}
        {pfadParams.length ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {labels.pfadParameter}
            </h2>
            <div className="mt-2">
              {pfadParams.map((p) => (
                <Feldzeile
                  key={p.name}
                  name={p.name}
                  typ={typName(p.schema)}
                  pflicht={Boolean(p.required)}
                  beschreibung={p.description}
                  erlaubt={[]}
                  wert={eingaben[p.name] ?? ""}
                  onChange={(w) => setzen(p.name, w)}
                  labels={labels}
                />
              ))}
            </div>
          </section>
        ) : null}

        {queryParams.length ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {labels.queryParameter}
            </h2>
            <div className="mt-2">
              {queryParams.map((p) => (
                <Feldzeile
                  key={p.name}
                  name={p.name}
                  typ={typName(p.schema)}
                  pflicht={Boolean(p.required)}
                  beschreibung={p.description}
                  erlaubt={erlaubteWerte(p.schema)}
                  standard={standardWert(p.schema)}
                  wert={eingaben[p.name] ?? ""}
                  onChange={(w) => setzen(p.name, w)}
                  labels={labels}
                />
              ))}
            </div>
          </section>
        ) : null}

        {headerParams.length ? (
          <section className="mt-8">
            <h2 className="font-display text-lg font-semibold">
              {labels.headerParameter}
            </h2>
            <div className="mt-2">
              {headerParams.map((p) => (
                <Feldzeile
                  key={p.name}
                  name={p.name}
                  typ={typName(p.schema)}
                  pflicht={Boolean(p.required)}
                  beschreibung={p.description}
                  erlaubt={[]}
                  wert={eingaben[p.name] ?? ""}
                  onChange={(w) => setzen(p.name, w)}
                  labels={labels}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* Körper und Antworten kommen server-gerendert herein. */}
        {children}
      </div>

      {/* ── Rechts: Sprache, Zugang, Code, Ausprobieren, Antwort ──────── */}
      <div className="xl:sticky xl:top-20 xl:self-start">
        <div className="overflow-hidden rounded-2xl bg-primary text-primary-foreground">
          {/* Sprachwahl — mit den echten Logos der Sprachen, wie bei ReadMe.
              Ein eingefärbtes Logo wäre nicht mehr das Logo (siehe
              `sprach-logos.ts`), deshalb bleiben sie mehrfarbig. */}
          <div className="border-b border-primary-foreground/15 px-4 py-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-foreground/50">
              {labels.sprache}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {SPRACHEN.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSprache(s.id)}
                  className={
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors " +
                    (sprache === s.id
                      ? "bg-primary-foreground/15 font-medium text-primary-foreground"
                      : "text-primary-foreground/60 hover:bg-primary-foreground/10")
                  }
                >
                  <SprachLogoBild sprache={s.id} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Zugang */}
          <div className="border-b border-primary-foreground/15 px-4 py-3">
            <label className="block">
              <span className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primary-foreground/50">
                {labels.zugang}
              </span>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Bearer-Token"
                autoComplete="off"
                className="mt-1.5 w-full rounded-lg border border-primary-foreground/25 bg-primary-foreground/5 px-2.5 py-1.5 font-mono text-xs text-primary-foreground outline-none placeholder:text-primary-foreground/40 focus:border-accent"
              />
            </label>
            <p className="mt-1.5 text-[0.6875rem] leading-relaxed text-primary-foreground/50">
              {labels.tokenHinweis}
            </p>
          </div>

          {/* Code */}
          <div>
            <div className="flex items-center justify-between gap-3 border-b border-primary-foreground/15 px-4 py-2">
              <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-primary-foreground/60">
                {labels.anfrage}
              </span>
              <button
                type="button"
                onClick={kopieren}
                className="flex items-center gap-1.5 rounded-full border border-primary-foreground/25 px-2.5 py-1 text-[0.6875rem] transition-colors hover:bg-primary-foreground/10"
              >
                <Icon
                  icon={kopiert ? "ph:check-bold" : "ph:share-network"}
                  className="size-3"
                />
                {kopiert ? labels.kopiert : labels.kopieren}
              </button>
            </div>
            <pre className="max-h-72 overflow-auto px-4 py-3 text-[0.75rem] leading-relaxed">
              <code className="font-mono">{code}</code>
            </pre>
            <div className="border-t border-primary-foreground/15 px-4 py-3">
              <button
                type="button"
                onClick={ausprobieren}
                disabled={laeuft}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Icon
                  icon={laeuft ? "ph:hourglass-high" : "ph:play-circle"}
                  className="size-4"
                />
                {laeuft ? labels.laeuft : labels.ausprobieren}
              </button>
              {!token ? (
                <p className="mt-2 text-center text-[0.6875rem] text-primary-foreground/60">
                  {labels.keinToken}
                </p>
              ) : null}
            </div>
          </div>

          {/* Antwort */}
          <div>
            <div className="flex items-center justify-between gap-3 border-t border-primary-foreground/15 px-4 py-2">
              <div className="flex items-center gap-2">
                {antwort ? (
                  <span
                    className={
                      "rounded px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold " +
                      (antwort.status && antwort.status < 400
                        ? "bg-success/20 text-success"
                        : "bg-destructive/20 text-destructive")
                    }
                  >
                    {antwort.status ?? "—"}
                  </span>
                ) : (
                  <select
                    value={gewaehlterCode}
                    onChange={(e) => setGewaehlterCode(e.target.value)}
                    className="rounded border border-primary-foreground/25 bg-transparent px-1.5 py-0.5 font-mono text-[0.6875rem]"
                  >
                    {endpunkt.antworten.map((a) => (
                      <option key={a.code} value={a.code} className="text-foreground">
                        {a.code}
                      </option>
                    ))}
                  </select>
                )}
                <span className="font-mono text-[0.6875rem] uppercase tracking-wide text-primary-foreground/60">
                  {antwort ? labels.antwort : labels.beispiel}
                </span>
              </div>
              {antwort ? (
                <span className="font-mono text-[0.6875rem] text-primary-foreground/50">
                  {antwort.dauerMs} ms
                </span>
              ) : null}
            </div>
            <pre className="max-h-80 overflow-auto px-4 py-3 text-[0.75rem] leading-relaxed">
              <code className="font-mono">{angezeigteAntwort}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function SprachLogoBild({ sprache }: { sprache: string }) {
  const logo = SPRACH_LOGOS[sprache];
  if (!logo) return null;
  return (
    <svg
      viewBox={logo.viewBox}
      aria-hidden="true"
      className="size-3.5 shrink-0"
      dangerouslySetInnerHTML={{ __html: logo.body }}
    />
  );
}
