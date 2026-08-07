"""Diagnose: was liefert Airbnb, was steht bei uns, wo geht es verloren?

Ohne diese Ansicht ist der Import eine Blackbox. Beim Beta-Betrieb standen
mehrere Fehler gleichzeitig übereinander, und keiner war sichtbar:

  * Die ADRESSE kam von Airbnb, wurde aber nicht gespeichert, weil ein späterer
    Channex-Aufruf mit 422 abbrach („Room type photos limit exceeded") — der
    Nutzer sah ein leeres Straßenfeld und nirgends einen Grund.
  * `caption` wurde als String geschrieben, obwohl die Spalte mehrsprachig ist
    → jeder Foto-Abruf danach: HTTP 500.
  * Die Firmenadresse (`Hirtshalsvej 21`) stand in allen 18 Objekten, während
    Airbnb die echte kennt (`Skagen Landevej 772`).

Diese Diagnose stellt drei Fragen je Feld und beantwortet sie mit MESSWERTEN,
nicht mit Vermutungen:

  1. Liefert Airbnb es?          (`airbnb`)
  2. Steht es bei uns?           (`lokal`)
  3. Stimmen beide überein?      (`status`)

`status` kennt vier Werte:
  * `ok`        — Airbnb liefert, wir haben denselben Wert
  * `abweichung`— beide haben etwas, aber Verschiedenes (der interessante Fall)
  * `fehlt`     — Airbnb liefert, bei uns ist es leer (nicht übernommen)
  * `nur_lokal` — nur bei uns gepflegt, Airbnb hat es nicht

Sie SCHREIBT NICHTS. Wer sie aufruft, sieht den Zustand, ändert ihn nicht.
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from src.core.security import AuthContext

from .airbnb_direkt import _strasse_und_nummer
from .common import ChannelManagerError, log

# Airbnb-Feld → unsere Spalte. Nur Felder, die wir wirklich übernehmen —
# eine Zeile hier ohne Import-Weg wäre eine Falschaussage über den Zustand.
FELD_ZUORDNUNG: tuple[tuple[str, str], ...] = (
    # Airbnbs `street` speist DREI Spalten: `address` (volle Zeile, geht an
    # Channex) sowie `street` + `house_number` (das Standort-Formular führt sie
    # getrennt). Wer nur `address` prüft, sieht ein leeres Straßenfeld nicht.
    ("street", "address"),
    ("street", "street"),
    ("street", "house_number"),
    ("zipcode", "postal_code"),
    ("city", "city"),
    ("lat", "lat"),
    ("lng", "lng"),
    ("person_capacity", "max_guests"),
)

# Felder, die Airbnb liefert und wir NICHT übernehmen. Sie stehen mit Grund in
# der Diagnose, damit „kommt nicht an" von „holen wir bewusst nicht" zu
# unterscheiden ist.
NICHT_UEBERNOMMEN: tuple[tuple[str, str], ...] = (
    ("bedrooms", "Schlafzimmer — unsere Zimmer liegen in property_rooms"),
    ("bathrooms", "Badezimmer — kein Zielfeld in properties"),
    ("beds", "Betten — Zielfeld ist property_rooms, nicht properties"),
    ("apt", "Wohnungszusatz (z. B. „lejlighed t.v.\") — kein Zielfeld"),
    ("directions", "Wegbeschreibung — kein Zielfeld"),
    ("wifi_network", "WLAN-Name — gehört ins Gast-Dossier, nicht ans Objekt"),
    ("wifi_password", "WLAN-Passwort — Geheimnis, bewusst nicht am Objekt"),
    ("check_in_option", "Check-in-Anleitung (Schlüsselbox) — kein Zielfeld"),
    ("room_type_category", "Objektart-Feinheit — wir führen property_type"),
)


def _leer(wert: object) -> bool:
    """Ein Wert gilt als leer, wenn er nichts aussagt."""
    if wert is None:
        return True
    if isinstance(wert, str):
        return not wert.strip()
    if isinstance(wert, (list, dict, tuple, set)):
        return len(wert) == 0
    return False


def _vergleichbar(wert: object) -> object:
    """Zwei Werte gleich nennen, wenn sie dasselbe BEDEUTEN.

    Airbnb liefert die PLZ als String (`"9800"`), Koordinaten als Float mit
    voller Genauigkeit (`57.55654449999999`); unsere Spalten können Zahl bzw.
    gerundet sein. Ohne Normalisierung wäre jede Zeile eine „Abweichung" und
    die Diagnose nutzlos.
    """
    if isinstance(wert, bool):
        return wert
    if isinstance(wert, (int, float)):
        return round(float(wert), 5)
    if isinstance(wert, str):
        text = wert.strip()
        try:
            return round(float(text), 5)
        except ValueError:
            return " ".join(text.split()).lower()
    return wert


class AirbnbDiagnoseMixin:
    """Feld-für-Feld-Abgleich Airbnb ↔ unsere DB. Nur lesend."""

    def airbnb_diagnose(
        self, ctx: AuthContext, property_id: str
    ) -> dict[str, Any]:
        """Was Airbnb für dieses Objekt liefert und was davon bei uns steht."""
        tenant_id = self._require_tenant(ctx)  # type: ignore[attr-defined]
        db = self._require_db()  # type: ignore[attr-defined]

        prop = self._objekt_scoped(db, tenant_id, property_id)
        listing_id = prop.get("airbnb_listing_id")
        if not listing_id:
            return {
                "property_id": property_id,
                "listing_id": None,
                "erreichbar": False,
                "hinweis": (
                    "Dieses Objekt trägt keine Airbnb-Anzeigen-Nummer. Ohne sie "
                    "gibt es keine Quelle, mit der sich vergleichen ließe."
                ),
                "felder": [],
                "nicht_uebernommen": [],
                "abgeleitet": [],
                "fotos": {},
                "beschreibung": {},
            }

        zugang = self._airbnb_token(db, tenant_id, property_id)  # type: ignore[attr-defined]
        if not zugang:
            return {
                "property_id": property_id,
                "listing_id": str(listing_id),
                "erreichbar": False,
                "hinweis": (
                    "Der Airbnb-Zugang ist nicht lesbar. Entweder ist kein "
                    "Airbnb-Kanal verbunden, oder sein Token ist abgelaufen."
                ),
                "felder": [],
                "nicht_uebernommen": [],
                "abgeleitet": [],
                "fotos": {},
                "beschreibung": {},
            }
        token, host_id = zugang

        listing = self.airbnb_listing_direkt(token, str(listing_id))  # type: ignore[attr-defined]
        if listing is None:
            return {
                "property_id": property_id,
                "listing_id": str(listing_id),
                "erreichbar": False,
                "hinweis": (
                    "Airbnb hat die Anzeige nicht herausgegeben. Der Token ist "
                    "möglicherweise abgelaufen, oder die Anzeige gehört nicht "
                    f"zu diesem Konto (Host {host_id})."
                ),
                "felder": [],
                "nicht_uebernommen": [],
                "abgeleitet": [],
                "fotos": {},
                "beschreibung": {},
            }

        ergebnis = {
            "property_id": property_id,
            "listing_id": str(listing_id),
            "host_id": host_id,
            "erreichbar": True,
            "hinweis": None,
            "felder": self._felder_vergleichen(listing, prop),
            "nicht_uebernommen": [
                {
                    "airbnb_feld": feld,
                    "airbnb": listing.get(feld),
                    "grund": grund,
                }
                for feld, grund in NICHT_UEBERNOMMEN
                if not _leer(listing.get(feld))
            ],
            "ausstattung": self._ausstattung_vergleichen(listing, prop),
            "abgeleitet": self._abgeleitet_pruefen(prop),
            "fotos": self._fotos_vergleichen(db, property_id, token, str(listing_id)),
            "beschreibung": self._beschreibung_vergleichen(
                token, str(listing_id), prop
            ),
        }
        offen = [f for f in ergebnis["felder"] if f["status"] != "ok"]
        log.info(
            "airbnb_diagnose",
            tenant_id=tenant_id, property_id=property_id,
            offene_felder=[f["feld"] for f in offen],
            fotos=ergebnis["fotos"].get("status"),
        )
        return ergebnis

    def _objekt_scoped(
        self, db: Client, tenant_id: str, property_id: str
    ) -> dict[str, Any]:
        """Das Objekt dieses Betriebs — Wurzel 3: Laden UND Scope in einem."""
        rows = (
            db.table("properties")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            raise ChannelManagerError("Objekt nicht gefunden.", status_code=404)
        return rows[0]

    @staticmethod
    def _abgeleitet_pruefen(prop: dict[str, Any]) -> list[dict[str, Any]]:
        """Felder, die KEINE Quelle liefert und die wir berechnen.

        Ohne diesen Abschnitt sieht ein leeres Bundesland wie ein verlorener
        Import aus, obwohl Airbnb es nie geliefert hat (35 Felder gemessen,
        kein Regionsfeld; Channex führt `state: null`).
        """
        attrs = prop.get("type_attributes")
        location = (attrs or {}).get("location") if isinstance(attrs, dict) else None
        region = ""
        if isinstance(location, dict):
            region = str(location.get("stateProvince") or "").strip()
        return [
            {
                "feld": "stateProvince",
                "quelle": "Rückwärts-Geokodierung aus lat/lng",
                "wert": region or None,
                "status": "ok" if region else "fehlt",
                "grund": (
                    "Airbnb liefert kein Bundesland/keine Region (35 Felder "
                    "gemessen, vier Formate identisch); Channex führt das Feld "
                    "leer. Der Wert entsteht aus den Koordinaten."
                ),
            }
        ]

    @staticmethod
    def _felder_vergleichen(
        listing: dict[str, Any], prop: dict[str, Any]
    ) -> list[dict[str, Any]]:
        """Je Feld: was Airbnb hat, was wir haben, und ob es zusammenpasst."""
        # Airbnbs eine Adresszeile wird bei uns auf drei Spalten verteilt —
        # der Vergleich muss denselben Teil gegenüberstellen, sonst meldet die
        # Diagnose eine Abweichung, wo alles stimmt.
        strasse_voll = (listing.get("street") or "").strip()
        nur_strasse, nummer = _strasse_und_nummer(strasse_voll)
        erwartet_je_spalte = {
            "street": nur_strasse,
            "house_number": nummer,
        }
        zeilen: list[dict[str, Any]] = []
        for airbnb_feld, unsere_spalte in FELD_ZUORDNUNG:
            von_airbnb = erwartet_je_spalte.get(unsere_spalte, listing.get(airbnb_feld))
            bei_uns = prop.get(unsere_spalte)
            if _leer(von_airbnb):
                status = "nur_lokal" if not _leer(bei_uns) else "ok"
            elif _leer(bei_uns):
                status = "fehlt"
            elif _vergleichbar(von_airbnb) == _vergleichbar(bei_uns):
                status = "ok"
            else:
                status = "abweichung"
            zeilen.append(
                {
                    "feld": unsere_spalte,
                    "airbnb_feld": airbnb_feld,
                    "airbnb": von_airbnb,
                    "lokal": bei_uns,
                    "status": status,
                }
            )
        return zeilen

    @staticmethod
    def _ausstattung_vergleichen(
        listing: dict[str, Any], prop: dict[str, Any]
    ) -> dict[str, Any]:
        """Ausstattung: wie viele Airbnb kennt, wie viele bei uns stehen.

        Airbnb liefert `{"REFRIGERATOR": {"is_present": true}, …}` — Einträge
        mit `false` heißen „ausdrücklich nicht vorhanden" und zählen nicht.
        """
        rohe = listing.get("amenities")
        von_airbnb = (
            {
                name.lower()
                for name, wert in rohe.items()
                if isinstance(wert, dict) and wert.get("is_present")
            }
            if isinstance(rohe, dict)
            else set()
        )
        bei_uns = {
            str(a).lower() for a in (prop.get("amenities") or []) if str(a).strip()
        }
        return {
            "airbnb_anzahl": len(von_airbnb),
            "lokal_anzahl": len(bei_uns),
            "fehlen_bei_uns": sorted(von_airbnb - bei_uns),
            "nur_bei_uns": sorted(bei_uns - von_airbnb),
            "status": "ok" if von_airbnb <= bei_uns else "fehlt",
        }

    def _fotos_vergleichen(
        self, db: Client, property_id: str, token: str, listing_id: str
    ) -> dict[str, Any]:
        """Fotos: wie viele Airbnb hat, wie viele bei uns, was an Channex geht.

        Die dritte Zahl ist der Grund für diese Zeile: Channex nimmt pro
        Zimmertyp höchstens 10 Bilder (422, live gemessen). Bei 17 Airbnb-Fotos
        gehen also 7 nicht an die Portale — das ist kein Fehler, aber es muss
        sichtbar sein.
        """
        von_airbnb = self.airbnb_fotos_direkt(token, listing_id)  # type: ignore[attr-defined]
        bei_uns = (
            db.table("property_photos")
            .select("url, caption")
            .eq("property_id", property_id)
            .execute()
        ).data or []
        urls_airbnb = {f["url"] for f in von_airbnb}
        urls_lokal = {str(r.get("url")) for r in bei_uns}
        # Eine Bildunterschrift als String statt {locale: text} lässt JEDEN
        # Foto-Abruf mit HTTP 500 scheitern — genau so passiert.
        kaputte_captions = sum(
            1 for r in bei_uns if isinstance(r.get("caption"), str)
        )
        fehlen = sorted(urls_airbnb - urls_lokal)
        return {
            "airbnb_anzahl": len(von_airbnb),
            "lokal_anzahl": len(bei_uns),
            "an_channex": min(len(bei_uns), 10),
            "gekappt_fuer_channex": max(0, len(bei_uns) - 10),
            "fehlen_bei_uns": fehlen,
            "kaputte_captions": kaputte_captions,
            "status": "fehlt" if fehlen else "ok",
        }

    def _beschreibung_vergleichen(
        self, token: str, listing_id: str, prop: dict[str, Any]
    ) -> dict[str, Any]:
        """Beschreibung: liefert Airbnb Text, steht er bei uns?

        Das Locale ist bei Airbnb Pflicht (ohne: 404). Geprüft wird `de` und als
        Rückfall `en` — ein Host kann seine Anzeige in einer Sprache pflegen.
        """
        for locale in ("de", "en"):
            block = self.airbnb_beschreibung_direkt(  # type: ignore[attr-defined]
                token, listing_id, locale
            )
            text = ((block or {}).get("description") or "").strip()
            if text:
                bei_uns = (prop.get("description") or "").strip()
                return {
                    "locale": locale,
                    "airbnb_laenge": len(text),
                    "lokal_laenge": len(bei_uns),
                    "airbnb_anfang": text[:160],
                    "hausregeln_vorhanden": bool(
                        ((block or {}).get("house_rules") or "").strip()
                    ),
                    "status": "ok" if bei_uns else "fehlt",
                }
        return {
            "locale": None,
            "airbnb_laenge": 0,
            "lokal_laenge": len((prop.get("description") or "").strip()),
            "airbnb_anfang": None,
            "hausregeln_vorhanden": False,
            "status": "ok",
        }
