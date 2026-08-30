"""Die automatische Antwort: planen, abbrechen, senden (0494).

Der Ablauf hat drei Schritte, und die Trennung ist der ganze Punkt:

1. **Planen** (:meth:`KiAutoantwortMixin.autoantwort_planen`) — beim Eingang
   einer Gastnachricht. Hier wird entschieden, ob überhaupt automatisch
   geantwortet wird, und der Text wird ERZEUGT. Die Zeile wartet dann.
2. **Abbrechen** (:meth:`autoantwort_abbrechen`) — sobald etwas passiert, das
   die geplante Antwort überholt: ein Mensch antwortet, oder der Gast schiebt
   nach.
3. **Senden** (:meth:`dispatch_ki_autoantworten`) — ein Tick über alle Betriebe,
   der fällige Zeilen versendet.

**Warum der Text beim PLANEN entsteht und nicht beim Senden.** Zwei Gründe.
Erstens sieht der Betrieb im Protokoll sofort, was hinausgehen wird — bei einer
Erzeugung im Versandmoment stünde bis dahin nur „irgendwas kommt". Zweitens
verschiebt ein Ausfall des KI-Dienstes dann nicht den Versand, sondern
verhindert die Planung: es wartet nie eine leere Zusage in der Schlange.

**Warum überhaupt gewartet wird.** Die fünf Minuten sind kein technischer
Puffer, sondern der Mensch: ein Mitarbeiter soll zuvorkommen können. Genau
deshalb ist das Abräumen (Schritt 2) kein Beiwerk, sondern die Bedingung dafür,
dass die Verzögerung überhaupt etwas bedeutet — ohne sie bekäme der Gast die
Antwort des Menschen UND kurz darauf die der Maschine (Wurzel 1: jede Aktion
hat einen Gegenzustand).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from postgrest.exceptions import APIError
from supabase import Client

from src.core.ki import KiError
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.features.site_config.ki_nutzung import buchen, deckel_pruefen

from .errors import InboxError
from .ki_antwort import FUNKTION, markierungen_trennen, vorschlag_erzeugen
from .schemas import AiSettings, InboxMessage, ReservationDetail

log = get_logger("nextdays.inbox.ki_autoantwort")

# Wie viele Zeilen ein Tick höchstens versendet. Ohne Deckel arbeitet ein Tick
# nach einem längeren Ausfall stundenlang und blockiert den nächsten (Wurzel 8).
MAX_JE_TICK = 50

# Wie lange eine wartende Zeile höchstens gültig bleibt. Eine Antwort, die
# wegen eines Ausfalls sechs Stunden liegen blieb, ist keine Antwort mehr,
# sondern eine Verwirrung — sie wird abgebrochen statt verspätet gesendet.
MAX_VERSPAETUNG_STUNDEN = 2

# Der Unique-Constraint auf die wartenden Zeilen je Thread (0494).
_DOPPELT = "23505"

# Wie viele Nachrichten aus der DB geholt werden. Wie viele davon in den
# Prompt gehen, entscheidet `ki_antwort.MAX_VERLAUF`.
MAX_VERLAUF_DB = 40


class KiAutoantwortMixin:
    """Planen, Abbrechen, Senden der automatischen Antwort. Teil von `InboxService`."""

    _db: Client | None

    # -- 1. Planen -----------------------------------------------------------
    def autoantwort_planen(
        self, tenant_id: str, thread_id: str, *, quelle: str = "inbox"
    ) -> bool:
        """Nach einer eingegangenen GASTNACHRICHT prüfen und ggf. planen.

        Gibt ``True`` zurück, wenn eine Antwort in der Warteschlange steht.

        Der Aufrufer hat bereits sichergestellt, dass die Nachricht vom GAST
        kommt — ohne diese Prüfung antwortete die KI auf die Antwort des
        Gastgebers und auf ihr eigenes Webhook-Echo (derselbe Fehler, den die
        Abwesenheitsantwort schon einmal hatte, siehe `channels.py`).

        Wirft nicht: schlägt etwas fehl, wird geloggt und nichts geplant. Ein
        Fehler in der Autoantwort darf den Nachrichteneingang nicht kippen —
        die Nachricht selbst ist wichtiger als die Antwort darauf.
        """
        if self._db is None:
            return False
        db = self._db
        try:
            return self._planen(db, tenant_id, thread_id, quelle)
        except (APIError, KiError) as exc:
            log.warning(
                "ki_autoantwort_planung_fehlgeschlagen",
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=type(exc).__name__,
                fehler=str(exc)[:300],
            )
            return False

    def _entwurf_protokollieren(  # noqa: PLR0913 — ein Protokolleintrag mit seinen Feldern
        self,
        db: Client,
        tenant_id: str,
        *,
        thread_id: str,
        quelle: str,
        regel: dict | None,
        frage: str,
        text: str,
        vorschlag,  # noqa: ANN001 — Antwortvorschlag, Import wäre zirkulär
        grund: str,
        eskaliert: bool = False,
    ) -> None:
        """Ein NICHT gesendeter Vorschlag ins Protokoll.

        Zwei Wege enden hier — Wissenslücke und Eskalation —, und beide
        schreiben dieselben zwölf Felder. Zweimal ausgeschrieben liefen sie
        auseinander, sobald das Protokoll ein Feld dazubekommt.
        """
        self.protokollieren(
            db,
            tenant_id,
            thread_id=thread_id,
            quelle=quelle,
            regel_id=str(regel["id"]) if regel else None,
            frage=frage,
            antwort=text,
            zustellart="entwurf",
            gesendet=False,
            quellen=vorschlag.quellen,
            weggelassen=vorschlag.kontext.weggelassen,
            grund=grund,
            eskaliert=eskaliert,
            modell=vorschlag.antwort.modell,
            region=vorschlag.antwort.region,
            tokens_ein=vorschlag.antwort.tokens_ein,
            tokens_aus=vorschlag.antwort.tokens_aus,
        )

    def _planen(  # pylint: disable=too-many-return-statements
        self, db: Client, tenant_id: str, thread_id: str, quelle: str
    ) -> bool:
        """Eine automatische Antwort planen. False = es wird nicht gesendet.

        Sieben Ausstiege, und jeder steht für einen anderen fachlichen Grund:
        Schalter aus, kein Thread, keine automatische Regel, negative Stimmung,
        Wissenslücke, schon geplant, geplant. Sie in eine Kette von Flags zu
        verwandeln, hiesse den Grund zu verlieren — und genau der steht
        anschliessend im Protokoll.
        """
        einstellungen = self._ki_einstellungen(db, tenant_id)
        if not einstellungen.get("autoantwort_aktiv"):
            return False

        verlauf, reservierung, prop = self._autoantwort_kontext(
            db, tenant_id, thread_id, quelle
        )
        if verlauf is None:
            return False

        property_id = str(prop["id"]) if prop and prop.get("id") else None
        regeln = self.regeln_fuer_thread(db, tenant_id, property_id)

        # Erst die BILLIGE Entscheidung, dann der teure Aufruf. Die Frage
        # steht schon im Verlauf; sie hier zu lesen kostet nichts, während ein
        # Vertex-Aufruf für eine Antwort, die ohnehin nicht gesendet wird,
        # bezahlt werden müsste.
        frage = next(
            (
                str(m.message).strip()
                for m in reversed(verlauf)
                if m.sender == "guest" and (m.message or "").strip()
            ),
            "",
        )
        zustellart, grund, regel = self.zustellart_entscheiden(
            regeln, frage, autoantwort_aktiv=True
        )
        if zustellart != "automatisch":
            log.info(
                "ki_autoantwort_nicht_automatisch",
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=grund or "keine automatische Regel",
            )
            return False

        deckel_pruefen(db, tenant_id)
        vorschlag = vorschlag_erzeugen(
            db,
            tenant_id,
            prop=prop,
            verlauf=verlauf,
            reservierung=reservierung,
            einstellungen=self._als_ai_settings(einstellungen),
            regeln=regeln,
        )
        buchen(
            db,
            tenant_id,
            # Kein Nutzer: der Auslöser ist die Gastnachricht, nicht ein Klick.
            user_id=None,
            funktion=FUNKTION,
            antwort=vorschlag.antwort,
        )

        # Beide Markierungszeilen trennen. Über EINEN Helfer, nicht per
        # `startswith`: stünde die Stimmungszeile zuerst, hätte ein
        # `startswith("[FEHLENDE ANGABE")` die Wissenslücke übersehen und den
        # Text samt beider Markierungen an den Gast geschickt.
        text, luecke, stimmung = markierungen_trennen(vorschlag.text)

        # Negativer Tenor: markieren, melden — und NICHT senden. Ein Gast, der
        # sich beschwert, bekommt keine Maschinenantwort; das ist der Fall, für
        # den die Eskalation da ist.
        if stimmung:
            self.eskalation_setzen(
                db,
                tenant_id,
                thread_id=thread_id,
                quelle=quelle,
                ausloeser="stimmung",
                grund=stimmung,
                nachricht_auszug=frage,
                property_id=property_id,
                gast_vorname=getattr(reservierung, "guest_name", None),
                # HIER schon: es sitzt niemand davor, und genau das ist der
                # Fall, in dem eine Meldung gebraucht wird.
                benachrichtigen=True,
            )
            self._entwurf_protokollieren(
                db,
                tenant_id,
                thread_id=thread_id,
                quelle=quelle,
                regel=regel,
                frage=frage,
                text=text,
                vorschlag=vorschlag,
                grund=f"Eskaliert: {stimmung}",
                eskaliert=True,
            )
            return False

        # Eine Antwort, die eine fehlende Angabe meldet, geht NICHT automatisch
        # hinaus. Sie ist an den Betrieb gerichtet („das fehlt in eurer
        # Gästemappe"), nicht an den Gast — und dem Gast einen Satz zu
        # schicken, der auf eine Lücke hinweist, wäre schlimmer als gar nichts.
        if luecke:
            self._entwurf_protokollieren(
                db,
                tenant_id,
                thread_id=thread_id,
                quelle=quelle,
                regel=regel,
                frage=frage,
                text=text,
                vorschlag=vorschlag,
                grund=f"Wissenslücke ({luecke}) — als Entwurf hinterlegt",
            )
            return False

        minuten = int(einstellungen.get("autoantwort_verzoegerung_minuten") or 0)
        send_at = datetime.now(UTC) + timedelta(minutes=max(0, minuten))
        try:
            db.table("ki_autoantwort_warteschlange").insert(
                {
                    "tenant_id": tenant_id,
                    "thread_id": thread_id,
                    "quelle": quelle,
                    "regel_id": str(regel["id"]) if regel else None,
                    "frage": frage,
                    # Der gesäuberte Text: die Markierungszeilen sind für den
                    # Betrieb, nie für den Gast.
                    "antwort": text,
                    "send_at": send_at.isoformat(),
                }
            ).execute()
        except APIError as exc:
            if getattr(exc, "code", None) == _DOPPELT:
                # Wurzel 2: der Unique-Index hat gegriffen. Es steht bereits
                # eine Antwort für diesen Thread in der Schlange — das ist kein
                # Fehler, sondern der Normalfall bei einer Webhook-Redelivery.
                log.info(
                    "ki_autoantwort_schon_geplant",
                    tenant_id=tenant_id,
                    thread_id=thread_id,
                )
                return True
            raise

        self.protokollieren(
            db,
            tenant_id,
            thread_id=thread_id,
            quelle=quelle,
            regel_id=str(regel["id"]) if regel else None,
            frage=frage,
            antwort=text,
            zustellart="automatisch",
            # Noch NICHT gesendet: `gesendet_at` setzt der Versand.
            gesendet=False,
            quellen=vorschlag.quellen,
            weggelassen=vorschlag.kontext.weggelassen,
            modell=vorschlag.antwort.modell,
            region=vorschlag.antwort.region,
            tokens_ein=vorschlag.antwort.tokens_ein,
            tokens_aus=vorschlag.antwort.tokens_aus,
        )
        if regel:
            self.regel_verwendet(db, tenant_id, str(regel["id"]))
        log.info(
            "ki_autoantwort_geplant",
            tenant_id=tenant_id,
            thread_id=thread_id,
            send_at=send_at.isoformat(),
            verzoegerung_minuten=minuten,
        )
        return True

    # -- 2. Abbrechen --------------------------------------------------------
    def autoantwort_abbrechen(
        self, tenant_id: str, thread_id: str, grund: str
    ) -> int:
        """Wartende Antwort verwerfen — der Gegenzustand (Wurzel 1).

        Aufzurufen, sobald die geplante Antwort überholt ist: ein Mensch hat
        geantwortet, oder der Gast hat nachgeschoben. Ohne diesen Aufruf ist die
        Verzögerung wertlos — der Gast bekäme beide Antworten.

        Gibt die Zahl der abgebrochenen Zeilen zurück (0 oder 1).
        """
        if self._db is None:
            return 0
        try:
            zeilen = (
                self._db.table("ki_autoantwort_warteschlange")
                .update(
                    {
                        "status": "abgebrochen",
                        "abbruch_grund": grund[:300],
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                )
                .eq("tenant_id", tenant_id)
                .eq("thread_id", thread_id)
                .eq("status", "wartend")
                .execute()
            ).data or []
        except APIError as exc:
            log.warning(
                "ki_autoantwort_abbruch_fehlgeschlagen",
                tenant_id=tenant_id,
                thread_id=thread_id,
                fehler=str(exc)[:300],
            )
            return 0
        if zeilen:
            log.info(
                "ki_autoantwort_abgebrochen",
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=grund,
            )
        return len(zeilen)

    # -- 3. Senden -----------------------------------------------------------
    def dispatch_ki_autoantworten(self) -> dict:
        """Über ALLE Betriebe: fällige wartende Antworten versenden.

        Läuft als Cron-Tick wie `dispatch_due_automations`. Jede Zeile wird
        einzeln behandelt: ein Fehler an einer darf die übrigen nicht aufhalten.
        """
        if self._db is None:
            return {"gesendet": 0, "abgebrochen": 0, "fehler": 0}
        db = self._db
        jetzt = datetime.now(UTC)
        zeilen = (
            db.table("ki_autoantwort_warteschlange")
            .select("*")
            .eq("status", "wartend")
            .lte("send_at", jetzt.isoformat())
            .order("send_at")
            .limit(MAX_JE_TICK)
            .execute()
        ).data or []

        gesendet = abgebrochen = fehler = 0
        for z in zeilen:
            ergebnis = self._eine_senden(db, z, jetzt)
            if ergebnis == "gesendet":
                gesendet += 1
            elif ergebnis == "abgebrochen":
                abgebrochen += 1
            else:
                fehler += 1
        if zeilen:
            log.info(
                "ki_autoantwort_tick",
                geprueft=len(zeilen),
                gesendet=gesendet,
                abgebrochen=abgebrochen,
                fehler=fehler,
            )
        return {"gesendet": gesendet, "abgebrochen": abgebrochen, "fehler": fehler}

    def _eine_senden(self, db: Client, zeile: dict, jetzt: datetime) -> str:
        tenant_id = str(zeile["tenant_id"])
        thread_id = str(zeile["thread_id"])
        zeilen_id = str(zeile["id"])

        # Zu spät? Eine Antwort, die zwei Stunden liegen blieb, verwirrt mehr,
        # als sie hilft — der Gast hat inzwischen anderswo nachgefragt.
        faellig = datetime.fromisoformat(str(zeile["send_at"]))
        if jetzt - faellig > timedelta(hours=MAX_VERSPAETUNG_STUNDEN):
            self._status_setzen(
                db, zeilen_id, "abgebrochen", abbruch_grund="Zu spät (Rückstau)"
            )
            return "abgebrochen"

        # Hat der Thread sich seit der Planung bewegt? Wenn die letzte
        # Nachricht nicht mehr die Frage ist, auf die geantwortet werden
        # sollte, passt die Antwort nicht mehr.
        if self._thread_hat_sich_bewegt(db, tenant_id, zeile):
            self._status_setzen(
                db,
                zeilen_id,
                "abgebrochen",
                abbruch_grund="Thread hat sich seit der Planung geändert",
            )
            return "abgebrochen"

        try:
            self._autoantwort_senden(
                tenant_id, thread_id, str(zeile["quelle"]), str(zeile["antwort"])
            )
        except Exception as exc:  # noqa: BLE001 — eine Zeile darf den Tick nicht kippen
            log.error(
                "ki_autoantwort_versand_fehlgeschlagen",
                tenant_id=tenant_id,
                thread_id=thread_id,
                grund=type(exc).__name__,
                fehler=str(exc)[:300],
            )
            self._status_setzen(
                db, zeilen_id, "fehler", letzter_fehler=str(exc)[:500]
            )
            return "fehler"

        self._status_setzen(db, zeilen_id, "gesendet")
        # Das Protokoll bekommt den Versandzeitpunkt nachgetragen: bis hierher
        # stand dort „geplant", jetzt steht dort „gesendet".
        self._protokoll_gesendet(db, tenant_id, thread_id)
        return "gesendet"

    @staticmethod
    def _status_setzen(
        db: Client,
        zeilen_id: str,
        status: str,
        *,
        abbruch_grund: str | None = None,
        letzter_fehler: str | None = None,
    ) -> None:
        db.table("ki_autoantwort_warteschlange").update(
            {
                "status": status,
                "abbruch_grund": abbruch_grund,
                "letzter_fehler": letzter_fehler,
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", zeilen_id).execute()

    @staticmethod
    def _protokoll_gesendet(db: Client, tenant_id: str, thread_id: str) -> None:
        """Den jüngsten automatischen Protokolleintrag als gesendet markieren."""
        try:
            treffer = (
                db.table("ki_antwort_protokoll")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("thread_id", thread_id)
                .eq("zustellart", "automatisch")
                .is_("gesendet_at", "null")
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            ).data or []
            if treffer:
                db.table("ki_antwort_protokoll").update(
                    {"gesendet_at": datetime.now(UTC).isoformat()}
                ).eq("id", treffer[0]["id"]).execute()
        except APIError as exc:  # best effort — der Versand ist schon passiert
            log.warning(
                "ki_protokoll_versand_nicht_vermerkt",
                tenant_id=tenant_id,
                thread_id=thread_id,
                fehler=str(exc)[:200],
            )

    # -- Hilfen --------------------------------------------------------------
    @staticmethod
    def _ki_einstellungen(db: Client, tenant_id: str) -> dict:
        """Die KI-Einstellungen als rohe Zeile.

        Nicht über `get_ai_settings`: das braucht einen `AuthContext`, den es
        auf dem Cron-/Webhook-Pfad nicht gibt. Fehlt die Zeile, gelten die
        Vorgaben — und die Vorgabe für `autoantwort_aktiv` ist AUS, es passiert
        also nichts (fail-closed, Wurzel 5).
        """
        zeilen = (
            db.table("inbox_ai_settings")
            .select(
                "tone, language, signature, extra_prompt, auto_suggest, "
                "autoantwort_aktiv, autoantwort_verzoegerung_minuten"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data or []
        return zeilen[0] if zeilen else {}

    @staticmethod
    def _als_ai_settings(zeile: dict) -> AiSettings:
        return AiSettings(
            tone=zeile.get("tone") or "freundlich",
            language=zeile.get("language") or "auto",
            signature=zeile.get("signature"),
            extra_prompt=zeile.get("extra_prompt"),
            auto_suggest=bool(zeile.get("auto_suggest", True)),
            autoantwort_aktiv=bool(zeile.get("autoantwort_aktiv", False)),
            autoantwort_verzoegerung_minuten=int(
                zeile.get("autoantwort_verzoegerung_minuten") or 5
            ),
        )

    def _autoantwort_kontext(
        self, db: Client, tenant_id: str, thread_id: str, quelle: str
    ) -> tuple[list[InboxMessage] | None, ReservationDetail, dict | None]:
        """Verlauf, Buchung und Objekt — ohne `AuthContext`.

        Der reguläre Weg (`get_messages`, `get_reservation_detail`) verlangt
        einen eingeloggten Nutzer. Hier gibt es keinen: der Auslöser ist eine
        Gastnachricht. Ein erfundener Kontext wäre der falsche Ausweg — er
        hebelte die Gast-Maske aus, die dort für den Datensplit sorgt.
        Stattdessen wird direkt gelesen, und zwar tenant-gescoped (Wurzel 3).

        Der Datensplit greift hier NICHT und muss es auch nicht: die Antwort
        geht an den GAST, nicht an einen Mitarbeiter mit eingeschränkter Sicht.
        Der Gast kennt seinen eigenen Namen.
        """
        if quelle == "whatsapp":
            return self._kontext_whatsapp(db, tenant_id, thread_id)
        return self._kontext_inbox(db, tenant_id, thread_id)

    def _kontext_inbox(
        self, db: Client, tenant_id: str, thread_id: str
    ) -> tuple[list[InboxMessage] | None, ReservationDetail, dict | None]:
        """Verlauf + Buchung aus dem lokalen Spiegel.

        NICHT `get_messages`/`get_reservation_detail`: beide brauchen einen
        `AuthContext`, und `load_inbox_access` liest die Rechte aus `users`.
        Für den Cron-/Webhook-Pfad gibt es dort keine Zeile — die Prüfung wäre
        fail-closed und blockierte jede automatische Antwort. Ein erfundener
        Nutzer wäre der falsche Ausweg (Wurzel 4).

        Der Spiegel (`portal_messages`, 0305) ist die richtige Quelle: er wird
        bei jedem Eingang geschrieben, ist vollständig und braucht keinen
        Live-Abruf beim Aggregator — was hier ohnehin falsch wäre, denn ein
        Portal-Ausfall darf nicht die Antwort verhindern.
        """
        try:
            th = self._load_thread(db, tenant_id, thread_id)
        except InboxError:
            return None, ReservationDetail(), None
        verlauf = self._spiegel_lesen(db, tenant_id, thread_id)
        prop = self._property_for_thread(db, tenant_id, th)
        # Dieselbe Auflösung wie im Anzeigepfad — `customer` steht teils in der
        # Spalte, teils nur in der rohen OTA-Payload.
        kunde = self._customer_of(th)
        detail = ReservationDetail(
            listing_name=(prop or {}).get("title"),
            address=(prop or {}).get("address"),
            # `_guest_name` statt einer eigenen Zusammensetzung: zwei Kopien
            # derselben Regel laufen auseinander, sobald jemand eine anfasst.
            guest_name=self._guest_name(kunde),
            guest_language=kunde.get("language"),
            status=th.get("status"),
            check_in=str(th["arrival_date"]) if th.get("arrival_date") else None,
            check_out=str(th["departure_date"]) if th.get("departure_date") else None,
            ota_name=th.get("ota_name"),
        )
        return verlauf, detail, prop

    @staticmethod
    def _kontext_whatsapp(
        db: Client, tenant_id: str, conversation_id: str
    ) -> tuple[list[InboxMessage] | None, ReservationDetail, dict | None]:
        from src.features.whatsapp.service import (  # noqa: PLC0415
            WhatsAppService,
        )

        conv = (
            db.table("whatsapp_conversation")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", conversation_id)
            .limit(1)
            .execute()
        ).data or []
        if not conv:
            return None, ReservationDetail(), None
        nachrichten = (
            db.table("whatsapp_message")
            .select("id, direction, body, created_at")
            .eq("tenant_id", tenant_id)
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .limit(MAX_VERLAUF_DB)
            .execute()
        ).data or []
        verlauf = [
            InboxMessage(
                id=str(m.get("id")),
                message=m.get("body") or "",
                sender="guest" if m.get("direction") == "in" else "property",
                sent_at=m.get("created_at"),
            )
            for m in nachrichten
            if (m.get("body") or "").strip()
        ]
        # Dieselbe Auflösung wie im Knopf-Pfad — nicht nachgebaut, sondern
        # aufgerufen (zwei Kopien liefen hier schon einmal auseinander).
        # `_ki_reservierung` ist eine `staticmethod` des WhatsApp-Slices; der
        # Zugriff über die Klasse ist bewusst, eine öffentliche Hülle nur für
        # diesen einen Aufruf wäre Zeremonie ohne Nutzen.
        detail, prop = WhatsAppService._ki_reservierung(  # noqa: SLF001  # pylint: disable=protected-access
            db, tenant_id, conv[0]
        )
        return verlauf, detail, prop

    @staticmethod
    def _thread_hat_sich_bewegt(db: Client, tenant_id: str, zeile: dict) -> bool:
        """Kam seit der Planung eine neue Nachricht?

        Wenn ja, passt die geplante Antwort nicht mehr: entweder hat ein Mensch
        geantwortet (dann wäre die KI-Antwort die zweite), oder der Gast hat
        nachgeschoben (dann beantwortet sie die falsche Frage).

        Fail-closed: kann nicht geprüft werden, wird NICHT gesendet. Eine
        ausbleibende Antwort ist eine Rückfrage, eine doppelte ist peinlich.
        """
        seit = str(zeile["created_at"])
        try:
            if str(zeile["quelle"]) == "whatsapp":
                neuere = (
                    db.table("whatsapp_message")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .eq("conversation_id", str(zeile["thread_id"]))
                    .gt("created_at", seit)
                    .limit(1)
                    .execute()
                ).data or []
            else:
                neuere = (
                    db.table("portal_messages")
                    .select("id")
                    .eq("tenant_id", tenant_id)
                    .eq("thread_id", str(zeile["thread_id"]))
                    .gt("sent_at", seit)
                    .limit(1)
                    .execute()
                ).data or []
        except APIError as exc:
            log.warning(
                "ki_autoantwort_bewegungspruefung_fehlgeschlagen",
                thread_id=zeile.get("thread_id"),
                fehler=str(exc)[:300],
            )
            return True
        return bool(neuere)

    def _autoantwort_senden(
        self, tenant_id: str, thread_id: str, quelle: str, text: str
    ) -> None:
        """Den Text an den Gast schicken — über den regulären Versandweg.

        `quelle="ki"` (0495) ist die EINZIGE Stelle, an der eine KI-Antwort im
        Spiegel von einer Handnachricht oder einer Automail unterscheidbar
        bleibt: das Portal-Echo trägt für alle drei `sender='property'`.
        """
        ctx = AuthContext(user_id="ki", tenant_id=tenant_id)
        if quelle == "whatsapp":
            from src.features.whatsapp.service import (  # noqa: PLC0415
                WhatsAppService,
            )

            # `send` und nicht `send_message`: die WhatsApp-Seite hat eine
            # eigene Versandmethode mit Servicefenster-Prüfung. Läuft die
            # 24-Stunden-Frist ab, wirft sie — und das ist richtig so: außerhalb
            # des Fensters lässt Meta nur Templates zu, und ein stiller
            # Fehlschlag hier wäre eine Antwort, die der Gast nie sieht.
            WhatsAppService(service_client=self._db).send(
                ctx, conversation_id=thread_id, to_phone=None, body=text
            )
            return
        self.send_message(
            ctx, thread_id, text, enforce_reply=False, quelle="ki"
        )
