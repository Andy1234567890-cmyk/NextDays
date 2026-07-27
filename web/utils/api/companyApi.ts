/**
 * API-Helfer für den Buchhaltungs-Bestand (Kunden).
 *
 * HINTERGRUND: Diese Datei stammt aus der Firebase-Ära und rief Routen unter
 * `/api/companies/<uid>/...` sowie `/api/v1/categories` auf — KEINE davon
 * existiert im NextDays-Backend (gegen die OpenAPI-Spec geprüft), jeder Aufruf
 * lief zur Laufzeit in einen 404. Übrig bleibt die eine Funktion mit echtem
 * Gegenstück, jetzt über `apiClient` (Endpoint-Mapping auf den
 * `buchhaltung`-Slice; der Bearer kommt serverseitig aus dem httpOnly-Cookie).
 */

import { apiClient } from '@/lib/api-client';

export type CustomerCreated = {
  id: string;
};

/**
 * Kunde anlegen. Wirft bei Fehlern (inkl. 409 Duplikat) — der Aufrufer
 * entscheidet, wie er das anzeigt.
 */
export async function createCustomer(customerData: unknown): Promise<CustomerCreated> {
  return apiClient<CustomerCreated>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(customerData),
  });
}
