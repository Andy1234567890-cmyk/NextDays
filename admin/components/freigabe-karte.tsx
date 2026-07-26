"use client";

// Eine Objekt-Karte in der Freigabe-Warteschlange: Fotos, Eckdaten und die
// Entscheidung. Ablehnen verlangt eine Begründung — sie wird dem Gastgeber
// angezeigt, damit er nachbessern kann.
import { Icon } from "@iconify/react";
import { useState } from "react";
import { toast } from "sonner";

import type { ModerationProperty } from "@/lib/backoffice";
import { ablehnen, freigeben } from "@/lib/moderation-actions";

export function FreigabeKarte({
  objekt,
  darfEntscheiden,
}: {
  objekt: ModerationProperty;
  /** Nur platform_admin darf entscheiden (Server erzwingt es zusätzlich). */
  darfEntscheiden: boolean;
}) {
  const [grundOffen, setGrundOffen] = useState(false);
  const [grund, setGrund] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const ort = [objekt.city, objekt.country].filter(Boolean).join(", ");

  async function entscheiden(zusage: boolean) {
    if (!zusage && !grund.trim()) {
      setGrundOffen(true);
      return;
    }
    setLaeuft(true);
    const res = zusage
      ? await freigeben(objekt.id)
      : await ablehnen(objekt.id, grund.trim());
    setLaeuft(false);
    if (res.ok) {
      toast.success(zusage ? "Objekt freigegeben." : "Objekt abgelehnt.");
      setGrundOffen(false);
      setGrund("");
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <article className="rounded-2xl border border-border p-6">
      <div className="flex gap-6">
        {/* Fotos — der wichtigste Prüfgegenstand. */}
        <div className="flex shrink-0 gap-2">
          {objekt.photos.length === 0 ? (
            <div className="flex size-28 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Icon icon="ph:image" className="size-8" />
            </div>
          ) : (
            objekt.photos.slice(0, 3).map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="size-28 rounded-xl object-cover"
              />
            ))
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="font-sans text-lg font-bold tracking-tight">
            {objekt.title}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {ort || "Ort fehlt"}
            {objekt.max_guests ? ` · ${objekt.max_guests} Gäste` : ""}
            {objekt.currency ? ` · ${objekt.currency}` : ""}
          </p>
          <p className="mt-1 text-sm">
            <a
              href={`/betriebe/${objekt.tenant_id}`}
              className="underline-offset-4 hover:underline"
            >
              {objekt.tenant_name ?? objekt.tenant_id}
            </a>
          </p>
          {objekt.moderation_submitted_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              Eingereicht am{" "}
              {new Date(objekt.moderation_submitted_at).toLocaleString("de-DE")}
            </p>
          )}
          {objekt.moderation_note && (
            <p className="mt-3 rounded-xl bg-muted/50 px-4 py-2.5 text-sm">
              <span className="font-semibold">Notiz:</span>{" "}
              {objekt.moderation_note}
            </p>
          )}
        </div>

        {darfEntscheiden && objekt.moderation_status === "pending" && (
          <div className="flex shrink-0 flex-col gap-2">
            <button
              type="button"
              disabled={laeuft}
              onClick={() => void entscheiden(true)}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Freigeben
            </button>
            <button
              type="button"
              disabled={laeuft}
              onClick={() => setGrundOffen((o) => !o)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:border-foreground disabled:opacity-50"
            >
              Ablehnen
            </button>
          </div>
        )}
      </div>

      {grundOffen && (
        <div className="mt-5 border-t border-border pt-5">
          <label className="block">
            <span className="mb-1.5 block text-sm text-muted-foreground">
              Begründung (wird dem Gastgeber angezeigt)
            </span>
            <textarea
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              rows={3}
              maxLength={1000}
              autoFocus
              className="w-full resize-none rounded-xl border border-border bg-transparent p-3 text-sm outline-none focus:border-foreground"
            />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={laeuft || !grund.trim()}
              onClick={() => void entscheiden(false)}
              className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {laeuft ? "Wird gesendet …" : "Ablehnung senden"}
            </button>
            <button
              type="button"
              onClick={() => setGrundOffen(false)}
              className="text-sm font-semibold underline-offset-4 hover:underline"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
