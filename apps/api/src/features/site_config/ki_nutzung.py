"""Zählung und Tagesdeckel der KI-Aufrufe je Betrieb (0465).

Zwei Dinge, die oft verwechselt werden, hier getrennt:

* **Der Rate-Limit-Eimer** (``rate_limit_website_ki``, 10/60) sitzt in der
  Middleware, keyt pro IP und schützt gegen die außer Kontrolle geratene
  Schleife. Er weiß nichts über Betriebe.
* **Der Tagesdeckel** (``ki_tageslimit_je_tenant``) sitzt hier, keyt pro
  BETRIEB und schützt gegen die Rechnung. Er ist zugleich die Zählung, auf der
  ein späteres Guthabensystem aufsetzen kann.

Beide melden LAUT, wenn sie greifen. Ein still gekürztes Ergebnis wäre die
schlimmere Variante: der Betrieb sähe einen halben Text und hielte ihn für den
ganzen (Wurzel 5).

Kein Guthabensystem in dieser Runde. Was hier steht, ist die Buchführung dafür
— sie ab dem ersten Aufruf zu führen kostet nichts und ist der einzige Weg,
später ein Kontingent zu bemessen, das zum tatsächlichen Verbrauch passt.
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from src.core.config import get_settings
from src.core.ki import KiAntwort, KiError
from src.core.logging import get_logger

log = get_logger("nextdays.site_config.ki_nutzung")

# Die Funktionsnamen. Dieselben Zeichenketten wie im check-Constraint der
# Tabelle (0465) — hier als Konstante, damit ein Tippfehler beim Aufrufer
# nicht erst in der Datenbank auffällt.
FUNKTIONEN = frozenset(
    {
        "umschreiben",
        "seo",
        "alt_text",
        "abschnitt",
        "blogbeitrag",
        "profil_vorschlag",
        # Seitenfassungen (0476). MUSS hier UND im DB-Check stehen (0478).
        #
        # Fehlte der Name, buchte der Übersetzungslauf ins Leere: `_schreiben`
        # steigt bei unbekannter Funktion still aus, der Zähler bewegte sich
        # nicht, und `deckel_pruefen` prüfte 23-mal einen Stand, der nie stieg
        # — der Tagesdeckel wäre eine Attrappe gewesen, und die Antwort hätte
        # dem Betrieb „0 von 200 verbraucht" gemeldet, während 23 Aufrufe
        # bezahlt wurden.
        "seite_uebersetzen",
        # Antwortvorschlag an einen Gast (Posteingang + WhatsApp, 0492).
        # Derselbe Zwang wie eine Zeile darüber: hier UND im DB-Check.
        "gast_antwort",
        # Wissensdatenbank (0500). Getrennt, weil sie sich unterschiedlich
        # verhalten: der Import ist ein seltener, teurer Einzelaufruf (ein
        # ganzes PDF durch Gemini), das Lernen ein häufiger kleiner. In einem
        # Topf liesse sich später nicht sagen, welcher den Deckel gesprengt hat.
        "wissen_import",
        "wissen_lernen",
        # Bewertungs-Auswertung (0501). Getrennt aus demselben Grund wie
        # oben: 'bewertung_deuten' ist ein kleiner Aufruf je neuer Bewertung
        # und läuft im Tick, 'bewertung_bilanz' ein großer über sechzig Texte
        # auf Knopfdruck. In einem Topf liesse sich nicht sagen, welcher den
        # Deckel gesprengt hat.
        "bewertung_deuten",
        "bewertung_bilanz",
    }
)


def _heute() -> str:
    """Der Kalendertag in UTC als ISO-Datum.

    UTC und nicht die Zeitzone des Betriebs — dieselbe Wahl wie in der
    Migration, und aus demselben Grund: ein Deckel, der mit der Sommerzeit um
    eine Stunde springt, ist nicht erklärbar, und die Tests laufen in UTC.
    """
    return datetime.now(UTC).date().isoformat()


def verbrauch_heute(db: Client, tenant_id: str) -> int:
    """Wie viele ERFOLGREICHE Aufrufe dieser Betrieb heute gemacht hat.

    Fehlgeschlagene zählen nicht mit: ein Netzwerkfehler ist nicht das
    Verschulden des Betriebs und kostet auch nichts. Sie stehen in derselben
    Tabelle und sind über ``site_ai_usage_fehler_idx`` auffindbar.
    """
    antwort = (
        db.table("site_ai_usage")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .eq("tag", _heute())
        .eq("erfolg", True)
        .limit(1)
        .execute()
    )
    return int(antwort.count or 0)


def tageslimit() -> int:
    return int(get_settings().ki_tageslimit_je_tenant)


def deckel_pruefen(db: Client, tenant_id: str) -> int:
    """VOR dem Aufruf prüfen. Gibt den aktuellen Stand zurück oder wirft 429.

    Vorher und nicht nachher: der Deckel soll den bezahlten Aufruf verhindern,
    nicht ihn nachträglich beklagen.

    Die Meldung nennt Zählerstand und Grenze. „Limit erreicht“ ohne Zahlen ist
    eine Sackgasse — der Betrieb weiß dann weder, wie viel er verbraucht hat,
    noch wann es weitergeht.
    """
    grenze = tageslimit()
    stand = verbrauch_heute(db, tenant_id)
    if stand >= grenze:
        log.warning(
            "ki_tagesdeckel_erreicht",
            tenant_id=tenant_id,
            stand=stand,
            grenze=grenze,
        )
        raise KiError(
            f"Das Tageslimit für KI-Texte ist erreicht ({stand} von {grenze} "
            "Aufrufen). Morgen geht es weiter.",
            status_code=429,
        )
    return stand


def buchen(
    db: Client,
    tenant_id: str,
    *,
    user_id: str | None,
    funktion: str,
    antwort: KiAntwort,
) -> None:
    """Einen ERFOLGREICHEN Aufruf protokollieren.

    Best-effort: schlägt das Protokollieren fehl, ist der Text trotzdem
    erzeugt und der Betrieb bekommt ihn. Ein verlorener Protokolleintrag ist
    ärgerlich, eine verworfene fertige Antwort wäre schlimmer — und der
    Aufrufer würde es erneut versuchen und ein zweites Mal bezahlen.

    Der Fehler wird aber LAUT geloggt: eine Zählung, die still Lücken bekommt,
    ist als Abrechnungsgrundlage wertlos, und niemand würde es merken.
    """
    _schreiben(
        db,
        tenant_id,
        user_id=user_id,
        funktion=funktion,
        modell=antwort.modell,
        region=antwort.region,
        tokens_ein=antwort.tokens_ein,
        tokens_aus=antwort.tokens_aus,
        dauer_ms=antwort.dauer_ms,
        erfolg=True,
        fehler_grund=None,
    )


def fehler_buchen(
    db: Client,
    tenant_id: str,
    *,
    user_id: str | None,
    funktion: str,
    modell: str,
    region: str,
    grund: str,
) -> None:
    """Einen FEHLGESCHLAGENEN Aufruf protokollieren.

    ``grund`` ist unsere eigene, kurze Fehlermeldung — nicht die Rohantwort des
    Anbieters. Die könnte Teile des Prompts zurückspiegeln, und im Prompt
    stehen Kundendaten.
    """
    _schreiben(
        db,
        tenant_id,
        user_id=user_id,
        funktion=funktion,
        modell=modell,
        region=region,
        tokens_ein=0,
        tokens_aus=0,
        dauer_ms=0,
        erfolg=False,
        fehler_grund=grund[:500],
    )


def _schreiben(
    db: Client,
    tenant_id: str,
    *,
    user_id: str | None,
    funktion: str,
    modell: str,
    region: str,
    tokens_ein: int,
    tokens_aus: int,
    dauer_ms: int,
    erfolg: bool,
    fehler_grund: str | None,
) -> None:
    if funktion not in FUNKTIONEN:
        # Nicht schweigend durchlassen: der check-Constraint würde den Insert
        # ohnehin ablehnen, aber dann steht ein 23514 im Log statt der Aussage,
        # dass jemand einen Funktionsnamen erfunden hat.
        log.error("ki_nutzung_unbekannte_funktion", funktion=funktion)
        return
    try:
        db.table("site_ai_usage").insert(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "funktion": funktion,
                "modell": modell,
                "region": region,
                "tokens_ein": tokens_ein,
                "tokens_aus": tokens_aus,
                "dauer_ms": dauer_ms,
                "erfolg": erfolg,
                "fehler_grund": fehler_grund,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001 — best effort, siehe Docstring
        log.error(
            "ki_nutzung_nicht_gebucht",
            tenant_id=tenant_id,
            funktion=funktion,
            grund=type(exc).__name__,
            fehler=str(exc)[:300],
        )
