"use server";

// Zimmerkategorien (room_types) einer Hotel-Property — Server-Actions gegen den
// FastAPI-room_types-Slice (/api/v1/room-types). Eine room_types-Zeile schaltet
// die Property in den Hotel-Modus (Verfügbarkeit als Zahl freier Zimmer); Anlegen/
// Ändern/Löschen löst im Backend den Channex-Sync aus (n Room-Types je Property).
import { ApiError, api } from "@/lib/api";
import { currentToken } from "@/lib/session-token";

export type RoomType = {
  id: string;
  property_id: string;
  title: string;
  count_of_rooms: number;
  occ_adults: number;
  occ_children: number;
  occ_infants: number;
  default_occupancy: number;
  position: number;
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<Result<T>> {
  const token = await currentToken();
  if (!token) return { ok: false, error: "Nicht angemeldet." };
  try {
    const data = await api<T>(path, { ...opts, token });
    return { ok: true, data };
  } catch (exc) {
    return {
      ok: false,
      error: exc instanceof ApiError ? exc.message : "Aktion fehlgeschlagen.",
    };
  }
}

export async function listRoomTypes(
  propertyId: string,
): Promise<Result<{ items: RoomType[]; total: number }>> {
  return call(`/room-types?property_id=${encodeURIComponent(propertyId)}`);
}

export async function createRoomType(input: {
  propertyId: string;
  title: string;
  countOfRooms: number;
  occAdults: number;
  occChildren?: number;
  occInfants?: number;
  defaultOccupancy: number;
}): Promise<Result<RoomType>> {
  return call("/room-types", {
    method: "POST",
    body: {
      property_id: input.propertyId,
      title: input.title,
      count_of_rooms: input.countOfRooms,
      occ_adults: input.occAdults,
      occ_children: input.occChildren ?? 0,
      occ_infants: input.occInfants ?? 0,
      default_occupancy: input.defaultOccupancy,
    },
  });
}

export async function updateRoomType(
  id: string,
  patch: {
    title?: string;
    countOfRooms?: number;
    occAdults?: number;
    occChildren?: number;
    occInfants?: number;
    defaultOccupancy?: number;
    position?: number;
  },
): Promise<Result<RoomType>> {
  return call(`/room-types/${id}`, {
    method: "PATCH",
    body: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.countOfRooms !== undefined ? { count_of_rooms: patch.countOfRooms } : {}),
      ...(patch.occAdults !== undefined ? { occ_adults: patch.occAdults } : {}),
      ...(patch.occChildren !== undefined ? { occ_children: patch.occChildren } : {}),
      ...(patch.occInfants !== undefined ? { occ_infants: patch.occInfants } : {}),
      ...(patch.defaultOccupancy !== undefined
        ? { default_occupancy: patch.defaultOccupancy }
        : {}),
      ...(patch.position !== undefined ? { position: patch.position } : {}),
    },
  });
}

export async function deleteRoomType(id: string): Promise<Result<null>> {
  return call(`/room-types/${id}`, { method: "DELETE" });
}
