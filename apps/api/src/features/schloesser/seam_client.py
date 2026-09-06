"""Der Zugang zu Seam — die EINE Stelle, die mit dem Aggregator spricht.

WARUM EIN AGGREGATOR UND NICHT VIER HERSTELLER-APIS: Die Recherche zu der
Kundenanfrage „können wir die igloohome-API einbauen" hat ergeben, dass kein
etabliertes PMS Direktintegrationen baut (Hostaway, Guesty, Lodgify und
Smoobus neue Generation gehen alle über Seam). Der Grund ist nicht
Bequemlichkeit, sondern dass die Hersteller-APIs fachlich gegensätzlich sind:

  igloohome  algoPIN wird OFFLINE erzeugt (kein Netz am Objekt nötig) — dafür
             ist er NICHT widerrufbar; Löschen verlangt Bluetooth-Nähe.
  Nuki       jederzeit widerrufbar, sekundengenaue Zeitfenster — dafür
             zwingend online, und der OAuth-Zugang muss bei Nuki BEANTRAGT
             und freigegeben werden.
  Salto      erzeugt den PIN SELBST (6–10 Ziffern); ein Wunschwert ist
             unmöglich, man liest den Code zurück.
  TTLock     Resource-Owner-Password-Grant mit MD5 — das PMS müsste das
             Kontopasswort des Betriebs halten. Für uns inakzeptabel
             (Wurzel 6/7).

WARUM DAS OFFIZIELLE SDK UND NICHT EIGENES httpx: Erst geprüft, dann
entschieden — und die geprüften Signaturen haben drei Fehler in der ersten,
handgeschriebenen Fassung aufgedeckt, die sonst erst live aufgefallen wären:

  1. Die Gerätetypen heißen NICHT durchgängig `<marke>_lock`. dormakaba ist
     `dormakaba_oracode_door`, KeyNest ist `keynest_key`. Eine Endungsliste
     mit `_lock` hätte beide verfehlt.
  2. `igloo_lock` und `igloohome_lock` sind ZWEI verschiedene Hersteller. Ein
     Präfix-Vergleich hätte sie verwechselt — mit der Folge, dass ein
     Igloo-Gerät als offline-fähig gegolten hätte.
  3. Es gibt `access_grants.update()`. Die erste Fassung legte bei jeder
     Terminänderung einen neuen Grant an, statt den bestehenden zu
     verschieben — bei igloohome hätte das einen der drei täglichen
     PIN-Slots verbraucht.

DER WICHTIGSTE GEWINN: Seam liefert die Fähigkeiten je GERÄT als eigene
Felder (`can_program_offline_access_codes`, `can_remotely_unlock`, …). Die
Widerrufbarkeit muss damit NICHT aus der Marke geraten werden — sie steht in
der Antwort. Jede Marken-Heuristik dazu ist überflüssig und wäre falsch,
sobald ein Hersteller sein Verhalten ändert oder eine Bridge dazukommt.

WAS DIESES MODUL BEWUSST NICHT TUT: Es entscheidet nichts fachlich. Keine
Puffer, keine Zustandsübergänge, kein Storno-Verhalten — das liegt im
Service. Hier stehen nur die Aufrufe und die Übersetzung von Seams
Antwortformen in unsere.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from seam import (
    Seam,
    SeamHttpApiError,
    SeamHttpUnauthorizedError,
    SeamInvalidTokenError,
)

from src.core.logging import get_logger

log = get_logger("nextdays.schloesser.seam")

_ZEITLIMIT = 15.0

# Marken, deren Codes algorithmisch OHNE Verbindung zum Schloss entstehen.
# Dient NUR noch als Rückfall, wenn Seam die Gerätefähigkeiten nicht
# mitliefert — die Wahrheit sind `can_program_offline_access_codes` und
# `can_program_online_access_codes` am Gerät selbst.
#
# Die Werte sind Seams `device_manufacturer`-Kennungen, nachgelesen in der
# SDK-Signatur (nicht geraten): `igloohome` ist NICHT `igloo`, und
# `dormakaba_oracode` trägt kein `_lock`.
_OFFLINE_MARKEN_RUECKFALL = frozenset(
    {"igloohome", "dormakaba_oracode", "lockly"}
)


# Die Anbieter, die WIRKLICH Schlösser sind — aus Seams eigenen Kategorien
# `consumer_smartlocks` und `access_control_systems` gelesen (06.09.2026),
# plus `keynest` (Schlüsselboxen: physische Übergabe, für Altbau und
# Mietwohnungen ohne Umbaurecht — fachlich derselbe Zweck).
#
# BEWUSST NICHT DRIN ist Seams Kategorie `connectors`: `ical`, `lodgify`,
# `hostaway`, `guesty`, `acuity_scheduling`. Das sind fremde PMS und
# Kalenderfeeds. Sie im Webview anzubieten war ein echter Fehler der ersten
# Fassung (dort stand „Ical" zur Auswahl) — wir sind selbst das PMS, und ein
# hier verbundenes Fremdsystem würde Buchungen in unser Türcode-System
# spiegeln, die unsere Buchungstabelle nie gesehen hat.
#
# Die Liste wird per Hand gepflegt und nicht zur Laufzeit von Seam geholt: ein
# Abruf hier hieße, dass eine neue Seam-Kategorie ungefragt in unsere
# Oberfläche wandert. Nachtragen ist eine Zeile; ein Fremd-PMS
# stillschweigend zuzulassen wäre ein Datenproblem.
SCHLOSS_PROVIDER: tuple[str, ...] = (
    "akiles",
    "assa_abloy_credential_service",
    "assa_abloy_vostio",
    "august",
    "brivo",
    "dormakaba_ambiance",
    "dormakaba_community",
    "dormakaba_oracode",
    "dusaw",
    "hotek",
    "igloohome",
    "keyincode",
    "keynest",
    "korelock",
    "kwikset",
    "latch",
    "legic_connect",
    "lockly",
    "nuki",
    "salto_ks",
    "salto_space",
    "schlage",
    "sifely",
    "smartthings",
    "tedee",
    "thirty_three_lock",
    "ttlock",
    "ultraloq",
    "visionline",
    "wyze",
    "yacan",
    "yale",
)


class SeamFehler(Exception):
    """Ein Aufruf an Seam ist fehlgeschlagen.

    `status_code` ist der Status, den WIR nach außen geben — nicht zwingend
    der von Seam. Ein Ratelimit ist für unseren Aufrufer ein 503 („später
    erneut"), eine abgelehnte Nutzlast ein 422.
    """

    def __init__(self, nachricht: str, status_code: int = 502) -> None:
        self.status_code = status_code
        super().__init__(nachricht)


class SeamNichtKonfiguriert(SeamFehler):
    """`SEAM_API_KEY` fehlt oder hat ein ungültiges Format.

    EIGENE KLASSE, damit der Aufrufer sie von einem Netzfehler unterscheiden
    kann. Ein Konfigurationsmangel, der aussieht wie ein transienter Fehler,
    wird nie behoben — genau die Lehre aus der Mail-Variablen-Drift zwischen
    api und worker (25.08.2026): dort fiel ein Mail-Button ohne
    `APP_BASE_URL` weg, ohne eine Zeile Log, und aufgefallen ist es dem Auge
    einer Kundin.
    """

    def __init__(self, grund: str = "ist nicht gesetzt") -> None:
        super().__init__(
            f"SEAM_API_KEY {grund} — Schloss-Funktionen sind deshalb aus. "
            "Die Variable gehoert in BEIDE Coolify-Anwendungen (api UND "
            "worker), sonst laufen die Worker-Ticks stumm ins Leere.",
            status_code=503,
        )


@dataclass(frozen=True)
class SeamGeraet:
    """Ein Gerät, wie Seam es beschreibt — auf das reduziert, was wir führen.

    `kann_widerrufen` und `ist_offline_faehig` sind die zwei Felder, um die es
    eigentlich geht: sie entscheiden, ob unsere Oberfläche einen Widerruf
    versprechen darf. Beides kommt aus Seams Gerätefähigkeiten, nicht aus der
    Marke — igloohome MIT Bridge kann widerrufen, OHNE Bridge nicht, und das
    ist derselbe Hersteller.
    """

    device_id: str
    name: str | None
    marke: str | None
    online: bool | None
    batterie: float | None
    kann_widerrufen: bool | None
    ist_offline_faehig: bool
    zeitraster: str | None
    kapazitaet_gesamt: int | None
    kapazitaet_belegt: int | None


@dataclass(frozen=True)
class SeamZugang:
    """Ein Access Grant, wie Seam ihn zurückgibt."""

    grant_id: str
    code: str | None
    status: str | None


class SeamClient:
    """Aufrufe an Seam über das offizielle SDK."""

    def __init__(self, api_key: str | None) -> None:
        # Absichtlich KEIN Fallback auf einen Testschlüssel: fehlt der
        # Schlüssel, muss der Aufruf klar fehlschlagen (Wurzel 4).
        self._api_key = (api_key or "").strip() or None
        self._seam: Seam | None = None

    @property
    def konfiguriert(self) -> bool:
        return self._api_key is not None

    def _client(self) -> Seam:
        """Den SDK-Client bauen (einmal je Instanz).

        Das SDK prüft das Schlüsselformat selbst und wirft
        `SeamInvalidTokenError`. Das wird hier in unsere
        Konfigurations-Fehlerklasse übersetzt, damit ein vertippter Schlüssel
        dieselbe klare Meldung erzeugt wie ein fehlender — beides ist
        Konfiguration, nicht Laufzeit.
        """
        if self._api_key is None:
            raise SeamNichtKonfiguriert
        if self._seam is None:
            try:
                self._seam = Seam(api_key=self._api_key, timeout=_ZEITLIMIT)
            except SeamInvalidTokenError as exc:
                raise SeamNichtKonfiguriert(
                    "hat kein gueltiges Format (erwartet wird ein Wert, der "
                    "mit `seam_` beginnt)"
                ) from exc
        return self._seam

    @staticmethod
    def _uebersetzen(exc: Exception) -> SeamFehler:
        """Eine SDK-Ausnahme in unseren Fehler mit passendem Status.

        SPEZIFISCH nach Typ (Wurzel 5) — kein pauschaler 500, der einen
        Konfigurationsmangel wie eine Störung aussehen lässt.
        """
        if isinstance(exc, SeamHttpUnauthorizedError):
            return SeamFehler(
                "Seam hat den API-Schluessel abgelehnt. Schluessel pruefen "
                "bzw. in Seam neu erzeugen.",
                status_code=503,
            )
        if isinstance(exc, SeamHttpApiError):
            status = getattr(exc, "status_code", None) or 502
            if status == 429:
                return SeamFehler(
                    "Zu viele Anfragen an den Schloss-Dienst — "
                    "bitte kurz warten.",
                    status_code=503,
                )
            if status in (400, 422):
                # 4xx heisst: unsere Nutzlast war falsch. Als 422 nach aussen,
                # damit der Klartext beim Kunden ankommt statt eines 500.
                return SeamFehler(
                    f"Der Schloss-Dienst hat die Anfrage abgelehnt: {exc}",
                    status_code=422,
                )
            if status >= 500:
                return SeamFehler(
                    "Der Schloss-Dienst ist gerade nicht erreichbar — "
                    "bitte spaeter erneut versuchen.",
                    status_code=503,
                )
            return SeamFehler(
                f"Der Schloss-Dienst meldet einen Fehler ({status}): {exc}",
                status_code=502,
            )
        return SeamFehler(
            "Der Schloss-Dienst ist gerade nicht erreichbar — "
            "bitte spaeter erneut versuchen.",
            status_code=503,
        )

    # -- Diagnose ----------------------------------------------------------
    def workspace_pruefen(self) -> dict[str, Any]:
        """Prüft, ob der Schlüssel funktioniert — ohne ein Gerät anzufassen.

        Der billigste echte Aufruf, den es gibt: er liest den Workspace und
        verrät zugleich, ob es ein Sandbox- oder ein Produktions-Workspace
        ist. Genau die Frage, die man beim Einrichten hat und die man sonst
        nur beantwortet, indem man etwas schreibt.
        """
        try:
            arbeitsbereich = self._client().workspaces.get()
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        return {
            "workspaceId": getattr(arbeitsbereich, "workspace_id", None),
            "name": getattr(arbeitsbereich, "name", None),
            "istSandbox": getattr(arbeitsbereich, "is_sandbox", None),
        }

    # -- Verbinden ---------------------------------------------------------
    def webview_erzeugen(self, rueckkehr_url: str) -> dict[str, Any]:
        """Ein Connect Webview: die Anmeldemaske des HERSTELLERS.

        Der Kunde meldet sich dort bei seinem eigenen Schloss-Konto an; Seam
        übernimmt Zugangsdatenprüfung, MFA und Fehlerbehandlung je Marke. Wir
        sehen das Passwort nie — der Grund, warum dieser Weg dem Eintragen
        von `client_id`/`client_secret` in ein Formular bei uns vorzuziehen
        ist (kein etabliertes PMS macht das in der eigenen Oberfläche, und es
        würde Herstellergeheimnisse in unsere DB verlagern).

        DIE PROVIDER-LISTE IST EXPLIZIT, und das ist der Kern dieser Methode.
        `accepted_capabilities=["lock"]` genügt NICHT: Seam führt in seiner
        Provider-Liste auch die Kategorie `connectors` — `ical`, `lodgify`,
        `hostaway`, `guesty`, `acuity_scheduling`. Das sind Kalender- und
        PMS-Anbindungen, keine Schlösser, und die Capability filtert sie nicht
        aus. Live passiert (06.09.2026): im Webview stand „Ical" als wählbarer
        Anbieter.

        Für uns wären diese Anbieter nicht nur nutzlos, sondern schädlich: wir
        SIND das PMS. Ein Betrieb, der dort Lodgify oder Guesty verbindet,
        spiegelt Buchungen aus einem Konkurrenzsystem in unser Türcode-System
        — mit Zuständen, die unsere Buchungstabelle nie gesehen hat.

        Deshalb werden die beiden Kategorien mit Schlössern namentlich
        aufgeführt (`SCHLOSS_PROVIDER`, aus Seams eigener Kategorisierung
        gelesen, nicht geraten). Eine neue Marke fehlt dann zunächst — das ist
        der richtige Fehler: lieber ein Anbieter zu wenig als ein
        Fremd-PMS zu viel.
        """
        try:
            webview = self._client().connect_webviews.create(
                accepted_providers=list(SCHLOSS_PROVIDER),
                custom_redirect_url=rueckkehr_url,
                custom_redirect_failure_url=rueckkehr_url,
                # Neue Geräte sofort verwaltbar — sonst müsste der Kunde
                # nach dem Verbinden noch einen zweiten Schritt machen, und
                # ein „verbunden, aber nichts passiert" ist der häufigste
                # Supportfall dieser Anbieter.
                automatically_manage_new_devices=True,
            )
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        url = getattr(webview, "url", None)
        if not url:
            raise SeamFehler(
                "Seam hat keine Anmelde-Adresse zurueckgegeben.",
                status_code=502,
            )
        return {
            "url": str(url),
            "webview_id": getattr(webview, "connect_webview_id", None),
        }

    def webview_lesen(self, webview_id: str) -> dict[str, Any]:
        """Zustand eines Webviews — hat der Kunde die Anmeldung abgeschlossen?"""
        try:
            webview = self._client().connect_webviews.get(
                connect_webview_id=webview_id
            )
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        return {
            "connected_account_id": getattr(
                webview, "connected_account_id", None
            ),
            "status": getattr(webview, "status", None),
            "accepted_provider": getattr(webview, "accepted_provider", None),
        }

    # -- Geräte ------------------------------------------------------------
    def geraete_lesen(self, connected_account_id: str) -> list[SeamGeraet]:
        """Die Geräte eines verbundenen Kontos, auf unser Modell übersetzt."""
        try:
            geraete = self._client().devices.list(
                connected_account_id=connected_account_id
            )
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        return [
            self._geraet_uebersetzen(g)
            for g in geraete
            if getattr(g, "device_id", None)
        ]

    @classmethod
    def _geraet_uebersetzen(cls, roh: Any) -> SeamGeraet:  # noqa: ANN401
        """Ein Seam-Gerät in unser `SeamGeraet`.

        DIE FÄHIGKEITEN KOMMEN AUS SEAMS FELDERN, nicht aus der Marke:
        `can_program_offline_access_codes` sagt, ob das Gerät mit
        algorithmischen Offline-Codes arbeitet;
        `can_program_online_access_codes` sagt, ob es Codes über die Cloud
        annimmt (und damit auch wieder entziehen kann). Nur wenn Seam beides
        nicht liefert, wird auf die Markenliste zurückgefallen.

        Fehlt eine Angabe, bleibt das Feld `None`: „unbekannt" ist eine
        gültige Antwort, und die Oberfläche muss sie aushalten, statt einen
        plausiblen Wert anzunehmen (Wurzel 4).

        `roh` ist absichtlich `Any`: das SDK liefert je Gerätetyp eine andere
        Modellklasse, und ein enger Typ hier würde bei einem neuen Gerätetyp
        brechen, statt die gemeinsamen Felder zu lesen.
        """
        eigenschaften = cls._als_dict(getattr(roh, "properties", None))
        marke = cls._marke(roh)
        offline = getattr(roh, "can_program_offline_access_codes", None)
        online_codes = getattr(roh, "can_program_online_access_codes", None)

        # Offline-fähig: Seams Feld gewinnt, die Markenliste ist nur Rückfall.
        if offline is not None:
            offline_faehig = bool(offline)
        else:
            offline_faehig = marke in _OFFLINE_MARKEN_RUECKFALL

        return SeamGeraet(
            device_id=str(roh.device_id),
            name=(
                getattr(roh, "display_name", None)
                or getattr(roh, "nickname", None)
                or eigenschaften.get("name")
            ),
            marke=marke,
            online=eigenschaften.get("online"),
            batterie=cls._batterie(eigenschaften),
            kann_widerrufen=cls._kann_widerrufen(
                offline_faehig, online_codes, eigenschaften
            ),
            ist_offline_faehig=offline_faehig,
            zeitraster=cls._zeitraster(marke),
            kapazitaet_gesamt=cls._kapazitaet_gesamt(marke),
            kapazitaet_belegt=None,  # kommt aus unserer eigenen Zählung
        )

    @staticmethod
    def _kann_widerrufen(
        offline_faehig: bool,
        online_codes: bool | None,
        eigenschaften: dict[str, Any],
    ) -> bool | None:
        """Kann ein Code an DIESEM Gerät zurückgezogen werden?

        Die Reihenfolge ist die Logik der Sache:

        * Kein Offline-Gerät -> der Code lebt in der Cloud, Widerruf geht.
        * Offline-Gerät, das ZUSÄTZLICH Online-Codes kann -> es hängt eine
          Bridge dran, also geht es auch. Genau der Fall „igloohome mit
          Bridge", der beweist, warum das keine Markenfrage ist.
        * Offline-Gerät ohne Online-Codes, aber laut Seam online -> Bridge
          vermutlich vorhanden; wir sagen trotzdem NICHTS Sicheres, weil
          `online` auch ein kurzer Bluetooth-Sync sein kann. `None`.
        * Sonst -> `False`: der algoPIN läuft bis zum Ablauf, Punkt.
        """
        if not offline_faehig:
            return True
        if online_codes is True:
            return True
        if eigenschaften.get("online") is True:
            return None
        return False

    @staticmethod
    def _als_dict(wert: Any) -> dict[str, Any]:  # noqa: ANN401
        """Seams `properties` als dict — egal ob Modell oder Mapping.

        Das SDK gibt je Gerätetyp teils ein typisiertes Objekt zurück; ein
        `dict(...)` darauf wirft. Deshalb erst nach den bekannten
        Umwandlungen fragen und im Zweifel ein leeres dict — ein fehlendes
        Feld ist „unbekannt", kein Fehler.
        """
        if wert is None:
            return {}
        if isinstance(wert, dict):
            return wert
        for name in ("to_dict", "model_dump", "dict"):
            wandler = getattr(wert, name, None)
            if callable(wandler):
                try:
                    ergebnis = wandler()
                except (TypeError, ValueError):
                    continue
                if isinstance(ergebnis, dict):
                    return ergebnis
        return {
            k: v
            for k, v in vars(wert).items()
            if not k.startswith("_")
        } if hasattr(wert, "__dict__") else {}

    @staticmethod
    def _marke(roh: Any) -> str | None:  # noqa: ANN401
        """Die Marke, wie Seam sie nennt (`igloohome`, `nuki`, …).

        `device_manufacturer` ist die richtige Quelle — sie trägt genau die
        Kennung, gegen die die Rückfall-Liste prüft. Der `device_type` wäre
        die falsche: er heißt `igloohome_lock`, aber `dormakaba_oracode_door`
        und `keynest_key`, und ein Zerlegen nach Endungen hätte zwei von drei
        verfehlt.
        """
        hersteller = getattr(roh, "device_manufacturer", None)
        if hersteller:
            return str(hersteller).lower()
        anbieter = getattr(roh, "device_provider", None)
        name = getattr(anbieter, "device_provider_name", None) if anbieter else None
        return str(name).lower() if name else None

    @staticmethod
    def _batterie(eigenschaften: dict[str, Any]) -> float | None:
        """Batteriestand als Anteil 0..1.

        Seam meldet ihn je Marke als `battery_level` (0..1) oder verschachtelt
        unter `battery.level`. Kein Default: fehlt der Wert, ist er unbekannt.
        Ein Wert außerhalb 0..1 gilt als unbrauchbar (manche Anbieter senden
        Prozent) — dann `None` statt einer Zahl, die 100-fach falsch wäre.
        """
        wert = eigenschaften.get("battery_level")
        if wert is None:
            batterie = eigenschaften.get("battery")
            if isinstance(batterie, dict):
                wert = batterie.get("level")
        if wert is None:
            return None
        try:
            zahl = float(wert)
        except (TypeError, ValueError):
            return None
        return zahl if 0.0 <= zahl <= 1.0 else None

    @staticmethod
    def _zeitraster(marke: str | None) -> str | None:
        """Wie fein die Marke Zeitfenster annimmt.

        igloohome nimmt nur ganze Stunden — Check-in wird deshalb ABGERUNDET
        und Check-out AUFGERUNDET, damit der Code nie kürzer gilt als der
        Aufenthalt (so macht es Smoobu auch). Alles andere gilt als frei;
        Seam normalisiert die Zeiten selbst, wenn eine Marke gröber ist.
        """
        if marke == "igloohome":
            return "hour"
        return "free" if marke else None

    @staticmethod
    def _kapazitaet_gesamt(marke: str | None) -> int | None:
        """Wie viele Codes ein Schloss dieser Marke fasst.

        Belegt: igloohome 199 (online und offline zusammen). Nuki hängt von
        der Schloss-Generation ab (100 bei Smart Lock 1/2, 200 ab 3) — das
        kann diese Ebene nicht unterscheiden, deshalb `None` („unbekannt")
        statt der optimistischen 200. Ein zu hoher Wert wäre schlimmer als
        keiner: er verspricht Platz, den es nicht gibt.
        """
        return 199 if marke == "igloohome" else None

    # -- Zugänge -----------------------------------------------------------
    def zugang_anlegen(
        self,
        *,
        geraete_ids: list[str],
        beginn_iso: str,
        ende_iso: str,
        reservation_key: str,
        name: str,
    ) -> SeamZugang:
        """Einen Access Grant anlegen — ein Zugang für alle Geräte der Buchung.

        `reservation_key` ist unser Idempotenz-Anker (Wurzel 2): derselbe
        Schlüssel findet denselben Grant wieder, statt bei einem Retry einen
        zweiten anzulegen. Bei igloohome wäre ein zweiter Grant besonders
        teuer, weil dort nur DREI PINs je Tag erzeugt werden können und auch
        stornierte davon einen verbrauchen.
        """
        try:
            grant = self._client().access_grants.create(
                device_ids=geraete_ids,
                starts_at=beginn_iso,
                ends_at=ende_iso,
                reservation_key=reservation_key,
                requested_access_methods=[{"mode": "code"}],
                user_identity={"full_name": name},
            )
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        grant_id = getattr(grant, "access_grant_id", None)
        if not grant_id:
            raise SeamFehler(
                "Seam hat keinen Zugang zurueckgegeben.", status_code=502
            )
        return SeamZugang(
            grant_id=str(grant_id),
            code=self._code_aus_grant(grant),
            status=getattr(grant, "display_status", None),
        )

    def zugang_lesen(self, grant_id: str) -> SeamZugang:
        """Einen Grant nachlesen — der Weg zum Code bei Salto und algoPIN.

        Bei diesen Marken erzeugt das SCHLOSSSYSTEM den Wert; er ist erst
        nach dem Anlegen bekannt. Wer den Code selbst würfelt und sofort in
        die Anreisemail schreibt, verschickt dort einen falschen Code.
        """
        try:
            grant = self._client().access_grants.get(access_grant_id=grant_id)
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc
        return SeamZugang(
            grant_id=grant_id,
            code=self._code_aus_grant(grant),
            status=getattr(grant, "display_status", None),
        )

    def zugang_verschieben(
        self, grant_id: str, *, beginn_iso: str, ende_iso: str
    ) -> None:
        """Den Zeitraum eines bestehenden Grants ändern.

        DER RICHTIGE WEG BEI EINER TERMINÄNDERUNG — und der Grund, warum das
        SDK die handgeschriebene Fassung geschlagen hat: dort wurde ein NEUER
        Grant geplant, was bei igloohome einen der drei täglichen PIN-Slots
        verbraucht hätte. Seam verschiebt stattdessen den vorhandenen und
        materialisiert die Codes selbst neu.

        Bei einem Offline-Code kann Seam den ausgegebenen PIN nicht ändern —
        das entscheidet der Service anhand von `seam_device.can_revoke`,
        bevor er hier landet.
        """
        try:
            self._client().access_grants.update(
                access_grant_id=grant_id,
                starts_at=beginn_iso,
                ends_at=ende_iso,
            )
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc

    def zugang_widerrufen(self, grant_id: str) -> None:
        """Einen Grant zurückziehen.

        WICHTIG: Ein Erfolg hier heisst NICHT, dass der Code am Schloss weg
        ist. Bei Offline-Codes (algoPIN) ist er physikalisch nicht
        entziehbar, und selbst bei Online-Schlössern wird die Löschung erst
        wirksam, wenn das Gerät sie abholt. Den Unterschied fuehrt der
        Service anhand von `seam_device.can_revoke` — hier wird nur
        aufgerufen.
        """
        try:
            self._client().access_grants.delete(access_grant_id=grant_id)
        except SeamNichtKonfiguriert:
            raise
        except Exception as exc:  # noqa: BLE001 - in unseren Fehler übersetzt
            raise self._uebersetzen(exc) from exc

    @classmethod
    def _code_aus_grant(cls, grant: Any) -> str | None:  # noqa: ANN401
        """Den PIN aus einem Grant ziehen.

        Ein Grant trägt die tatsächlichen Zugangsmittel als `access_methods`;
        der Code steht dort je Marke als `code` oder `pin`. Fehlt er, ist er
        noch nicht erzeugt — dann `None`, NIE ein Platzhalter (Wurzel 4).
        """
        for methode in getattr(grant, "access_methods", None) or []:
            werte = cls._als_dict(methode) if not isinstance(
                methode, dict
            ) else methode
            wert = werte.get("code") or werte.get("pin")
            if wert:
                return str(wert)
        return None
