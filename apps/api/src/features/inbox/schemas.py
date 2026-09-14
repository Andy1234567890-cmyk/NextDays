"""Pydantic-Schemas für den inbox-Slice.

Posteingang für OTA-Gästekommunikation. Ein Thread entspricht einer OTA-Buchung
(channex_booking). Nachrichten werden über die Channex-Messaging-API gelesen und
gesendet (Booking.com/Airbnb/Expedia); ein optionaler KI-Antwortvorschlag (Groq)
hilft beim Beantworten. Threads sind mit der lokalen Reservierung verknüpft.
"""
from typing import Literal

import nh3
from pydantic import BaseModel, Field, field_validator

# --- Allowlist für Vorlagen-HTML (Wurzel 8) ---------------------------------
# Eigene Liste im Slice statt Import aus announcements/site_config: die
# Slice-Grenze ist Absicht (siehe announcements/schemas.py). Die Angreifermodelle
# unterscheiden sich, und wer eine Liste ändert, hat NICHT die andere geändert.
#
# Was eine Nachrichten-Vorlage darf, ist durch ihr ZIEL begrenzt: der Text geht
# als KLARTEXT an Airbnb/Booking (`html_zu_text`). Alles, was im Klartext keine
# Entsprechung hat, wäre reine Editor-Zierde, die beim Gast spurlos verschwindet
# — und jedes zusätzlich erlaubte Element ist Angriffsfläche ohne Gegenwert.
#
# BEWUSST NICHT dabei:
#   `img`      — eine Vorlage überträgt kein Bild; ein `src` auf einen fremden
#                Host meldete IP und Zeitpunkt jedes Betrachters weiter.
#   `span`/`style` — Inline-CSS ist im Klartext bedeutungslos.
#   `h1`–`h6`, `blockquote`, `pre` — der Chat kennt keine Überschriftenebene.
_VORLAGEN_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a",
}
# `rel` NICHT hier — nh3 setzt es selbst via `link_rel` (sonst ValueError).
_VORLAGEN_ATTRS = {"a": {"href", "title"}}


def sanitize_vorlagen_html(value: str | None) -> str:
    """Vorlagen-HTML serverseitig mit echtem Allowlist-Parser säubern.

    nh3 (ammonia, Rust) PARST das HTML, statt es per Regex zu beschneiden:
    `<script>`, `onerror=`, `javascript:`-hrefs und `data:`-URIs fallen damit
    weg, unabhängig von der Schreibweise. „HTML NIE per Regex säubern"
    (CLAUDE.md, Wurzel 8) — ein Regex-Sanitizer ist eine Aufzählung der Angriffe,
    an die der Autor gerade gedacht hat.

    Gesäubert wird beim SPEICHERN, in create UND update: läge der Validator nur
    am POST, wäre PUT das Loch, durch das rohes HTML einläuft.
    """
    return nh3.clean(
        value or "",
        tags=_VORLAGEN_TAGS,
        attributes=_VORLAGEN_ATTRS,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer nofollow",
    )


class InboxThread(BaseModel):
    id: str                         # channex_booking.id
    channex_booking_id: str | None = None  # Channex-Booking-UUID (für Messages)
    reservation_id: str | None = None      # verknüpfte lokale Reservierung
    guest_id: str | None = None            # verknüpfter Gast (Resolver) → Gästekarte
    property_id: str | None = None         # zugeordnetes Objekt (für Filter/Anzeige)
    property_title: str | None = None
    ota_name: str | None = None     # Kanal (myBestDays, Booking.com, Airbnb, …)
    ota_reservation_code: str | None = None
    guest_name: str | None = None
    # Profilbild beim Portal (0295, Airbnb `v2/users/{id}`). None = das Portal
    # führt keins; die Liste zeigt dann Initialen statt eines Platzhalters.
    guest_avatar_url: str | None = None
    guest_email: str | None = None
    # Telefonnummer des Gastes: die Liste gruppiert daran den WhatsApp-Verlauf
    # als Unterpunkt UNTER seine Buchung (sonst steht er unverbunden daneben).
    guest_phone: str | None = None
    # Sprache des Gastes beim Portal — ROHWERT („it", „de-AT", „nb"), normiert
    # wird beim Vergleich (`core.languages.basis_sprache`).
    #
    # WARUM SIE AM THREAD HÄNGT: bis 24.08.2026 kannte nur die Automail-Planung
    # sie (`planung._gastsprache`). Die Oberfläche des Gesprächs bekam sie erst
    # über die Reservierungs-Karte NEBENAN — und das Vorlagen-Menü im Composer,
    # das direkt darunter sitzt, fügte deshalb IMMER die Grundfassung ein.
    # Der Betrieb pflegte 18 Vorlagen in drei Sprachen und schrieb seine
    # dänischen Gäste von Hand auf Englisch an, weil nichts die gepflegte
    # dänische Fassung anbot. Am Thread steht die Sprache dort, wo jeder
    # Verbraucher sie braucht, statt in einem Nebenfenster.
    #
    # KEINE MASKIERUNG: die Sprache ist kein Kontaktweg (anders als Mail und
    # Telefon, die `mask.contact_value` je Rolle ausblendet). Sie steuert, in
    # welcher Fassung geantwortet wird — wer den Thread beantworten darf, muss
    # das wissen.
    guest_language: str | None = None
    status: str | None = None       # new | modified | cancelled
    arrival_date: str | None = None
    departure_date: str | None = None
    last_message: str | None = None  # Vorschau der letzten Nachricht
    # Absender der letzten Nachricht: "guest" (der Gast wartet auf Antwort)
    # oder "property" (wir haben zuletzt geschrieben). Beantwortet in der Liste
    # die Frage „habe ich schon geantwortet?", ohne den Thread zu öffnen.
    last_sender: str | None = None
    # WANN der Gast beim Portal gebucht hat (0291/0292).
    booked_at: str | None = None
    # Die Zeit, die in der Liste steht und nach der sie sortiert — als EIN Feld,
    # das der Server entscheidet.
    #
    # WARUM NICHT `updated_at` an der Anzeigestelle (Wurzel 5b): `updated_at`
    # ist unsere Schreibzeit. Als der Feed 22 Airbnb-Buchungen in einem Rutsch
    # holte, trugen alle dieselbe Sekunde — die Liste zeigte Buchungen aus März,
    # Juni und Juli als „vor 24 m". Das Feld ist zudem überladen: bei WhatsApp
    # trägt es `last_at`, also sehr wohl ein Fremdereignis. Dieselbe Spalte
    # bedeutet je Kanal etwas anderes, und an jeder Anzeigestelle musste man das
    # wissen — das ist die Wurzel, nicht die Formatierung.
    #
    # Deshalb füllt der Server dieses Feld nach EINER Regel: der Zeitpunkt beim
    # Portal, sonst nichts. Ist er leer, bleibt das Feld leer und die Liste
    # zeigt statt einer Uhrzeit gar nichts — nie unsere eigene Uhr als fremdes
    # Ereignis ausgeben (Wurzel 4).
    letzte_aktivitaet: str | None = None
    updated_at: str | None = None
    is_read: bool = True
    is_starred: bool = False
    is_archived: bool = False
    inbox_status: str = "active"           # active|archived|trashed
    assigned_user_id: str | None = None    # zugewiesener Tenant-Benutzer
    assigned_user_name: str | None = None


class AnfrageDetail(BaseModel):
    """Eine offene Airbnb-Anfrage über dem Chat (0398).

    Alle Werte kommen aus der Airbnb-Payload; keiner wird ersetzt, wenn er
    fehlt (Wurzel 4). Beträge bleiben TEXT, wie das Portal sie liefert — eine
    Umrechnung in Zahlen wäre die Stelle, an der aus „2906.80" ein
    Rundungsfehler wird.
    """

    thread_id: str
    event_id: str
    # inquiry | reservation_request | alteration_request
    art: str
    # Die für DIESE Art erlaubten Aktionen — die Oberfläche zeigt nur sie.
    aktionen: list[str] = []
    beantwortbar: bool = False
    # Warum nicht beantwortbar. Entweder der Status DES PORTALS ("accepted",
    # "declined", "expired", "withdrawn", "cancelled") oder — wenn das Portal
    # schweigt — unsere eigene Aussage ("beantwortet", "keine_channex_id").
    # Kürzel, kein Satz: die Worte macht die Oberfläche (24 Sprachen).
    grund_gesperrt: str | None = None
    # "portal" = Airbnb sagt es (System-Nachricht im Thread, `meta.status`);
    # "abgeleitet" = wir schließen es aus dem Verlauf. Die Oberfläche macht
    # den Unterschied sichtbar, statt eine Vermutung wie eine Auskunft
    # aussehen zu lassen (Wurzel 5b).
    status_quelle: str = "abgeleitet"
    # Airbnbs `non_response_at`: wann die Anfrage von selbst abläuft. None =
    # das Portal nennt keine Frist; dann zeigt die Oberfläche keinen Countdown
    # statt einer geratenen 24-Stunden-Regel (Wurzel 5b).
    frist: str | None = None
    objekt: str | None = None
    gastname: str | None = None
    anreise: str | None = None
    abreise: str | None = None
    naechte: str | None = None
    gaeste: str | None = None
    erwachsene: str | None = None
    kinder: str | None = None
    kleinkinder: str | None = None
    tiere: str | None = None
    # Airbnbs `payout_amount` — der NETTO-Auszahlbetrag, nicht der Gastpreis.
    # Der Feldname sagt das ausdrücklich, damit ihn niemand als Umsatz liest.
    payout_betrag: str | None = None
    waehrung: str | None = None


class AnfrageEntscheidung(BaseModel):
    """Die Entscheidung des Betriebs zu einer Anfrage.

    Spiegelt `channel_manager.schemas.AirbnbAnfrageAntwort` — der Posteingang
    reicht sie unverändert dorthin durch, statt eine zweite Sendelogik zu
    bauen. Eine rohe `resolution` nimmt auch dieser Weg NICHT entgegen
    (Wurzel 3).
    """

    aktion: str
    grund: str | None = None
    nachricht_an_gast: str | None = None
    nachricht_an_airbnb: str | None = None
    sofortbuchung_sperren: bool = False
    gesamtpreis_minor: int | None = None


class InboxListResponse(BaseModel):
    items: list[InboxThread] = []
    total: int = 0


class InboxEventFact(BaseModel):
    """Eine Zeile im aufgeklappten Ereignis: übersetztes Etikett + Rohwert.

    `label` ist ein Kürzel für den i18n-Katalog (`inbox.eventFact*`), `value`
    die Angabe der Gegenseite (Reservierungsnummer, Datum, OTA-Buchungszeit) —
    unverändert, damit im Streitfall dasselbe dasteht wie im OTA-Extranet.
    """

    label: str
    value: str


class InboxMessage(BaseModel):
    id: str | None = None
    message: str
    # "guest" | "property" | "note" | "event"
    # "event" = Ereignis der Reservierung im Verlauf (Buchungseingang,
    # Statuswechsel) — die Vorbilder (Lodgify/Hostaway) zeigen den Chat und den
    # Lebenslauf der Buchung in EINEM Strang, sonst fehlt der Zusammenhang
    # zwischen „Gast fragt nach spätem Check-in" und „Buchung kam um 22:18".
    sender: str
    sent_at: str | None = None
    author_name: str | None = None  # bei internen Notizen: Verfasser
    # Nur bei sender="event": Kopfzeile, aufklappbarer Inhalt, Herkunftskanal.
    event_title: str | None = None
    # Roher Zusatzwert (Statuswechsel: 'modified'|'cancelled'). Die Worte macht
    # die Oberfläche — hier steht KEIN fertiger Satz: der Server kennt die
    # Sprache des Betrachters nicht, und 24 Kataloge lassen sich nicht aus
    # Python bedienen.
    event_detail: str | None = None
    # Aufklappbare Angaben als Paare (Schlüssel, Wert). Der Schlüssel ist ein
    # i18n-Kürzel, der Wert kommt unverändert von der Gegenseite.
    event_facts: list["InboxEventFact"] = []
    event_channel: str | None = None
    # Bildanhänge der Nachricht (Channex `attributes.attachments`, live am
    # 07.08.2026 nachgemessen: eine Liste blanker URLs). Schickt der Gast nur
    # ein Foto, ist `message` LEER — ohne dieses Feld stand im Verlauf eine
    # leere Blase, und „Se bildet" verwies auf ein Bild, das nie ankam.
    #
    # Nur URLs, die `_sichere_anhang_url` passiert haben (https, Channex-Host):
    # der Wert kommt von der Gegenseite und landet in einem `src` (Wurzel 8).
    attachments: list[str] = []


class InboxMessagesResponse(BaseModel):
    items: list[InboxMessage] = []
    total: int = 0
    # Warum der Portal-Chat gerade nichts liefert (Kürzel, die Oberfläche
    # formuliert). Bislang nur "chat_app_missing": die kostenpflichtige
    # Chat-Anwendung ist an diesem Objekt bei Channex nicht installiert, die
    # Messaging-API antwortet dann mit 403.
    unavailable: str | None = None
    # Bis WANN der Gast gelesen hat (0297) — Zeitpunkt beim Portal. Die
    # Oberfläche setzt das Häkchen an jede eigene Nachricht mit
    # `sent_at <= guest_read_at`; ein Lesestand gilt rückwirkend für alles
    # Ältere, weil Airbnb genau das meldet („war bis hierher").
    #
    # Bewusst EIN Wert an der Antwort statt eines Flags je Nachricht: der
    # Lesestand ist eine Eigenschaft des Threads. Pro Nachricht gespeichert
    # müsste er bei jedem Lesen für alle Nachrichten neu geschrieben werden.
    #
    # None = dieser Kanal meldet keinen Lesestand (Channex führt gar keinen,
    # nachgemessen). Dann zeigt die Oberfläche KEIN Häkchen — nicht „ungelesen",
    # denn das wüssten wir nicht (Wurzel 4).
    guest_read_at: str | None = None


class ReservationDetail(BaseModel):
    """Reservierungs-Kontext rechts neben dem Chat (white-label)."""

    listing_name: str | None = None
    listing_photo: str | None = None       # Vorschaubild der Unterkunft
    address: str | None = None
    rental_id: str | None = None           # lokale Objekt-ID (Cache)
    guest_name: str | None = None
    guest_email: str | None = None
    guest_phone: str | None = None
    guest_language: str | None = None
    guest_location: str | None = None      # Ort/Land des Gastes (aus der OTA)
    # Aus einem Bestands-Import, nicht live eingegangen (0308). Erklärt die
    # leeren Gastfelder oben: Booking.com liefert für Altbuchungen dokumentiert
    # nur den Namen. Ohne diesen Hinweis sieht der erwartete Zustand wie ein
    # Datenverlust aus.
    is_imported: bool = False
    adults: int | None = None
    children: int | None = None
    nights: int | None = None
    total_amount: float | None = None
    paid_amount: float | None = None
    currency: str | None = None
    status: str | None = None
    ota_name: str | None = None
    ota_reservation_code: str | None = None
    check_in: str | None = None
    check_out: str | None = None
    checkin_time: str | None = None
    checkout_time: str | None = None
    note: str | None = None                # interne Notiz (Gastgeber)
    is_starred: bool = False


class SendMessageRequest(BaseModel):
    message: str


class ThreadFlagsUpdate(BaseModel):
    """Interne Konversations-Flags (Favorit/Notiz/Lesen/Archiv/Erinnerung)."""

    is_starred: bool | None = None
    note: str | None = None
    is_read: bool | None = None
    is_archived: bool | None = None
    remind_at: str | None = None


class AiReplyRequest(BaseModel):
    """Optionaler Kontext für den KI-Vorschlag (z.B. der Gast-Text)."""

    prompt: str | None = None


class AiReplyResponse(BaseModel):
    reply: str
    sources: list[str] = []
    # Gesetzt, wenn das Modell eine Wissenslücke gemeldet hat. Die Oberfläche
    # bietet daraufhin „der KI beibringen" an — der Punkt, an dem sich die
    # Wissensdatenbank von selbst füllt.
    fehlende_angabe: str | None = None
    # Das Modell hat negativen Tenor erkannt (11b). Der Verlauf trägt dann ein
    # Merkmal; hier steht nur, DASS es gesetzt wurde.
    eskaliert: bool = False


# --- Sprachen des Betriebs (0363) -------------------------------------------
class MessageLanguage(BaseModel):
    """Eine Sprache, in der der Betrieb seine Nachrichten pflegt.

    Genau eine trägt `is_default = True`; sie ist der Rückfall, wenn die Sprache
    des Gastes keine Fassung hat. Es kann auch GAR KEINE Sprache gepflegt sein —
    dann gibt es nur die Grundfassung, und die Oberfläche zeigt keine Reiter.
    """

    code: str            # ISO-639-1, zweistellig, klein
    is_default: bool = False


class MessageLanguageList(BaseModel):
    items: list[MessageLanguage] = []


class MessageLanguageAdd(BaseModel):
    code: str


class LanguageOption(BaseModel):
    """Auswählbare Sprache für „Neue Sprache hinzufügen" (Katalog des Servers).

    Der Name kommt vom Server, nicht aus den Frontend-Übersetzungen: die Liste
    ist eine Datenaussage (welche Sprachen führen wir?), keine Beschriftung.
    """

    code: str
    name: str


class LanguageOptionList(BaseModel):
    items: list[LanguageOption] = []


class TranslateFassungRequest(BaseModel):
    """Grundfassung, die in eine Zielsprache übersetzt werden soll."""

    body: str = ""
    subject: str | None = None
    target: str
    format: Literal["html", "text"] = "html"


class TranslateFassungResponse(BaseModel):
    body: str = ""
    subject: str | None = None
    lang: str


# --- Vorlagen ---------------------------------------------------------------
class TemplateText(BaseModel):
    """Sprachfassung einer Vorlage (Betreff + Inhalt in EINER Sprache).

    `subject` gilt nur für E-Mail — der Gast-Chat der Portale überträgt keinen
    Betreff. Leer heißt „nicht gepflegt", nicht „leerer Betreff".
    """

    lang: str
    subject: str = ""
    body: str = ""
    body_html: str = ""


class TemplateTextUpsert(BaseModel):
    """Was der Editor je Sprache schickt. Maßgeblich ist `body_html`.

    `body` fehlt hier absichtlich: der Klartext wird serverseitig aus dem
    gesäuberten HTML abgeleitet (Wurzel 3, wie bei `TemplateUpsert`).
    """

    lang: str
    subject: str = ""
    body_html: str = ""

    @field_validator("body_html")
    @classmethod
    def _html_saeubern(cls, wert: str) -> str:
        return sanitize_vorlagen_html(wert)


class MessageTemplate(BaseModel):
    """Eine Vorlage in BEIDEN Formen.

    `body_html` ist das AUTORENFORMAT (der Editor arbeitet damit), `body` der
    daraus abgeleitete Klartext und die VERSANDQUELLE — Airbnb und Booking
    übertragen im Gast-Chat nur Text. Leeres `body_html` heißt „noch nie
    formatiert": das Frontend baut sich daraus per `textZuHtml` einen
    Editor-Inhalt aus dem Klartext (kein Backfill nötig).

    `body`/`body_html`/`subject` sind die GRUNDFASSUNG (ohne Sprachangabe),
    `texts` die Sprachfassungen (0363). Welche davon an einen Gast geht,
    entscheidet `sprachen.fassung_waehlen`.
    """

    id: str
    title: str
    body: str
    body_html: str = ""
    subject: str = ""
    texts: list[TemplateText] = []


class MessageTemplateList(BaseModel):
    items: list[MessageTemplate] = []
    total: int = 0


class TemplateUpsert(BaseModel):
    """Was der Editor schickt. Maßgeblich ist `body_html`.

    `body` wird ENTGEGENGENOMMEN, aber NICHT übernommen: der Server leitet den
    Klartext selbst aus dem gesäuberten `body_html` ab (Wurzel 3 — der Anfrage
    nicht vertrauen). Sonst könnte ein Client harmloses HTML zeigen und einen
    ganz anderen Text versenden lassen, denn der Versand nimmt `body`.
    """

    title: str
    body: str = ""
    body_html: str = ""
    subject: str = ""
    # Sprachfassungen. Fehlt das Feld in der Anfrage, bleiben die vorhandenen
    # Fassungen unangetastet (`None`) — eine leere LISTE dagegen heißt
    # ausdrücklich „alle Sprachfassungen entfernen". Ohne diese Unterscheidung
    # löschte jeder Aufruf einer älteren Oberfläche still alle Übersetzungen.
    texts: list[TemplateTextUpsert] | None = None

    @field_validator("body_html")
    @classmethod
    def _html_saeubern(cls, wert: str) -> str:
        return sanitize_vorlagen_html(wert)


# --- Platzhalter (Felder) ----------------------------------------------------
class FieldEntry(BaseModel):
    key: str      # stabiler, sprachneutraler Schlüssel — {{key}} im Text
    group: str    # guest | reservation | property | company (Gruppierung im Picker)


class FieldCatalog(BaseModel):
    items: list[FieldEntry] = []


class RenderRequest(BaseModel):
    text: str


class RenderResponse(BaseModel):
    text: str


# --- KI-Einstellungen -------------------------------------------------------
class AiSettings(BaseModel):
    tone: str = "freundlich"
    language: str = "auto"
    signature: str | None = None
    extra_prompt: str | None = None
    # Ob die OBERFLÄCHE einen Vorschlag anbietet — nicht, ob die KI selbst
    # antwortet. Die beiden zu vermengen hieße, dass ein Betrieb mit
    # eingeschaltetem Vorschlag ungefragt automatisch antwortet.
    auto_suggest: bool = True

    # Der große Schalter (0493). Vorgabe AUS: Autoantwort wird bewusst
    # eingeschaltet, nie geerbt.
    autoantwort_aktiv: bool = False
    # Wartezeit vor dem automatischen Versand. Ihr Sinn ist nicht Rechenzeit,
    # sondern der Mensch: in diesem Fenster kann ein Mitarbeiter selbst
    # antworten, und dann wird die KI-Antwort verworfen.
    autoantwort_verzoegerung_minuten: int = Field(default=5, ge=0, le=1440)

    # Wie lang die KI antwortet (0497). Wirkt auf ZWEI Dinge: das Token-Budget
    # des Vertex-Aufrufs UND eine Zeile im System-Prompt. Nur das Budget zu
    # senken genügt nicht — das Modell schreibt dann denselben langen Text und
    # bricht mitten im Satz ab.
    antwortlaenge: Literal["kurz", "standard", "ausfuehrlich"] = "standard"


# --- Automatisierungen ------------------------------------------------------
# Der Auslöser bestimmt Anker UND Richtung (0307, `ausloeser.py`): „vor Anreise"
# ist Anker=arrival mit negativem Versatz. `anchor` wird deshalb serverseitig
# abgeleitet und ist in der Anfrage bedeutungslos; `offset_value` trägt nur noch
# den BETRAG (das Vorzeichen setzt der Auslöser). send_time = "HH:MM".
# property_ids/channels = Zuweisung (leer = alle); UND-verknüpft (Haus UND Kanal).
#
# Beim Auslöser `message_received` (Abwesenheitsantwort) sind anchor/offset_days/
# send_time bedeutungslos — die Nachricht geht sofort raus. Stattdessen greifen
# window_days/window_from/window_to: das Zeitfenster, in dem der Auslöser
# überhaupt feuern DARF (für eine Abwesenheitsantwort also die geschlossenen
# Zeiten, nicht die Bürozeiten).

# Obergrenze des Versatzes (Wurzel 8). Zwei Jahre in Tagen decken jede sinnvolle
# Regel ab — „ein Jahr nach Abreise" als Wiederkehr-Erinnerung ist das Äußerste,
# was ein Betrieb plant. Ohne Grenze nahm das Feld jede Zahl an, und ein Wert
# wie 999999999 ließ die Datumsrechnung mit OverflowError abbrechen: das riss
# die Planung ALLER Regeln dieser Buchung mit, still (Import-Pfad fängt breit).
# Bei Minuten/Stunden ist die Grenze großzügig, aber ebenfalls endlich.
_MAX_VERSATZ = 730


class AutomationBase(BaseModel):
    name: str
    # booking_new|before_checkin|after_checkin|before_checkout|after_checkout|
    # message_received — der vollständige Katalog steht in `ausloeser.py`.
    trigger: str
    # Abgeleitet aus `trigger`; in der Anfrage ignoriert (nur Ausgabe).
    anchor: str = "arrival"    # arrival|departure|booking
    offset_days: int = Field(default=0, ge=-_MAX_VERSATZ, le=_MAX_VERSATZ)
    # Versatz zum Anker in der gewählten Einheit. `offset_days` bleibt für den
    # Bestand erhalten und wird bei Tages-Regeln mitgeschrieben (0303).
    offset_unit: Literal["minutes", "hours", "days"] = "days"
    offset_value: int = Field(default=0, ge=-_MAX_VERSATZ, le=_MAX_VERSATZ)
    # None = keine feste Uhrzeit. Bei Tagen heißt das Mitternacht des Ankertags;
    # bei Stunden/Minuten bestimmt der Versatz die Zeit ohnehin selbst.
    send_time: str | None = None  # "HH:MM"
    property_ids: list[str] = []
    channels: list[str] = []
    template_id: str | None = None
    message: str | None = None
    is_active: bool = True
    # Sendezeit in der Zeitzone des Objekts auflösen statt in UTC. Fehlt am Objekt
    # die Zeitzone, wird NICHT geplant (kein stilles Ausweichen auf UTC).
    # Ohne Wirkung seit 14.09.2026: die Uhrzeit gilt immer in Objekt-Ortszeit.
    use_property_timezone: bool = True
    # Nur message_received:
    only_first_message: bool = False   # nur die erste Gastnachricht im Thread
    window_days: list[int] = []        # 0=Mo … 6=So; leer = alle Tage
    window_from: str | None = None     # "HH:MM"; mit window_to das Zeitfenster
    window_to: str | None = None       # darf über Mitternacht gehen (22:00–06:00)


class AutomationText(BaseModel):
    """Sprachfassung des Freitexts einer Regel.

    Nur Klartext (`message`), kein HTML: dieser Text geht an derselben Stelle in
    den Versand wie die Grundfassung `message_automation.message` und wird als
    KLARTEXT verschickt. Markup stünde wörtlich beim Gast.
    """

    lang: str
    subject: str = ""
    message: str = ""


class Automation(AutomationBase):
    id: str
    subject: str = ""
    texts: list[AutomationText] = []


class AutomationList(BaseModel):
    items: list[Automation] = []
    total: int = 0


class AutomationUpsert(AutomationBase):
    subject: str = ""
    # Wie bei `TemplateUpsert`: None = unangetastet, [] = alle entfernen.
    texts: list[AutomationText] | None = None


# --- Zuweisung --------------------------------------------------------------
class TeamMember(BaseModel):
    id: str
    name: str
    email: str | None = None


class TeamMemberList(BaseModel):
    items: list[TeamMember] = []
    total: int = 0


class AssignRequest(BaseModel):
    user_id: str | None = None     # None → Zuweisung aufheben


class InboxStatusUpdate(BaseModel):
    status: str                    # active|archived|trashed|deleted


class LinkGuestRequest(BaseModel):
    # None → „Gast aus Thread anlegen" (Resolver über customer-JSON);
    # gesetzt → bestehenden (tenant-eigenen) Gast verknüpfen.
    guest_id: str | None = None


class LinkGuestResponse(BaseModel):
    guest_id: str | None = None


# --- Interne Notiz (gelb im Verlauf) ----------------------------------------
class NoteCreate(BaseModel):
    body: str


# --- Geplante Nachrichten ----------------------------------------------------
class ScheduleCreate(BaseModel):
    body: str
    send_at: str                   # ISO-Zeitpunkt (UTC)


class ScheduledMessage(BaseModel):
    id: str
    thread_id: str
    body: str
    send_at: str
    status: str                    # pending|sent|failed|cancelled


class ScheduledMessageList(BaseModel):
    items: list[ScheduledMessage] = []
    total: int = 0


# --- Anhänge -----------------------------------------------------------------
class Attachment(BaseModel):
    id: str
    filename: str
    mime: str
    size: int
    # Signierte Download-URL (privater Bucket, befristet) — nie ein öffentlicher
    # Pfad: an einem Anhang können Türcodes, Ausweise oder Rechnungen hängen.
    url: str | None = None
    created_at: str | None = None
    sent_at: str | None = None       # gesetzt, sobald an den Kanal übergeben
    channel_error: str | None = None  # warum der Kanal ihn nicht angenommen hat


class AttachmentList(BaseModel):
    items: list[Attachment] = []
    total: int = 0


# --- KI-Wissensdatenbank ------------------------------------------------------
class KnowledgeFact(BaseModel):
    id: str
    # None = gilt für den ganzen Betrieb, sonst nur für dieses Objekt.
    property_id: str | None = None
    property_title: str | None = None
    # None bei Altbestand aus 0260 — die Oberfläche zeigt dort den Textanfang.
    titel: str | None = None
    fact: str
    # objekt|anreise|buchung|umgebung|stoerung|ausstattung|sonstiges
    kategorie: str = "sonstiges"
    source: str                      # manual | document | message
    source_ref: str | None = None    # Dateiname bzw. Thread, aus dem er stammt
    quelle_id: str | None = None
    # Dateiname der Herkunft — nur bei Fakten aus einem Dokument gesetzt.
    quelle_datei: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class KnowledgeFactList(BaseModel):
    items: list[KnowledgeFact] = []
    total: int = 0
    seite: int = 1
    pro_seite: int = 20


class KnowledgeFactUpsert(BaseModel):
    property_id: str | None = None
    titel: str | None = None
    fact: str
    kategorie: str = "sonstiges"


class KiEskalation(BaseModel):
    """Ein eskalierter Verlauf (0498).

    `ausloeser` trennt die zwei Wege: 'stimmung' hat das Modell erkannt,
    'regel' hat der Betrieb selbst formuliert. Für die Anzeige derselbe Kasten,
    für die Diagnose ein Unterschied."""

    id: str
    thread_id: str
    quelle: Literal["inbox", "whatsapp"] = "inbox"
    ausloeser: Literal["stimmung", "regel"] = "stimmung"
    regel_id: str | None = None
    grund: str
    nachricht_auszug: str | None = None
    created_at: str | None = None


class KiEskalationList(BaseModel):
    items: list[KiEskalation] = []
    total: int = 0


class KiKontextAbschnitt(BaseModel):
    """Ein Abschnitt des Kontext-Panels — der TEXT, der in den Prompt geht.

    Keine Beschreibung dessen, was drinsteht, sondern der Inhalt selbst. Ohne
    ihn ist eine falsche Antwort nicht diagnostizierbar: man rät, ob ein Fakt
    fehlte, ein Abschnitt nicht ausgewählt wurde oder das Modell sich etwas
    zurechtgelegt hat."""

    titel: str
    inhalt: str
    quelle: str
    zeichen: int = 0


class KiKontextAntwort(BaseModel):
    abschnitte: list[KiKontextAbschnitt] = []
    quellen: list[str] = []
    # Was NICHT mitkam und warum — gekürzt, kein Platz mehr, oder gesperrt.
    # Ein gesperrter Abschnitt erscheint hier ausdrücklich: sonst sucht jemand
    # den Fehler in der Gästemappe, wo gar keiner ist.
    weggelassen: list[str] = []
    zugang_gesperrt: bool = False
    zeichen: int = 0
    max_zeichen: int = 0


class KiTestFrage(BaseModel):
    """Eine Testfrage an die KI. Es wird NICHTS gesendet."""

    property_id: str | None = None
    frage: str = Field(min_length=1, max_length=1500)
    # Der bisherige Testverlauf, damit mehrere Fragen aufeinander aufbauen —
    # wie im Ernstfall. Gedeckelt (Wurzel 8).
    verlauf: list[str] = Field(default_factory=list, max_length=20)


class KiTestAntwort(BaseModel):
    antwort: str
    kontext: KiKontextAntwort
    # Was im ERNSTFALL passiert wäre: welche Regel griff, welche Zustellart,
    # ob eine Sperre zuschlug. Das ist der Sinn des Tests — nicht der Text.
    zustellart: Literal["entwurf", "automatisch"]
    # None heisst: es wurde NICHTS verhindert. `zustellart_entscheiden` setzt
    # den Grund nur, wenn eine automatische Zustellung unterbunden wurde —
    # „automatisch, kein Grund" ist der Normalfall und kein leerer String.
    grund: str | None = None
    regel_name: str | None = None
    # Gesetzt, wenn die Antwort eine Wissenslücke meldet: dann steht hier, was
    # fehlt, und die Oberfläche bietet „der KI beibringen" an.
    fehlende_angabe: str | None = None


class WissenImportVorschlag(BaseModel):
    """Ein Faktenvorschlag aus einem Dokument — noch NICHT gespeichert.

    Der Import ist zweistufig: die Vorschläge gehen an die Oberfläche, ein
    Mensch wählt aus, erst dann entstehen Fakten. Ein Dokument, das ungeprüft
    einfliesst, macht die KI zur Sprecherin eines Textes, den niemand gelesen
    hat — samt veralteter Preise und alter Türcodes."""

    titel: str | None = None
    fact: str
    kategorie: str = "sonstiges"
    # 'betrag' | 'jahr' | None — wo das Dokument einen Preis oder eine
    # Jahreszahl trägt, wird gewarnt: ein alter Preis in der Wissensdatenbank
    # ist eine falsche Zusage und sieht aus wie eine richtige.
    warnung: str | None = None


class WissenImportVorschau(BaseModel):
    """Was das Dokument hergab. Die Vorschläge werden NICHT zwischengespeichert
    — sie kommen mit dem Übernehmen zurück. Eine Zwischentabelle wäre ein
    weiterer Zustand mit eigenem Gegenzustand (verwaiste Vorschläge, die
    niemand aufräumt)."""

    quelle_id: str
    datei_name: str
    items: list[WissenImportVorschlag] = []


class WissenImportUebernehmen(BaseModel):
    quelle_id: str
    property_id: str | None = None
    items: list[WissenImportVorschlag] = []


class KnowledgeBulkDelete(BaseModel):
    """Sammellöschen aus der Mehrfachauswahl der Faktenliste."""

    ids: list[str] = []


class WissenObjekt(BaseModel):
    """Eine Zeile der Objektliste (Ebene 1 der Wissensdatenbank).

    `fakten` ist die eigentliche Botschaft dieser Ansicht: sie zeigt auf einen
    Blick, welche Objekte gepflegt sind."""

    property_id: str
    titel: str
    ort: str | None = None
    foto_url: str | None = None
    fakten: int = 0
    geaendert_at: str | None = None


class WissenObjektListe(BaseModel):
    items: list[WissenObjekt] = []
    total: int = 0
    seite: int = 1
    pro_seite: int = 20
    # Die Fakten ohne Objektbezug — in der Oberfläche eine eigene Zeile ganz
    # oben. Ohne sie wären betriebsweite Fakten unerreichbar.
    betriebsweit_fakten: int = 0
    betriebsweit_geaendert_at: str | None = None


# --- Massenaktualisierung ----------------------------------------------------
class BulkUpdateRequest(BaseModel):
    action: str                    # "read" | "archived"
    before: str                    # nur Threads mit letzter Aktivität ≤ Datum (YYYY-MM-DD)


class BulkUpdateResult(BaseModel):
    updated: int


# --- Ungelesen-Zähler (Sidebar-Abzeichen) ------------------------------------
class UnreadCount(BaseModel):
    """Wie viele Konversationen warten auf eine Antwort?

    Speist das Abzeichen am Sidebar-Punkt „Posteingang". Bewusst dieselbe
    Ableitung wie die Liste (`InboxService._ist_gelesen`) statt eines eigenen
    `count(is_read = false)`: das Flag allein bleibt nach dem ersten Öffnen für
    immer `true`, und eine danach eingegangene Gastnachricht zählte nie mit.
    Zwei Wahrheiten über denselben Zustand wären zudem die schlimmere Variante —
    das Abzeichen zeigte eine Zahl, die die Liste daneben nicht bestätigt.
    """

    ungelesen: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Nachrichten-Kennzahlen (Startseite) -------------------------------------
class NachrichtenKennzahl(BaseModel):
    """Eine Zahl der Nachrichten-Sektion mit ihrem Tagesschnitt und Vergleich."""

    value: int
    # Schnitt je Tag über den Zeitraum — die Kachel daneben zeigt ihn separat.
    per_day: float
    # Veränderung in Prozent ggü. der gleich langen Vorperiode; None, wenn es
    # keine Vorperiode gab (keine erfundenen +100 %, wie DashboardKpi).
    change_pct: float | None = None


class NachrichtenKennzahlen(BaseModel):
    """Die Kennzahlen des Portal-Postfachs für die Startseite.

    Ausdrücklich NUR das Portal-/OTA-Postfach (`portal_messages`):
    Marktplatz-Threads und WhatsApp sind eigene Töpfe mit eigenen
    Richtungsfeldern, und drei Zählweisen in einer Zahl zu mischen wäre
    irreführend.
    """

    gesendet: NachrichtenKennzahl
    empfangen: NachrichtenKennzahl
    # Nur, was der Automail-Dispatch selbst als `quelle='automation'`
    # geschrieben hat (0400). Vor dieser Migration ist die Quelle einer
    # Nachricht nicht rekonstruierbar — der Altbestand zählt daher nicht mit.
    automation: NachrichtenKennzahl
    ungelesen: int
    # Die ungelesenen Konversationen selbst, nicht nur ihre Zahl: die Karte
    # auf der Startseite soll zeigen, WER wartet — eine Zahl allein zwingt zu
    # einem weiteren Klick, bevor man weiß, ob es dringend ist. Gedeckelt,
    # `ungelesen` bleibt die vollständige Zahl.
    ungelesen_threads: list[InboxThread] = Field(default_factory=list)
    # Welcher Zeitraum gerechnet wurde (Schlüssel wie "30d") und wie viele
    # Tage das sind. Beides mit, damit die Oberfläche ihre Auswahl bestätigt
    # bekommt statt sie nur zu vermuten.
    zeitraum: str
    tage: int


# --- KI-Regeln (0493) -------------------------------------------------------
# Eine Regel sagt der KI, WAS sie zu einem Thema tun soll und WIE das Ergebnis
# zugestellt wird. „Die KI darf X beantworten" heisst konkret: für X gibt es
# eine aktive Regel mit `zustellart='automatisch'`.
#
# Ton, Sprache und Signatur sind bewusst KEINE Regeln, sondern stehen in
# `AiSettings`: als Regel formuliert würden sie auf jede Nachricht passen und
# damit die Zustell-Logik aushebeln (eine „Ton"-Regel mit `automatisch` machte
# den ganzen Posteingang automatisch).
class KiRegel(BaseModel):
    id: str
    name: str
    aktiv: bool = True
    gilt_fuer: Literal["alle", "auswahl"] = "alle"
    zustellart: Literal["entwurf", "automatisch"] = "entwurf"
    anweisung: str
    ist_eskalation: bool = False
    # Zwei getrennte Schalter statt einem (0497): „im Posteingang melden"
    # markiert den Thread, „benachrichtigen" schickt zusätzlich E-Mail/Push.
    # Wer jede Beschwerde als Mail will, ist ein anderer Betrieb als wer sie
    # beim nächsten Blick sehen will.
    eskalation_posteingang: bool = True
    benachrichtigen: bool = False
    property_ids: list[str] = []
    verwendet_zaehler: int = 0
    zuletzt_verwendet_at: str | None = None


class KiRegelUpsert(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    aktiv: bool = True
    gilt_fuer: Literal["alle", "auswahl"] = "alle"
    # Vorgabe `entwurf`, auch hier: wer eine Regel anlegt, ohne die Zustellart
    # zu nennen, bekommt die vorsichtige — nicht die, die selbständig sendet.
    zustellart: Literal["entwurf", "automatisch"] = "entwurf"
    anweisung: str = Field(min_length=1, max_length=2000)
    ist_eskalation: bool = False
    eskalation_posteingang: bool = True
    benachrichtigen: bool = False
    # Nur bei `gilt_fuer='auswahl'` von Belang; der Service prüft, dass jedes
    # Objekt dem Betrieb gehört (Wurzel 3).
    property_ids: list[str] = []


class KiRegelList(BaseModel):
    items: list[KiRegel]
    total: int


class KiProtokollEintrag(BaseModel):
    """Was die KI getan hat — die Spur, ohne die nichts diagnostizierbar ist."""

    id: str
    thread_id: str
    quelle: Literal["inbox", "whatsapp"]
    regel_id: str | None = None
    regel_name: str | None = None
    frage_auszug: str | None = None
    antwort: str | None = None
    zustellart: Literal["entwurf", "automatisch"]
    gesendet_at: str | None = None
    quellen: list[str] = []
    weggelassen: list[str] = []
    eskaliert: bool = False
    grund: str | None = None
    created_at: str | None = None


class KiProtokollList(BaseModel):
    items: list[KiProtokollEintrag]
    total: int
