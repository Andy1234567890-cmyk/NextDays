"""Schemas des platform_admin-Slice (Plattform-Backoffice)."""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

# Echter Import (kein TYPE_CHECKING): Pydantic löst die Annotationen zur
# Laufzeit auf, ein reiner Typprüf-Import wäre hier ein NameError beim Bauen des
# Modells.
from typing import Any

from pydantic import BaseModel, Field


class PlatformMe(BaseModel):
    """Identität + Rolle des eingeloggten Backoffice-Nutzers.

    Das Frontend gated seine Navigation daran (Support sieht keine Freigabe-
    Aktionen). Die Autorisierung selbst passiert IMMER serverseitig — dieses
    Objekt ist reine Anzeige-Information.
    """

    user_id: str
    email: str | None = None
    platform_role: str
    # True nur bei 'platform_admin' (schreibende Aktionen erlaubt).
    can_write: bool


class TeamMember(BaseModel):
    """Ein Mitglied des Betreiber-Teams (Zeile in platform_admins).

    Die E-Mail kommt aus GoTrue, nicht aus public.users: ein Backoffice-Nutzer
    gehört zu KEINEM Betrieb und hat dort deshalb keine Zeile.
    """

    user_id: str
    email: str | None = None
    platform_role: str
    active: bool
    note: str | None = None
    created_at: datetime
    granted_by_email: str | None = None
    last_sign_in_at: datetime | None = None
    # Einladung verschickt, aber noch nicht angenommen (Passwort nicht gesetzt).
    invite_pending: bool = False
    invite_expires_at: datetime | None = None


class TeamList(BaseModel):
    items: list[TeamMember]
    total: int


class TeamInvite(BaseModel):
    """Kolleg:in ins Backoffice einladen."""

    email: str = Field(min_length=5, max_length=200)
    platform_role: str = Field(pattern="^(platform_admin|platform_support)$")
    note: str | None = Field(default=None, max_length=200)


class TeamInviteResult(BaseModel):
    """Ergebnis der Einladung — ehrlich darüber, was wirklich passiert ist."""

    member: TeamMember
    # 'freigeschaltet' = bestehendes Konto bekam den Zugang (kein Link nötig),
    # 'eingeladen'     = neues Konto + Einladungslink erzeugt.
    ergebnis: str
    mail_versendet: bool = False
    # Nur gefüllt, wenn die Mail NICHT versendet werden konnte: dann muss der
    # einladende Admin den Link selbst weitergeben. Kein stiller „Erfolg".
    invite_link: str | None = None
    hinweis: str | None = None


class TeamUpdate(BaseModel):
    """Rolle, Notiz oder Aktiv-Status eines Team-Mitglieds ändern."""

    platform_role: str | None = Field(
        default=None, pattern="^(platform_admin|platform_support)$"
    )
    active: bool | None = None
    note: str | None = Field(default=None, max_length=200)


class TeamInviteAccept(BaseModel):
    """Einladung annehmen: Token aus dem Link + eigenes Passwort."""

    token: str = Field(min_length=20, max_length=200)
    # 12 Zeichen Minimum: dieser Zugang sieht ALLE Mandanten.
    password: str = Field(min_length=12, max_length=200)


class TeamPasswordResetRequest(BaseModel):
    """„Passwort vergessen": Anfrage mit der E-Mail-Adresse."""

    email: str = Field(min_length=5, max_length=200)


class TeamPasswordResetConfirm(BaseModel):
    """Neues Passwort setzen: Token aus der Mail + Passwort.

    Dieselbe Mindestlänge wie bei der Einladung — der Zugang ist derselbe.
    """

    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=12, max_length=200)


class TeamPasswordResetResponse(BaseModel):
    """Antwort auf die Reset-Anfrage — bewusst IMMER dieselbe.

    Kein Feld verrät, ob die Adresse ein Backoffice-Konto hat: sonst wäre der
    Endpunkt ein Verzeichnis der Betreiber-Zugänge (Wurzel 3/9).
    """

    message: str


class AuditEntry(BaseModel):
    """Ein Eintrag des Backoffice-Protokolls."""

    id: str
    actor_user_id: str
    actor_email: str | None = None
    action: str
    target_type: str | None = None
    target_id: str | None = None
    tenant_id: str | None = None
    detail: dict = {}
    ip: str | None = None
    created_at: datetime


class AuditList(BaseModel):
    """Seite des Protokolls (neueste zuerst)."""

    items: list[AuditEntry]
    total: int


class TenantSummary(BaseModel):
    """Ein Betrieb in der Backoffice-Liste (Kennzahlen, keine Detaildaten)."""

    id: str
    name: str
    country: str | None = None
    currency: str | None = None
    account_type: str | None = None
    business_type: str | None = None
    created_at: datetime
    # Abgeleitete Kennzahlen (aus properties/users), damit die Liste ohne
    # Nachladen einschätzbar ist.
    property_count: int = 0
    active_property_count: int = 0
    user_count: int = 0


class TenantList(BaseModel):
    items: list[TenantSummary]
    total: int


class TenantDetail(TenantSummary):
    """Detailsicht eines Betriebs inkl. Zahlungs-/Abo-Status."""

    # Aus tenant_billing_profile: darf dieser Betrieb überhaupt verkaufen?
    stripe_charges_enabled: bool = False
    stripe_account_id: str | None = None
    # Aus tenant_subscription (falls vorhanden).
    subscription_status: str | None = None


class PlatformUser(BaseModel):
    """Ein Betriebs-Nutzer (Supply-Seite) in der Registrierungs-Übersicht."""

    id: str
    tenant_id: str | None = None
    tenant_name: str | None = None
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    created_at: datetime


class PlatformUserList(BaseModel):
    items: list[PlatformUser]
    total: int


class PlatformGuest(BaseModel):
    """Ein Plattform-Gast (Demand-Seite, portal_guests)."""

    id: str
    email: str | None = None
    name: str | None = None
    preferred_locale: str | None = None
    preferred_currency: str | None = None
    marketing_opt_in: bool | None = None
    created_at: datetime


class PlatformGuestList(BaseModel):
    items: list[PlatformGuest]
    total: int


class ModerationProperty(BaseModel):
    """Ein Objekt in der Freigabe-Warteschlange des Betreibers."""

    id: str
    tenant_id: str
    tenant_name: str | None = None
    title: str
    city: str | None = None
    country: str | None = None
    status: str
    moderation_status: str
    moderation_note: str | None = None
    moderation_submitted_at: datetime | None = None
    moderation_reviewed_at: datetime | None = None
    photos: list[str] = []
    max_guests: int | None = None
    currency: str | None = None


class ModerationList(BaseModel):
    items: list[ModerationProperty]
    total: int


class ModerationDecision(BaseModel):
    """Entscheidung des Betreibers über ein Objekt.

    Bei einer Ablehnung ist die Begründung Pflicht — sie wird dem Gastgeber
    angezeigt, damit er nachbessern kann (eine wortlose Ablehnung wäre für ihn
    nicht handhabbar).
    """

    note: str | None = Field(default=None, max_length=1000)


class FinanzKennzahlen(BaseModel):
    """Aggregierte Finanzsicht des Betreibers.

    Beträge in Cent (wie in platform_fees gespeichert) — die Anzeige formatiert
    sie mit der jeweiligen Währung. KEINE Umrechnung zwischen Währungen: das
    wäre ein erfundener Kurs (Wurzel 4), darum wird je Währung getrennt
    ausgewiesen.
    """

    currency: str
    # Vermitteltes Volumen (Summe der Buchungsbeträge, auf denen Provision lag).
    gross_amount_cents: int = 0
    # Unsere Provision daraus.
    fee_amount_cents: int = 0
    # Davon zurückerstattet (Storno/Teilrückzahlung).
    reversed_amount_cents: int = 0
    fee_count: int = 0


class PlatformFeeRow(BaseModel):
    """Eine einzelne Provisionsbuchung."""

    id: str
    tenant_id: str
    tenant_name: str | None = None
    reservation_id: str | None = None
    fee_bps: int | None = None
    gross_amount_cents: int | None = None
    fee_amount_cents: int | None = None
    reversed_amount_cents: int | None = None
    currency: str | None = None
    gateway: str | None = None
    status: str | None = None
    created_at: datetime


class FinanzUebersicht(BaseModel):
    """Finanzsicht: Kennzahlen je Währung + die jüngsten Provisionsbuchungen."""

    kennzahlen: list[FinanzKennzahlen]
    letzte: list[PlatformFeeRow]
    # Betriebe, die (noch) nicht für Zahlungen freigeschaltet sind — sie können
    # nicht veröffentlichen und sind damit ein Onboarding-Rückstand.
    tenants_ohne_zahlung: int = 0
    # Abo-Status über alle Betriebe (status → Anzahl).
    abos: dict[str, int] = {}


class SupportMessage(BaseModel):
    """Eine Nachricht in einem Support-Ticket."""

    id: str
    ticket_id: str
    author_kind: str
    author_user_id: str | None = None
    body: str
    # Interne Team-Notiz — wird dem Melder NIE ausgeliefert.
    internal: bool = False
    created_at: datetime
    # Vom Client erzeugte ID (Idempotenz + Ersetzen der optimistischen Zeile).
    client_msg_id: str | None = None


class SupportTicket(BaseModel):
    """Ein Support-Ticket in der Backoffice-Liste."""

    id: str
    reporter_user_id: str | None = None
    reporter_guest_id: str | None = None
    # Anonymer Melder von der Marketing-Seite (source='web'): es gibt kein
    # Konto, an dem Name und Rückkanal hängen — beides steht am Ticket.
    reporter_name: str | None = None
    reporter_email: str | None = None
    reporter_phone: str | None = None
    tenant_id: str | None = None
    tenant_name: str | None = None
    subject: str
    category: str | None = None
    status: str
    priority: str
    assignee_user_id: str | None = None
    reservation_id: str | None = None
    property_id: str | None = None
    created_at: datetime
    last_message_at: datetime | None = None
    # 'form' = Formular-Anfrage, 'chat' = Live-Chat aus dem Dashboard-Widget,
    # 'web' = anonyme Anfrage aus dem Widget der Marketing-Seite.
    source: str = "form"
    last_message_preview: str | None = None
    last_message_kind: str | None = None
    # Lese-Cursor des Teams; daraus wird die Ungelesen-Markierung abgeleitet.
    agent_last_read_at: datetime | None = None
    # Ungelesene Melder-Nachrichten (Agenten-Sicht).
    unread: int = 0
    rating: int | None = None
    rating_comment: str | None = None


class SupportTicketDetail(SupportTicket):
    """Ticket inkl. Verlauf (im Backoffice MIT internen Notizen)."""

    messages: list[SupportMessage] = []


class SupportTicketList(BaseModel):
    items: list[SupportTicket]
    total: int


class SupportReply(BaseModel):
    """Antwort oder interne Notiz eines Bearbeiters."""

    body: str = Field(min_length=1, max_length=5000)
    # true = nur fürs Team sichtbar.
    internal: bool = False
    # Vom Client erzeugte UUID: Doppelklick/Retry darf keine zweite Antwort
    # erzeugen (Wurzel 2).
    client_msg_id: str | None = Field(default=None, max_length=64)


class PlatformOk(BaseModel):
    """Schlichte Bestätigung (z. B. gesetzter Lese-Cursor)."""

    ok: bool = True


class SupportTicketUpdate(BaseModel):
    """Statuswechsel/Zuweisung durch das Betreiber-Team."""

    status: str | None = Field(default=None, pattern="^(open|waiting|resolved|closed)$")
    priority: str | None = Field(default=None, pattern="^(low|normal|high|urgent)$")
    assignee_user_id: str | None = None


class VorgangEintrag(BaseModel):
    """Ein fachlicher Vorgang aus der Historie eines Betriebs.

    Zusammengeführt aus mehreren Quelltabellen (Reservierungen, Stornierungen,
    Anmeldungen, Zuweisungen). Bewusst nur GESCHÄFTSVORGÄNGE — keine
    Klickpfade, keine Seitenaufrufe: das wäre Verhaltenskontrolle, hier geht es
    um Nachvollziehbarkeit dessen, was fachlich passiert ist.
    """

    # Woher der Eintrag stammt: 'reservierung' | 'stornierung' | 'anmeldung'
    # | 'zuweisung'.
    quelle: str
    # Art des Vorgangs innerhalb der Quelle (z. B. 'created', 'cancelled').
    art: str
    # Menschenlesbare Zusammenfassung.
    beschreibung: str
    # Wer gehandelt hat (falls bekannt).
    user_id: str | None = None
    user_email: str | None = None
    # Betroffener Datensatz (Reservierung, Thread …).
    ziel_id: str | None = None
    # Zusatzangaben der Quelle (Grund, Kanal, Gerät).
    detail: dict = {}
    created_at: datetime


class VorgangList(BaseModel):
    """Vorgangshistorie eines Betriebs (neueste zuerst)."""

    items: list[VorgangEintrag]


class SteuerBetrieb(BaseModel):
    """Steuerlicher Compliance-Stand eines Betriebs — die Prüfsicht.

    Der Betreiber MUSS das überprüfen können: das Unterlassen der
    Durchsetzung ist selbst bußgeldbewehrt (§ 25 Abs. 1 Nr. 6 PStTG, bis
    30.000 EUR). Eine Oberfläche, die nur den Gastgeber fragt, aber dem
    Betreiber keine Kontrolle gibt, erfüllt die Pflicht nicht.
    """

    tenant_id: str
    tenant_name: str | None = None
    country: str | None = None
    # Länder, in denen der Betrieb Objekte hat ODER selbst ansässig ist.
    pflicht_laender: list[str] = []
    # Davon abgedeckt durch eine Selbstauskunft.
    erfasste_laender: list[str] = []
    fehlende_laender: list[str] = []
    # Objekte ohne erhobene Grundbuchnummer (§ 14 Abs. 4 Nr. 6).
    objekte_gesamt: int = 0
    objekte_ohne_angabe: int = 0
    # Laufende Durchsetzung (§ 23 PStTG).
    mahnungen_offen: int = 0
    # True = Auszahlungen werden aktuell einbehalten.
    zahlungen_einbehalten: bool = False
    # Länder, in denen die 180-Tage-Frist verstrichen ist, ohne dass eine
    # Maßnahme lief — das ist der bußgeldbewehrte Fall.
    ueberfaellig: list[str] = []

    @property
    def vollstaendig(self) -> bool:
        return not self.fehlende_laender and not self.ueberfaellig


class SteuerUebersicht(BaseModel):
    """Die Prüfsicht über alle Betriebe."""

    betriebe: list[SteuerBetrieb]
    # Kennzahlen für den Kopf der Seite.
    betriebe_gesamt: int = 0
    betriebe_vollstaendig: int = 0
    betriebe_mit_luecke: int = 0
    betriebe_ueberfaellig: int = 0
    zahlungen_einbehalten: int = 0


class BuchungSummary(BaseModel):
    """Eine Buchung in der Backoffice-Liste — beide Seiten auf einen Blick.

    Bewusst schmal: die Liste soll überflogen werden. Wer die Anschrift oder
    den Zahlungsverlauf braucht, öffnet das Detail — und DAS wird dann mit
    tenant_id protokolliert.
    """

    id: str
    # Seite Betrieb
    tenant_id: str
    tenant_name: str | None = None
    property_id: str
    property_title: str | None = None
    # Seite Gast — in der Liste nur der Name, keine Kontaktdaten.
    guest_name: str | None = None
    # Vorgang
    channel: str
    status: str
    payment_status: str
    check_in: date
    check_out: date
    naechte: int
    total_amount: Decimal
    paid_amount: Decimal
    # Keine Ersatzwährung: fehlt sie, ist das ein Datenfehler, den die Anzeige
    # als „—" zeigt statt zu erfinden (Wurzel 4).
    currency: str | None = None
    created_at: datetime


class BuchungList(BaseModel):
    items: list[BuchungSummary]
    total: int


class BuchungGast(BaseModel):
    """Die Gastseite einer Buchung.

    Zwei Quellen, bewusst getrennt gehalten: `guests` ist die Gastakte DES
    BETRIEBS, `portal_guests` ist das Plattform-Konto. Beide können existieren,
    eines, oder keines (OTA-Buchung ohne Konto) — deshalb ist alles optional
    und nichts wird zusammengerechnet.
    """

    # Aus der Reservierung selbst (auch ohne Gastakte vorhanden).
    email: str | None = None
    phone: str | None = None
    country: str | None = None
    language: str | None = None
    # Aus der Gastakte des Betriebs (guests), falls verknüpft.
    guest_id: str | None = None
    name: str | None = None
    company: str | None = None
    stays_count: int | None = None
    # Aus dem Plattform-Konto (portal_guests), falls die E-Mail passt.
    portal_guest_id: str | None = None
    portal_registered_at: datetime | None = None


class BuchungObjekt(BaseModel):
    """Die Objektseite einer Buchung — eine buchbare Einheit, kein Container."""

    id: str
    title: str | None = None
    street: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    status: str | None = None
    max_guests: int | None = None


class BuchungZahlung(BaseModel):
    """Eine Zahlungsbewegung zur Buchung."""

    id: str
    type: str | None = None
    status: str | None = None
    gateway: str | None = None
    amount: Decimal | None = None
    currency: str | None = None
    due_at: datetime | None = None
    created_at: datetime


class BuchungProvision(BaseModel):
    """Unsere Provision auf diese Buchung (platform_fees)."""

    id: str
    fee_bps: int | None = None
    gross_amount_cents: int | None = None
    fee_amount_cents: int | None = None
    reversed_amount_cents: int | None = None
    currency: str | None = None
    gateway: str | None = None
    status: str | None = None
    created_at: datetime


class BuchungDetail(BuchungSummary):
    """Eine Buchung mit allem, was beide Seiten hergeben.

    Das ist die Sicht für den Streitfall: Was wurde gebucht, was wurde gezahlt,
    was haben wir daran verdient, wer war der Gast, welches Objekt.
    """

    gast: BuchungGast
    objekt: BuchungObjekt
    zahlungen: list[BuchungZahlung] = []
    provisionen: list[BuchungProvision] = []
    # Was der Gast zum Zeitpunkt der Buchung gesehen/gewählt hat.
    quote_items: list[dict] = []
    num_guests: int = 1
    adults: int = 1
    children: int = 0
    infants: int = 0
    pets: int = 0
    note: str | None = None
    # Herkunft bei OTA-Buchungen.
    ota_name: str | None = None
    external_ref: str | None = None
    source_channex_booking_id: str | None = None
    # Storno — nur gesetzt, wenn wirklich storniert.
    cancel_reason: str | None = None
    cancelled_at: datetime | None = None
    checked_in_at: datetime | None = None
    checked_out_at: datetime | None = None
    channel_fee: Decimal = Decimal(0)


class DeployEintrag(BaseModel):
    """Ein Deploy-Vorgang, wie ihn der Monitor im Backoffice zeigt.

    Die Felder kommen 1:1 aus Coolify; nichts wird ergänzt oder geraten.
    Fehlt ein Wert dort, bleibt er hier None statt ein Ersatzwert (Wurzel 4).
    """

    id: int | None = None
    deployment_uuid: str | None = None
    anwendung: str
    anwendung_uuid: str | None = None
    status: str
    commit: str | None = None
    commit_nachricht: str | None = None
    gestartet_at: datetime | None = None
    beendet_at: datetime | None = None
    # Direktlink in die Coolify-Oberfläche (Log-Ausgabe des Baus).
    log_url: str | None = None


class OffenerCommit(BaseModel):
    """Ein Commit auf `main`, der noch nicht ausgerollt ist."""

    sha: str
    kurz_sha: str
    nachricht: str
    autor: str | None = None
    zeitpunkt: datetime | None = None
    # Nur die Dateien, die genau DIESE Anwendung betreffen (watch_paths).
    # Ein Commit kann mehrere Apps berühren und steht dann bei jeder.
    dateien: list[str] = Field(default_factory=list)


class DeployRueckstand(BaseModel):
    """Was zwischen dem ausgerollten Stand und `main` liegt — je Anwendung.

    `betrifft_mich` ist die eigentliche Antwort auf „muss ich deployen": ein
    Commit, der nur die Doku ändert, macht den Worker nicht deploy-bedürftig.
    Entschieden wird das über Coolifys `watch_paths` derselben Anwendung —
    dieselbe Regel, nach der Coolify auch selbst entscheiden würde.
    """

    # None = nicht ermittelbar (kein GitHub-Zugang, unbekannter Commit).
    # Bewusst nicht 0: „weiß ich nicht" ist keine Aussage über den Rückstand.
    commits_gesamt: int | None = None
    commits_relevant: int | None = None
    betrifft_mich: bool = False
    offene: list[OffenerCommit] = Field(default_factory=list)
    # Warum nichts ermittelt werden konnte — steht so in der Oberfläche.
    fehler: str | None = None


class DeployApp(BaseModel):
    """Eine überwachte Anwendung samt ihrem letzten bekannten Deploy."""

    uuid: str
    name: str
    laeuft: bool = False
    letzter: DeployEintrag | None = None
    rueckstand: DeployRueckstand | None = None
    # Wann der Worker zuletzt nach DIESER App gesehen hat (deploy_spiegel).
    # None = der Worker hat für sie noch nie geschrieben — die App wird
    # geführt, steht im Spiegel aber nicht. Sichtbar leer statt still fehlend.
    geprueft_at: datetime | None = None
    # Wann sich zuletzt fachlich etwas geändert hat. Bleibt stehen, während
    # `geprueft_at` weiterläuft — genau daran erkennt man „läuft, tut nichts".
    aktualisiert_at: datetime | None = None


class DeployUebersicht(BaseModel):
    apps: list[DeployApp]
    # True, sobald irgendeine App gerade baut — das Frontend pollt dann enger.
    aktiv: bool = False
    # Kopf von `main` — der Stand, gegen den alle Apps verglichen werden.
    main_sha: str | None = None
    main_kurz_sha: str | None = None
    # ÄLTESTER `geprueft_at` über alle Zeilen: „der Spiegel als Ganzes ist
    # mindestens so alt". Steht der Wert still, läuft der Worker-Job nicht mehr
    # und die Oberfläche darf keine Ruhe vortäuschen (Migration 0294).
    # None = keine einzige Zeile im Spiegel (Worker hat nie geschrieben).
    spiegel_geprueft_at: datetime | None = None


class DeployVerlauf(BaseModel):
    items: list[DeployEintrag]


class DeployEreignis(BaseModel):
    """Ein Deploy-Zustandswechsel aus dem Verlauf (`deploy_ereignis`, 0378).

    Der Spiegel hält nur den Jetzt-Stand und überschreibt ihn; hier steht, was
    passiert IST — inklusive der Ursache bei einem Fehlschlag.
    """

    id: str
    anwendung_uuid: str
    name: str
    # None = Erstbefund (Anwendung zum ersten Mal gesehen), kein Wechsel.
    status_von: str | None = None
    status_nach: str
    deployment_uuid: str | None = None
    deploy_id: int | None = None
    commit: str | None = None
    commit_nachricht: str | None = None
    log_url: str | None = None
    gestartet_at: datetime | None = None
    beendet_at: datetime | None = None
    # Die aus dem Build-Log extrahierte Ursache. None bei Erfolg — und auch
    # dann, wenn im Log keine zu finden war (Wurzel 4: nie erfinden).
    fehler_text: str | None = None
    # deployment_failed | healthcheck | stderr | kein_log | unbekannt
    fehler_quelle: str | None = None
    fehler_kontext: str | None = None
    # UNSERE Uhr: wann der Worker den Wechsel bemerkt hat (Wurzel 5b).
    erkannt_at: datetime | None = None


class DeployEreignisListe(BaseModel):
    items: list[DeployEreignis]
    total: int = 0


class DeployLogZeile(BaseModel):
    """Eine Zeile Build-Ausgabe eines Deploys.

    `art` ist stdout/stderr — im Backoffice färbt das die Fehlerzeilen.
    """

    text: str
    art: str = "stdout"
    zeit: datetime | None = None


class DeployLog(BaseModel):
    deployment_uuid: str
    status: str
    zeilen: list[DeployLogZeile]


# --------------------------------------------------------------------------
# Worker-Verlauf (0379)
# --------------------------------------------------------------------------


class WorkerEreignis(BaseModel):
    """Eine Zeile des Worker-Verlaufs — Metadaten, keine Nutzlast.

    Die Nutzlast (Request/Response-Body, Job-Payload, Webhook-Payload) kommt
    über `WorkerDetail` nachgeladen: ein einzelner ARI-Request kann Hunderte
    Zeilen tragen, und in einer Liste von 200 Ereignissen wären das Megabyte
    für Daten, die man erst beim Aufklappen sieht.
    """

    id: str
    # job | gesendet | empfangen | tick
    richtung: str
    vorgang: str
    # ok | fehler
    ergebnis: str
    tenant_id: str | None = None
    property_id: str | None = None
    # Objektname, in EINER Abfrage nachgezogen. `worker_ereignis` trägt bewusst
    # keinen FK (das Objekt darf verschwinden, das Ereignis bleibt wahr), also
    # kann PostgREST hier nicht joinen.
    objekt: str | None = None
    quelle_tabelle: str | None = None
    quelle_id: str | None = None
    http_methode: str | None = None
    http_pfad: str | None = None
    http_status: int | None = None
    dauer_ms: int | None = None
    fehler_text: str | None = None
    versuche: int | None = None
    # WAS der Vorgang getan hat — der Satz für die Tabelle: „Reinigungsgebühr ·
    # 795,00 DKK · pro Buchung" bzw. „12 geholt · 3 gespeichert". Stammt aus dem
    # echten Request-Body bzw. der echten Handler-Rückgabe; `None`, wenn der
    # Vorgang nichts berichtet hat (0381).
    zusammenfassung: str | None = None
    # Dieselben Angaben maschinenlesbar, für Filter/Auswertung ohne Textparsen.
    kennzahlen: dict[str, Any] | None = None
    # UNSERE Uhr. Bei richtung=empfangen der Eingang bei uns, nicht der
    # Zeitpunkt beim Portal (Wurzel 5b).
    erfasst_at: str
    # Vom Menschen abgehakt (0392). Ein Fehler bleibt sonst für immer offen
    # stehen, auch wenn der nächste Lauf längst durchlief — und eine Warnung,
    # die nie verschwindet, wird übersehen.
    resolved: bool = False


class WorkerEreignisListe(BaseModel):
    items: list[WorkerEreignis]
    # Gesamtzahl der Treffer im Filter — die Oberfläche braucht sie fürs Blättern.
    gesamt: int = 0
    offset: int = 0
    limit: int = 100


class WorkerKennzahl(BaseModel):
    """Zahlen je Vorgang.

    Die Fehlerquote steht bewusst NICHT nur als Gesamtwert: live sind 3 von 522
    Portal-Aufrufen fehlgeschlagen — als Gesamtquote (0,6 %) sieht das nach
    nichts aus, während ein einzelner Vorgang zu 100 % scheitern kann.
    """

    richtung: str
    vorgang: str
    anzahl: int
    fehler: int
    dauer_avg_ms: int | None = None
    dauer_max_ms: int | None = None


class WorkerStillstand(BaseModel):
    """Ein Kern-Job, der AUSBLEIBT — der Befund, den keine Fehlerzahl zeigt.

    Am 13.08.2026 stand der Buchungs-Feed 16 Stunden still, während der Monitor
    „0 Fehler" meldete: Die Jobs liefen, verzögerten sich aber jedes Mal
    ergebnislos, und Verzögern ist ein geplanter Ausgang. Gemessen wird deshalb
    der letzte ERFOLGREICHE Lauf.

    `zuletzt=None` heißt: im Beobachtungsfenster kein einziger Erfolg — entweder
    steht der Job wirklich, oder das System ist frisch aufgesetzt. Kein
    erfundener Ersatzwert (Wurzel 4).
    """

    vorgang: str
    # Klartext fürs Backoffice: was praktisch ausfällt, nicht der Job-Name.
    beschreibung: str
    zuletzt: str | None = None
    still_seit_sekunden: int | None = None
    erwartet_alle_sekunden: int
    ueberfaellig: bool = True


class WorkerKennzahlen(BaseModel):
    stunden: int
    items: list[WorkerKennzahl]
    ereignisse: int = 0
    fehler: int = 0
    # Was JETZT offen ist — aus `jobs`, nicht aus dem Verlauf: der Verlauf sagt,
    # was passiert IST, nicht was ansteht (Wurzel 5b).
    warteschlange: int = 0
    aufgegeben: int = 0
    # Kern-Jobs, die überfällig sind. Leer = alles läuft. Das ist die einzige
    # Kennzahl, die ein AUSBLEIBEN sichtbar macht — alle anderen zählen, was
    # passiert ist, und blieben beim Ausfall vom 13.08.2026 unauffällig.
    stillstand: list[WorkerStillstand] = Field(default_factory=list)


class WorkerDetail(BaseModel):
    """Ein Ereignis samt VOLLSTÄNDIGER Quellzeile — ungekürzt.

    `quelle` ist `None`, wenn das Ereignis keine Quellzeile trug oder sie
    aufgeräumt wurde. Kein leeres Objekt, das wie „nichts drin" aussieht
    (Wurzel 4).
    """

    ereignis: WorkerEreignis | None = None
    quelle: dict[str, object] | None = None


class WebhookEreignis(BaseModel):
    """Ein Eingang von einem Portal (channex_webhook_event).

    Was WIR tun, steht im Worker-Verlauf; hier steht, was ANDERE uns schicken.
    """

    id: str
    # booking_new | review | message | disconnect_listing | …
    event: str
    # info | error | action
    severity: str
    resolved: bool
    # True, wenn dieses Ereignis einen EINGRIFF verlangt und noch offen ist
    # (getrenntes Inserat, deaktivierter Kanal, unzugeordnete Rate). Serverseitig
    # entschieden, damit die Oberfläche `severity` nicht selbst deuten muss.
    handlungsbedarf: bool = False
    tenant_id: str | None = None
    betrieb: str | None = None
    property_id: str | None = None
    objekt: str | None = None
    live_feed_event_id: str | None = None
    # Worum es geht, aus der ECHTEN Payload gelesen (listing_id, channel, …).
    # `None`, wenn die Payload nichts davon trug — nie geraten (Wurzel 4).
    zusammenfassung: str | None = None
    resolved_at: str | None = None
    # Der Zeitpunkt BEIM PORTAL, aus `payload.timestamp`. `None`, wenn die
    # Payload ihn nicht trug — dann gibt es ihn nicht, und die eigene Uhr wäre
    # eine Falschaussage (Wurzel 5b).
    portal_at: str | None = None
    # UNSER Eingang, NICHT der Zeitpunkt beim Portal (Wurzel 5b). Deshalb so
    # benannt: „created_at" hätte man als Portal-Zeitpunkt gelesen.
    eingang_at: str


class WebhookEreignisListe(BaseModel):
    items: list[WebhookEreignis]
    gesamt: int = 0
    offset: int = 0
    limit: int = 100


class WebhookKennzahl(BaseModel):
    """Zahlen je Ereignistyp. `offen` ist der Teil, der noch niemand angefasst
    hat — bei einem Fehlertyp ist genau das die Aussage."""

    event: str
    severity: str
    anzahl: int = 0
    offen: int = 0


class WebhookKennzahlen(BaseModel):
    stunden: int
    items: list[WebhookKennzahl]
    ereignisse: int = 0
    # ZEITFENSTER-UNABHÄNGIG: ein getrenntes Inserat vom 07.08. ist heute noch
    # getrennt. Nur die letzten 24 h zu zählen liesse die Ansicht ruhig
    # aussehen, während vier Inserate stillstehen.
    handlungsbedarf: int = 0
    fehler_offen: int = 0


class ErledigenRequest(BaseModel):
    """Ein Ereignis abhaken, optional mit Notiz.

    Die Notiz ist freiwillig — ein Pflichtfeld würde beim Aufräumen von achtzehn
    Altlasten achtzehnmal „ok" produzieren und wäre damit wertlos.
    """

    notiz: str | None = Field(default=None, max_length=2000)


class ErledigenResponse(BaseModel):
    """Der Zustand nach dem Abhaken — was die Liste zum Neuzeichnen braucht."""

    id: str
    resolved: bool
    resolved_at: str | None = None
    resolved_by: str | None = None
    #: Die Notiz, falls eine hinterlassen wurde. None = ohne Notiz erledigt.
    notiz: str | None = None


class WebhookDetail(BaseModel):
    """Ein Eingang samt VOLLSTÄNDIGER Portal-Payload — ungekürzt.

    `resolution` ist gefüllt, wenn jemand das Ereignis abgearbeitet hat; `None`
    heisst offen (kein leeres Objekt, das wie „erledigt" aussieht).
    """

    ereignis: WebhookEreignis | None = None
    payload: dict[str, Any] | None = None
    resolution: dict[str, Any] | None = None
