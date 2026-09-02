"use client";

// Prüfeingang der Videofreigabe (0523).
//
// Ein Influencer bekommt den Link zu seinem Beitrag ERST, wenn das Video hier
// freigegeben wurde. Diese Seite ist damit ein Nadelöhr: was hier liegt,
// verdient noch kein Geld. Sie zeigt deshalb, WIE LANGE etwas schon wartet.
//
// Das Video wird über eine kurzlebige signierte Adresse abgespielt — der Bucket
// ist privat, und es handelt sich um unveröffentlichtes Material.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { type AblehnungsGrund, ABLEHNUNGSGRUND_LABEL, type VideoBeitrag } from "@/lib/partner";
import { videoEntscheiden } from "@/lib/partner-actions";

function mb(bytes: number | null): string {
  if (!bytes) return "—";
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function wartetSeit(iso: string | null): string {
  if (!iso) return "—";
  const stunden = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (stunden < 1) return "gerade eben";
  if (stunden < 24) return `seit ${stunden} h`;
  return `seit ${Math.floor(stunden / 24)} Tagen`;
}

function Karte({ beitrag }: { beitrag: VideoBeitrag }) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [grund, setGrund] = useState("");
  const [kategorie, setKategorie] = useState<AblehnungsGrund | "">("");
  const [ablehnen, setAblehnen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Ein Video, das seit über 48 h wartet, ist ein Betriebsproblem — der Partner
  // kann in der Zwischenzeit nichts verdienen.
  const alt = beitrag.video_uploaded_at
    ? Date.now() - new Date(beitrag.video_uploaded_at).getTime() > 48 * 3_600_000
    : false;

  function entscheiden(frei: boolean) {
    setFehler(null);
    starte(async () => {
      const res = await videoEntscheiden(
        beitrag.id,
        frei,
        frei ? null : grund.trim(),
        frei || !kategorie ? null : kategorie,
      );
      if (res.ok) router.refresh();
      else setFehler(res.fehler);
    });
  }

  return (
    <article className="rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{beitrag.title}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {beitrag.partner_name ?? "—"}
            {beitrag.partner_email ? ` · ${beitrag.partner_email}` : ""} · {beitrag.platform}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {beitrag.review_runde > 1 && (
            <span className="rounded-full bg-muted px-2 py-1 font-medium">
              {beitrag.review_runde}. Anlauf
            </span>
          )}
          <span
            className={`rounded-full px-2 py-1 font-medium ${
              alt ? "bg-destructive/10 text-destructive" : "bg-muted"
            }`}
          >
            {wartetSeit(beitrag.video_uploaded_at)}
          </span>
        </div>
      </div>

      {beitrag.video_url ? (
        <video
          src={beitrag.video_url}
          controls
          preload="metadata"
          className="mt-4 w-full rounded-xl border border-border bg-black"
          style={{ maxHeight: "26rem" }}
        />
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Das Video konnte nicht geladen werden. Bitte den Partner um erneutes Hochladen bitten.
        </p>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        {mb(beitrag.video_size)} · {beitrag.video_mime ?? "—"}
      </p>

      {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}

      {ablehnen ? (
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            entscheiden(false);
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Prüfliste — woran scheitert der Beitrag?</span>
            <select
              value={kategorie}
              onChange={(e) => setKategorie(e.target.value as AblehnungsGrund | "")}
              required
              className="rounded-xl border border-border bg-transparent px-3 py-2 outline-none focus-visible:border-foreground"
            >
              <option value="">Kategorie wählen …</option>
              {(Object.keys(ABLEHNUNGSGRUND_LABEL) as AblehnungsGrund[]).map((k) => (
                <option key={k} value={k}>
                  {ABLEHNUNGSGRUND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Grund der Ablehnung</span>
            <textarea
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              required
              minLength={3}
              maxLength={2000}
              rows={3}
              placeholder="Was muss der Partner ändern? Der Text geht an ihn."
              className="rounded-xl border border-border bg-transparent px-3 py-2 outline-none focus-visible:border-foreground"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={laeuft || grund.trim().length < 3 || !kategorie}
              className="rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Ablehnen und Grund senden
            </button>
            <button
              type="button"
              onClick={() => setAblehnen(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={laeuft}
            onClick={() => entscheiden(true)}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            <Icon icon="ph:seal-check" className="size-4" />
            Freigeben — Link entsteht
          </button>
          <button
            type="button"
            disabled={laeuft}
            onClick={() => setAblehnen(true)}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Ablehnen
          </button>
        </div>
      )}
    </article>
  );
}

export function PartnerVideos({ beitraege }: { beitraege: VideoBeitrag[] }) {
  if (beitraege.length === 0) {
    return (
      <div className="rounded-2xl border border-border p-8 text-center">
        <Icon icon="ph:check-circle" className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-medium">Keine Videos in der Prüfung</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sobald ein Partner ein Video einreicht, erscheint es hier. Bis zur Freigabe
          bekommt er keinen Link.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {beitraege.map((b) => (
        <Karte key={b.id} beitrag={b} />
      ))}
    </div>
  );
}
