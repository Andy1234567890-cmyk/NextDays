/**
 * finAPI-Umgebung (Sandbox vs. Produktion).
 *
 * BEWUSST OHNE CREDENTIALS: Hier standen zuvor `getFinApiCredentials` und
 * `buildFinApiAuthHeader`, die FINAPI_*_CLIENT_SECRET lasen und einen
 * Basic-Auth-Header bauten — beides gehört ins FastAPI-Backend, nicht in eine
 * Frontend-Bibliothek. Sie hatten keinen einzigen Aufrufer; einziger Nutzer
 * dieser Datei ist eine 'use client'-Komponente, die nur den Umgebungs-Schalter
 * braucht. Kommt eine echte finAPI-Anbindung, entsteht sie serverseitig.
 */

/**
 * Aktive finAPI-Umgebung. Ohne ausdrückliches 'production' immer Sandbox
 * (fail-safe: lieber gegen die Sandbox laufen als versehentlich gegen echte
 * Bankdaten).
 */
export function getFinAPICredentialType(): 'sandbox' | 'production' {
  const finapiEnv = process.env.FINAPI_ENVIRONMENT || process.env.NEXT_PUBLIC_FINAPI_ENVIRONMENT;
  return finapiEnv === 'production' ? 'production' : 'sandbox';
}
