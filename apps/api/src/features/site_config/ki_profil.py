"""Geschäftsprofil für den KI-Assistenten — ABGELEITET, nicht abgefragt (0464).

Duda und darüber Hostaway zwingen den Kunden beim ersten Klick auf eine
KI-Funktion in einen Assistenten: „AI Business Profile“ — Name, Branche,
Zielgruppe, Tonfall. Ohne ausgefülltes Profil läuft dort nichts.

Wir fragen nichts davon ab. Der Betriebsname steht in ``tenants``, die
Anschrift in ``tenant_billing_profile``, Unterkunftsart, Betten, Ausstattung
und Lage in ``properties``, die Zusammengehörigkeit in ``buildings``. Ein
zweites Mal eingetippt wäre das nicht nur Arbeit, sondern eine zweite Wahrheit
— wer umzieht, ändert die Adresse im Konto, und die KI erzählte weiter von der
alten Stadt.

Was der Betrieb WIRKLICH nur selbst sagen kann, steht in ``site_ai_profile``
und ist vollständig optional: Tonfall, Zielgruppe, Alleinstellung, verbotene
Wörter.

**Die Regel, die dieses Modul durchsetzt: was nicht erfasst ist, wird nicht
behauptet.** Steht keine Bettenzahl in den Daten, taucht keine Bettenzahl im
Kontext auf — und der Prompt verbietet dem Modell ausdrücklich, eine zu
erfinden. Das ist Wurzel 4 und zugleich der Schutz gegen eine irreführende
geschäftliche Handlung nach der UGP-Richtlinie, für die am Ende der Betrieb
haftet, nicht wir.
"""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator
from supabase import Client

from src.core.logging import get_logger

from .fehler import SiteConfigError
from .konto_daten import firmen_schema_daten

log = get_logger("nextdays.site_config.ki_profil")

_PROFIL_COLS = (
    "tenant_id, ton, zielgruppe, alleinstellung, verbotene_woerter, "
    "notiz, created_at, updated_at"
)

# Wie viele Objekte höchstens in den Kontext wandern. Ein Betrieb mit 300
# Objekten würde sonst je Aufruf ein halbes Megabyte an Google schicken — der
# unbegrenzte Bereich aus Wurzel 8, nur mit einer Rechnung dahinter.
#
# Für den Zweck reicht das: gefragt ist „was für ein Betrieb ist das“, nicht
# „liste alles auf“. Geht es um EIN Objekt (Objektbeschreibung, Objektseite),
# steht dieses Objekt ohnehin vollständig im Kontext und die Liste dient nur
# der Einordnung.
MAX_OBJEKTE_IM_KONTEXT = 12

# Wie viele Ausstattungsmerkmale je Objekt. Dieselbe Überlegung; die Liste
# `amenities` kann bei einem gut gepflegten Objekt achtzig Einträge haben.
MAX_AUSSTATTUNG_JE_OBJEKT = 25


class KiProfil(BaseModel):
    """Die Haltung des Betriebs. Alles optional — nichts davon hat einen
    Vorgabewert, weil ein voreingestellter Tonfall eine Behauptung über einen
    Betrieb wäre, den wir nicht kennen (Wurzel 4)."""

    ton: str | None = Field(default=None, max_length=300)
    zielgruppe: str | None = Field(default=None, max_length=300)
    alleinstellung: str | None = Field(default=None, max_length=600)
    verbotene_woerter: list[str] = Field(default_factory=list, max_length=50)
    notiz: str | None = Field(default=None, max_length=1200)

    @field_validator("ton", "zielgruppe", "alleinstellung", "notiz")
    @classmethod
    def _leer_ist_none(cls, v: str | None) -> str | None:
        """Ein leerer String ist keine Angabe. Ihn zu speichern hieße, eine
        leere Zeile in jeden Prompt zu schreiben."""
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("verbotene_woerter")
    @classmethod
    def _woerter_sauber(cls, v: list[str]) -> list[str]:
        """Getrimmt, ohne Leereinträge, ohne Dubletten, Reihenfolge erhalten."""
        gesehen: set[str] = set()
        raus: list[str] = []
        for wort in v:
            w = (wort or "").strip()
            if not w or len(w) > 60:
                continue
            schluessel = w.casefold()
            if schluessel in gesehen:
                continue
            gesehen.add(schluessel)
            raus.append(w)
        return raus


class AbgeleitetesProfil(BaseModel):
    """Was wir über den Betrieb WISSEN, ohne zu fragen. Reine Lesesicht.

    Jedes Feld darf fehlen. Fehlt es, steht es nicht im Kontext — und was nicht
    im Kontext steht, darf das Modell laut Systemanweisung nicht behaupten.
    """

    betrieb: str | None = None
    ort: str | None = None
    land: str | None = None
    # Anzahl aktiver Objekte insgesamt — auch wenn nur die ersten
    # MAX_OBJEKTE_IM_KONTEXT ausführlich dabei sind. „14 Objekte, hier sind 12“
    # ist eine ehrliche Angabe; nur die 12 zu nennen wäre eine falsche.
    objekte_gesamt: int = 0
    objekte: list[dict] = Field(default_factory=list)
    # Sprachen, in denen die Website erscheint (aus den Seiten des Baukastens).
    sprachen: list[str] = Field(default_factory=list)


def profil_lesen(db: Client, tenant_id: str) -> KiProfil:
    """Die gespeicherte Haltung. Gibt es keine Zeile, ist alles leer — das ist
    kein Fehler, sondern der Normalfall vor dem ersten Speichern."""
    zeilen = (
        db.table("site_ai_profile")
        .select(_PROFIL_COLS)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not zeilen:
        return KiProfil()
    z = zeilen[0]
    return KiProfil(
        ton=z.get("ton"),
        zielgruppe=z.get("zielgruppe"),
        alleinstellung=z.get("alleinstellung"),
        verbotene_woerter=list(z.get("verbotene_woerter") or []),
        notiz=z.get("notiz"),
    )


def profil_speichern(db: Client, tenant_id: str, profil: KiProfil) -> KiProfil:
    """Die Haltung setzen. Vollständig, nicht als Teiländerung.

    Warum vollständig: die vier Felder wirken zusammen. Eine Teiländerung, die
    den Tonfall setzt und die verbotenen Wörter unerwähnt lässt, ist im
    Formular nicht unterscheidbar von „ich habe die Wortliste geleert“ — und
    der stille Unterschied wäre, dass ein Markenwort wieder auftaucht.
    """
    daten = {
        "tenant_id": tenant_id,
        "ton": profil.ton,
        "zielgruppe": profil.zielgruppe,
        "alleinstellung": profil.alleinstellung,
        "verbotene_woerter": profil.verbotene_woerter,
        "notiz": profil.notiz,
        "updated_at": "now()",
    }
    # upsert auf den Primärschlüssel: der Knopf ist retrybar und ein
    # Doppelklick darf keine zweite Zeile erzeugen (Wurzel 2). Die
    # Datenbank hält das ohnehin — tenant_id IST der Primärschlüssel — aber
    # ein insert liefe in einen 23505 statt zu speichern.
    db.table("site_ai_profile").upsert(daten, on_conflict="tenant_id").execute()
    log.info("ki_profil_gespeichert", tenant_id=tenant_id)
    return profil_lesen(db, tenant_id)


def _objekt_zeile(row: dict) -> dict:
    """Ein Objekt auf die Angaben eindampfen, die einen Text tragen können.

    Nur was WIRKLICH in der Zeile steht. Kein `or "Ferienwohnung"`, kein
    geratener Ort aus der Adresse, keine Bettenzahl aus `max_guests`
    hochgerechnet — genau solche plausiblen Ersatzwerte sind es, die eine
    Beschreibung erfinden, ohne dass es jemandem auffällt (Wurzel 4).
    """
    attrs = row.get("type_attributes") or {}
    if not isinstance(attrs, dict):
        attrs = {}
    eintrag: dict = {}
    for feld, wert in (
        ("titel", row.get("title")),
        ("beschreibung", row.get("description")),
        ("art", row.get("property_type")),
        ("kategorie", row.get("category_slug")),
        ("ort", row.get("city")),
        ("land", row.get("country")),
    ):
        if wert:
            eintrag[feld] = str(wert)
    if row.get("max_guests"):
        eintrag["max_gaeste"] = int(row["max_guests"])
    for feld, schluessel in (
        ("schlafzimmer", "schlafzimmer"),
        ("badezimmer", "badezimmer"),
        ("betten", "betten"),
    ):
        wert = attrs.get(schluessel)
        if isinstance(wert, (int, float)) and wert > 0:
            eintrag[feld] = int(wert)
    if row.get("size_value") and row.get("size_unit"):
        eintrag["groesse"] = f"{row['size_value']} {row['size_unit']}"
    ausstattung = [
        str(a) for a in (row.get("amenities") or []) if a
    ][:MAX_AUSSTATTUNG_JE_OBJEKT]
    if ausstattung:
        eintrag["ausstattung"] = ausstattung
    return eintrag


def abgeleitetes_profil(
    db: Client, tenant_id: str, *, property_id: str | None = None
) -> AbgeleitetesProfil:
    """Alles, was wir über den Betrieb wissen, ohne ihn zu fragen.

    ``property_id`` hebt EIN Objekt hervor: geht es um dessen Seite oder
    Beschreibung, steht es an erster Stelle im Kontext. Es wird dabei
    tenant-gescoped geladen wie alles andere auch — ein Objekt eines fremden
    Betriebs in den eigenen Prompt zu ziehen wäre ein Datenleck über Bande
    (Wurzel 3).
    """
    # `firmen_schema_daten` und nicht `firmendaten`: das erste liefert Ort
    # und Land als EINZELFELDER, das zweite klebt sie zu einer Adresszeile
    # zusammen. Für einen Prompt braucht es die Einzelteile — „Sitz:
    # Hovedgaden 12\n9881 Bindslev" wäre eine Zeile, aus der das Modell den
    # Ort selbst herausschneiden müsste, und genau da fängt das Raten an.
    firma = firmen_schema_daten(db, tenant_id)
    abfrage = (
        db.table("properties")
        .select(
            "id, title, description, property_type, category_slug, city, "
            "country, max_guests, amenities, type_attributes, size_value, "
            "size_unit"
        )
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .is_("archived_at", "null")
    )
    zeilen = (
        abfrage.order("updated_at", desc=True)
        .limit(MAX_OBJEKTE_IM_KONTEXT)
        .execute()
    ).data or []

    gesamt = (
        db.table("properties")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .eq("status", "active")
        .is_("archived_at", "null")
        .limit(1)
        .execute()
    )
    objekte_gesamt = int(gesamt.count or 0)

    if property_id:
        treffer = (
            db.table("properties")
            .select(
                "id, title, description, property_type, category_slug, city, "
                "country, max_guests, amenities, type_attributes, size_value, "
                "size_unit"
            )
            .eq("tenant_id", tenant_id)
            .eq("id", property_id)
            .limit(1)
            .execute()
        ).data or []
        if not treffer:
            # Fail-closed: eine unbekannte oder fremde Objekt-ID wird nicht
            # stillschweigend übergangen, sonst erzeugt die KI einen Text über
            # den falschen Betrieb und niemand sieht es (Wurzel 3/5).
            raise SiteConfigError("Objekt nicht gefunden.", status_code=404)
        zeilen = treffer + [z for z in zeilen if z.get("id") != property_id]
        zeilen = zeilen[:MAX_OBJEKTE_IM_KONTEXT]

    sprachen: list[str] = []
    seiten = (
        db.table("site_pages")
        .select("languages")
        .eq("tenant_id", tenant_id)
        .limit(200)
        .execute()
    ).data or []
    for seite in seiten:
        for code in seite.get("languages") or []:
            if code and code not in sprachen:
                sprachen.append(str(code))

    return AbgeleitetesProfil(
        betrieb=firma.get("name"),
        ort=firma.get("city"),
        land=firma.get("country"),
        objekte_gesamt=objekte_gesamt,
        objekte=[_objekt_zeile(z) for z in zeilen],
        sprachen=sorted(sprachen),
    )


def _objekt_als_text(eintrag: dict) -> list[str]:
    """Ein Objekt als Aufzählungszeilen. Leere Felder erzeugen keine Zeile."""
    zeilen: list[str] = []
    titel = eintrag.get("titel")
    zeilen.append(f"- Objekt: {titel}" if titel else "- Objekt (ohne Namen)")
    for beschriftung, feld in (
        ("Art", "art"),
        ("Kategorie", "kategorie"),
        ("Ort", "ort"),
        ("Land", "land"),
        ("Größe", "groesse"),
        ("Schlafzimmer", "schlafzimmer"),
        ("Badezimmer", "badezimmer"),
        ("Betten", "betten"),
        ("Gäste maximal", "max_gaeste"),
    ):
        if eintrag.get(feld) is not None:
            zeilen.append(f"  {beschriftung}: {eintrag[feld]}")
    if eintrag.get("ausstattung"):
        zeilen.append("  Ausstattung: " + ", ".join(eintrag["ausstattung"]))
    if eintrag.get("beschreibung"):
        # Die vorhandene Beschreibung ist der wertvollste Teil des Kontexts:
        # sie enthält die Fakten in den Worten des Betriebs. Gedeckelt, weil
        # manche Beschreibungen aus einem Portal-Import mehrere Tausend Zeichen
        # haben und der Deckel des Clients sonst reißt.
        text = str(eintrag["beschreibung"])[:1500]
        zeilen.append(f"  Vorhandene Beschreibung: {text}")
    return zeilen


def kontext_text(
    abgeleitet: AbgeleitetesProfil, profil: KiProfil
) -> str:
    """Abgeleitetes Wissen + Haltung als EIN Textblock für den Prompt.

    Deutsch beschriftet, obwohl der ERZEUGTE Text in jeder Sprache stehen kann:
    die Beschriftungen sind Anweisungen an das Modell, nicht Teil der Ausgabe.
    Die Zielsprache steht getrennt in der Systemanweisung (``ki_texte.py``) —
    sie aus dem Kontext raten zu lassen wäre genau der Fehler, der im
    Posteingang schon einmal einen italienischen Gast auf Deutsch begrüßt hat.
    """
    teile: list[str] = []
    kopf: list[str] = []
    if abgeleitet.betrieb:
        kopf.append(f"Betrieb: {abgeleitet.betrieb}")
    if abgeleitet.ort:
        kopf.append(f"Sitz: {abgeleitet.ort}")
    if abgeleitet.land:
        kopf.append(f"Land: {abgeleitet.land}")
    if abgeleitet.objekte_gesamt:
        kopf.append(f"Aktive Objekte insgesamt: {abgeleitet.objekte_gesamt}")
    if kopf:
        teile.append("\n".join(kopf))

    if abgeleitet.objekte:
        zeilen = ["Objekte (erfasste Angaben, nichts davon ergänzen):"]
        for eintrag in abgeleitet.objekte:
            zeilen.extend(_objekt_als_text(eintrag))
        teile.append("\n".join(zeilen))
        if abgeleitet.objekte_gesamt > len(abgeleitet.objekte):
            teile.append(
                f"(Es gibt {abgeleitet.objekte_gesamt} aktive Objekte; hier "
                f"stehen die {len(abgeleitet.objekte)} zuletzt bearbeiteten.)"
            )

    haltung: list[str] = []
    if profil.ton:
        haltung.append(f"Gewünschter Tonfall: {profil.ton}")
    if profil.zielgruppe:
        haltung.append(f"Zielgruppe: {profil.zielgruppe}")
    if profil.alleinstellung:
        haltung.append(f"Alleinstellungsmerkmal: {profil.alleinstellung}")
    if profil.notiz:
        haltung.append(f"Zusätzliche Anweisung des Betriebs: {profil.notiz}")
    if profil.verbotene_woerter:
        haltung.append(
            "Diese Wörter dürfen NICHT vorkommen: "
            + ", ".join(profil.verbotene_woerter)
        )
    if haltung:
        teile.append("\n".join(haltung))

    if not teile:
        # Ein leerer Kontext ist eine ehrliche Auskunft und kein Fehler: ein
        # Betrieb, der noch kein Objekt angelegt hat, kann trotzdem einen
        # Absatz kürzen lassen. Der Satz steht da, damit das Modell nicht
        # anfängt, sich einen Betrieb auszudenken.
        return "Zu diesem Betrieb sind noch keine Stammdaten erfasst."
    return "\n\n".join(teile)


def verbotene_woerter_treffer(text: str, profil: KiProfil) -> list[str]:
    """Welche verbotenen Wörter stehen im erzeugten Text?

    Mechanisch NACH der Erzeugung geprüft und nicht nur im Prompt gebeten: ein
    Sprachmodell hält sich an Verbote ungefähr, und „ungefähr“ ist bei einem
    Wort, das ein Betrieb ausdrücklich nicht lesen will, zu wenig. Die Treffer
    gehen als Warnung an die UI — der Text wird NICHT stillschweigend
    umgeschrieben, weil eine stille Korrektur eine zweite Erzeugung wäre, die
    niemand gesehen hat.
    """
    if not profil.verbotene_woerter:
        return []
    unten = text.casefold()
    return [w for w in profil.verbotene_woerter if w.casefold() in unten]
