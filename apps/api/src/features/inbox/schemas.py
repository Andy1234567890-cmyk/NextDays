"""Pydantic-Schemas für den inbox-Slice.

Posteingang für OTA-Gästekommunikation. Ein Thread entspricht einer OTA-Buchung
(channex_booking). Nachrichten werden über die Channex-Messaging-API gelesen und
gesendet (Booking.com/Airbnb/Expedia); ein optionaler KI-Antwortvorschlag (Groq)
hilft beim Beantworten. Threads sind mit der lokalen Reservierung verknüpft.
"""
from typing import Literal

from pydantic import BaseModel


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


# --- Vorlagen ---------------------------------------------------------------
class MessageTemplate(BaseModel):
    id: str
    title: str
    body: str


class MessageTemplateList(BaseModel):
    items: list[MessageTemplate] = []
    total: int = 0


class TemplateUpsert(BaseModel):
    title: str
    body: str


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
    auto_suggest: bool = True


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
class AutomationBase(BaseModel):
    name: str
    # booking_new|before_checkin|after_checkin|before_checkout|after_checkout|
    # message_received — der vollständige Katalog steht in `ausloeser.py`.
    trigger: str
    # Abgeleitet aus `trigger`; in der Anfrage ignoriert (nur Ausgabe).
    anchor: str = "arrival"    # arrival|departure|booking
    offset_days: int = 0
    # Versatz zum Anker in der gewählten Einheit. `offset_days` bleibt für den
    # Bestand erhalten und wird bei Tages-Regeln mitgeschrieben (0303).
    offset_unit: Literal["minutes", "hours", "days"] = "days"
    offset_value: int = 0
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
    use_property_timezone: bool = False
    # Nur message_received:
    only_first_message: bool = False   # nur die erste Gastnachricht im Thread
    window_days: list[int] = []        # 0=Mo … 6=So; leer = alle Tage
    window_from: str | None = None     # "HH:MM"; mit window_to das Zeitfenster
    window_to: str | None = None       # darf über Mitternacht gehen (22:00–06:00)


class Automation(AutomationBase):
    id: str


class AutomationList(BaseModel):
    items: list[Automation] = []
    total: int = 0


class AutomationUpsert(AutomationBase):
    pass


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
    fact: str
    source: str                      # manual | document | message
    source_ref: str | None = None    # Dateiname bzw. Thread, aus dem er stammt
    updated_at: str | None = None


class KnowledgeFactList(BaseModel):
    items: list[KnowledgeFact] = []
    total: int = 0


class KnowledgeFactUpsert(BaseModel):
    property_id: str | None = None
    fact: str


# --- Massenaktualisierung ----------------------------------------------------
class BulkUpdateRequest(BaseModel):
    action: str                    # "read" | "archived"
    before: str                    # nur Threads mit letzter Aktivität ≤ Datum (YYYY-MM-DD)


class BulkUpdateResult(BaseModel):
    updated: int


class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"
