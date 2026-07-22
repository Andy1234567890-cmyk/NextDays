// Booking.com Unterkunftsart-Katalog (PCT = Property Class Type Codes).
// Referenz siehe docs/BOOKING-TYPEN.md. 26 aktive Codes (offiziell verifiziert:
// developers.booking.com/connectivity/docs/codes-pct). Getrennt vom internen
// property_type — das ist die Booking-Objektart (Hotel/Guesthouse/Riad/…).
// Codes sind Integer. Deprecated-Codes bewusst NICHT enthalten (nur Neuanlage).

export type BookingPropertyType = {
  code: number;
  label: string; // deutsch
};

// Reihenfolge: gängigste zuerst, dann alphabetisch nach Nutzung gruppiert.
export const BOOKING_PROPERTY_TYPES: BookingPropertyType[] = [
  { code: 20, label: "Hotel" },
  { code: 19, label: "Hostel" },
  { code: 3, label: "Apartment / Ferienwohnung" },
  { code: 4, label: "Bed & Breakfast" },
  { code: 40, label: "Pension / Gästehaus" },
  { code: 6, label: "Campingplatz" },
  { code: 7, label: "Chalet" },
  { code: 12, label: "Boot / Kreuzfahrt" },
  { code: 15, label: "Bauernhof / Farm stay" },
  { code: 21, label: "Gasthof / Landgasthof" },
  { code: 22, label: "Lodge" },
  { code: 27, label: "Motel" },
  { code: 30, label: "Resort" },
  { code: 33, label: "Zelt / Glamping" },
  { code: 35, label: "Villa" },
  { code: 5000, label: "Aparthotel" },
  { code: 5001, label: "Riad" },
  { code: 5002, label: "Ryokan" },
  { code: 5003, label: "Love Hotel" },
  { code: 5004, label: "Homestay / Privatunterkunft" },
  { code: 5005, label: "Business-Hotel (jap. Stil)" },
  { code: 5006, label: "Ferienhaus" },
  { code: 5007, label: "Landhaus" },
  { code: 5008, label: "Kapselhotel" },
  { code: 5009, label: "Ferienpark" },
  { code: 5010, label: "Kreuzfahrtschiff" },
  { code: 5011, label: "Studentenunterkunft" },
];

export function bookingPropertyTypeLabel(code: number | null): string | null {
  if (code == null) return null;
  return BOOKING_PROPERTY_TYPES.find((t) => t.code === code)?.label ?? null;
}
