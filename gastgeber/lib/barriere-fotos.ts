// Beweisfotos der Barrierefreiheits-Merkmale (Client → BFF-Route → FastAPI).
// Multipart, daher NICHT über den JSON-DAL. Die Prüfung der Bytes (Magic-Bytes,
// Größe, Obergrenze je Merkmal) macht der Server.

export interface BarriereFoto {
  id: string;
  property_id: string;
  feature_key: string;
  url: string;
  /** pending = eingereicht, approved = freigegeben, rejected = abgelehnt. */
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
}

/** Alle Beweisfotos eines Objekts (optional auf ein Merkmal gefiltert). */
export async function ladeBarriereFotos(
  propertyId: string,
  featureKey?: string,
): Promise<BarriereFoto[]> {
  const q = featureKey ? `?feature_key=${encodeURIComponent(featureKey)}` : "";
  const res = await fetch(
    `/api/objekte/${propertyId}/barriere-fotos${q}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("Fotos konnten nicht geladen werden.");
  return (await res.json()) as BarriereFoto[];
}

/** Ein Beweisfoto zu einem Merkmal hochladen. */
export async function ladeBarriereFotoHoch(
  propertyId: string,
  featureKey: string,
  datei: File,
): Promise<BarriereFoto> {
  const form = new FormData();
  form.append("file", datei);
  const res = await fetch(
    `/api/objekte/${propertyId}/barriere-fotos/${encodeURIComponent(featureKey)}`,
    { method: "POST", body: form },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "Upload fehlgeschlagen.");
  }
  return (await res.json()) as BarriereFoto;
}

/** Ein Beweisfoto löschen. */
export async function loescheBarriereFoto(
  propertyId: string,
  fotoId: string,
): Promise<void> {
  const res = await fetch(
    `/api/objekte/${propertyId}/barriere-fotos/${fotoId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error("Foto konnte nicht gelöscht werden.");
}
