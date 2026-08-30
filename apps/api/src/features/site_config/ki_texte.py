"""Die KI-Funktionen des Website-Baukastens — Prompts, Regeln, Ergebnisse.

Vier Funktionen, dieselben vier, die Hostaway (über Duda) hat, plus zwei, die
sich aus unseren Daten ergeben:

* **Umschreiben** — Kürzen, Verlängern, Ton ändern, Rechtschreibung,
  Übersetzen. Assistierende Bearbeitung, keine Kennzeichnung.
* **SEO** — Meta-Titel und Meta-Beschreibung je Seite.
* **Alt-Text** — Bildbeschreibung (in ``ki_bild.py``, weil dort ein Bild
  heruntergeladen wird und das eigene Sicherheitsregeln hat).
* **Abschnitt** — einen Abschnittstext NEU erzeugen.
* **Blogbeitrag** — einen Beitrag NEU erzeugen.
* **Profil-Vorschlag** — aus den Stammdaten einen Vorschlag für Tonfall,
  Zielgruppe und Alleinstellung machen, den der Betrieb nur noch bestätigt.
  Das ist die Antwort auf Dudas Pflicht-Assistenten: statt zu fragen, schlagen
  wir vor.

**Die eine Regel, die in jedem Prompt steht: nichts erfinden.** Die Erzeugung
stützt sich auf die tatsächlich erfassten Daten des Objekts (Betten,
Ausstattung, Lage). Wo nichts hinterlegt ist, wird nichts behauptet. Das ist
Wurzel 4 — und zugleich der Schutz gegen eine irreführende geschäftliche
Handlung nach der UGP-Richtlinie, für die am Ende der Kunde haftet.

**Mehrsprachigkeit:** erzeugt wird in der Sprache der aktuellen Seitenfassung,
nicht pauschal Deutsch. Die Sprache steht ausdrücklich in der Systemanweisung
und wird NICHT aus dem Kontext geraten — im Posteingang hat genau dieses Raten
schon einmal einen italienischen Gast auf Deutsch begrüßt.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, field_validator, model_validator
from supabase import Client

from src.core.ki import KiAntwort, KiError, VertexClient
from src.core.languages import sprach_name
from src.core.logging import get_logger

from .fehler import SiteConfigError
from .ki_herkunft import Herkunft
from .ki_profil import (
    KiProfil,
    abgeleitetes_profil,
    kontext_text,
    profil_lesen,
    verbotene_woerter_treffer,
)

log = get_logger("nextdays.site_config.ki_texte")

# Wie lang der Text sein darf, den ein Nutzer umschreiben lässt. 8 000 Zeichen
# sind etwa drei DIN-A4-Seiten und mehr, als ein Abschnitt je trägt. Der Deckel
# ist die Grenze gegen den unbegrenzten Bereich (Wurzel 8) — ohne ihn schickt
# ein Skript den ganzen Blog in einem Aufruf.
MAX_EINGABE_ZEICHEN = 8_000

# Meta-Titel und -Beschreibung: Google schneidet in der Ergebnisliste bei rund
# 60 bzw. 155 Zeichen ab. Die Zahlen stehen im Prompt UND werden nach der
# Erzeugung geprüft — ein Modell hält Längenvorgaben ungefähr ein, und
# „ungefähr“ heißt hier: mit Auslassungspunkten in der Google-Ergebnisliste.
SEO_TITEL_MAX = 60
SEO_BESCHREIBUNG_MAX = 155


class UmschreibArt(StrEnum):
    """Die fünf Bearbeitungen, die Duda „AI Text Assistant“ nennt.

    Alle fünf sind assistierende Bearbeitung im Sinn des Erwägungsgrunds 133:
    der Mensch hat den Text geschrieben. Deshalb tragen alle fünf
    ``ai_rewritten`` und keine Kennzeichnungspflicht.

    ``uebersetzen`` steht bewusst hier und nicht bei der Erzeugung: eine
    Übersetzung ist derselbe Inhalt in anderen Worten. Sie als „neu erzeugt“
    zu führen hieße, dass eine 24-sprachige Website 23 Freigaben je Absatz
    bräuchte — für einen Text, den ein Mensch geschrieben und freigegeben hat.
    """

    kuerzen = "kuerzen"
    verlaengern = "verlaengern"
    ton = "ton"
    rechtschreibung = "rechtschreibung"
    uebersetzen = "uebersetzen"


_UMSCHREIB_AUFTRAG: dict[UmschreibArt, str] = {
    UmschreibArt.kuerzen: (
        "Kürze den Text auf etwa die Hälfte. Behalte JEDE Tatsachenangabe "
        "(Zahlen, Ausstattung, Orte, Preise, Zeiten) — gestrichen wird nur "
        "Füllwerk, nie ein Fakt."
    ),
    UmschreibArt.verlaengern: (
        "Formuliere den Text ausführlicher, etwa doppelt so lang. Füge KEINE "
        "neuen Tatsachenangaben hinzu: keine Zahl, keine Ausstattung, keine "
        "Entfernung, kein Ort, der nicht schon im Text steht. Ausgeführt wird, "
        "was da ist — erfunden wird nichts."
    ),
    UmschreibArt.ton: (
        "Schreibe den Text im gewünschten Tonfall neu. Inhalt und alle "
        "Tatsachenangaben bleiben unverändert."
    ),
    UmschreibArt.rechtschreibung: (
        "Korrigiere Rechtschreibung, Zeichensetzung und Grammatik. Ändere "
        "sonst NICHTS — nicht den Stil, nicht die Wortwahl, nicht die "
        "Reihenfolge der Sätze."
    ),
    UmschreibArt.uebersetzen: (
        "Übersetze den Text. Zahlen, Eigennamen und Adressen bleiben stehen; "
        "übersetzt wird die Sprache, nicht der Inhalt."
    ),
}


class UmschreibenRequest(BaseModel):
    """Was der Editor schickt, wenn jemand markierten Text umschreiben lässt."""

    text: str = Field(min_length=1, max_length=MAX_EINGABE_ZEICHEN)
    art: UmschreibArt
    # Sprache der aktuellen Seitenfassung. Pflicht — die Sprache raten zu
    # lassen ist genau der Fehler, den dieses Modul nicht wiederholt.
    sprache: str = Field(min_length=2, max_length=8)
    # Nur bei art=ton: der gewünschte Tonfall in eigenen Worten.
    ton: str | None = Field(default=None, max_length=200)
    # Nur bei art=uebersetzen: die Zielsprache.
    zielsprache: str | None = Field(default=None, min_length=2, max_length=8)

    @field_validator("text")
    @classmethod
    def _nicht_nur_leerzeichen(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Der Text ist leer.")
        return v

    @model_validator(mode="after")
    def _passende_zusatzangabe(self) -> UmschreibenRequest:
        """Fail-closed statt stiller Vorgabe (Wurzel 4).

        Ein „Ton ändern“ ohne Tonangabe könnte man mit „freundlicher“ füllen —
        und der Betrieb bekäme einen Text in einem Ton, den er nie gewählt hat.
        Dasselbe bei einer Übersetzung ohne Zielsprache: „dann eben Englisch“
        ist ein erfundener Ersatzwert.
        """
        if self.art is UmschreibArt.ton and not (self.ton or "").strip():
            raise ValueError("Für „Ton ändern“ fehlt die Angabe des Tonfalls.")
        if self.art is UmschreibArt.uebersetzen and not self.zielsprache:
            raise ValueError("Für „Übersetzen“ fehlt die Zielsprache.")
        return self


class SeoRequest(BaseModel):
    """Meta-Titel und -Beschreibung für EINE Seite."""

    page_id: str = Field(min_length=1, max_length=64)
    sprache: str = Field(min_length=2, max_length=8)


class AbschnittRequest(BaseModel):
    """Einen Abschnittstext NEU erzeugen — das ist der kennzeichnungspflichtige
    Fall."""

    sprache: str = Field(min_length=2, max_length=8)
    # Worum es gehen soll, in einem Satz des Betriebs („Absatz über die Lage“).
    auftrag: str = Field(min_length=3, max_length=500)
    # Optional: das Objekt, um das es geht. Dann steht es an erster Stelle im
    # Kontext und der Text hat echte Fakten statt allgemeiner Sätze.
    property_id: str | None = Field(default=None, max_length=64)
    # Ungefähre Länge in Wörtern. Gedeckelt, weil daraus das Token-Budget wird.
    woerter: int = Field(default=120, ge=20, le=600)


class BlogbeitragRequest(BaseModel):
    """Einen Blogbeitrag NEU erzeugen. Kennzeichnungspflichtig, und der einzige
    Fall mit einem Fußhinweis für den Gast."""

    sprache: str = Field(min_length=2, max_length=8)
    thema: str = Field(min_length=3, max_length=300)
    woerter: int = Field(default=400, ge=100, le=1200)


class TextAntwort(BaseModel):
    """Was zurückkommt — Text plus alles, was der Editor daraus machen muss."""

    text: str
    # Welche Herkunft der Editor an der Zeile setzen soll. Kommt vom SERVER
    # und nicht vom Client: ob ein Text erzeugt oder überarbeitet wurde, weiß
    # der Server aus der aufgerufenen Funktion. Der Client dürfte es sich
    # sonst aussuchen — und würde immer „nur überarbeitet“ wählen.
    herkunft: Herkunft
    modell: str
    region: str
    # Nicht-blockierende Hinweise: verbotene Wörter, abgeschnittener Text.
    warnungen: list[str] = Field(default_factory=list)
    verbrauch_heute: int = 0
    tageslimit: int = 0


class SeoAntwort(BaseModel):
    seo_title: str
    seo_description: str
    modell: str
    region: str
    warnungen: list[str] = Field(default_factory=list)
    verbrauch_heute: int = 0
    tageslimit: int = 0


class ProfilVorschlag(BaseModel):
    """Was Duda abfragt und wir vorschlagen."""

    ton: str | None = None
    zielgruppe: str | None = None
    alleinstellung: str | None = None
    modell: str
    region: str
    verbrauch_heute: int = 0
    tageslimit: int = 0


def _sprache_benennen(code: str) -> str:
    """Sprachcode → ausgeschriebener Name für die Systemanweisung.

    Unbekannter Code → 422. KEIN Rückfall auf Deutsch: ein Text, der in der
    falschen Sprache erscheint, sieht richtig aus und ist falsch — genau die
    Klasse Fehler, die niemand als Bug erkennt.
    """
    name = sprach_name(code)
    if not name:
        raise SiteConfigError(
            f"Unbekannte Sprache: {code}", status_code=422
        )
    return name


def _system_grundregeln(sprache: str, profil: KiProfil) -> str:
    """Die Regeln, die in JEDER Systemanweisung stehen.

    Der Kern ist der zweite Absatz. Ein Sprachmodell, das über eine Unterkunft
    schreiben soll, füllt Lücken von selbst: es erfindet einen Kamin, eine
    Entfernung zum Strand und eine Sauna, weil solche Sätze in seinen
    Trainingsdaten neben solchen Beschreibungen stehen. Das Verbot muss
    deshalb ausdrücklich, wiederholt und mit Beispielen dastehen — eine
    beiläufige Bitte reicht nicht.
    """
    zeilen = [
        f"Schreibe ausschließlich auf {sprache}.",
        "",
        "NICHTS ERFINDEN. Du darfst NUR Tatsachen verwenden, die im Kontext "
        "unten ausdrücklich stehen. Erfinde keine Entfernungen ("
        "„nur 300 m zum Strand“), keine Ausstattung (Sauna, Kamin, WLAN), "
        "keine Zimmerzahl, keine Preise, keine Auszeichnungen, keine "
        "Jahreszahlen und keine Bewertungen. Steht etwas nicht im Kontext, "
        "kommt es nicht in den Text — schreibe lieber kürzer.",
        "",
        "Schreibe nüchtern und konkret. Keine Werbefloskeln, keine "
        "Ausrufezeichen, keine Aufzählung von Adjektiven.",
        "Gib NUR den fertigen Text zurück — keine Einleitung, keine "
        "Erklärung, keine Anführungszeichen um das Ganze, kein Markdown.",
    ]
    if profil.ton:
        zeilen.append(f"Tonfall: {profil.ton}")
    if profil.zielgruppe:
        zeilen.append(f"Zielgruppe: {profil.zielgruppe}")
    if profil.verbotene_woerter:
        zeilen.append(
            "Diese Wörter dürfen NICHT vorkommen: "
            + ", ".join(profil.verbotene_woerter)
        )
    if profil.notiz:
        zeilen.append(f"Weitere Anweisung des Betriebs: {profil.notiz}")
    return "\n".join(zeilen)


def _warnungen(text: str, antwort: KiAntwort, profil: KiProfil) -> list[str]:
    """Hinweise, die den Text nicht verwerfen, aber genannt werden müssen.

    Beides ist ein Fall von „nicht still kürzen“ (Wurzel 5): ein bei
    MAX_TOKENS abgeschnittener Text sieht fertig aus, und ein verbotenes Wort
    fällt beim Überfliegen nicht auf.
    """
    raus: list[str] = []
    if antwort.abschlussgrund == "MAX_TOKENS":
        raus.append(
            "Der Text wurde beim Token-Limit abgeschnitten und endet "
            "möglicherweise mitten im Satz."
        )
    treffer = verbotene_woerter_treffer(text, profil)
    if treffer:
        raus.append(
            "Diese ausgeschlossenen Wörter kommen vor: " + ", ".join(treffer)
        )
    return raus


def _ohne_umrandung(text: str) -> str:
    """Ein Modell setzt gern Anführungszeichen oder einen Codeblock um seine
    Antwort, obwohl die Anweisung es verbietet. Das abzuräumen ist keine
    Erfindung, sondern das Entfernen einer Verpackung."""
    t = text.strip()
    if t.startswith("```"):
        zeilen = t.splitlines()
        if len(zeilen) >= 2:
            zeilen = zeilen[1:]
            if zeilen and zeilen[-1].strip().startswith("```"):
                zeilen = zeilen[:-1]
            t = "\n".join(zeilen).strip()
    if len(t) >= 2 and t[0] in "\"„“'" and t[-1] in "\"“”'":
        t = t[1:-1].strip()
    return t


def umschreiben(
    client: VertexClient, req: UmschreibenRequest, profil: KiProfil
) -> tuple[str, KiAntwort, list[str]]:
    """Markierten Text bearbeiten. Ergebnis ist immer ``ai_rewritten``."""
    quelle = _sprache_benennen(req.sprache)
    ziel = quelle
    if req.art is UmschreibArt.uebersetzen and req.zielsprache:
        ziel = _sprache_benennen(req.zielsprache)
    system = "\n".join(
        [
            _system_grundregeln(ziel, profil),
            "",
            "Du bearbeitest einen vorhandenen Text. Der Inhalt gehört dem "
            "Betrieb — du änderst die Form, nicht die Aussage.",
            _UMSCHREIB_AUFTRAG[req.art],
        ]
    )
    zusatz = ""
    if req.art is UmschreibArt.ton and req.ton:
        zusatz = f"\n\nGewünschter Tonfall: {req.ton}"
    if req.art is UmschreibArt.uebersetzen:
        zusatz = f"\n\nAusgangssprache: {quelle}. Zielsprache: {ziel}."
    user = f"Text:\n{req.text}{zusatz}"
    # Beim Verlängern braucht die Antwort mehr Platz als die Eingabe. Die
    # Rechnung ist grob (etwa vier Zeichen je Token) und großzügig gedeckelt —
    # der Client begrenzt zusätzlich auf MAX_ANTWORT_TOKENS.
    faktor = 3 if req.art is UmschreibArt.verlaengern else 2
    budget = min(2048, max(256, (len(req.text) // 4) * faktor))
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.3, max_tokens=budget
    )
    text = _ohne_umrandung(antwort.text)
    return text, antwort, _warnungen(text, antwort, profil)


def _seite_lesen(db: Client, tenant_id: str, page_id: str) -> dict:
    """Die Seite samt ihrer Abschnittstexte — tenant-gescoped (Wurzel 3).

    Der Scope steckt in derselben Abfrage wie der Ladevorgang. Ein Load ohne
    Scope mit anschließendem `!= tenant_id` ist genau das, was Wurzel 3
    verbietet — man vergisst den zweiten Schritt.
    """
    seiten = (
        db.table("site_pages")
        .select("id, title, slug, seo_title, seo_description, page_type, excerpt")
        .eq("id", page_id)
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or []
    if not seiten:
        raise SiteConfigError("Seite gehört nicht zu diesem Konto.", status_code=404)
    seite = seiten[0]
    bloecke = (
        db.table("site_blocks")
        .select("type, content")
        .eq("page_id", page_id)
        .eq("tenant_id", tenant_id)
        .order("position")
        .limit(50)
        .execute()
    ).data or []
    seite["_bloecke"] = bloecke
    return seite


def _seitentext(seite: dict, sprache: str) -> str:
    """Aus den Abschnitten einer Seite den sichtbaren Text zusammensetzen.

    Die Inhalte sind mehrsprachige Objekte (``{"de": "…", "en": "…"}``); es
    wird die angeforderte Sprachfassung genommen. Gibt es sie nicht, wird der
    Abschnitt ÜBERSPRUNGEN und nicht ersatzweise die deutsche genommen: eine
    englische Meta-Beschreibung aus deutschem Text zu bauen, ergibt eine
    Beschreibung, die zur Seite nicht passt.
    """
    stuecke: list[str] = []
    for block in seite.get("_bloecke") or []:
        inhalt = block.get("content")
        if not isinstance(inhalt, dict):
            continue
        for wert in inhalt.values():
            if isinstance(wert, str) and wert.strip():
                stuecke.append(wert.strip())
            elif isinstance(wert, dict):
                fassung = wert.get(sprache)
                if isinstance(fassung, str) and fassung.strip():
                    stuecke.append(fassung.strip())
    # Deckel: 6 000 Zeichen reichen für eine Meta-Beschreibung bei Weitem und
    # halten den Prompt bezahlbar.
    return "\n".join(stuecke)[:6_000]


def seo_erzeugen(
    client: VertexClient,
    db: Client,
    tenant_id: str,
    req: SeoRequest,
    profil: KiProfil,
) -> tuple[str, str, KiAntwort, list[str]]:
    """Meta-Titel und -Beschreibung aus dem TATSÄCHLICHEN Seiteninhalt.

    Aus dem Inhalt und nicht aus dem Seitennamen: eine Meta-Beschreibung, die
    nur den Titel umformuliert, ist für Google wertlos und für den Suchenden
    eine Lüge über den Seiteninhalt.
    """
    sprache = _sprache_benennen(req.sprache)
    seite = _seite_lesen(db, tenant_id, req.page_id)
    inhalt = _seitentext(seite, req.sprache)
    if not inhalt.strip():
        # Fail-closed statt „dann eben aus dem Titel“ (Wurzel 4): ohne Inhalt
        # gäbe es nur eine erfundene Beschreibung.
        raise SiteConfigError(
            "Diese Seite hat in dieser Sprache noch keinen Text, aus dem sich "
            "eine Beschreibung ableiten ließe.",
            status_code=422,
        )
    abgeleitet = abgeleitetes_profil(db, tenant_id)
    system = "\n".join(
        [
            _system_grundregeln(sprache, profil),
            "",
            "Du schreibst Suchmaschinen-Angaben für EINE Seite.",
            f"Zeile 1: der Meta-Titel, höchstens {SEO_TITEL_MAX} Zeichen.",
            f"Zeile 2: die Meta-Beschreibung, höchstens "
            f"{SEO_BESCHREIBUNG_MAX} Zeichen.",
            "Genau zwei Zeilen, keine Beschriftung, keine Nummerierung.",
            "Beide beschreiben, was auf DIESER Seite steht — nicht, was der "
            "Betrieb sonst noch anbietet.",
        ]
    )
    user = (
        f"Seitenname: {seite.get('title') or '(ohne Namen)'}\n\n"
        f"Betriebskontext:\n{kontext_text(abgeleitet, profil)}\n\n"
        f"Sichtbarer Text dieser Seite:\n{inhalt}"
    )
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.4, max_tokens=300
    )
    zeilen = [z.strip() for z in antwort.text.splitlines() if z.strip()]
    if len(zeilen) < 2:
        raise KiError(
            "Die KI hat keine zwei Zeilen geliefert (Titel und Beschreibung)."
        )
    titel = _ohne_umrandung(zeilen[0])
    beschreibung = _ohne_umrandung(zeilen[1])
    warnungen = _warnungen(f"{titel}\n{beschreibung}", antwort, profil)
    # Länge NACH der Erzeugung prüfen und melden, nicht abschneiden: ein bei
    # 60 Zeichen gekappter Titel endet mitten im Wort. Der Betrieb sieht die
    # Warnung und kürzt selbst — oder lässt es, weil ihm der Titel gefällt.
    if len(titel) > SEO_TITEL_MAX:
        warnungen.append(
            f"Der Titel ist {len(titel)} Zeichen lang; Google zeigt etwa "
            f"{SEO_TITEL_MAX}."
        )
    if len(beschreibung) > SEO_BESCHREIBUNG_MAX:
        warnungen.append(
            f"Die Beschreibung ist {len(beschreibung)} Zeichen lang; Google "
            f"zeigt etwa {SEO_BESCHREIBUNG_MAX}."
        )
    return titel, beschreibung, antwort, warnungen


def abschnitt_erzeugen(
    client: VertexClient,
    db: Client,
    tenant_id: str,
    req: AbschnittRequest,
    profil: KiProfil,
) -> tuple[str, KiAntwort, list[str]]:
    """Einen Abschnittstext NEU erzeugen — kennzeichnungspflichtig."""
    sprache = _sprache_benennen(req.sprache)
    abgeleitet = abgeleitetes_profil(db, tenant_id, property_id=req.property_id)
    system = "\n".join(
        [
            _system_grundregeln(sprache, profil),
            "",
            "Du schreibst einen Abschnitt für die Website eines "
            "Unterkunftsbetriebs.",
            f"Ungefähre Länge: {req.woerter} Wörter.",
            "Fließtext in Absätzen. Keine Überschrift, keine Aufzählung, "
            "wenn nicht ausdrücklich verlangt.",
        ]
    )
    user = (
        f"Auftrag: {req.auftrag}\n\n"
        f"Erfasste Daten (nur diese als Tatsachen verwenden):\n"
        f"{kontext_text(abgeleitet, profil)}"
    )
    # Etwa 1,6 Tokens je Wort bei europäischen Sprachen, plus Reserve.
    budget = min(2048, int(req.woerter * 2.2) + 120)
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.6, max_tokens=budget
    )
    text = _ohne_umrandung(antwort.text)
    return text, antwort, _warnungen(text, antwort, profil)


def blogbeitrag_erzeugen(
    client: VertexClient,
    db: Client,
    tenant_id: str,
    req: BlogbeitragRequest,
    profil: KiProfil,
) -> tuple[str, KiAntwort, list[str]]:
    """Einen Blogbeitrag NEU erzeugen.

    Der einzige Fall mit einem Fußhinweis beim Gast. Deshalb steht in der
    Anweisung zusätzlich, dass keine rechtlichen, steuerlichen oder
    behördlichen Angaben behauptet werden dürfen: genau die Beitragsarten
    (Kurtaxe, Meldepflicht, Umweltauflagen) reißen die Grenze zum
    „öffentlichen Interesse“, und genau dort ist eine erfundene Zahl teuer.
    """
    sprache = _sprache_benennen(req.sprache)
    abgeleitet = abgeleitetes_profil(db, tenant_id)
    system = "\n".join(
        [
            _system_grundregeln(sprache, profil),
            "",
            "Du schreibst einen Beitrag für den Blog eines "
            "Unterkunftsbetriebs.",
            f"Ungefähre Länge: {req.woerter} Wörter.",
            "Keine rechtlichen, steuerlichen oder behördlichen Angaben "
            "behaupten — keine Steuersätze, keine Fristen, keine Gebühren, "
            "keine Vorschriften. Ist das Thema ein solches, beschreibe es "
            "allgemein und verweise darauf, dass der Betrieb die aktuellen "
            "Angaben ergänzt.",
            "Erste Zeile: die Überschrift. Danach eine Leerzeile, dann der "
            "Beitrag in Absätzen.",
        ]
    )
    user = (
        f"Thema: {req.thema}\n\n"
        f"Betriebskontext (nur diese Angaben als Tatsachen verwenden):\n"
        f"{kontext_text(abgeleitet, profil)}"
    )
    budget = min(2048, int(req.woerter * 2.2) + 200)
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.7, max_tokens=budget
    )
    text = _ohne_umrandung(antwort.text)
    return text, antwort, _warnungen(text, antwort, profil)


def profil_vorschlagen(
    client: VertexClient, db: Client, tenant_id: str
) -> tuple[dict[str, str | None], KiAntwort]:
    """Aus den Stammdaten einen Vorschlag für Tonfall, Zielgruppe und
    Alleinstellung machen.

    Das ist unsere Antwort auf Dudas Pflicht-Assistenten: der Betrieb muss
    nichts eintippen, er bekommt drei Vorschläge und ändert, was ihm nicht
    passt. Gespeichert wird erst durch seine Bestätigung — ein Vorschlag, der
    sich selbst speichert, wäre wieder eine Behauptung über einen Betrieb, den
    wir nicht gefragt haben.
    """
    # Der Vorschlag entsteht aus den Daten, nicht aus einer schon gespeicherten
    # Haltung — sonst schlägt das Modell dem Betrieb vor, was er ohnehin schon
    # gesagt hat.
    leeres_profil = KiProfil()
    abgeleitet = abgeleitetes_profil(db, tenant_id)
    if not abgeleitet.objekte:
        raise SiteConfigError(
            "Für einen Vorschlag braucht es mindestens ein aktives Objekt mit "
            "erfassten Daten.",
            status_code=422,
        )
    system = "\n".join(
        [
            # Der Vorschlag ist eine ARBEITSANWEISUNG für den Betrieb und
            # steht deshalb in der Oberflächensprache Deutsch — nicht in einer
            # Website-Sprache. Er landet nie beim Gast.
            _system_grundregeln("Deutsch", leeres_profil),
            "",
            "Du schlägst einem Unterkunftsbetrieb vor, wie seine Website "
            "klingen sollte. Grundlage sind ausschließlich seine erfassten "
            "Daten.",
            "Genau drei Zeilen, jede mit ihrem Präfix:",
            "TON: <ein Satz zum Tonfall>",
            "ZIELGRUPPE: <ein Satz, wer angesprochen wird>",
            "ALLEINSTELLUNG: <ein Satz, was diesen Betrieb unterscheidet — "
            "nur aus den Daten belegbar>",
            "Lässt sich eine Zeile aus den Daten nicht belegen, schreibe hinter "
            "das Präfix nichts.",
        ]
    )
    user = f"Erfasste Daten:\n{kontext_text(abgeleitet, leeres_profil)}"
    antwort = client.erzeuge(
        system=system, user=user, temperature=0.5, max_tokens=400
    )
    vorschlag: dict[str, str | None] = {
        "ton": None,
        "zielgruppe": None,
        "alleinstellung": None,
    }
    for zeile in antwort.text.splitlines():
        for praefix, feld in (
            ("TON:", "ton"),
            ("ZIELGRUPPE:", "zielgruppe"),
            ("ALLEINSTELLUNG:", "alleinstellung"),
        ):
            if zeile.strip().upper().startswith(praefix):
                wert = zeile.split(":", 1)[1].strip()
                vorschlag[feld] = _ohne_umrandung(wert) or None
    return vorschlag, antwort


def profil_fuer(db: Client, tenant_id: str) -> KiProfil:
    """Kurzform für die Aufrufer im Router."""
    return profil_lesen(db, tenant_id)


# --- Von anderen Modulen des Slice genutzt ----------------------------------
#
# `seiten_uebersetzung` (0476) braucht dieselben drei Helfer: denselben
# Sprachnamen, dieselben Grundregeln („nichts erfinden") und dasselbe
# Abraeumen der Modell-Verpackung. Sie ein zweites Mal zu schreiben waere die
# Doppelung, gegen die Wurzel 2 steht — und die Kopie wuerde beim naechsten
# Nachschaerfen der Grundregeln vergessen.
#
# Oeffentliche Namen statt eines Zugriffs auf `_sprache_benennen`: ein Import
# ueber den Unterstrich sagt „privat, aber ich nehme es trotzdem" und bricht,
# sobald hier jemand umbenennt.
sprache_benennen = _sprache_benennen
system_grundregeln = _system_grundregeln
ohne_umrandung = _ohne_umrandung
