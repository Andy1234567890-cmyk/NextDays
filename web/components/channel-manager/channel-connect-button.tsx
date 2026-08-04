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
  type OtaRoom,
  type PortalField,
  type PortalValue,
  type StoredChannelConnection,
  type SupportedPortal,
  beginChannelOAuth,
  connectChannel,
  finalizeOAuthChannel,
  getChannelOAuthStatus,
  listChannelConnections,
  listPortals,
  prepareChannel,
  reconcileTenant,
} from "@/lib/channex";
import { listProperties } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

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
  room_type_code: number;
  roomLabel: string;
  rateSummary: string; // die Raten des OTA-Zimmers, nur zur Anzeige
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
    // Passt der Booking-Zimmername zum Vorschlag eines noch freien Objekts?
    const match = localRooms.find(
      (lr) =>
        !used.has(lr.local_property_id) &&
        lr.suggested_bcrt_name &&
        otaName.includes(norm(lr.suggested_bcrt_name)),
    );
    if (match) used.add(match.local_property_id);
    return {
      room_type_code: Number(room.id),
      roomLabel: room.title ?? `Zimmer ${room.id}`,
      rateSummary: rates.map((r) => r.title ?? `Rate ${r.id}`).join(" · "),
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
  const [copied, setCopied] = useState(false);

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
  function startOAuth(portal: SupportedPortal) {
    // KEIN Objekt-Zwang: genau das war der Zirkelschluss für den Wechselkunden —
    // um seine Airbnb-Objekte zu importieren, hätte er erst eins anlegen müssen.
    // Ohne Objekt läuft der konto-weite Weg; danach holt „Von Portalen holen"
    // (reconcileTenant) die Listings als Objekte herein.
    setOauthUrl(null);
    setOauthConnected(false);
    setOauthHostId(null);
    setCopied(false);
    setStep("oauth");
    startTransition(async () => {
      const res = await beginChannelOAuth({
        property_id: propertyId,
        portal_code: portal.code,
      });
      if (res.ok) {
        setOauthUrl(res.data.oauth_url);
      } else {
        setError(res.error);
      }
    });
  }

  // Konto-weiter Abschluss (Wechselkunde): Channex hat die Airbnb-Listings nach
  // dem Autorisieren gespiegelt — dieser Aufruf holt sie als Objekte in unsere
  // DB. Derselbe Weg wie der Onboarding-Knopf „Von Portalen holen", nicht ein
  // zweiter Import.
  function importAirbnbObjects() {
    setObjectImportMsg(null);
    setError(null);
    startTransition(async () => {
      const res = await reconcileTenant();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const anzahl = res.data.created + res.data.updated;
      setObjectImportMsg(
        anzahl > 0
          ? `${anzahl} Objekt(e) übernommen. Du findest sie unter „Objekte“.`
          : "Noch keine Objekte gefunden. Airbnb braucht manchmal einen Moment — " +
            "bitte in einer Minute erneut versuchen.",
      );
      onDone?.();
    });
  }

  // Status prüfen: ist die OAuth-Verbindung inzwischen aktiv (host_id da)?
  const checkOAuthStatus = useCallback(async () => {
    // Ohne Objekt wird die konto-weite Verbindung gepollt (Wechselkunde) —
    // `propertyId` darf hier nicht mehr abbrechen.
    if (!selected) return;
    const res = await getChannelOAuthStatus(propertyId ?? null, selected.code);
    if (res.ok) {
      setOauthConnected(res.data.connected);
      setOauthHostId(res.data.host_id);
    }
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

  // Realtime-Pflicht: ein Verbindungs-Update (host_id geschrieben durch das
  // Status-Polling, evtl. in einer anderen Session) kommt ohne Reload an.
  const oauthWaiting = step === "oauth" && !!selected && !oauthConnected;
  useRealtime({
    table: "channex_channel_connection",
    filter: propertyId ? `property_id=eq.${propertyId}` : undefined,
    enabled: oauthWaiting,
    onChange: () => void checkOAuthStatus(),
  });

  // Fallback-Poll (Channex liefert keine Channel-Webhooks): solange der Dialog
  // im OAuth-Schritt offen und noch nicht verbunden ist, alle 5 s prüfen.
  useEffect(() => {
    if (!oauthWaiting) return;
    void checkOAuthStatus();
    const t = window.setInterval(() => void checkOAuthStatus(), 5000);
    return () => window.clearInterval(t);
  }, [oauthWaiting, checkOAuthStatus]);

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
                        {conn &&
                          (conn.is_active ? (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              Verbunden
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
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon
                        icon="ph:spinner"
                        className="size-4 animate-spin"
                      />
                      Warte auf die Bestätigung über Airbnb …
                    </p>
                  </div>
                )}

                {oauthConnected && (
                  <div className="flex flex-col gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <Icon icon="ph:check-circle" className="size-5" />
                      Verbunden{oauthHostId ? ` · Host-ID ${oauthHostId}` : ""}
                    </p>
                    {propertyId ? (
                      <Button onClick={loadOAuthMapping} disabled={pending}>
                        {pending ? (
                          <Spinner text="Lade Listings …" />
                        ) : (
                          "Weiter zur Zuordnung"
                        )}
                      </Button>
                    ) : (
                      /* Konto-weiter Connect (Wechselkunde): es gibt noch kein
                         Objekt zum Zuordnen — die Objekte ENTSTEHEN aus den
                         Listings. Channex spiegelt sie nach dem Autorisieren,
                         `reconcileTenant` holt sie zu uns. */
                      <div className="flex flex-col gap-2">
                        <p className="text-sm text-muted-foreground">
                          Deine Airbnb-Objekte werden jetzt übernommen. Das kann
                          einen Moment dauern.
                        </p>
                        <Button onClick={importAirbnbObjects} disabled={pending}>
                          {pending ? (
                            <Spinner text="Objekte werden geholt …" />
                          ) : (
                            "Objekte übernehmen"
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
                  <ErrorBox text="Das Portal liefert keine Zimmer. Prüfe die Zugangsdaten." />
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
                          Diese Portal-Kennung führt {rows.length} Einheiten,
                          dieses Objekt ist eine davon — wähle die passende.
                          Gehören dir mehrere, lege für jede ein eigenes Objekt
                          an und weise sie im Standort-Tab demselben Gebäude zu;
                          sie teilen sich dann diese Kennung.
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
