"""Booking→Invoice-Builder: Zimmerrechnung aus einer Reservierung erzeugen.

EINE Quelle der Wahrheit für alle buchungsbasierten Rechnungen — der Check-out
(reservations-Slice), die Vorschau fürs Erstellformular und der manuelle
„Rechnung aus Buchung"-Flow nutzen dieselbe Positions-Logik hier.

Fachliche Regeln (Nutzer-Entscheidung, siehe docs/ARCHITECTURE.md):
  * Rechnung aus Buchung erst NACH Check-in (checked_in_at gesetzt).
  * Beim Check-out entsteht verpflichtend eine finale Rechnung (GoBD-Nummer);
    create_from_reservation ist idempotent (bestehende aktive Rechnung wird
    zurückgegeben, nie doppelt fakturiert — Unique-Index 0092 als Backstop).
  * Keine Fallbacks: fehlende Währung oder fehlender Übernachtungs-Steuersatz
    (tenant_billing_profile.lodging_tax_rate) → klarer 422, kein stiller Default.

Positionsquellen:
  * reservations.quote_items ([{label, amount, kind?}], Brutto-Gastpreise) —
    enthalten NIE Upsell-Zeilen (Invariante: reservations/service ruft den
    Resolver ohne addons, booking_engine schreibt keine quote_items, Channex
    schreibt nur rooms/services) → Addons werden hier OHNE Dedup addiert.
  * reservation_addons (status != cancelled) mit Preis/Steuer-Snapshot.

Steuerlogik (v1): EIN Tenant-Satz `lodging_tax_rate` für alle Aufenthalts-
Positionen; Abgaben-Zeilen (kind='tax' bzw. Label = additiver taxes[].name aus
property_pricing_config, z. B. Kurtaxe) → 0 % USt als eigene Position; Zeilen
mit eigenem Satz-Snapshot (quote_items[].tax_rate, Gebühren wie Frühstück 19 %)
behalten diesen; Addons behalten ihren Snapshot-Satz. Kleinunternehmer → alles
0 %. Brutto→Netto wird je Zeile rückgerechnet (Decimal, ROUND_HALF_UP), damit
die Brutto-Summe exakt dem Buchungsbetrag + Addons entspricht.

Dokumentsprache: Belegtexte (Labels, head_text, Einheit) entstehen in der
Gastsprache (reservations.guest_language → doc_i18n, 24 EU-Sprachen); die
Sprache wird als invoices.language (0099) gespeichert, damit PDF/Versand
dieselbe Sprache vorbelegen. Unbekannt/fehlend → de.
"""
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from postgrest.exceptions import APIError
from supabase import Client

from src.core.logging import get_logger

from . import doc_i18n
from .service import BuchhaltungError, _q

log = get_logger("nextdays.buchhaltung.reservation_invoice")

# quote_items-`kind`-Werte, die mit dem Übernachtungs-Steuersatz fakturiert
# werden. 'tax' (Abgaben wie Kurtaxe) → 0 %; 'addon' kommt hier nie vor
# (Invariante oben), wird aber defensiv wie lodging behandelt.
_ZERO_RATE_KIND = "tax"
# Snapshot-Zeilen, die den Aufenthalt selbst tragen (booking_offers: "lodging",
# Direktbuchung: "stay") — sie werden als Nächte × Preis je Nacht fakturiert.
_STAY_KINDS = frozenset({"lodging", "stay"})

_HUNDRED = Decimal("100")


def _dec(value: object) -> Decimal:
    """DB-Numeric/float robust in Decimal (über str, nie float-Binärfehler)."""
    return Decimal(str(value if value is not None else 0))


def _addon_label(names: object, qty: int, language: str = "de") -> str:
    """Anzeigename eines Addon-Snapshots: Gastsprache vor de vor erstem
    vorhandenen Wert (name ist mehrsprachiges jsonb, Muster addons/service)."""
    names = names if isinstance(names, dict) else {}
    label = (
        names.get(language)
        or names.get("de")
        or next(iter(names.values()), doc_i18n.extra_service_label(language))
    )
    return f"{label} ×{qty}" if qty > 1 else str(label)


def _property_vat_rate(pricing_taxes: list[dict]) -> Decimal | None:
    """Objekt-eigene USt aus property_pricing_config.taxes (kind='vat',
    Prozent, „im Preis enthalten").

    Beherbergung wird am OBJEKTSTANDORT besteuert (Leistungsort, Art. 47
    MwStSystRL) — bei Portfolios über mehrere EU-Länder (27 Länder, Sätze
    7/9/10/13 % …) MUSS der Satz je Objekt gewinnen; der Tenant-Satz
    (tenant_billing_profile.lodging_tax_rate) ist nur der Standard für
    Objekte ohne eigene USt-Konfiguration.

    Es gibt je Objekt GENAU EINE USt (die Pflege erzwingt das, siehe
    properties/service.py `_normalize_taxes`); die Schleife findet sie und
    hört auf — kein stilles „erster von mehreren"."""
    for t in pricing_taxes:
        if not isinstance(t, dict) or t.get("kind") != "vat":
            continue
        if str(t.get("mode") or "percent") != "percent":
            continue
        if not bool(t.get("includedInPrice")):
            continue
        value = t.get("value")
        if value is not None:
            return _q(_dec(value))
    return None


def _additive_tax_labels(pricing_taxes: list[dict], language: str = "de") -> set[str]:
    """Namen der additiven Steuern/Abgaben aus property_pricing_config.taxes —
    der Resolver erzeugt quote_items-Labels aus dem gastseitigen Namen
    (`names[locale]`, sonst `name`; resolver.py §5), darüber werden Bestands-
    Zeilen ohne `kind` als Abgabe (0 % USt) erkannt. Beide Schreibweisen
    aufnehmen: ältere Snapshots tragen noch den internen Namen."""
    labels: set[str] = set()
    for t in pricing_taxes:
        if not isinstance(t, dict) or bool(t.get("includedInPrice")):
            continue
        names = t.get("names") if isinstance(t.get("names"), dict) else {}
        for kandidat in (
            names.get(language),
            names.get("de"),
            next(iter(names.values()), None),
            t.get("name"),
        ):
            if kandidat and str(kandidat).strip():
                labels.add(str(kandidat).strip())
    return labels


def _split_gross(gross: Decimal, rate: Decimal) -> tuple[Decimal, Decimal]:
    """Brutto in (netto, steuer) zerlegen; Brutto bleibt exakt erhalten."""
    net = _q(gross / (Decimal("1") + rate / _HUNDRED))
    return net, _q(gross - net)


def _line(
    description: str,
    gross: Decimal,
    rate: Decimal,
    unit: str = "pauschal",
    *,
    basis: str = "per_stay",
    quantity: Decimal = Decimal("1"),
) -> dict:
    """Eine Rechnungsposition (Beträge als Decimal).

    Standard ist EINE Zeile mit Menge 1 (Mengen stecken im Label). Mit
    ``quantity`` > 1 (Übernachtung: Nächte × Preis je Nacht, 0698) wird der
    Netto-Einzelpreis aus dem Gesamtnetto abgeleitet — nur wenn das ohne Rest
    aufgeht; sonst bleibt der Aufrufer bei Menge 1, damit Σ Positionen exakt
    dem vereinbarten Betrag entspricht (GoBD)."""
    net, tax = _split_gross(gross, rate)
    unit_price = net
    if quantity > 1:
        # Der GASTPREIS je Nacht ist die runde Größe (100,00 brutto), nicht der
        # Nettoanteil. Geht der Bruttobetrag ohne Rest auf die Nächte auf, wird
        # je Nacht netto/steuer gesplittet; Σ Zeile bleibt exakt der vereinbarte
        # Bruttobetrag. Sonst bleibt es bei EINER Zeile (Menge 1, pauschal).
        gross_unit = gross / quantity
        if _q(gross_unit) * quantity == _q(gross):
            unit_price, _ = _split_gross(_q(gross_unit), rate)
            net = _q(unit_price * quantity)
            tax = _q(gross - net)
        else:
            quantity = Decimal("1")
            basis = "per_stay"
    return {
        "description": description,
        "quantity": quantity,
        "unit": unit,
        "basis": basis,
        "unit_price": unit_price,
        "tax_rate": rate,
        "net_amount": net,
        "tax_amount": tax,
        "gross_amount": _q(gross),
    }


def _stay_line(
    label: str,
    amount: Decimal,
    rate: Decimal,
    nights: int,
    flat_unit: str,
    language: str,
    aufenthalt: dict | None = None,
) -> dict:
    """Sammelposition Aufenthalt: als „Nächte × Preis je Nacht" (0698), wenn
    Nächte bekannt und der Betrag ≠ 0 — sonst eine pauschale Zeile.

    `aufenthalt` trägt Objekt und Zeitraum DIESER Zeile (0702) — auf dem Beleg
    steht damit „Objekt · Anreise – Abreise" auch ohne Kopfzeitraum."""
    if nights > 0 and amount != 0:
        zeile = _line(
            label, amount, rate, doc_i18n.night_unit(language),
            basis="per_night", quantity=Decimal(nights),
        )
    else:
        zeile = _line(label, amount, rate, flat_unit)
    return {**zeile, **(aufenthalt or {})}


def _aufenthalt(reservation: dict) -> tuple[str, str, int]:
    """Anreise, Abreise und Nächte der Buchung (0 Nächte bei fehlenden Daten)."""
    check_in = str(reservation.get("check_in") or "")
    check_out = str(reservation.get("check_out") or "")
    try:
        nights = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        nights = 0
    return check_in, check_out, nights


def build_positions(
    reservation: dict,
    addons: list[dict],
    pricing_taxes: list[dict],
    lodging_tax_rate: Decimal | None,
    is_klein: bool,
    property_title: str,
    language: str = "de",
) -> list[dict]:
    """Rechnungspositionen aus Buchung + Addons (pure Funktion, DB-frei).

    `language` = Dokumentsprache (doc_i18n) für die hier ERZEUGTEN Texte
    (Sammelposition, Einheit, Addon-Fallback); Snapshot-Labels aus quote_items
    bleiben unverändert (Kaufzeitpunkt-Wahrheit).

    Wirft BuchhaltungError 422, wenn der Übernachtungs-Steuersatz fehlt (und
    kein Kleinunternehmer) oder gar keine fakturierbare Position entsteht.
    """
    unit = doc_i18n.flat_rate_unit(language)
    tax_labels = _additive_tax_labels(pricing_taxes, language)
    total_amount = _dec(reservation.get("total_amount"))
    quote_items = [
        it for it in (reservation.get("quote_items") or []) if isinstance(it, dict)
    ]
    items_sum = _q(sum((_dec(it.get("amount")) for it in quote_items), Decimal("0")))
    # Add-on-Bruttosumme (nicht stornierte): quote_items enthält die Add-ons NICHT
    # (sie werden separat als eigene Positionen fakturiert), aber total_amount kann
    # sie enthalten (öffentliche Buchung/Direktbuchung: total = Unterkunft + Add-ons).
    # Für den Abgleich „Aufschlüsselung passt zum Gesamtpreis" daher items_sum PLUS
    # Add-on-Summe gegen total_amount prüfen — sonst würde die Aufschlüsselung als
    # nicht-passend verworfen und eine Sammelposition über den vollen total_amount
    # (inkl. Add-on-Anteil) erzeugt, wodurch die Add-ons DOPPELT fakturiert würden.
    addons_sum = _q(
        sum(
            (_dec(a.get("total")) for a in addons if a.get("status") != "cancelled"),
            Decimal("0"),
        )
    )

    def lodging_rate() -> Decimal:
        if is_klein:
            return Decimal("0")
        if lodging_tax_rate is None:
            raise BuchhaltungError(
                "Übernachtungs-Steuersatz fehlt — bitte im Preis-Setup des "
                "Objekts eine USt anlegen (Steuern → USt./Mehrwertsteuer, "
                "„im Preis enthalten“) ODER im Konto den Standard-USt-Satz "
                "Übernachtung hinterlegen.",
                status_code=422,
            )
        return _q(lodging_tax_rate)

    positions: list[dict] = []

    # Aufenthalts-Positionen: die Snapshot-Aufschlüsselung, WENN sie zum
    # vereinbarten Gesamtpreis passt. Bei manuell überschriebenem total_amount
    # (Wizard erlaubt das) oder fehlendem Snapshot (Buchungsstrecken-Bestand,
    # manche OTAs) wird ehrlich EINE Sammelposition über den vereinbarten
    # Betrag fakturiert — keine erfundene Aufschlüsselung. Auch 0 € ist ein
    # gültiger vereinbarter Preis (Comp-Aufenthalt): der Check-out darf nie an
    # einem 0-Beleg scheitern (Pflicht-Rechnung beim Check-out).
    check_in, check_out, nights = _aufenthalt(reservation)
    # Objekt + Zeitraum DIESER Übernachtungszeile (0702) — der Belegkopf trägt
    # denselben Aufenthalt, die Zeile bleibt aber auch ohne ihn aussagefähig.
    zeilen_aufenthalt = {
        "property_id": str(reservation.get("property_id") or "") or None,
        "check_in": check_in or None,
        "check_out": check_out or None,
    }
    breakdown_matches = quote_items and abs(
        items_sum + addons_sum - total_amount
    ) <= Decimal("0.01")
    if breakdown_matches:
        for it in quote_items:
            gross = _q(_dec(it.get("amount")))
            if gross == 0:
                continue
            label = str(it.get("label") or "").strip() or doc_i18n.item_fallback_label(
                language
            )
            kind = str(it.get("kind") or "").strip()
            is_levy = kind == _ZERO_RATE_KIND if kind else label in tax_labels
            # Prioritätskette: Kleinunternehmer → 0 %; zeilen-eigener Satz-
            # Snapshot (Gebühr mit eigener USt, z. B. Frühstück 19 %) → dieser;
            # Abgabe (kind='tax'/Label) → 0 %; sonst Übernachtungssatz.
            # Bestands-Snapshots und Channex-Fees haben nie tax_rate → alter Pfad.
            line_rate = it.get("tax_rate")
            if is_klein:
                rate = Decimal("0")
            elif line_rate is not None:
                rate = _q(_dec(line_rate))
            elif is_levy:
                rate = Decimal("0")
            else:
                rate = lodging_rate()
            if kind in _STAY_KINDS:
                # Übernachtungszeile des Snapshots: Nächte × Preis je Nacht (0698).
                positions.append(
                    _stay_line(label, gross, rate, nights, unit, language, zeilen_aufenthalt)
                )
            else:
                positions.append(_line(label, gross, rate, unit))
    if not positions:
        label = doc_i18n.stay_label(language, property_title, check_in, check_out, nights)
        # Add-ons werden unten IMMER als eigene Positionen fakturiert. Der Sammel-
        # betrag für den Aufenthalt muss daher OHNE den Add-on-Anteil bestimmt
        # werden, sonst Doppelfaktura. Der Fallback greift nur, wenn die Aufschlüss-
        # elung NICHT zum Gesamtpreis passt — dafür gibt es zwei Ursachen:
        #  1) Add-ons im Spiel (addons_sum > 0): breakdown kippte, weil sich die
        #     Add-on-Summe verschob (nachträglicher Kauf/Storno). Der Aufenthalt
        #     bleibt der verlässliche Snapshot items_sum (add-on-frei per Invariante),
        #     Add-ons on-top → Summe = items_sum + addons_sum, keine Doppelfaktura.
        #     Ohne quote_items (Bestand/OTA) nur total_amount bekannt: enthält es die
        #     Add-ons (total >= addons_sum), abziehen; sonst (Add-ons on-top) belassen.
        #  2) Keine Add-ons (addons_sum == 0): breakdown kippte durch manuellen
        #     total_amount-Override (Wizard) → der vereinbarte total_amount ist die
        #     Wahrheit, EINE ehrliche Sammelposition darüber (kein items_sum).
        if addons_sum > 0:
            if quote_items:
                stay_amount = items_sum
            elif total_amount >= addons_sum:
                stay_amount = _q(total_amount - addons_sum)
            else:
                stay_amount = total_amount
        else:
            stay_amount = total_amount
        rate = Decimal("0") if stay_amount == 0 else lodging_rate()
        # 0-Sammelposition nur unterdrücken, wenn Add-ons folgen (sie tragen den
        # Beleg). Ohne Add-ons (Comp-Aufenthalt 0 €) MUSS die 0-Position bleiben,
        # damit der Pflicht-Check-out-Beleg nicht leer ist.
        if stay_amount != 0 or addons_sum == 0:
            positions.append(
                _stay_line(label, stay_amount, rate, nights, unit, language, zeilen_aufenthalt)
            )

    # Upsells: eigene Positionen mit Snapshot-Steuersatz (NULL = 0 % ist die
    # dokumentierte Kaufzeitpunkt-Wahrheit aus 0075, kein erfundener Default).
    for addon in addons:
        if addon.get("status") == "cancelled":
            continue
        gross = _q(_dec(addon.get("total")))
        if gross == 0:
            continue
        rate = Decimal("0") if is_klein else _q(_dec(addon.get("tax_rate")))
        qty = max(int(addon.get("qty") or 1), 1)
        positions.append(
            _line(
                _addon_label(addon.get("name"), qty, language), gross, rate, unit,
                basis=str(addon.get("basis") or "per_stay"),
            )
        )

    return positions


def _finalize_reservation_draft(
    db: Client,
    tenant_id: str,
    invoice_id: str,
    reservation_id: str,
    *,
    payment_method: str,
    card_brand: str | None,
) -> dict:
    """Einen bestehenden Buchungs-Entwurf (ohne Nummer) beim Check-out finalisieren:
    fortlaufende GoBD-Nummer ziehen + Status auf finalized/paid setzen. Positionen +
    Beträge bleiben (der Entwurf trägt sie schon). Gibt {id, invoice_number,
    already_existed:False} zurück."""
    row = (
        db.table("invoices")
        .select("gross_amount, paid_amount, currency")
        .eq("id", invoice_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not row:
        raise BuchhaltungError("Rechnungsentwurf nicht gefunden.", status_code=404)
    gross_total = _dec(row[0].get("gross_amount"))
    paid_before = _dec(row[0].get("paid_amount"))
    # GoBD-Nummer atomar ziehen (Row-Lock in next_document_number).
    num = (
        db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": "invoice", "p_prefix": "RE-"},
        ).execute()
    ).data or [{}]
    invoice_number = num[0].get("formatted_number")
    seq = num[0].get("sequential_number")
    if not invoice_number:
        raise BuchhaltungError(
            "Rechnungsnummer konnte nicht gezogen werden.", status_code=500
        )
    today = datetime.now(UTC).date()
    paid_at_desk = payment_method in ("cash", "card")
    paid = gross_total if paid_at_desk else paid_before
    fully_paid = paid_at_desk or Decimal("0") < gross_total <= paid
    patch: dict = {
        "invoice_number": invoice_number,
        "invoice_sequence": seq,
        "invoice_year": today.year,
        "status": "paid" if fully_paid else "finalized",
        "issue_date": today.isoformat(),
        "paid_amount": str(min(paid, gross_total)),
        "payment_method": payment_method,
        "card_brand": card_brand if payment_method == "card" else None,
    }
    if fully_paid:
        patch["paid_at"] = datetime.now(UTC).isoformat()
    patch = {k: v for k, v in patch.items() if v is not None}
    try:
        db.table("invoices").update(patch).eq("id", invoice_id).eq(
            "tenant_id", tenant_id
        ).execute()
    except APIError as exc:
        if "invoices_tenant_number_uidx" in str(exc):
            raise BuchhaltungError(
                "Diese Rechnungsnummer ist bereits vergeben.", status_code=409
            ) from exc
        raise
    log.info(
        "reservation_draft_finalized",
        reservation_id=reservation_id, invoice_id=invoice_id,
        invoice_number=invoice_number,
    )
    return {
        "id": invoice_id,
        "invoice_number": invoice_number,
        "already_existed": False,
    }


def rebuild_draft_for_reservation(
    db: Client, tenant_id: str, reservation_id: str
) -> bool:
    """Einen noch NICHT nummerierten Rechnungsentwurf aus dem Bestand neu aufbauen.

    Anlass (14.08.2026): Beim Storno einer Zusatzleistung wurde ein Entwurf
    durchgelassen mit der Begründung, er werde „beim Check-out ohnehin neu aus
    dem Bestand aufgebaut". Das ist NICHT der Fall — `_finalize_reservation_draft`
    zieht nur die Nummer und übernimmt `gross_amount`/`paid_amount` unverändert,
    die `invoice_line_items` bleiben stehen. Die stornierte Position wäre also als
    nummerierte GoBD-Position auf der Rechnung gelandet.

    Statt das Storno zu verbieten (der Entwurf ist ja gerade der noch änderbare
    Zustand), wird der Entwurf hier mit den aktuellen Positionen neu geschrieben:
    Positionen ersetzt, Summen und `paid_amount` neu gerechnet. Nummer, Status und
    Debitor bleiben unberührt — es entsteht kein Beleg und keine Nummernkreis-Lücke.

    Angefasst wird NUR ein echter Entwurf: `status='draft'`, keine Nummer, nicht
    `is_locked` — dasselbe Gate, das `update_invoice_raw`/`delete_invoice` fahren.
    Alles andere bleibt unberührt (auch ein handgeschriebener Beleg mit eigenen
    Positionen, der dieselbe `reservation_id` trägt).

    Rückgabe: True, wenn ein Entwurf neu aufgebaut wurde; False, wenn keiner
    existiert oder er nicht angefasst werden darf (dann gibt es hier nichts zu
    pflegen).

    Fail-closed (Wurzel 5): Fehler werden nicht geschluckt, sondern als
    `BuchhaltungError` weitergegeben — lieber bricht das Storno ab, als dass ein
    Entwurf mit falschen Beträgen stehen bleibt und beim Check-out eine Nummer
    bekommt.
    """
    existing = find_active_invoice(db, tenant_id, reservation_id)
    if not existing:
        return False
    # Dasselbe Gate wie `BuchhaltungService.update_invoice_raw`/`delete_invoice`:
    # festgeschrieben = Nummer vergeben ODER Status ≠ draft ODER is_locked. Ein
    # Check nur auf die Nummer hätte einen HANDGESCHRIEBENEN Entwurf
    # überschrieben: „Rechnung aus Buchung" erlaubt eigene Beschreibungen,
    # Rabatte und manuelle Beträge und trägt dieselbe reservation_id — der
    # Neuaufbau hätte alle Positionen gelöscht und aus dem Bestand neu erzeugt,
    # ohne Warnung, während der Nutzer nur eine Zusatzleistung storniert hat.
    if (
        existing.get("invoice_number")
        or str(existing.get("status") or "") != "draft"
        or bool(existing.get("is_locked"))
    ):
        log.info(
            "reservation_invoice_draft_rebuild_uebersprungen",
            reservation_id=reservation_id,
            invoice_id=str(existing["id"]),
            status=existing.get("status"),
            hat_nummer=bool(existing.get("invoice_number")),
            is_locked=bool(existing.get("is_locked")),
        )
        return False
    invoice_id = str(existing["id"])
    try:
        ctx = _load_context(db, tenant_id, reservation_id, pruefe_erstellbar=False)
    except BuchhaltungError as exc:
        # Bleibt nach dem Storno GAR KEINE fakturierbare Position übrig (422 aus
        # `build_positions`), ist der Entwurf gegenstandslos — dann wird er NICHT
        # halb aktualisiert stehen gelassen, sondern der Aufrufer erfährt davon.
        # Ein Entwurf mit alten Positionen wäre die schlechtere Alternative: er
        # bekäme beim Check-out eine Nummer.
        log.warning(
            "reservation_invoice_draft_rebuild_unmoeglich",
            reservation_id=reservation_id,
            invoice_id=invoice_id,
            grund=exc.message,
        )
        raise
    positions = ctx["positions"]
    net_total = _q(sum((p["net_amount"] for p in positions), Decimal("0")))
    tax_total = _q(sum((p["tax_amount"] for p in positions), Decimal("0")))
    gross_total = _q(sum((p["gross_amount"] for p in positions), Decimal("0")))
    # `paid_amount` zählt bezahlte Zusatzleistungen mit (s. `_load_context`) —
    # wird eine Bezahlt-Markierung zurückgenommen, muss der Betrag hier sinken.
    # Sonst schreibt `_finalize_reservation_draft` ein zu hohes „bereits bezahlt"
    # als `paid_before` fest.
    paid_total = _q(min(ctx["paid_amount"], gross_total))
    try:
        db.table("invoice_line_items").delete().eq("invoice_id", invoice_id).execute()
        if positions:
            db.table("invoice_line_items").insert(
                [
                    {
                        "invoice_id": invoice_id,
                        "position": pos,
                        "description": p["description"],
                        "quantity": str(p["quantity"]),
                        "unit": p["unit"],
                        "basis": p.get("basis"),
                        "property_id": p.get("property_id"),
                        "check_in": p.get("check_in"),
                        "check_out": p.get("check_out"),
                        "unit_price": str(p["unit_price"]),
                        "tax_rate": str(p["tax_rate"]),
                        "discount_percent": "0",
                        "net_amount": str(p["net_amount"]),
                        "tax_amount": str(p["tax_amount"]),
                        "gross_amount": str(p["gross_amount"]),
                    }
                    for pos, p in enumerate(positions, start=1)
                ]
            ).execute()
        db.table("invoices").update(
            {
                "net_amount": str(net_total),
                "tax_amount": str(tax_total),
                "gross_amount": str(gross_total),
                "paid_amount": str(paid_total),
            }
        ).eq("id", invoice_id).eq("tenant_id", tenant_id).execute()
    except APIError as exc:
        raise BuchhaltungError(
            f"Rechnungsentwurf konnte nicht aktualisiert werden: {exc.message}",
            status_code=500,
        ) from exc
    log.info(
        "reservation_invoice_draft_rebuilt",
        reservation_id=reservation_id,
        invoice_id=invoice_id,
        positionen=len(positions),
        gross=str(gross_total),
    )
    return True


def find_active_invoice(db: Client, tenant_id: str, reservation_id: str) -> dict | None:
    """Aktive (nicht stornierte, nicht gelöschte) Rechnung zu einer Buchung."""
    rows = (
        db.table("invoices")
        .select("id, invoice_number, status, gross_amount, currency, is_locked")
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .eq("invoice_type", "invoice")
        .neq("status", "cancelled")
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    return rows[0] if rows else None


def ensure_customer_for_guest(db: Client, tenant_id: str, reservation: dict) -> dict:
    """Debitor zum Gast der Buchung liefern — wiederverwenden oder anlegen.

    Ein Kunde je Gast je Tenant (Unique customers_tenant_guest_uq, 0092);
    bei Insert-Race gewinnt die vorhandene Zeile (Re-Select). Der Debitor ist
    GoBD-relevant und überlebt Gast-Löschungen (guest_id on delete set null).
    """
    guest_id = reservation.get("guest_id")
    if not guest_id:
        raise BuchhaltungError(
            "Buchung hat keinen zugeordneten Gast — Rechnungsempfänger bitte "
            "im Rechnungsformular wählen.",
            status_code=422,
        )

    def _existing() -> dict | None:
        rows = (
            db.table("customers")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("guest_id", guest_id)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        ).data
        return rows[0] if rows else None

    found = _existing()
    if found:
        return found

    guest_rows = (
        db.table("guests")
        .select("name, email, phone")
        .eq("id", guest_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    guest = guest_rows[0] if guest_rows else {}
    name = str(guest.get("name") or "").strip()
    if not name:
        raise BuchhaltungError(
            "Der Gast dieser Buchung hat keinen Namen — Rechnungsempfänger "
            "bitte im Rechnungsformular wählen.",
            status_code=422,
        )

    # Serverseitige Kundennummer über den gemeinsamen Nummernkreis-Mechanismus
    # (legt den 'customer'-Kreis beim ersten Zug selbst an, Migration 0025).
    num = (
        db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": "customer", "p_prefix": "KD-"},
        ).execute()
    ).data or [{}]
    customer_number = num[0].get("formatted_number")

    address = (
        {"country": reservation.get("guest_country")}
        if reservation.get("guest_country")
        else None
    )
    row = {
        "tenant_id": tenant_id,
        "guest_id": guest_id,
        "customer_number": customer_number,
        "name": name,
        "email": guest.get("email") or reservation.get("guest_email"),
        "phone": guest.get("phone") or reservation.get("guest_phone"),
        "customer_type": "private",
        "address": address,
    }
    row = {k: v for k, v in row.items() if v is not None}
    try:
        ins = db.table("customers").insert(row).execute()
    except APIError as exc:
        # Unique-Race (zwei parallele Belege für denselben Gast): die zuerst
        # angelegte Zeile gewinnt.
        found = _existing()
        if found:
            return found
        raise BuchhaltungError(
            f"Kunde zum Gast konnte nicht angelegt werden: {exc.message}",
            status_code=500,
        ) from exc
    if not ins.data:
        raise BuchhaltungError(
            "Kunde zum Gast konnte nicht angelegt werden.", status_code=500
        )
    return ins.data[0]


def _load_context(
    db: Client,
    tenant_id: str,
    reservation_id: str,
    *,
    pruefe_erstellbar: bool = True,
) -> dict:
    """Buchung + Profil + Steuern + Addons laden und die Regeln validieren
    (gemeinsamer Unterbau von preview_for_reservation/create_from_reservation).

    `pruefe_erstellbar=False` lässt die beiden Vorbedingungen des ERSTELLENS aus
    (nicht storniert, eingecheckt) — für den Neuaufbau eines bereits bestehenden
    Entwurfs, dessen Beträge auch vorher schon korrigierbar sein müssen. Alle
    übrigen Prüfungen (Profil, Währung, Steuersatz) bleiben in Kraft."""
    rows = (
        db.table("reservations")
        .select("*, guests(name, first_name, last_name, email, phone)")
        .eq("id", reservation_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not rows:
        raise BuchhaltungError("Buchung nicht gefunden.", status_code=404)
    reservation = rows[0]

    # Diese beiden Vorbedingungen gelten fürs ERSTELLEN einer Rechnung. Beim
    # Neuaufbau eines schon vorhandenen Entwurfs (`rebuild_draft_for_reservation`)
    # dürfen sie NICHT greifen: Der Entwurf existiert ja bereits, seine Beträge
    # müssen auch dann noch korrigierbar sein, wenn der Gast noch nicht
    # eingecheckt ist — sonst bliebe eine stornierte Position darin stehen und
    # bekäme beim Check-out eine GoBD-Nummer.
    if pruefe_erstellbar:
        if reservation.get("status") == "cancelled":
            raise BuchhaltungError(
                "Stornierte Buchung kann nicht abgerechnet werden.", status_code=409
            )
        if not reservation.get("checked_in_at"):
            raise BuchhaltungError(
                "Der Gast ist noch nicht eingecheckt — Rechnungen aus Buchungen "
                "sind erst nach dem Check-in möglich.",
                status_code=409,
            )
    profile_rows = (
        db.table("tenant_billing_profile")
        .select(
            "legal_name, is_kleinunternehmer, lodging_tax_rate, default_payment_days"
        )
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data
    if not profile_rows:
        raise BuchhaltungError(
            "Firmenprofil fehlt — bitte zuerst die Stammdaten in der "
            "Buchhaltung ausfüllen.",
            status_code=422,
        )
    profile = profile_rows[0]

    title_rows = (
        db.table("properties")
        .select("title")
        .eq("id", reservation["property_id"])
        .limit(1)
        .execute()
    ).data
    property_title = (title_rows[0].get("title") or "") if title_rows else ""

    config_rows = (
        db.table("property_pricing_config")
        .select("taxes, currency")
        .eq("property_id", reservation["property_id"])
        .limit(1)
        .execute()
    ).data
    pricing_config = config_rows[0] if config_rows else {}
    pricing_taxes = pricing_config.get("taxes") or []

    # Währung: Buchungs-Snapshot, sonst deterministisch aus der Preis-
    # konfiguration des Objekts (dieselbe Quelle wie der Preis-Resolver:
    # property_pricing_config.currency → rate_plans.currency). Bestands-
    # buchungen ohne Snapshot (currency nullable seit 0078) bleiben damit
    # abrechenbar — erfunden wird weiterhin nichts: ohne konfigurierte
    # Währung schlägt die Rechnung mit klarer Meldung fehl.
    currency = str(reservation.get("currency") or "").strip()
    if not currency:
        currency = str(pricing_config.get("currency") or "").strip()
    if not currency:
        rp_rows = (
            db.table("rate_plans")
            .select("currency")
            .eq("property_id", reservation["property_id"])
            .order("created_at")
            .limit(1)
            .execute()
        ).data
        currency = str((rp_rows[0].get("currency") if rp_rows else "") or "").strip()
    if not currency:
        raise BuchhaltungError(
            "Buchung hat keine Währung und das Objekt hat keine Preis-"
            "Konfiguration mit Währung — bitte im Preis-Setup des Objekts "
            "eine Währung hinterlegen (kein Standardwert wird angenommen).",
            status_code=422,
        )

    addons = (
        db.table("reservation_addons")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("reservation_id", reservation_id)
        .execute()
    ).data or []

    is_klein = bool(profile.get("is_kleinunternehmer"))
    # Übernachtungs-USt: Objektsatz (Preis-Setup → Steuern, kind='vat',
    # „im Preis enthalten") gewinnt über den Tenant-Standard — Leistungsort
    # der Beherbergung ist der Objektstandort (27 EU-Länder, s. Helper).
    lodging_tax_rate = _property_vat_rate(pricing_taxes)
    if lodging_tax_rate is None:
        lodging_raw = profile.get("lodging_tax_rate")
        lodging_tax_rate = _dec(lodging_raw) if lodging_raw is not None else None

    # Dokumentsprache = Gastsprache (24 EU-Sprachen; unbekannt/fehlend → de).
    language = doc_i18n.resolve_language(reservation.get("guest_language"))

    positions = build_positions(
        reservation,
        addons,
        pricing_taxes,
        lodging_tax_rate,
        is_klein,
        property_title,
        language,
    )

    paid = _dec(reservation.get("paid_amount"))
    for addon in addons:
        if addon.get("status") == "paid":
            paid += _dec(addon.get("total"))

    return {
        "reservation": reservation,
        "profile": profile,
        "property_title": property_title,
        "positions": positions,
        "currency": currency,
        "is_klein": is_klein,
        "paid_amount": _q(paid),
        "language": language,
    }


def find_customer_for_guest(
    db: Client, tenant_id: str, guest_id: str | None
) -> dict | None:
    """Aktiven Debitor zum Gast finden (ohne anzulegen)."""
    if not guest_id:
        return None
    rows = (
        db.table("customers")
        .select("*")
        .eq("tenant_id", tenant_id)
        .eq("guest_id", guest_id)
        .is_("deleted_at", "null")
        .limit(1)
        .execute()
    ).data
    return rows[0] if rows else None


def preview_for_reservation(db: Client, tenant_id: str, reservation_id: str) -> dict:
    """Vorbefüllung fürs Erstellformular (camelCase wie der Bestand erwartet).
    Identische Positions-Logik wie der Check-out — eine Quelle der Wahrheit.

    Bewusst OHNE Schreibeffekt: der Debitor wird erst beim tatsächlichen
    Speichern (create_invoice_from_bestand) bzw. Check-out angelegt — eine
    Vorschau darf weder KD-Nummern ziehen noch Stammdaten anlegen.

    Bewusst UNMASKIERT (kein GuestMask): eine Rechnung ist ein rechtliches
    Dokument und braucht den vollen Empfängernamen; Zugriff erfordert
    OWNER_REPORTING — derselbe Kreis sieht die Debitoren-Stammdaten bereits
    über GET /buchhaltung/customers. Die Picker-LISTE (billable_reservations)
    bleibt dagegen maskiert wie alle Reservierungslisten."""
    existing = find_active_invoice(db, tenant_id, reservation_id)
    if existing:
        raise BuchhaltungError(
            f"Zu dieser Buchung existiert bereits Rechnung "
            f"{existing.get('invoice_number')}.",
            status_code=409,
        )
    ctx = _load_context(db, tenant_id, reservation_id)
    reservation = ctx["reservation"]
    customer = find_customer_for_guest(db, tenant_id, reservation.get("guest_id"))

    guest = reservation.get("guests") or {}
    if not isinstance(guest, dict):
        guest = {}
    guest_name = guest.get("name", "")

    # Stammdaten aus der Gästemappe fürs Empfänger-Formular: Vorname/Nachname,
    # Firma + USt-IdNr. (0046, Geschäftsreisende → Empfänger „Organisation")
    # und die primäre Adresse (guest_addresses) — sonst bleibt der Empfänger
    # im Formular leer, obwohl die Mappe die Daten längst hat.
    address = None
    company = ""
    company_vat_id = ""
    if reservation.get("guest_id"):
        guest_rows = (
            db.table("guests")
            .select("company, vat_id")
            .eq("id", reservation["guest_id"])
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if guest_rows:
            company = (guest_rows[0].get("company") or "").strip()
            company_vat_id = (guest_rows[0].get("vat_id") or "").strip()
        addr_rows = (
            db.table("guest_addresses")
            .select("street, house_no, postal_code, city, country")
            .eq("tenant_id", tenant_id)
            .eq("guest_id", reservation["guest_id"])
            .order("is_primary", desc=True)
            .limit(1)
            .execute()
        ).data
        if addr_rows:
            a = addr_rows[0]
            address = {
                "street": a.get("street") or "",
                "houseNo": a.get("house_no") or "",
                "postalCode": a.get("postal_code") or "",
                "city": a.get("city") or "",
                "country": a.get("country") or "",
            }

    check_in = str(reservation.get("check_in") or "")
    check_out = str(reservation.get("check_out") or "")
    try:
        nights = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        nights = 0

    return {
        "reservationId": reservation["id"],
        "customerId": customer["id"] if customer else None,
        "customerName": (customer.get("name") if customer else guest_name) or "",
        "customerFirstName": (guest.get("first_name") or "").strip(),
        "customerLastName": (guest.get("last_name") or "").strip(),
        # Firmengast (Gästemappe „Firma"): Empfänger ist die Organisation.
        "company": company,
        "companyVatId": company_vat_id,
        "address": address,
        "customerEmail": (
            (customer.get("email") if customer else None)
            or guest.get("email")
            or reservation.get("guest_email")
            or ""
        ),
        "customerNumber": (customer.get("customer_number") if customer else "") or "",
        "currency": ctx["currency"],
        "propertyTitle": ctx["property_title"],
        "propertyId": str(reservation.get("property_id") or ""),
        "stay": {"from": check_in, "to": check_out, "nights": nights},
        # Personen (Erwachsene + Kinder) für Positionen je Person (0698).
        "guestCount": int(reservation.get("adults") or 0) + int(reservation.get("children") or 0),
        "paidAmount": float(ctx["paid_amount"]),
        # Dokumentsprache fürs Erstellformular/PDF (Gastsprache, doc_i18n).
        "guestLanguage": ctx["language"],
        # unitPrice ist NETTO (das Formular rechnet netto, priceInput='netto').
        "items": [
            {
                "description": p["description"],
                "quantity": float(p["quantity"]),
                "unit": p["unit"],
                "basis": p.get("basis") or "per_stay",
                "unitPrice": float(p["unit_price"]),
                "taxRate": float(p["tax_rate"]),
                # total = NETTO (quantity*unitPrice), wie es der PDF-Hook
                # (usePDFTemplateData: subtotal += quantity*unitPrice) und die
                # zentrale calc.ts erwarten. Zuvor stand hier gross_amount → die
                # Betragsspalte (ItemsTable rendert item.total) zeigte Brutto,
                # während die Zwischensumme netto rechnete: Zeilenbetrag ≠ Summe.
                "total": float(p["net_amount"]),
                # Aufenthalt der Zeile (0702) — der Editor zeigt Objekt und
                # Zeitraum direkt an der Übernachtungsposition.
                "propertyId": p.get("property_id"),
                "checkIn": p.get("check_in"),
                "checkOut": p.get("check_out"),
            }
            for p in ctx["positions"]
        ],
    }


def create_from_reservation(
    db: Client,
    tenant_id: str,
    reservation_id: str,
    *,
    payment_method: str = "invoice",
    card_brand: str | None = None,
) -> dict:
    """Finale Rechnung zur Buchung erzeugen (idempotent).

    Zahlart aus der Check-out-Abfrage: cash/card = am Empfang bezahlt →
    Rechnung sofort 'paid' (voller Betrag); invoice = Zahlung auf Rechnung
    (Überweisung) → 'finalized' mit Zahlungsziel.

    Rückgabe {id, invoice_number, already_existed}. Alle Validierungen und die
    Positionsberechnung laufen VOR dem ersten Write; existiert bereits eine
    aktive Rechnung, wird sie zurückgegeben (Check-out-Retry ist damit sicher).
    """
    existing = find_active_invoice(db, tenant_id, reservation_id)
    if existing and existing.get("invoice_number"):
        # Bereits FINALISIERT (nummeriert) → idempotent zurückgeben (Retry sicher).
        return {
            "id": existing["id"],
            "invoice_number": existing.get("invoice_number"),
            "already_existed": True,
        }
    if existing:
        # Es existiert ein ENTWURF zur Buchung (status='draft', keine Nummer). Der
        # belegt den invoices_reservation_active_uq-Slot (0092), sodass keine zweite
        # Rechnung angelegt werden kann — würde man ihn als „bereits vorhanden"
        # durchwinken (Altverhalten), entstünde beim Check-out NIE die verpflichtende
        # nummerierte GoBD-Rechnung. Deshalb den Entwurf JETZT finalisieren:
        # fortlaufende Nummer ziehen + Status setzen (kein zweiter Beleg, kein
        # Slot-Konflikt).
        return _finalize_reservation_draft(
            db, tenant_id, existing["id"], reservation_id,
            payment_method=payment_method, card_brand=card_brand,
        )

    ctx = _load_context(db, tenant_id, reservation_id)
    reservation = ctx["reservation"]
    profile = ctx["profile"]
    positions = ctx["positions"]
    customer = ensure_customer_for_guest(db, tenant_id, reservation)

    net_total = _q(sum((p["net_amount"] for p in positions), Decimal("0")))
    tax_total = _q(sum((p["tax_amount"] for p in positions), Decimal("0")))
    gross_total = _q(sum((p["gross_amount"] for p in positions), Decimal("0")))

    # GoBD-Nummer atomar ziehen (Row-Lock in next_document_number, 0025).
    num = (
        db.rpc(
            "next_document_number",
            {"p_tenant_id": tenant_id, "p_doc_type": "invoice", "p_prefix": "RE-"},
        ).execute()
    ).data or [{}]
    seq = num[0].get("sequential_number")
    invoice_number = num[0].get("formatted_number")
    if not invoice_number:
        raise BuchhaltungError(
            "Rechnungsnummer konnte nicht gezogen werden.", status_code=500
        )

    today = datetime.now(UTC).date()
    payment_days = int(profile.get("default_payment_days") or 14)
    # Bar/Karte = am Empfang beglichen → voller Betrag bezahlt; „auf Rechnung"
    # zählt nur bereits geleistete Zahlungen (Anzahlung, bezahlte Addons).
    paid_at_desk = payment_method in ("cash", "card")
    paid = gross_total if paid_at_desk else ctx["paid_amount"]
    fully_paid = paid_at_desk or Decimal("0") < gross_total <= paid

    check_in = str(reservation.get("check_in") or "")
    check_out = str(reservation.get("check_out") or "")
    try:
        nights = (date.fromisoformat(check_out) - date.fromisoformat(check_in)).days
    except ValueError:
        nights = 0
    language = ctx["language"]
    head_text = doc_i18n.head_text(
        language, check_in, check_out, nights, ctx["property_title"]
    )

    row = {
        "tenant_id": tenant_id,
        "customer_id": customer["id"],
        "reservation_id": reservation_id,
        "invoice_number": invoice_number,
        "invoice_sequence": seq,
        "invoice_year": today.year,
        "invoice_type": "invoice",
        # 'finalized' = finale Rechnung mit Nummer (gleicher Status wie der
        # manuelle Formular-Flow); voll bezahlte Buchungen direkt 'paid'.
        "status": "paid" if fully_paid else "finalized",
        "issue_date": today.isoformat(),
        "due_date": (today + timedelta(days=payment_days)).isoformat(),
        "currency": ctx["currency"],
        "net_amount": str(net_total),
        "tax_amount": str(tax_total),
        "gross_amount": str(gross_total),
        "paid_amount": str(min(paid, gross_total)),
        "tax_rule": "DE_TAXABLE",
        "is_kleinunternehmer": ctx["is_klein"],
        "head_text": head_text,
        # Dokumentsprache des Belegs (0099) — PDF/Versand-Dialog belegen damit
        # ihre Sprach-Auswahl vor.
        "language": language,
        # Zahlart aus der Check-out-Abfrage (0097); card_brand nur bei Karte.
        "payment_method": payment_method,
        "card_brand": card_brand if payment_method == "card" else None,
    }
    row = {k: v for k, v in row.items() if v is not None}
    if fully_paid:
        row["paid_at"] = datetime.now(UTC).isoformat()

    try:
        ins = db.table("invoices").insert(row).execute()
    except APIError as exc:
        # Race auf invoices_reservation_active_uq (paralleler Check-out):
        # die zuerst erzeugte Rechnung gewinnt. Die hier bereits gezogene
        # RE-Nummer bleibt ungenutzt — loggen, damit die Nummernkreis-Lücke
        # GoBD-erklärbar ist.
        existing = find_active_invoice(db, tenant_id, reservation_id)
        if existing:
            log.warning(
                "reservation_invoice_number_unused_after_race",
                reservation_id=reservation_id,
                unused_invoice_number=invoice_number,
                winning_invoice_id=existing["id"],
            )
            return {
                "id": existing["id"],
                "invoice_number": existing.get("invoice_number"),
                "already_existed": True,
            }
        raise BuchhaltungError(
            f"Rechnung konnte nicht gespeichert werden: {exc.message}",
            status_code=500,
        ) from exc
    if not ins.data:
        raise BuchhaltungError(
            "Rechnung konnte nicht gespeichert werden.", status_code=500
        )
    invoice_id = ins.data[0]["id"]

    line_rows = [
        {
            "invoice_id": invoice_id,
            "position": pos,
            "description": p["description"],
            "quantity": str(p["quantity"]),
            "unit": p["unit"],
            "basis": p.get("basis"),
            "property_id": p.get("property_id"),
            "check_in": p.get("check_in"),
            "check_out": p.get("check_out"),
            "unit_price": str(p["unit_price"]),
            "tax_rate": str(p["tax_rate"]),
            "discount_percent": "0",
            "net_amount": str(p["net_amount"]),
            "tax_amount": str(p["tax_amount"]),
            "gross_amount": str(p["gross_amount"]),
        }
        for pos, p in enumerate(positions, start=1)
    ]
    try:
        db.table("invoice_line_items").insert(line_rows).execute()
    except APIError as exc:
        # Kein halber Beleg: Rechnung ohne Positionen wieder entfernen. Die
        # dabei entstehende Nummernkreis-Lücke ist selten, geloggt und damit
        # GoBD-erklärbar (technischer Fehler, kein gelöschter Beleg).
        db.table("invoices").delete().eq("id", invoice_id).eq(
            "tenant_id", tenant_id
        ).execute()
        log.error(
            "reservation_invoice_lines_failed",
            reservation_id=reservation_id,
            invoice_number=invoice_number,
            error=str(exc),
        )
        raise BuchhaltungError(
            "Rechnungspositionen konnten nicht gespeichert werden — "
            "Rechnung wurde nicht erstellt.",
            status_code=500,
        ) from exc

    log.info(
        "reservation_invoice_created",
        reservation_id=reservation_id,
        invoice_id=invoice_id,
        invoice_number=invoice_number,
        gross=str(gross_total),
        status=row["status"],
    )
    return {"id": invoice_id, "invoice_number": invoice_number, "already_existed": False}
