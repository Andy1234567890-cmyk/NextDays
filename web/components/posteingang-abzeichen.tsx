"use client";

// Das Abzeichen am Sidebar-Punkt „Posteingang": wie viele Konversationen auf
// eine Antwort warten. Die Sidebar steht auf jeder Seite, also ist das die
// einzige Stelle, an der eine neue Gastnachricht auffällt, ohne dass jemand in
// den Posteingang klickt.
//
// REALTIME — die Quelle ist bewusst NICHT die naheliegende:
// `channex_booking` (die Threads) und `portal_messages` (der Nachrichtenspiegel)
// sind für `authenticated` gesperrt und stehen nicht in der Publikation
// `supabase_realtime` — live gegengeprüft. Ein Abo darauf wäre eine stumme
// Attrappe: die Oberfläche sähe live aus und aktualisierte nie. Beide Tabellen
// dafür zu öffnen verbietet sich, dort stehen Gastdaten und Nachrichtentexte.
//
// Gehört wird deshalb auf die erlaubten Nachbarn:
//  - `reservations` — jede eingehende OTA-Buchung schreibt hier, und ein neuer
//    Thread entsteht immer mit einer Buchung.
//  - `notifications` — der Ingest-Pfad legt bei einer neuen Gastnachricht einen
//    Glocken-Eintrag an (Kategorie `messages`). Das ist das Signal für die
//    Nachricht selbst, das `reservations` nicht liefert.
// Beide sind nur ANLASS zum Nachzählen, nicht die Zahl: gezählt wird immer
// serverseitig, weil der Lesestand abgeleitet ist (`_ist_gelesen`).
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { getInboxUnreadCount } from "@/lib/inbox";
import { useRealtime } from "@/lib/use-realtime";
import { SidebarMenuBadge } from "@nextdays/ui/sidebar";

export function PosteingangAbzeichen() {
  const t = useTranslations("nav");
  const [ungelesen, setUngelesen] = useState(0);

  const laden = useCallback(async () => {
    const res = await getInboxUnreadCount();
    // Bei einem Fehler bleibt die letzte bekannte Zahl stehen. Sie auf 0 zu
    // setzen wäre die falsche Aussage: „nichts zu tun" ist etwas anderes als
    // „konnte gerade nicht nachsehen" (Wurzel 4).
    if (res.ok) setUngelesen(res.data.ungelesen);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  useRealtime({ table: "reservations", onChange: () => void laden() });
  useRealtime({ table: "notifications", onChange: () => void laden() });

  if (ungelesen === 0) return null;

  return (
    <>
      {/* Ausgeklappt: die Zahl. Zwei Klassen überschreiben die Vorgaben des
          geteilten Bausteins — er rendert das Abzeichen sonst in der normalen
          Textfarbe (neben „Posteingang" wäre es dann nur eine graue Ziffer,
          die niemandem auffällt). Die Farbe ist der ganze Zweck. */}
      <SidebarMenuBadge
        aria-label={t("inboxUngelesen", { count: ungelesen })}
        className="bg-destructive text-destructive-foreground peer-hover/menu-button:text-destructive-foreground peer-data-[active=true]/menu-button:text-destructive-foreground"
      >
        {/* Über 99 wird die Zahl breiter als das Abzeichen. */}
        {ungelesen > 99 ? "99+" : ungelesen}
      </SidebarMenuBadge>

      {/* Eingeklappt (Icon-Sidebar): der Baustein oben blendet sich dort per
          `group-data-[collapsible=icon]:hidden` aus — dann bliebe genau in der
          platzsparenden Ansicht, in der man das Icon allein sieht, jeder
          Hinweis weg. Ersatz ist ein Punkt an der Ecke des Icons; für eine
          Zahl ist dort kein Platz. `aria-hidden`, weil das Abzeichen darüber
          die Bedeutung schon trägt — sonst liest der Screenreader sie zweimal. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1.5 hidden size-2 rounded-full bg-destructive group-data-[collapsible=icon]:block"
      />
    </>
  );
}
