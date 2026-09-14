"""Modul-Freischaltung je Betrieb (`tenants.enabled_modules`, 0572).

WOFUER: Bereiche, die gebaut, aber noch nicht reif fuer zahlende Betriebe sind.
Anlass am 06.09.2026 (Betreiber): „Personal" und „Website-Baukasten" sollen
vorerst nur AirSmil sehen, kein neuer Kunde.

WARUM EIN EIGENER RIEGEL UND NICHT NUR DIE SIDEBAR: ein ausgeblendeter
Menuepunkt ist keine Sperre. Wer die Adresse kennt oder ein altes Lesezeichen
hat, landet trotzdem auf der Seite, und die API liefert die Daten. Genau dieser
Fall steht in `demo_gate` schon dokumentiert („das Menue zeigte gesperrt, ein
Aufruf per URL lieferte die Daten trotzdem") — er wird hier nicht wiederholt.

WARUM NICHT `is_internal` (0505): das kennzeichnet die drei Fotomodell-Konten
des Hauses. AirSmil ist keines davon, sondern der echte Beta-Betrieb — live
geprueft am 06.09.2026. Auf `is_internal` zu setzen haette die Bereiche bei
AirSmil ausgeblendet und in den Vorfuehrkonten gezeigt, also genau falsch herum.

FEHLERRICHTUNG wie in `demo_gate._ist_demo_mandant`: ein Lesefehler sperrt
NICHT. Fail-closed hiesse, dass eine einzelne stockende Abfrage dem Betrieb
seinen Bereich wegnimmt; das ist das groessere Uebel als ein Betrieb, der bei
einer Stoerung kurz ein unfertiges Modul sieht.
"""

import structlog
from fastapi import HTTPException, status

from src.core.supabase import get_service_client
from src.features.auth.dependencies import AuthContext

log = structlog.get_logger(__name__)

# Modul → Pfad-Praefixe, die es abdeckt. Praefixe statt Routenliste, aus dem
# Grund, den `demo_gate` nennt: ein Bereich waechst, eine Routenliste ist am Tag
# ihrer Erstellung veraltet.
MODUL_PRAEFIXE: dict[str, tuple[str, ...]] = {
    # `/personal`, NICHT `/hr`: `/hr` ist der Pfad im Browser, die API haengt
    # unter `/personal` (`features/personal/router.py`). Mit `/hr` haette dieser
    # Riegel nichts gesperrt und trotzdem gruen ausgesehen — geprueft am
    # 06.09.2026 gegen die Router-Praefixe, nicht aus dem Frontend abgeleitet.
    "personal": ("/personal",),
    "website_builder": ("/site-config",),
    # Buchhaltung (11.09.2026, Betreiber): „muss nur bei theresa.gruber frei
    # geschaltet sein bei niemandem sonst" — theresa.gruber ist der
    # Vorfuehrbetrieb (0630). Das Modul ist eine 1:1-Uebernahme aus Taskilo,
    # von der erst Rechnungsliste und Rechnung-erstellen portiert sind
    # (docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md); 13 Routen sind
    # ComingSoon. Kein zahlender Betrieb soll das sehen.
    "buchhaltung": ("/buchhaltung",),
    # DAC7 (14.09.2026, Betreiber): die Jahresmeldung ist ein Pay-Modul in
    # Entwicklung und stand bis dahin in KEINER der beiden Praefix-Listen —
    # jeder Admin mit `manage_billing` sah den Menuepunkt und erreichte die
    # Routen. `/taxpayer/dac7`, weil der Router dort haengt
    # (`features/taxpayer/dac7/router.py`), im Browser ist es `/dac7`.
    "dac7": ("/taxpayer/dac7",),
}

# Pfade UNTER einem gesperrten Praefix, die trotzdem fuer alle offen bleiben.
# Der `buchhaltung`-Slice traegt historisch die Firmen-/Rechnungsstammdaten
# (`companies/me`, Logo, USt-IdNr.-Pruefung), die /konto und das Onboarding
# JEDES Betriebs brauchen — sie gehoeren zum Konto, nicht zur Buchhaltung
# (siehe Docstring in `buchhaltung/router.py` zu `_profile_write`). Ohne diese
# Ausnahme haette der Riegel jedem Betrieb sein Konto zerlegt.
MODUL_AUSNAHMEN: dict[str, tuple[str, ...]] = {
    "buchhaltung": (
        "/buchhaltung/companies",
        "/buchhaltung/vat-check",
        "/buchhaltung/health",
    ),
}


def _pfad_modul(pfad: str) -> str | None:
    """Welches gesperrte Modul deckt diesen Pfad ab? `None` = keines.

    Vergleich auf Segmentgrenze (`/hr` trifft `/hr/lohn`, aber nicht `/hrx`).
    """
    rest = pfad.split("/api/v1", 1)[-1] if "/api/v1" in pfad else pfad

    def trifft(praefixe: tuple[str, ...]) -> bool:
        return any(rest == p or rest.startswith(p + "/") for p in praefixe)

    for modul, praefixe in MODUL_PRAEFIXE.items():
        if trifft(praefixe) and not trifft(MODUL_AUSNAHMEN.get(modul, ())):
            return modul
    return None


def freigeschaltete_module(tenant_id: str | None) -> set[str]:
    """`tenants.enabled_modules` als Menge; ein Lesefehler gibt ALLES frei."""
    if not tenant_id:
        return set()
    try:
        res = (
            get_service_client()
            .table("tenants")
            .select("enabled_modules")
            .eq("id", tenant_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001 — Stoerung darf Kunden nicht sperren
        log.warning(
            "modul_freischaltung_lesefehler",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )
        return set(MODUL_PRAEFIXE)
    rows = res.data or []
    return set(rows[0].get("enabled_modules") or []) if rows else set()


def modul_pruefen(ctx: AuthContext, pfad: str) -> None:
    """404, wenn der Betrieb das Modul hinter `pfad` nicht freigeschaltet hat.

    404 und nicht 403: ein Modul, das es fuer diesen Betrieb nicht gibt, soll
    sich auch so verhalten. Ein 403 verraet, dass da etwas ist, das andere
    haben — und provoziert genau die Nachfrage, die die Freischaltung vermeiden
    soll.
    """
    modul = _pfad_modul(pfad)
    if modul is None:
        return
    if modul in freigeschaltete_module(ctx.tenant_id):
        return
    log.info(
        "modul_nicht_freigeschaltet",
        tenant_id=ctx.tenant_id,
        modul=modul,
        pfad=pfad,
    )
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Dieser Bereich ist für diesen Betrieb nicht verfügbar.",
    )
