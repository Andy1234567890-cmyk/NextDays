"use client";

// Historie der offiziellen Ankündigungen (/neuerungen) in Marketing-Optik.
//
// BEWUSST KEIN Quittieren hier: `quittiert` wird ausschließlich über das Popup
// gesetzt. Gäbe es zwei Wege zu demselben Feld, liefe die Popup-Kette von der
// Liste her leer — wer hier durchscrollt, hätte alles „gelesen", ohne es
// gesehen zu haben. Der Ungelesen-Punkt ist deshalb reine Anzeige.
//
// BEWUSST KEIN Realtime-Abo: die Tabelle `announcements` ist nach Wurzel 6 für
// `authenticated` komplett gesperrt (revoke + restrictive deny-all). Ein Abo
// bräuchte `grant select` und würde damit auch Entwürfe („Wartungsfenster am
// 3.") für jeden eingeloggten Nutzer jedes Betriebs öffnen. Ankündigungen sind
// redaktionell und erscheinen beim Login — ein Abo wäre hier eine stumme
// Attrappe (siehe scripts/realtime/abos-pruefen.sh).
import { useCallback, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { kategorieSchluessel } from "@/components/announcements/kategorie";
import { listAnnouncements, type Announcement } from "@/lib/announcements";
import { Button } from "@nextdays/ui/button";

const SEITE = 20;

export function NeuerungenListe({
  initial,
  ungelesen,
}: {
  initial: readonly Announcement[];
  ungelesen: number;
}) {
  const t = useTranslations("neuerungen");
  const locale = useLocale();

  const [eintraege, setEintraege] = useState<Announcement[]>([...initial]);
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set());
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // „Weniger als eine volle Seite" heißt: es gibt nichts mehr zu holen.
  const [mehrMoeglich, setMehrMoeglich] = useState(initial.length >= SEITE);

  const mehrLaden = useCallback(async () => {
    if (laedt) return;
    setLaedt(true);
    setFehler(null);
    const res = await listAnnouncements(SEITE, eintraege.length);
    setLaedt(false);
    if (!res.ok) {
      // Ein Ladefehler ist kein „nichts mehr da" (Wurzel 4) — der Knopf bleibt
      // stehen, damit ein zweiter Versuch möglich ist.
      setFehler(res.error);
      return;
    }
    setEintraege((alt) => {
      // Doppelklick/Retry darf keine Duplikate erzeugen (Wurzel 2).
      const bekannt = new Set(alt.map((a) => a.id));
      return [...alt, ...res.data.items.filter((a) => !bekannt.has(a.id))];
    });
    setMehrMoeglich(res.data.items.length >= SEITE);
  }, [eintraege.length, laedt]);

  const umschalten = useCallback((id: string) => {
    setOffen((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) neu.delete(id);
      else neu.add(id);
      return neu;
    });
  }, []);

  return (
    <div className="neuerungen-flaeche mx-auto w-full max-w-3xl">
      <header className="space-y-3 py-8">
        <p className="text-xs font-medium uppercase tracking-widest text-accent">
          {t("eyebrow")}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl">{t("titel")}</h1>
          {ungelesen > 0 && (
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              {t("neuAnzahl", { anzahl: ungelesen })}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t("unterzeile")}</p>
      </header>

      {eintraege.length === 0 ? (
        <p className="rounded-3xl bg-neuerungen-flaeche px-6 py-10 text-center text-sm text-muted-foreground shadow-neuerungen">
          {t("leer")}
        </p>
      ) : (
        <ul className="space-y-4 pb-4">
          {eintraege.map((a) => {
            const kategorie = kategorieSchluessel(a.kategorie);
            const istOffen = offen.has(a.id);
            // Kein Veröffentlichungsdatum (noch Entwurf) → die Zeile entfällt,
            // statt „Invalid Date" auszugeben (Wurzel 4).
            const datum = a.veroeffentlicht_am
              ? new Date(a.veroeffentlicht_am).toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : null;
            return (
              <li
                key={a.id}
                className="rounded-3xl bg-neuerungen-flaeche p-6 shadow-neuerungen"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground">
                    {t(`kategorie.${kategorie}`)}
                  </span>
                  {datum && (
                    <span className="text-xs text-muted-foreground">
                      {t("veroeffentlichtAm", { datum })}
                    </span>
                  )}
                  {!a.quittiert && (
                    <span
                      className="ml-auto rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"
                      title={t("ungelesen")}
                    >
                      {t("ungelesen")}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 font-display text-xl">{a.titel}</h2>
                {a.kurztext && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    {a.kurztext}
                  </p>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-3 -ml-3"
                  onClick={() => umschalten(a.id)}
                  aria-expanded={istOffen}
                  aria-controls={`neuerung-${a.id}`}
                >
                  <Icon
                    icon="ph:caret-down"
                    className={`size-4 transition-transform ${istOffen ? "rotate-180" : ""}`}
                  />
                  {istOffen ? t("zuklappen") : t("aufklappen")}
                </Button>

                {istOffen && (
                  // inhalt_html ist serverseitig mit nh3 gegen eine Allowlist
                  // bereinigt (Wurzel 8) — inklusive Prüfung jedes img-src
                  // gegen die eigene Storage-Basis. Der Text stammt
                  // ausschließlich vom Plattform-Team, nie von Kunden;
                  // dangerouslySetInnerHTML ist hier der korrekte Weg.
                  <div
                    id={`neuerung-${a.id}`}
                    className="tiptap mt-4 border-t border-border pt-4 text-sm leading-relaxed [&_img]:max-w-full [&_img]:rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: a.inhalt_html }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {fehler && (
        <p
          role="alert"
          className="mb-4 rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {t("ladefehler", { grund: fehler })}
        </p>
      )}

      {mehrMoeglich && (
        <div className="flex justify-center pb-10">
          <Button
            type="button"
            variant="outline"
            onClick={() => void mehrLaden()}
            disabled={laedt}
            aria-busy={laedt}
          >
            {t("mehrLaden")}
          </Button>
        </div>
      )}
    </div>
  );
}
