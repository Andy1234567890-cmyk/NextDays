"""Verbundkonto im Service — Übersetzung UI-Formular → Stripe-Felder (0522).

Warum ein eigener Mixin und nicht ein paar Zeilen in `service.py`: die Abbildung
unserer Formularfelder auf Stripes Account-Struktur ist der Teil, der sich
ändert, wenn Stripe Anforderungen anpasst. Er gehört an EINE Stelle, nicht
verteilt über Router und Service (dieselbe Begründung wie bei `team_service.py`
und `tracking_service.py`; zusätzlich hält es `service.py` unter der
1500-Zeilen-Grenze von pylint).

Was hier NICHT passiert: Netzwerkverkehr mit Stripe. Der liegt in `connect.py`.
Hier wird ausschließlich umgeformt und entschieden, WAS gesendet wird.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from src.core.logging import get_logger

from . import connect
from .fehler import AffiliateError

if TYPE_CHECKING:
    from supabase import Client

    from .schemas import ConnectDaten

log = get_logger("nextdays.affiliates.connect_service")


def _adresse(a: Any) -> dict[str, Any]:  # noqa: ANN401
    """Adresse in Stripes Form. Leere Zusatzfelder werden WEGGELASSEN, nicht als
    Leerstring gesendet — Stripe wertet einen Leerstring als gesetzten Wert und
    meldet ihn als ungültig."""
    daten = {
        "line1": a.line1,
        "postal_code": a.postal_code,
        "city": a.city,
    }
    if a.line2:
        daten["line2"] = a.line2
    if a.state:
        daten["state"] = a.state
    return daten


def _person(p: Any) -> dict[str, Any]:  # noqa: ANN401
    daten: dict[str, Any] = {
        "first_name": p.first_name,
        "last_name": p.last_name,
        "dob": {"day": p.dob.day, "month": p.dob.month, "year": p.dob.year},
        "address": _adresse(p.address),
    }
    if p.email:
        daten["email"] = str(p.email)
    if p.phone:
        daten["phone"] = p.phone
    if p.nationality:
        daten["nationality"] = p.nationality.upper()
    if p.id_number:
        daten["id_number"] = p.id_number
    return daten


# Stripe-Pflichtfeld → Wert aus dem Formular. Nur die Felder, die DIESES Formular
# liefert; Bank, Zustimmung und Ausweis laufen über ihre eigenen Schritte, und
# Name/Geburtsdatum/Anschrift erzwingt schon das Schema. Der Präfix ist bei
# Privatpersonen `individual`, bei Unternehmen `representative` (Persons-API).
def fehlende_pflichtfelder(
    minimum: set[str], req: ConnectDaten, *, firma: bool
) -> list[str]:
    """Welche der live von Stripe verlangten Felder das Formular NICHT gefüllt
    hat. Der Fehler soll hier entstehen, nicht erst als offenes Requirement
    nach dem Absenden — dort steht nur ein Feldname, ohne Formular dazu."""
    person = "representative" if firma else "individual"
    werte: dict[str, Any] = {
        f"{person}.id_number": req.person.id_number,
        f"{person}.nationality": req.person.nationality,
        f"{person}.phone": req.person.phone,
        f"{person}.email": req.person.email,
        f"{person}.address.state": req.person.address.state,
    }
    if firma:
        werte.update(
            {
                "company.tax_id": req.company_tax_id,
                "company.vat_id": req.company_vat_id,
                "company.registration_number": req.company_registration_number,
                "company.phone": req.company_phone,
                "company.address.state": req.company_address.state
                if req.company_address
                else None,
            }
        )
    return sorted(f for f in minimum if f in werte and not werte[f])


class ConnectMixin:
    """Verbundkonto-Teil des AffiliatesService."""

    _db: Client | None

    @property
    def db(self) -> Client:  # pragma: no cover — im Hauptservice definiert
        raise NotImplementedError

    def connect_daten_senden(self, affiliate_id: str, req: ConnectDaten) -> dict[str, Any]:
        """Formulardaten an Stripe senden — je nach Rechtsform zwei Wege.

        `individual`: alles steckt im Account-Update unter `individual`.
        `company`: Firmendaten ins Account-Update, der Mensch MUSS über die
        Persons-API (Stripe nimmt ihn im Account-Update nicht an). Deshalb hier
        zwei Aufrufe statt einem — der zweite ist idempotent
        (`connect.person_setzen` aktualisiert eine vorhandene Person).
        """
        rows = (
            self.db.table("affiliates")
            .select("id, legal_form, stripe_account_id, country, email, vat_id")
            .eq("id", affiliate_id)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not rows:
            raise AffiliateError("Partner nicht gefunden.", status_code=404)
        if not rows[0].get("stripe_account_id"):
            raise AffiliateError("Es besteht noch kein Verbundkonto.", status_code=409)
        firma = rows[0].get("legal_form") == "company"

        # Was wir schon wissen, muss der Partner nicht noch einmal tippen:
        # E-Mail (Login) und USt-IdNr. (Steuerdaten) kommen aus dem Profil.
        if not req.person.email and rows[0].get("email"):
            req = req.model_copy(update={"person": req.person.model_copy(
                update={"email": rows[0]["email"]}
            )})
        if firma and not req.company_vat_id and rows[0].get("vat_id"):
            req = req.model_copy(update={"company_vat_id": rows[0]["vat_id"]})

        # Pflichtfelder LIVE aus Stripes Ländervorgabe (Wurzel 4) — fehlt eines,
        # ist das ein 422 mit Feldnamen, kein stilles Requirement danach.
        land = (rows[0].get("country") or "").upper()
        minimum = set(
            connect.pflichtfelder(land, "company" if firma else "individual")["minimum"]
        )
        fehlt = fehlende_pflichtfelder(minimum, req, firma=firma)
        if fehlt:
            raise AffiliateError(
                f"Stripe verlangt für {land} zusätzlich: {', '.join(fehlt)}.",
                status_code=422,
            )

        # `business_profile.name` geht MIT: seit `card_payments` mit angefordert
        # wird (03.09.2026, s. connect.py), leitet Stripe daraus die
        # Abbuchungsbezeichnung ab. Fehlt der Name, bleibt ein Requirement
        # offen und die Freischaltung hängt — ohne dass jemand sieht, woran.
        # Firmenname bei Unternehmen, sonst der Personenname; ein erfundener
        # Ersatzwert kommt nicht in Frage (Wurzel 4).
        anzeigename = (req.company_name or "").strip() if firma else ""
        if not anzeigename:
            anzeigename = " ".join(
                teil for teil in (req.person.first_name, req.person.last_name) if teil
            ).strip()
        profil: dict[str, Any] = {"url": req.url}
        if anzeigename:
            profil["name"] = anzeigename
        felder: dict[str, Any] = {"business_profile": profil}
        if firma:
            if not req.company_name or not req.company_address:
                raise AffiliateError(
                    "Für ein Unternehmen sind Firmenname und Firmenanschrift Pflicht.",
                    status_code=422,
                )
            firmendaten: dict[str, Any] = {
                "name": req.company_name,
                "address": _adresse(req.company_address),
            }
            if req.company_tax_id:
                firmendaten["tax_id"] = req.company_tax_id
            if req.company_vat_id:
                firmendaten["vat_id"] = req.company_vat_id
            if req.company_registration_number:
                firmendaten["registration_number"] = req.company_registration_number
            if req.company_phone:
                firmendaten["phone"] = req.company_phone
            felder["company"] = firmendaten
        else:
            felder["individual"] = _person(req.person)

        connect.daten_senden(self.db, affiliate_id, felder)

        if firma:
            # Der Vertreter ist zugleich Geschäftsführer und wirtschaftlich
            # Berechtigter (Personalunion, Ein-Personen-Agentur). Bei mehreren
            # Berechtigten setzt das Backoffice weitere Personen nach — der
            # Regelfall im Partnerprogramm ist eine Person.
            person = _person(req.person)
            person["relationship"] = {
                "representative": True,
                "director": True,
                "owner": True,
                "title": req.person.title or "Geschäftsführung",
                "percent_ownership": 100,
            }
            return connect.person_setzen(self.db, affiliate_id, person)

        return connect.status_abgleichen(self.db, affiliate_id)
