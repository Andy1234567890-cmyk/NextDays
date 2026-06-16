import type { Meta, StoryObj } from "@storybook/react";

import { PropertyCard } from "./property-card";

/**
 * Objekt-Karte (property-card) — fachliche PMS-Komponente.
 *
 * Lastenheft-Modul §2.2 (Objekt-Stammdaten) / §6 (Eigentümer-Sicht).
 * Zugehörige Tabelle: `properties` (+ `reservations` für die nächste Buchung).
 *
 * Zeigt Thumbnail (Icon-Platzhalter wenn ohne Bild), Titel, Ort,
 * Kapazität (max_guests), property_type-Badge, property_status,
 * Netto/Nacht und die nächste Buchung. In der Eigentümer-Sicht
 * erscheint von Gästen nur der Vorname plus Channel-Icon (§6).
 *
 * Es werden ausschließlich echte Enum-Werte verwendet:
 * property_type, property_status, reservation_channel.
 */
const meta = {
  title: "PMS-Komponenten/Objekt-Karte",
  component: PropertyCard,
  tags: ["autodocs"],
  argTypes: {
    propertyType: {
      control: "select",
      options: [
        "ferienhaus",
        "appartement",
        "glamping",
        "tiny_house",
        "stellplatz",
        "hausboot",
      ],
    },
    propertyStatus: {
      control: "select",
      options: ["draft", "active", "inactive"],
    },
  },
} satisfies Meta<typeof PropertyCard>;

export default meta;
type Story = StoryObj<typeof meta>;

// Standard: aktives Ferienhaus mit nächster Direktbuchung.
export const Standard: Story = {
  args: {
    title: "Ferienhaus Skagen",
    location: "Skagen, DK",
    maxGuests: 6,
    propertyType: "ferienhaus",
    propertyStatus: "active",
    netPricePerNight: 1250,
    currencySymbol: "€",
    nextBooking: { firstName: "Lena", channel: "direct", date: "20. Jun" },
  },
};

// Entwurf: noch nicht veröffentlichtes Objekt, ohne Buchung.
export const Entwurf: Story = {
  args: {
    title: "Appartement Hafenblick",
    location: "Aarhus, DK",
    maxGuests: 4,
    propertyType: "appartement",
    propertyStatus: "draft",
    netPricePerNight: 980,
    currencySymbol: "€",
  },
};

// Inaktiv: vorübergehend nicht buchbar.
export const Inaktiv: Story = {
  args: {
    title: "Tiny House Waldrand",
    location: "Silkeborg, DK",
    maxGuests: 2,
    propertyType: "tiny_house",
    propertyStatus: "inactive",
    netPricePerNight: 740,
    currencySymbol: "€",
  },
};

// Nächste Buchung über Portal-Channel (Airbnb).
export const BuchungAirbnb: Story = {
  args: {
    title: "Glamping-Lodge Seeblick",
    location: "Ringkøbing, DK",
    maxGuests: 3,
    propertyType: "glamping",
    propertyStatus: "active",
    netPricePerNight: 8500,
    currencySymbol: "Kr",
    nextBooking: { firstName: "Mads", channel: "airbnb", date: "02. Jul" },
  },
};

// Buchung über Booking.com.
export const BuchungBooking: Story = {
  args: {
    title: "Hausboot Lagune",
    location: "Kopenhagen, DK",
    maxGuests: 5,
    propertyType: "hausboot",
    propertyStatus: "active",
    netPricePerNight: 1600,
    currencySymbol: "€",
    nextBooking: { firstName: "Sofia", channel: "booking", date: "11. Aug" },
  },
};

// Ohne nächste Buchung.
export const OhneBuchung: Story = {
  args: {
    title: "Stellplatz Dünenpark",
    location: "Blåvand, DK",
    maxGuests: 4,
    propertyType: "stellplatz",
    propertyStatus: "active",
    netPricePerNight: 420,
    currencySymbol: "€",
  },
};

// Ladezustand (Skeleton-Platzhalter).
export const Ladezustand: Story = {
  args: {
    title: "",
    location: "",
    maxGuests: 0,
    propertyType: "ferienhaus",
    propertyStatus: "active",
    netPricePerNight: 0,
    loading: true,
  },
};

// Übersicht: mehrere Objekte als Raster.
export const Raster: Story = {
  args: {
    title: "Ferienhaus Skagen",
    location: "Skagen, DK",
    maxGuests: 6,
    propertyType: "ferienhaus",
    propertyStatus: "active",
    netPricePerNight: 1250,
  },
  render: () => (
    <div className="flex flex-wrap gap-4">
      <PropertyCard
        title="Ferienhaus Skagen"
        location="Skagen, DK"
        maxGuests={6}
        propertyType="ferienhaus"
        propertyStatus="active"
        netPricePerNight={1250}
        nextBooking={{ firstName: "Lena", channel: "direct", date: "20. Jun" }}
      />
      <PropertyCard
        title="Appartement Hafenblick"
        location="Aarhus, DK"
        maxGuests={4}
        propertyType="appartement"
        propertyStatus="draft"
        netPricePerNight={980}
      />
      <PropertyCard
        title="Glamping-Lodge Seeblick"
        location="Ringkøbing, DK"
        maxGuests={3}
        propertyType="glamping"
        propertyStatus="active"
        netPricePerNight={8500}
        currencySymbol="Kr"
        nextBooking={{ firstName: "Mads", channel: "airbnb", date: "02. Jul" }}
      />
    </div>
  ),
};
