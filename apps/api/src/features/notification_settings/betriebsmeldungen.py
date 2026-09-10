"""Betriebsmeldungen: Stoerungen und Fristen, die die LEITUNG erfaehrt.

ABGRENZUNG ZU `ereignisse.py` (Modul-Split 09.09.2026): Dort stehen die
Meldungen zu einem fachlichen VORGANG — eine Buchung, eine Aufgabe, eine
Gastnachricht. Hier stehen die Meldungen, die den BETRIEB SELBST betreffen:
etwas ist gescheitert (Sync, Zustellung), etwas braucht einen Menschen
(KI-Eskalation, verwaiste Portal-Rate) oder eine Frist laeuft ab (Testphase).
Alle Empfaenger hier sind die Betriebsleitung, nie ein Eigentuemer und nie
eine Rolle ohne Vertriebs-/Finanzeinblick (Wurzel 9, §4.3).

WARUM GETRENNT: `ereignisse.py` war mit 1507 Zeilen ueber die Grenze
gewachsen, die `pylint` fuer ein Modul zieht (1500). Die Alternativen waeren
gewesen, die WARUM-Belege zu entkernen (die dieses Repo als Konvention pflegt
und die bei jeder kuenftigen Aenderung erklaeren, warum eine Meldung einmalig
ist und die andere nicht) oder die Grenze per `disable` zu uebergehen — beides
haette das Symptom behandelt statt die Ursache: das Modul trug zwei
verschiedene Zustaendigkeiten.

WAS HIER NICHT LIEGT: `_betriebsleitung` (der Empfaenger-Resolver) bleibt in
`ereignisse.py`, weil neun Aufrufstellen in BEIDEN Modulen ihn brauchen. Ihn
zu kopieren waere eine zweite Pflegestelle fuer die Rollenliste (Wurzel 4) —
und genau die Rollenliste entscheidet, wer Finanz- und Vertriebsdaten sieht.
"""
from __future__ import annotations

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_texte import text as mail_text

from .ereignisse import (
    _GLOCKEN_SPRACHE,
    _betriebsleitung,
    _dispatcher,
    _nur_vorname,
    _objekt_titel,
)

log = get_logger("nextdays.betriebsmeldungen")

# --- Systemwarnungen (§4.1, 07.09.2026) --------------------------------------
SCHLUESSEL_SYSTEMWARNUNG = "systemwarnung"

# --- Zustellprobleme (15.08.2026) -------------------------------------------
SCHLUESSEL_ZUSTELLPROBLEM = "zustellproblem"


def melde_systemwarnung(  # noqa: PLR0913 — eine Meldung mit ihrem Kontext
    db: Client,
    *,
    tenant_id: str,
    text_key: str,
    werte: dict[str, object],
    dedup_key: str,
    ziel_pfad: str,
    property_id: str | None = None,
) -> None:
    """„Ein Hintergrundlauf des Betriebs ist gescheitert" — an alle mit
    `RECEIVE_SYSTEM_ALERTS`.

    WOZU: Sync-Fehler standen bisher nur im Server-Log (`log.error`) und im
    Job-Status. Der Betrieb sah hoechstens einen veralteten Portal-Stand und
    suchte den Fehler bei sich. Der Co-Admin, dem §4.1 die System-Warnungen
    ausdruecklich zuspricht, bekam gar nichts — die einzige bestehende
    Admin-Meldung (`airbnb_zimmer_push`) ging nur an `role = 'admin'`.

    NUR GLOCKE (Kategorie ohne Kanaele): eine Stoerung trifft viele Laeufe
    kurz hintereinander. ENTDOPPLUNG ueber `dedup_key` je Ursache (Objekt +
    Lauf), damit der naechtliche Wiederholungslauf die ungelesene Meldung
    nicht verdoppelt (Wurzel 2). Best-effort: kippt den Aufrufer nie.

    `werte` fuellt `text_key` (Katalog `core.mail_texte`); ein `objekt`-
    Platzhalter wird aus `property_id` ergaenzt, wenn der Aufrufer ihn nicht
    selbst mitgibt.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            log.info("systemwarnung_ohne_empfaenger", tenant_id=tenant_id)
            return
        werte = dict(werte)
        if property_id and "objekt" not in werte:
            werte["objekt"] = _objekt_titel(db, tenant_id, property_id)
        dispatcher = _dispatcher(db)
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_SYSTEMWARNUNG,
                betreff=mail_text("benachrichtigung.systemwarnung", _GLOCKEN_SPRACHE),
                betreff_key="benachrichtigung.systemwarnung",
                text=mail_text(text_key, _GLOCKEN_SPRACHE, **werte),
                text_key=text_key,
                text_werte=werte,
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad=ziel_pfad,
                dedup_key=dedup_key,
                # WIEDERHOLBAR (0617): Eine STOERUNG ist ein Zustand, derselbe
                # Lauf kann erneut scheitern. Der `dedup_key` kommt zudem vom
                # AUFRUFER — ueber fremde Schluessel entscheidet diese
                # Funktion nicht.
                einmalig=False,
            )
        log.info(
            "systemwarnung_gemeldet",
            tenant_id=tenant_id, property_id=property_id,
            empfaenger=len(empfaenger), dedup_key=dedup_key,
        )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Lauf nie
        log.warning(
            "systemwarnung_meldung_fehlgeschlagen",
            tenant_id=tenant_id, dedup_key=dedup_key, error=str(exc)[:200],
        )


def melde_zustellproblem(
    db: Client,
    *,
    tenant_id: str,
    quelle_id: str,
    grund: str,
    endgueltig: bool,
    property_id: str | None = None,
) -> None:
    """„Eine Nachricht an einen Gast konnte nicht zugestellt werden."

    WOZU: Bis hierher erfuhr der Betrieb davon GAR NICHT. Der Grund stand in
    `last_error` — einer Spalte, die kein Endpunkt ausliefert und kein Abo
    abhoert; die Liste der geplanten Nachrichten filtert zudem auf 'pending',
    blendet Fehlgeschlagenes also aus. Live waren so 14 Gaeste ohne ihre
    Anreise-Info (Tuercode, WLAN), ohne dass es jemand sehen konnte.

    NUR GLOCKE, keine Mail/SMS: die Kategorie traegt bewusst keine Kanaele
    (s. `katalog.zustellproblem`). Der Ausloeser ist meist eine Stoerung, die
    viele Nachrichten gleichzeitig trifft — eine Mail je Nachricht waere eine
    Flut genau im falschen Moment.

    ENTDOPPLUNG ueber die Quellzeile: derselbe Fehlschlag meldet einmal. Ein
    Neuversuch, der wieder scheitert, hebt die Meldung nicht erneut — sie steht
    ja noch ungelesen da (partieller UNIQUE-Index auf `gelesen_am is null`).

    `endgueltig` trennt die beiden Faelle im Text, weil sie verschieden
    dringend sind: „wird erneut versucht" darf man liegen lassen, „nicht
    zugestellt" nicht.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            return
        dispatcher = _dispatcher(db)
        zustell_key = (
            "benachrichtigung.zustellung_gescheitert"
            if endgueltig
            else "benachrichtigung.zustellung_verzoegert"
        )
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_ZUSTELLPROBLEM,
                betreff=mail_text(zustell_key, _GLOCKEN_SPRACHE),
                betreff_key=zustell_key,
                # `grund` ist der Wortlaut des Portals und bleibt, wie er kam
                # (Wurzel 4: kein uebersetzter Ersatz fuer eine fremde Meldung).
                text=grund[:500],
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad="/posteingang",
                dedup_key=f"zustellproblem:{quelle_id}",
                # WIEDERHOLBAR (0617): „liegt unzustellbar" ist ein Zustand.
                # Scheitert dieselbe Zeile nach dem Lesen erneut, MUSS es
                # wieder melden — sonst bleibt ein Gast ohne Tuercode.
                einmalig=False,
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Versand nie
        log.warning(
            "zustellproblem_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            quelle_id=quelle_id,
            error=str(exc)[:200],
        )


# --- KI-Eskalation (0498/0499) -----------------------------------------------
SCHLUESSEL_KI_ESKALATION = "ki_eskalation"


def melde_ki_eskalation(
    db: Client,
    *,
    tenant_id: str,
    thread_id: str,
    grund: str,
    property_id: str | None = None,
    gast_vorname: str | None = None,
) -> None:
    """„Die KI hat einen Verlauf eskaliert."

    ZWEI AUSLOESER, ein Weg: negative Stimmung (das Modell beurteilt sie im
    selben Aufruf) oder eine Eskalationsregel des Betriebs. Der Empfaenger ist
    derselbe, und die Meldung liest sich gleich — nur `grund` unterscheidet sie.

    DER SCHALTER AN DER REGEL entscheidet, OB gemeldet wird; diese Kategorie
    entscheidet, WIE und an wen. Zwei Ebenen, wie ueberall sonst im Produkt.

    ENTDOPPLUNG ueber den Thread: ein Verlauf, der noch offen eskaliert ist,
    meldet nicht ein zweites Mal. Sonst bekaeme der Betrieb bei einem
    hin- und hergehenden Beschwerdegespraech eine Mail je Nachricht — und
    schaltet danach die Kategorie ab.

    Best effort wie alle Meldungen: sie darf die Antwort nie kippen.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            return
        dispatcher = _dispatcher(db)
        betreff_key = "benachrichtigung.ki_eskalation"
        # Der Gastname nur als VORNAME (Datensplit, wie ueberall sonst hier):
        # eine Push-Meldung auf einem Sperrbildschirm ist keine Gastakte.
        vorname = _nur_vorname(gast_vorname)
        text = f"{vorname}: {grund}" if vorname else grund
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_KI_ESKALATION,
                betreff=mail_text(betreff_key, _GLOCKEN_SPRACHE),
                betreff_key=betreff_key,
                text=text[:500],
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad=f"/posteingang/{thread_id}",
                dedup_key=f"ki_eskalation:{thread_id}",
                # WIEDERHOLBAR (0617): Der Schluessel traegt den THREAD, und
                # ein Verlauf kann mehrfach eskalieren. Der Riegel daempft nur
                # die Flut innerhalb EINES offenen Vorgangs (siehe Docstring).
                einmalig=False,
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt die Antwort nie
        log.warning(
            "ki_eskalation_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            thread_id=thread_id,
            error=str(exc)[:200],
        )


# --- Portal-Rate verwaist (0432) ---------------------------------------------
SCHLUESSEL_PORTAL_RATE_VERWAIST = "portal_rate_verwaist"


def melde_portal_rate_verwaist(
    db: Client, *, tenant_id: str, property_id: str, portal_rate_code: str,
) -> None:
    """„Eine Buchung kam mit einer Portal-Rate an, die keinem eigenen
    Preisplan zugeordnet werden konnte — auch nach dem Sofort-Abgleich nicht."

    WOZU: Der Automatismus (`portal_raten_abgleichen`) legt fuer eine noch
    beim Portal gefuehrte Rate automatisch einen Plan an, ohne dass der
    Betrieb je etwas sieht. Fuer einen Ratencode, der beim Eintreffen der
    Buchung schon nicht mehr gefuehrt wird, gibt es dafuer KEINE Datenquelle
    (0432, "Feriehus Perlen Tversted", Code 55775628) — der Betrieb muss es
    im eigenen Preise-Bereich nachtragen. Bis hierher erfuhr er davon gar
    nicht: die Luecke stand nur im Server-Log.

    NIE "Channex" im Text — der Betrieb sieht nur "Portale" (siehe Katalog-
    Kommentar). NUR die Glocke, aus derselben Erwaegung wie bei
    Zustellproblemen: eine Portal-seitige Ratenumstellung trifft oft mehrere
    Buchungen kurz hintereinander, eine Mail je Treffer waere eine Flut.

    ENTDOPPLUNG ueber den Ratencode, nicht die Buchung: dieselbe tote Rate
    kann mehrere Buchungen betreffen, aber der Betrieb muss nur EINMAL
    hingewiesen werden (partieller UNIQUE-Index auf `gelesen_am is null`,
    Wurzel 2)."""
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            return
        zeile = (
            db.table("properties")
            .select("name")
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        objekt = str(zeile[0]["name"]) if zeile and zeile[0].get("name") else ""
        dispatcher = _dispatcher(db)
        text_key = "benachrichtigung.portal_rate_verwaist_text"
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_PORTAL_RATE_VERWAIST,
                betreff=mail_text(
                    "benachrichtigung.portal_rate_verwaist", _GLOCKEN_SPRACHE,
                ),
                betreff_key="benachrichtigung.portal_rate_verwaist",
                text=mail_text(text_key, _GLOCKEN_SPRACHE, objekt=objekt),
                text_key=text_key,
                text_werte={"objekt": objekt},
                tenant_id=tenant_id,
                property_id=property_id,
                ziel_pfad=f"/objekte/{property_id}/preise",
                dedup_key=f"portal_rate_verwaist:{tenant_id}:{portal_rate_code}",
                # WIEDERHOLBAR (0617): eine LUECKE im Preisplan. Gelesen, aber
                # nicht nachgetragen, und die naechste Buchung kommt mit
                # derselben toten Rate — sonst verstummt der Hinweis nach dem
                # Wegklicken.
                einmalig=False,
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Abgleich nie
        log.warning(
            "portal_rate_verwaist_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            property_id=property_id,
            portal_rate_code=portal_rate_code,
            error=str(exc)[:200],
        )

# --- Testphase endet (0488) ---------------------------------------------------
SCHLUESSEL_TESTPHASE = "testphase_endet"


def melde_testphase_endet(
    db: Client, *, tenant_id: str, endet_am: str | None
) -> None:
    """„Deine kostenlose Testphase endet in wenigen Tagen."

    WOZU: Am Tag nach dem Ablauf zieht Stripe den ersten Beitrag ein. Ohne
    diese Meldung waere das eine Belastung aus dem Nichts — die Testphase
    beginnt beim Abschluss und laeuft danach still, niemand merkt sich das
    Datum. Genau daraus entstehen Rueckbuchungen und Beschwerden.

    AUSGELOEST VON STRIPE, nicht von uns: `customer.subscription.trial_will_end`
    kommt drei Tage vor dem Ende. Wir rechnen den Zeitpunkt also nicht selbst
    aus (kein Cron, der eine fremde Frist nachbildet und bei jeder Aenderung
    auseinanderlaeuft) — die Quelle der Frist ist die Quelle der Meldung.

    `endet_am` ist Stripes `trial_end`, bereits als ISO-Datum. Fehlt es, wird
    die Meldung OHNE Datum verschickt statt mit einem gerechneten (Wurzel 4:
    lieber unvollstaendig als plausibel falsch) — die Aufforderung stimmt auch
    ohne Tag, und im Konto steht das genaue Datum.

    ENTDOPPLUNG ueber den Tenant: Stripe kann das Ereignis wiederholen
    (Wurzel 2). Ein `dedup_key` je Testphase laesst die zweite Meldung
    auflaufen, solange die erste ungelesen ist.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            log.warning("testphase_meldung_ohne_empfaenger", tenant_id=tenant_id)
            return
        dispatcher = _dispatcher(db)
        titel_key = "benachrichtigung.testphase_endet"
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_TESTPHASE,
                betreff=mail_text(titel_key, _GLOCKEN_SPRACHE),
                betreff_key=titel_key,
                text=endet_am or "",
                tenant_id=tenant_id,
                # Dorthin, wo die Entscheidung faellt: „Tarif & Abo" mit Status,
                # Rechnungsadresse und Objektzahl. NICHT /konto/abrechnung —
                # das ist die AUSZAHLUNG an den Betrieb, die andere Richtung.
                ziel_pfad="/konto/tarif",
                dedup_key=f"testphase:{tenant_id}:{endet_am or 'ohne-datum'}",
                # EINMALIG (0617): `trial_will_end` ist ein STRIPE-Ereignis zu
                # genau einem Enddatum, und Stripe wiederholt Webhooks bis zum
                # 200 (Wurzel 2). Das Datum steht im Schluessel, eine
                # verlaengerte Testphase meldet also wieder — aber dieselbe
                # Frist nie zweimal, auch nicht nach dem Lesen.
                einmalig=True,
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Webhook nie
        log.warning(
            "testphase_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            error=str(exc)[:200],
        )
