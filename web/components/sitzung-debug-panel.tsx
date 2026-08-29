"use client";

// Sichtbares Sitzungs-Debugging: zeigt permanent, WELCHER BETRIEB gerade
// angemeldet ist — und ob der Server dieselbe Auskunft gibt wie das Cookie.
//
// ANLASS (29.08.2026): Im Onboarding eines frisch angelegten Betriebs standen
// die 18 Objekte eines FREMDEN Betriebs in der Objektauswahl. Vier Erklärungen
// wurden gebaut und wieder verworfen (Backend-Scope, Next-Cache, Modul-State,
// DB-Policy) — alle vier falsch. Die Wahrheit war eine einzige Zahl, die
// nirgends abzulesen war:
//
//     Token mit tenant_id = AirSmil   → GET /properties → total = 18
//     Token mit tenant_id = UI-Test   → GET /properties → total =  1
//
// Das Backend war nie das Problem; der Browser schickte das Token eines
// anderen Betriebs. Sehen konnte das niemand: die Sitzungs-Cookies sind
// `httpOnly` (kein JS-Zugriff), sie heißen bei JEDEM Konto gleich
// (`nd_access`/`nd_refresh`, host-only), und keine Oberfläche nannte je den
// laufenden Betrieb. Ein Fehler, dessen Ursache man nicht ablesen kann, wird
// geraten — und Raten kostete hier Stunden.
//
// DIE AMPEL IST DER BEFUND, nicht die Deko:
//   grün  = Cookie-Betrieb == Backend-Betrieb, alles stimmig
//   rot   = beide nennen VERSCHIEDENE Betriebe → die Sitzung ist nicht die,
//           für die der Browser sie hält (der eigentliche Fehlerfall)
//   gelb  = Access-Cookie weg, Refresh-Cookie da → die Middleware erneuert bei
//           der nächsten Navigation ungefragt DIE SITZUNG DIESES REFRESH-
//           TOKENS. Genau hier springt ein Betrieb um, ohne dass jemand etwas
//           tut, und genau deshalb hilft Neuladen nicht: das Neuladen IST der
//           Auslöser.
//   grau  = abgemeldet
//
// Nur Entwicklung/Staging: das Panel nennt Tenant- und Nutzer-IDs im Klartext.
// Das Layout schaltet es in Produktion ab — dieselbe Regel wie beim
// RealtimeDebugPanel nebenan.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState } from "react";

interface Identitaet {
  userId: string | null;
  email: string | null;
  tenantId: string | null;
  rolle: string | null;
  aal: string | null;
  laeuftAb: string | null;
  abgelaufen: boolean;
  restSekunden: number | null;
  vorhanden: boolean;
}

interface Lage {
  zustand: string;
  hinweis?: string;
  cookie?: {
    access: Identitaet;
    refreshVorhanden: boolean;
    erneuerungSteht: boolean;
    accessKennung?: string;
  };
  backend?: { status: number; antwort: unknown };
  objekte?: {
    total?: number | null;
    tenantsInDerAntwort?: string[];
    fremdeObjekte?: boolean;
    fehler?: unknown;
  };
}

type Ton = "green" | "amber" | "red" | "gray";

/** Die Ampel. Reihenfolge ist Absicht: der SCHLIMMSTE Zustand gewinnt, damit
 *  ein echter Mandantenbruch nie hinter einem harmloseren Hinweis verschwindet. */
function ton(l: Lage | null): Ton {
  if (!l) return "gray";
  if (l.zustand === "abgemeldet") return "gray";
  if (l.objekte?.fremdeObjekte) return "red";
  if (l.cookie?.erneuerungSteht) return "amber";
  if (!l.cookie?.access.vorhanden) return "gray";
  const backendTenant = backendTenantLesen(l.backend?.antwort);
  if (backendTenant && l.cookie.access.tenantId && backendTenant !== l.cookie.access.tenantId) {
    return "red";
  }
  if (l.cookie.access.abgelaufen) return "amber";
  return "green";
}

/** Der Betrieb, den das BACKEND nach Signaturprüfung sieht. Die Antwortform von
 *  `/auth/session` ist nicht garantiert — deshalb defensiv über mehrere
 *  bekannte Feldnamen, statt eine Gestalt zu erfinden (Wurzel 4: lieber `null`
 *  als ein plausibler Ersatzwert). */
function backendTenantLesen(antwort: unknown): string | null {
  if (!antwort || typeof antwort !== "object") return null;
  const o = antwort as Record<string, unknown>;
  const kandidaten = [o.tenant_id, o.tenantId, (o.tenant as Record<string, unknown>)?.id];
  for (const k of kandidaten) if (typeof k === "string" && k) return k;
  return null;
}

const FARBEN: Record<Ton, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-600",
  gray: "bg-zinc-400",
};

export function SitzungDebugPanel() {
  const [lage, setLage] = useState<Lage | null>(null);
  const [offen, setOffen] = useState(false);
  const [, setLetzteKennung] = useState<string | null>(null);
  // Wechselt die Token-Kennung zwischen zwei Abfragen, hat etwas die Sitzung
  // ERNEUERT, ohne dass der Nutzer sich angemeldet hat. Das ist der Fingerabdruck
  // der stillen Middleware-Erneuerung — ohne diesen Zähler bliebe sie unsichtbar,
  // weil das Ergebnis danach wieder „normal" aussieht.
  const [wechsel, setWechsel] = useState(0);

  // Abgemeldet? Dann gibt es nichts mehr zu holen — der Takt haelt an.
  // Vorher lief er stur weiter und schrieb im 10-Sekunden-Rhythmus 401er ins
  // Serverlog, in dem man danach die echten Zeilen suchen musste. Ein
  // Diagnosewerkzeug, das das Log zumuellt, macht die Diagnose schwerer
  // (beobachtet 29.08.2026).
  const [abgemeldet, setAbgemeldet] = useState(false);

  const laden = useCallback(async () => {
    try {
      const r = await fetch("/api/sitzung-debug", { cache: "no-store" });
      if (r.status === 401) {
        setAbgemeldet(true);
        setLage(null);
        return;
      }
      setAbgemeldet(false);
      const d = (await r.json()) as Lage;
      setLage(d);
      const k = d.cookie?.accessKennung ?? null;
      setLetzteKennung((vorher) => {
        if (vorher && k && vorher !== k) setWechsel((n) => n + 1);
        return k ?? vorher;
      });
    } catch {
      // Die Diagnose darf nie die Seite stören: keine Anzeige ist besser als
      // ein Fehler-Overlay über der eigentlichen Arbeit (Wurzel 5).
    }
  }, []);

  useEffect(() => {
    void laden();
    // Ohne Sitzung kein Takt: eine Anmeldung laedt die Seite ohnehin neu, und
    // dann laeuft der Effekt wieder an.
    if (abgemeldet) return;
    // Alle 10 s: kurz genug, um einen Token-Wechsel zu erwischen (Access-Token
    // hält typischerweise eine Stunde, die Erneuerung passiert bei Navigation),
    // lang genug, um im Netzwerk-Tab nicht zu stören.
    const t = setInterval(() => void laden(), 10_000);
    return () => clearInterval(t);
  }, [laden, abgemeldet]);

  const t = ton(lage);
  const cookieTenant = lage?.cookie?.access.tenantId ?? null;
  const backendTenant = backendTenantLesen(lage?.backend?.antwort);
  const kurz = (v: string | null) => (v ? v.slice(0, 8) : "—");

  return (
    <div className="fixed bottom-3 left-3 z-[9999] font-mono text-[11px]">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-black/10 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur dark:border-white/15 dark:bg-zinc-900/95"
      >
        <span className={`size-2.5 rounded-full ${FARBEN[t]}`} />
        <span className="font-semibold">
          {cookieTenant ? `Betrieb ${kurz(cookieTenant)}` : "abgemeldet"}
        </span>
        {lage?.objekte?.total !== undefined && lage.objekte.total !== null && (
          <span className="text-zinc-500">· {lage.objekte.total} Objekte</span>
        )}
        <Icon icon={offen ? "ph:caret-down" : "ph:caret-up"} className="size-3" />
      </button>

      {offen && (
        <div className="mt-2 max-h-[70vh] w-[26rem] overflow-y-auto rounded-xl border border-black/10 bg-white/98 p-3 shadow-2xl backdrop-blur dark:border-white/15 dark:bg-zinc-900/98">
          <p className="mb-2 font-semibold">Sitzung</p>

          {t === "red" && (
            <p className="mb-2 rounded-lg bg-red-50 p-2 text-red-800 dark:bg-red-950/50 dark:text-red-200">
              <strong>Mandantenbruch.</strong> Cookie und Server nennen
              verschiedene Betriebe, oder die Antwort enthält Objekte eines
              fremden Betriebs.
            </p>
          )}
          {t === "amber" && lage?.cookie?.erneuerungSteht && (
            <p className="mb-2 rounded-lg bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
              <strong>Stille Erneuerung steht an.</strong> Access-Cookie ist
              weg, Refresh-Cookie liegt vor: die nächste Navigation belebt die
              Sitzung dieses Refresh-Tokens wieder — nicht zwingend die, die du
              erwartest.
            </p>
          )}

          <Zeile k="Cookie-Betrieb" v={cookieTenant ?? "—"} />
          <Zeile k="Server-Betrieb" v={backendTenant ?? "—"} warn={!!backendTenant && !!cookieTenant && backendTenant !== cookieTenant} />
          <Zeile k="Nutzer" v={lage?.cookie?.access.userId ?? "—"} />
          <Zeile k="E-Mail" v={lage?.cookie?.access.email ?? "—"} />
          <Zeile k="Rolle (Token)" v={lage?.cookie?.access.rolle ?? "—"} />
          <Zeile k="2FA-Stufe" v={lage?.cookie?.access.aal ?? "—"} />
          <Zeile
            k="Token läuft ab"
            v={
              lage?.cookie?.access.abgelaufen
                ? "ABGELAUFEN"
                : lage?.cookie?.access.restSekunden != null
                  ? `in ${lage.cookie.access.restSekunden}s`
                  : "—"
            }
            warn={lage?.cookie?.access.abgelaufen}
          />
          <Zeile k="Refresh-Cookie" v={lage?.cookie?.refreshVorhanden ? "vorhanden" : "fehlt"} />
          <Zeile k="Token-Kennung" v={lage?.cookie?.accessKennung ?? "—"} />
          <Zeile k="Token-Wechsel" v={String(wechsel)} warn={wechsel > 0} />
          <Zeile k="Backend-Status" v={String(lage?.backend?.status ?? "—")} />
          <Zeile k="Objekte in Antwort" v={String(lage?.objekte?.total ?? "—")} />
          <Zeile
            k="Betriebe in Antwort"
            v={(lage?.objekte?.tenantsInDerAntwort ?? []).map(kurz).join(", ") || "—"}
            warn={lage?.objekte?.fremdeObjekte}
          />

          <button
            type="button"
            onClick={() => void laden()}
            className="mt-3 w-full rounded-lg border border-black/10 px-2 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Jetzt neu messen
          </button>
        </div>
      )}
    </div>
  );
}

function Zeile({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-black/5 py-1 last:border-0 dark:border-white/10">
      <span className="shrink-0 text-zinc-500">{k}</span>
      <span className={`truncate text-right ${warn ? "font-bold text-red-600" : ""}`}>
        {v}
      </span>
    </div>
  );
}
