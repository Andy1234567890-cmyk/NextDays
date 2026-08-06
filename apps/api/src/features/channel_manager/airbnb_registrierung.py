"""Registrierungsnummern (BFE/Lizenz) von Airbnb holen.

DER FUND (05.08.2026, Beta-Betrieb DK): Der Betrieb hinterlegte die
Registrierungsnummer seiner Häuser bei der Kommune (BFE-Nummer) im
Airbnb-Konto — und sie kam bei uns nie an. Grund: sie steht in einem Endpunkt,
den wir nie abgefragt haben.

    GET v2/listing_permits?listing_id={id}

Kontrolltest, der den Fund absichert: `v2/quatsch_kontrolle_zzz` antwortet 404
`route_not_found`, `listing_permits` mit 200 und Inhalt. Sechs weitere geratene
Namen (`listing_regulations`, `regulatory_registrations`, `listing_licenses` …)
sind alle 404 — dies ist der einzige Weg.

WAS DRINSTEHT (17 von 18 Listings hatten eine Nummer):

    regulatory_body        regulation_type            Antwortfeld
    ─────────────────────  ─────────────────────────  ───────────────────
    european_union_lrn     tax_reporting              license_number
    denmark                residency_categorization   data_reporting_bbr

Beide sind dieselbe dänische BFE-Nummer — bei „Feriehus Kornblomst" stand in
beiden Feldern `3156623`. Der EU-Eintrag ist der verbreitetere (17×), der
dänische kam nur bei zwei Objekten vor.

`status` unterscheidet gepflegt von nicht gepflegt: `success` heißt eingetragen,
`initial` heißt „Your listing is unregistered" (dann sind alle Antwortfelder
leer). Übernommen wird nur, was wirklich dasteht (Wurzel 4).
"""
from __future__ import annotations

from typing import Any

from supabase import Client

from .common import log

# Die Antwortfelder, die eine Nummer tragen können — in dieser Reihenfolge.
# `finalized_answers` schlägt `answers`: das eine ist der bestätigte Stand, das
# andere ein möglicherweise halbfertiges Formular.
_NUMMER_FELDER = ("license_number", "data_reporting_bbr", "permit_number",
                  "registration_number")


def nummern_aus_permits(antwort: dict[str, Any] | None) -> list[str]:
    """Die eingetragenen Registrierungsnummern eines Listings.

    Mehrere Regulierungsbehörden können dieselbe Nummer führen (DK: `denmark`
    und `european_union_lrn`) — sie wird dann nur EINMAL zurückgegeben.
    Reihenfolge bleibt stabil, damit ein erneuter Abruf nicht dieselbe Liste
    anders sortiert und eine Änderung vortäuscht.
    """
    gefunden: list[str] = []
    for permit in (antwort or {}).get("listing_permits") or []:
        if not isinstance(permit, dict):
            continue
        # Nur bestätigte Einträge. `initial` heißt „nicht registriert" und
        # trägt leere Felder — daraus eine Nummer zu lesen wäre erfunden.
        if str(permit.get("status") or "").lower() != "success":
            continue
        antworten = permit.get("finalized_answers") or permit.get("answers") or {}
        if not isinstance(antworten, dict):
            continue
        for feld in _NUMMER_FELDER:
            wert = (antworten.get(feld) or {})
            text = str(wert.get("text_value") or "").strip() if isinstance(
                wert, dict
            ) else ""
            if text and text not in gefunden:
                gefunden.append(text)
    return gefunden


class AirbnbRegistrierungMixin:
    """Registrierungsnummern von Airbnb in unser Compliance-Feld."""

    def _registrierung_uebernehmen(
        self, db: Client, tenant_id: str, property_id: str,
        alt: dict[str, Any], neu: dict[str, Any], gesetzt: list[str],
    ) -> None:
        """`listing_permits` → `compliance.registrationNumbers`.

        Nur füllen, wenn das Feld leer ist (Wurzel 1): der Betrieb kann dort
        eigene Nummern pflegen — etwa für Objekte, die gar nicht bei Airbnb
        hängen —, und ein erneuter Abruf darf sie nicht ersetzen.

        Best effort: ein zusätzlicher Fremdaufruf. Fällt er aus, bleiben die
        übrigen Details erhalten; der Grund steht im Log (Wurzel 5).
        """
        vorhanden = alt.get("compliance")
        vorhanden = dict(vorhanden) if isinstance(vorhanden, dict) else {}
        if str(vorhanden.get("registrationNumbers") or "").strip():
            return

        listing_id = self._airbnb_listing_id(db, property_id)  # type: ignore[attr-defined]
        zugang = self._airbnb_token(db, tenant_id)  # type: ignore[attr-defined]
        if not listing_id or not zugang:
            return
        token, _user = zugang
        try:
            antwort = self._airbnb_get(  # type: ignore[attr-defined]
                token, "v2/listing_permits", {"listing_id": str(listing_id)}
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, siehe Docstring
            log.warning(
                "airbnb_permits_nicht_abrufbar",
                property_id=property_id, error=str(exc)[:200],
            )
            return
        nummern = nummern_aus_permits(antwort)
        if not nummern:
            return
        # Komma-getrennt, wie das Feld es führt (`registrationList` splittet
        # daran).
        vorhanden["registrationNumbers"] = ", ".join(nummern)
        neu["compliance"] = vorhanden
        gesetzt.append("registrierungsnummer")
        log.info(
            "airbnb_registrierung_uebernommen",
            property_id=property_id, listing_id=listing_id, nummern=nummern,
        )
