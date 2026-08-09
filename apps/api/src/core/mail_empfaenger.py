"""Die Sprache eines Mail-Empfängers aus der Datenbank auflösen.

Trennung zu `mail_sprache`: dort steht die REGEL (Normalisierung, Kette,
Fallback) ohne jede DB-Kenntnis und damit ohne Testaufwand. Hier steht das
LESEN — welche Tabelle welche Spalte trägt. Wer eine neue Empfängerart
hinzufügt (Reisebüro, Dienstleister), ergänzt genau hier eine Funktion und
nicht die Regel.

Alle Zugriffe sind auf den Mandanten gescopt (Wurzel 3), wo die Tabelle eine
`tenant_id` trägt. `users` wird bewusst OHNE Tenant-Filter gelesen: der
Dispatcher löst den Empfänger schon über `users.id` auf und die aufrufenden
Ereignisse prüfen die Zugehörigkeit vorher (`ereignisse._gehoert_zum_tenant`) —
ein zweiter Filter hier würde eine Sprache verschweigen, wenn der Aufrufer die
tenant_id nicht kennt, und das Ergebnis wäre eine englische statt einer
richtigen Mail. Die Sprache ist zudem kein schützenswertes Datum: sie sagt
nichts über Umsatz, Gast oder Objekt.

Wurzel 5: Kein Lesefehler darf einen Mailversand kippen. Fällt die Abfrage aus,
gibt es `None` und der Aufrufer geht eine Stufe weiter in der Kette — eine Mail
in der Ausweichsprache ist immer besser als keine Mail.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import aufloesen, normalisieren

log = get_logger("nextdays.mail_sprache")


def _erste_spalte(
    db: Client, tabelle: str, spalte: str, zeilen_id: str,
    *, tenant_id: str | None = None,
) -> str | None:
    """Einen Sprachwert lesen — oder None, wenn es ihn nicht gibt.

    Best-effort (Wurzel 5): jeder Fehler ergibt None, damit die Kette
    weiterlaufen kann. Das ist hier ausdrücklich richtig und kein verschlucktes
    Kontroll-Signal — es gibt nichts zu steuern, nur eine Auskunft, die fehlen
    darf.
    """
    try:
        q = db.table(tabelle).select(spalte).eq("id", zeilen_id)
        if tenant_id is not None:
            q = q.eq("tenant_id", tenant_id)
        rows = q.limit(1).execute().data or []
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf den Versand nicht kippen
        log.warning(
            "mail_sprache_lesefehler",
            tabelle=tabelle, error=str(exc)[:200],
        )
        return None
    return normalisieren(rows[0].get(spalte)) if rows else None


def betriebs_sprache(db: Client, tenant_id: str | None) -> str | None:
    """Die Standardsprache des Betriebs (`tenants.default_language`, 0335).

    Zweite Stufe der Kette. Ohne `tenant_id` gibt es sie nicht — dann None.
    """
    if not tenant_id:
        return None
    return _erste_spalte(db, "tenants", "default_language", tenant_id)


def sprache_fuer_nutzer(
    db: Client, user_id: str, *, tenant_id: str | None = None
) -> str:
    """Sprache eines Login-Nutzers: eigene Wahl → Betrieb → Englisch.

    Das ist der Weg für ALLE Mails an Betriebs-Nutzer (Einladung, Reset,
    Benachrichtigungen). `users.preferred_language` ist dabei die Sprache, die
    der Nutzer im Konto selbst gewählt hat — die stärkste verfügbare Auskunft.
    """
    eigen = _erste_spalte(db, "users", "preferred_language", user_id)
    return aufloesen(eigen, betriebs_sprache(db, tenant_id))


def sprache_fuer_eigentuemer(
    db: Client, owner_id: str, tenant_id: str
) -> str:
    """Sprache einer Eigentümer-Partei: `owners.language` → Betrieb → Englisch.

    Getrennt von `sprache_fuer_nutzer`, weil ein Eigentümer NICHT zwingend
    einen Login hat: die Abrechnungspartei (`owners`) und der Portal-Login
    (`users`) sind zwei Wege, die auseinanderlaufen dürfen. Wer beides hat,
    wird über seinen Login angeschrieben und damit über die andere Funktion.

    NOCH OHNE AUFRUFER — und das ist kein vergessener Rest, sondern der Stand
    des Systems: es gibt derzeit KEINEN Versandweg an die Eigentümer-PARTEI.
    Jede Eigentümer-Meldung läuft heute über den Dispatcher und damit über
    `users.id` (also nur an Eigentümer MIT Login, Sprache aus
    `sprache_fuer_nutzer`). `owners.email` wird von keinem Mailpfad gelesen.
    Diese Funktion ist die fertige Sprachauskunft für den Tag, an dem der
    Abrechnungsversand (owner_statements) dazukommt — sie hier vorzuhalten
    kostet nichts und verhindert, dass der neue Pfad die Kette neu erfindet.
    Wer diesen Versand baut, ruft sie auf; bis dahin bleibt sie ungenutzt.
    """
    eigen = _erste_spalte(
        db, "owners", "language", owner_id, tenant_id=tenant_id
    )
    return aufloesen(eigen, betriebs_sprache(db, tenant_id))


def sprache_fuer_gast(
    db: Client, *, guest_language: object = None, tenant_id: str | None = None
) -> str:
    """Sprache eines GASTES (myBestDays): Buchungssprache → Betrieb → Englisch.

    Die Gastsprache steht bereits an der Buchung (`reservations.guest_language`,
    aus der OTA-Payload `customer.language`) und wird deshalb hereingereicht
    statt hier nachgeladen — der Aufrufer hat die Reservierungszeile ohnehin in
    der Hand, und ein zweiter Roundtrip je Gast wäre in einer Schleife über
    fällige Erinnerungen teuer.
    """
    return aufloesen(guest_language, betriebs_sprache(db, tenant_id))
