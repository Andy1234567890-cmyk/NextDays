"use client";

// Die Glocke in der Topbar: ungelesene Benachrichtigungen mit Abzeichen,
// Aufklappliste, Quittieren. Realtime-Pflicht — die Meldungen kommen aus dem
// System (Sync-Probleme, fehlende Fotos), nicht aus einer eigenen Aktion, also
// darf die UI nicht auf einen Reload warten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  type GlockeEintrag,
  glockeAlleGelesen,
  glockeGelesen,
  listGlocke,
} from "@/lib/glocke";
import { useRealtime } from "@/lib/use-realtime";
import { Button } from "@nextdays/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";

// Icon je Katalog-Kategorie. Unbekannte Kategorie → neutrale Glocke statt
// Absturz: der Katalog wächst im Backend, und eine neue Kategorie darf die
// Anzeige nicht sprengen (Wurzel 4 — kein geratenes Icon, aber auch kein Crash).
const KATEGORIE_ICON: Record<string, string> = {
  listing_activity: "ph:house-line",
  account_activity: "ph:user-circle",
  guest_policies: "ph:scroll",
  host_policies: "ph:scroll",
  reminders: "ph:alarm",
  messages: "ph:chat-circle",
  // Eigenes Warnsymbol statt der generischen Glocke: eine nicht zugestellte
  // Gastnachricht ist kein Hinweis, sondern offene Arbeit — der Gast wartet.
  zustellproblem: "ph:warning-circle",
  // Die vier Kategorien, deren Empfaenger ein EIGENTUEMER ist. Sie standen
  // hier nicht, weil die Glocke lange nur in der Agentur-Topbar hing; im
  // Portal trugen damit alle vier dasselbe neutrale Symbol, und der Blick
  // konnte „Buchung an deinem Objekt" nicht von „Antwort auf deinen
  // Sperrantrag" unterscheiden.
  owner_booking: "ph:calendar-check",
  owner_service: "ph:wrench",
  block_decision: "ph:hand-palm",
  block_freigabe: "ph:users-three",
  // Die Gegenstuecke auf der Betriebsseite — dieselbe Luecke.
  betrieb_buchung: "ph:calendar-plus",
  block_request: "ph:hand-palm",
  task_assigned: "ph:list-checks",
  task_substitution: "ph:user-switch",
  anfrage_offen: "ph:question",
  ki_eskalation: "ph:sparkle",
  portal_rate_verwaist: "ph:tag",
  testphase_endet: "ph:hourglass",
};

export function Glocke() {
  const t = useTranslations("common");
  const tg = useTranslations("glocke");
  const [eintraege, setEintraege] = useState<GlockeEintrag[]>([]);
  const [ungelesen, setUngelesen] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await listGlocke();
    if (res.ok) {
      setEintraege(res.data.eintraege);
      setUngelesen(res.data.ungelesen);
      setFehler(null);
    } else {
      setFehler(res.error);
    }
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Kein Filter auf user_id: die RLS-Policy liefert ohnehin nur die eigenen
  // Zeilen (`user_id = auth.uid()`), und ein Filter bräuchte die ID im Client.
  useRealtime({
    table: "notifications",
    onChange: () => void laden(),
  });

  async function quittieren(eintrag: GlockeEintrag): Promise<void> {
    if (eintrag.gelesen_am) return;
    await glockeGelesen(eintrag.id);
    // Kein manuelles Nachladen — das Realtime-Abo pflegt die Liste.
  }

  async function alleQuittieren(): Promise<void> {
    await glockeAlleGelesen();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            ungelesen > 0
              ? tg("ariaMitAnzahl", { count: ungelesen })
              : t("notifications")
          }
        >
          <Icon icon="ph:bell" className="size-5" />
          {ungelesen > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.625rem] font-semibold leading-4 text-destructive-foreground">
              {/* Über 99 wird die Zahl breiter als das Abzeichen. */}
              {ungelesen > 99 ? "99+" : ungelesen}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-90 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <span className="font-display text-sm font-extrabold">
            {t("notifications")}
          </span>
          {ungelesen > 0 ? (
            <Button
              variant="ghost"
              className="h-auto px-2 py-1 text-xs"
              onClick={() => void alleQuittieren()}
            >
              {tg("alleGelesen")}
            </Button>
          ) : null}
        </div>

        <div className="max-h-100 overflow-y-auto">
          {fehler ? (
            <div className="flex items-center gap-2 px-3 py-6 text-sm">
              <Icon icon="ph:warning" className="size-4 shrink-0" />
              <span className="flex-1">{fehler}</span>
              <Button
                variant="ghost"
                className="h-auto px-2 py-1 text-xs"
                onClick={() => void laden()}
              >
                {tg("erneut")}
              </Button>
            </div>
          ) : eintraege.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              {tg("leer")}
            </p>
          ) : (
            <ul className="flex flex-col">
              {eintraege.map((e) => (
                <GlockeZeile
                  key={e.id}
                  eintrag={e}
                  onQuittieren={() => void quittieren(e)}
                />
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function GlockeZeile({
  eintrag,
  onQuittieren,
}: {
  eintrag: GlockeEintrag;
  onQuittieren: () => void;
}) {
  const icon = KATEGORIE_ICON[eintrag.kategorie] ?? "ph:bell";
  const ungelesen = !eintrag.gelesen_am;

  const inhalt = (
    <>
      <Icon
        icon={icon}
        className={
          "mt-0.5 size-4 shrink-0 " +
          (ungelesen ? "text-foreground" : "text-muted-foreground")
        }
      />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={
            "text-sm " + (ungelesen ? "font-medium" : "text-muted-foreground")
          }
        >
          {eintrag.titel}
        </span>
        {eintrag.text ? (
          <span className="text-xs text-muted-foreground">{eintrag.text}</span>
        ) : null}
      </span>
      {ungelesen ? (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-destructive" />
      ) : null}
    </>
  );

  return (
    <li className="border-b last:border-b-0">
      {/* Mit Ziel ein Link (der Klick quittiert UND navigiert), ohne Ziel nur
          ein Knopf zum Quittieren — ein Link ins Leere wäre eine Sackgasse. */}
      {eintrag.ziel_pfad ? (
        <Link
          href={eintrag.ziel_pfad}
          className="flex items-start gap-2 px-3 py-2.5 hover:bg-muted"
          onClick={onQuittieren}
        >
          {inhalt}
        </Link>
      ) : (
        <button
          type="button"
          className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-muted"
          onClick={onQuittieren}
        >
          {inhalt}
        </button>
      )}
    </li>
  );
}
