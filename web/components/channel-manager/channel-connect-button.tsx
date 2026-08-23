"use client";

// Eigene, inhouse Verbinden-Maske (KEIN externer iFrame, kein Provider sichtbar).
// 3-Schritt-Assistent nach Channex-Best-Practice (über unseren Backend-Slice):
//   1) Portal wählen + Zugangsdaten (z. B. Hotel-ID) eingeben
//   2) Zimmer/Raten des Portals den eigenen Preisplänen zuordnen
//   3) Verbinden — Backend legt an + aktiviert (Schritt prepare→connect)
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { channelLogo } from "@/lib/channel-logos";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type ChannelMapping,
  type LocalRoomOption,
  type OtaAccount,
  type OtaRoom,
  type PortalField,
  type PortalValue,
  type StoredChannelConnection,
  type SupportedPortal,
  beginChannelOAuth,
  connectChannel,
  finalizeOAuthChannel,
  getChannelOAuthStatus,
  listChannelAccounts,
  listChannelConnections,
  listPortals,
  prepareChannel,
  startAirbnbUebernahme,
  uebernehmeAirbnbListings,
} from "@/lib/channex";
import { listProperties } from "@/lib/properties";

// "oauth" = Airbnb-Verbindung über OAuth-URL (kein Credential): URL öffnen oder
// an den Eigentümer kopieren, dann auf Verbindung warten und Mapping setzen.
//
// "object" steht VOR allem anderen und ist der wichtigste Schritt: an welches
// Objekt wird die Portal-Kennung gebunden? Vorher nahm der Assistent bei
// fehlender Vorgabe stillschweigend das erste Objekt der Liste. Bei einem
// Ferienobjekt-Betrieb hat jedes Objekt seine EIGENE Portal-Kennung — die
// Booking-ID von „Haus Max" landete so an „Double Room", und danach liefen
// Buchungen, Verfügbarkeit und Preise auf das falsche Objekt.
type Step = "object" | "portal" | "credentials" | "oauth" | "mapping" | "done";

// Eine Zeile in der Zuordnungs-Tabelle: ein OTA-ZIMMER → ein eigenes Zimmer.
// Zuordnung auf Zimmer-Ebene (Cloudbeds/SiteMinder-Standard); die Raten des
// Zimmers verbindet der Server automatisch. Kein Rate-Feld im UI.
type MappingRow = {
  // STRING, nicht number: Airbnb-Listing-IDs sind 19-stellig
  // (`1133122057704952480`) und liegen über Number.MAX_SAFE_INTEGER — `Number()`
  // rundete sie zu `1133122057704952400`, also auf eine Anzeige, die es nicht
  // gibt. Booking-Codes sind kürzer und überleben beides; als String ist beides
  // korrekt, und das Backend nimmt `int | str`.
  room_type_code: string;
  roomLabel: string;
  rateSummary: string; // die Raten des OTA-Zimmers, nur zur Anzeige
  // Die Raten EINZELN — nicht nur als zusammengeklebter Text. Jede Portal-Rate
  // wird beim Verbinden zu einem eigenen Kanal-Eintrag und traegt ihre eigenen
  // Restriktionen; der Betrieb muss deshalb sehen, WIE VIELE es sind. Vorher
  // stand hier nur `rateSummary` (`rates.join(" · ")`), und eine zweite
  // Booking-Rate war in der Oberflaeche nicht von einer einzigen zu
  // unterscheiden — live bei fuenf Objekten der Fall
  // („Standard Rate" + „Wochenrate").
  rates: { code: string; label: string }[];
  pricing_type: string;
  occupancy: number;
  local_property_id: string; // gewähltes eigenes Zimmer (Objekt)
};

// Der aktuelle Wert eines Portalfelds: Eingabe des Nutzers, sonst der Default
// aus dem Kanal-Katalog (nie ein erfundener Ersatzwert).
function feldWert(
  field: PortalField,
  values: Record<string, PortalValue>,
): PortalValue {
  const v = values[field.key];
  return v === undefined ? field.default : v;
}

// Sichtbarkeit nach den Regeln des Kanal-Katalogs: `apply: "hidden"` greift,
// sobald das Einflussfeld den Wert `when` trägt (z.B. Objekt-E-Mail nur, wenn
// die Buchungsbenachrichtigung an ist). Ohne diese Auswertung fragen wir Felder
// ab, die der Kanal in dieser Konstellation gar nicht kennt.
function istSichtbar(
  field: PortalField,
  fields: PortalField[],
  values: Record<string, PortalValue>,
): boolean {
  return !field.rules.some((rule) => {
    if (rule.apply !== "hidden") return false;
    const quelle = fields.find((f) => f.key === rule.influence_field);
    if (!quelle) return false;
    return feldWert(quelle, values) === rule.when;
  });
}

// Fehlt eine sichtbare Pflichtangabe? Dann bleibt „Weiter" gesperrt.
function pflichtErfuellt(
  fields: PortalField[],
  values: Record<string, PortalValue>,
): boolean {
  return fields
    .filter((f) => f.required && istSichtbar(f, fields, values))
    .every((f) => {
      const v = feldWert(f, values);
      return v !== null && v !== undefined && String(v).trim() !== "";
    });
}

// Vorbelegung: EINE Zeile je OTA-Zimmer (nicht je Rate). Wo möglich wird das
// passende eigene Zimmer VORGEWÄHLT — anhand des aus property_type abgeleiteten
// Booking-Zimmertyps (suggested_bcrt_name, z.B. „Double") gegen den OTA-Zimmer-
// namen. So muss der Kunde keine Booking-Zimmer-IDs kennen. Ohne eindeutigen
// Treffer bleibt „nicht zuordnen" (kein falsches Raten). Das OTA-Hotel kann viele
// Zimmer liefern; zugeordnet werden nur die, die zu einem eigenen Zimmer gehören.
function buildMappingRows(
  otaRooms: OtaRoom[],
  localRooms: LocalRoomOption[],
  opts: { einzelnesObjekt?: string | null } = {},
): MappingRow[] {
  // Schon vorgewählte Objekte nicht doppelt zuordnen (1:1, sonst Überbuchung).
  const used = new Set<string>();
  const norm = (s: string) => s.toLowerCase().trim();
  return otaRooms.map((room) => {
    const rates = room.rates ?? [];
    const first = rates[0];
    const otaName = norm(room.title ?? "");
    // ZUERST die exakte Zuordnung: ein aus Airbnb übernommenes Objekt trägt die
    // Listing-ID der Anzeige. Das ist keine Heuristik, sondern dieselbe ID —
    // Namensraten scheitert hier ohnehin (bei 18 Anzeigen wie „013 Rævlingevej ·
    // The Fox House" gibt es keinen Zimmertyp-Namen zum Vergleichen), und ohne
    // Treffer blieb `mappings` leer und finalize antwortete mit 422.
    const exakt = localRooms.find(
      (lr) =>
        !used.has(lr.local_property_id) &&
        lr.airbnb_listing_id &&
        String(lr.airbnb_listing_id) === String(room.id),
    );
    // Sonst: passt der Booking-Zimmername zum Vorschlag eines noch freien Objekts?
    const match =
      exakt ??
      localRooms.find(
        (lr) =>
          !used.has(lr.local_property_id) &&
          lr.suggested_bcrt_name &&
          otaName.includes(norm(lr.suggested_bcrt_name)),
      );
    if (match) used.add(match.local_property_id);
    return {
      room_type_code: String(room.id),
      roomLabel: room.title ?? `Zimmer ${room.id}`,
      rateSummary: rates.map((r) => r.title ?? `Rate ${r.id}`).join(" · "),
      rates: rates.map((r) => ({
        code: String(r.id),
        label: r.title ?? `Rate ${r.id}`,
      })),
      pricing_type: first?.pricing === "OBP" ? "OBP" : "Standard",
      occupancy: first?.max_persons ?? 2,
      // Ferienobjekt mit einer einzigen Portal-Einheit: 1:1 gesetzt, es gibt
      // nichts zu wählen. Sonst der Namenstreffer oder „nicht zuordnen".
      local_property_id:
        opts.einzelnesObjekt ?? match?.local_property_id ?? "",
    };
  });
}

export function ChannelConnectButton({
  label,
  variant = "default",
  presetPortalCode,
  presetPropertyId,
  presetHotelId,
  accommodationType,
  neuesKonto = false,
  onDone,
}: {
  label?: string;
  variant?: "default" | "outline" | "accent";
  // Wenn gesetzt: der Assistent springt beim Öffnen direkt zu diesem Portal
  // (Kanal-Detailseite → „verbinden"), statt die Portal-Auswahl zu zeigen.
  presetPortalCode?: string;
  // Wenn gesetzt: GENAU dieses Objekt verbinden (Mapping-Tabelle → „Verbinden"
  // je Zeile), statt automatisch das erste Objekt zu nehmen.
  presetPropertyId?: string;
  // Wenn gesetzt: die Hotel-ID ist bereits bekannt (das Hotel ist über ein
  // anderes Zimmer schon verbunden). Der Assistent überspringt dann den Hotel-ID-
  // Schritt und geht für dieses weitere Zimmer DIREKT ins Zimmer-Mapping.
  presetHotelId?: string | null;
  // Betriebsart des Kontos. Sie entscheidet über das GANZE Modell dahinter:
  //   hotel           – alle Zimmer teilen EINE Portal-Kennung (eine Hotel-ID),
  //                     jedes Zimmer ist dort ein eigener Zimmertyp.
  //   vacation_rental – jedes Objekt hat seine EIGENE Portal-Kennung und genau
  //                     eine Einheit; eine Zimmer-Tabelle gibt es hier nicht.
  // Ohne diese Angabe zeigte der Assistent allen dieselbe Hotelmaske.
  accommodationType?: "hotel" | "vacation_rental" | null;
  // Ein WEITERES Portal-Konto verbinden statt das bestehende zu erweitern
  // (0304). Bei einer Agentur mit mehreren Zugängen der Normalfall; ohne das
  // Kennzeichen reicht der Server den bereits autorisierten Kanal zurück.
  neuesKonto?: boolean;
  // Callback nach erfolgreicher Verbindung (z.B. Route refreshen).
  onDone?: () => void;
}) {
  const t = useTranslations("channels");
  // Die Betriebsart bestimmt nur noch die WORTE (Zimmer vs. Objekt). Welche
  // Maske nötig ist, entscheiden die DATEN: hinter der Portal-Kennung dieses
  // Objekts stehen entweder mehrere eigene Einheiten (Gebäude → Zuordnungs-
  // tabelle) oder genau eine (1:1). Das ist unabhängig davon, ob der Betrieb
  // Hotel oder Ferienvermietung ist — ein Ferienhaus mit drei Wohnungen
  // braucht dieselbe Tabelle wie ein Hotel.
  const zimmerWelt = accommodationType === "hotel";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("portal");

  const [portals, setPortals] = useState<SupportedPortal[]>([]);
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportedPortal | null>(null);
  const [values, setValues] = useState<Record<string, PortalValue>>({});
  // Freier Kanal-Titel (wie in der Referenz-Oberfläche); leer = Portalname.
  const [title, setTitle] = useState("");
  // Optionale Einstellungen des Kanals eingeklappt (Advanced Settings).
  const [erweitertOffen, setErweitertOffen] = useState(false);
  // Bereits gespeicherte Verbindungen des gewählten Objekts (für Vorbefüllung
  // der Hotel-ID + Status-Hinweis pro Portal).
  const [connections, setConnections] = useState<StoredChannelConnection[]>([]);

  // Nur der Setter wird gebraucht: die Portal-Zimmer landen direkt in `rows`,
  // der rohe Stand wird nirgends gerendert.
  const [, setOtaRooms] = useState<OtaRoom[]>([]);
  const [localRooms, setLocalRooms] = useState<LocalRoomOption[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  // OAuth-Flow (Airbnb): erzeugte OAuth-URL, Verbundenheits-Status, Host-ID.
  const [oauthUrl, setOauthUrl] = useState<string | null>(null);
  const [oauthConnected, setOauthConnected] = useState(false);
  const [objectImportMsg, setObjectImportMsg] = useState<string | null>(null);
  const [oauthHostId, setOauthHostId] = useState<string | null>(null);
  // Vom Portal gemeldeter Grund, warum die Verbindung nicht steht.
  const [oauthError, setOauthError] = useState<string | null>(null);
  // Zeitpunkt, ab dem gepollt wird — begrenzt das Warten (siehe unten).
  const [oauthSince, setOauthSince] = useState<number | null>(null);
  const [oauthAufgegeben, setOauthAufgegeben] = useState(false);
  const [copied, setCopied] = useState(false);

  // ALLE Portal-Konten des Betriebs (0304). Eine Agentur führt mehrere Zugänge
  // je Portal, und beim Zuordnen muss sie sagen können, WELCHER gemeint ist —
  // sonst greift der Dialog stumm zum ersten. Live am 07.08.2026: er zeigte
  // „Host-ID 529591717" und siebzehn Anzeigen von AirSmil, während der Betrieb
  // gerade Torstens Zugang (226976381) zuordnen wollte.
  //
  // Der Scope ist der MANDANT: eine Agentur sieht alle ihre Konten, nie die
  // einer anderen (das erzwingt der Server, `portal_konten` filtert auf
  // `tenant_id`).
  const [konten, setKonten] = useState<OtaAccount[]>([]);
  const [kontoId, setKontoId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    startTransition(async () => {
      const [p, props] = await Promise.all([listPortals(), listProperties()]);
      if (p.ok) setPortals(p.data);
      if (!props.ok || props.data.items.length === 0) return;
      const liste = props.data.items.map((it) => ({ id: it.id, title: it.title }));
      setProperties(liste);
      // Objekt NUR setzen, wenn es eindeutig ist: entweder vorgegeben (Aufruf
      // vom Objekt aus) oder es gibt genau eines. Sonst fragt der Assistent —
      // ein stilles „nimm das erste" bindet die Portal-Kennung an ein fremdes
      // Objekt, und das fällt erst auf, wenn dort Buchungen einlaufen.
      const preset = presetPropertyId
        ? liste.find((it) => it.id === presetPropertyId)
        : undefined;
      const eindeutig = preset ?? (liste.length === 1 ? liste[0] : undefined);
      if (eindeutig) {
        setPropertyId(eindeutig.id);
      } else {
        setStep("object");
      }
    });
  }, [open, presetPropertyId]);

  // Die Konten des Betriebs laden, sobald ein OAuth-Portal gewählt ist.
  // Vorbelegt wird nur bei GENAU EINEM Konto — bei mehreren fragt der Dialog,
  // statt eines zu nehmen: ein stilles „nimm das erste" ordnet die Anzeige dem
  // falschen Vermieter zu, und das fällt erst auf, wenn dort Buchungen
  // einlaufen (dieselbe Begründung wie bei der Objektwahl darüber).
  useEffect(() => {
    if (!open || !selected) return;
    let aktiv = true;
    void listChannelAccounts(selected.code).then((res) => {
      if (!aktiv || !res.ok) return;
      setKonten(res.data.items);
      const verbunden = res.data.items.filter((k) => k.channel_id);
      setKontoId(verbunden.length === 1 ? verbunden[0].id : null);
    });
    return () => {
      aktiv = false;
    };
  }, [open, selected]);

  // Kanal-Detailseite: direkt auf das gewählte Portal springen, sobald Portale
  // UND (falls Credential-Portal) die gespeicherten Verbindungen geladen sind —
  // sonst wäre die Hotel-ID-Vorbefüllung leer.
  //
  // Wurzel 2 (real kommt alles doppelt): OAuth-Portale legen beim Vorwählen
  // sofort einen inaktiven Kanal an (beginChannelOAuth → POST /channels). Der
  // Effekt darf daher pro Öffnen NUR EINMAL feuern — ein reiner State-Guard
  // (`selected`) hat eine Renderlücke (StrictMode-Doppelmount, Batching), die
  // einen POST-Flood erzeugt. Deshalb ein harter Ref-Riegel, der erst beim
  // Schließen zurückgesetzt wird.
  const presetFired = useRef(false);
  useEffect(() => {
    if (!open) {
      presetFired.current = false;
      return;
    }
    if (presetFired.current || !presetPortalCode || step !== "portal" || selected) {
      return;
    }
    const target = portals.find((p) => p.code === presetPortalCode);
    if (!target) return;
    if (target.connection_type !== "oauth" && !propertyId) return;
    presetFired.current = true;
    choosePortal(target);
    // choosePortal ist stabil (nur setState); Abhängigkeit bewusst auf die
    // Lade-Signale beschränkt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetPortalCode, portals, propertyId, connections, step, selected]);

  // Gespeicherte Verbindungen des aktuell gewählten Objekts laden (Vorbefüllung
  // der Hotel-ID + Status-Hinweise je Portal).
  useEffect(() => {
    if (!open || !propertyId) {
      setConnections([]);
      return;
    }
    startTransition(async () => {
      const res = await listChannelConnections(propertyId);
      setConnections(res.ok ? res.data.items : []);
    });
  }, [open, propertyId]);

  function reset() {
    // Ist das Objekt nicht eindeutig, beginnt der Assistent wieder bei der
    // Objektwahl — auch beim „weiteres Portal verbinden".
    setStep(propertyId ? "portal" : "object");
    setSelected(null);
    setValues({});
    setTitle("");
    setErweitertOffen(false);
    setOtaRooms([]);
    setLocalRooms([]);
    setRows([]);
    setError(null);
    setOauthUrl(null);
    setOauthConnected(false);
    setOauthHostId(null);
    setCopied(false);
    // Die Rückmeldung eines FRÜHEREN Imports darf nicht stehen bleiben: sie
    // beschreibt einen abgeschlossenen Vorgang („18 Objekt(e) übernommen"), und
    // beim nächsten Öffnen liest sie sich wie das Ergebnis dieses Aufrufs.
    setObjectImportMsg(null);
  }

  function close() {
    setOpen(false);
    setDone(null);
    reset();
  }

  // Feld-Defaults aus dem Portal-Katalog (z.B. Betriebs-E-Mail, vom Backend
  // vorbefüllt), damit E-Mail & Co. nicht leer sind und der Kunde sie nicht
  // abtippen muss. Nur nicht-leere Defaults übernehmen (kein leerer Wert).
  function fieldDefaults(portal: SupportedPortal): Record<string, PortalValue> {
    const out: Record<string, PortalValue> = {};
    for (const f of portal.fields) {
      if (f.default !== null && f.default !== undefined) out[f.key] = f.default;
    }
    return out;
  }

  function choosePortal(portal: SupportedPortal) {
    setSelected(portal);
    setError(null);
    // OAuth-Portale (Airbnb): kein Credential — direkt in den OAuth-Flow.
    if (portal.connection_type === "oauth") {
      setValues({});
      startOAuth(portal);
      return;
    }
    // Hotel-ID aus einer bereits gespeicherten Verbindung vorbefüllen, damit der
    // Vermieter sie beim Re-Connect nicht erneut eingeben muss.
    const stored = connections.find((c) => c.portal_code === portal.code);
    const firstField = portal.fields[0]?.key;
    const defaults = fieldDefaults(portal);
    // Ist das Hotel über ein anderes Zimmer schon verbunden (presetHotelId), MUSS
    // der Kunde die Hotel-ID nicht erneut eingeben — für dieses WEITERE Zimmer
    // direkt ins Zimmer-Mapping springen (1 Hotel-ID, Zimmer darunter). Der
    // Kunde kennt keine „Zimmer-ID" — die Zuordnung wählt er im Mapping-Schritt.
    const knownHotelId = presetHotelId || stored?.hotel_id || null;
    if (knownHotelId && firstField) {
      const prefilled = { ...defaults, [firstField]: knownHotelId };
      setValues(prefilled);
      loadMapping(portal, prefilled);
      return;
    }
    setValues(
      stored && firstField
        ? { ...defaults, [firstField]: stored.hotel_id }
        : defaults,
    );
    setStep("credentials");
  }

  // OAuth-Start (Airbnb): inaktiven Kanal anlegen + echte OAuth-URL holen.
  //
  // ZWEI Wege, je nachdem ob es schon ein Objekt gibt:
  //  - mit Objekt   → der normale, objektgebundene OAuth-Start
  //  - ohne Objekt  → die ÜBERNAHME: der Server legt das eine Objekt an, das
  //    Channex für die Autorisierung zwingend braucht (`connection_link` ohne
  //    Property → 422, live geprüft), und füllt es danach aus dem Airbnb-Listing.
  //    Der Kunde tippt nichts — genau das ist der Zirkelschluss, den er nicht
  //    selbst auflösen soll.
  function startOAuth(portal: SupportedPortal) {
    setOauthUrl(null);
    setOauthConnected(false);
    setOauthHostId(null);
    setCopied(false);
    setStep("oauth");
    startTransition(async () => {
      // Rücksprungziel aus dem Browser lesen — die Server-Action kennt weder
      // `window` noch die öffentliche Adresse dieser Anwendung.
      const ziel = window.location.href;
      const res = propertyId
        ? await beginChannelOAuth({
            property_id: propertyId,
            portal_code: portal.code,
            neues_konto: neuesKonto,
            redirect_uri: ziel,
          })
        : await startAirbnbUebernahme(false, ziel);
      if (res.ok) {
        setOauthUrl(res.data.oauth_url);
      } else {
        setError(res.error);
      }
    });
  }

  // Nach dem Autorisieren: die Airbnb-Listings als Objekte holen.
  //
  // Bewusst NICHT `reconcileTenant`: der spiegelt Channex-PROPERTIES, und
  // Airbnb-Listings werden bei Channex gemappt statt als Properties angelegt
  // (Katalog: `mapping_mode: "listing"`, live gelesen). Es entstünde also
  // nichts. Die Übernahme liest die Listing-Liste aus `mapping_details` und
  // baut daraus die Objekte. Sie bringt Titel, Stadt, Land und Kapazität mit —
  // mehr gibt Airbnb über Channex nicht her, insbesondere KEINE Preise
  // (Belege in apps/api/.../airbnb_uebernahme.py).
  function importAirbnbObjects() {
    setObjectImportMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await uebernehmeAirbnbListings(kontoId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const anzahl = res.data.created + res.data.updated;
      // `skipped` ehrlich ausweisen statt still zu schlucken: der Kunde muss
      // sehen, wenn ein Listing nicht übernehmbar war.
      const rest =
        res.data.skipped > 0
          ? ` ${res.data.skipped} Objekt(e) konnten nicht übernommen werden.`
          : "";
      // Die Preis-Lücke wird GENANNT, nicht verschwiegen: Airbnb gibt über
      // Channex keine Preise heraus (nur Titel, Stadt, Land, Kapazität). Wer
      // das nicht liest, wartet vergeblich darauf, dass Preise „noch kommen".
      // Der Preis ist KEINE Nebensache, sondern der nächste Pflichtschritt: das
      // Portal verlangt beim Zuordnen Zimmer UND Tarif. Ohne Preis gibt es
      // keinen Tarif, und die Anzeigen bleiben dort „nicht zugeordnet".
      // Wie viele Anzeigen das Portal übergeben hat, wird GENANNT: Airbnb
      // liefert Anzeigen nicht mit, die dort schon an eine andere Software
      // gebunden sind (Sync-Status „Connected"), ebenso unlisted/snoozed und
      // CoHost-Anzeigen. Live: Airbnb führte 19, geliefert wurden 18. Ohne
      // diese Zahl sucht der Betrieb ein fehlendes Objekt vergeblich.
      const gefunden =
        res.data.listings_gefunden > 0
          ? ` Airbnb hat ${res.data.listings_gefunden} Anzeige(n) übergeben — ` +
            "fehlt eine, ist sie bei Airbnb noch mit einer anderen Software " +
            "verbunden oder nicht veröffentlicht."
          : "";
      setObjectImportMsg(
        anzahl > 0
          ? `${anzahl} Objekt(e) übernommen — du findest sie unter „Objekte“. ` +
            "Preise musst du nicht abtippen: sie kommen beim Verbinden aus " +
            "deiner Airbnb-Anzeige mit. Prüfe sie danach unter „Preise“ — von " +
            `dort gehen deine Preise an alle Portale.${gefunden}${rest}`
          : "Noch keine Objekte gefunden. Airbnb braucht nach dem Verbinden " +
            "manchmal einen Moment — bitte in einer Minute erneut versuchen.",
      );
      onDone?.();
    });
  }

  // Status prüfen: ist die OAuth-Verbindung inzwischen aktiv (host_id da)?
  const checkOAuthStatus = useCallback(async () => {
    // Ohne Objekt gibt es noch keine pollbare Verbindung: bei der Übernahme
    // entsteht das Objekt erst serverseitig, und die Verbindung hängt daran.
    // Der Kunde sieht stattdessen „Objekte übernehmen" — dessen Ergebnis ist
    // die Rückmeldung, kein zweiter Statuspfad (der pollte ins Leere).
    if (!selected || !propertyId) return;
    const res = await getChannelOAuthStatus(propertyId, selected.code);
    if (res.ok) {
      setOauthConnected(res.data.connected);
      setOauthHostId(res.data.host_id);
      // Einen vom Portal gemeldeten Grund ZEIGEN. Vorher wurde `last_error`
      // verworfen: der Kunde sah endlos "Warte auf die Bestätigung …", während
      // Airbnb die Autorisierung längst abgelehnt hatte (etwa weil dort schon
      // eine andere Software verbunden ist — Airbnb erlaubt nur EINE).
      setOauthError(res.data.last_error ?? null);
      return;
    }
    // FEHLER BEENDET DEN POLL. Vorher wurde ein Fehler stillschweigend
    // verworfen und beim nächsten Takt erneut erzeugt — bei einem bei Channex
    // entfernten Kanal lief das endlos (hunderte 404er, Ratelimit-Verbrauch,
    // während die UI weiter "warten" anzeigte). Ein Statusabruf, der scheitert,
    // ist ein Ergebnis: anzeigen und aufhören (Wurzel 5).
    setOauthError(res.error);
    setOauthAufgegeben(true);
  }, [propertyId, selected]);

  // OAuth-Link öffnen bzw. in die Zwischenablage kopieren (Self-Connect durch
  // den Eigentümer, wenn der Vermieter keinen Airbnb-Zugang hat).
  function openOAuth() {
    if (oauthUrl) window.open(oauthUrl, "_blank", "noopener,noreferrer");
  }
  async function copyOAuth() {
    if (!oauthUrl) return;
    try {
      await navigator.clipboard.writeText(oauthUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Link konnte nicht kopiert werden.");
    }
  }

  // Nach „verbunden": Mapping laden (bestehender Pfad) und finalisieren.
  function loadOAuthMapping() {
    if (!selected || !propertyId) return;
    setError(null);
    startTransition(async () => {
      const res = await prepareChannel({
        property_id: propertyId,
        portal_code: selected.code,
        settings: {},
        account_id: kontoId,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOtaRooms(res.data.ota_rooms);
      setLocalRooms(res.data.rooms);
      setRows(
        buildMappingRows(res.data.ota_rooms, res.data.rooms, {
          // Ferienobjekt mit genau einer Portal-Einheit: die Zuordnung ist
          // zwingend 1:1 und wird nicht erfragt.
          einzelnesObjekt:
            res.data.rooms.length === 1 && res.data.ota_rooms.length === 1
              ? propertyId
              : null,
        }),
      );
      setStep("mapping");
    });
  }

  // `oauthUrl` ist Teil der Bedingung, weil die Verbindungszeile ERST bei
  // erfolgreichem `begin` entsteht. Scheitert das (z.B. 409, weil das Objekt
  // noch nicht bei Channex registriert ist), gibt es nichts zu pollen — vorher
  // lief der 5-Sekunden-Takt dann endlos in 404er (im Serverlog belegt).
  const oauthWaiting =
    step === "oauth" && !!selected && !!oauthUrl && !!propertyId &&
    !oauthConnected && !oauthAufgegeben;

  // KEIN Realtime-Abo auf channex_channel_connection an dieser Stelle.
  // Es war eine RÜCKKOPPLUNG: der Status-Poll schreibt host_id/last_error per
  // PATCH, das PATCH löst ein Realtime-Event aus, das Event rief den Poll
  // erneut — Poll → PATCH → Event → Poll. Statt der gedachten 5 Sekunden lief
  // der Takt dadurch mehrmals pro Sekunde und erzeugte Dauerlast auf Channex,
  // DB und Browser (im Serverlog: ein get_channel alle ~0,5 s).
  //
  // Ein Abo ist hier auch fachlich unnötig: die einzige Quelle neuer
  // Information ist Channex selbst, und die fragt genau dieser Poll ab. Er ist
  // die Aktualisierung, nicht ihr Auslöser (Realtime-Pflicht gilt für Daten,
  // die ANDERE ändern — hier ändert sie dieser Dialog selbst).

  // Fallback-Poll (Channex liefert keine Channel-Webhooks): solange der Dialog
  // im OAuth-Schritt offen und noch nicht verbunden ist, alle 5 s prüfen —
  // aber NICHT unbegrenzt. Lehnt das Portal die Autorisierung ab (z.B. weil dort
  // schon eine andere Software verbunden ist), kommt nie eine Bestätigung; der
  // Takt lief dann endlos weiter und erzeugte hunderte Channex-Aufrufe, die auf
  // das konto-weite Channex-Budget gehen. Nach POLL_MAX_MS wird aufgegeben und
  // dem Kunden gesagt, was er prüfen soll.
  useEffect(() => {
    if (!oauthWaiting) return;
    const POLL_MAX_MS = 180_000;
    const start = oauthSince ?? Date.now();
    if (oauthSince === null) setOauthSince(start);

    void checkOAuthStatus();
    const t = window.setInterval(() => {
      if (Date.now() - start > POLL_MAX_MS) {
        setOauthAufgegeben(true);
        window.clearInterval(t);
        return;
      }
      void checkOAuthStatus();
    }, 5000);
    return () => window.clearInterval(t);
  }, [oauthWaiting, oauthSince, checkOAuthStatus]);

  // Status-Hinweis für ein Portal in der Auswahl-Liste (verbunden/Aktion nötig).
  function connectionFor(code: string): StoredChannelConnection | undefined {
    return connections.find((c) => c.portal_code === code);
  }

  // Schritt 1→2: Zugangsdaten prüfen + Zimmer/Raten laden. portalOverride/
  // valuesOverride erlauben den Direkteinstieg aus choosePortal (State ist dort
  // noch nicht gesetzt, weil setState asynchron ist).
  function loadMapping(
    portalOverride?: SupportedPortal,
    valuesOverride?: Record<string, PortalValue>,
  ) {
    const portal = portalOverride ?? selected;
    const settings = valuesOverride ?? values;
    if (!portal || !propertyId) {
      setError("Bitte zuerst ein Objekt anlegen.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await prepareChannel({
        property_id: propertyId,
        portal_code: portal.code,
        settings,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOtaRooms(res.data.ota_rooms);
      setLocalRooms(res.data.rooms);
      setRows(
        buildMappingRows(res.data.ota_rooms, res.data.rooms, {
          // Ferienobjekt mit genau einer Portal-Einheit: die Zuordnung ist
          // zwingend 1:1 und wird nicht erfragt.
          einzelnesObjekt:
            res.data.rooms.length === 1 && res.data.ota_rooms.length === 1
              ? propertyId
              : null,
        }),
      );
      setStep("mapping");
    });
  }

  // Schritt 2→3: Verbinden + aktivieren.
  function connect() {
    if (!selected || !propertyId) return;
    const mappings: ChannelMapping[] = rows
      .filter((r) => r.local_property_id)
      .map((r) => ({
        local_property_id: r.local_property_id,
        room_type_code: r.room_type_code,
        occupancy: r.occupancy,
        pricing_type: r.pricing_type,
      }));
    // Kanäle ohne Zimmerbegriff (Katalog: mapping_required=false) werden ohne
    // Zuordnung verbunden — bei allen anderen ist sie Pflicht.
    if (mappings.length === 0 && selected.mapping_required) {
      setError("Bitte mindestens ein Zimmer zuordnen.");
      return;
    }
    // Ein eigenes Zimmer darf höchstens EINEM OTA-Zimmer zugeordnet werden (1:1,
    // Cloudbeds-Regel: n:1 erzeugt Überbuchungen). Doppelte Zuordnung vorab
    // abfangen, statt den Nutzer in den Provider-Fehler laufen zu lassen.
    const usedRooms = mappings.map((m) => m.local_property_id);
    if (new Set(usedRooms).size !== usedRooms.length) {
      setError(
        "Jedes Zimmer darf nur einem Portal-Zimmer zugeordnet werden. " +
          "Bitte doppelte Zuordnungen auflösen.",
      );
      return;
    }
    // Hotel: JEDES Zimmer des Portals muss zugeordnet sein. Das Portal
    // aktiviert die Verbindung sonst nicht, und eine Buchung auf einem nicht
    // zugeordneten Zimmer kommt später ohne Ziel an. Vorher ging das
    // Teil-Mapping wortlos raus und die Verbindung blieb tot.
    // Mehrere eigene Einheiten hinter der Kennung → JEDE Portal-Einheit muss
    // zugeordnet sein, sonst aktiviert das Portal die Verbindung nicht.
    const offen =
      localRooms.length > 1
        ? rows.filter((r) => !r.local_property_id).map((r) => r.roomLabel)
        : [];
    if (offen.length > 0) {
      setError(
        `Diese Zimmer des Portals sind noch keinem Zimmer zugeordnet: ${offen.join(", ")}. ` +
          "Das Portal aktiviert die Verbindung erst, wenn alle zugeordnet sind — " +
          "lege die fehlenden Zimmer als Objekt an oder entferne sie beim Portal.",
      );
      return;
    }
    setError(null);
    const isOAuth = selected.connection_type === "oauth";
    startTransition(async () => {
      const res = isOAuth
        ? await finalizeOAuthChannel({
            property_id: propertyId,
            portal_code: selected.code,
            mappings,
            account_id: kontoId,
          })
        : await connectChannel({
            property_id: propertyId,
            portal_code: selected.code,
            title: title.trim() || undefined,
            settings: values,
            mappings,
          });
      if (res.ok) {
        setDone(`${selected.label} verbunden und aktiviert.`);
        setStep("done");
        onDone?.();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      <Button type="button" variant={variant} onClick={() => setOpen(true)}>
        <Icon icon="ph:plugs-connected" className="size-4" />
        {label ?? t("connectChannels")}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">
                Buchungsportal verbinden
              </h2>
              <button
                type="button"
                onClick={close}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("close")}
              >
                <Icon icon="ph:x" className="size-5" />
              </button>
            </div>

            {/* An WELCHES Objekt die Portal-Kennung gebunden wird, steht in
                jedem Schritt sichtbar im Kopf. Ohne das lässt sich von außen
                nicht erkennen, ob man gerade das richtige Objekt verbindet. */}
            {propertyId && step !== "object" && step !== "done" && (
              <p className="-mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Icon icon="ph:house" className="size-4 shrink-0" />
                {properties.find((p) => p.id === propertyId)?.title ?? ""}
                {properties.length > 1 && !presetPropertyId && (
                  <button
                    type="button"
                    onClick={() => setStep("object")}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    ändern
                  </button>
                )}
              </p>
            )}

            {/* Schritt 0: Objekt wählen (nur wenn nicht eindeutig) */}
            {step === "object" ? (
              <div className="flex flex-col gap-3">
                {properties.length === 0 ? (
                  /* Kein Objekt vorhanden = der WECHSELKUNDE. Eine leere
                     Auswahlliste wäre hier eine Sackgasse; stattdessen geht es
                     direkt zur Portalwahl. Bei Airbnb legt der Server das Objekt
                     selbst an (Übernahme), bei den übrigen Portalen kommt die
                     Meldung des Servers, dass zuerst ein Objekt nötig ist. */
                  <>
                    <p className="text-sm text-muted-foreground">
                      Du hast noch keine Objekte. Verbinde Airbnb — deine
                      bestehenden Airbnb-Objekte werden dann automatisch
                      übernommen, mit Name, Adresse und Beschreibung.
                    </p>
                    <Button
                      onClick={() => setStep("portal")}
                      className="self-start"
                    >
                      <Icon icon="ph:arrow-right" className="size-4" />
                      Portal wählen
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {zimmerWelt
                        ? "Für welches Zimmer soll die Portal-Verbindung gelten?"
                        : "Welches Objekt soll mit dem Portal verbunden werden?"}
                    </p>
                    <div className="grid gap-2">
                      {properties.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setPropertyId(p.id);
                            setStep("portal");
                          }}
                          className="flex items-center gap-3 rounded-(--radius) border border-border p-3 text-left transition-colors hover:bg-secondary"
                        >
                          <Icon
                            icon="ph:house"
                            className="size-5 shrink-0 text-muted-foreground"
                          />
                          <span className="truncate font-medium">{p.title}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : /* Schritt: DONE */
            step === "done" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Icon icon="ph:check-bold" className="size-6" />
                </span>
                <p className="font-medium">{done}</p>
                <p className="text-sm text-muted-foreground">
                  Verfügbarkeit und Preise werden ab sofort automatisch
                  abgeglichen.
                </p>
                <div className="flex gap-2">
                  <Button onClick={reset} variant="outline">
                    Weiteres Portal verbinden
                  </Button>
                  <Button onClick={close}>Fertig</Button>
                </div>
              </div>
            ) : step === "portal" ? (
              /* Schritt 1: Portal wählen */
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                  Wähle das Portal, das du verbinden möchtest:
                </p>
                <div className="grid gap-2">
                  {portals.map((p) => {
                    const conn = connectionFor(p.code);
                    return (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => choosePortal(p)}
                        className="flex items-center gap-3 rounded-(--radius) border border-border p-3 text-left transition-colors hover:bg-secondary"
                      >
                        {/* Feste Logo-Spalte, damit ALLE Namen bündig starten —
                            egal ob das Portal ein Logo hat oder nicht. */}
                        <span className="flex w-[3.75rem] shrink-0 justify-center">
                          <PortalLogo code={p.code} size={22} />
                        </span>
                        <span className="font-medium">{p.label}</span>
                        {/* DREI Zustände, nicht zwei. `is_active` heißt
                            „Zuordnung fertig und Kanal live" — nicht „Konto
                            verbunden". Bei einem OAuth-Portal ist das KONTO
                            kontoweit verbunden (Host-ID vorhanden), während die
                            Zuordnung je Objekt noch offen sein kann. Vorher
                            stand deshalb an ALLEN 18 Objekten „Aktion nötig",
                            obwohl das Airbnb-Konto längst verbunden war — der
                            Betrieb hat daraufhin immer wieder neu verbunden. */}
                        {conn &&
                          (conn.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Verbunden
                            </span>
                          ) : p.connection_type === "oauth" && conn.channel_id ? (
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                              Konto verbunden · Zuordnung offen
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                              Aktion nötig
                            </span>
                          ))}
                        <Icon
                          icon="ph:caret-right"
                          className="ml-auto size-4 text-muted-foreground"
                        />
                      </button>
                    );
                  })}
                  {portals.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {pending ? "Lädt …" : "Keine Portale verfügbar."}
                    </p>
                  )}
                </div>
              </div>
            ) : step === "oauth" && selected ? (
              /* Schritt 2 (OAuth): Airbnb-Konto verbinden */
              <div className="flex flex-col gap-4">
                <StepBack onClick={() => setStep("portal")} text="Anderes Portal" />
                <PortalHead portal={selected} />
                <p className="text-sm text-muted-foreground">
                  Verbinde dein {selected.label}-Konto. Öffne den Link selbst –
                  oder schicke ihn dem Eigentümer, falls du keinen Zugang zum
                  Konto hast.
                </p>

                {!oauthUrl && !error && (
                  <p className="text-sm text-muted-foreground">
                    <Spinner text="Verbindung wird vorbereitet …" />
                  </p>
                )}
                {error && <ErrorBox text={error} />}

                {oauthUrl && !oauthConnected && (
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={openOAuth}>
                        <Icon icon="ph:arrow-square-out" className="size-4" />
                        Jetzt verbinden
                      </Button>
                      <Button onClick={copyOAuth} variant="outline">
                        <Icon
                          icon={copied ? "ph:check" : "ph:copy"}
                          className="size-4"
                        />
                        {copied ? "Link kopiert" : "Link kopieren"}
                      </Button>
                    </div>
                    {propertyId ? (
                      <>
                        {/* Vom Portal gemeldeter Grund ZUERST — er erklärt, warum
                            nichts passiert. Häufigster Fall bei Airbnb: dort ist
                            schon eine andere Software verbunden ("You may only
                            authorize one property management app"). */}
                        {oauthError && <ErrorBox text={oauthError} />}
                        {oauthAufgegeben ? (
                          <div className="flex flex-col gap-2 rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                            <span className="flex items-center gap-2 font-medium">
                              <Icon icon="ph:warning-circle" className="size-4" />
                              Keine Bestätigung von {selected.label} erhalten
                            </span>
                            <span>
                              Das passiert vor allem, wenn in deinem{" "}
                              {selected.label}-Konto bereits eine andere Software
                              verbunden ist — dort ist nur EINE erlaubt. Trenne
                              die alte Verbindung in deinem {selected.label}-Konto
                              und versuche es dann erneut.
                            </span>
                            <Button
                              variant="outline"
                              className="self-start"
                              onClick={() => {
                                setOauthAufgegeben(false);
                                setOauthSince(null);
                                setOauthError(null);
                              }}
                            >
                              <Icon icon="ph:arrow-clockwise" className="size-4" />
                              Erneut prüfen
                            </Button>
                          </div>
                        ) : (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Icon
                              icon="ph:spinner"
                              className="size-4 animate-spin"
                            />
                            Warte auf die Bestätigung über {selected.label} …
                          </p>
                        )}
                      </>
                    ) : (
                      /* ÜBERNAHME (noch kein Objekt): hier wird nicht gepollt —
                         die Verbindung hängt am Objekt, das der Server gerade
                         angelegt hat, und der Kunde ist noch bei Airbnb. Sein
                         Klick auf „Objekte übernehmen" ist das Signal, dass er
                         zurück ist; dessen Ergebnis ist die Rückmeldung. */
                      <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
                        <p className="text-sm text-muted-foreground">
                          Sobald du Airbnb bestätigt hast, hol deine Objekte
                          hierher — Name, Ort, Land und Personenzahl kommen aus
                          deinen Airbnb-Anzeigen. Du musst nichts eintippen.
                          Auch die Preise kommen mit: sie werden beim Verbinden
                          aus der jeweiligen Anzeige übernommen.
                        </p>
                        <Button
                          onClick={importAirbnbObjects}
                          disabled={pending}
                          className="self-start"
                        >
                          {pending ? (
                            <Spinner text="Objekte werden geholt …" />
                          ) : (
                            <>
                              <Icon
                                icon="ph:cloud-arrow-down"
                                className="size-4"
                              />
                              Objekte übernehmen
                            </>
                          )}
                        </Button>
                        {objectImportMsg && (
                          <p className="text-sm text-muted-foreground">
                            {objectImportMsg}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {oauthConnected && (
                  /* Verbunden. ZUERST die Objekte übernehmen, DANN zuordnen —
                     in dieser Reihenfolge, weil sonst die Zuordnung nicht
                     aufgeht: Airbnb liefert hier so viele Einheiten, wie das
                     Konto Anzeigen hat (beim Beta-Betrieb 18), unsere Seite hat
                     nach dem Verbinden aber nur das eine Gerüst-Objekt. Ohne
                     Übernahme bleiben 17 Zeilen ohne Gegenstück, `mappings`
                     bliebe leer, und finalize antwortete mit 422 („Mindestens
                     eine Zimmer/Raten-Zuordnung ist nötig") — genau das ist
                     live passiert. */
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <Icon icon="ph:check-circle" className="size-5" />
                      Verbunden{oauthHostId ? ` · Host-ID ${oauthHostId}` : ""}
                    </p>
                    {/* WELCHER Zugang? Eine Agentur führt mehrere Airbnb-Konten
                        (0304), und die Anzeigen kommen je Konto aus einem
                        anderen Token. Ohne diese Wahl nahm der Dialog stumm das
                        erste und zeigte die Anzeigen eines fremden Vermieters.
                        Bei nur einem Konto bleibt die Zeile weg — dann gibt es
                        nichts zu entscheiden. */}
                    {konten.filter((k) => k.channel_id).length > 1 && (
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="konto-wahl"
                          className="text-sm font-medium"
                        >
                          Portal-Konto
                        </label>
                        <NativeSelect
                          id="konto-wahl"
                          value={kontoId ?? ""}
                          onChange={(e) => setKontoId(e.target.value || null)}
                        >
                          <option value="">— Konto wählen —</option>
                          {konten
                            .filter((k) => k.channel_id)
                            .map((k) => (
                              <option key={k.id} value={k.id}>
                                {/* Name, sonst die Portal-Kennung. Eine rohe
                                    UUID hilft niemandem — sie sagt nichts über
                                    den Zugang aus. Fehlt beides, benennen wir
                                    den Zustand („noch ohne Kennung") statt
                                    einen Platzhalter zu erfinden (Wurzel 4). */}
                                {k.display_name
                                  ? k.hotel_id
                                    ? `${k.display_name} · ${k.hotel_id}`
                                    : k.display_name
                                  : (k.hotel_id ?? "Zugang ohne Kennung")}
                              </option>
                            ))}
                        </NativeSelect>
                      </div>
                    )}
                    {/* Die Massenübernahme gehört NUR in die Erstverbindung.
                        Kommt der Kunde von einem bestimmten Objekt („Verbinden"
                        in der Objektzeile), will er GENAU DIESES verbinden —
                        dann alle 18 Anzeigen des Kontos als neue Objekte
                        anzulegen ist das Gegenteil davon. Unterschieden wird an
                        `propertyId`: gesetzt = ein Objekt ist gewählt. */}
                    {propertyId ? (
                      <p className="text-sm text-muted-foreground">
                        Ordne jetzt zu, welche Airbnb-Anzeige zu diesem Objekt
                        gehört. Den Preis holen wir dabei aus der Anzeige — du
                        musst ihn nicht eintippen.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
                        <p className="text-sm text-muted-foreground">
                          Hol zuerst deine Airbnb-Anzeigen als Objekte hierher —
                          Name, Ort, Land und Personenzahl kommen mit. Erst
                          danach lässt sich zuordnen, welche Anzeige zu welchem
                          Objekt gehört. Die Preise kommen beim Verbinden aus
                          der jeweiligen Anzeige mit.
                        </p>
                        <Button
                          onClick={importAirbnbObjects}
                          disabled={pending}
                          className="self-start"
                        >
                          {pending ? (
                            <Spinner text="Objekte werden geholt …" />
                          ) : (
                            <>
                              <Icon
                                icon="ph:cloud-arrow-down"
                                className="size-4"
                              />
                              Objekte übernehmen
                            </>
                          )}
                        </Button>
                        {objectImportMsg && (
                          <p className="text-sm text-muted-foreground">
                            {objectImportMsg}
                          </p>
                        )}
                      </div>
                    )}
                    <Button
                      variant="outline"
                      onClick={loadOAuthMapping}
                      // Ohne gewähltes Konto nicht weiter, wenn es mehrere
                      // gibt: der Abruf liefe sonst mit dem Token eines
                      // fremden Zugangs und zeigte dessen Anzeigen.
                      disabled={
                        pending ||
                        (konten.filter((k) => k.channel_id).length > 1 &&
                          !kontoId)
                      }
                      className="self-start"
                    >
                      {pending ? (
                        <Spinner text="Lade Anzeigen …" />
                      ) : (
                        "Weiter zur Zuordnung"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : step === "credentials" && selected ? (
              /* Schritt 2: Zugangsdaten */
              <div className="flex flex-col gap-4">
                <StepBack onClick={() => setStep("portal")} text="Anderes Portal" />
                <PortalHead portal={selected} />
                {/* Vorab-Anleitung: was ZUERST im Portal-Extranet zu tun ist,
                    sonst schlägt die Verbindung ohne erkennbaren Grund fehl. */}
                {selected.setup_hint && (
                  <div className="flex gap-2 rounded-(--radius) border border-border bg-secondary/50 p-3 text-sm">
                    <Icon
                      icon="ph:info"
                      className="mt-0.5 size-4 shrink-0 text-accent"
                    />
                    <p className="whitespace-pre-line">{selected.setup_hint}</p>
                  </div>
                )}
                {/* Freier Name der Verbindung (leer = Portalname). */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="kanal-titel" className="text-sm font-medium">
                    Bezeichnung
                  </label>
                  <Input
                    id="kanal-titel"
                    // Wie bei den Portalfeldern: „Bezeichnung" ist kein Name
                    // einer Person, Chromes Heuristik würde hier aber genau
                    // den einsetzen.
                    autoComplete="nd-kanal-titel"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={selected.label}
                  />
                </div>

                {selected.fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Für dieses Portal sind keine weiteren Angaben nötig.
                  </p>
                ) : (
                  <>
                    {selected.fields
                      .filter(
                        (f) =>
                          !f.advanced &&
                          istSichtbar(f, selected.fields, values),
                      )
                      .map((f) => (
                        <PortalFeld
                          key={f.key}
                          field={f}
                          value={feldWert(f, values)}
                          onChange={(v) =>
                            setValues((prev) => ({ ...prev, [f.key]: v }))
                          }
                        />
                      ))}

                    {selected.fields.some((f) => f.advanced) && (
                      <div className="flex flex-col gap-3">
                        <button
                          type="button"
                          onClick={() => setErweitertOffen((o) => !o)}
                          className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
                        >
                          <Icon
                            icon={
                              erweitertOffen ? "ph:caret-down" : "ph:caret-right"
                            }
                            className="size-4"
                          />
                          Erweiterte Einstellungen
                        </button>
                        {erweitertOffen &&
                          selected.fields
                            .filter(
                              (f) =>
                                f.advanced &&
                                istSichtbar(f, selected.fields, values),
                            )
                            .map((f) => (
                              <PortalFeld
                                key={f.key}
                                field={f}
                                value={feldWert(f, values)}
                                onChange={(v) =>
                                  setValues((prev) => ({ ...prev, [f.key]: v }))
                                }
                              />
                            ))}
                      </div>
                    )}
                  </>
                )}

                {selected.min_price !== null && selected.min_price_currency && (
                  <p className="text-sm text-muted-foreground">
                    Mindestpreis dieses Portals:{" "}
                    {(selected.min_price / 100).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {selected.min_price_currency} pro Nacht.
                  </p>
                )}
                {error && (
                  <ErrorBox
                    text={error}
                    // Fehlt der Preis, ist das der einzige Grund, warum das Objekt
                    // nicht an die Portale übermittelt werden konnte (das Backend
                    // registriert es sonst automatisch beim Verbinden). Direkt den
                    // Weg zum Preise-Schritt anbieten, statt den Nutzer raten zu
                    // lassen.
                    action={
                      /preis/i.test(error) && propertyId
                        ? {
                            href: `/objekte/${propertyId}/preise`,
                            label: "Preis anlegen",
                          }
                        : undefined
                    }
                  />
                )}
                <Button
                  onClick={() => loadMapping()}
                  disabled={pending || !pflichtErfuellt(selected.fields, values)}
                >
                  {pending ? (
                    <Spinner text="Prüfe Zugang …" />
                  ) : (
                    "Verbindung prüfen & weiter"
                  )}
                </Button>
              </div>
            ) : step === "mapping" && selected ? (
              /* Schritt 3: Zimmer/Raten zuordnen */
              <div className="flex flex-col gap-4">
                <StepBack
                  onClick={() => setStep("credentials")}
                  text="Zugangsdaten"
                />
                <PortalHead portal={selected} />
                {!selected.mapping_required ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Dieses Portal arbeitet ohne Zimmer-Zuordnung. Du kannst die
                      Verbindung direkt herstellen.
                    </p>
                    {error && <ErrorBox text={error} />}
                    <Button onClick={connect} disabled={pending}>
                      {pending ? (
                        <Spinner text="Verbinde …" />
                      ) : (
                        "Verbinden & aktivieren"
                      )}
                    </Button>
                  </>
                ) : localRooms.length === 0 ? (
                  <ErrorBox text="Für dieses Konto sind noch keine Zimmer mit Preis angelegt. Lege zuerst ein Zimmer mit Grundpreis an." />
                ) : rows.length === 0 ? (
                  /* Bei einem OAuth-Portal gibt es keine Zugangsdaten, die man
                     prüfen könnte — der alte Text schickte den Kunden auf eine
                     Suche nach Feldern, die es nicht gibt. Dort ist die
                     Übernahme der Weg. */
                  <ErrorBox
                    text={
                      selected.connection_type === "oauth"
                        ? "Das Portal hat noch keine Objekte übergeben. Nutze „Objekte übernehmen“ — damit holen wir deine Anzeigen direkt."
                        : "Das Portal liefert keine Zimmer. Prüfe die Zugangsdaten."
                    }
                  />
                ) : localRooms.length === 1 ? (
                  /* Genau EINE eigene Einheit hinter dieser Kennung: keine
                     Tabelle. Liefert das Portal ebenfalls eine Einheit, ist die
                     Zuordnung fertig. Liefert es mehrere, führt die eingetragene
                     Kennung ein Haus mit mehreren Einheiten — dann muss der
                     Betrieb sagen, welche davon DIESES Objekt ist (oder die
                     übrigen als eigene Objekte im selben Gebäude anlegen). */
                  <>
                    {rows.length === 1 ? (
                      <div className="flex flex-col gap-2 rounded-(--radius) border border-border p-3">
                        <p className="text-sm text-muted-foreground">
                          Diese Einheit beim Portal wird mit deinem Objekt
                          verbunden:
                        </p>
                        <p className="font-medium">{rows[0].roomLabel}</p>
                        {rows[0].rateSummary && (
                          <p className="text-sm text-muted-foreground">
                            {rows[0].rateSummary}
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="rounded-(--radius) border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                          {selected.connection_type === "oauth" ? (
                            /* AIRBNB & Co.: mehrere Zeilen sind hier NICHT
                               Einheiten einer Kennung. Bei einem OAuth-Portal
                               ist die Kennung das KONTO, und jede Anzeige ist
                               ein eigenständiges Objekt an eigener Adresse — im
                               Beta-Betrieb 18 Ferienhäuser in Bindslev, Skagen,
                               Mygdal, Sindal, Vidstrup, Ålbæk, Tversted und
                               Hjørring. Der alte Text nannte sie „Einheiten
                               dieser Kennung" und riet, sie demselben GEBÄUDE
                               zuzuweisen: fachlich falsch, weil sie zu
                               verschiedenen Gebäuden gehören. */
                            <>
                              Dein Airbnb-Konto führt {rows.length} Anzeigen —
                              jede ist ein eigenes Objekt. Hier wird nur
                              zugeordnet, welche davon dieses Objekt ist; die
                              übrigen behalten ihre eigenen Objekte. Ist die
                              Anzeige schon vorausgewählt, stimmt die Zuordnung
                              bereits.
                            </>
                          ) : (
                            <>
                              Diese Portal-Kennung führt {rows.length} Einheiten,
                              dieses Objekt ist eine davon — wähle die passende.
                              Gehören dir mehrere, lege für jede ein eigenes
                              Objekt an und weise sie im Standort-Tab demselben
                              Gebäude zu; sie teilen sich dann diese Kennung.
                            </>
                          )}
                        </div>
                        <NativeSelect
                          value={String(
                            rows.find((r) => r.local_property_id)?.room_type_code ?? "",
                          )}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((row) => ({
                                ...row,
                                local_property_id:
                                  String(row.room_type_code) === e.target.value
                                    ? (propertyId ?? "")
                                    : "",
                              })),
                            )
                          }
                        >
                          <option value="">{t("noMapping")}</option>
                          {rows.map((r) => (
                            <option key={r.room_type_code} value={String(r.room_type_code)}>
                              {r.roomLabel}
                              {r.rateSummary ? ` · ${r.rateSummary}` : ""}
                            </option>
                          ))}
                        </NativeSelect>
                      </>
                    )}
                    {error && <ErrorBox text={error} />}
                    <Button onClick={connect} disabled={pending}>
                      {pending ? (
                        <Spinner text="Verbinde …" />
                      ) : (
                        "Verbinden & aktivieren"
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Ordne jedes Zimmer des Portals deinem passenden Zimmer zu
                      (jedes behält seinen eigenen Preis):
                    </p>
                    <div className="flex flex-col gap-2">
                      {rows.map((r, i) => (
                        <div
                          key={r.room_type_code}
                          className="flex flex-col gap-2 rounded-(--radius) border border-border p-3 sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{r.roomLabel}</p>
                            {r.rateSummary && (
                              <p className="truncate text-sm text-muted-foreground">
                                {r.rateSummary}
                              </p>
                            )}
                          </div>
                          <Icon
                            icon="ph:arrow-right"
                            className="hidden size-4 shrink-0 text-muted-foreground sm:block"
                          />
                          <NativeSelect
                            value={r.local_property_id}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((row, j) =>
                                  j === i
                                    ? { ...row, local_property_id: e.target.value }
                                    : row,
                                ),
                              )
                            }
                            className="sm:w-56"
                          >
                            <option value="">{t("noMapping")}</option>
                            {localRooms.map((room) => (
                              <option
                                key={room.local_property_id}
                                value={room.local_property_id}
                              >
                                {room.title}
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      ))}
                    </div>
                    {error && <ErrorBox text={error} />}
                    <Button onClick={connect} disabled={pending}>
                      {pending ? (
                        <Spinner text="Verbinde …" />
                      ) : (
                        "Verbinden & aktivieren"
                      )}
                    </Button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}

// Ein Portalfeld rendern — die Art kommt aus dem Kanal-Katalog, nicht aus einer
// eigenen Liste: Text/E-Mail/Passwort, Schalter, Auswahl, Zahl.
function PortalFeld({
  field,
  value,
  onChange,
}: {
  field: PortalField;
  value: PortalValue;
  onChange: (value: PortalValue) => void;
}) {
  if (field.type === "checkbox") {
    return (
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 rounded border-border accent-foreground"
        />
        {field.label}
      </label>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={field.key} className="text-sm font-medium">
        {field.label}
      </label>
      {field.type === "select" || field.type === "switch" ? (
        <NativeSelect
          id={field.key}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        >
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input
          id={field.key}
          // Portal-Kennungen sind KEINE Personendaten. Ohne dieses Attribut
          // errät Chrome die Bedeutung aus dem Label und trug in „Booking.com
          // Hotel-ID" den gespeicherten Namen ein — eine falsche Hotel-ID
          // scheitert erst beim Verbinden, und der Nutzer sucht den Fehler bei
          // sich. Chrome ignoriert `off` bei Textfeldern; ein unbekannter
          // Token-Name passt auf keine Kategorie und lässt das Feld leer
          // (`one-time-code` wäre falsch — das zieht SMS-Vorschläge an).
          autoComplete={`nd-${field.key}`}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          type={
            field.type === "email"
              ? "email"
              : field.type === "password"
                ? "password"
                : field.type === "number"
                  ? "number"
                  : "text"
          }
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(
              field.type === "number"
                ? e.target.value === ""
                  ? null
                  : Number(e.target.value)
                : e.target.value,
            )
          }
          placeholder={field.placeholder}
          required={field.required}
        />
      )}
    </div>
  );
}

function StepBack({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
    >
      <Icon icon="ph:arrow-left" className="size-4" />
      {text}
    </button>
  );
}

// Echtes Original-Logo eines Portals in einer EINHEITLICHEN Box (gleiche Höhe +
// Breite, zentriert, object-contain) — so sitzt jede Wortmarke/jedes Icon
// unabhängig vom Seitenverhältnis sauber im selben Rahmen (sonst „kreuz und
// quer"). Kein Logo → nichts rendern (kein Ersatz-Icon, Nutzer-Vorgabe); der
// Aufrufer reserviert die Box-Breite selbst, damit die Namen bündig bleiben.
function PortalLogo({ code, size }: { code: string; size: number }) {
  const src = channelLogo(code);
  if (!src) return null;
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ height: size, width: size * 2.5 }}
    >
      <Image
        // Marken-Logos liegen als SVG vor; der Bild-Optimierer lehnt SVG ab
        // (HTTP 400) — deshalb unverändert ausliefern.
        unoptimized
        src={src}
        alt=""
        width={size * 2.5}
        height={size}
        style={{ height: "auto", width: "auto" }}
        className="max-h-full max-w-full object-contain"
      />
    </span>
  );
}

function PortalHead({ portal }: { portal: SupportedPortal }) {
  return (
    <div className="flex items-center gap-3">
      <PortalLogo code={portal.code} size={28} />
      <span className="font-display text-lg font-bold">{portal.label}</span>
    </div>
  );
}

function ErrorBox({
  text,
  action,
}: {
  text: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-2 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <p>{text}</p>
      {action && (
        <a href={action.href} className="font-medium underline">
          {action.label}
        </a>
      )}
    </div>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <>
      <Icon icon="ph:spinner" className="size-4 animate-spin" />
      {text}
    </>
  );
}
