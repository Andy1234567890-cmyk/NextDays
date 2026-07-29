// Gastgeber-Profil lesen (Airbnb „Über den Gastgeber"). EINE Struktur pro
// eingeloggtem Nutzer aus public.host_profiles, plus die abgeleiteten Felder
// full_name + hosting_since_year (aus public.users). Quelle: GET /host-profile.
import { api } from "./api-server";

export interface HostProfile {
  // Abgeleitet aus users (read-only im Editor). hosting_since = voller
  // ISO-Zeitstempel (created_at); das Frontend formatiert Monat/Jahr lokalisiert.
  full_name: string | null;
  hosting_since: string | null;

  // Editierbare Profilfelder (host_profiles).
  avatar_url: string | null;
  intro: string | null;
  work: string | null;
  dream_destination: string | null;
  spend_time_on: string | null;
  pets: string | null;
  decade_born: number | null;
  show_decade: boolean;
  school: string | null;
  useless_skill: string | null;
  favorite_song: string | null;
  fun_fact: string | null;
  languages: string[];
  obsessed_with: string | null;
  bio_title: string | null;
  // Anzeigetext des Wohnorts („Stadt, Land"); die strukturierten Bestandteile
  // aus der Places-Auswahl stehen in lives_in_* (nicht öffentlich im Profil).
  lives_in: string | null;
  lives_in_street: string | null;
  lives_in_house_number: string | null;
  lives_in_postal_code: string | null;
  lives_in_city: string | null;
  lives_in_country: string | null;
  lives_in_lat: number | null;
  lives_in_lng: number | null;
  show_travel_stamps: boolean;
  interests: string[];
}

// Leeres Profil als Fallback, falls das Laden fehlschlägt (z. B. Backend noch
// nicht neu gestartet). Der Editor bleibt so nutzbar; der Tab zeigt „Details
// hinzufügen" statt eines erfundenen Werts (Wurzel 4/5).
export const LEERES_PROFIL: HostProfile = {
  full_name: null,
  hosting_since: null,
  avatar_url: null,
  intro: null,
  work: null,
  dream_destination: null,
  spend_time_on: null,
  pets: null,
  decade_born: null,
  show_decade: false,
  school: null,
  useless_skill: null,
  favorite_song: null,
  fun_fact: null,
  languages: [],
  obsessed_with: null,
  bio_title: null,
  lives_in: null,
  lives_in_street: null,
  lives_in_house_number: null,
  lives_in_postal_code: null,
  lives_in_city: null,
  lives_in_country: null,
  lives_in_lat: null,
  lives_in_lng: null,
  show_travel_stamps: false,
  interests: [],
};

/** Profil des eingeloggten Nutzers (leeres Profil, falls noch keins). */
export async function getHostProfile(): Promise<HostProfile> {
  return api<HostProfile>("/host-profile");
}

/**
 * Profilfoto hochladen (Client → BFF-Route → FastAPI). Multipart, daher NICHT
 * über den JSON-DAL. Gibt das aktualisierte Profil zurück; wirft bei Fehler.
 */
export async function uploadAvatar(datei: File): Promise<HostProfile> {
  const form = new FormData();
  form.append("file", datei);
  const res = await fetch("/api/host-profil/avatar", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Upload fehlgeschlagen.");
  }
  return (await res.json()) as HostProfile;
}

// „Hosting begann"-Zeitpunkt als „Monat Jahr", aus dem vollen ISO-Zeitstempel.
// Ungültig/leer → null (kein erfundener Wert, Wurzel 4).
//
// Die Locale kommt als Parameter herein, weil das hier keine Komponente ist und
// `useLocale()` deshalb nicht zur Verfügung steht. Aufrufer reichen sie durch —
// fest verdrahtetes „de-DE" zeigte in allen 45 Sprachen deutsche Monatsnamen.
export function formatHostingSince(
  iso: string | null,
  locale: string,
): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
