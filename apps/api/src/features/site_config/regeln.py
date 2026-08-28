"""Personalisierungs-Regeln einer Kunden-Website (0440).

Eine Regel beantwortet zwei Fragen getrennt: **wann** (``triggers``) und
**was** (``action_type`` + ``action``). Vorher hing beides am Pop-up selbst
(0437); die Begründung für die Trennung steht ausführlich in der Migration.

Was hier NICHT passiert: das Auswerten. Die Auslöser sind Zustände des
BESUCHERS — welches Gerät, wievielter Besuch, welche Uhrzeit bei ihm, mit
welchem Kampagnen-Parameter er kam. Der Server weiß davon nichts und soll es
auch nicht wissen: es wäre ein Profil je Gast. Er liefert die Regeln aus, der
Browser entscheidet. Die einzige Ausnahme ist der Ort — dafür braucht es die
IP, und die hat nur der Server (siehe ``ort_erlaubt``).
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator
from supabase import Client

from src.core.logging import get_logger

from .basis import _nur_text, _nur_text_mehrsprachig
from .fehler import SiteConfigError

log = get_logger("nextdays.site_config.regeln")

_COLS = (
    "id, name, triggers, action_type, action, seiten, "
    "einmal_je_besucher, wieder_nach_tagen, status, sort_order, created_at"
)

# Wie viele Regeln eine Website führen darf. Der Deckel ist nicht Vorsicht,
# sondern Rechnung: die aktiven Regeln gehen mit JEDEM Seitenaufbau an den
# Browser jedes Gastes und werden dort ausgewertet. Fünfzig sind mehr, als eine
# Unterkunfts-Website je braucht, und immer noch wenige Kilobyte.
MAX_REGELN = 50


class RuleStatus(StrEnum):
    """Drei Zustände, weil „noch nie scharf" und „bewusst aus" verschieden sind.

    ``draft`` ist unfertig — der Betrieb baut noch. ``disabled`` ist eine
    Entscheidung: die Regel hat funktioniert und soll gerade nicht laufen. Ein
    einzelner Schalter würde beides zu „aus" verschmelzen, und niemand wüsste
    hinterher, ob eine Regel je fertig war.
    """

    draft = "draft"
    active = "active"
    disabled = "disabled"


class ActionType(StrEnum):
    """Was eine Regel tut. Genau eines je Regel.

    Dieselben vier wie bei Duda, mit einer Ausnahme: Duda hat zusätzlich
    „festliche Effekte" als eigene Art. Bei uns ist das ``effect`` — die
    Umsetzung unterscheidet sich (eigene Partikel statt fremder Bibliothek),
    die Bedeutung nicht.
    """

    popup = "popup"
    top_bar = "top_bar"
    effect = "effect"
    script = "script"


class Geraet(StrEnum):
    """Gerätearten. Duda kennt nur Desktop und Mobil.

    Tablet fehlt bewusst auch bei uns: die Grenze zwischen Tablet und Desktop
    ist eine Bildschirmbreite, keine Nutzungsart, und ein Betrieb, der drei
    Kästchen sieht, kreuzt zwei an und wundert sich über das dritte.
    """

    desktop = "desktop"
    mobile = "mobile"


class BesuchsModus(StrEnum):
    """``first`` = beim ersten Besuch, ``min`` = ab dem N-ten Besuch."""

    first = "first"
    min = "min"


class Wiederholung(StrEnum):
    """Wie sich ein Zeitfenster wiederholt."""

    keine = "keine"
    taeglich = "taeglich"
    woechentlich = "woechentlich"
    monatlich = "monatlich"
    jaehrlich = "jaehrlich"


class PopupZeitpunkt(StrEnum):
    """Wann ein Pop-up erscheint, sobald die Regel greift."""

    sofort = "sofort"
    verzoegert = "verzoegert"
    verlassen = "verlassen"
    scroll = "scroll"


class Effekt(StrEnum):
    """Die Partikel-Effekte.

    Neun, weil Dudas Auswahldialog neun lesbare Kacheln zeigt (die zehnte Reihe
    ist im einzigen belegbaren Screenshot abgeschnitten — was dort steht, ist
    nicht belegt und wird deshalb nicht geraten).

    Ehrlich gesagt: für eine Unterkunfts-Website verkauft keiner davon eine
    Nacht. Sie stehen hier, weil sie ausdrücklich verlangt wurden; ``bats`` und
    ``pride`` sind Kalendertage, kein Dauerzustand.
    """

    schnee = "schnee"
    feuerwerk = "feuerwerk"
    blaetter = "blaetter"
    herzen = "herzen"
    sterne = "sterne"
    fledermaeuse = "fledermaeuse"
    ballons = "ballons"
    pride = "pride"
    kleeblaetter = "kleeblaetter"


# === Auslöser ============================================================


class ZeitAusloeser(BaseModel):
    """Ein Zeitfenster, das sich wiederholen kann.

    Die Zeiten sind ORTSZEIT in ``zeitzone`` und keine UTC-Zeitstempel: ein
    Betrieb, der „ab 18 Uhr" sagt, meint 18 Uhr bei sich. Die Umrechnung macht
    der Browser des Gastes gegen dieselbe Zeitzone — sonst sähe ein Gast aus
    einer anderen Zone das Angebot zur falschen Stunde.
    """

    start_datum: str | None = None
    end_datum: str | None = None
    ganztags: bool = True
    von: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    bis: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    zeitzone: str = Field(default="Europe/Copenhagen", max_length=60)
    wiederholung: Wiederholung = Wiederholung.keine

    @model_validator(mode="after")
    def _zeiten_vollstaendig(self) -> ZeitAusloeser:
        """Nicht ganztägig heißt: BEIDE Zeiten. Eine allein ist keine Spanne."""
        if not self.ganztags and (not self.von or not self.bis):
            raise ValueError(
                "Ohne ganztags brauchen wir eine Start- und eine Endzeit."
            )
        if self.start_datum and self.end_datum and self.end_datum < self.start_datum:
            raise ValueError("Das Enddatum liegt vor dem Startdatum.")
        return self


class BesuchsAusloeser(BaseModel):
    """Ab dem wievielten Besuch die Regel greift."""

    modus: BesuchsModus = BesuchsModus.first
    anzahl: int = Field(default=2, ge=2, le=50)


class OrtAusloeser(BaseModel):
    """Wo der Gast sitzt.

    Ein Freitext plus die Ländervorwahl nach ISO-3166. Duda wertet jede Angabe
    als 50-km-Radius um den genannten Ort aus; wir speichern denselben Radius
    mit, damit ein Betrieb ihn sehen und ändern kann, statt ihn zu erraten.

    ACHTUNG, und das steht auch in der Oberfläche: ohne einen eingerichteten
    Geo-Dienst greift dieser Auslöser NICHT. Er fällt dann nicht auf „überall"
    zurück — das wäre ein erfundener Standort (Wurzel 4) — sondern die Regel
    ruht.
    """

    land: str | None = Field(default=None, min_length=2, max_length=2)
    ort: str | None = Field(default=None, max_length=120)
    radius_km: int = Field(default=50, ge=5, le=500)

    @model_validator(mode="after")
    def _mindestens_eins(self) -> OrtAusloeser:
        if not self.land and not self.ort:
            raise ValueError("Ein Ort-Auslöser braucht ein Land oder eine Stadt.")
        return self

    @field_validator("land")
    @classmethod
    def _land_gross(cls, v: str | None) -> str | None:
        return v.upper() if v else v


class KampagnenAusloeser(BaseModel):
    """Parameter im Query-String, mit denen der Gast ankam.

    ``exakt`` unterscheidet „utm_source ist genau `newsletter`" von „enthält
    `news`". Duda lässt offen, welches von beidem gilt; wir entscheiden es
    sichtbar, weil beides gebraucht wird und Raten hier eine stille
    Falschauslieferung wäre.
    """

    parameter: dict[str, str] = Field(default_factory=dict)
    exakt: bool = True

    @field_validator("parameter")
    @classmethod
    def _grenzen(cls, v: dict[str, str]) -> dict[str, str]:
        if len(v) > 5:
            raise ValueError("Mehr als fünf Kampagnen-Parameter sind nicht möglich.")
        for schluessel, wert in v.items():
            if not schluessel or len(schluessel) > 60 or len(wert) > 200:
                raise ValueError("Kampagnen-Parameter sind zu lang.")
        return v


class Ausloeser(BaseModel):
    """Alle Bedingungen einer Regel. LEER heißt „immer".

    Mehrere Auslöser gelten UND-verknüpft: Duda macht es genauso („Combine a
    variety of triggers"), und ODER wäre in einer Oberfläche ohne Klammern nicht
    erklärbar. Wer ODER braucht, legt zwei Regeln an — dafür gibt es die
    Reihenfolge.
    """

    geraet: Geraet | None = None
    zeit: ZeitAusloeser | None = None
    besuche: BesuchsAusloeser | None = None
    ort: OrtAusloeser | None = None
    kampagne: KampagnenAusloeser | None = None


# === Aktionen ============================================================


class PopupAktion(BaseModel):
    """Ein vorhandenes Pop-up einblenden."""

    art: Literal["popup"] = "popup"
    page_id: str
    zeitpunkt: PopupZeitpunkt = PopupZeitpunkt.sofort
    # Sekunden bei `verzoegert`, Prozent bei `scroll`. EIN Feld für beides, wie
    # in 0437 begründet: es ist immer nur einer der beiden Fälle aktiv.
    wert: int | None = Field(default=None, ge=1, le=120)

    @model_validator(mode="after")
    def _wert_passend(self) -> PopupAktion:
        braucht_wert = self.zeitpunkt in (
            PopupZeitpunkt.verzoegert,
            PopupZeitpunkt.scroll,
        )
        if braucht_wert and self.wert is None:
            raise ValueError(
                "Verzögert und Scroll brauchen eine Zahl (Sekunden bzw. Prozent)."
            )
        if self.zeitpunkt is PopupZeitpunkt.scroll and self.wert and self.wert > 100:
            raise ValueError("Der gelesene Anteil kann höchstens 100 Prozent sein.")
        return self


class TopBarAktion(BaseModel):
    """Die klebende Hinweisleiste über der Seite.

    Sie hat KEINE Abschnitte, sondern einen Satz, wahlweise einen Knopf und zwei
    Farben. Das ist Absicht: eine Leiste, in die man Blöcke bauen kann, wird zu
    einem zweiten Kopfbereich, und dann verdeckt sie die Seite statt sie zu
    ergänzen.

    Der Text ist mehrsprachig (``{locale: text}``) — anders als bei Duda, wo
    Personalisierung auf mehrsprachigen Seiten gar nicht läuft.
    """

    art: Literal["top_bar"] = "top_bar"
    text: dict[str, str] = Field(default_factory=dict)
    knopf_text: dict[str, str] = Field(default_factory=dict)
    knopf_url: str | None = Field(default=None, max_length=2000)
    hintergrund: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    schrift: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    schliessbar: bool = True

    @field_validator("text", "knopf_text")
    @classmethod
    def _nur_text(cls, v: dict[str, str]) -> dict[str, str]:
        """Reiner Text. Eine Leiste ist eine Zeile, kein Rich-Text-Feld — und
        alles, was hier hineinkäme, stünde ungefiltert über JEDER Seite.

        Entfernt wird mit einem echten Parser, nicht mit einem Regex."""
        return _nur_text_mehrsprachig(v)


class EffektAktion(BaseModel):
    """Partikel über der ganzen Seite."""

    art: Literal["effect"] = "effect"
    effekt: Effekt = Effekt.schnee
    # 0 = ohne Ende. Der Deckel bei 120 Sekunden ist kein Geschmacksurteil:
    # die Partikel laufen in einer Animationsschleife, und eine, die nie
    # aufhört, kostet auf einem älteren Telefon dauerhaft Rechenzeit.
    dauer_sekunden: int = Field(default=15, ge=0, le=120)


class ScriptAktion(BaseModel):
    """Eigenes JavaScript.

    Das ist die gefährlichste Aktion des Slice, und sie ist es unvermeidlich:
    der Betrieb will sein Tracking-Pixel oder sein Chat-Widget einbinden. Was
    wir dagegen tun können, tun wir:

    * Der Code geht NIE über den Direktpfad in die Datenbank (0440 entzieht
      `insert`/`update` für anon und authenticated).
    * Er wird nicht ausgewertet, nicht umgeschrieben und nicht „gesäubert" —
      ein Regex über fremdem Code erzeugt nur das Gefühl von Sicherheit.
    * Er ist gedeckelt, damit niemand eine ganze Bibliothek hineinlegt.
    * Die Oberfläche sagt klar, dass er im Browser jedes Gastes läuft.
    """

    art: Literal["script"] = "script"
    code: str = Field(min_length=1, max_length=20_000)


Aktion = Annotated[
    PopupAktion | TopBarAktion | EffektAktion | ScriptAktion,
    Field(discriminator="art"),
]


# === API-Modelle =========================================================


class RuleCreate(BaseModel):
    """Eine neue Regel. Sie startet als Entwurf — siehe ``status`` unten."""

    name: str = Field(min_length=1, max_length=120)
    triggers: Ausloeser = Field(default_factory=Ausloeser)
    action: Aktion
    seiten: list[str] = Field(default_factory=list, max_length=50)
    einmal_je_besucher: bool = True
    wieder_nach_tagen: int | None = Field(default=None, ge=1, le=365)

    @field_validator("name")
    @classmethod
    def _name_sauber(cls, v: str) -> str:
        return _nur_text(v) or ""

    @field_validator("seiten")
    @classmethod
    def _slugs_sauber(cls, v: list[str]) -> list[str]:
        """Slugs kleinschreiben und Dubletten entfernen.

        Die Reihenfolge bleibt: sie ist die des Kunden, und eine sortierte Liste
        sähe in der Oberfläche jedes Mal anders aus als eingegeben.
        """
        gesehen: list[str] = []
        for roh in v:
            slug = (roh or "").strip().lower().lstrip("/")
            if slug and slug not in gesehen:
                gesehen.append(slug)
        return gesehen


class RuleUpdate(BaseModel):
    """Änderung. Alles optional — ``None`` heißt „unverändert lassen"."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    triggers: Ausloeser | None = None
    action: Aktion | None = None
    seiten: list[str] | None = Field(default=None, max_length=50)
    einmal_je_besucher: bool | None = None
    wieder_nach_tagen: int | None = Field(default=None, ge=1, le=365)
    status: RuleStatus | None = None

    @field_validator("name")
    @classmethod
    def _name_sauber(cls, v: str | None) -> str | None:
        return _nur_text(v) if v is not None else None


class RuleResponse(BaseModel):
    """Eine Regel, wie das Dashboard sie sieht."""

    id: str
    name: str
    triggers: dict
    action_type: ActionType
    action: dict
    seiten: list[str]
    einmal_je_besucher: bool
    wieder_nach_tagen: int | None = None
    status: RuleStatus
    sort_order: int
    created_at: str | None = None


class RuleListResponse(BaseModel):
    items: list[RuleResponse] = Field(default_factory=list)
    total: int = 0


class RuleReorderRequest(BaseModel):
    """Die neue Reihenfolge als Liste von IDs, von oben nach unten.

    Vollständig und nicht als Paar (id, position): eine Teilangabe hinterlässt
    Lücken und doppelte Ränge, und der Vorrang ist genau die Reihenfolge.
    """

    ids: list[str] = Field(min_length=1, max_length=MAX_REGELN)


class PublicRule(BaseModel):
    """Was der RENDERER bekommt — bewusst weniger als das Dashboard.

    Kein ``name`` (er ist eine interne Notiz des Betriebs), kein ``status``
    (ausgeliefert wird ohnehin nur, was aktiv ist), kein ``created_at``.
    Was nicht gebraucht wird, geht nicht nach draußen.
    """

    id: str
    triggers: dict
    action_type: ActionType
    action: dict
    seiten: list[str]
    einmal_je_besucher: bool
    wieder_nach_tagen: int | None = None


class PublicRuleListResponse(BaseModel):
    items: list[PublicRule] = Field(default_factory=list)
    # Sagt dem Renderer, ob der Ort-Auslöser überhaupt etwas entscheiden kann.
    # Ohne Geo-Dienst ruhen Regeln mit Ort-Bedingung — der Renderer soll das
    # wissen, statt sie stumm nie auszulösen.
    ort_verfuegbar: bool = False


# === Datenzugriff ========================================================


def _zeile(row: dict) -> RuleResponse:
    """DB-Zeile → Antwort fürs Dashboard."""
    return RuleResponse(
        id=str(row["id"]),
        name=row.get("name") or "",
        triggers=row.get("triggers") or {},
        action_type=ActionType(row["action_type"]),
        action=row.get("action") or {},
        seiten=list(row.get("seiten") or []),
        einmal_je_besucher=bool(row.get("einmal_je_besucher", True)),
        wieder_nach_tagen=row.get("wieder_nach_tagen"),
        status=RuleStatus(row.get("status") or "draft"),
        sort_order=int(row.get("sort_order") or 0),
        created_at=str(row["created_at"]) if row.get("created_at") else None,
    )


def liste(db: Client, tenant_id: str) -> RuleListResponse:
    """Alle Regeln des Betriebs in ihrer Reihenfolge.

    Ohne Deckel in der Abfrage, weil ``MAX_REGELN`` beim Anlegen greift: eine
    Liste, die der Betrieb selbst auf 50 begrenzt bekommt, braucht keine zweite
    Grenze beim Lesen — die würde nur verbergen, wenn die erste versagt.
    """
    rows = (
        db.table("site_rules")
        .select(_COLS)
        .eq("tenant_id", tenant_id)
        .order("sort_order")
        .order("created_at")
        .execute()
    ).data or []
    items = [_zeile(r) for r in rows]
    return RuleListResponse(items=items, total=len(items))


def _naechste_position(db: Client, tenant_id: str) -> int:
    """Ans Ende der Liste. Neue Regeln haben den geringsten Vorrang.

    Anders herum wäre es eine Überraschung: wer eine Regel anlegt, erwartet
    nicht, dass sie eine bestehende sofort verdrängt.
    """
    rows = (
        db.table("site_rules")
        .select("sort_order")
        .eq("tenant_id", tenant_id)
        .order("sort_order", desc=True)
        .limit(1)
        .execute()
    ).data or []
    return int(rows[0]["sort_order"]) + 1 if rows else 0


def anlegen(db: Client, tenant_id: str, req: RuleCreate) -> RuleResponse:
    """Eine Regel anlegen. Sie beginnt IMMER als Entwurf.

    Auch dann, wenn der Betrieb sie sofort scharf schalten will — das ist ein
    zweiter, bewusster Klick. Eine Regel, die im Moment des Anlegens live geht,
    erscheint bei Gästen, während der Betrieb noch am Text schreibt.
    """
    if _anzahl(db, tenant_id) >= MAX_REGELN:
        raise SiteConfigError(
            f"Mehr als {MAX_REGELN} Regeln sind nicht möglich.", status_code=422
        )
    daten = {
        "tenant_id": tenant_id,
        "name": req.name,
        "triggers": req.triggers.model_dump(exclude_none=True),
        "action_type": req.action.art,
        "action": req.action.model_dump(exclude_none=True),
        "seiten": req.seiten,
        "einmal_je_besucher": req.einmal_je_besucher,
        "wieder_nach_tagen": req.wieder_nach_tagen,
        "status": RuleStatus.draft.value,
        "sort_order": _naechste_position(db, tenant_id),
    }
    rows = (db.table("site_rules").insert(daten).execute()).data or []
    if not rows:
        raise SiteConfigError(
            "Die Regel konnte nicht angelegt werden.", status_code=500
        )
    log.info(
        "site_rule_angelegt",
        tenant_id=tenant_id,
        action_type=req.action.art,
        ausloeser=sorted(daten["triggers"].keys()),
    )
    return _zeile(rows[0])


def _anzahl(db: Client, tenant_id: str) -> int:
    """Wie viele Regeln der Betrieb hat — höchstens ``MAX_REGELN + 1`` gelesen.

    Der Deckel an der Abfrage, damit das Zählen nicht selbst der unbegrenzte
    Bereich ist, den es verhindern soll (Wurzel 8).
    """
    rows = (
        db.table("site_rules")
        .select("id")
        .eq("tenant_id", tenant_id)
        .limit(MAX_REGELN + 1)
        .execute()
    ).data or []
    return len(rows)


def _eigene(db: Client, tenant_id: str, rule_id: str) -> dict:
    """Eine Regel per (id, tenant_id) laden — Load und Scope in EINEM Schritt.

    Wurzel 3: Service-Role umgeht RLS. Ein ungescopter Load mit anschließendem
    Vergleich ist genau die Form, bei der man den Vergleich irgendwann vergisst.
    """
    rows = (
        db.table("site_rules")
        .select(_COLS)
        .eq("id", rule_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Regel nicht gefunden.", status_code=404)
    return rows[0]


def aendern(
    db: Client, tenant_id: str, rule_id: str, req: RuleUpdate
) -> RuleResponse:
    """Eine Regel ändern. Nur gesetzte Felder wandern in das Update."""
    _eigene(db, tenant_id, rule_id)
    daten: dict = {}
    if req.name is not None:
        daten["name"] = req.name
    if req.triggers is not None:
        daten["triggers"] = req.triggers.model_dump(exclude_none=True)
    if req.action is not None:
        # Art und Inhalt gehören zusammen: wer die Aktion tauscht, tauscht auch
        # ihren Typ. Getrennt gesetzt hätten wir eine Zeile, deren `action_type`
        # nicht zu ihrem `action` passt — und die Auswertung im Browser läuft
        # dann in den falschen Zweig.
        daten["action_type"] = req.action.art
        daten["action"] = req.action.model_dump(exclude_none=True)
    if req.seiten is not None:
        daten["seiten"] = req.seiten
    if req.einmal_je_besucher is not None:
        daten["einmal_je_besucher"] = req.einmal_je_besucher
    if req.wieder_nach_tagen is not None:
        daten["wieder_nach_tagen"] = req.wieder_nach_tagen
    if req.status is not None:
        daten["status"] = req.status.value
    if not daten:
        return _zeile(_eigene(db, tenant_id, rule_id))
    daten["updated_at"] = "now()"
    rows = (
        db.table("site_rules")
        .update(daten)
        .eq("id", rule_id)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Regel nicht gefunden.", status_code=404)
    return _zeile(rows[0])


def loeschen(db: Client, tenant_id: str, rule_id: str) -> None:
    """Eine Regel endgültig löschen.

    Ohne Papierkorb: eine Regel ist eine Einstellung, kein Inhalt. Wer sie
    behalten will, setzt sie auf ``disabled`` — dafür gibt es den Zustand.
    """
    rows = (
        db.table("site_rules")
        .delete()
        .eq("id", rule_id)
        .eq("tenant_id", tenant_id)
        .execute()
    ).data or []
    if not rows:
        raise SiteConfigError("Regel nicht gefunden.", status_code=404)
    log.info("site_rule_geloescht", tenant_id=tenant_id, rule_id=rule_id)


def neu_ordnen(db: Client, tenant_id: str, ids: list[str]) -> RuleListResponse:
    """Die Reihenfolge setzen — und damit den Vorrang.

    Geschrieben wird Zeile für Zeile und jeweils auf (id, tenant_id) gescopt.
    Eine fremde ID in der Liste trifft dann auf nichts, statt die Regel eines
    anderen Betriebs zu verschieben.

    Vollständigkeit wird geprüft: fehlt eine ID, behielte sie ihre alte Zahl und
    stünde danach an einer Stelle, die niemand gewählt hat.
    """
    vorhanden = {r.id for r in liste(db, tenant_id).items}
    unbekannt = [i for i in ids if i not in vorhanden]
    if unbekannt:
        raise SiteConfigError(
            "Unbekannte Regel in der Reihenfolge.", status_code=422
        )
    if set(ids) != vorhanden:
        raise SiteConfigError(
            "Die Reihenfolge muss alle Regeln enthalten.", status_code=422
        )
    for position, rule_id in enumerate(ids):
        (
            db.table("site_rules")
            .update({"sort_order": position})
            .eq("id", rule_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
    return liste(db, tenant_id)


# === Öffentlicher Lesepfad ===============================================


def oeffentlich(db: Client, tenant_id: str) -> PublicRuleListResponse:
    """Die AKTIVEN Regeln für den Renderer.

    Entwürfe und abgeschaltete Regeln gehen gar nicht erst raus — sie im
    Browser zu filtern hieße, dem Gast mitzuteilen, was der Betrieb gerade
    plant.

    ``ort_verfuegbar`` sagt dem Renderer, ob der Ort-Auslöser entscheidbar ist.
    Ohne Geo-Dienst ruhen Regeln mit Ort-Bedingung; der Renderer soll das
    wissen, damit die Vorschau im Dashboard es benennen kann, statt dass eine
    Regel schweigend nie auslöst (Wurzel 5, fail-closed und sichtbar).
    """
    rows = (
        db.table("site_rules")
        .select(_COLS)
        .eq("tenant_id", tenant_id)
        .eq("status", RuleStatus.active.value)
        .order("sort_order")
        .limit(MAX_REGELN)
        .execute()
    ).data or []
    return PublicRuleListResponse(
        items=[
            PublicRule(
                id=str(r["id"]),
                triggers=r.get("triggers") or {},
                action_type=ActionType(r["action_type"]),
                action=r.get("action") or {},
                seiten=list(r.get("seiten") or []),
                einmal_je_besucher=bool(r.get("einmal_je_besucher", True)),
                wieder_nach_tagen=r.get("wieder_nach_tagen"),
            )
            for r in rows
        ],
        ort_verfuegbar=geo_dienst_verfuegbar(),
    )


def geo_dienst_verfuegbar() -> bool:
    """Ist ein Geo-Dienst eingerichtet?

    Noch keiner — und das ist hier eine Tatsache, keine Auslassung. Die Funktion
    steht trotzdem, weil sie die EINE Stelle ist, an der die Antwort später
    steht: wer einen Anbieter anbindet, ändert sie hier und nirgends sonst.

    Bis dahin ruhen Regeln mit Ort-Bedingung. Sie auf „trifft zu" fallen zu
    lassen wäre ein erfundener Standort und würde ein Angebot für Kopenhagen
    weltweit ausspielen (Wurzel 4).
    """
    return False
