"""Rechnungsadresse und Rechnungsliste des Abos — Quelle ist Stripe.

Eigene Datei nach dem Muster von `preisliste.py`/`provisionsdeckel.py`: der
Block hing als geschlossener Abschnitt in `service.py` und hat die Datei über
die pylint-Grenze von 1500 Zeilen geschoben (C0302, CI-Lauf 33658299410 —
1508 Zeilen). Ausgelagert statt die Grenze angehoben, weil der Abschnitt
ohnehin eine eigene Zuständigkeit hat: die Rechnungsanschrift des Betriebs und
seine Rechnungen, beide bei Stripe geführt, nicht bei uns.

Die Adresse wird NICHT bei uns gespiegelt: `get_billing_address` liest den
Stripe-Customer und füllt Lücken aus dem `tenant_billing_profile` auf, statt
einen zweiten Wahrheitsstand zu pflegen (Wurzel 4). Fehlt der Customer noch,
kommt die reine Ableitung aus dem Profil zurück — kein erfundener Ersatzwert.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from stripe import StripeError as _StripeError
from supabase import Client

from src.core.security import AuthContext

# EU-Länderliste NICHT zweitkopieren — dieselbe Menge entscheidet über
# Reverse-Charge in den Eigentümer-Abrechnungen (Wurzel 4: eine Quelle).
from src.features.owner_statements.tax import EU_COUNTRIES as _EU_LAENDER

from .errors import SubscriptionsError
from .errors import field as _f
from .schemas import BillingAddress, InvoiceRow

_ISO_LAND_LAENGE = 2  # ISO-3166-1 alpha-2


class RechnungsadresseMixin:
    """Rechnungsadresse lesen/schreiben und Rechnungen listen (Stripe).

    Erwartet vom Host (`SubscriptionsService`): `self._require`, `self._load_row`,
    `self._ensure_customer`, `self._stripe`, `self._stripe_err`.
    """

    # -- Rechnungsadresse + Rechnungen (Quelle: Stripe) ---------------------
    def get_billing_address(self, ctx: AuthContext) -> BillingAddress:
        """Rechnungsadresse aus dem Stripe-Customer, ergänzt aus dem Betriebsprofil.

        Stripe ist die Quelle der Wahrheit für die Rechnungsstellung und hat
        daher Vorrang. Felder, die dort noch fehlen, werden aus dem im Konto
        gepflegten Betriebsprofil VORGESCHLAGEN — sonst müsste der Betrieb seine
        Anschrift ein zweites Mal eintippen. Existiert noch kein Customer,
        legen wir keinen an: ein Lesezugriff darf keinen Kunden erzeugen
        (Wurzel 2).
        """
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        customer_id = (row or {}).get("stripe_customer_id")
        vorschlag = self._address_from_billing_profile(db, tenant_id)
        if not customer_id:
            return vorschlag
        try:
            cus = self._stripe.v1.customers.retrieve(
                customer_id, params={"expand": ["tax_ids"]}
            )
        except _StripeError as exc:
            # Verwaiste ID (gelöschter Kunde, Account-/Key-Wechsel): wie „noch
            # keine Adresse" behandeln statt die Seite mit 400 zu blockieren.
            # Der Schreibpfad legt beim Speichern einen frischen Customer an.
            if getattr(exc, "code", None) == "resource_missing":
                return vorschlag
            raise self._stripe_err(exc) from exc
        return self._merge_address(self._billing_address_from_customer(cus), vorschlag)

    # Felder, bei denen das Betriebsprofil VORRANG hat. Stripes `name` und
    # `email` stammen beim Erstkauf aus dem Tenant (Betriebsname, Entwickler-
    # Adresse) und sind deshalb keine belastbare Personenangabe — stünde Stripe
    # hier vorn, erschiene der Firmenname als „Vorname". Die eigentliche
    # Anschrift (line1, city, …) gewinnt umgekehrt aus Stripe: dort hat der
    # Nutzer sie zuletzt bewusst für die Rechnungsstellung bestätigt.
    _PROFIL_HAT_VORRANG = ("first_name", "last_name", "email")

    @classmethod
    def _merge_address(
        cls, stripe_addr: BillingAddress, vorschlag: BillingAddress
    ) -> BillingAddress:
        """Stripe und Betriebsprofil zusammenführen.

        Grundregel: Stripe gewinnt, leere Felder kommen aus dem Profil. Für
        Personenname und E-Mail gilt das Gegenteil (siehe
        ``_PROFIL_HAT_VORRANG``). ``account_type`` bleibt der Stripe-Wert — er
        entscheidet über die Pflichtfelder im Formular.
        """
        ergaenzt: dict[str, Any] = {}
        for k, v in stripe_addr.model_dump().items():
            if k == "account_type":
                continue
            aus_profil = getattr(vorschlag, k, None)
            if k in cls._PROFIL_HAT_VORRANG:
                ergaenzt[k] = aus_profil or v
            else:
                ergaenzt[k] = v if v not in (None, "") else aus_profil
        ergaenzt["account_type"] = stripe_addr.account_type
        return BillingAddress(**ergaenzt)

    def _address_from_billing_profile(
        self, db: Client, tenant_id: str
    ) -> BillingAddress:
        """Vorbelegung aus dem Betriebsprofil (`tenant_billing_profile`).

        Solange am Stripe-Customer noch keine Rechnungsadresse hängt, stünde im
        Formular alles leer — obwohl der Betrieb seine Anschrift im Konto längst
        gepflegt hat. Diese Daten werden deshalb als VORSCHLAG geladen; sie
        werden erst zu Stripe geschrieben, wenn der Nutzer speichert. Fehlt das
        Profil, bleibt die Adresse leer (nichts erfinden, Wurzel 4).
        """
        rows = (
            db.table("tenant_billing_profile")
            .select(
                "legal_name, company_street, company_house_number, "
                "company_postal_code, company_city, company_country, "
                "company_state, email, vat_id, account_type, "
                "managing_director_first_name, managing_director_last_name"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if not rows:
            return BillingAddress()
        p = rows[0]

        def feld(name: str) -> str | None:
            """Getrimmter Wert oder None — im Profil stehen teils Leerzeichen am
            Ende ("Max "), die sonst auf der Rechnung landen."""
            wert = (p.get(name) or "").strip()
            return wert or None

        # Straße und Hausnummer stehen getrennt, Stripe kennt nur eine Zeile.
        strasse = " ".join(
            t for t in (feld("company_street"), feld("company_house_number")) if t
        )
        typ = "company" if p.get("account_type") == "company" else "individual"
        return BillingAddress(
            first_name=feld("managing_director_first_name"),
            last_name=feld("managing_director_last_name"),
            line1=strasse or None,
            city=feld("company_city"),
            state=feld("company_state"),
            postal_code=feld("company_postal_code"),
            country=feld("company_country"),
            email=feld("email"),
            account_type=typ,
            company_name=feld("legal_name"),
            vat_id=feld("vat_id"),
        )

    @staticmethod
    def _billing_address_from_customer(cus: Any) -> BillingAddress:  # noqa: ANN401
        """Stripe-Customer → BillingAddress. Vor-/Nachname liegen bei Stripe nur
        als EIN `name`-Feld; wir teilen am ERSTEN Leerzeichen (der Rest ist
        Nachname), damit mehrteilige Nachnamen wie 'van der Berg' heil bleiben."""
        addr = _f(cus, "address") or {}
        meta = _f(cus, "metadata") or {}
        konto_typ = _f(meta, "account_type") or "individual"
        voller_name = (_f(cus, "name") or "").strip()
        firma = _f(meta, "company_name")
        if konto_typ == "company":
            # Bei Unternehmen trägt `name` den Firmennamen — die Personennamen
            # stehen in den Metadaten, sonst gingen sie beim Speichern verloren.
            vorname = _f(meta, "first_name")
            nachname = _f(meta, "last_name")
            firma = firma or voller_name or None
        else:
            vorname, _, nachname = voller_name.partition(" ")
            vorname = vorname or None
            nachname = nachname.strip() or None
        steuer = _f(cus, "tax_ids") or {}
        steuer_daten = _f(steuer, "data") or []
        return BillingAddress(
            first_name=vorname,
            last_name=nachname,
            line1=_f(addr, "line1"),
            line2=_f(addr, "line2"),
            city=_f(addr, "city"),
            state=_f(addr, "state"),
            postal_code=_f(addr, "postal_code"),
            country=_f(addr, "country"),
            email=_f(cus, "email"),
            account_type=konto_typ,
            company_name=firma,
            vat_id=_f(steuer_daten[0], "value") if steuer_daten else None,
        )

    def update_billing_address(
        self, ctx: AuthContext, addr: BillingAddress
    ) -> BillingAddress:
        """Rechnungsadresse am Stripe-Customer setzen. Anders als beim Lesen legen
        wir hier bei Bedarf einen Customer an — der Nutzer will ja gerade seine
        Rechnungsdaten hinterlegen."""
        db, tenant_id = self._require(ctx)
        customer_id = self._ensure_customer(db, tenant_id)
        if addr.account_type not in ("individual", "company"):
            raise SubscriptionsError(
                "Konto-Typ muss 'individual' oder 'company' sein.", status_code=422
            )
        if addr.account_type == "company" and not (addr.company_name or "").strip():
            raise SubscriptionsError(
                "Für ein Unternehmen ist der Firmenname nötig.", status_code=422
            )
        land = (addr.country or "").strip().upper()
        if land and len(land) != _ISO_LAND_LAENGE:
            raise SubscriptionsError(
                "Land muss als 2-stelliger ISO-Code angegeben werden.", status_code=422
            )
        person = " ".join(
            t for t in ((addr.first_name or "").strip(), (addr.last_name or "").strip()) if t
        )
        ist_firma = addr.account_type == "company"
        params: dict[str, Any] = {
            "name": (addr.company_name or "").strip() if ist_firma else (person or None),
            "email": (addr.email or "").strip() or None,
            "address": {
                "line1": (addr.line1 or "").strip() or None,
                "line2": (addr.line2 or "").strip() or None,
                "city": (addr.city or "").strip() or None,
                "state": (addr.state or "").strip() or None,
                "postal_code": (addr.postal_code or "").strip() or None,
                "country": land or None,
            },
            # Personennamen und Konto-Typ überleben nur in den Metadaten: Stripe
            # kennt am Customer kein getrenntes Vor-/Nachname-Feld.
            "metadata": {
                "account_type": addr.account_type,
                "first_name": (addr.first_name or "").strip(),
                "last_name": (addr.last_name or "").strip(),
                "company_name": (addr.company_name or "").strip(),
            },
        }
        try:
            self._stripe.v1.customers.update(customer_id, params=params)
            self._sync_vat_id(customer_id, addr.vat_id, land)
            cus = self._stripe.v1.customers.retrieve(
                customer_id, params={"expand": ["tax_ids"]}
            )
        except _StripeError as exc:
            raise self._stripe_err(exc) from exc
        return self._billing_address_from_customer(cus)

    def _sync_vat_id(self, customer_id: str, vat_id: str | None, land: str) -> None:
        """USt-IdNr. am Customer pflegen. Stripe erlaubt kein Ändern einer
        tax_id — nur Anlegen/Löschen. Unverändert lassen wir sie stehen, damit
        eine bereits von Stripe VALIDIERTE Nummer ihren Status behält."""
        gewuenscht = (vat_id or "").strip().upper()
        vorhandene = self._stripe.v1.customers.tax_ids.list(
            customer_id, params={"limit": 100}
        )
        for eintrag in _f(vorhandene, "data") or []:
            if (_f(eintrag, "value") or "").upper() == gewuenscht:
                return  # schon gesetzt → nicht anfassen
            self._stripe.v1.customers.tax_ids.delete(
                customer_id, _f(eintrag, "id")
            )
        if not gewuenscht:
            return
        # EU-Länder → eu_vat; alles andere überlassen wir Stripes Autoerkennung
        # nicht, sondern lehnen es ab (falscher Typ erzeugt stumme Fehlrechnungen).
        if land not in _EU_LAENDER:
            raise SubscriptionsError(
                "USt-IdNr. wird derzeit nur für EU-Länder unterstützt.",
                status_code=422,
            )
        self._stripe.v1.customers.tax_ids.create(
            customer_id, params={"type": "eu_vat", "value": gewuenscht}
        )

    def list_invoices(self, ctx: AuthContext, *, limit: int = 24) -> list[InvoiceRow]:
        """Rechnungsverlauf aus Stripe. Ohne Customer gibt es nichts zu zeigen —
        leere Liste statt Fehler (der Betrieb hat schlicht noch nie gezahlt)."""
        db, tenant_id = self._require(ctx)
        row = self._load_row(db, tenant_id)
        customer_id = (row or {}).get("stripe_customer_id")
        if not customer_id:
            return []
        try:
            res = self._stripe.v1.invoices.list(
                params={"customer": customer_id, "limit": max(1, min(limit, 100))}
            )
        except _StripeError as exc:
            # Verwaiste ID → keine Rechnungen, kein Fehler (s. get_billing_address).
            if getattr(exc, "code", None) == "resource_missing":
                return []
            raise self._stripe_err(exc) from exc
        zeilen: list[InvoiceRow] = []
        for inv in _f(res, "data") or []:
            erstellt = _f(inv, "created")
            zeilen.append(
                InvoiceRow(
                    id=_f(inv, "id"),
                    number=_f(inv, "number"),
                    description=self._invoice_description(inv),
                    created=datetime.fromtimestamp(
                        int(erstellt or 0), tz=UTC
                    ).date().isoformat(),
                    # Stripe liefert Cent (kleinste Einheit) → in die Anzeige-
                    # Einheit umrechnen, die Währung kommt mit (kein €-Hardcode).
                    total=int(_f(inv, "total", 0) or 0) / 100,
                    currency=(_f(inv, "currency") or "").upper(),
                    status=_f(inv, "status"),
                    pdf_url=_f(inv, "invoice_pdf"),
                )
            )
        return zeilen

    @staticmethod
    def _invoice_description(inv: Any) -> str | None:  # noqa: ANN401
        """Sprechende Zeile für die Tabelle: die erste Position der Rechnung."""
        zeilen = _f(_f(inv, "lines") or {}, "data") or []
        if not zeilen:
            return _f(inv, "description")
        return _f(zeilen[0], "description") or _f(inv, "description")
