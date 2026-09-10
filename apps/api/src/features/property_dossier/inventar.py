"""Inventarliste je Objekt: Räume, Bestand, Schäden.

WARUM ES DAS GIBT: `inventory_items` steht seit 0012 in der DB — mit `name`
und `quantity`, einem einzigen Schreibpfad und KEINEM Lesepfad. Eine
Inventurliste braucht mehr: wo steht der Gegenstand, wie viele sollen es sein,
wie viele sind es, und was ist kaputt.

DREI WEGE HINEIN, EINE LISTE:
  * aus einem PDF vorgeschlagen (`mappe_dokumente.py` liest, hier landen die
    bestätigten Zeilen),
  * von Hand ergänzt — die Liste ist nie „fertig", ein Betrieb kauft nach,
  * beim Rundgang korrigiert (Ist-Menge, Zustand).

DER SCHADEN IST EINE EIGENE ZEILE, kein Feld am Gegenstand: ein Gegenstand geht
mehrmals kaputt, und zu jedem Vorfall gehören Foto, Melder, Datum, Betrag und
Beleg. Am Gegenstand hinge immer nur der letzte Fall.

FOTO IST PFLICHT. Ohne Bild keine Meldung — im Streitfall ist das Foto oft das
Einzige, was zählt. Erzwungen wird es hier im Service (`schaden_melden` nimmt
die Bilder entgegen und legt die Zeile NUR mit mindestens einem an), nicht per
CHECK: die Dateien liegen im Storage, die DB kann ihre Existenz nicht prüfen.

WER ZAHLT, wird beim Melden gewählt (`traeger`) — nicht wie bei den
Dienstleistungen fest auf `from_owner` verdrahtet. Hat der Gast die Lampe
zerbrochen, wird sie ihm berechnet, nicht dem Eigentümer.

DER ABRECHNUNGSPOSTEN ENTSTEHT ERST NACH BESTÄTIGUNG. Eine Reinigungskraft
meldet „Lampe kaputt" und kennt den Preis nicht; ein Posten über 0,00 wäre eine
Falschaussage in der Eigentümer-Abrechnung (Wurzel 4).
"""
from __future__ import annotations

import base64
import json
import re
import secrets
from collections.abc import Callable
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, NoReturn

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.tasks.kosten_rueckmeldung import waehrung_fuer_aufgabe

from .schemas import (
    InventarGegenstand,
    InventarRaum,
    InventarSchaden,
)

if TYPE_CHECKING:  # pragma: no cover — nur fuer die Typpruefung
    from .service import DossierError

log = get_logger("nextdays.property_dossier.inventar")

BUCKET = "inventar-schaeden"

# Bilder wie bei den Aufgaben-Fotos (0126), PDF fuer den Beleg der
# Neuanschaffung. Magic-Bytes, nicht der content_type des Clients (Wurzel 8):
# eine als image/jpeg deklarierte HTML-Datei bliebe eine HTML-Datei.
_MAGIC: tuple[tuple[bytes, str, str], ...] = (
    (b"\xff\xd8\xff", "image/jpeg", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image/png", "png"),
    (b"%PDF-", "application/pdf", "pdf"),
)
MAX_DATEI_BYTES = 20 * 1024 * 1024

# Wurzel 8: jeder unbegrenzte Bereich bekommt eine Obergrenze.
MAX_GEGENSTAENDE_JE_OBJEKT = 2_000
MAX_RAEUME_JE_OBJEKT = 60
MAX_FOTOS_JE_SCHADEN = 8

# Wurzel 8: eine 200-seitige Liste darf nicht 5000 Zeilen erzeugen.
MAX_ZEILEN_JE_PDF = 300

# Der Funktionsname fuer `site_ai_usage` (0622). MUSS hier UND im CHECK der
# Tabelle stehen — sonst steigt `_schreiben` still aus und der Tagesdeckel ist
# ausgerechnet beim teuersten Aufruf eine Attrappe.
#
# Getrennt von `mappe_dokument`, obwohl beide ein PDF durch Gemini schicken:
# das eine sucht Mappenfelder, das andere eine Tabelle. In einem Topf liesse
# sich nicht sagen, welcher den Deckel gesprengt hat.
FUNKTION_PDF = "inventar_import"

_INVENTAR_PROMPT = (
    "Du liest die Inventarliste einer Ferienunterkunft und ziehst daraus die "
    "einzelnen Gegenstaende.\n"
    "Regeln:\n"
    "- Ein Eintrag ist EIN Gegenstand mit seiner Menge, so wie er dasteht.\n"
    "- Uebernimm NUR, was im Dokument STEHT. Erfinde nichts, ergaenze nichts "
    "aus deinem Weltwissen, rate keine Mengen.\n"
    "- Steht keine Menge dabei, lass `menge` WEG. Eine geratene 1 waere eine "
    "Falschaussage in einer Inventur.\n"
    "- `raum`: die Ueberschrift, unter der der Gegenstand steht (Kueche, Bad, "
    "Schlafzimmer 1). Gibt es keine, lass das Feld weg.\n"
    "- Fasse gleiche Gegenstaende NICHT zusammen und teile sie nicht auf.\n"
    "- Lass Ueberschriften, Seitenzahlen und Unterschriftszeilen weg.\n"
    f"- Hoechstens {MAX_ZEILEN_JE_PDF} Zeilen.\n"
    "Antworte AUSSCHLIESSLICH mit einem JSON-Array, ohne Rahmentext und ohne "
    "Markdown-Zaun. Jedes Element: "
    '{"name": "Weinglas", "menge": 6, "raum": "Kueche"}.'
)

TRAEGER = ("offen", "eigentuemer", "gast", "betrieb")
SCHADEN_ART = ("beschaedigt", "fehlt", "entsorgt")


def _fehler(nachricht: str, status: int) -> DossierError:
    """Die Fehlerklasse des Slices — lokal importiert, sonst Zirkel."""
    from .service import DossierError as _DossierError  # noqa: PLC0415

    return _DossierError(nachricht, status_code=status)


_PGRST_TABELLE_FEHLT = "PGRST205"

# PostgreSQL-Codes, die eine UNGUELTIGE EINGABE beschreiben, keinen Ausfall.
# Sie muessen 422 werden, nicht 502: ein 502 sagt „unser Dienst ist kaputt",
# schickt den Nutzer zum Support und verdeckt, dass schlicht eine ID nicht
# stimmte. Angreiferkontrollierter Input darf ohnehin keinen 5xx ausloesen
# (Wurzel 5) — eine krumme UUID in der Adresszeile genuegte hier.
#   22P02 invalid_text_representation — z. B. „abc" als uuid
#   22003 numeric_value_out_of_range
#   23503 foreign_key_violation      — verwiesene Zeile gibt es nicht
#   23505 unique_violation           — Zeile existiert schon
#   23514 check_violation            — Wert ausserhalb des erlaubten Bereichs
_EINGABE_CODES = {
    "22P02": "Die Angabe ist ungültig.",
    "22003": "Der Wert liegt außerhalb des erlaubten Bereichs.",
    "23503": "Der verwiesene Eintrag existiert nicht.",
    "23505": "Diesen Eintrag gibt es bereits.",
    "23514": "Der Wert ist für dieses Feld nicht erlaubt.",
}


def _db_fehler(exc: APIError, was: str) -> DossierError:
    """Ein DB-Fehler als saubere Antwort statt als 500 (Wurzel 5)."""
    code = (getattr(exc, "code", "") or "").strip()
    if code == _PGRST_TABELLE_FEHLT:
        log.error("inventar_tabelle_fehlt", was=was, meldung=str(exc)[:300])
        return _fehler(
            "Das Inventar ist noch nicht eingerichtet: Migration 0620 ist "
            "nicht eingespielt.",
            503,
        )
    if code in _EINGABE_CODES:
        # Kein `log.error`: das ist kein Stoerfall, sondern eine abgewiesene
        # Eingabe. Als Fehler geloggt verstopft es die Ueberwachung und
        # verdeckt echte Ausfaelle.
        log.info("inventar_eingabe_abgewiesen", was=was, code=code)
        return _fehler(_EINGABE_CODES[code], 422)
    log.error("inventar_db_fehler", was=was, code=code, meldung=str(exc)[:300])
    return _fehler("Das Inventar ist gerade nicht abrufbar.", 502)


def _json_liste(roh: str) -> list[dict]:
    """Die Antwort als Liste lesen — auch mit Rahmentext oder Markdown-Zaun.

    Das Modell haelt sich meistens an „nur JSON", aber nicht immer. Was es
    real liefert, variiert: mal ein blanker Zaun, mal ein Satz davor („Hier
    ist die Liste:"), mal ein Objekt mit der Liste als Feld.

    DREI DINGE, DIE HIER FRUEHER FEHLTEN (10.09.2026, Anlass: ein 502 beim
    Kunden, der lokal nicht nachvollziehbar war):
      1. Der Rohtext wurde bei einem Parse-Fehler NICHT geloggt. Damit war
         nicht feststellbar, WAS das Modell geantwortet hatte — die Meldung
         „Die Liste konnte nicht gelesen werden." stand ohne jeden Hinweis da,
         und niemand konnte sie diagnostizieren. Debugging ist hier Pflicht,
         nicht Kür.
      2. Der Zaun wurde nur am Textanfang erkannt (`startswith`). Ein
         einleitender Satz davor liess die Regex ins Leere laufen, obwohl das
         JSON zwei Zeilen weiter unten sauber dastand.
      3. Der Fehler war 502. Eine unlesbare Modellantwort ist aber kein
         Gateway-Ausfall — 502 schickt den Nutzer zum Support, obwohl ein
         zweiter Versuch mit hoher Wahrscheinlichkeit klappt.
    """
    text = roh.strip()
    # Zaun ueberall im Text, nicht nur am Anfang: der Inhalt des ERSTEN
    # ```-Blocks gewinnt, sonst bleibt der Text, wie er ist.
    zaun = re.search(r"```[a-z]*\s*\n?(.*?)```", text, re.DOTALL)
    if zaun:
        text = zaun.group(1).strip()
    daten: object
    try:
        daten = json.loads(text)
    except json.JSONDecodeError:
        # Letzter Versuch: das aeusserste Array aus dem Rahmentext schneiden.
        # Ein Modell, das „Hier ist die Liste:" voranstellt, hat trotzdem
        # brauchbar geantwortet — das wegzuwerfen waere Verschwendung.
        klammer = re.search(r"\[.*\]", text, re.DOTALL)
        if not klammer:
            _liste_unlesbar(roh, "kein JSON-Array in der Antwort")
        try:
            daten = json.loads(klammer.group(0))
        except json.JSONDecodeError as exc:
            _liste_unlesbar(roh, f"JSON kaputt: {exc}")
    if isinstance(daten, dict):
        # Manche Antworten packen die Liste in ein Objekt.
        for wert in daten.values():
            if isinstance(wert, list):
                daten = wert
                break
    if not isinstance(daten, list):
        _liste_unlesbar(roh, f"erwartet Liste, bekam {type(daten).__name__}")
    return [d for d in daten if isinstance(d, dict)]


def _liste_unlesbar(roh: str, grund: str) -> NoReturn:
    """Laut scheitern — MIT dem Rohtext im Log.

    Ohne ihn ist der Fall nicht nachvollziehbar: der Nutzer sieht eine
    Meldung, das Log eine Zeile ohne Inhalt, und die Ursache liegt in einer
    Antwort, die niemand mehr sehen kann. 502 waere hier falsch (kein
    Gateway-Ausfall); 422 sagt „mit dieser Datei ging es nicht".
    """
    log.error(
        "inventar_antwort_unlesbar",
        grund=grund,
        laenge=len(roh),
        # Genug, um den Fall zu erkennen, ohne das Log zu fluten.
        rohtext=roh[:1500],
    )
    raise _fehler(
        "Die Liste aus dem PDF konnte nicht gelesen werden. "
        "Bitte noch einmal versuchen — bleibt es dabei, passt das Format nicht.",
        422,
    )


def _dateityp(inhalt: bytes) -> tuple[str, str]:
    """(MIME, Endung) anhand der ersten Bytes; unbekannt → 415."""
    for magic, mime, ext in _MAGIC:
        if inhalt.startswith(magic):
            return mime, ext
    # WebP steht nicht am Anfang: 'RIFF' + 4 Byte Groesse + 'WEBP'.
    if inhalt[:4] == b"RIFF" and inhalt[8:12] == b"WEBP":
        return "image/webp", "webp"
    raise _fehler("Nur JPG, PNG, WebP oder PDF.", 415)


def _raum(z: dict) -> dict:
    return {
        "id": str(z["id"]),
        "name": z["name"],
        "sortierung": z.get("sortierung") or 0,
    }


def _gegenstand(z: dict) -> dict:
    return {
        "id": str(z["id"]),
        "name": z["name"],
        "room_id": str(z["room_id"]) if z.get("room_id") else None,
        "ist_menge": z.get("quantity") or 0,
        "soll_menge": z.get("soll_menge"),
        "beschreibung": z.get("beschreibung"),
        "quelle": z.get("quelle") or "manuell",
        "geprueft_am": z.get("geprueft_am"),
        # 0623 — was eine Inventur ausmacht, nicht nur eine Bestandsliste.
        "art": z.get("art") or "bestand",
        "meldebestand": z.get("meldebestand"),
        "zaehl_rhythmus": z.get("zaehl_rhythmus") or "jaehrlich",
        "zuletzt_gezaehlt_am": z.get("zuletzt_gezaehlt_am"),
        "zustand": z.get("zustand") or "gut",
        "zustand_notiz": z.get("zustand_notiz"),
        "hat_referenz_foto": bool(z.get("referenz_foto_pfad")),
        "angeschafft_am": z.get("angeschafft_am"),
        "anschaffungswert": (
            float(z["anschaffungswert"])
            if z.get("anschaffungswert") is not None
            else None
        ),
        "anschaffung_currency": z.get("anschaffung_currency"),
    }


def _waehrung_des_objekts(db: Client, tid: str, property_id: str) -> str | None:
    """Objektwaehrung fuer den Anschaffungswert.

    Derselbe Weg wie ueberall bei Betraegen: aus den DATEN, nie hart gesetzt.
    Fehlt sie, gibt es keinen Ersatzwert — ein stilles „EUR" waere in 27
    Laendern eine falsche Zahl (Wurzel 4).
    """
    return waehrung_fuer_aufgabe(db, tid, property_id)


def _inventur_felder(e: dict[str, Any]) -> dict[str, Any]:
    """Die Inventur-Angaben einer neuen Zeile (0623).

    Nur was mitgegeben wurde: ein weggelassenes Feld faellt auf die Vorgabe
    der Spalte zurueck, statt hier erfunden zu werden.
    """
    raus: dict[str, Any] = {}
    for feld in ("art", "zaehl_rhythmus", "zustand"):
        if e.get(feld):
            raus[feld] = str(e[feld])
    if e.get("meldebestand") is not None:
        raus["meldebestand"] = max(0, int(e["meldebestand"]))
    return raus


def _schaden(z: dict, fotos: list[str] | None = None) -> dict:
    return {
        "id": str(z["id"]),
        "item_id": str(z["item_id"]) if z.get("item_id") else None,
        "item_name": z["item_name"],
        "art": z["art"],
        "beschreibung": z.get("beschreibung"),
        "menge": z.get("menge") or 1,
        "traeger": z.get("traeger") or "offen",
        "status": z.get("status") or "gemeldet",
        "betrag": float(z["betrag"]) if z.get("betrag") is not None else None,
        "currency": z.get("currency"),
        "gemeldet_am": z["gemeldet_am"],
        "bestaetigt_am": z.get("bestaetigt_am"),
        "owner_expense_id": (
            str(z["owner_expense_id"]) if z.get("owner_expense_id") else None
        ),
        "task_id": str(z["task_id"]) if z.get("task_id") else None,
        "foto_ids": fotos or [],
    }


class InventarMixin:
    """Inventarliste und Schäden. Teil von `PropertyDossierService`."""

    # Vom Service gestellt; hier nur DEKLARIERT, kein Methodenrumpf — der
    # stuende in der MRO vor der echten Methode.
    _ctx: Any
    _db: Callable[[], Client]
    _require_tenant: Callable[[str | None], str]
    _require_own_property: Callable[[str, str], None]

    # -- Räume -----------------------------------------------------------------
    def inventar_raeume(
        self, tenant_id: str | None, property_id: str
    ) -> list[InventarRaum]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        try:
            zeilen = (
                self._db()
                .table("inventory_room")
                .select("*")
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .order("sortierung")
                .order("name")
                .limit(MAX_RAEUME_JE_OBJEKT)
                .execute()
            ).data or []
        except APIError as exc:
            raise _db_fehler(exc, "raeume") from exc
        return [InventarRaum(**_raum(z)) for z in zeilen]

    def inventar_raum_anlegen(
        self, tenant_id: str | None, property_id: str, *, name: str,
        sortierung: int = 0,
    ) -> InventarRaum:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        sauber = (name or "").strip()
        if not sauber:
            raise _fehler("Der Raum braucht einen Namen.", 422)
        if len(self.inventar_raeume(tid, property_id)) >= MAX_RAEUME_JE_OBJEKT:
            raise _fehler(
                f"Höchstens {MAX_RAEUME_JE_OBJEKT} Räume je Objekt.", 422
            )
        try:
            z = (
                self._db()
                .table("inventory_room")
                .insert(
                    {
                        "tenant_id": tid,
                        "property_id": property_id,
                        "name": sauber[:120],
                        "sortierung": sortierung,
                    }
                )
                .execute()
            ).data
        except APIError as exc:
            # 23505 = der Raum gibt es schon. Kein 500, sondern die Auskunft,
            # die der Nutzer braucht (Wurzel 2/5).
            if "23505" in str(exc):
                raise _fehler("Diesen Raum gibt es bereits.", 409) from exc
            raise _db_fehler(exc, "raum_anlegen") from exc
        return InventarRaum(**_raum(z[0]))

    def inventar_raum_loeschen(
        self, tenant_id: str | None, property_id: str, raum_id: str
    ) -> None:
        """Einen Raum entfernen. Die Gegenstände BLEIBEN — sie stehen dann ohne
        Raum in der Liste, statt mit dem Raum zu verschwinden (`on delete set
        null`, 0620). Ein Möbelstück hört nicht auf zu existieren, weil jemand
        die Gliederung ändert."""
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        try:
            (
                self._db()
                .table("inventory_room")
                .delete()
                .eq("id", raum_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .execute()
            )
        except APIError as exc:
            raise _db_fehler(exc, "raum_loeschen") from exc

    # -- Gegenstände -----------------------------------------------------------
    def inventar_liste(
        self, tenant_id: str | None, property_id: str
    ) -> list[InventarGegenstand]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        try:
            zeilen = (
                self._db()
                .table("inventory_items")
                .select("*")
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .order("name")
                .limit(MAX_GEGENSTAENDE_JE_OBJEKT)
                .execute()
            ).data or []
        except APIError as exc:
            raise _db_fehler(exc, "liste") from exc
        return [InventarGegenstand(**_gegenstand(z)) for z in zeilen]

    def inventar_anlegen(
        self,
        tenant_id: str | None,
        property_id: str,
        *,
        eintraege: list[dict[str, Any]],
        user_id: str | None,
        quelle: str = "manuell",
        dokument_id: str | None = None,
    ) -> int:
        """Zeilen ergänzen — von Hand oder aus einem bestätigten PDF.

        Die Liste ist NIE fertig: ein Betrieb kauft nach, tauscht aus,
        ergänzt beim Rundgang. Deshalb ein Sammel-Einfügen statt „einmal
        importieren und fertig".
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if quelle not in ("manuell", "dokument"):
            raise _fehler("Unbekannte Quelle.", 422)
        if not eintraege:
            return 0
        vorhanden = len(self.inventar_liste(tid, property_id))
        if vorhanden + len(eintraege) > MAX_GEGENSTAENDE_JE_OBJEKT:
            raise _fehler(
                f"Höchstens {MAX_GEGENSTAENDE_JE_OBJEKT} Gegenstände je Objekt.",
                422,
            )
        zeilen = []
        for e in eintraege:
            name = str(e.get("name") or "").strip()
            if not name:
                continue
            soll = e.get("soll_menge")
            ist = e.get("ist_menge")
            zeilen.append(
                {
                    "tenant_id": tid,
                    "property_id": property_id,
                    "name": name[:300],
                    "room_id": e.get("room_id") or None,
                    # Ohne Angabe gilt das Soll auch als Ist: beim Anlegen aus
                    # einer Liste ist alles da, sonst stuende die frische
                    # Zeile sofort als Fehlbestand da (Wurzel 4).
                    "quantity": int(ist if ist is not None else (soll or 0)),
                    "soll_menge": int(soll) if soll is not None else None,
                    "beschreibung": (str(e.get("beschreibung") or "").strip() or None),
                    "quelle": quelle,
                    "quelle_dokument_id": dokument_id,
                    "updated_by": user_id,
                    **_inventur_felder(e),
                }
            )
        if not zeilen:
            return 0
        try:
            self._db().table("inventory_items").insert(zeilen).execute()
        except APIError as exc:
            raise _db_fehler(exc, "anlegen") from exc
        log.info(
            "inventar_angelegt",
            tenant_id=tid,
            property_id=property_id,
            anzahl=len(zeilen),
            quelle=quelle,
        )
        return len(zeilen)

    def inventar_aendern(
        self,
        tenant_id: str | None,
        property_id: str,
        item_id: str,
        *,
        felder: dict[str, Any],
        user_id: str | None,
    ) -> InventarGegenstand:
        """Eine Zeile ändern — Name, Raum, Mengen, Beschreibung."""
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        werte: dict[str, Any] = {"updated_by": user_id}
        if "name" in felder:
            name = str(felder["name"] or "").strip()
            if not name:
                raise _fehler("Der Gegenstand braucht einen Namen.", 422)
            werte["name"] = name[:300]
        if "room_id" in felder:
            werte["room_id"] = felder["room_id"] or None
        if "ist_menge" in felder:
            werte["quantity"] = max(0, int(felder["ist_menge"] or 0))
        if "soll_menge" in felder:
            soll = felder["soll_menge"]
            werte["soll_menge"] = max(0, int(soll)) if soll is not None else None
        if "beschreibung" in felder:
            werte["beschreibung"] = (
                str(felder["beschreibung"] or "").strip()[:2000] or None
            )
        for feld in ("art", "zaehl_rhythmus", "zustand"):
            if feld in felder and felder[feld]:
                werte[feld] = str(felder[feld])
        if "meldebestand" in felder:
            m = felder["meldebestand"]
            werte["meldebestand"] = max(0, int(m)) if m is not None else None
        if "zustand_notiz" in felder:
            werte["zustand_notiz"] = (
                str(felder["zustand_notiz"] or "").strip()[:500] or None
            )
        if "angeschafft_am" in felder:
            werte["angeschafft_am"] = felder["angeschafft_am"] or None
        if "anschaffungswert" in felder:
            # Wert und Waehrung gehoeren zusammen — der CHECK in 0623 laesst
            # das eine ohne das andere nicht zu (Wurzel 4).
            wert = felder["anschaffungswert"]
            werte["anschaffungswert"] = (
                round(float(wert), 2) if wert is not None else None
            )
            werte["anschaffung_currency"] = (
                _waehrung_des_objekts(self._db(), tid, property_id)
                if wert is not None
                else None
            )
            if wert is not None and not werte["anschaffung_currency"]:
                raise _fehler(
                    "Für dieses Objekt ist keine Währung hinterlegt — bitte in "
                    "den Objektdaten ergänzen.",
                    422,
                )
        if "geprueft" in felder and felder["geprueft"]:
            # Die Sichtpruefung beim Rundgang. Nur setzen, wenn ausdruecklich
            # gemeldet — ein Nebeneffekt beim Umbenennen waere eine
            # Falschaussage ueber den Pruefstand.
            werte["geprueft_am"] = datetime.now(UTC).isoformat()
            werte["geprueft_von"] = user_id
        try:
            z = (
                self._db()
                .table("inventory_items")
                .update(werte)
                .eq("id", item_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .execute()
            ).data
        except APIError as exc:
            raise _db_fehler(exc, "aendern") from exc
        if not z:
            raise _fehler("Gegenstand nicht gefunden.", 404)
        return InventarGegenstand(**_gegenstand(z[0]))

    def inventar_loeschen(
        self, tenant_id: str | None, property_id: str, item_id: str
    ) -> None:
        """Einen Gegenstand aus der Liste nehmen.

        Gemeldete SCHÄDEN bleiben bestehen (`on delete set null`, 0620): sie
        sind passiert, tragen den Namen von damals und haengen an einem
        Abrechnungsposten.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        try:
            (
                self._db()
                .table("inventory_items")
                .delete()
                .eq("id", item_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .execute()
            )
        except APIError as exc:
            raise _db_fehler(exc, "loeschen") from exc

    # -- Schäden ---------------------------------------------------------------
    def schaeden_liste(
        self, tenant_id: str | None, property_id: str, *, nur_offen: bool = False
    ) -> list[InventarSchaden]:
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        try:
            q = (
                self._db()
                .table("inventory_damage")
                .select("*")
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
            )
            if nur_offen:
                q = q.in_("status", ["gemeldet", "bestaetigt"])
            zeilen = q.order("gemeldet_am", desc=True).limit(500).execute().data or []
            fotos = self._fotos_je_schaden(tid, [str(z["id"]) for z in zeilen])
        except APIError as exc:
            raise _db_fehler(exc, "schaeden") from exc
        return [InventarSchaden(**_schaden(z, fotos.get(str(z["id"])))) for z in zeilen]

    def _fotos_je_schaden(
        self, tid: str, schaden_ids: list[str]
    ) -> dict[str, list[str]]:
        """Foto-IDs je Schaden — in EINEM Zug, nicht je Zeile."""
        if not schaden_ids:
            return {}
        zeilen = (
            self._db()
            .table("inventory_damage_photo")
            .select("id, damage_id")
            .eq("tenant_id", tid)
            .in_("damage_id", schaden_ids[:500])
            .execute()
        ).data or []
        raus: dict[str, list[str]] = {}
        for z in zeilen:
            raus.setdefault(str(z["damage_id"]), []).append(str(z["id"]))
        return raus

    def schaden_scope_pruefen(
        self, ctx: AuthContext, property_id: str
    ) -> str:
        """Der Objekt-Scope fuer den MELDE-Endpunkt (Personal, nicht Kartei).

        WARUM EIGENS: `_require_own_property` prueft zusaetzlich den
        Kartei-Rollenscope — ein cleaner faellt dort durch, und das ist an der
        Kartei auch richtig (dort stehen IBAN, Steuer-ID, Tuercodes). Fuer eine
        Schadensmeldung braucht er aber Zugang, und zwar genau zu SEINEN
        Objekten.

        Geprueft wird deshalb dasselbe wie in der Aufgabenliste
        (`tasks/service.py`): Tenant plus `staff_property_assignments`. Ohne
        diese zweite Pruefung koennte ein cleaner mit einer fremden
        `property_id` Schaeden an Haeusern melden, die ihm nicht zugewiesen
        sind (Wurzel 9).
        """
        from src.features.auth.staff_scope import (  # noqa: PLC0415
            is_staff,
            staff_property_ids,
        )

        tid = self._require_tenant(getattr(ctx, "tenant_id", None))
        eigen = (
            self._db()
            .table("properties")
            .select("id")
            .eq("id", property_id)
            .eq("tenant_id", tid)
            .limit(1)
            .execute()
        ).data or []
        if not eigen:
            # Dieselbe 404 wie bei einem nicht existierenden Objekt — kein
            # Orakel ueber fremde Objekte.
            raise _fehler("Objekt nicht gefunden.", 404)
        if is_staff(ctx) and property_id not in staff_property_ids(self._db(), ctx):
            raise _fehler("Objekt nicht gefunden.", 404)
        return tid

    def schaden_melden(
        self,
        tenant_id: str | None,
        property_id: str,
        *,
        item_id: str | None,
        item_name: str,
        art: str,
        beschreibung: str | None,
        menge: int,
        traeger: str,
        reservation_id: str | None,
        fotos: list[bytes],
        user_id: str | None,
        # Woher die Meldung kommt. Aus einer Reinigungsaufgabe traegt
        # DIESE die Buchung, deren Gast betroffen ist — der Kautionsfall.
        task_id: str | None = None,
        checklist_item_id: str | None = None,
    ) -> InventarSchaden:
        """Einen Schaden melden. OHNE FOTO GEHT ES NICHT.

        Die Foto-Pflicht steht hier und nicht in der DB: die Dateien liegen im
        Storage, ein CHECK könnte ihre Existenz nicht prüfen. Geprüft wird VOR
        dem Anlegen der Zeile — sonst stünde bei einem fehlgeschlagenen Upload
        eine Schadenszeile ohne Bild da, also genau das, was die Pflicht
        verhindern soll.

        Meldet AUCH die Reinigungskraft (eigener Endpunkt mit
        MANAGE_INVENTORY): sie ist die Person, der ein Schaden zuerst auffällt.
        """
        # Den Scope hat der AUFRUFER geprueft: die Kartei ueber ihren
        # MANAGE_PROPERTIES-Guard, der Melde-Endpunkt ueber
        # `schaden_scope_pruefen`. Hier nochmals `_require_own_property` zu
        # rufen wuerde die Reinigungskraft aussperren, fuer die der zweite Weg
        # gerade gebaut ist.
        tid = self._require_tenant(tenant_id)
        name = (item_name or "").strip()
        if not name:
            raise _fehler("Der Gegenstand braucht einen Namen.", 422)
        if art not in SCHADEN_ART:
            raise _fehler("Unbekannte Schadensart.", 422)
        if traeger not in TRAEGER:
            raise _fehler("Unbekannter Kostenträger.", 422)
        if not fotos:
            raise _fehler(
                "Ohne Foto keine Schadensmeldung — bitte mindestens ein Bild "
                "aufnehmen.",
                422,
            )
        if len(fotos) > MAX_FOTOS_JE_SCHADEN:
            raise _fehler(f"Höchstens {MAX_FOTOS_JE_SCHADEN} Bilder.", 422)
        for inhalt in fotos:
            if len(inhalt) > MAX_DATEI_BYTES:
                raise _fehler(
                    f"Ein Bild ist zu groß (max. "
                    f"{MAX_DATEI_BYTES // (1024 * 1024)} MB).",
                    413,
                )
            _dateityp(inhalt)  # wirft 415 bei fremdem Typ

        # `gemeldet_am` und `status` kommen aus DB-Vorgaben. Der Zeitstempel
        # wird hier MITGESCHICKT statt aus der Antwort gelesen: PostgREST
        # liefert je nach `Prefer`-Kopf nicht zwingend alle Spalten zurueck,
        # und ein fehlendes Feld waere ein KeyError beim Bauen der Antwort.
        jetzt = datetime.now(UTC).isoformat()
        try:
            z = (
                self._db()
                .table("inventory_damage")
                .insert(
                    {
                        "tenant_id": tid,
                        "property_id": property_id,
                        "item_id": item_id or None,
                        "item_name": name[:300],
                        "art": art,
                        "beschreibung": (beschreibung or "").strip()[:2000] or None,
                        "menge": max(1, int(menge or 1)),
                        "traeger": traeger,
                        # DER KAUTIONSFALL (0623): kommt die Meldung aus
                        # einer Reinigungsaufgabe, traegt DIESE die
                        # Buchung, deren Gast betroffen ist. Eine
                        # ausdrueckliche Angabe schlaegt die Ableitung —
                        # wer es besser weiss, hat recht.
                        "reservation_id": (
                            reservation_id
                            or self.buchung_zum_zeitpunkt(
                                tid, property_id, task_id=task_id
                            )
                        ),
                        "gemeldet_aus_task_id": task_id or None,
                        "gemeldet_aus_item_id": checklist_item_id or None,
                        "gemeldet_von": user_id,
                        "gemeldet_am": jetzt,
                        "status": "gemeldet",
                    }
                )
                .execute()
            ).data
        except APIError as exc:
            raise _db_fehler(exc, "schaden_melden") from exc
        if not z:
            raise _fehler("Der Schaden konnte nicht angelegt werden.", 502)
        schaden_id = str(z[0]["id"])

        foto_ids = self._fotos_ablegen(
            tid, property_id, schaden_id, fotos, user_id=user_id
        )
        log.info(
            "inventar_schaden_gemeldet",
            tenant_id=tid,
            property_id=property_id,
            schaden_id=schaden_id,
            art=art,
            traeger=traeger,
            fotos=len(foto_ids),
        )
        return InventarSchaden(**_schaden(z[0], foto_ids))

    def _fotos_ablegen(
        self,
        tid: str,
        property_id: str,
        schaden_id: str,
        dateien: list[bytes],
        *,
        user_id: str | None,
    ) -> list[str]:
        """Bilder in den privaten Bucket, Zeilen dazu.

        Der Pfad wird SERVERSEITIG gebildet (Tenant/Objekt/Zufall) — nie aus
        einem Dateinamen des Clients, sonst wären `../` und fremde
        Tenant-Ordner erreichbar.
        """
        ids: list[str] = []
        for inhalt in dateien:
            mime, ext = _dateityp(inhalt)
            pfad = f"{tid}/{property_id}/{schaden_id}/{secrets.token_hex(8)}.{ext}"
            try:
                self._db().storage.from_(BUCKET).upload(
                    pfad, inhalt, {"content-type": mime}
                )
            except Exception as exc:  # noqa: BLE001 — Storage-SDK untypisiert
                log.error("inventar_foto_upload_fehlgeschlagen", error=str(exc)[:300])
                raise _fehler("Das Bild konnte nicht abgelegt werden.", 502) from exc
            z = (
                self._db()
                .table("inventory_damage_photo")
                .insert(
                    {
                        "tenant_id": tid,
                        "damage_id": schaden_id,
                        "storage_path": pfad,
                        "hochgeladen_von": user_id,
                    }
                )
                .execute()
            ).data
            ids.append(str(z[0]["id"]))
        return ids

    def schaden_foto_url(
        self, tenant_id: str | None, property_id: str, foto_id: str
    ) -> str:
        """Kurzlebige signierte Adresse (10 Minuten) für ein Schadensbild.

        Der Bucket ist privat; auf einem Schadensfoto ist die Wohnung eines
        Gastes zu sehen. Gescopet über den SCHADEN, nicht nur über den Tenant
        (Wurzel 9): sonst liesse sich mit einer fremden `foto_id` in ein
        anderes Objekt schauen.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        zeilen = (
            self._db()
            .table("inventory_damage_photo")
            .select("storage_path, damage_id, inventory_damage!inner(property_id)")
            .eq("id", foto_id)
            .eq("tenant_id", tid)
            .eq("inventory_damage.property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not zeilen:
            raise _fehler("Bild nicht gefunden.", 404)
        try:
            antwort = self._db().storage.from_(BUCKET).create_signed_url(
                zeilen[0]["storage_path"], 600
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK untypisiert
            log.error("inventar_foto_url_fehlgeschlagen", error=str(exc)[:300])
            raise _fehler("Das Bild ist gerade nicht abrufbar.", 502) from exc
        url = (antwort or {}).get("signedURL") or (antwort or {}).get("signedUrl")
        if not url:
            raise _fehler("Das Bild ist gerade nicht abrufbar.", 502)
        return str(url)

    # -- Bestätigen: Aufgabe + Abrechnungsposten -------------------------------
    def schaden_bestaetigen(
        self,
        tenant_id: str | None,
        property_id: str,
        schaden_id: str,
        *,
        betrag: float,
        traeger: str,
        aufgabe_anlegen: bool = True,
        user_id: str | None,
    ) -> InventarSchaden:
        """Betrag und Kostenträger festlegen — DANN entstehen Aufgabe und Posten.

        WARUM ERST HIER: die meldende Person kennt den Preis nicht. Ein Posten
        über 0,00 oder ein geschätzter Betrag wäre eine Falschaussage in der
        Eigentümer-Abrechnung (Wurzel 4). Erst wenn jemand den Betrag
        verantwortet, wird abgerechnet.

        IDEMPOTENT (Wurzel 2): ein zweiter Aufruf legt weder eine zweite
        Aufgabe noch einen zweiten Posten an — beide Anker stehen an der Zeile
        und werden vorher geprüft. Ein Doppelklick darf einen Eigentümer nicht
        zweimal belasten.
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if traeger not in TRAEGER or traeger == "offen":
            raise _fehler(
                "Bitte festlegen, wer die Kosten trägt.", 422
            )
        if betrag is None or float(betrag) < 0:
            raise _fehler("Der Betrag fehlt oder ist negativ.", 422)

        zeile = self._eigener_schaden(tid, property_id, schaden_id)
        if zeile.get("status") == "verworfen":
            raise _fehler("Dieser Schaden wurde verworfen.", 409)

        waehrung = waehrung_fuer_aufgabe(self._db(), tid, property_id)
        if not waehrung:
            # Kein Ersatzwert: ein stilles „EUR" wäre in 27 Ländern eine
            # falsche Zahl in einer Abrechnung (Wurzel 4).
            raise _fehler(
                "Für dieses Objekt ist keine Währung hinterlegt — bitte in den "
                "Objektdaten ergänzen.",
                422,
            )

        werte: dict[str, Any] = {
            "betrag": round(float(betrag), 2),
            "currency": waehrung,
            "traeger": traeger,
            "status": "bestaetigt",
            "bestaetigt_von": user_id,
            "bestaetigt_am": datetime.now(UTC).isoformat(),
        }

        # Aufgabe: nur, wenn noch keine da ist und der Gegenstand ersetzt
        # werden soll. Bei `entsorgt` gibt es nichts zu reparieren.
        if aufgabe_anlegen and not zeile.get("task_id"):
            task_id = self._aufgabe_fuer_schaden(tid, property_id, zeile)
            if task_id:
                werte["task_id"] = task_id

        # Posten: nur, wenn jemand ausser dem Betrieb zahlt und noch keiner
        # steht. Trägt der BETRIEB die Kosten, gehört nichts in die
        # Eigentümer-Abrechnung — das wäre eine Belastung ohne Anlass.
        if traeger in ("eigentuemer", "gast") and not zeile.get("owner_expense_id"):
            posten_id = self._posten_fuer_schaden(
                tid, property_id, zeile, betrag=werte["betrag"],
                waehrung=waehrung, traeger=traeger,
            )
            if posten_id:
                werte["owner_expense_id"] = posten_id
                werte["status"] = "abgerechnet"

        try:
            z = (
                self._db()
                .table("inventory_damage")
                .update(werte)
                .eq("id", schaden_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .execute()
            ).data
        except APIError as exc:
            raise _db_fehler(exc, "schaden_bestaetigen") from exc
        fotos = self._fotos_je_schaden(tid, [schaden_id])
        log.info(
            "inventar_schaden_bestaetigt",
            tenant_id=tid,
            schaden_id=schaden_id,
            traeger=traeger,
            betrag=werte["betrag"],
            waehrung=waehrung,
            aufgabe=bool(werte.get("task_id")),
            posten=bool(werte.get("owner_expense_id")),
        )
        return InventarSchaden(**_schaden(z[0], fotos.get(schaden_id)))

    def _aufgabe_fuer_schaden(
        self, tid: str, property_id: str, zeile: dict
    ) -> str | None:
        """Eine Aufgabe „ersetzen/reparieren" anlegen.

        Best-effort und lazy importiert — dasselbe Muster wie bei den
        Zusatzleistungen (`addons/service.py`): scheitert die Aufgabe, darf die
        Schadensmeldung nicht mitkippen. Der Fehler geht ins Log, nicht
        verschluckt (Wurzel 5).
        """
        if zeile.get("art") == "entsorgt":
            return None
        was = "Ersetzen" if zeile.get("art") == "fehlt" else "Reparieren/Ersetzen"
        try:
            z = (
                self._db()
                .table("tasks")
                .insert(
                    {
                        "tenant_id": tid,
                        "property_id": property_id,
                        "title": f"{was}: {zeile['item_name']}",
                        "description": (zeile.get("beschreibung") or None),
                        "status": "open",
                    }
                )
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Aufgabe darf die Meldung nicht kippen
            log.error("inventar_aufgabe_fehlgeschlagen", error=str(exc)[:300])
            return None
        return str(z[0]["id"]) if z else None

    def _posten_fuer_schaden(
        self,
        tid: str,
        property_id: str,
        zeile: dict,
        *,
        betrag: float,
        waehrung: str,
        traeger: str,
    ) -> str | None:
        """Einen Posten in der Eigentümer-Abrechnung anlegen.

        RICHTUNG hängt am Träger, nicht an einer Konstante:
          * `eigentuemer` → `from_owner`, er trägt die Kosten.
          * `gast`        → `to_owner`: der Betrieb holt sich das Geld beim
            Gast und reicht es weiter; für den Eigentümer ist es eine
            Gutschrift, keine Belastung.
        Die vorhandene Dienstleistungs-Automatik (`tasks/abrechnung.py`) kennt
        nur `from_owner` — für einen Schaden wäre das die halbe Wahrheit.
        """
        richtung = "from_owner" if traeger == "eigentuemer" else "to_owner"
        try:
            z = (
                self._db()
                .table("owner_expenses")
                .insert(
                    {
                        "tenant_id": tid,
                        "listing_id": property_id,
                        "concept": f"Schaden: {zeile['item_name']}",
                        "category": "damage",
                        "direction": richtung,
                        "amount": betrag,
                        "currency": waehrung,
                        "date": datetime.now(UTC).date().isoformat(),
                        "reservation_id": zeile.get("reservation_id") or None,
                    }
                )
                .execute()
            ).data
        except Exception as exc:  # noqa: BLE001 — Posten darf die Meldung nicht kippen
            log.error("inventar_posten_fehlgeschlagen", error=str(exc)[:300])
            return None
        return str(z[0]["id"]) if z else None

    def schaden_verwerfen(
        self, tenant_id: str | None, property_id: str, schaden_id: str
    ) -> None:
        """Doch kein Schaden. Ein bereits abgerechneter bleibt stehen —
        der Posten ist raus, und ein stiller Rückzieher wäre eine
        Abrechnungsdifferenz ohne Spur (Wurzel 1)."""
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        zeile = self._eigener_schaden(tid, property_id, schaden_id)
        if zeile.get("owner_expense_id"):
            raise _fehler(
                "Dieser Schaden steht schon in der Abrechnung — bitte dort "
                "stornieren.",
                409,
            )
        try:
            (
                self._db()
                .table("inventory_damage")
                .update({"status": "verworfen"})
                .eq("id", schaden_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .execute()
            )
        except APIError as exc:
            raise _db_fehler(exc, "schaden_verwerfen") from exc

    def _eigener_schaden(
        self, tid: str, property_id: str, schaden_id: str
    ) -> dict:
        """Eine Schadenszeile — gescopet auf Tenant UND Objekt (Wurzel 3/9)."""
        try:
            zeilen = (
                self._db()
                .table("inventory_damage")
                .select("*")
                .eq("id", schaden_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:
            raise _db_fehler(exc, "schaden_lesen") from exc
        if not zeilen:
            raise _fehler("Schaden nicht gefunden.", 404)
        return zeilen[0]

    # -- Inventarliste aus einem PDF lesen -------------------------------------
    def inventar_pdf_lesen(
        self,
        tenant_id: str | None,
        property_id: str,
        *,
        inhalt: bytes,
        dateiname: str,
        user_id: str | None,
        client: object | None = None,
    ) -> list[dict[str, Any]]:
        """Ein PDF lesen und Inventarzeilen VORSCHLAGEN.

        EIGENER WEG, nicht der der digitalen Mappe: dort sucht das Modell
        Mappenfelder (WLAN, Tuercode, Anfahrt). Eine Inventarliste ist etwas
        anderes — eine Tabelle aus Gegenstand, Menge und Raum. Derselbe Prompt
        faende darin nichts.

        Es wird NICHTS gespeichert: die Vorschlaege gehen an die Oberflaeche
        und kommen mit dem Uebernehmen zurueck (`inventar_anlegen`). Eine
        Zwischentabelle waere ein weiterer Zustand mit eigenem Gegenzustand
        (Wurzel 1) — dieselbe Entscheidung wie beim Wissens-Import.
        """
        from src.core.ki import KiError, VertexClient  # noqa: PLC0415
        from src.features.site_config.ki_nutzung import (  # noqa: PLC0415
            buchen,
            deckel_pruefen,
        )

        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if not inhalt.startswith(b"%PDF-"):
            raise _fehler("Nur PDF-Dateien werden gelesen.", 422)
        if len(inhalt) > MAX_DATEI_BYTES:
            raise _fehler(
                f"Die Datei ist zu groß (max. "
                f"{MAX_DATEI_BYTES // (1024 * 1024)} MB).",
                422,
            )
        try:
            deckel_pruefen(self._db(), tid)
        except KiError as exc:
            raise _fehler(exc.message, exc.status_code) from exc

        ki = client or VertexClient()
        try:
            antwort = ki.erzeuge_multimodal(
                system=_INVENTAR_PROMPT,
                teile=[
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": base64.b64encode(inhalt).decode(),
                        }
                    },
                    {"text": "Ziehe die Inventarzeilen aus diesem Dokument."},
                ],
                temperature=0.1,
                max_tokens=8_000,
                # Ein abgeschnittenes JSON ist hier IMMER unbrauchbar — es
                # als „Liste nicht lesbar" zu melden, verschiebt die Schuld
                # auf das Dokument. Lieber der ehrliche Satz: das Budget hat
                # nicht gereicht (10.09.2026).
                abbruch_ist_fehler=True,
            )
        except KiError as exc:
            raise _fehler(exc.message, exc.status_code) from exc

        vorschlaege: list[dict[str, Any]] = []
        for e in _json_liste(antwort.text)[:MAX_ZEILEN_JE_PDF]:
            name = str(e.get("name") or "").strip()
            if not name:
                continue
            menge = e.get("menge")
            vorschlaege.append(
                {
                    "name": name[:300],
                    # Keine erfundene 1: steht im Dokument keine Menge, bleibt
                    # sie offen und der Mensch traegt sie ein (Wurzel 4).
                    "soll_menge": int(menge)
                    if isinstance(menge, int) and menge > 0
                    else None,
                    "raum": str(e.get("raum") or "").strip()[:120] or None,
                    "beschreibung": str(e.get("beschreibung") or "").strip()[:2000]
                    or None,
                }
            )
        log.info(
            "inventar_pdf_gelesen",
            tenant_id=tid,
            property_id=property_id,
            datei=dateiname[:120],
            zeilen=len(vorschlaege),
            tokens_ein=antwort.tokens_ein,
            tokens_aus=antwort.tokens_aus,
        )
        buchen(
            self._db(), tid, user_id=user_id, funktion=FUNKTION_PDF, antwort=antwort
        )
        return vorschlaege

    # -- Referenzfoto: der intakte Zustand (0623) ------------------------------
    def referenz_foto_setzen(
        self,
        tenant_id: str | None,
        property_id: str,
        item_id: str,
        *,
        inhalt: bytes,
        user_id: str | None,
    ) -> str:
        """Das Bild „so sieht es aus, wenn es in Ordnung ist".

        WARUM AM GEGENSTAND UND NICHT NUR AM SCHADEN: 0620 kannte Fotos nur
        am Schaden. Im Streitfall fehlt damit der Vergleich — ein Bild vom
        kaputten Sessel beweist nicht, dass er vorher heil war. Die Praxis
        (Guesty: „time-stamped photos before and after") verlangt beides.

        EIN Bild, kein Album: mehrere Aufnahmen gehoeren an den Schaden. Ein
        neues ersetzt das alte, und die alte Datei wird geraeumt — sonst
        sammeln sich verwaiste Bilder im Bucket an (Wurzel 1).
        """
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        if len(inhalt) > MAX_DATEI_BYTES:
            raise _fehler(
                f"Das Bild ist zu groß (max. "
                f"{MAX_DATEI_BYTES // (1024 * 1024)} MB).",
                413,
            )
        mime, ext = _dateityp(inhalt)
        if mime == "application/pdf":
            # Ein Referenzbild ist ein BILD. Ein PDF waere hier kein Nachweis,
            # sondern eine Datei, die niemand als Vergleich ansieht.
            raise _fehler("Für das Referenzbild bitte ein Foto, kein PDF.", 415)

        alt = self._eigener_gegenstand(tid, property_id, item_id)
        pfad = f"{tid}/{property_id}/referenz/{item_id}.{ext}"
        try:
            # `upsert`: ein zweiter Versuch mit demselben Pfad ueberschreibt,
            # statt an einem Konflikt zu scheitern (Wurzel 2).
            self._db().storage.from_(BUCKET).upload(
                pfad, inhalt, {"content-type": mime, "upsert": "true"}
            )
        except Exception as exc:  # noqa: BLE001 — Storage-SDK untypisiert
            log.error("referenz_foto_upload_fehlgeschlagen", error=str(exc)[:300])
            raise _fehler("Das Bild konnte nicht abgelegt werden.", 502) from exc

        vorher = str(alt.get("referenz_foto_pfad") or "")
        if vorher and vorher != pfad:
            try:
                self._db().storage.from_(BUCKET).remove([vorher])
            except Exception as exc:  # noqa: BLE001 — best effort
                log.warning("referenz_foto_alt_bleibt", error=str(exc)[:200])

        (
            self._db()
            .table("inventory_items")
            .update({"referenz_foto_pfad": pfad, "updated_by": user_id})
            .eq("id", item_id)
            .eq("tenant_id", tid)
            .eq("property_id", property_id)
            .execute()
        )
        log.info("referenz_foto_gesetzt", tenant_id=tid, item_id=item_id)
        return pfad

    def referenz_foto_url(
        self, tenant_id: str | None, property_id: str, item_id: str
    ) -> str:
        """Kurzlebige signierte Adresse (10 Minuten) fuer das Referenzbild."""
        tid = self._require_tenant(tenant_id)
        self._require_own_property(tid, property_id)
        zeile = self._eigener_gegenstand(tid, property_id, item_id)
        pfad = str(zeile.get("referenz_foto_pfad") or "")
        if not pfad:
            raise _fehler("Für diesen Gegenstand gibt es kein Bild.", 404)
        try:
            antwort = self._db().storage.from_(BUCKET).create_signed_url(pfad, 600)
        except Exception as exc:  # noqa: BLE001 — Storage-SDK untypisiert
            log.error("referenz_foto_url_fehlgeschlagen", error=str(exc)[:300])
            raise _fehler("Das Bild ist gerade nicht abrufbar.", 502) from exc
        url = (antwort or {}).get("signedURL") or (antwort or {}).get("signedUrl")
        if not url:
            raise _fehler("Das Bild ist gerade nicht abrufbar.", 502)
        return str(url)

    def _eigener_gegenstand(
        self, tid: str, property_id: str, item_id: str
    ) -> dict:
        """Eine Inventarzeile — gescopet auf Tenant UND Objekt (Wurzel 3/9)."""
        try:
            zeilen = (
                self._db()
                .table("inventory_items")
                .select("*")
                .eq("id", item_id)
                .eq("tenant_id", tid)
                .eq("property_id", property_id)
                .limit(1)
                .execute()
            ).data or []
        except APIError as exc:
            raise _db_fehler(exc, "gegenstand_lesen") from exc
        if not zeilen:
            raise _fehler("Gegenstand nicht gefunden.", 404)
        return zeilen[0]

    # -- Der Kautionsfall: welcher Gast war da? (0623) -------------------------
    def buchung_zum_zeitpunkt(
        self, tid: str, property_id: str, *, task_id: str | None
    ) -> str | None:
        """Die Buchung, deren Gast beim Fehlbestand betroffen ist.

        Mehrere Quellen nennen das als Hauptzweck der Inventarliste: sie ist
        „wesentlich für die Rückzahlung einer Mietkaution". Dafür muss ein
        Fehlbestand einer BUCHUNG zuordenbar sein.

        Der verlaessliche Weg fuehrt ueber die AUFGABE: die Reinigung nach der
        Abreise traegt `reservation_id` der Buchung, die sie ausgeloest hat.
        Aus dem Datum zu raten, wer „wohl" da war, waere eine Zuordnung, die
        die Daten nicht hergeben — und im Kautionsfall die falsche Person
        (Wurzel 4).
        """
        if not task_id:
            return None
        zeilen = (
            self._db()
            .table("tasks")
            .select("reservation_id")
            .eq("id", task_id)
            .eq("tenant_id", tid)
            .eq("property_id", property_id)
            .limit(1)
            .execute()
        ).data or []
        return str(zeilen[0]["reservation_id"]) if zeilen and zeilen[0].get(
            "reservation_id"
        ) else None
