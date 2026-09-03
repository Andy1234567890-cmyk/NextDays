"""Die Bestaende der Eigentuemer-Vorgaenge — Zahl fuer die Startseite.

WARUM EIN EIGENES MODUL: `sperrantraege.py` fuehrt den Zustandsautomaten
(genehmigen, ablehnen, zuruecknehmen, Aufhebung) und war mit 1531 Zeilen ueber
der Grenze. Diese Datei beantwortet eine ANDERE Frage: nicht „was passiert bei
einer Entscheidung", sondern „wie viele Entscheidungen liegen an". Dieselbe
Trennung wie bei `sperrantrag_meldung.py`.

WARUM DIE ZAHL GEBRAUCHT WIRD: Der Workflow war vollstaendig gebaut und hatte
seine Seite unter /kalender/sperrantraege — die Startseite zeigte davon nichts.
Wer nicht wusste, dass dort etwas liegt, sah es nie; der Eigentuemer wartete auf
eine Antwort. Eine Benachrichtigung ist ein Ereignis, das vorbeizieht; ein
Bestand gehoert auf die Startseite.
"""
from __future__ import annotations

from datetime import datetime

from src.core.security import AuthContext

from .schemas import EigentuemerVorgaenge


class VorgaengeMixin:
    """Zaehlt die Eigentuemer-Vorgaenge eines Mandanten."""

    def vorgaenge(self, ctx: AuthContext) -> EigentuemerVorgaenge:
        """Die drei Bestaende der Eigentuemer-Vorgaenge — fuer die Startseite.

        Bewusst KEIN Aufruf von `liste()`: dort haengen Objekttitel, Namen und
        bestellte Leistungen dran (drei weitere Abfragen), nur um am Ende drei
        Zahlen anzuzeigen. Hier wird ausschliesslich gezaehlt.

        Derselbe Sichtbarkeits-Filter wie `liste()`: Antraege, die noch in der
        Familien-Freigabe stehen (`owner_freigabe='offen'`), existieren fuer
        die Agentur nicht — sie darf sie nicht zaehlen und koennte sie ohnehin
        nicht entscheiden (0389).
        """
        tenant_id = self._tenant(ctx)
        rows = (
            self._db.table("block_requests")
            .select("status, aufhebung, created_at, als_kuendigung_gewertet,"
                    " ist_kuendigung, vertragsende_gesetzt_auf")
            .eq("tenant_id", tenant_id)
            .in_("owner_freigabe", ["nicht_noetig", "freigegeben"])
            .execute()
        ).data or []
        offen = [r for r in rows if r.get("status") == "pending"]
        # Aufhebungswunsch NUR an genehmigten Sperren: an einem abgelehnten
        # Antrag ist nichts freizugeben, der Wunsch ist dort gegenstandslos.
        aufhebung = [
            r for r in rows
            if r.get("aufhebung") == "beantragt" and r.get("status") == "approved"
        ]
        # Angekuendigtes Vertragsende (0377): nur genehmigte Kuendigungen mit
        # gesetztem Datum. Ein Antrag, der als Kuendigung GESTELLT wurde, aber
        # abgelehnt ist, beendet keinen Vertrag.
        kuendigungen = [
            r for r in rows
            if r.get("status") == "approved" and r.get("vertragsende_gesetzt_auf")
        ]
        aeltester = min(
            (ts for ts in (_zeitstempel(r.get("created_at")) for r in offen) if ts),
            default=None,
        )
        return EigentuemerVorgaenge(
            offen=len(offen),
            aufhebung_offen=len(aufhebung),
            kuendigungen=len(kuendigungen),
            aeltester_offen_am=aeltester,
        )


def _zeitstempel(wert: object) -> datetime | None:
    """ISO-Text aus PostgREST zu `datetime`; unlesbar → `None`.

    Kein Ersatzwert: ein erfundenes „jetzt" liesse den aeltesten offenen
    Antrag jung aussehen und genau die Dringlichkeit verschwinden, die die
    Zahl transportieren soll (Wurzel 4).
    """
    if isinstance(wert, datetime):
        return wert
    if not isinstance(wert, str) or not wert:
        return None
    try:
        return datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return None
