"""Der Takt der Bewertungs-KI — beide Richtungen, in die Warteschlange.

Was hier passiert: Für Bewertungen, die noch keine Antwort haben, und für
Gäste, die noch nicht bewertet sind, erzeugt die KI einen Text und legt ihn als
ENTWURF in ``guest_review_queue``. Der Versand ist derselbe wie bisher
(``ReviewQueue.send_due``) — diese Datei schickt nichts. Die entschiedene
Zustellart steht AM EINTRAG (``zustellart``, 0566): ``send_due`` nimmt nur
'automatisch', ein 'entwurf' wartet auf „Abschicken" durch einen Menschen.

**Warum die bestehende Warteschlange und keine zweite.** Sie kann bereits
alles, was hier gebraucht wird: Fälligkeit, Sichtbarkeit, Ändern,
Überspringen, Ablauf, Fehlerspur, Idempotenz über UNIQUE-Indizes. Eine zweite
Warteschlange mit derselben Mechanik wäre eine Kopie, die auseinanderläuft —
und der Betrieb hätte zwei Listen für dieselbe Frage („was geht demnächst in
meinem Namen raus?").

**Warum Entwürfe, auch bei 'automatisch'.** „Automatisch" heisst hier: der
Eintrag geht ohne weiteres Zutun zur Fälligkeit raus, nicht: er geht sofort
raus. Dazwischen liegt ``verzoegerung_minuten`` — das Fenster, in dem ein
Mensch den Text noch ändern oder überspringen kann. Bei einem Text, der
dauerhaft öffentlich unter einem Inserat steht, ist dieses Fenster der
eigentliche Schutz.

Der Katalog wird EINMAL je Betrieb geladen und durchgereicht: bei 50 Einträgen
wären das sonst 50 identische Abfragen für Daten, die sich während des Laufs
nicht ändern.
"""
from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.ki import KiError
from src.core.logging import get_logger
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .ki_katalog import NOTE_LOB
from .ki_store import KiStore
from .ki_text import (
    FUNKTIONEN,
    Bewertungslage,
    Textvorschlag,
    katalog_gepflegt,
    katalog_laden,
    kategorien_auf_fuenf,
    text_erzeugen,
)
from .schemas import KiRichtung, KiSettings, KiZustellart

log = get_logger("nextdays.reviews.ki_lauf")

# Obergrenze je Betrieb und Lauf. Der Tick soll nicht minutenlang laufen und
# nicht in einen Massenversand kippen; was übrig bleibt, kommt beim nächsten
# Lauf dran. Kleiner als der Warteschlangen-Batch (50), weil hier je Eintrag
# ein Vertex-Aufruf steht und nicht nur eine Zeile.
MAX_JE_LAUF = 15

# Wie viele KANDIDATEN ein Lauf sichtet, bevor er die schon erledigten
# aussiebt. Getrennt von MAX_JE_LAUF, und zwar absichtlich: bis 05.09.2026
# stand das Limit 15 direkt an der Kandidaten-Abfrage (neueste zuerst), und
# die Aussiebung kam DANACH. Sobald 15 neuere Bewertungen schon einen Entwurf
# hatten (oder ohne Text waren), belegten sie alle Plätze — die älteren, die
# der Frist am nächsten waren, kamen in keinem Lauf mehr an die Reihe. Live:
# vier Bewertungen vom 07.–09.08. standen fünf Läufe lang auf „wartet auf
# Lauf", während jeder Lauf nur 2–3 Texte schrieb. Das sah aus wie ein zu
# strenges Rate-Limit; es war eine Auswahl, die die Falschen zuerst nahm.
# Die 200 sind der harte Deckel gegen einen unbegrenzten Bereich (Wurzel 8),
# gemessen an der PostgREST-URL für das anschliessende `in_` (200 UUIDs).
_MAX_KANDIDATEN = 200

# Wie weit zurück Bewertungen beantwortet werden. Ohne Fenster würde ein frisch
# eingeschalteter Betrieb rückwirkend jede Altbewertung beantworten — eine
# Antwort auf eine zwei Jahre alte Bewertung wirkt wie ein Versehen, und bei
# 400 Bewertungen auf einen Schlag wie ein Bot.
_LOOKBACK_TAGE = 30

# Der Takt des Worker-Ticks, in dem dieser Lauf hängt. MUSS gleich
# `worker.REVIEWS_TICK_SECONDS` sein (ein Test hält beide deckungsgleich):
# die Diagnose rechnet daraus „nächster Lauf um …" — eine falsche Zahl hier
# wäre eine plausible Falschaussage in der Oberfläche (Wurzel 5b).
TAKT_SEKUNDEN = 60 * 60


class BewertungsKiLauf:
    """Erzeugt KI-Entwürfe für beide Richtungen (Worker/Cron, ohne AuthContext)."""

    def __init__(self, db: Client) -> None:
        self._db = db
        self._store = KiStore(db)

    # ----------------------------------------------------------------- Lauf
    def run(
        self, *, now: datetime | None = None, only_tenant: str | None = None
    ) -> tuple[int, int]:
        """Alle Betriebe mit eingeschalteter Bewertungs-KI abarbeiten.

        `only_tenant`: der von Hand angestossene Lauf (`POST /reviews/ki/lauf`)
        arbeitet NUR den eigenen Betrieb ab (Wurzel 3) — der Worker lässt es
        leer und nimmt alle.

        Rückgabe: (Antworten auf Gastbewertungen, Bewertungen über Gäste).
        """
        jetzt = now or datetime.now(UTC)
        q = self._db.table("review_ki_settings").select("*").eq("ki_aktiv", True)
        if only_tenant:
            q = q.eq("tenant_id", only_tenant)
        configs = q.execute().data or []

        antworten = 0
        bewertungen = 0
        for roh in configs:
            tenant_id = str(roh["tenant_id"])
            settings = KiSettings(**{k: v for k, v in roh.items() if k != "tenant_id"})
            katalog = katalog_laden(self._db, tenant_id)
            self._store.stand_setzen(tenant_id, "Lauf gestartet")
            if not katalog_gepflegt(katalog):
                # Ohne eine einzige Antwort schreibt das Modell das
                # statistische Mittel aller Gastgeber im Internet. Das ist
                # kein Text, den man ungelesen öffentlich stellt — also läuft
                # die KI gar nicht erst an (Wurzel 4). LAUT, nicht still: der
                # Betrieb hat den Schalter umgelegt und erwartet Wirkung.
                log.warning(
                    "review_ki_katalog_leer", tenant_id=tenant_id
                )
                self._store.stand_setzen(
                    tenant_id,
                    "Katalog leer — die KI schreibt nichts, bis eine Haltung hinterlegt ist",
                    lauf_abgeschlossen=True,
                )
                continue
            neu = self._antworten_erzeugen(tenant_id, settings, katalog, jetzt)
            antworten += neu
            # Ohne `jetzt`: Fälligkeit und Note dieser Einträge stammen aus
            # `ReviewQueue.fill` und bleiben unangetastet — hier wird nur der
            # fehlende Text nachgetragen (Wurzel 1).
            gast = self._gastbewertungen_erzeugen(tenant_id, settings, katalog)
            bewertungen += gast
            self._store.stand_setzen(
                tenant_id,
                f"Lauf beendet: {neu} Antwort-Entwürfe, {gast} Gastbewertungen",
                lauf_abgeschlossen=True,
            )
        if antworten or bewertungen:
            log.info(
                "review_ki_lauf",
                antworten=antworten,
                gastbewertungen=bewertungen,
            )
        return antworten, bewertungen

    # ------------------------------------- Richtung 1: Antwort auf Bewertung
    def _antworten_erzeugen(
        self,
        tenant_id: str,
        settings: KiSettings,
        katalog: dict[str, str],
        jetzt: datetime,
    ) -> int:
        """Öffentliche Antworten auf Bewertungen, die noch keine haben.

        Auch reine Sternevergaben (kein Text, nur Noten) bekommen seit dem
        05.09.2026 einen Entwurf — gestützt auf die Kategorienoten, die der
        Gast wirklich vergeben hat (``kategorien_auf_fuenf``). Vorher galten
        sie als „nichts zu beantworten"; der Betrieb beantwortete sie dann
        von Hand.

        Rückgabe: erzeugte Entwürfe.
        """
        offen = self._unbeantwortete_bewertungen(tenant_id, jetzt)
        gezaehlt = 0
        versuche = 0
        for bewertung in offen:
            if _frist_vorbei(bewertung.get("reply_expires_at"), jetzt):
                # Das Portal nimmt keine Antwort mehr an — ein Modellaufruf
                # dafür wäre bezahltes Nichts. Der Spiegel (`is_expired`)
                # hinkt hier: Channex meldet `is_expired=false` auch nach
                # verstrichenem `expired_at` (live 05.09.2026, Airbnb 25.07.).
                continue
            if versuche >= MAX_JE_LAUF:
                # Deckel zählt MODELLAUFRUFE, nicht Treffer: auch eine
                # abgelehnte Antwort hat Geld gekostet. Der Rest wartet auf
                # den nächsten Tick — sichtbar im Stand, nicht still.
                self._store.stand_setzen(
                    tenant_id,
                    f"Deckel {MAX_JE_LAUF} je Lauf erreicht — Rest im nächsten Lauf",
                )
                log.info(
                    "review_ki_lauf_deckel",
                    tenant_id=tenant_id,
                    max_je_lauf=MAX_JE_LAUF,
                    kandidaten=len(offen),
                )
                break
            versuche += 1
            if self._eine_antwort(tenant_id, settings, katalog, bewertung, jetzt):
                gezaehlt += 1
        return gezaehlt

    def _unbeantwortete_bewertungen(
        self, tenant_id: str, jetzt: datetime
    ) -> list[dict]:
        """Portal-Bewertungen ohne Antwort im Rückblickfenster.

        Nur ``channex_review``: die eigenen Marktplatz-Bewertungen
        (``reviews``) beantwortet der Betrieb über denselben Weg, sobald der
        Marktplatz eine öffentliche Antwort zeigt — heute tut er das nicht,
        und eine Antwort zu erzeugen, die nirgends erscheint, wäre eine
        Attrappe (Wurzel 4: lieber nichts als etwas Wirkungsloses).
        """
        seit = (jetzt - timedelta(days=_LOOKBACK_TAGE)).date().isoformat()
        zeilen = (
            self._db.table("channex_review")
            .select(
                "id, property_id, guest_name, ota, overall_score, content, "
                "scores, reply_expires_at, received_at, created_at, "
                "is_replied, is_expired"
            )
            .eq("tenant_id", tenant_id)
            .eq("is_replied", False)
            .eq("is_expired", False)
            .gte("received_at", seit)
            # Älteste zuerst: sie stehen der Antwortfrist am nächsten. Der
            # Lauf-Deckel sitzt NICHT hier, sondern beim Erzeugen (s.
            # _MAX_KANDIDATEN) — hier würde er die Falschen abschneiden.
            .order("received_at", desc=False)
            .limit(_MAX_KANDIDATEN)
            .execute()
        ).data or []
        return self._ohne_warteschlangen_eintrag(tenant_id, zeilen)

    def _ohne_warteschlangen_eintrag(
        self, tenant_id: str, zeilen: list[dict]
    ) -> list[dict]:
        """Bewertungen, für die noch kein Antwort-Entwurf existiert — egal in
        welchem Status. Ein übersprungener Entwurf darf NICHT wiederkommen.

        Zusätzlich zählt das PROTOKOLL: die KI schreibt je Bewertung höchstens
        einmal. Live 05.09.2026: ein Text bat um menschliche Prüfung
        („Bewertung auf Italienisch"), blieb ohne Warteschlangen-Eintrag, und
        eine Stunde später erzeugte der Tick ihn neu — diesmal ohne Bitte —
        und schickte ihn. Ein zweiter Versuch ist kein zweiter Blick, sondern
        Würfeln, bis das Modell keine Bedenken mehr hat."""
        if not zeilen:
            return []
        ids = [str(z["id"]) for z in zeilen]
        vorhanden = {
            str(x["antwort_auf_id"])
            for x in (
                self._db.table("guest_review_queue")
                .select("antwort_auf_id")
                .eq("tenant_id", tenant_id)
                .in_("antwort_auf_id", ids)
                .execute()
            ).data
            or []
            if x.get("antwort_auf_id")
        }
        vorhanden |= {
            str(x["bezug_id"])
            for x in (
                self._db.table("review_ki_protokoll")
                .select("bezug_id")
                .eq("tenant_id", tenant_id)
                .eq("richtung", KiRichtung.antwort.value)
                .in_("bezug_id", ids)
                .execute()
            ).data
            or []
            if x.get("bezug_id")
        }
        return [z for z in zeilen if str(z["id"]) not in vorhanden]

    def _eine_antwort(
        self,
        tenant_id: str,
        settings: KiSettings,
        katalog: dict[str, str],
        bewertung: dict,
        jetzt: datetime,
    ) -> bool:
        note = _note_auf_fuenf(bewertung.get("overall_score"))
        text = (bewertung.get("content") or "").strip()
        # Ohne Text UND ohne jede Note gäbe es nichts, worauf sich eine Antwort
        # stützen könnte — das Modell müsste den Inhalt erfinden (Wurzel 4).
        kategorien = kategorien_auf_fuenf(bewertung.get("scores"))
        if not text and note is None and not kategorien:
            return False
        vorschlag = self._erzeugen(
            tenant_id,
            settings,
            katalog,
            Bewertungslage(
                richtung=KiRichtung.antwort.value,
                note=note,
                gast_text=text or None,
                gast_name=bewertung.get("guest_name"),
                objekt_titel=self._titel(tenant_id, bewertung.get("property_id")),
                ota_name=bewertung.get("ota"),
                kategorien=kategorien,
            ),
            bezug_id=str(bewertung["id"]),
        )
        if vorschlag is None:
            return False
        self._store.stand_setzen(
            tenant_id, f"Antwort auf {bewertung.get('ota') or 'Portal'}-Bewertung entworfen"
        )
        zustellart, grund = self._store.zustellart_entscheiden(
            settings, KiRichtung.antwort.value, note, vorschlag.mensch_pruefen
        )
        if not vorschlag.text.strip():
            # Das Modell hat NUR die Bitte um Prüfung geliefert. Kein Eintrag
            # ohne Text — aber sichtbar im Protokoll, und der Bezug ist damit
            # abgehakt: kein neuer Versuch im nächsten Tick.
            self._store.protokollieren(
                tenant_id,
                richtung=KiRichtung.antwort.value,
                quelle="ota",
                bezug_id=str(bewertung["id"]),
                note=note,
                eingabe=text,
                ergebnis="",
                zustellart=KiZustellart.entwurf.value,
                gesendet=False,
                verwendete_fragen=vorschlag.verwendete_fragen,
                grund=grund or "Modell lieferte keinen Text — ein Mensch antwortet.",
                antwort=vorschlag.antwort,
            )
            self._store.stand_setzen(
                tenant_id, "KI bittet um menschliche Prüfung — kein Entwurf angelegt"
            )
            return False
        angelegt = self._in_warteschlange(
            tenant_id,
            {
                "source": "ota",
                "richtung": KiRichtung.antwort.value,
                "review_id": str(bewertung["id"]),
                "antwort_auf_id": str(bewertung["id"]),
                "property_id": bewertung.get("property_id"),
                "guest_name": bewertung.get("guest_name"),
                "rating": note or NOTE_LOB,
                "text": vorschlag.text,
                "ki_erzeugt": True,
                # Die Zustellart steht AM EINTRAG: der Versandlauf nimmt nur
                # 'automatisch'. Vorher stand sie nur in den Einstellungen,
                # und `send_due` schickte Entwürfe im selben Tick (0566).
                "zustellart": zustellart.value,
                "send_at": _faellig(jetzt, settings, zustellart.value),
                # Das Fenster des Portals kennen wir nicht sicher; `is_expired`
                # im Spiegel entscheidet beim Absenden. Kein geratenes Datum.
                "expires_at": None,
            },
        )
        if not angelegt:
            # Steht schon (UNIQUE) oder hat keinen Text: kein Protokoll für
            # etwas, das nirgends liegt — sonst zählt die Spur Texte, die es
            # in der Warteschlange nie gab.
            return False
        self._store.protokollieren(
            tenant_id,
            richtung=KiRichtung.antwort.value,
            quelle="ota",
            bezug_id=str(bewertung["id"]),
            note=note,
            eingabe=text,
            ergebnis=vorschlag.text,
            zustellart=zustellart.value,
            gesendet=False,
            verwendete_fragen=vorschlag.verwendete_fragen,
            grund=grund,
            antwort=vorschlag.antwort,
        )
        return True

    # ------------------------------------ Richtung 2: Wir bewerten den Gast
    def _gastbewertungen_erzeugen(
        self,
        tenant_id: str,
        settings: KiSettings,
        katalog: dict[str, str],
    ) -> int:
        """Bestehende Entwürfe OHNE Text mit einem KI-Text füllen.

        Bewusst kein zweiter Weg, der eigene Einträge anlegt: welche
        Reservierung überhaupt bewertet wird, entscheidet weiterhin
        ``ReviewQueue.fill`` — mit Vorlauf, Rückblickfenster, Notenschwelle und
        Frist. Diese Regeln ein zweites Mal zu schreiben hiesse, sie zweimal zu
        pflegen (Wurzel 1). Die KI liefert nur den Text, den die Vorlage nicht
        hatte.

        ``fill`` legt Einträge ohne Text gar nicht erst an. Diese Methode
        greift deshalb dort, wo ein Betrieb eine Vorlage OHNE Texte pflegt oder
        einen Entwurf geleert hat — und beim Nachziehen von Einträgen, deren
        Text der Betrieb entfernt hat, um ihn von der KI schreiben zu lassen.
        """
        offen = (
            self._db.table("guest_review_queue")
            .select("id, property_id, guest_name, rating, reservation_id, send_at")
            .eq("tenant_id", tenant_id)
            .eq("status", "geplant")
            .eq("richtung", KiRichtung.gast_bewerten.value)
            .or_("text.is.null,text.eq.")
            .limit(MAX_JE_LAUF)
            .execute()
        ).data or []
        gezaehlt = 0
        for eintrag in offen:
            note = _als_note(eintrag.get("rating"))
            vorschlag = self._erzeugen(
                tenant_id,
                settings,
                katalog,
                Bewertungslage(
                    richtung=KiRichtung.gast_bewerten.value,
                    note=note,
                    gast_name=eintrag.get("guest_name"),
                    objekt_titel=self._titel(tenant_id, eintrag.get("property_id")),
                ),
                bezug_id=str(eintrag.get("reservation_id") or eintrag["id"]),
            )
            if vorschlag is None:
                continue
            zustellart, grund = self._store.zustellart_entscheiden(
                settings,
                KiRichtung.gast_bewerten.value,
                note,
                vorschlag.mensch_pruefen,
            )
            # Nur den Text nachtragen — Fälligkeit und Note der Zeile bleiben,
            # sie stammen aus `fill` und dessen Regeln (Wurzel 1).
            # Mit der Zustellart der KI-Einstellung: ein Text, den die KI
            # geschrieben hat, geht bei 'entwurf' nicht von selbst raus, auch
            # wenn die Vorlagen-Automatik die Zeile als 'automatisch' anlegte.
            self._db.table("guest_review_queue").update(
                {
                    "text": vorschlag.text,
                    "ki_erzeugt": True,
                    "zustellart": zustellart.value,
                }
            ).eq("id", eintrag["id"]).eq("tenant_id", tenant_id).eq(
                "status", "geplant"
            ).execute()
            self._store.protokollieren(
                tenant_id,
                richtung=KiRichtung.gast_bewerten.value,
                quelle="marketplace",
                bezug_id=str(eintrag.get("reservation_id") or eintrag["id"]),
                note=note,
                eingabe="",
                ergebnis=vorschlag.text,
                zustellart=zustellart.value,
                gesendet=False,
                verwendete_fragen=vorschlag.verwendete_fragen,
                grund=grund,
                antwort=vorschlag.antwort,
            )
            gezaehlt += 1
        return gezaehlt

    # --------------------------------------------------------------- Hilfen
    def _erzeugen(  # noqa: PLR0913 — ein Lauf, alles durchgereicht
        self,
        tenant_id: str,
        settings: KiSettings,
        katalog: dict[str, str],
        lage: Bewertungslage,
        bezug_id: str | None = None,
    ) -> Textvorschlag | None:
        """Einen Text erzeugen und die Nutzung buchen.

        Ein KI-Fehler beendet den Lauf für DIESEN Eintrag, nicht für den
        ganzen Betrieb: ein abgelaufenes Token oder ein erschöpfter Tagesdeckel
        soll nicht dazu führen, dass die restlichen Bewertungen still
        übersprungen werden und niemand erfährt warum (Wurzel 5).
        """
        try:
            deckel_pruefen(self._db, tenant_id)
            vorschlag = text_erzeugen(
                self._db,
                tenant_id,
                lage=lage,
                einstellungen=settings.model_dump(),
                katalog=katalog,
            )
        except KiError as exc:
            log.warning(
                "review_ki_text_fehlgeschlagen",
                tenant_id=tenant_id,
                richtung=lage.richtung,
                status=exc.status_code,
                fehler=exc.message[:200],
            )
            # In die Spur, nicht nur ins Server-Log: der Betrieb sieht im
            # Protokoll „KI-Fehler (429): Tageslimit erreicht" statt nichts.
            self._store.protokollieren(
                tenant_id,
                richtung=lage.richtung,
                quelle="ota" if lage.ota_name else "marketplace",
                bezug_id=bezug_id,
                note=lage.note,
                eingabe=lage.gast_text or "",
                ergebnis="",
                zustellart=KiZustellart.entwurf.value,
                gesendet=False,
                verwendete_fragen=[],
                grund=f"KI-Fehler ({exc.status_code}): {exc.message}",
            )
            self._store.stand_setzen(tenant_id, f"KI-Fehler ({exc.status_code})")
            return None
        buchen(
            self._db,
            tenant_id,
            user_id=None,
            funktion=FUNKTIONEN[lage.richtung],
            antwort=vorschlag.antwort,
        )
        return vorschlag

    def _in_warteschlange(self, tenant_id: str, eintrag: dict) -> bool:
        """Einen Entwurf anlegen. Der UNIQUE-Index entscheidet, nicht ein
        Vorab-SELECT (das wäre ein Race, Wurzel 2) — zwei öffentliche Antworten
        unter derselben Bewertung lassen sich bei keinem Portal einsammeln."""
        if not (eintrag.get("text") or "").strip():
            return False
        try:
            self._db.table("guest_review_queue").insert(
                {"tenant_id": tenant_id, **eintrag}
            ).execute()
        except APIError as exc:
            if exc.code == "23505":
                return False
            raise
        return True

    def _titel(self, tenant_id: str, property_id: object) -> str | None:
        """Objekttitel, tenant-gescopt geladen (Wurzel 3)."""
        if not property_id:
            return None
        zeilen = (
            self._db.table("properties")
            .select("title")
            .eq("tenant_id", tenant_id)
            .eq("id", str(property_id))
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0].get("title") if zeilen else None


def _faellig(jetzt: datetime, settings: KiSettings, zustellart: str) -> str:
    """Wann der Entwurf fällig wird.

    Bei 'entwurf' bleibt er liegen, bis ein Mensch ihn abschickt — die
    Fälligkeit liegt dann bewusst weit vorn (jetzt), damit er in der Liste
    oben steht und nicht in der Zukunft versteckt ist. Bei 'automatisch' zählt
    die Verzögerung: das Fenster, in dem noch jemand eingreifen kann.
    """
    if zustellart != "automatisch":
        return jetzt.isoformat()
    return (jetzt + timedelta(minutes=settings.verzoegerung_minuten)).isoformat()


def _frist_vorbei(roh: object, jetzt: datetime) -> bool:
    """Antwortfrist des Portals (``reply_expires_at``, 0567) verstrichen?
    Unbekannte Frist = nicht vorbei (kein geratener Wert, Wurzel 4)."""
    if not isinstance(roh, str) or not roh.strip():
        return False
    try:
        frist = datetime.fromisoformat(roh.replace("Z", "+00:00"))
    except ValueError:
        return False
    if frist.tzinfo is None:
        frist = frist.replace(tzinfo=UTC)
    return frist < jetzt


def _note_auf_fuenf(roh: object) -> int | None:
    """Portal-Note auf die 1..5-Skala bringen.

    ``channex_review.overall_score`` ist für JEDES Portal 0..10 (0262: Channex
    normalisiert auch Airbnb darauf; live 05.09.2026: Airbnb 6..10, Booking
    7..10). Dieselbe Rechnung wie ``_score_5_from_ten`` in der Liste — vorher
    galt hier „≤ 5 ist schon die Sternskala", und eine 4/10 (zwei Sterne)
    wurde als Vier-Sterne-Lob beantwortet, an der Schwelle vorbei. Kein
    geratener Wert bei fehlender Note (Wurzel 4): dann gibt es keine, und der
    Prompt sagt das auch.
    """
    if roh is None:
        return None
    try:
        wert = float(roh)
    except (TypeError, ValueError):
        return None
    if wert <= 0:
        return None
    # Kaufmännisch runden (2,5 → 3), nicht Pythons Banker-Rundung (2,5 → 2).
    return max(1, min(5, math.floor(wert / 2 + 0.5)))


def _als_note(roh: object) -> int | None:
    try:
        return max(1, min(5, int(roh)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
