// Mobiler Buchungs-Einstieg: feste Leiste unten (Preis links, Knopf rechts),
// das eigentliche Widget öffnet als Blatt.
//
// Grund: das Buchungs-Widget ist auf der Detailseite die zweite Spalte
// (`lg:grid-cols-[1fr_24rem]`). Unter lg fällt es damit hinter Beschreibung,
// Ausstattung, Bewertungen und Karte — auf dem Handy waren das drei
// Bildschirmlängen, bevor überhaupt ein Preis oder ein Reservieren-Knopf zu
// sehen war. Dieselbe Sache steht ab lg unverändert als Spalte da; die Leiste
// ist `md:hidden`.
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { BuchungsWidget } from "@/components/buchungs-widget";
import { type Listing, formatCurrency } from "@/lib/listings";

import { BlattModal } from "./blatt-modal";
import { StickyAktionsleiste } from "./sticky-aktionsleiste";

export function BuchungBlatt({ listing }: { listing: Listing }) {
  const t = useTranslations("mobil");
  const tw = useTranslations("widget");
  const [offen, setOffen] = useState(false);

  return (
    <>
      <StickyAktionsleiste
        links={
          listing.preisProNacht != null ? (
            <p className="truncate">
              <span className="font-semibold">
                {formatCurrency(listing.preisProNacht, listing.currency)}
              </span>{" "}
              <span className="text-muted-foreground">{tw("proNacht")}</span>
            </p>
          ) : (
            <p className="truncate text-muted-foreground">
              {tw("preisAufAnfrage")}
            </p>
          )
        }
        rechts={
          <button
            type="button"
            onClick={() => setOffen(true)}
            className="min-h-11 rounded-full bg-accent px-5 text-sm font-medium text-accent-foreground"
          >
            {t("verfuegbarkeitPruefen")}
          </button>
        }
      />

      <BlattModal
        offen={offen}
        onSchliessen={() => setOffen(false)}
        titel={t("verfuegbarkeitPruefen")}
      >
        <BuchungsWidget listing={listing} rahmenlos />
      </BlattModal>
    </>
  );
}
