// Merkzettel des Portal-Gastes (/api/v1/guest-wishlist). Listen + Einträge,
// serverseitig auf guest_id gescopet. Contract: guest_wishlist/schemas.py.
// `price_from` bleibt null, wenn kein Preis hinterlegt ist (Wurzel 4).
import { guestCall, type Result } from "@/lib/guestApi";

export type WishlistSummary = {
  id: string;
  name: string;
  item_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type WishlistItem = {
  property_id: string;
  note: string | null;
  created_at: string | null;
  title: string | null;
  photo: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  price_from: number | null;
  bookable: boolean;
};

export type WishlistDetail = {
  id: string;
  name: string;
  items: WishlistItem[];
};

export async function listWishlists(): Promise<
  Result<{ items: WishlistSummary[]; total: number }>
> {
  return guestCall("/guest-wishlist");
}

export async function getWishlist(id: string): Promise<Result<WishlistDetail>> {
  return guestCall(`/guest-wishlist/${encodeURIComponent(id)}`);
}

export async function createWishlist(name: string): Promise<Result<WishlistSummary>> {
  return guestCall("/guest-wishlist", { method: "POST", body: { name } });
}

export async function deleteWishlist(id: string): Promise<Result<{ ok: boolean }>> {
  return guestCall(`/guest-wishlist/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function addWishlistItem(
  wishlistId: string,
  propertyId: string,
  note?: string,
): Promise<Result<{ ok: boolean }>> {
  return guestCall(`/guest-wishlist/${encodeURIComponent(wishlistId)}/items`, {
    method: "POST",
    body: { property_id: propertyId, note },
  });
}

export async function removeWishlistItem(
  wishlistId: string,
  propertyId: string,
): Promise<Result<{ ok: boolean }>> {
  return guestCall(
    `/guest-wishlist/${encodeURIComponent(wishlistId)}/items/${encodeURIComponent(propertyId)}`,
    { method: "DELETE" },
  );
}
