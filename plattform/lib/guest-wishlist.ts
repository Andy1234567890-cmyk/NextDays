// Merkzettel des Gastes (/api/v1/guest-wishlist). Listen mit gemerkten Objekten.
import { guestCall, type Result } from "./guest-api";

export type WishlistSummary = {
  id: string;
  name: string;
  item_count: number;
  created_at: string;
  updated_at: string;
};

export type WishlistItem = {
  property_id: string;
  note: string | null;
  title: string;
  photo: string | null;
  city: string | null;
  country: string | null;
  currency: string | null;
  price_from: number | null;
  bookable: boolean;
};

export type WishlistDetail = {
  id: string;
  name: string;
  items: WishlistItem[];
};

export async function ladeMerkzettel(): Promise<
  Result<{ items: WishlistSummary[]; total: number }>
> {
  return guestCall("guest-wishlist");
}

export async function ladeMerkliste(
  wishlistId: string,
): Promise<Result<WishlistDetail>> {
  return guestCall(`guest-wishlist/${encodeURIComponent(wishlistId)}`);
}

export async function erstelleMerkliste(
  name: string,
): Promise<Result<WishlistSummary>> {
  return guestCall("guest-wishlist", { method: "POST", body: { name } });
}

export async function loescheMerkliste(
  wishlistId: string,
): Promise<Result<void>> {
  return guestCall(`guest-wishlist/${encodeURIComponent(wishlistId)}`, {
    method: "DELETE",
  });
}

export async function fuegeItemHinzu(
  wishlistId: string,
  propertyId: string,
  note?: string,
): Promise<Result<void>> {
  return guestCall(
    `guest-wishlist/${encodeURIComponent(wishlistId)}/items`,
    { method: "POST", body: { property_id: propertyId, note } },
  );
}

export async function entferneItem(
  wishlistId: string,
  propertyId: string,
): Promise<Result<void>> {
  return guestCall(
    `guest-wishlist/${encodeURIComponent(wishlistId)}/items/${encodeURIComponent(propertyId)}`,
    { method: "DELETE" },
  );
}
