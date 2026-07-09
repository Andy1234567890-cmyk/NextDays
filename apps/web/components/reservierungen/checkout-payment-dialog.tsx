"use client";

// Zahlart-Abfrage beim Check-out (Rezeption): bar / Kreditkarte (mit Marken-
// auswahl) / auf Rechnung. Erst die Auswahl löst den Check-out + die finale
// Rechnung aus. Aus dem Kalender-Slider herausgezogen, damit Slider UND PM-
// Detail-Vollseite denselben Dialog nutzen (kein Doppelcode).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { CheckOutPayment } from "@/lib/reservations";

const METHODS = [
  { value: "cash", label: "Bar", hint: "Barzahlung am Empfang", icon: "ph:money" },
  { value: "card", label: "Kreditkarte", hint: "Kartenzahlung am Empfang", icon: "ph:credit-card" },
  { value: "invoice", label: "Auf Rechnung", hint: "Überweisung mit Zahlungsziel", icon: "ph:receipt" },
] as const;

const CARD_BRANDS = [
  "Visa",
  "Mastercard",
  "American Express",
  "Maestro",
  "girocard",
  "Diners Club",
  "Discover",
  "JCB",
  "UnionPay",
];

export function CheckoutPaymentDialog({
  busy,
  onClose,
  onConfirm,
}: {
  busy: boolean;
  onClose: () => void;
  onConfirm: (payment: CheckOutPayment) => void;
}) {
  const [payMethod, setPayMethod] =
    useState<CheckOutPayment["payment_method"]>("card");
  const [cardBrand, setCardBrand] = useState("Visa");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40"
        role="presentation"
        onClick={() => !busy && onClose()}
      />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <h2 className="font-display text-lg font-extrabold">
            Wie bezahlt der Gast?
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onClose}
            disabled={busy}
            aria-label="Schließen"
          >
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          {METHODS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={payMethod === opt.value}
              onClick={() => setPayMethod(opt.value)}
              className={
                "flex items-center gap-3 rounded-(--radius) border p-3 text-left transition " +
                (payMethod === opt.value
                  ? "border-accent bg-accent/5"
                  : "border-border hover:bg-secondary/50")
              }
            >
              <span
                className={
                  "flex size-9 shrink-0 items-center justify-center rounded-full " +
                  (payMethod === opt.value
                    ? "bg-accent/10 text-accent"
                    : "bg-secondary text-muted-foreground")
                }
              >
                <Icon icon={opt.icon} className="size-4.5" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.hint}</span>
              </span>
              {payMethod === opt.value && (
                <Icon
                  icon="ph:check-circle-fill"
                  className="ml-auto size-5 shrink-0 text-accent"
                />
              )}
            </button>
          ))}

          {payMethod === "card" && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CARD_BRANDS.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  aria-pressed={cardBrand === brand}
                  onClick={() => setCardBrand(brand)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-medium transition " +
                    (cardBrand === brand
                      ? "bg-accent text-white"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70")
                  }
                >
                  {brand}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Abbrechen
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              onConfirm({
                payment_method: payMethod,
                card_brand: payMethod === "card" ? cardBrand : undefined,
              })
            }
          >
            <Icon
              icon={busy ? "ph:spinner" : "ph:flag-checkered"}
              className={"size-4 " + (busy ? "animate-spin" : "")}
            />
            {busy ? "Checke aus…" : "Check-out abschließen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
