"""Ereignis-Benachrichtigungen: Aufgaben-Zuweisung und Buchungen (Etappe E).

DIE EINE STELLE, die aus einem fachlichen Ereignis eine Benachrichtigung macht.
Die ausloesenden Slices (tasks, reservations, channel_manager) rufen hier EINE
Funktion — sie kennen weder Empfaenger-Aufloesung noch Kanalwahl noch Dedup.
Ohne diese Schicht wuerde jeder Slice seinen eigenen Fan-out bauen, und der
dritte haette den Dedup vergessen.

Fan-out-Regeln, aus denen alles Weitere folgt:
  * Aufgaben-Zuweisung → an den ZUGEWIESENEN, niemanden sonst.
  * Buchung/Aenderung/Storno → an den EIGENTUEMER des betroffenen Objekts.
    Es gibt ZWEI Zuordnungswege, die auseinanderlaufen koennen (nachgeprueft):
    `owner_property_assignments` (Login ↔ Objekt, das Portal) und
    `owners.user_id` + `owner_properties` (Owner-Partei ↔ Objekt, die
    Abrechnung). Beide werden gefragt und die Nutzer-IDs vereinigt — wer nur
    ueber einen Weg eingetragen ist, wuerde sonst nichts erfahren.

Wurzel 2 (Doppelmeldungen): Webhook-Redelivery und Re-Sync liefern dasselbe
Ereignis mehrfach. Jede Meldung traegt darum einen `dedup_key`, der das
EREIGNIS beschreibt (Reservierung + Art), nicht den Zeitpunkt des Versands.
Der partielle UNIQUE-Index aus 0287 laesst die zweite Meldung auflaufen,
solange die erste ungelesen ist.

Wurzel 3 (Datensplit §4.2/§4.3): Der Eigentuemer erfaehrt VORNAME und QUELLE,
nie den Gast-Gesamtpreis, nie Kontaktdaten. Der Text wird hier gebaut, nicht
vom Aufrufer uebergeben — sonst reichte ein unachtsamer Aufrufer den vollen
Namen durch.

Wurzel 5 (Best-effort): Benachrichtigungen sind Nebenpfad. Keine Funktion hier
darf das ausloesende Geschaeft (Aufgabe anlegen, Buchung schreiben) kippen —
jede faengt breit und markiert das mit `# noqa: BLE001`.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from supabase import Client

from src.core.logging import get_logger
from src.core.mail_sprache import FALLBACK
from src.core.mail_texte import TEXTE as MAIL_TEXTE
from src.core.mail_texte import text as mail_text

if TYPE_CHECKING:  # nur fuer die Typannotation — zur Laufzeit waere es ein Zyklus
    from .dispatcher import NotificationDispatcher

log = get_logger("nextdays.benachrichtigungs_ereignisse")

# Katalog-Schluessel (0331). Als Konstanten, damit ein Tippfehler beim Aufrufer
# nicht erst zur Laufzeit im ValueError des Dispatchers auffaellt.
SCHLUESSEL_AUFGABE = "task_assigned"
# Vertretung (0415). Eigene Kategorie, weil der EMPFAENGER ein anderer ist:
# die Anfrage geht an alle, die einspringen koennten, die Entscheidung zurueck
# an den Anfragenden.
SCHLUESSEL_VERTRETUNG = "task_substitution"
SCHLUESSEL_BUCHUNG = "owner_booking"
SCHLUESSEL_LEISTUNG = "owner_service"
# Dieselbe Buchung, anderer Empfaenger: der BETRIEB statt des Eigentuemers.
SCHLUESSEL_BETRIEB_BUCHUNG = "betrieb_buchung"

# Die Ereignisarten, ueber die der Eigentuemer informiert wird. Bewusst eine
# geschlossene Menge: `checked_in`/`repriced` & Co. sind Betriebsvorgaenge, mit
# denen ein Eigentuemer nicht behelligt wird.
#
# Der Wert ist der KATALOG-SCHLUESSEL des Mail-Betreffs (`core.mail_texte`).
# Bis 0335 stand hier deutscher Klartext, weil eine versendete Mail keinen
# Message-Katalog mehr erreicht — den gibt es serverseitig inzwischen, samt
# Empfaengersprache. Ein dänischer Eigentuemer bekam sonst „Neue Buchung"
# im Postfach.
_BUCHUNG_BETREFF_KEY = {
    "created": "benachrichtigung.buchung_neu",
    "moved": "benachrichtigung.buchung_geaendert",
    "cancelled": "benachrichtigung.buchung_storniert",
}
BUCHUNGS_EREIGNISSE = frozenset(_BUCHUNG_BETREFF_KEY)

# Die Glocke bleibt deutschsprachig-neutral? Nein — sie bekommt denselben Satz
# in der Sprache des BETRIEBS-Bestands. Sie ist eine gespeicherte Zeile, die
# die Oberflaeche liest; deren Sprachwahl kann sich spaeter aendern. Damit dort
# kein roher Schluessel steht, wird der Betreff fuer die Glocke im FALLBACK
# gerendert — sichtbar an EINER Stelle statt als 24 Sonderfaelle in der UI.
_GLOCKEN_SPRACHE = FALLBACK

# Die Systemvorgaben aus 0330 fuer den Mail-Betreff → Katalog-Schluessel. Muss
# mit den `key`-Werten der Migration uebereinstimmen — ein Test wacht darueber.
_AUFGABEN_SCHLUESSEL = {
    "endreinigung": "aufgabe.endreinigung",
    "hauptreinigung": "aufgabe.hauptreinigung",
    "fensterreinigung": "aufgabe.fensterreinigung",
    "rasenmaehen": "aufgabe.rasenmaehen",
    "terrassenreinigung": "aufgabe.terrassenreinigung",
}


def _dispatcher(db: Client) -> NotificationDispatcher:
    """Lokaler Import — der Dispatcher zieht Mail/SMS/Settings nach, und ein
    Import auf Modulebene machte daraus einen Zyklus (tasks → hier →
    dispatcher → service → ...)."""
    from .dispatcher import NotificationDispatcher  # noqa: PLC0415

    return NotificationDispatcher(db)


# --- Aufgaben ---------------------------------------------------------------


def _aufgaben_dedup(
    art: str, task_id: str, assignee_id: str, vorgang: str | None
) -> str:
    """Entdopplungs-Schluessel einer Aufgaben-Meldung.

    Ohne `vorgang`: je Aufgabe und Empfaenger genau eine offene Meldung — das
    ist der Normalfall bei der Neuanlage. Mit `vorgang` zaehlt zusaetzlich
    das einzelne Ereignis, damit ein Hin und Her (A → B → A) den Empfaenger
    wirklich zweimal erreicht.
    """
    basis = f"{art}:{task_id}:{assignee_id}"
    return f"{basis}:{vorgang}" if vorgang else basis


def melde_aufgaben_zuweisung(
    db: Client,
    *,
    tenant_id: str,
    task_id: str,
    assignee_id: str | None,
    titel: str,
    property_id: str | None = None,
    vorgang: str | None = None,
) -> None:
    """„Dir wurde eine Aufgabe zugewiesen."

    Idempotent ueber `dedup_key = aufgabe_zugewiesen:<task_id>:<assignee_id>`:
    Der Schluessel traegt den EMPFAENGER mit, damit eine Umverteilung (A → B →
    A) den neuen Zustaendigen wirklich erreicht — ein Schluessel nur aus der
    task_id wuerde die zweite Zuweisung an A stumm schlucken. Wird dagegen
    dieselbe Aufgabe mehrfach gespeichert, ohne dass sich der Zustaendige
    aendert, greift die Entdopplung wie gewollt.

    `vorgang` unterscheidet zwei Zuweisungen an DENSELBEN Empfaenger. Der
    Empfaenger allein im Schluessel reicht dafuer naemlich nicht: der
    UNIQUE-Index `notifications_dedup_offen_uq` laeuft ueber
    `(user_id, dedup_key) where gelesen_am is null` — bei A → B → A trifft die
    zweite Meldung an A auf die erste, noch UNGELESENE, und wird verschluckt.
    Und weil `_glocke_entdoppelt` fuer alle Kanaele abbricht, faellt mit der
    Glocke auch die Mail aus: A saehe nur „Aufgabe nicht mehr bei dir" und
    erfuehre von der Rueckgabe nie. Der Aufrufer reicht deshalb etwas durch,
    das den VORGANG unterscheidet (z. B. den Aenderungs-Zeitstempel).
    Ohne `vorgang` bleibt der Schluessel wie bisher — fuer die Neuanlage, wo
    es je Aufgabe nur einen geben kann, ist das richtig.

    Ohne `assignee_id` passiert NICHTS: eine unzugewiesene Aufgabe hat keinen
    Empfaenger, und „an alle" waere geraten (Wurzel 4).
    """
    if not assignee_id:
        return
    try:
        # Die Tenant-Pruefung steht INNERHALB des try, obwohl sie eine
        # Vorbedingung ist: sie fragt die Datenbank, und ein transienter
        # DB-Fehler hier duerfte den Aufrufer nicht kippen. Stuende sie davor,
        # bekaeme der Client nach erfolgreich angelegter Aufgabe einen 500 —
        # und weil `create_task` nicht idempotent ist, erzeugte sein Retry eine
        # ZWEITE Aufgabe (Wurzel 5 kippt dann Wurzel 2).
        if not _gehoert_zum_tenant(db, assignee_id, tenant_id):
            # Der Dispatcher loest den Empfaenger allein ueber `users.id` auf,
            # ohne Tenant-Filter. Die Pruefung gehoert deshalb hierher: eine
            # Aufgabe darf niemanden ausserhalb ihres Mandanten anschreiben
            # (Wurzel 3).
            log.warning(
                "aufgaben_benachrichtigung_fremder_empfaenger",
                tenant_id=tenant_id, task_id=task_id,
            )
            return
        _dispatcher(db).sende(
            user_id=assignee_id,
            schluessel=SCHLUESSEL_AUFGABE,
            # Zwei Fassungen desselben Satzes: `betreff` fuellt die GLOCKE
            # (Oberflaeche, eigene Sprachwahl), `betreff_key` die E-MAIL in der
            # Sprache des Empfaengers. `titel` ist bei Portal-Auftraegen der
            # Katalog-Schluessel (`endreinigung`) und wird als `Katalogwert`
            # durchgereicht, damit der Dispatcher ihn erst dann uebersetzt,
            # wenn die Empfaengersprache feststeht. Ein FREITEXT des
            # Eigentuemers bleibt unangetastet: er hat ihn in seiner Sprache
            # geschrieben, er ist die Wahrheit.
            betreff=mail_text(
                "benachrichtigung.aufgabe_neu",
                _GLOCKEN_SPRACHE,
                titel=_aufgaben_titel(titel, _GLOCKEN_SPRACHE),
            ),
            betreff_key="benachrichtigung.aufgabe_neu",
            betreff_werte={"titel": _titel_wert(titel)},
            # Kein zusaetzlicher Fliesstext: der Titel IST die Meldung.
            text="",
            tenant_id=tenant_id,
            # ZIEL: GENAU die Aufgabe, um die es in der Meldung geht.
            #
            # Diese Adresse gab es lange nicht — jeder Klick lief ins 404 (live
            # 10./11.08.2026, auch aus bereits zugestellten Mails). Der
            # Zwischenschritt „auf die Liste umbiegen" war nur das kleinere
            # Übel: die Meldung nennt EINE Aufgabe, und der Empfänger musste
            # sie in seiner Liste wiederfinden. Seit die Seite existiert
            # (`web/app/(dashboard)/aufgaben/[taskId]`), führt der Link wieder
            # dorthin, wo die Meldung hinzeigt.
            #
            # Die Form ist bewusst UNVERÄNDERT `/aufgaben/{task_id}`: genau so
            # steht sie in den Mails, die längst in Postfächern liegen. Eine
            # schönere Adresse würde die alten Links endgültig brechen.
            ziel_pfad=f"/aufgaben/{task_id}",
            property_id=property_id,
            dedup_key=_aufgaben_dedup(
                "aufgabe_zugewiesen", task_id, assignee_id, vorgang
            ),
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Aufgabe nicht kippen
        log.warning(
            "aufgaben_benachrichtigung_fehlgeschlagen",
            task_id=task_id, error=str(exc)[:200],
        )


def melde_vertretung_gesucht(
    db: Client,
    *,
    tenant_id: str,
    task_id: str,
    empfaenger_ids: list[str],
    titel: str,
    property_id: str | None = None,
) -> None:
    """„Vertretung gesucht." — an alle, die einspringen koennten.

    Bis 0415 erreichte eine Vertretungsanfrage NIEMANDEN: `request_substitution`
    schrieb die Zeile und eine Log-Meldung, es gab weder Oberflaeche noch
    Benachrichtigung. Wer ausfiel, fragte ins Leere — und die Aufgabe blieb bei
    ihm, waehrend er annahm, jemand uebernehme sie.

    Der EMPFAENGERKREIS kommt vom Aufrufer (der Aufgaben-Dienst kennt die
    Capability und die Objekt-Freigaben), nicht von hier: „an alle im Tenant"
    waere geraten und schickte einer Buchhaltung Reinigungsanfragen.

    `dedup_key` traegt Aufgabe UND Empfaenger — dieselbe Anfrage darf jeden
    Kollegen genau einmal erreichen (Wurzel 2), aber eine zweite Anfrage zur
    SELBEN Aufgabe (erste abgelehnt) ist ein neues Ereignis: dafuer traegt der
    Schluessel die Anfrage-Nummer nicht, sondern der Aufrufer entdoppelt ueber
    den Status — eine offene Anfrage kann es je Aufgabe nur einmal geben.
    """
    for empfaenger in empfaenger_ids:
        if not empfaenger:
            continue
        try:
            if not _gehoert_zum_tenant(db, empfaenger, tenant_id):
                log.warning(
                    "vertretung_benachrichtigung_fremder_empfaenger",
                    tenant_id=tenant_id, task_id=task_id,
                )
                continue
            _dispatcher(db).sende(
                user_id=empfaenger,
                schluessel=SCHLUESSEL_VERTRETUNG,
                betreff=mail_text(
                    "benachrichtigung.vertretung_gesucht",
                    _GLOCKEN_SPRACHE,
                    titel=_aufgaben_titel(titel, _GLOCKEN_SPRACHE),
                ),
                betreff_key="benachrichtigung.vertretung_gesucht",
                betreff_werte={"titel": _titel_wert(titel)},
                text="",
                tenant_id=tenant_id,
                # Ziel ist die AUFGABE: dort sieht der Kollege, worum es geht.
                # Die Anfrage selbst hat keine eigene Adresse — annehmen kann er
                # sie in der Aufgabenliste (Web) bzw. im Band der App.
                ziel_pfad=f"/aufgaben/{task_id}",
                property_id=property_id,
                dedup_key=_aufgaben_dedup(
                    "vertretung_gesucht", task_id, empfaenger, None
                ),
            )
        except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Anfrage nicht kippen
            log.warning(
                "vertretung_benachrichtigung_fehlgeschlagen",
                task_id=task_id, error=str(exc)[:200],
            )


def melde_vertretung_entschieden(
    db: Client,
    *,
    tenant_id: str,
    task_id: str,
    empfaenger_id: str | None,
    titel: str,
    uebernommen: bool,
    durch_name: str | None = None,
    property_id: str | None = None,
) -> None:
    """Die Antwort zurueck an den, der die Vertretung gesucht hat.

    Der Gegenzustand zur Anfrage (Wurzel 1): ohne diese Meldung weiss der
    Anfragende nicht, ob er heute noch fahren muss. Genau das ist die
    Information, wegen der er gefragt hat.

    Bei der Ablehnung steht KEIN Name in der Meldung: abgelehnt hat eine
    bestimmte Person, aber die Aussage ist „es hat niemand uebernommen" — einen
    Kollegen namentlich als Ablehner zu melden, macht aus einer Absage eine
    Anschuldigung.

    `vorgang` traegt die Entscheidung, damit auf eine Ablehnung eine spaetere
    Uebernahme folgen kann, ohne an der noch ungelesenen ersten Meldung zu
    scheitern (`notifications_dedup_offen_uq`).
    """
    if not empfaenger_id:
        return
    schluessel_text = (
        "benachrichtigung.vertretung_uebernommen"
        if uebernommen
        else "benachrichtigung.vertretung_abgelehnt"
    )
    werte: dict[str, object] = {"titel": _titel_wert(titel)}
    if uebernommen:
        werte["name"] = durch_name or ""
    try:
        if not _gehoert_zum_tenant(db, empfaenger_id, tenant_id):
            log.warning(
                "vertretung_antwort_fremder_empfaenger",
                tenant_id=tenant_id, task_id=task_id,
            )
            return
        _dispatcher(db).sende(
            user_id=empfaenger_id,
            schluessel=SCHLUESSEL_VERTRETUNG,
            betreff=mail_text(
                schluessel_text,
                _GLOCKEN_SPRACHE,
                titel=_aufgaben_titel(titel, _GLOCKEN_SPRACHE),
                **({"name": durch_name or ""} if uebernommen else {}),
            ),
            betreff_key=schluessel_text,
            betreff_werte=werte,
            text="",
            tenant_id=tenant_id,
            ziel_pfad=f"/aufgaben/{task_id}",
            property_id=property_id,
            dedup_key=_aufgaben_dedup(
                "vertretung_antwort",
                task_id,
                empfaenger_id,
                "uebernommen" if uebernommen else "abgelehnt",
            ),
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Entscheidung nicht kippen
        log.warning(
            "vertretung_antwort_fehlgeschlagen",
            task_id=task_id, error=str(exc)[:200],
        )


def melde_aufgaben_entzug(
    db: Client,
    *,
    tenant_id: str,
    task_id: str,
    assignee_id: str | None,
    titel: str,
    property_id: str | None = None,
    vorgang: str | None = None,
) -> None:
    """„Diese Aufgabe ist nicht mehr deine." — an den BISHERIGEN Zustaendigen.

    Der Gegenzustand zur Zuweisung (Wurzel 1): eine umverteilte Aufgabe
    verschwindet sonst wortlos aus der Liste dessen, der sie bis eben hatte.
    Er sieht sie nicht mehr, weiss aber nichts davon — und haelt sie im
    Zweifel weiter fuer seine, waehrend sie ein Kollege schon erledigt.

    Bewusst dieselbe Katalog-Kategorie wie die Zuweisung (`task_assigned`):
    es ist dieselbe Sache aus der Gegenrichtung, an denselben Empfaenger.
    Eine eigene Kategorie liesse den Entzug einzeln abschalten — dann bekaeme
    jemand die Zuweisungen, aber nie die Entzuege, und seine Liste waere
    dauerhaft falsch.

    `dedup_key` traegt Aufgabe UND Empfaenger, analog zur Zuweisung: wird eine
    Aufgabe A → B → A geschoben, ist der zweite Entzug bei A ein echtes neues
    Ereignis und darf nicht entdoppelt werden.
    """
    if not assignee_id:
        return
    try:
        if not _gehoert_zum_tenant(db, assignee_id, tenant_id):
            log.warning(
                "aufgaben_entzug_fremder_empfaenger",
                tenant_id=tenant_id, task_id=task_id,
            )
            return
        _dispatcher(db).sende(
            user_id=assignee_id,
            schluessel=SCHLUESSEL_AUFGABE,
            betreff=mail_text(
                "benachrichtigung.aufgabe_entzogen",
                _GLOCKEN_SPRACHE,
                titel=_aufgaben_titel(titel, _GLOCKEN_SPRACHE),
            ),
            betreff_key="benachrichtigung.aufgabe_entzogen",
            betreff_werte={"titel": _titel_wert(titel)},
            text="",
            tenant_id=tenant_id,
            # Kein Ziel-Pfad: die Aufgabe ist fuer diesen Empfaenger nicht mehr
            # sichtbar (er faellt aus dem Assignee-Filter, als Mitarbeiter
            # womoeglich ganz aus dem Objekt-Scope). Ein Link, der ihn ins 404
            # oder in ein „nicht gefunden" fuehrt, waere schlechter als keiner.
            ziel_pfad=None,
            property_id=property_id,
            dedup_key=_aufgaben_dedup(
                "aufgabe_entzogen", task_id, assignee_id, vorgang
            ),
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Aufgabe nicht kippen
        log.warning(
            "aufgaben_entzug_benachrichtigung_fehlgeschlagen",
            task_id=task_id, error=str(exc)[:200],
        )


def melde_dienstleistung_erledigt(
    db: Client,
    *,
    tenant_id: str,
    task_id: str,
    zeile: dict,
) -> None:
    """„Deine beauftragte Leistung ist erledigt" — an den Besteller.

    Empfaenger ist `tasks.requested_by`, also der Eigentuemer, der den Auftrag
    ueber das Portal ausgeloest hat (0330). Fehlt das Feld, ist es eine
    gewoehnliche Betriebsaufgabe — dann passiert NICHTS: der Eigentuemer hat
    mit dem Tagesgeschaeft des Betriebs nichts zu tun (§4.3).

    Ohne diese Funktion waere die Kategorie `owner_service` ein Schalter im
    Konto, den niemand ausloest — tote Dekoration (Wurzel 4).
    """
    besteller = zeile.get("requested_by")
    if not besteller:
        return
    try:
        roh = str(zeile.get("title") or "")
        _dispatcher(db).sende(
            user_id=str(besteller),
            schluessel=SCHLUESSEL_LEISTUNG,
            betreff=mail_text(
                "benachrichtigung.leistung_erledigt",
                _GLOCKEN_SPRACHE,
                titel=_aufgaben_titel(roh, _GLOCKEN_SPRACHE),
            ),
            betreff_key="benachrichtigung.leistung_erledigt",
            betreff_werte={"titel": _titel_wert(roh)},
            text="",
            tenant_id=tenant_id,
            ziel_pfad="/portal/dienstleistungen",
            property_id=(
                str(zeile["property_id"]) if zeile.get("property_id") else None
            ),
            # Ein Abschluss je Auftrag (Wurzel 2). Wird die Aufgabe erneut
            # abgeschlossen (Doppelklick, Wiedereroeffnung), meldet der
            # UNIQUE-Index die offene Meldung als bereits vorhanden.
            dedup_key=f"leistung_erledigt:{task_id}",
        )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, kippt den Abschluss nicht
        log.warning(
            "leistung_benachrichtigung_fehlgeschlagen",
            task_id=task_id, error=str(exc)[:200],
        )


# --- Buchungen --------------------------------------------------------------


def melde_buchungs_ereignis(  # noqa: PLR0913 — ein Ereignis mit seinen Feldern
    db: Client,
    *,
    tenant_id: str,
    reservation_id: str,
    kind: str,
    property_id: str | None = None,
    gast_vorname: str | None = None,
    quelle: str | None = None,
    kanal: str | None = None,
) -> None:
    """Buchungseingang / Aenderung / Storno an Eigentuemer UND Betrieb.

    `kind` sind die Ereignisarten der Zeitleiste (0122): created | moved |
    cancelled. Alles andere wird ignoriert — der Aufrufer muss nicht filtern.

    ZWEI Empfaengerkreise mit je eigener Kategorie, weil sie unabhaengig
    abschaltbar sein muessen: `owner_booking` an die Eigentuemer DIESES Objekts
    (vertragliche Kerninformation, Mail nicht abwaehlbar) und
    `betrieb_buchung` an die Betriebsleitung (Tagesgeschaeft, Mail abwaehlbar).
    Bis hierher gab es nur den ersten Kreis — ein Property-Manager, der nicht
    zufaellig auch als Eigentuemer eingetragen war, erfuhr von einer neuen
    Portal-Buchung ueberhaupt nichts.

    Der Inhalt respektiert den Datensplit (Wurzel 3): NUR Vorname und Quelle
    gehen mit, nie der Gast-Gesamtpreis und nie Kontaktdaten. Der Aufrufer
    liefert bereits den Vornamen; hier wird zusaetzlich abgeschnitten, falls
    doch ein voller Name durchgereicht wird — Verteidigung in der Tiefe.
    """
    if kind not in BUCHUNGS_EREIGNISSE:
        return
    if not property_id:
        # Ohne Objektbezug gibt es keinen Eigentuemer — und „an alle Owner des
        # Mandanten" waere ein Datenleck (fremde Objekte). Auch die
        # Betriebsmeldung bleibt aus: ohne Objekt gaebe es keinen Titel und
        # keinen Weg, die Meldung sinnvoll zu beschriften.
        return
    try:
        # Beide Kreise getrennt ermittelt. Die Eigentuemer-Menge darf leer sein,
        # ohne die Betriebsmeldung zu verhindern — ein Objekt ohne hinterlegten
        # Eigentuemer ist der Normalfall bei einem selbst verwalteten Betrieb,
        # und frueher fiel hier deshalb ALLES aus (`if not empfaenger: return`).
        empfaenger = eigentuemer_nutzer_ids(db, tenant_id, property_id)
        betrieb = _betriebsleitung(db, tenant_id) - empfaenger
        if not empfaenger and not betrieb:
            return
        vorname = _nur_vorname(gast_vorname)
        objekt = _objekt_titel(db, tenant_id, property_id)
        kanal_wert = _kanal_wert(quelle, kanal)
        # Die Glocke bekommt den fertigen Satz in der Serversprache (sie wird
        # in der Oberflaeche gelesen, die ihre eigene Sprachwahl hat), die Mail
        # den Schluessel plus den Kanal als `Katalogwert` — sie geht in der
        # Sprache des jeweiligen Eigentuemers raus.
        text = " · ".join(
            t
            for t in (vorname, _kanal_text(kanal_wert, _GLOCKEN_SPRACHE))
            if t
        )
        dispatcher = _dispatcher(db)
        # (Empfaenger, Kategorie, dedup-Praefix) statt zweier kopierter
        # Bloecke: bis auf den Katalog-Schluessel — und damit die
        # Abwaehlbarkeit der Mail — ist die Meldung fuer beide Kreise dieselbe.
        #
        # Der Eigentuemer-Kreis behaelt das alte Praefix `buchung`. Ein neues
        # haette die 30 ungelesenen Meldungen im Live-Bestand entwertet: der
        # UNIQUE-Index laeuft ueber (user_id, dedup_key), ein Re-Sync derselben
        # Buchung haette also neben der alten Zeile eine zweite angelegt statt
        # sie zu erkennen (Wurzel 2). Die Kreise sind ohnehin disjunkt
        # (`betrieb` ist um `empfaenger` bereinigt), deshalb genuegt das
        # eigene Praefix fuer den neuen Kreis.
        versand = (
            *((uid, SCHLUESSEL_BUCHUNG, "buchung") for uid in sorted(empfaenger)),
            *(
                (uid, SCHLUESSEL_BETRIEB_BUCHUNG, SCHLUESSEL_BETRIEB_BUCHUNG)
                for uid in sorted(betrieb)
            ),
        )
        for user_id, schluessel, dedup_praefix in versand:
            dispatcher.sende(
                user_id=user_id,
                schluessel=schluessel,
                # Derselbe `sende()`-Aufruf speist die Glocke UND eine E-Mail.
                # Ob die Mail rausgeht, entscheidet die Kategorie: bei
                # `owner_booking` immer (email_pflicht), bei
                # `betrieb_buchung` nur, solange der Betrieb sie nicht
                # abgewaehlt hat. Die Glocke bekommt den fertigen Satz, die
                # Mail den Katalog-Schluessel — sie geht in der Sprache des
                # jeweiligen Empfaengers raus, die im Fan-out je Empfaenger
                # verschieden sein kann.
                betreff=mail_text(
                    _BUCHUNG_BETREFF_KEY[kind], _GLOCKEN_SPRACHE, objekt=objekt
                ),
                betreff_key=_BUCHUNG_BETREFF_KEY[kind],
                betreff_werte={"objekt": objekt},
                # Der Rumpf galt frueher als reine Datenzeile und ging roh
                # hinaus — der Eigentuemer las dadurch „direct" statt
                # „Direkt", den nackten Enum-Wert der Datenbank. Bei einer
                # OTA-Buchung fiel es nicht auf, weil dort der Markenname
                # (`ota_name`) einspringt; nur die Direktbuchung zeigte es.
                # Jetzt Katalogschluessel + `Katalogwert`, damit der Kanal in
                # der Sprache des Empfaengers steht (0335-Mechanik).
                text=text,
                text_key=(
                    "benachrichtigung.buchung_rumpf"
                    if vorname
                    else "benachrichtigung.buchung_rumpf_ohne_gast"
                ),
                text_werte=(
                    {"gast": vorname, "kanal": kanal_wert}
                    if vorname
                    else {"kanal": kanal_wert}
                ),
                tenant_id=tenant_id,
                # `/portal/buchungen/{id}` gab es in KEINER App — derselbe
                # 404 wie bei der Aufgaben-Meldung oben. Beide Kreise sind
                # Nutzer des PMS (Eigentuemer bzw. Betriebsleitung), ihr
                # Buchungsdetail ist `/reservierungen/{id}`. Ein Pfad genuegt
                # fuer beide: der Rollen-Datensplit §4.2 greift dort
                # serverseitig, die Seite zeigt jedem nur, was er sehen darf.
                ziel_pfad=f"/reservierungen/{reservation_id}",
                property_id=property_id,
                # Wurzel 2: Der Schluessel beschreibt das EREIGNIS, nicht den
                # Versandzeitpunkt. Webhook-Redelivery und Re-Sync erzeugen
                # denselben Schluessel und laufen am UNIQUE-Index auf.
                dedup_key=f"{dedup_praefix}:{kind}:{reservation_id}",
            )
    except Exception as exc:  # noqa: BLE001 — Nebenpfad, darf die Buchung nicht kippen
        log.warning(
            "buchungs_benachrichtigung_fehlgeschlagen",
            reservation_id=reservation_id, kind=kind, error=str(exc)[:200],
        )


def eigentuemer_nutzer_ids(
    db: Client, tenant_id: str, property_id: str
) -> set[str]:
    """Login-Nutzer, die als Eigentuemer dieses Objekts gelten.

    BEIDE Zuordnungswege, weil sie unabhaengig gepflegt werden und
    auseinanderlaufen koennen:
      1. `owner_property_assignments` — der Weg des Portals (Login ↔ Objekt).
      2. `owners.user_id` ueber `owner_properties` — der Weg der Abrechnung
         (Owner-Partei ↔ Objekt). Ein Eigentuemer, der nur hier steht, wuerde
         ueber Weg 1 nie erreicht.
    Beide sind auf den Mandanten gescopt (Wurzel 3). Leere Menge = niemand wird
    benachrichtigt (fail-closed) — kein Ausweichen auf „dann eben die Admins".
    """
    ids: set[str] = set()
    zuordnungen = (
        db.table("owner_property_assignments")
        .select("user_id")
        .eq("tenant_id", tenant_id)
        .eq("property_id", property_id)
        .execute()
    ).data or []
    ids.update(str(r["user_id"]) for r in zuordnungen if r.get("user_id"))

    parteien = (
        db.table("owner_properties")
        .select("owner_id")
        .eq("property_id", property_id)
        .execute()
    ).data or []
    owner_ids = [str(r["owner_id"]) for r in parteien if r.get("owner_id")]
    if owner_ids:
        # Der Tenant-Filter steht hier, nicht bei owner_properties: die
        # Link-Tabelle traegt keine tenant_id (Scope laeuft ueber den Owner).
        besitzer = (
            db.table("owners")
            .select("user_id")
            .eq("tenant_id", tenant_id)
            .in_("id", sorted(owner_ids))
            .execute()
        ).data or []
        ids.update(str(r["user_id"]) for r in besitzer if r.get("user_id"))
    return ids


# --- Helfer -----------------------------------------------------------------


def _titel_wert(titel: str) -> object:
    """Aufgabentitel als Platzhalterwert fuer den Dispatcher.

    Eine Systemvorgabe aus 0330 wird als `Katalogwert` gereicht — der
    Dispatcher uebersetzt sie erst, wenn die Empfaengersprache feststeht.
    Freitext geht als roher String durch: er ist bereits die Sprache dessen,
    der ihn geschrieben hat, und ihn zu „uebersetzen" hiesse, ihn zu
    verfaelschen.
    """
    from .dispatcher import Katalogwert  # noqa: PLC0415 — Zyklus, siehe _dispatcher

    schluessel = _AUFGABEN_SCHLUESSEL.get(titel)
    return Katalogwert(schluessel) if schluessel else titel


def _aufgaben_titel(titel: str, sprache: str) -> str:
    """Katalog-Schluessel → lesbare Bezeichnung in der gewuenschten Sprache.

    Nur fuer die Systemvorgaben aus 0330. Alles andere (Freitext des
    Eigentuemers, eigene Typen des Betriebs, Titel aus Regeln) geht UNVERAENDERT
    durch — es ist bereits Klartext, und ihn zu „uebersetzen" hiesse, den Text
    des Nutzers zu verfaelschen.

    Bewusst hier und nicht in der DB: die DB traegt den stabilen Schluessel
    (das bleibt richtig, die Oberflaeche uebersetzt ihn in 24 Sprachen). Diese
    Zuordnung uebersetzt ihn fuer die Mail, die den Message-Katalog des
    Frontends nicht erreicht.
    """
    schluessel = _AUFGABEN_SCHLUESSEL.get(titel)
    return mail_text(schluessel, sprache) if schluessel else titel


def _objekt_titel(db: Client, tenant_id: str, property_id: str) -> str:
    """Objektname fuer den Betreff — tenant-gescopt (Wurzel 3).

    Ohne Titel bleibt die ID-Kurzform: der Eigentuemer muss erkennen koennen,
    WELCHES seiner Objekte gemeint ist, und ein erfundener Name („Ihr Objekt")
    waere schlechter als die Kennung (Wurzel 4). Dieselbe Notloesung nutzt
    `airbnb_zimmer_push._an_die_glocke`.
    """
    rows = (
        db.table("properties")
        .select("title")
        .eq("id", property_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    titel = (rows[0].get("title") if rows else None) or ""
    return titel.strip() or property_id[:8]


def _gehoert_zum_tenant(db: Client, user_id: str, tenant_id: str) -> bool:
    rows = (
        db.table("users")
        .select("id")
        .eq("id", user_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    return bool(rows)


def _kanal_wert(quelle: str | None, kanal: str | None) -> object:
    """Den Kanal der Buchung als uebersetzbaren ODER woertlichen Wert.

    ZWEI HERKUENFTE, die nicht gleich behandelt werden duerfen:
      * `ota_name` ist der Name, den das PORTAL selbst fuehrt („Airbnb",
        „Expedia"). Eine Marke uebersetzt man nicht, und der Katalog kennt sie
        auch gar nicht — sie geht woertlich hinaus.
      * `channel` ist unser eigener Enum (`ReservationChannel`). Er ist eine
        Systemvorgabe, kein Datum, und muss in der Sprache des Empfaengers
        stehen: `Katalogwert` loest ihn erst im Dispatcher auf, wo die Sprache
        des jeweiligen Eigentuemers feststeht (im Fan-out ueber mehrere
        Eigentuemer kann sie verschieden sein).

    Ein Enum-Wert ohne Katalogeintrag faellt NICHT roh durch (Wurzel 4): dann
    lieber gar keine Kanalzeile als „ota_other" im Postfach. Der Test
    `test_mail_texte` haelt den Katalog vollstaendig; hier steht der Backstop
    fuer einen neu ergaenzten Enum-Wert, den niemand nachgetragen hat.
    """
    from .dispatcher import Katalogwert  # noqa: PLC0415 — Zyklus zur Ladezeit

    if quelle:
        return quelle
    if not kanal:
        return None
    schluessel = f"kanal.{kanal}"
    if schluessel not in MAIL_TEXTE:
        log.warning("buchungs_kanal_ohne_katalogtext", kanal=kanal)
        return None
    return Katalogwert(schluessel)


def _kanal_text(wert: object, sprache: str) -> str | None:
    """Denselben Wert fuer die GLOCKE ausschreiben (Serversprache).

    Die Glocke ist eine gespeicherte Zeile in der Oberflaeche und bekommt
    darum den fertigen Text, nicht den Schluessel — anders als die Mail, die
    das Haus verlaesst.
    """
    from .dispatcher import Katalogwert  # noqa: PLC0415 — Zyklus zur Ladezeit

    if isinstance(wert, Katalogwert):
        return mail_text(wert.schluessel, sprache)
    return str(wert) if wert else None


def _nur_vorname(name: str | None) -> str | None:
    """Erstes Wort — dieselbe Regel wie `guest_masking._first_name_only`.

    Bewusst nicht importiert: dort haengt sie an einer `GuestMask`, die hier
    keinen Sinn ergibt (es gibt keinen anfragenden Nutzer, nur einen
    Empfaenger). Die Regel ist eine Zeile; ein halber Import waere teurer.
    """
    if not name:
        return None
    erstes = name.strip().split(" ")[0].strip()
    return erstes or None


# --- Zustellprobleme (15.08.2026) -------------------------------------------
SCHLUESSEL_ZUSTELLPROBLEM = "zustellproblem"

# Wer im Betrieb erfaehrt, dass eine Gastnachricht haengengeblieben ist.
# Bewusst NUR die Leitung: ein Eigentuemer kann den Tuercode nicht nachtragen,
# und eine Reinigungskraft erst recht nicht. Wer die Meldung nicht beheben
# kann, soll sie auch nicht bekommen (Wurzel 9 — kein Datenausgang an Rollen,
# die ihn nicht brauchen).
_ZUSTELL_ROLLEN = ("admin", "co_admin")


def _betriebsleitung(db: Client, tenant_id: str) -> set[str]:
    """Login-Nutzer der Betriebsleitung. Leere Menge = niemand (fail-closed)."""
    zeilen = (
        db.table("users")
        .select("id")
        .eq("tenant_id", tenant_id)
        .in_("role", list(_ZUSTELL_ROLLEN))
        .execute()
    ).data or []
    return {str(z["id"]) for z in zeilen if z.get("id")}


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
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Versand nie
        log.warning(
            "zustellproblem_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            quelle_id=quelle_id,
            error=str(exc)[:200],
        )


# --- Neue Gastnachricht im Posteingang (0406) -------------------------------

SCHLUESSEL_NACHRICHT = "messages"

# Wer im Betrieb erfaehrt, dass ein Gast geschrieben hat. Wie beim
# Zustellproblem nur die Leitung: eine Reinigungskraft kann auf eine
# Gastanfrage nicht antworten, und der Nachrichtentext gehoert nicht in Rollen,
# die ihn nicht brauchen (Wurzel 9).
_NACHRICHT_ROLLEN = _ZUSTELL_ROLLEN

# Vorschau in der Glocke. Kurz genug, dass die Meldung eine Zeile bleibt, lang
# genug, um zu erkennen, worum es geht.
_VORSCHAU_ZEICHEN = 140


def melde_gastnachricht(
    db: Client,
    *,
    tenant_id: str,
    thread_id: str,
    absender: str | None = None,
    vorschau: str | None = None,
) -> None:
    """„Ein Gast hat geschrieben." — Glocke fuer eine NEUE Gastnachricht.

    WOZU: Die Kategorie `messages` steht seit jeher im Katalog, wurde aber von
    keiner Stelle ausgeloest — die Glocke schwieg zu Nachrichten, und das
    Sidebar-Abzeichen hoerte auf ein Signal, das es nicht gab. Wer nicht
    zufaellig in den Posteingang schaute, erfuhr von einer Gastanfrage nichts.

    NUR ECHTE NEUZUGAENGE: Der Aufrufer entscheidet das
    (`nachrichten_eingang`, Bedingung `sender == "guest" and neu`). Der
    Journal-Tick spiegelt alle fuenf Minuten dasselbe Fenster erneut; ohne
    diese Unterscheidung meldete jede Nachricht im Dauertakt.

    ENTDOPPLUNG ueber den THREAD, nicht die Nachricht: schreibt ein Gast
    dreimal hintereinander, ist das EIN offener Vorgang und gehoert einmal
    gemeldet. Der partielle UNIQUE-Index greift nur auf ungelesene Meldungen —
    hat der Betrieb den Thread gelesen und der Gast schreibt erneut, meldet es
    wieder.

    `thread_ref` traegt den Bezug (0406), damit
    `InboxService.update_thread_flags` die Meldung beim Lesen stilllegen kann.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            return
        dispatcher = _dispatcher(db)
        # Betreff ueber den Katalog, nicht als deutscher Satz an Ort und Stelle:
        # `betreff` ist nur die Fassung fuer die GLOCKE (gespeicherte Zeile,
        # deshalb im Fallback gerendert), `betreff_key`/`betreff_werte` bringen
        # die Mail in die Sprache des Empfaengers. Vorher stand hier Deutsch —
        # ein daenischer Betrieb las „Neue Nachricht von …" ueber einer
        # englischen Gastnachricht.
        schluessel_titel = (
            "benachrichtigung.nachricht_neu"
            if absender
            else "benachrichtigung.nachricht_neu_anonym"
        )
        werte = {"absender": absender} if absender else {}
        titel = mail_text(schluessel_titel, _GLOCKEN_SPRACHE, **werte)
        text = (vorschau or "").strip()[:_VORSCHAU_ZEICHEN]
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_NACHRICHT,
                betreff=titel,
                betreff_key=schluessel_titel,
                betreff_werte=werte,
                text=text,
                tenant_id=tenant_id,
                ziel_pfad=f"/posteingang/{thread_id}",
                thread_ref=thread_id,
                dedup_key=f"nachricht:{thread_id}",
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Eingang nie
        log.warning(
            "gastnachricht_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            thread_id=thread_id,
            error=str(exc)[:200],
        )


# --- Offene Airbnb-Anfrage (0398) -------------------------------------------

SCHLUESSEL_ANFRAGE = "anfrage_offen"

# Die Anfragearten, ueber die gemeldet wird — dieselben drei, die der
# Posteingang als Thread fuehrt. Eine geschlossene Menge, damit ein neues
# Ereignis des Aggregators nicht stillschweigend als „Anfrage" gemeldet wird.
# Katalog-SCHLUESSEL statt deutscher Saetze: der Betreff wird erst uebersetzt,
# wenn die Empfaengersprache feststeht (siehe mail_texte.py).
_ANFRAGE_TITEL = {
    "inquiry": "benachrichtigung.anfrage_voranfrage",
    "reservation_request": "benachrichtigung.anfrage_buchung",
    "alteration_request": "benachrichtigung.anfrage_aenderung",
}


def melde_offene_anfrage(
    db: Client,
    *,
    tenant_id: str,
    thread_id: str,
    art: str,
    property_id: str | None = None,
    objekt: str | None = None,
    zeitraum: str | None = None,
) -> None:
    """„Eine Anfrage wartet auf eine Entscheidung."

    WOZU DIESE MELDUNG ZUSAETZLICH ZUR GASTNACHRICHT:
    Beides sieht in der Glocke aehnlich aus, ist aber fachlich verschieden.
    Eine Gastnachricht kann man morgen beantworten. Eine Anfrage laeuft AB —
    Airbnb lehnt nach der in `non_response_at` genannten Frist selbst ab, und
    die Untaetigkeit ist damit die Antwort. Ausserdem gibt es Anfragen ohne
    jede Nachricht: dann meldet `melde_gastnachricht` gar nichts, und ohne
    diese Meldung erfuehre der Betrieb ueberhaupt nichts von dem Vorgang.

    NUR DIE LEITUNG, wie beim Zustellproblem: eine Reinigungskraft kann eine
    Buchungsanfrage nicht entscheiden, und Preis/Zeitraum gehoeren nicht in
    Rollen, die sie nicht brauchen (Wurzel 9).

    ENTDOPPLUNG ueber den THREAD: Webhook und Live-Feed-Tick liefern dieselbe
    Anfrage zweimal (live nachgemessen), und der Tick wiederholt sein Fenster
    alle fuenf Minuten. Der `dedup_key` beschreibt deshalb den VORGANG, nicht
    den Versandzeitpunkt (Wurzel 2).

    KEINE FRIST IM TEXT: Der Countdown gehoert in die Oberflaeche, die ihn
    fortlaufend neu rechnet. Eine gespeicherte Glockenzeile mit „noch 3
    Stunden" waere morgen eine Falschaussage — sie steht ja unveraendert da.
    """
    try:
        empfaenger = _betriebsleitung(db, tenant_id)
        if not empfaenger:
            return
        titel_key = _ANFRAGE_TITEL.get(art)
        if titel_key is None:
            # Kein erfundener Sammelbegriff: eine unbekannte Art ist ein
            # Hinweis auf neues Portal-Verhalten, das wir sehen wollen.
            log.info("anfrage_meldung_unbekannte_art", art=art)
            return
        text = " · ".join(t for t in (objekt, zeitraum) if t)
        dispatcher = _dispatcher(db)
        for user_id in sorted(empfaenger):
            dispatcher.sende(
                user_id=user_id,
                schluessel=SCHLUESSEL_ANFRAGE,
                betreff=mail_text(titel_key, _GLOCKEN_SPRACHE),
                betreff_key=titel_key,
                text=text,
                tenant_id=tenant_id,
                property_id=property_id,
                # Direkt in den Thread: von dort aus ist die Anfrage in einem
                # Klick entscheidbar.
                ziel_pfad=f"/posteingang/{thread_id}",
                thread_ref=thread_id,
                dedup_key=f"anfrage:{thread_id}",
            )
    except Exception as exc:  # noqa: BLE001 — Meldung kippt den Eingang nie
        log.warning(
            "anfrage_meldung_fehlgeschlagen",
            tenant_id=tenant_id,
            thread_id=thread_id,
            error=str(exc)[:200],
        )
