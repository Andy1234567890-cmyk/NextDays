// Ausweisprüfung des Gastes (Client-Insel).
//
// WOZU. Ein Gastgeber kann seine Sofortbuchung auf Gäste mit geprüfter
// Identität beschränken — bei Airbnb heißt das `guests_with_verified_identity`
// (Hilfe-Artikel 484/1237). Wer die Prüfung nicht hat, wird NICHT abgewiesen:
// aus seiner Buchung wird eine Anfrage, über die der Gastgeber innerhalb von
// 24 Stunden entscheidet. Die Prüfung ist also keine Pflicht — sie erspart das
// Warten. Genau so steht es hier auch, damit niemand sie für eine Hürde hält.
//
// Der Ablauf ist derselbe wie bei den Gastgebern: Stripe hostet Upload und
// Kamera, wir speichern KEINE Ausweisdaten, nur den Status. Das Ergebnis kommt
// asynchron per Webhook — aus der Rückleitung darf nichts abgeleitet werden.
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  type GuestMe,
  guestIdentityAbgleichen,
  guestIdentityStarten,
} from "@/lib/guest-auth";

const DARSTELLUNG: Record<
  GuestMe["identity_status"],
  { icon: string; farbe: string; text: string }
> = {
  verified: {
    icon: "ph:seal-check-fill",
    farbe: "text-emerald-700",
    text: "Geprüft",
  },
  processing: {
    icon: "ph:clock-fill",
    farbe: "text-amber-700",
    text: "Wird geprüft …",
  },
  requires_input: {
    icon: "ph:warning-fill",
    farbe: "text-rose-700",
    text: "Es fehlt noch etwas",
  },
  unverified: {
    icon: "ph:identification-card",
    farbe: "text-neutral-500",
    text: "Noch nicht geprüft",
  },
};

export function IdentitaetKarte({ me }: { me: GuestMe }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const stand = DARSTELLUNG[me.identity_status];
  // Starten, solange nicht geprüft und nicht gerade in Prüfung.
  const kannStarten =
    me.identity_status === "unverified" ||
    me.identity_status === "requires_input";

  async function starten() {
    setBusy(true);
    setFehler(null);
    // Den Tab SOFORT im Klick öffnen (User-Gesture) — nach dem await ist der
    // Gesture-Kontext weg und der Popup-Blocker greift.
    const tab = window.open("", "_blank");
    const res = await guestIdentityStarten(`${window.location.origin}/konto`);
    setBusy(false);
    if (!res.ok) {
      tab?.close();
      setFehler(res.error);
      return;
    }
    if (tab) {
      tab.location.href = res.data.url;
    } else {
      window.location.assign(res.data.url);
    }
  }

  async function abgleichen() {
    setBusy(true);
    setFehler(null);
    const res = await guestIdentityAbgleichen();
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-medium">Identität</p>
          <p
            className={`mt-1 inline-flex items-center gap-1.5 text-[0.9375rem] ${stand.farbe}`}
          >
            <Icon icon={stand.icon} className="size-4" />
            {stand.text}
          </p>
        </div>
        {kannStarten && (
          <button
            type="button"
            onClick={() => void starten()}
            disabled={busy}
            className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-60"
          >
            {busy ? "…" : "Jetzt prüfen"}
          </button>
        )}
        {/* Der Weg zurück, wenn das Ergebnis nicht von selbst ankommt — sonst
            stünde „Wird geprüft …" für immer da. */}
        {me.identity_status === "processing" && (
          <button
            type="button"
            onClick={() => void abgleichen()}
            disabled={busy}
            className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-60"
          >
            {busy ? "…" : "Erneut laden"}
          </button>
        )}
      </div>

      {me.identity_status !== "verified" && (
        <p className="mt-3 max-w-lg text-sm text-neutral-500">
          Manche Gastgeber nehmen nur von geprüften Gästen Sofortbuchungen an.
          Ohne Prüfung kannst du trotzdem buchen – deine Buchung wird dann zur
          Anfrage, über die der Gastgeber innerhalb von 24 Stunden entscheidet.
          Wir speichern keine Ausweisdaten, nur das Ergebnis.
        </p>
      )}

      {fehler && <p className="mt-3 text-sm text-rose-700">{fehler}</p>}
    </div>
  );
}
