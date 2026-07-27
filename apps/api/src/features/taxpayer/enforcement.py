"""Durchsetzung der Steuer-Mitwirkungspflicht (§ 23 PStTG / DAC7).

Die Kaskade je (Betrieb, Land), gesetzlich vorgegeben:

    Aufforderung  →  Erinnerung 1  →  Erinnerung 2  →  Einbehalt
                                                       ↑
                     frühestens Tag 60, spätestens Tag 180

Gewählte Massnahme ist der EINBEHALT der Auszahlungen (§ 23 Satz 2 Nr. 2) —
das Airbnb-Modell. Booking waehlt stattdessen die Objektsperre (Nr. 1). Der
Einbehalt ist milder: er trifft nur den saeumigen Betrieb, keine gebuchten
Gaeste und nicht den Kanal-Sync.

Zwei Dinge sind gesetzlich NICHT verhandelbar und darum hier hart kodiert:

1. Die Aufhebung. § 23 Satz 3: „Die Massnahmen […] sind aufzuheben, sobald der
   Anbieter die ersuchten Informationen vorgelegt hat." Kein Ermessen — darum
   loest `pruefe_und_aktualisiere` den Halt automatisch, sobald die Angaben da
   sind (Wurzel 1: der Gegenzustand wird mitgepflegt).

2. Keine Bagatellgrenze. Die Grenze „unter 30 Faelle UND unter 2.000 EUR"
   (§ 4 Abs. 5 Nr. 4) verweist auf § 5 Abs. 1 Satz 1 NUMMER 3 = Warenverkauf.
   Vermietung ist NUMMER 1 → meldepflichtig ab der ersten Buchung.

Das Unterlassen der Massnahme ist selbst bussgeldbewehrt (§ 25 Abs. 1 Nr. 6
PStTG, bis 30.000 EUR) — dieser Pfad darf also nicht still fehlschlagen.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from supabase import Client

from src.core.logging import get_logger
from src.core.security import AuthContext

from .service import TaxpayerService

log = get_logger("nextdays.taxpayer.enforcement")

# § 23 Satz 2: „spaetestens nach 180 Tagen, nicht aber vor Ablauf von 60 Tagen".
FRIST_MINDESTENS_TAGE = 60
FRIST_SPAETESTENS_TAGE = 180

# Die zwei Erinnerungen liegen dazwischen. Das Gesetz nennt keine Abstaende;
# gewaehlt sind Tag 20 und Tag 45, damit beide deutlich VOR Tag 60 liegen —
# sonst waere die Massnahme faellig, bevor die zweite Erinnerung raus ist.
ERINNERUNG_1_TAGE = 20
ERINNERUNG_2_TAGE = 45


@dataclass(slots=True)
class Massnahme:
    """Was ein Lauf je Betrieb bewirkt hat — fuer Protokoll und Tests."""

    aufgefordert: list[str] = field(default_factory=list)
    erinnert: list[str] = field(default_factory=list)
    eingehalten: list[str] = field(default_factory=list)
    aufgehoben: list[str] = field(default_factory=list)


class TaxpayerEnforcement:
    def __init__(
        self, db: Client, *, taxpayer: TaxpayerService | None = None
    ) -> None:
        self._db = db
        self._taxpayer = taxpayer or TaxpayerService(db)

    # -- Der Lauf -----------------------------------------------------------

    def pruefe_und_aktualisiere(
        self, tenant_id: str, *, jetzt: datetime | None = None
    ) -> Massnahme:
        """Kaskade fuer einen Betrieb fortschreiben.

        Idempotent (Wurzel 2): mehrfach am Tag aufgerufen passiert nichts
        Zusaetzliches — jede Stufe prueft, ob sie schon gesetzt ist.
        """
        jetzt = jetzt or datetime.now(UTC)
        ctx = AuthContext(user_id="system", tenant_id=tenant_id, role="admin")
        fehlend = set(self._taxpayer.overview(ctx).fehlende_laender)
        offen = self._offene_vorgaenge(tenant_id)
        ergebnis = Massnahme()

        # 1. Aufhebung zuerst — § 23 Satz 3 ist Pflicht, nicht Ermessen.
        #    Bewusst VOR dem Anlegen: ein Land, das nicht mehr fehlt, darf im
        #    selben Lauf nicht erneut angemahnt werden.
        for land, vorgang in offen.items():
            if land not in fehlend:
                self._hebe_auf(vorgang, jetzt)
                ergebnis.aufgehoben.append(land)

        # 2. Neue Aufforderungen fuer Laender ohne laufenden Vorgang.
        for land in sorted(fehlend - offen.keys()):
            self._fordere_auf(tenant_id, land, jetzt)
            ergebnis.aufgefordert.append(land)

        # 3. Laufende Vorgaenge fortschreiben.
        for land, vorgang in offen.items():
            if land not in fehlend:
                continue
            stufe = self._naechste_stufe(vorgang, jetzt)
            if stufe == "erinnerung_1":
                self._setze(vorgang["id"], {"reminder_1_at": jetzt.isoformat()})
                ergebnis.erinnert.append(land)
            elif stufe == "erinnerung_2":
                self._setze(vorgang["id"], {"reminder_2_at": jetzt.isoformat()})
                ergebnis.erinnert.append(land)
            elif stufe == "einbehalt":
                self._setze(vorgang["id"], {"enforced_at": jetzt.isoformat()})
                ergebnis.eingehalten.append(land)

        if any(
            (ergebnis.aufgefordert, ergebnis.erinnert,
             ergebnis.eingehalten, ergebnis.aufgehoben)
        ):
            log.info(
                "taxpayer_enforcement_lauf",
                tenant_id=tenant_id,
                aufgefordert=ergebnis.aufgefordert,
                erinnert=ergebnis.erinnert,
                eingehalten=ergebnis.eingehalten,
                aufgehoben=ergebnis.aufgehoben,
            )
        return ergebnis

    def zahlungen_einbehalten(self, tenant_id: str) -> bool:
        """Darf der Auszahlungslauf fuer diesen Betrieb Geld bewegen?

        Die EINE Frage, die payouts stellt. True = einbehalten (§ 23 Satz 2
        Nr. 2). Wird beim Vorlegen der Angaben automatisch wieder False.
        """
        rows = (
            self._db.table("taxpayer_enforcement")
            .select("id")
            .eq("tenant_id", tenant_id)
            .is_("resolved_at", "null")
            .not_.is_("enforced_at", "null")
            .limit(1)
            .execute()
        ).data or []
        return bool(rows)

    # -- Stufenlogik --------------------------------------------------------

    @staticmethod
    def _naechste_stufe(vorgang: dict, jetzt: datetime) -> str | None:
        """Welche Stufe ist jetzt faellig? None = nichts zu tun.

        Die Reihenfolge ist zwingend: ohne zweite Erinnerung kein Einbehalt,
        auch wenn die 60 Tage laengst um sind (§ 23 Satz 2 setzt beides voraus).
        """
        start = datetime.fromisoformat(vorgang["requested_at"])
        alter = (jetzt - start).days

        if not vorgang.get("reminder_1_at"):
            return "erinnerung_1" if alter >= ERINNERUNG_1_TAGE else None
        if not vorgang.get("reminder_2_at"):
            return "erinnerung_2" if alter >= ERINNERUNG_2_TAGE else None
        if not vorgang.get("enforced_at"):
            return "einbehalt" if alter >= FRIST_MINDESTENS_TAGE else None
        return None

    def ueberfaellig(self, tenant_id: str, *, jetzt: datetime | None = None) -> list[str]:
        """Vorgaenge, bei denen die 180-Tage-Obergrenze verstrichen ist, ohne
        dass eingehalten wurde. Das waere ein Gesetzesverstoss (§ 25 Abs. 1
        Nr. 6) — der Betrieb muss das sehen koennen, nicht still bleiben."""
        jetzt = jetzt or datetime.now(UTC)
        grenze = jetzt - timedelta(days=FRIST_SPAETESTENS_TAGE)
        return sorted(
            land
            for land, v in self._offene_vorgaenge(tenant_id).items()
            if not v.get("enforced_at")
            and datetime.fromisoformat(v["requested_at"]) < grenze
        )

    # -- DB-Zugriff ---------------------------------------------------------

    def _offene_vorgaenge(self, tenant_id: str) -> dict[str, dict]:
        rows = (
            self._db.table("taxpayer_enforcement")
            .select(
                "id, country, requested_at, reminder_1_at, reminder_2_at, "
                "enforced_at"
            )
            .eq("tenant_id", tenant_id)
            .is_("resolved_at", "null")
            .execute()
        ).data or []
        return {r["country"]: r for r in rows}

    def _fordere_auf(self, tenant_id: str, land: str, jetzt: datetime) -> None:
        """Vorgang anlegen. Upsert statt insert: ein frueher abgeschlossener
        Vorgang fuer dasselbe Land wird neu gestartet, statt am UNIQUE-Index
        zu scheitern (Wurzel 2)."""
        self._db.table("taxpayer_enforcement").upsert(
            {
                "tenant_id": tenant_id,
                "country": land,
                "requested_at": jetzt.isoformat(),
                "reminder_1_at": None,
                "reminder_2_at": None,
                "enforced_at": None,
                "resolved_at": None,
                "updated_at": jetzt.isoformat(),
            },
            on_conflict="tenant_id,country",
        ).execute()

    def _hebe_auf(self, vorgang: dict, jetzt: datetime) -> None:
        self._setze(vorgang["id"], {"resolved_at": jetzt.isoformat()})

    def _setze(self, vorgang_id: str, felder: dict) -> None:
        self._db.table("taxpayer_enforcement").update(
            {**felder, "updated_at": datetime.now(UTC).isoformat()}
        ).eq("id", vorgang_id).execute()
