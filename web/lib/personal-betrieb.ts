"use server";

// Betriebs-Ausbau des Personalbereichs (Paket F2): Server-Actions gegen den
// FastAPI-Slice (/api/v1/personal) fuer Zeit-Listen, Ueberstunden, Guttage,
// Terminals, terminierte Akte-Aenderungen, Abwesenheits-Vorschau sowie
// Produktivitaet, Budget, Umsatzbuch und Bedarfsvorlagen.
//
// Business-Logik bleibt im Backend; hier nur die Aufrufe. Typen und Helfer
// liegen in `personal-betrieb-typen.ts` (ohne "use server" — ein
// Server-Action-Modul darf NUR async functions exportieren).
//
// `personal.ts` gehoert niemandem (Vertrag §0) und bleibt unangetastet; die
// vorhandenen Funktionen (getOffeneZeit, zeitStart, zeitPause, zeitEnde,
// getRegeln, regelnBestaetigen, listZeiten, …) werden weiterverwendet, nicht
// kopiert. Nur was der Vertrag NEU einfuehrt, steht hier.
import { ApiError, api } from "@/lib/api";
import type {
  AbwesenheitVorschau,
  AkteAenderung,
  AkteAenderungInput,
  BedarfDaten,
  BedarfZeile,
  BudgetDaten,
  BudgetZeile,
  Guttage,
  GuttageInput,
  ProduktivitaetZeile,
  RegelnSetPlus,
  RegelnVoll,
  Terminal,
  TerminalMitToken,
  Ueberstundenantrag,
  UeberstundenInput,
  UmsatzbuchInput,
  UmsatzbuchZeile,
  VorschauRequest,
  ZeitUnbestaetigt,
  ZeitZusammenfassung,
} from "@/lib/personal-betrieb-typen";
import type { Result } from "@/lib/personal-typen";
import { currentToken } from "@/lib/session-token";

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    if (exc instanceof ApiError) {
      return { ok: false, error: exc.message, status: exc.status, details: exc.details };
    }
    return { ok: false, error: "Aktion fehlgeschlagen." };
  }
}

const q = (params: Record<string, string | number | boolean | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

// --- §1.1 Regeln mit den neuen Feldern ---------------------------------------

/**
 * Regeln inklusive der Felder aus 0544/0545.
 *
 * Eigener Aufruf statt `getRegeln()` aus `personal.ts`, weil dort der
 * Rueckgabetyp die neuen Felder nicht kennt — dieselbe Route, weitere Form.
 */
export async function getRegelnVoll(): Promise<Result<RegelnVoll | null>> {
  return call("/personal/regeln");
}

/** Regeln bestaetigen — mit den neuen Feldern (§1.1). */
export async function regelnSpeichern(body: RegelnSetPlus): Promise<Result<RegelnVoll>> {
  return call("/personal/regeln", { method: "PUT", body });
}

// --- §1.5 Abwesenheits-Vorschau ----------------------------------------------

/** Live-Zaehler des Antrags: Tage, Rest, Sperre, Schichten, Kollegen (§1.4). */
export async function abwesenheitVorschau(
  body: VorschauRequest,
): Promise<Result<AbwesenheitVorschau>> {
  return call("/personal/abwesenheiten/vorschau", { method: "POST", body });
}

// --- §3.4 Zeit-Listen --------------------------------------------------------

export async function getZeitZusammenfassung(
  von: string,
  bis: string,
): Promise<Result<ZeitZusammenfassung[]>> {
  return call(`/personal/zeiterfassung/zusammenfassung${q({ von, bis })}`);
}

export async function getZeitUnbestaetigt(): Promise<Result<ZeitUnbestaetigt[]>> {
  return call("/personal/zeiterfassung/unbestaetigt");
}

// --- §3.5 Ueberstunden -------------------------------------------------------

export async function ueberstundenBeantragen(
  body: UeberstundenInput,
): Promise<Result<Ueberstundenantrag>> {
  return call("/personal/ueberstunden", { method: "POST", body });
}

export async function listUeberstunden(
  von?: string,
  bis?: string,
  status?: string,
): Promise<Result<Ueberstundenantrag[]>> {
  return call(`/personal/ueberstunden${q({ von, bis, status })}`);
}

export async function ueberstundenEntscheiden(
  id: string,
  genehmigen: boolean,
  kommentar?: string,
): Promise<Result<Ueberstundenantrag>> {
  return call(`/personal/ueberstunden/${encodeURIComponent(id)}/entscheiden`, {
    method: "POST",
    body: { genehmigen, kommentar: kommentar?.trim() || null },
  });
}

// --- §3.5 Guttage ------------------------------------------------------------

export async function getGuttage(userId: string): Promise<Result<Guttage>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/guttage`);
}

export async function guttageBuchen(body: GuttageInput): Promise<Result<Guttage>> {
  return call("/personal/guttage", { method: "POST", body });
}

// --- §3.1 Akte: Terminal-Zugang und terminierte Aenderungen ------------------

export async function terminalZugangSetzen(
  userId: string,
  body: { stempel_id?: string | null; pin: string },
): Promise<Result<{ stempel_id: string }>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/terminal-zugang`, {
    method: "POST",
    body: { stempel_id: body.stempel_id?.trim() || null, pin: body.pin },
  });
}

export async function terminalZugangEntfernen(userId: string): Promise<Result<void>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/terminal-zugang`, {
    method: "DELETE",
  });
}

export async function listAkteAenderungen(userId: string): Promise<Result<AkteAenderung[]>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/aenderungen`);
}

export async function createAkteAenderung(
  userId: string,
  body: AkteAenderungInput,
): Promise<Result<AkteAenderung>> {
  return call(`/personal/mitarbeiter/${encodeURIComponent(userId)}/aenderungen`, {
    method: "POST",
    body,
  });
}

export async function deleteAkteAenderung(id: string): Promise<Result<void>> {
  return call(`/personal/kartei/aenderungen/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- §3.2 Terminals (Verwaltung, mit Nutzer-JWT) -----------------------------

export async function listTerminals(): Promise<Result<Terminal[]>> {
  return call("/personal/terminals");
}

export async function createTerminal(body: {
  name: string;
  property_id?: string | null;
}): Promise<Result<TerminalMitToken>> {
  return call("/personal/terminals", {
    method: "POST",
    body: { name: body.name, property_id: body.property_id || null },
  });
}

export async function updateTerminal(
  id: string,
  body: { name?: string; aktiv?: boolean; property_id?: string | null },
): Promise<Result<Terminal>> {
  return call(`/personal/terminals/${encodeURIComponent(id)}`, { method: "PATCH", body });
}

export async function terminalTokenRotieren(id: string): Promise<Result<TerminalMitToken>> {
  return call(`/personal/terminals/${encodeURIComponent(id)}/token`, { method: "POST" });
}

export async function deleteTerminal(id: string): Promise<Result<void>> {
  return call(`/personal/terminals/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// --- §2.2 Produktivitaet -----------------------------------------------------

export async function getProduktivitaet(): Promise<Result<ProduktivitaetZeile[]>> {
  return call("/personal/produktivitaet");
}

export async function setProduktivitaet(
  zeilen: ProduktivitaetZeile[],
): Promise<Result<ProduktivitaetZeile[]>> {
  return call("/personal/produktivitaet", { method: "PUT", body: zeilen });
}

// --- §2.2 Budget -------------------------------------------------------------

export async function getBudget(von: string, bis: string): Promise<Result<BudgetDaten>> {
  return call(`/personal/budget${q({ von, bis })}`);
}

export async function setBudgetVorlagen(zeilen: BudgetZeile[]): Promise<Result<BudgetZeile[]>> {
  return call("/personal/budget/vorlagen", { method: "PUT", body: zeilen });
}

export async function setBudgetTage(
  von: string,
  bis: string,
  zeilen: BudgetZeile[],
): Promise<Result<BudgetZeile[]>> {
  return call(`/personal/budget/tage${q({ von, bis })}`, { method: "PUT", body: zeilen });
}

// --- §2.2 Umsatzbuch ---------------------------------------------------------

export async function getUmsatzbuch(von: string, bis: string): Promise<Result<UmsatzbuchZeile[]>> {
  return call(`/personal/umsatzbuch${q({ von, bis })}`);
}

export async function setUmsatzbuch(
  zeilen: UmsatzbuchInput[],
): Promise<Result<UmsatzbuchZeile[]>> {
  return call("/personal/umsatzbuch", { method: "PUT", body: zeilen });
}

// --- §2.2 Bedarf (Einstellungen pflegen die Wochentag-Vorlagen) --------------

export async function getBedarf(von: string, bis: string): Promise<Result<BedarfDaten>> {
  return call(`/personal/bedarf${q({ von, bis })}`);
}

export async function setBedarfVorlagen(zeilen: BedarfZeile[]): Promise<Result<BedarfZeile[]>> {
  return call("/personal/bedarf/vorlagen", { method: "PUT", body: zeilen });
}

export async function deleteBedarf(id: string): Promise<Result<void>> {
  return call(`/personal/bedarf/${encodeURIComponent(id)}`, { method: "DELETE" });
}
