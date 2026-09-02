"use server";

// Schwellen der Verdachtsprüfung setzen (0521). Berechtigung prüft der Server
// (require_platform_write); `null` schaltet eine Regel ab.
import { revalidatePath } from "next/cache";

import { ApiError } from "@nextdays/auth/errors";

import { api } from "./api-server";
import type { Schwelle } from "./reichweite";

type Ergebnis<T> = { ok: true; data: T } | { ok: false; fehler: string };

export async function schwelleSetzen(key: string, value: number | null): Promise<Ergebnis<Schwelle>> {
  try {
    const data = await api<Schwelle>(`/platform/affiliates/reach/thresholds/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: { value },
      cache: "no-store",
    });
    revalidatePath("/partner/reichweite");
    revalidatePath("/partner");
    return { ok: true, data };
  } catch (exc) {
    return { ok: false, fehler: exc instanceof ApiError ? exc.message : "Speichern fehlgeschlagen." };
  }
}
