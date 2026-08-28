"use client";

// Stock-Foto-Suche: der Reiter neben „Bibliothek", nur sichtbar, wenn der
// Server mindestens einen Anbieter eingerichtet hat (Wurzel 4 — kein Reiter,
// der verlässlich ins Leere sucht).
//
// Die Attribution steht schon HIER, im Treffer selbst — nicht erst nach der
// Übernahme. Unsplash verlangt sie bei JEDER Anzeige, und ein Trefferraster
// ist eine Anzeige.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { Medium } from "@/lib/site-pages";
import {
  type StockAnbieter,
  type StockFoto,
  listStockAnbieter,
  sucheStockFotos,
  uebernehmeStockFoto,
} from "@/lib/site-medien";

export function StockSuche({
  aktuellerOrdner,
  onUebernommen,
}: {
  /** In welchen Ordner ein übernommenes Foto fällt — derselbe, der gerade in
   *  der Bibliothek offen ist. `""` = Wurzel. */
  aktuellerOrdner: string;
  onUebernommen: (m: Medium) => void;
}) {
  const t = useTranslations("website.mediathek");
  const [anbieter, setAnbieter] = useState<StockAnbieter[] | null>(null);
  const [gewaehlterAnbieter, setGewaehlterAnbieter] = useState<string | null>(null);
  const [begriff, setBegriff] = useState("");
  const [seite, setSeite] = useState(1);
  const [treffer, setTreffer] = useState<StockFoto[]>([]);
  const [weitereVorhanden, setWeitereVorhanden] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [uebernahmeLaeuft, setUebernahmeLaeuft] = useState<string | null>(null);
  const letzterBegriff = useRef("");

  useEffect(() => {
    void listStockAnbieter().then((res) => {
      if (!res.ok) {
        setAnbieter([]);
        return;
      }
      setAnbieter(res.data.items);
      setGewaehlterAnbieter(res.data.items[0]?.id ?? null);
    });
  }, []);

  async function suchen(neueSuche: boolean) {
    if (!gewaehlterAnbieter || !begriff.trim()) return;
    const zielSeite = neueSuche ? 1 : seite + 1;
    setLaedt(true);
    const res = await sucheStockFotos(gewaehlterAnbieter, begriff.trim(), zielSeite);
    setLaedt(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    letzterBegriff.current = begriff.trim();
    setSeite(zielSeite);
    setWeitereVorhanden(res.data.has_more);
    setTreffer((alt) => (neueSuche ? res.data.items : [...alt, ...res.data.items]));
  }

  async function uebernehmen(foto: StockFoto) {
    setUebernahmeLaeuft(foto.external_id);
    const res = await uebernehmeStockFoto(
      foto.provider,
      foto.external_id,
      aktuellerOrdner || null,
    );
    setUebernahmeLaeuft(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(t("stock.uebernommen"));
    onUebernommen(res.data);
  }

  if (anbieter === null) {
    return <p className="p-4 text-sm text-muted-foreground">{t("laedt")}</p>;
  }
  if (anbieter.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">{t("stock.keineAnbieter")}</p>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
        {anbieter.length > 1 ? (
          <div className="flex gap-1.5">
            {anbieter.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setGewaehlterAnbieter(a.id)}
                className={
                  "rounded-full border px-3 py-1 text-xs font-medium transition " +
                  (gewaehlterAnbieter === a.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-secondary")
                }
              >
                {a.name}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void suchen(true);
          }}
          className="flex gap-2"
        >
          <input
            value={begriff}
            onChange={(e) => setBegriff(e.target.value)}
            placeholder={t("stock.suchPlatzhalter")}
            maxLength={100}
            className="min-w-0 flex-1 rounded-(--radius) border border-border bg-transparent px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={laedt || !begriff.trim()}
            className="flex items-center gap-1.5 rounded-(--radius) border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
          >
            <Icon icon="ph:magnifying-glass" className="size-4" />
            {t("stock.suchen")}
          </button>
        </form>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {treffer.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {laedt ? t("stock.laedt") : letzterBegriff.current ? t("stock.keineTreffer") : t("stock.hinweis")}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {treffer.map((foto) => (
                <li key={`${foto.provider}-${foto.external_id}`} className="group relative">
                  <div className="overflow-hidden rounded-(--radius) border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={foto.thumb_url}
                      alt={foto.alt_text ?? ""}
                      loading="lazy"
                      className="aspect-square w-full bg-secondary/40 object-cover"
                    />
                    {/* Attribution DIREKT am Treffer — Unsplashs Pflicht gilt
                        bei jeder Anzeige, nicht erst nach der Übernahme. */}
                    {foto.attribution_required ? (
                      <a
                        href={foto.credit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[0.625rem] leading-tight text-white/90 underline-offset-2 hover:underline"
                      >
                        {t("stock.fotoVon", { name: foto.credit_name })}
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={uebernahmeLaeuft === foto.external_id}
                    onClick={() => void uebernehmen(foto)}
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-(--radius) bg-foreground/0 opacity-0 transition group-hover:pointer-events-auto group-hover:bg-foreground/25 group-hover:opacity-100"
                  >
                    <span className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium shadow-sm">
                      <Icon
                        icon={
                          uebernahmeLaeuft === foto.external_id
                            ? "svg-spinners:180-ring"
                            : "ph:download-simple"
                        }
                        className="size-3.5"
                      />
                      {t("stock.uebernehmen")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {weitereVorhanden ? (
              <div className="flex justify-center pt-3">
                <button
                  type="button"
                  disabled={laedt}
                  onClick={() => void suchen(false)}
                  className="rounded-full border border-border px-4 py-1.5 text-sm font-medium transition hover:bg-secondary disabled:opacity-50"
                >
                  {laedt ? t("stock.laedt") : t("stock.mehrLaden")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
