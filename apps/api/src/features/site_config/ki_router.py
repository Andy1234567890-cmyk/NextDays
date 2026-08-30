"""Die KI-Endpunkte des Website-Baukastens (`/api/v1/site-config/ki/...`).

Eigener Router und nicht sechs weitere Funktionen in ``router.py``: der ist bei
über 1200 Zeilen, und `pylint` zieht hier bei 1500. Der Schnitt ist aber nicht
nur eine Zeilenzählung — diese Endpunkte teilen sich alle denselben Ablauf, und
der steht genau einmal in :func:`_ausfuehren`:

    Berechtigung → Tenant → Deckel prüfen → Profil laden → Modell aufrufen →
    buchen → antworten

Jeder einzelne Schritt ist eine Stelle, an der bisher etwas schiefging:
* Berechtigung: ``get_current_user`` (authentifiziert) statt
  ``require_permission`` (autorisiert) wäre der Fehler aus Wurzel 9.
* Tenant: ein Aufruf ohne Tenant-Scope zöge Objekte fremder Betriebe in den
  Prompt (Wurzel 3).
* Deckel: VOR dem Aufruf, sonst schützt er nichts.
* Buchen: auch bei Fehlern, sonst hat die Diagnose nichts.

**Alle Schreib-Endpunkte hier sind lesend im Sinn der Website**: sie erzeugen
Text und geben ihn zurück, sie speichern ihn NICHT. Gespeichert wird über die
bestehenden Endpunkte des Baukastens, und dabei setzt der Client die Herkunft
mit — über ``POST /site-config/ki/herkunft``. Das ist Absicht: der Betrieb soll
einen Vorschlag sehen und verwerfen dürfen, ohne dass er schon in seiner
Website steht.

Zwei Ausnahmen, die WIRKLICH schreiben: ``/ki/profil`` (die Haltung des
Betriebs) und ``/ki/freigabe`` (der Freigabe-Nachweis).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from supabase import Client

from src.core.config import get_settings
from src.core.ki import KiError, VertexClient
from src.core.languages import sprach_name
from src.core.logging import get_logger
from src.core.security import AuthContext
from src.core.supabase import get_service_client
from src.features.auth.dependencies import require_permission
from src.features.auth.permissions import Capability

from . import ki_bild, ki_herkunft, ki_nutzung, ki_texte, seiten_uebersetzung
from .fehler import SiteConfigError
from .ki_profil import KiProfil, profil_lesen, profil_speichern

log = get_logger("nextdays.site_config.ki_router")

_MANAGE = require_permission(  # noqa: N816  pylint: disable=invalid-name
    Capability.MANAGE_SITE_CONFIG
)

ki_router = APIRouter(prefix="/site-config/ki", tags=["site_config_ki"])


def _tenant(ctx: AuthContext) -> str:
    """Ohne Tenant kein Aufruf. Fail-closed (Wurzel 3): ein Prompt ohne
    Tenant-Scope hätte keine Grenze, aus wessen Daten er sich bedient."""
    if not ctx.tenant_id:
        raise HTTPException(status_code=403, detail="Kein Betrieb im Token.")
    return ctx.tenant_id


class KiStatus(BaseModel):
    """Was die Oberfläche wissen muss, BEVOR sie einen Knopf zeigt.

    ``verfuegbar=False`` heißt: die Anbindung ist nicht eingerichtet. Die UI
    blendet die KI-Funktionen dann GAR NICHT ein, statt einen Knopf zu zeigen,
    der beim Klicken 503 antwortet. Das ist die Anforderung „fehlt die
    Umgebungsvariable → Funktion erscheint nicht, statt zu crashen".
    """

    verfuegbar: bool
    modell: str | None = None
    region: str | None = None
    verbrauch_heute: int = 0
    tageslimit: int = 0
    # Hat der Betrieb schon eine Haltung hinterlegt? Entscheidet, ob die UI
    # den Profil-Vorschlag anbietet.
    profil_gepflegt: bool = False


class HerkunftRequest(BaseModel):
    """Die Herkunft an einer gespeicherten Zeile setzen.

    Warum das der Client schickt und nicht der Erzeugungs-Endpunkt selbst
    setzt: zwischen „Text erzeugen“ und „Text übernehmen“ liegt eine
    Entscheidung des Menschen. Wer den Vorschlag verwirft, hat nichts erzeugt,
    was zu kennzeichnen wäre.

    Welche Herkunft gesetzt werden darf, entscheidet trotzdem NICHT der Client
    allein: die Erzeugungs-Endpunkte geben ``herkunft`` in ihrer Antwort mit,
    und die UI reicht genau diesen Wert durch. Ein Client, der hier
    ``ai_rewritten`` schickt, obwohl er erzeugen ließ, kann das — aber er
    umgeht damit die Freigabe seines EIGENEN Betriebs, nicht eine Prüfung, die
    einen Dritten schützt. Der Rechtsadressat ist derselbe.
    """

    tabelle: str = Field(pattern="^(site_pages|site_blocks)$")
    zeilen_id: str = Field(min_length=1, max_length=64)
    herkunft: ki_herkunft.Herkunft
    modell: str | None = Field(default=None, max_length=100)


class FreigabeRequest(BaseModel):
    tabelle: str = Field(pattern="^(site_pages|site_blocks)$")
    zeilen_id: str = Field(min_length=1, max_length=64)


class AltTextHerkunftRequest(BaseModel):
    medium_id: str = Field(min_length=1, max_length=64)
    herkunft: ki_herkunft.Herkunft


def _client() -> VertexClient:
    return VertexClient()


def _db() -> Client:
    return get_service_client()


@ki_router.get("/status", response_model=KiStatus)
def status(ctx: Annotated[AuthContext, Depends(_MANAGE)]) -> KiStatus:
    """Ist der Assistent eingerichtet, und wie viel ist heute schon verbraucht?

    Der einzige Endpunkt hier, der auch ohne Konfiguration antwortet — er ist
    ja gerade die Auskunft darüber.
    """
    tenant_id = _tenant(ctx)
    client = _client()
    db = _db()
    if not client.is_configured:
        log.info("ki_nicht_eingerichtet", tenant_id=tenant_id)
        return KiStatus(verfuegbar=False)
    profil = profil_lesen(db, tenant_id)
    return KiStatus(
        verfuegbar=True,
        modell=client.modell,
        region=client.region,
        verbrauch_heute=ki_nutzung.verbrauch_heute(db, tenant_id),
        tageslimit=ki_nutzung.tageslimit(),
        profil_gepflegt=bool(
            profil.ton or profil.zielgruppe or profil.alleinstellung
        ),
    )


def _ausfuehren(ctx: AuthContext, funktion: str, arbeit):  # noqa: ANN001, ANN202
    """Der gemeinsame Ablauf jedes KI-Endpunkts.

    ``arbeit`` bekommt (client, db, tenant_id, profil) und gibt
    ``(nutzlast, antwort, warnungen)`` zurück. Alles davor und danach steht
    hier — genau einmal.

    Die Fehlerbehandlung ist der Grund für diese Klammer: ein fehlgeschlagener
    Aufruf muss GEBUCHT werden, sonst steht in der Diagnose nichts, wenn ein
    Betrieb meldet „die KI geht nicht“. Ein `try/except` je Endpunkt wäre
    sechsmal dieselbe Stelle, an der man es vergessen kann.
    """
    tenant_id = _tenant(ctx)
    client = _client()
    db = _db()
    if not client.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Der KI-Assistent ist für dieses System nicht eingerichtet.",
        )
    try:
        ki_nutzung.deckel_pruefen(db, tenant_id)
        profil = profil_lesen(db, tenant_id)
        nutzlast, antwort, warnungen = arbeit(client, db, tenant_id, profil)
    except KiError as exc:
        # 429 vom Tagesdeckel NICHT als fehlgeschlagenen Aufruf buchen: es
        # wurde nichts aufgerufen. Alles andere schon — das ist der Fall, den
        # die Diagnose später sucht.
        if exc.status_code != 429:
            ki_nutzung.fehler_buchen(
                db,
                tenant_id,
                user_id=ctx.user_id,
                funktion=funktion,
                modell=client.modell,
                region=client.region,
                grund=exc.message,
            )
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except SiteConfigError as exc:
        # Fachliche Ablehnung (keine Objekte, unbekannte Sprache, leere Seite).
        # Kein Modellaufruf passiert, also auch keine Buchung.
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    ki_nutzung.buchen(
        db, tenant_id, user_id=ctx.user_id, funktion=funktion, antwort=antwort
    )
    return nutzlast, antwort, warnungen, db, tenant_id


def _zaehler(db: Client, tenant_id: str) -> tuple[int, int]:
    return ki_nutzung.verbrauch_heute(db, tenant_id), ki_nutzung.tageslimit()


@ki_router.post("/umschreiben", response_model=ki_texte.TextAntwort)
def umschreiben(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: ki_texte.UmschreibenRequest,
) -> ki_texte.TextAntwort:
    """Markierten Text bearbeiten: Kürzen, Verlängern, Ton, Rechtschreibung,
    Übersetzen.

    Ergebnis trägt IMMER ``ai_rewritten`` — assistierende Bearbeitung nach
    Erwägungsgrund 133, keine Kennzeichnungspflicht, keine Freigabe. Der
    dezente Hinweis im Editor genügt.
    """
    text, antwort, warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "umschreiben",
        lambda client, db, tenant_id, profil: ki_texte.umschreiben(
            client, body, profil
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    return ki_texte.TextAntwort(
        text=text,
        herkunft=ki_herkunft.Herkunft.ai_rewritten,
        modell=antwort.modell,
        region=antwort.region,
        warnungen=warnungen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


@ki_router.post("/seo", response_model=ki_texte.SeoAntwort)
def seo(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: ki_texte.SeoRequest
) -> ki_texte.SeoAntwort:
    """Meta-Titel und -Beschreibung aus dem tatsächlichen Seiteninhalt.

    KEINE Kennzeichnung: Suchmaschinen-Angaben sind keine Inhalte, die einen
    Leser über die Wirklichkeit täuschen könnten — sie beschreiben eine Seite,
    die daneben steht. Und ein ``<meta name="ai-generated">`` über einer
    ``<meta name="description">`` wäre eine Auskunft über eine Auskunft.
    """
    paar, antwort, warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "seo",
        lambda client, db, tenant_id, profil: _seo_arbeit(
            client, db, tenant_id, body, profil
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    titel, beschreibung = paar
    return ki_texte.SeoAntwort(
        seo_title=titel,
        seo_description=beschreibung,
        modell=antwort.modell,
        region=antwort.region,
        warnungen=warnungen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


def _seo_arbeit(client, db, tenant_id, body, profil):  # noqa: ANN001, ANN202
    """Nur die Umformung „drei Rückgabewerte → zwei plus Paar“."""
    titel, beschreibung, antwort, warnungen = ki_texte.seo_erzeugen(
        client, db, tenant_id, body, profil
    )
    return (titel, beschreibung), antwort, warnungen


@ki_router.post("/abschnitt", response_model=ki_texte.TextAntwort)
def abschnitt(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: ki_texte.AbschnittRequest,
) -> ki_texte.TextAntwort:
    """Einen Abschnittstext NEU erzeugen.

    Ergebnis trägt ``ai_generated``: maschinenlesbare Kennzeichnung im HTML,
    Freigabe vor der Veröffentlichung. KEIN Gast-Banner — eine
    Objektbeschreibung ist Werbung, kein Thema von öffentlichem Interesse.
    """
    text, antwort, warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "abschnitt",
        lambda client, db, tenant_id, profil: ki_texte.abschnitt_erzeugen(
            client, db, tenant_id, body, profil
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    return ki_texte.TextAntwort(
        text=text,
        herkunft=ki_herkunft.Herkunft.ai_generated,
        modell=antwort.modell,
        region=antwort.region,
        warnungen=warnungen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


@ki_router.post("/blogbeitrag", response_model=ki_texte.TextAntwort)
def blogbeitrag(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: ki_texte.BlogbeitragRequest,
) -> ki_texte.TextAntwort:
    """Einen Blogbeitrag NEU erzeugen.

    Der einzige Fall mit einem Fußhinweis beim Gast: ein Beitrag über die neue
    Kurtaxe oder über lokale Auflagen kann die Grenze zum öffentlichen
    Interesse reißen, und man sieht es ihm beim Schreiben nicht an.
    """
    text, antwort, warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "blogbeitrag",
        lambda client, db, tenant_id, profil: ki_texte.blogbeitrag_erzeugen(
            client, db, tenant_id, body, profil
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    return ki_texte.TextAntwort(
        text=text,
        herkunft=ki_herkunft.Herkunft.ai_generated,
        modell=antwort.modell,
        region=antwort.region,
        warnungen=warnungen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


@ki_router.post("/alt-text", response_model=ki_bild.AltTextAntwort)
def alt_text(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: ki_bild.AltTextRequest
) -> ki_bild.AltTextAntwort:
    """Alternativtext für ein Bild der Mediathek.

    Der Text geht anschließend über die Mediathek in ``site_media.alt_text``;
    die Herkunft setzt der Client über ``/ki/alt-text-herkunft``.
    """
    text, antwort, warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "alt_text",
        lambda client, db, tenant_id, profil: ki_bild.alt_text_erzeugen(
            client, db, tenant_id, body
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    return ki_bild.AltTextAntwort(
        alt_text=text,
        modell=antwort.modell,
        region=antwort.region,
        warnungen=warnungen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


# --- Geschäftsprofil --------------------------------------------------------


@ki_router.get("/profil", response_model=KiProfil)
def profil_holen(ctx: Annotated[AuthContext, Depends(_MANAGE)]) -> KiProfil:
    """Die gespeicherte Haltung des Betriebs. Leer ist der Normalfall."""
    return profil_lesen(_db(), _tenant(ctx))


@ki_router.put("/profil", response_model=KiProfil)
def profil_setzen(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: KiProfil
) -> KiProfil:
    """Die Haltung setzen. Vollständig, nicht als Teiländerung — die vier
    Felder wirken zusammen."""
    return profil_speichern(_db(), _tenant(ctx), body)


@ki_router.post("/profil/vorschlag", response_model=ki_texte.ProfilVorschlag)
def profil_vorschlag(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
) -> ki_texte.ProfilVorschlag:
    """Aus den Stammdaten einen Vorschlag machen — statt ihn abzufragen.

    Das ist unsere Antwort auf Dudas Pflicht-Assistenten. Gespeichert wird der
    Vorschlag NICHT; der Betrieb bestätigt ihn über ``PUT /ki/profil``.
    """
    vorschlag, antwort, _warnungen, db, tenant_id = _ausfuehren(
        ctx,
        "profil_vorschlag",
        lambda client, db, tenant_id, profil: (
            *ki_texte.profil_vorschlagen(client, db, tenant_id),
            [],
        ),
    )
    verbrauch, limit = _zaehler(db, tenant_id)
    return ki_texte.ProfilVorschlag(
        ton=vorschlag.get("ton"),
        zielgruppe=vorschlag.get("zielgruppe"),
        alleinstellung=vorschlag.get("alleinstellung"),
        modell=antwort.modell,
        region=antwort.region,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


# --- Herkunft und Freigabe --------------------------------------------------


@ki_router.post("/herkunft", status_code=204)
def herkunft_setzen(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: HerkunftRequest
) -> None:
    """Die Herkunft an einer gespeicherten Zeile setzen.

    Wird aufgerufen, NACHDEM der Betrieb den Vorschlag übernommen und die
    Seite bzw. den Abschnitt gespeichert hat. Löscht eine frühere Freigabe
    mit (Wurzel 1): ein neuer Text ist nicht geprüft, nur weil der alte es war.
    """
    try:
        ki_herkunft.herkunft_setzen(
            _db(),
            _tenant(ctx),
            tabelle=body.tabelle,
            zeilen_id=body.zeilen_id,
            herkunft=body.herkunft,
            modell=body.modell,
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@ki_router.post("/alt-text-herkunft", status_code=204)
def alt_text_herkunft(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: AltTextHerkunftRequest
) -> None:
    """Herkunft eines Alt-Textes. Löst KEINE Kennzeichnung aus — geführt wird
    sie, damit der Betrieb die maschinell geschriebenen Beschreibungen
    wiederfindet."""
    ki_herkunft.alt_text_herkunft_setzen(
        _db(), _tenant(ctx), medium_id=body.medium_id, herkunft=body.herkunft
    )


@ki_router.post("/freigabe", status_code=204)
def freigabe(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], body: FreigabeRequest
) -> None:
    """„Geprüft und übernommen.“

    Das ist kein Haken zur Beruhigung: Art. 50 Abs. 4 nimmt nur Inhalt aus,
    der einer INHALTLICHEN Prüfung unterlag und für den eine Person die
    redaktionelle Verantwortung trägt. Deshalb speichert diese Route Zeitpunkt
    UND Person aus dem Token — nicht aus dem Rumpf.
    """
    try:
        ki_herkunft.freigeben(
            _db(),
            _tenant(ctx),
            tabelle=body.tabelle,
            zeilen_id=body.zeilen_id,
            user_id=ctx.user_id,
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@ki_router.get(
    "/freigabestand/{page_id}", response_model=ki_herkunft.Freigabestand
)
def freigabestand(
    ctx: Annotated[AuthContext, Depends(_MANAGE)], page_id: str
) -> ki_herkunft.Freigabestand:
    """Was dieser Seite an Freigaben fehlt.

    Derselbe Tenant-Scope wie der Listenpfad (Wurzel 9): eine fremde Seiten-ID
    antwortet 404, nicht mit dem Freigabestand eines fremden Betriebs.
    """
    try:
        return ki_herkunft.freigabestand(_db(), _tenant(ctx), page_id)
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


def modell_und_region() -> tuple[str, str]:
    """Für das Diagnose-Skript und die Tests: was ist konfiguriert?"""
    s = get_settings()
    return s.vertex_model, s.vertex_location


# === Seitenfassungen (0476) =================================================


class SeitenUebersetzenRequest(BaseModel):
    """Welche Seite in welche Sprachen."""

    page_id: str = Field(min_length=1)
    #: Leer = alle gefuehrten Sprachen der Website ausser der Standardsprache.
    #: Ausdrueckliche Liste, wenn nur eine Sprache nachgezogen werden soll.
    sprachen: list[str] = Field(default_factory=list, max_length=24)


class SeitenUebersetzenAntwort(BaseModel):
    """Was der Lauf getan hat.

    KEIN `modell` und KEINE `region` — anders als bei den uebrigen
    KI-Antworten. Die Uebersetzung ist fuer den Betrieb eine Eigenschaft seiner
    Website, nicht ein KI-Werkzeug, das er bedient: welcher Dienst dahinter
    steht, ist unsere Betriebsangelegenheit. Im Protokoll (`ki_usage`) stehen
    Modell und Region weiterhin, die Diagnose braucht sie.
    """

    uebersetzt: list[str]
    unveraendert: list[str]
    geschuetzt: list[str]
    fehlgeschlagen: dict[str, str]
    verbrauch_heute: int
    tageslimit: int


def _seite_laden(db: Client, tenant_id: str, page_id: str) -> dict:
    """Eine Seite mit ihren übersetzbaren Feldern — tenant-gescopet.

    Load UND Scope in EINER Abfrage (Wurzel 3): ein ungescopeter Load mit
    nachträglichem Vergleich ist die Stelle, an der der Vergleich vergessen
    wird. Eine fremde `page_id` gibt 404, nicht 403 — sie soll nicht einmal
    verraten, dass es die Seite gibt.
    """
    seiten = (
        db.table("site_pages")
        .select(
            "id, tenant_id, title, seo_title, seo_description, "
            "seo_keywords, excerpt, og_image_alt"
        )
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not seiten:
        raise SiteConfigError("Seite nicht gefunden.", status_code=404)
    return seiten[0]


def _seite_und_sprachen(
    db: Client, tenant_id: str, body: SeitenUebersetzenRequest
) -> tuple[dict, str, list[str]]:
    """Seite laden (tenant-gescopet) und die Zielsprachen bestimmen."""
    seite = _seite_laden(db, tenant_id, body.page_id)
    cfg = (
        db.table("tenant_site_config")
        .select("languages, default_language")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    gefuehrt = list((cfg[0].get("languages") or []) if cfg else [])
    quelle = (cfg[0].get("default_language") if cfg else None) or ""
    if not quelle:
        # KEIN Rueckfall auf "de" (Wurzel 4): ohne Standardsprache weiss
        # niemand, aus welcher Sprache uebersetzt werden soll, und ein
        # geratenes Deutsch wuerde daenische Texte als deutsche behandeln.
        raise SiteConfigError(
            "Für diese Website ist keine Standardsprache gesetzt. "
            "Bitte zuerst unter Einstellungen → Sprachen festlegen.",
            status_code=422,
        )
    ziele = body.sprachen or [s for s in gefuehrt if s != quelle]
    # Gegen den SPRACHKATALOG prüfen, nicht nur gegen die geführte Liste.
    #
    # Beide Listen kommen aus verschiedenen Quellen: `tenant_site_config.
    # languages` hat einen eigenen DB-CHECK, `core.languages` einen eigenen
    # Katalog. Steht in der einen ein Code, den die andere nicht kennt, wirft
    # `sprache_benennen()` mitten im Lauf — und zwar eine `SiteConfigError`,
    # also die Sorte, die den ganzen Lauf beendet. Hier abzufangen ist der Ort,
    # an dem noch nichts geschrieben wurde.
    unbekannt = [s for s in ziele if not sprach_name(s)]
    if unbekannt:
        raise SiteConfigError(
            "Unbekannte Sprachen: " + ", ".join(sorted(unbekannt)),
            status_code=422,
        )
    fremd = [s for s in ziele if s not in gefuehrt]
    if fremd:
        # Eine Sprache uebersetzen, die die Website nicht fuehrt, erzeugte eine
        # Fassung, die nie ausgeliefert wird — und kostete einen Modellaufruf.
        raise SiteConfigError(
            "Diese Sprachen sind für die Website nicht eingerichtet: "
            + ", ".join(sorted(fremd)),
            status_code=422,
        )
    return seite, quelle, ziele


def _deckel_pruefen_ohne_rueckgabe(db: Client, tenant_id: str) -> None:
    """`deckel_pruefen` wirft oder gibt den Zaehlerstand zurueck.

    Der Lauf braucht nur das Werfen. Ein `lambda ... and None` haette den
    Rueckgabewert stillschweigend als Wahrheitswert benutzt — bei Stand 0 kaeme
    `0` heraus statt `None`, was heute nichts kaputt macht und beim naechsten
    Leser wie Absicht aussieht.
    """
    ki_nutzung.deckel_pruefen(db, tenant_id)


@ki_router.post("/seite-uebersetzen", response_model=SeitenUebersetzenAntwort)
def seite_uebersetzen(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: SeitenUebersetzenRequest,
) -> SeitenUebersetzenAntwort:
    """Die Kopfangaben einer Seite in alle gefuehrten Sprachen bringen.

    EIGENE Klammer statt `_ausfuehren`: die dort erwartet EINE Modellantwort,
    dieser Lauf macht bis zu 23. Deckel, Protokollierung und Fehlerbuchung sind
    aber dieselben — sie stehen deshalb hier ausgeschrieben und nicht in einer
    zweiten Fassung von `_ausfuehren` (die beim naechsten Nachschaerfen
    auseinanderlaufen wuerde).
    """
    tenant_id = _tenant(ctx)
    client = _client()
    db = _db()
    if not client.is_configured:
        raise HTTPException(
            status_code=503,
            detail="Die Übersetzung ist für dieses System nicht eingerichtet.",
        )
    try:
        ki_nutzung.deckel_pruefen(db, tenant_id)
        profil = profil_lesen(db, tenant_id)
        seite, quelle, ziele = _seite_und_sprachen(db, tenant_id, body)
        lauf, antworten = seiten_uebersetzung.seite_uebersetzen(
            client,
            db,
            tenant_id,
            seite,
            quelle,
            ziele,
            profil,
            # Vor JEDEM Modellaufruf, nicht nur einmal vor dem Lauf: 23
            # Sprachen sind 23 Aufrufe. Der Lauf faengt das 429 selbst und
            # vermerkt die restlichen Sprachen als fehlgeschlagen — so bleibt
            # erhalten, was schon uebersetzt wurde.
            deckel=lambda: _deckel_pruefen_ohne_rueckgabe(db, tenant_id),
        )
    except KiError as exc:
        if exc.status_code != 429:
            ki_nutzung.fehler_buchen(
                db,
                tenant_id,
                user_id=ctx.user_id,
                funktion="seite_uebersetzen",
                modell=client.modell,
                region=client.region,
                grund=exc.message,
            )
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    # JEDE gelungene Sprache einzeln buchen: der Tagesdeckel zaehlt Aufrufe,
    # und ein Lauf ueber 23 Sprachen sind 23 Aufrufe. Nur einen zu buchen
    # machte den Deckel zur Attrappe.
    for antwort in antworten:
        ki_nutzung.buchen(
            db,
            tenant_id,
            user_id=ctx.user_id,
            funktion="seite_uebersetzen",
            antwort=antwort,
        )
    verbrauch, limit = _zaehler(db, tenant_id)
    return SeitenUebersetzenAntwort(
        uebersetzt=lauf.uebersetzt,
        unveraendert=lauf.unveraendert,
        geschuetzt=lauf.geschuetzt,
        fehlgeschlagen=lauf.fehlgeschlagen,
        verbrauch_heute=verbrauch,
        tageslimit=limit,
    )


class FassungSchreibenRequest(BaseModel):
    """Eine Sprachfassung von Hand setzen — und damit schützen."""

    page_id: str = Field(min_length=1)
    sprache: str = Field(min_length=2, max_length=8)
    title: str = Field(min_length=1, max_length=2000)
    seo_title: str | None = Field(default=None, max_length=2000)
    seo_description: str | None = Field(default=None, max_length=2000)
    seo_keywords: str | None = Field(default=None, max_length=2000)
    excerpt: str | None = Field(default=None, max_length=2000)
    og_image_alt: str | None = Field(default=None, max_length=2000)


@ki_router.get(
    "/seite-fassungen",
    response_model=list[seiten_uebersetzung.SeitenFassung],
)
def seite_fassungen(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    page_id: Annotated[str, Query(min_length=1)],
) -> list[seiten_uebersetzung.SeitenFassung]:
    """Alle Sprachfassungen einer Seite — mit `geprueft` und `veraltet`.

    Ohne diesen Weg wäre der ganze Schutzmechanismus unsichtbar: eine geprüfte
    Fassung bliebe zwar stehen, wenn der deutsche Text sich ändert, aber
    niemand erführe je, dass sie veraltet ist.
    """
    db = _db()
    tenant_id = _tenant(ctx)
    seite = _seite_laden(db, tenant_id, page_id)
    return seiten_uebersetzung.fassungen_fuer_seite(db, page_id, seite)


@ki_router.put("/seite-fassung", response_model=seiten_uebersetzung.SeitenFassung)
def seite_fassung_schreiben(
    ctx: Annotated[AuthContext, Depends(_MANAGE)],
    body: FassungSchreibenRequest,
) -> seiten_uebersetzung.SeitenFassung:
    """Eine Sprachfassung von Hand setzen.

    Die Zeile bekommt `geprueft = true` und ist damit für den Automaten
    unerreichbar — jedes maschinelle Schreiben trägt `where geprueft = false`.
    Das ist der Punkt dieses Endpunkts: ohne ihn gäbe es keinen Weg, eine
    Übersetzung zu korrigieren, und der `geprueft`-Schutz wäre eine Spalte, die
    nie `true` wird.

    Der `quelle_hash` wird auf den AKTUELLEN Stand der Seite gesetzt: wer von
    Hand korrigiert, hat den Text vor sich, den es gerade gibt. Ändert sich das
    Original später, weicht der Hash ab und die Fassung gilt als veraltet —
    sichtbar, aber unangetastet.
    """
    db = _db()
    tenant_id = _tenant(ctx)
    seite = _seite_laden(db, tenant_id, page_id=body.page_id)
    try:
        return seiten_uebersetzung.fassung_schreiben(
            db, tenant_id, seite, body.model_dump(), ctx.user_id
        )
    except SiteConfigError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
