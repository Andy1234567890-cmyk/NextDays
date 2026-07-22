// ApiError als eigener Nicht-"use server"-Export. In einer "use server"-Datei
// dürfen NUR async Funktionen exportiert werden (Next.js-Regel) — eine Klasse
// gehört daher hierher. Client- und server-sicher (keine Next-Runtime-Imports).

/** Fehler eines Backend-Calls mit HTTP-Status (fürs Flow-Mapping in der App). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
