"""Pydantic-Schemas für den auth-Slice."""
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, SecretStr, field_validator

from src.core.countries import is_iso2_country
from src.core.mail_sprache import SUPPORTED, normalisieren
from src.features.owner_statements.currencies import COUNTRY_CURRENCY

# Unterstützte Währungen = die Werte der Land→Währung-Map (EU27+CH/GB), gleiche
# Quelle wie das Frontend (apps/web/lib/laender.ts). KEINE volle ISO-4217-Liste:
# das UI bietet nur diese Länder/Währungen an, ein Datensatz mit "FOO" (oder auch
# "BRL") kann über kein UI entstehen und ist ein Datenfehler, kein legitimer Fall.
_SUPPORTED_CURRENCIES = frozenset(COUNTRY_CURRENCY.values())


def pruefe_sprache(v: str | None) -> str | None:
    """Auf eine unterstuetzte Sprache normalisieren („de-AT" → „de").

    DIE EINE Regel fuer jedes Sprachfeld im Contract. Als Funktion und nicht je
    Schema kopiert: die zweite Kopie haette beim naechsten Feld den 422 durch
    ein stilles `return None` ersetzt, und der Betreiber saesse vor einer
    englischen Mail ohne Erklaerung.

    Ein nicht unterstuetzter Code wird ABGEWIESEN statt still verworfen: der
    Betreiber soll erfahren, dass es diese Sprache nicht gibt. Leer/None heisst
    dagegen ehrlich „nicht erfasst" → NULL, und die Fallback-Kette
    (Betriebssprache → Englisch) uebernimmt.
    """
    if v is None or not v.strip():
        return None
    code = normalisieren(v)
    if code is None:
        erlaubt = ", ".join(sorted(SUPPORTED))
        msg = f"Sprache {v!r} wird nicht unterstützt. Erlaubt: {erlaubt}."
        raise ValueError(msg)
    return code


def begrenze_sprachliste(v: list[str] | None) -> list[str] | None:
    """Gesprochene Sprachen säubern und HART begrenzen.

    Jeder unbegrenzte Bereich bekommt eine Obergrenze (Wurzel 8): ohne sie
    landet eine Liste mit 100000 Einträgen in `users.spoken_languages` und wird
    danach bei jedem Laden der Nutzerliste mitgeschleppt. 40 ist mehr, als ein
    Mensch spricht, und weniger, als schadet. Leere Einträge fallen raus,
    Dubletten ebenfalls — die Reihenfolge der ersten Nennung bleibt.
    """
    if v is None:
        return None
    sauber: list[str] = []
    for eintrag in v:
        text = eintrag.strip()[:80]
        if text and text not in sauber:
            sauber.append(text)
    if len(sauber) > 40:
        raise ValueError("Höchstens 40 gesprochene Sprachen.")
    return sauber


class UserRole(StrEnum):
    admin = "admin"        # voller Systemzugriff (Lastenheft §4.1)
    co_admin = "co_admin"  # operative Rechte Eigentümer + Mitarbeiter kombiniert
    owner = "owner"        # Eigentümer-Portal (Daten-Split, §4.2)
    staff = "staff"        # Mitarbeiter-Portal (Smartphone, §4.3)
    cleaner = "cleaner"    # Reinigungskraft (wie staff, operativ)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: SecretStr = Field(min_length=8)
    full_name: str = Field(min_length=1, max_length=200)
    tenant_name: str = Field(min_length=1, max_length=200)
    # Gegen die unterstützte Länder-/Währungsliste geprüft (nicht nur Länge):
    # "zz"/"!!"/"FOO" sind Datenfehler → 422, kein erfundener Ersatzwert (Wurzel 4).
    country: str = Field(min_length=2, max_length=2)   # ISO-3166-1 alpha-2
    currency: str = Field(min_length=3, max_length=3)  # ISO-4217
    # 'agency' = verwaltet fremde Objekte (Owner-Statements); 'self_managed' =
    # eigener Vermieter. Default agency (bisheriges Verhalten).
    business_type: str = Field(default="agency", pattern="^(agency|self_managed)$")
    # Betriebsmodell: 'pms' = Channel-Manager/Dashboard-Abo (apps/web, Default —
    # bisheriges Verhalten); 'marketplace' = Plattform-Gastgeber ohne Abo, zahlt
    # eine Provision je Buchung (plattform/-Registrierung setzt dies).
    account_type: str = Field(default="pms", pattern="^(pms|marketplace)$")

    @field_validator("country")
    @classmethod
    def _country_supported(cls, v: str) -> str:
        if not is_iso2_country(v):
            raise ValueError("Land wird nicht unterstützt (EU27, CH, GB).")
        return v.upper()

    @field_validator("currency")
    @classmethod
    def _currency_supported(cls, v: str) -> str:
        if v.upper() not in _SUPPORTED_CURRENCIES:
            raise ValueError("Währung wird nicht unterstützt.")
        return v.upper()


class LoginRequest(BaseModel):
    email: EmailStr
    password: SecretStr


class RefreshRequest(BaseModel):
    """Silent-Refresh (Mobile): tauscht ein gültiges Refresh-Token gegen eine
    frische Session. Antwort ist die bestehende SessionResponse."""

    refresh_token: SecretStr


class InviteRequest(BaseModel):
    """Einladung eines weiteren Nutzers in den eigenen Tenant (Mitarbeiter etc.).

    Der einladende Nutzer (admin/co_admin) bestimmt die Rolle. Owner-Rolle wird
    beim Registrieren vergeben, nicht beim Einladen.

    KEIN `password` mehr (0334, bewusster Contract-Bruch): bis dahin würfelte der
    Wizard im Browser ein Passwort und schickte es hierher — es lief damit durch
    den Browser des Einladenden, durch jedes HTTP-Log dazwischen und musste per
    Zuruf weitergegeben werden. Stattdessen legt der Server den Auth-Nutzer mit
    einem Zufallspasswort an, das NIEMAND kennt, und verschickt einen Einmal-Link;
    das Passwort setzt die eingeladene Person selbst.
    """

    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    role: UserRole
    # Feingranulare Berechtigungen (IDs aus granular_permissions.Permission). Leer =
    # Rollen-Defaults werden angewendet; Admin erhält immer alle.
    permissions: list[str] | None = None
    # Sprache der eingeladenen Person (ISO 639-1, z. B. "da"). OPTIONAL und
    # bewusst EXPLIZIT statt aus dem `Accept-Language`-Header abgeleitet: hier
    # lädt der BETREIBER jemanden ein, der Header trägt also die Sprache des
    # Einladenden, nicht die des Empfängers. Einen dänischen Eigentümer
    # anzulegen und ihm die deutsche Browsersprache seines Verwalters
    # zuzuschreiben wäre ein plausibel aussehender erfundener Wert (Wurzel 4).
    # Fehlt die Angabe, greift die Kette Betriebssprache → Englisch.
    #
    # FELDNAME `preferred_language` — derselbe wie die Spalte, in die er fließt
    # (`users.preferred_language`), und derselbe, den `PATCH
    # /auth/account/profile` schon trägt. Ein zweiter Name („language") für
    # dasselbe Datum hieße, dass das Frontend je Endpunkt raten muss, wie das
    # Feld gerade heißt.
    preferred_language: str | None = Field(default=None, max_length=10)
    # Kontakt- und Zusatzangaben aus dem Benutzer-Wizard (Schritt 1 + 2). Bis
    # 0356 sammelte der Wizard sie ein und WARF SIE WEG — die Felder standen in
    # der Oberfläche, gingen aber nie in den Request. Wer eine Telefonnummer
    # eintrug, fand danach ein leeres Feld (Wurzel 4: eine Eingabe, die nichts
    # bewirkt, ist eine Falschaussage der Oberfläche).
    phone: str | None = Field(default=None, max_length=40)
    additional_phone: str | None = Field(default=None, max_length=40)
    hide_phones: bool = False
    # Gesprochene Sprachen: rein informativ (Gäste-/Aufgabenzuteilung), NICHT
    # die Sprache der E-Mails — die steht in `preferred_language`. Deshalb hier
    # KEINE Prüfung gegen die 24 Locales: „Thai" darf ein Mitarbeiter sprechen,
    # auch wenn es die Oberfläche nicht gibt.
    spoken_languages: list[str] | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("preferred_language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)

    @field_validator("spoken_languages")
    @classmethod
    def _sprachen_begrenzen(cls, v: list[str] | None) -> list[str] | None:
        return begrenze_sprachliste(v)


class InviteResponse(BaseModel):
    user_id: str
    email: EmailStr
    role: UserRole
    tenant_id: str
    permissions: list[str] = []
    # Ob die Einladungsmail rausging. Immer True, wenn der Aufruf 201 liefert —
    # ein fehlgeschlagener Versand rollt die Anlage zurück und endet in einem
    # Fehlerstatus (kein stiller Teilerfolg, Wurzel 5). Das Feld ist da, damit
    # die Oberfläche „Einladung versendet an …" belegen kann, ohne es zu raten.
    invite_mail_versendet: bool = True


class EinladungAnnehmenRequest(BaseModel):
    """Einladung annehmen: Token aus dem Link + selbst gewähltes Passwort.

    Öffentlich (ohne Session) — der Einmal-Token IST die Berechtigung. Die
    Mindestlänge deckt sich mit `RegisterRequest`; die verbindliche Prüfung
    steht zusätzlich serverseitig im Dienst (der Endpunkt ist ohne Browser
    aufrufbar).
    """

    token: str = Field(min_length=20, max_length=200)
    password: SecretStr = Field(min_length=8)


class PasswortVergessenRequest(BaseModel):
    """„Passwort vergessen": Anfrage mit der E-Mail-Adresse.

    Bewusst `str` und nicht `EmailStr`: eine syntaktisch ungültige Adresse würde
    als 422 mit Feldfehler antworten und wäre damit von einer gültigen, aber
    unbekannten Adresse (200, neutral) unterscheidbar — ein feiner, aber echter
    Enumerations-Kanal. So beantwortet der Dienst JEDE Eingabe gleich.
    """

    email: str = Field(min_length=3, max_length=254)


class PasswortNeuRequest(BaseModel):
    """Neues Passwort über den Reset-Token setzen (öffentlich)."""

    token: str = Field(min_length=20, max_length=200)
    password: SecretStr = Field(min_length=8)


class NeutraleAntwort(BaseModel):
    """Antwort der öffentlichen Auth-Vorgänge ohne verwertbare Auskunft.

    Ein und dieselbe Nachricht für jeden Ausgang — der Aufrufer erfährt daraus
    nicht, ob ein Konto existiert (OWASP Forgot Password).
    """

    message: str


class TokenPruefungResponse(BaseModel):
    """Vorab-Prüfung eines Links, damit die Seite „abgelaufen" zeigen kann,
    ohne dass der Nutzer erst ein Passwort eintippt.

    `gueltig=false` fasst ungültig, abgelaufen und verbraucht ZUSAMMEN — eine
    Unterscheidung wäre ein Orakel über fremde Tokens.

    `sprache` ist die Sprache des EMPFÄNGERS (dieselbe Kette wie die Mail,
    `core.mail_empfaenger.sprache_fuer_nutzer`), damit die verlinkte Seite in
    derselben Sprache erscheint wie die Mail, die dorthin geführt hat. Sie ist
    IMMER gesetzt und immer ein unterstützter Code — bei ungültigem Token der
    Letzt-Rückfall aus `core.mail_sprache.FALLBACK` (Englisch), damit die
    Antwort für geratene Tokens ununterscheidbar bleibt.

    `bereits_eingeloest=true` heißt: GENAU DIESER Token wurde schon eingelöst,
    das Passwort existiert also. Die Seite führt dann zur ANMELDUNG statt eine
    Warnseite zu zeigen — für den Nutzer ist der zweite Klick auf den Link aus
    der Mail kein Fehler. Das bricht die Ununterscheidbarkeit NICHT: `true`
    setzt einen Treffer auf den echten Token-Hash voraus. Für einen geratenen
    oder abgelaufenen Token bleibt die Antwort `false` — dieselbe wie bisher.
    Wer ein `true` auslösen kann, kennt den Token bereits; er hatte die Mail.

    MEHR STEHT HIER BEWUSST NICHT (Wurzel 9): kein Name, keine E-Mail, keine
    Rolle, kein Tenant. Der Endpunkt ist öffentlich und unauthentifiziert; alles
    darüber hinaus wäre ein Verzeichnis über fremde Konten für jeden, der
    Tokens durchprobiert.
    """

    gueltig: bool
    sprache: str
    bereits_eingeloest: bool = False


class SessionResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # noqa: S105 — OAuth-Token-Typ, kein Secret
    expires_in: int


class SessionInfo(BaseModel):
    """Eine aktive Sitzung im Geräteverlauf (Airbnb „Login & Sicherheit").

    Rohdaten aus auth.sessions (GoTrue): user_agent + ip werden im Frontend zu
    „Chrome · Windows · Berlin" o. ä. aufbereitet. is_current markiert die
    Sitzung, aus der der aktuelle Request kommt (kann nicht sich selbst abmelden)."""

    id: str
    user_agent: str | None = None
    ip: str | None = None
    created_at: str | None = None
    last_seen_at: str | None = None
    is_current: bool = False


class RevokeOthersResponse(BaseModel):
    """Ergebnis von „auf allen anderen Geräten abmelden": Anzahl beendeter
    Sitzungen (ohne die aktuelle)."""

    revoked: int


class LoginResponse(BaseModel):
    """Antwort auf /auth/login. Genau EINE der beiden Welten ist gesetzt:

    - 2FA nicht aktiv → ``session`` gefüllt, ``mfa_required=False``. Der Client
      benutzt die Session sofort (wie bisher SessionResponse).
    - 2FA aktiv → ``mfa_required=True``, ``session=None``, ``mfa_token`` gesetzt.
      Es gibt bewusst NOCH KEINE Session (fail-closed): der Client muss den
      TOTP-Code über /auth/login/totp einlösen. Der mfa_token ist kurzlebig,
      an genau diesen User gebunden und taugt NUR zum Code-Einlösen — er ist
      KEIN Access-Token (eigener typ-Claim, wird vom API-Guard abgelehnt)."""

    mfa_required: bool = False
    session: SessionResponse | None = None
    # Nur bei mfa_required=True: kurzlebiges Pending-Token (5 Min).
    mfa_token: str | None = None
    # Welche 2. Faktoren dieses Konto hat (für die UI: welcher Schritt kommt).
    # 'totp' = Authenticator-App, 'sms' = SMS-Code an die verifizierte Nummer.
    mfa_methods: list[str] = []
    # Bei SMS: maskierte Zielnummer für die Anzeige („+49 ••• 9026").
    mfa_phone_masked: str | None = None


class TotpLoginRequest(BaseModel):
    """Zweiter Login-Schritt bei aktiver 2FA: mfa_token (aus /auth/login) plus
    6-stelliger TOTP-Code oder ein Recovery-Code."""

    mfa_token: str
    code: str = Field(min_length=6, max_length=32)


class SmsLoginRequest(BaseModel):
    """Zweiter Login-Schritt bei SMS-2FA: mfa_token + 6-stelliger SMS-Code."""

    mfa_token: str
    code: str = Field(min_length=6, max_length=6)


class MeResponse(BaseModel):
    user_id: str
    email: EmailStr | None = None
    tenant_id: str | None = None
    role: UserRole | None = None
    capabilities: list[str] = []  # Fähigkeiten der Rolle (Berechtigungs-Matrix)
    permissions: list[str] = []   # Feingranulare Berechtigungen (für UI-Gating)
    # Beherbergungsart des Mandanten (0090): steuert die Navigation
    # (Objekte vs. Zimmer, Eigentümer-Modul nur bei Ferienvermietung).
    accommodation_type: str | None = None
    # Vorfuehr-Mandant (0407): die Oberflaeche zeigt darauf ein durchgaengiges
    # Band „Vorfuehrung — Aenderungen sind abgeschaltet". Ohne diesen Hinweis
    # wirkt die Software defekt, sobald ein Klick nichts tut: der Riegel
    # antwortet mit 405, und das sieht wie ein Fehler aus, nicht wie Schutz.
    is_demo: bool = False
    # Internes Test-/Vorfuehrkonto des Hauses (0505). NICHT `is_demo`: das ist
    # die anonyme Schaufenster-Vorfuehrung und sperrt Schreibzugriffe samt
    # Buchhaltung. Diese Kennzeichnung macht das Gegenteil — sie GIBT unfertige
    # Module frei (derzeit die Buchhaltung, 13 Platzhalter-Unterseiten), damit
    # sie erprobt werden koennen, ohne vor einem zahlenden Betrieb zu stehen.
    is_internal: bool = False
    # Betriebsmodell (0180): 'pms' (Abo, apps/web) oder 'marketplace' (8%-Fee,
    # plattform/). Steuert, welche Oberfläche/welches Billing gilt.
    account_type: str | None = None
    # Name des Betriebs (`tenants.name`), eingegeben bei der Registrierung.
    # Der Onboarding-Assistent belegt damit das Feld „Firmenname" vor: sonst
    # tippt ein frisch registrierter Betrieb denselben Namen ein zweites Mal,
    # weil die eigentliche Quelle (`tenant_billing_profile`) zu diesem
    # Zeitpunkt naturgemaess noch leer ist.
    tenant_name: str | None = None
    # Standardsprache des Betriebs (0335), zweite Stufe der Mail-Sprachkette.
    # None = nicht erfasst (→ Englisch), kein erfundener Default (Wurzel 4).
    default_language: str | None = None
    # FIRMENSITZ des Betriebs (`tenants.country`, ISO-3166-1 alpha-2). Steuert,
    # welche länderspezifischen Werkzeuge die Navigation zeigt — DATEV ist ein
    # deutsches Format und in DK nutzlos.
    #
    # NICHT die Sprache: der Beta-Betrieb sitzt in Dänemark und arbeitet auf
    # Deutsch. Wer die Locale als Land liest, blendet ihm ein DATEV ein, das
    # sein Steuerberater nicht lesen kann — und einem deutschen Betrieb mit
    # englischer Oberfläche wäre es umgekehrt weggenommen.
    #
    # None = nicht erfasst. Die Oberfläche zeigt dann die länderneutralen
    # Punkte und verschweigt die spezifischen, statt ein Land zu raten
    # (Wurzel 4).
    country: str | None = None


class AccommodationTypeUpdate(BaseModel):
    """Beherbergungsart des Mandanten umstellen (nur Admin)."""

    accommodation_type: str = Field(pattern="^(vacation_rental|hotel)$")


class DefaultLanguageUpdate(BaseModel):
    """Standardsprache des BETRIEBS setzen (`tenants.default_language`, 0335).

    Zweite Stufe der Mail-Sprachkette (`core.mail_sprache`): sie greift für
    jeden Empfänger ohne eigene Sprachwahl. Ohne diesen Schreibweg blieb die
    Spalte dauerhaft NULL und die Kette fiel für ALLE solchen Empfänger
    sofort auf Englisch durch — der dänische Betrieb bekam englische Mails.

    `null`/leer ist ausdrücklich erlaubt und heißt „nicht erfasst" (→ Englisch),
    nicht „Deutsch": ein Default wäre eine erfundene Behauptung (Wurzel 4).
    """

    default_language: str | None = Field(default=None, max_length=10)

    @field_validator("default_language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)


class AccountResponse(BaseModel):
    """Konto-Übersicht für Sicherheit- & Kontakt-/Profil-Seite (echte Daten)."""

    user_id: str
    email: EmailStr | None = None
    full_name: str | None = None
    has_password: bool = True   # False bei reinen OAuth-Konten (z. B. Google)
    totp_enabled: bool = False
    role: UserRole | None = None
    # Profilfelder (Kontaktdaten): optional, da alt-Konten
    # sie noch nicht gepflegt haben.
    phone: str | None = None
    additional_phone: str | None = None
    hide_phones: bool = False
    preferred_language: str | None = None
    preferred_currency: str | None = None
    preferred_timezone: str | None = None
    spoken_languages: list[str] = []
    website: str | None = None
    description: str | None = None
    avatar_url: str | None = None
    permissions: list[str] = []  # Feingranulare Berechtigungen (für UI-Gating)
    # Land des Unternehmens (ISO-2, aus tenants.country) — Vorbelegung z. B.
    # der Telefon-Ländervorwahl im Frontend (kein Hardcode, Wurzel 4).
    tenant_country: str | None = None
    # Personengebundene Gastgeber-Felder (Airbnb „Persönliche Informationen").
    preferred_first_name: str | None = None
    residential_street: str | None = None
    residential_postal_code: str | None = None
    residential_city: str | None = None
    residential_country: str | None = None
    mailing_street: str | None = None
    mailing_postal_code: str | None = None
    mailing_city: str | None = None
    mailing_country: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    # Identitätsprüfung (Stripe Identity) — echter Status, kein Fake-Default.
    identity_status: str = "unverified"
    identity_verified_at: str | None = None
    # Telefonnummer-Verifizierung (SMS-OTP) — Zeitpunkt oder None.
    phone_verified_at: str | None = None


class TenantUser(BaseModel):
    """Ein Nutzer. Für die Objekt-Kontakt-Auswahl (eigener Tenant) und für die
    Admin-Nutzerverwaltung (Admins sehen alle Tenants → tenant_id mitgeliefert)."""

    user_id: str
    email: EmailStr | None = None
    full_name: str | None = None
    role: UserRole | None = None
    phone: str | None = None
    avatar_url: str | None = None
    tenant_id: str | None = None
    # WIRKSAME Rechte (Rolle + gespeicherte, gefiltert durchs PM-Dach). Für
    # Anzeige und UI-Gating: was dieser Nutzer tatsächlich kann.
    permissions: list[str] = []
    # GESPEICHERTE Rechte, ungefiltert — genau das, was in `users.permissions`
    # steht. Nur für den BEARBEITEN-Dialog.
    #
    # Ohne dieses Feld war die gefilterte Anzeige die Schreibquelle: der Dialog
    # las `permissions`, und Speichern schrieb sie zurück. Alles, was das
    # PM-Dach herausgefiltert hatte, war danach dauerhaft weg — ohne dass es
    # jemand angefasst hätte. Live betraf das die Rolle `owner`: 6 gespeicherte
    # Rechte, 2 wirksame, 4 verloren pro Speichervorgang (23.08.2026 gemessen).
    # Dasselbe Muster wie bei `preferred_language` einen Kommentar weiter unten,
    # nur mit Rechten statt einer Sprache.
    stored_permissions: list[str] = []
    # Sprache der E-Mails an diesen Nutzer. Wird mitgeliefert, damit der
    # Bearbeiten-Dialog den gespeicherten Wert anzeigen kann statt „nicht
    # gesetzt" zu behaupten und ihn beim Speichern zu ueberschreiben.
    preferred_language: str | None = None
    # Kontakt-/Zusatzangaben (Detailseite Konto → Benutzer → <Person>). Alle
    # optional, weil Altbestand sie nicht gepflegt hat — leer heisst „nicht
    # erfasst", nicht „leer gesetzt".
    additional_phone: str | None = None
    hide_phones: bool = False
    spoken_languages: list[str] = []
    notes: str | None = None
    # Zugang gesperrt? `deactivated_at` ist die Wahrheit (NULL = aktiv);
    # `is_active` ist daraus abgeleitet und steht nur da, damit die Oberflaeche
    # keinen Zeitstempel-Vergleich nachbauen muss.
    deactivated_at: str | None = None
    is_active: bool = True
    # Wann dieser Zugang angelegt wurde — die Liste sortiert danach, und die
    # Detailseite benennt es („Mitglied seit"). UNSERE Uhr ist hier die richtige
    # Quelle: das Anlegen IST unser Ereignis (kein Fall von Wurzel 5b).
    created_at: str | None = None


class ManagedUserDeactivateResponse(BaseModel):
    """Ergebnis von Deaktivieren/Aktivieren eines Zugangs.

    Traegt den vollstaendigen Nutzer zurueck (nicht nur ein ok), damit die
    Oberflaeche den neuen Zustand ANZEIGEN kann, ohne ihn zu raten.
    """

    user: TenantUser
    # Zustand des ANMELDEDIENSTES (GoTrue) nach der Aktion: True = der Login ist
    # dort gebannt. Steht getrennt neben `user.is_active`, weil beides
    # auseinanderlaufen KANN — genau dieser Fall darf nicht verschwiegen werden
    # (Wurzel 5: kein stilles „done" bei Teilerfolg):
    #   * deaktiviert + login_gesperrt=false → das Feld steht, der Bann nicht.
    #     Der FastAPI-Riegel (aktiv_gate) haelt zu, der Direktpfad laeuft bis
    #     zum Token-Ablauf weiter → Vorgang wiederholen.
    #   * aktiviert + login_gesperrt=true → freigeschaltet, aber der Bann haengt
    #     noch: die Person kann sich nicht anmelden, obwohl sie aktiv aussieht.
    login_gesperrt: bool


class OwnerAssignmentUpdate(BaseModel):
    """Setzt die Objekt-Zuordnung eines Eigentümers (Lastenheft §4.2).

    Vollständige Liste (Replace-Semantik): genau diese property_ids werden dem
    Eigentümer zugeordnet, alle anderen Zuordnungen dieses Nutzers entfernt."""

    property_ids: list[str] = []


class OwnerAssignmentResponse(BaseModel):
    """Aktuelle Objekt-Zuordnung eines Eigentümers."""

    user_id: str
    property_ids: list[str] = []


class StaffAssignmentUpdate(BaseModel):
    """Setzt die Objekt-Zuordnung eines Mitarbeiters (Lastenheft §4.3).

    Vollständige Liste (Replace-Semantik): genau diese property_ids werden dem
    Mitarbeiter (Rolle staff/cleaner) zugeordnet, alle anderen entfernt."""

    property_ids: list[str] = []


class StaffAssignmentResponse(BaseModel):
    """Aktuelle Objekt-Zuordnung eines Mitarbeiters."""

    user_id: str
    property_ids: list[str] = []


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr
    # Re-Auth wie beim Passwortwechsel (Wurzel 7): die E-Mail ist der
    # Wiederherstellungsweg des Kontos — wer sie ohne Nachweis tauschen kann,
    # übernimmt per anschließendem Passwort-Reset das ganze Konto (bei einem
    # admin damit den Tenant). Optional wie in UpdatePasswordRequest, weil
    # OAuth-Konten kein Passwort haben; der Dienst erzwingt es genau dann,
    # wenn eines existiert.
    current_password: SecretStr | None = None


class UpdateNameRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)


class UpdateManagedUserRequest(BaseModel):
    """Nutzer in der Verwaltung (Konto → Benutzer) bearbeiten. Gesendete
    Felder werden gesetzt, weggelassene bleiben unverändert."""

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: UserRole | None = None
    # Feingranulare Berechtigungen nachträglich anpassen (Admin darf die Rechte
    # jedes Nutzers erweitern/einschränken). None = unverändert; eine (auch
    # leere) Liste ersetzt die gespeicherten Berechtigungen.
    permissions: list[str] | None = None
    # Sprache der E-Mails an diesen Nutzer nachträglich ändern (Konto →
    # Benutzer → Bearbeiten). Gegen die 24 Locales geprüft wie beim Einladen.
    preferred_language: str | None = Field(default=None, max_length=10)
    # Kontaktdaten und Zusatzangaben der Detailseite. Wie oben: gesendet =
    # gesetzt, weggelassen = unverändert. Leerstring bedeutet ausdrücklich
    # „gelöscht" (der Service macht daraus NULL) — nur so lässt sich eine
    # falsch eingetragene Nummer auch wieder entfernen (Wurzel 1: der
    # Gegenzustand muss erreichbar sein).
    phone: str | None = Field(default=None, max_length=40)
    additional_phone: str | None = Field(default=None, max_length=40)
    hide_phones: bool | None = None
    spoken_languages: list[str] | None = None
    notes: str | None = Field(default=None, max_length=5000)

    @field_validator("preferred_language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)

    @field_validator("spoken_languages")
    @classmethod
    def _sprachen_begrenzen(cls, v: list[str] | None) -> list[str] | None:
        return begrenze_sprachliste(v)


class UpdateProfileRequest(BaseModel):
    """Profil-/Kontaktdaten bearbeiten (Kontaktinformationen).

    Alle Felder optional: gesendete Felder werden gesetzt, weggelassene bleiben
    unverändert. ``full_name`` wird aus Vor-/Nachname im Frontend gebildet.
    """

    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    additional_phone: str | None = Field(default=None, max_length=40)
    hide_phones: bool | None = None
    # Wie bei `InviteRequest` gegen die 24 unterstuetzten Locales geprueft
    # (Validator unten). Bis 0335 stand hier nur `max_length=10`: jeder String
    # kam durch („zh", „xx-YZ"), landete in der Spalte und war spaeter eine
    # Sprache, fuer die es keinen Mailtext gibt. Seit 0335 traegt die Spalte
    # zusaetzlich einen CHECK — ohne diesen Validator waere ein Tippfehler des
    # Nutzers ein 500 aus der DB statt eines sprechenden 422.
    preferred_language: str | None = Field(default=None, max_length=10)
    # ISO-4217 (3 Grossbuchstaben) bzw. IANA-Zone — die DB prueft beides
    # zusaetzlich, damit auch ein direkter Schreibpfad nicht durchrutscht.
    preferred_currency: str | None = Field(
        default=None, min_length=3, max_length=3, pattern=r"^[A-Z]{3}$"
    )
    preferred_timezone: str | None = Field(default=None, max_length=64)
    spoken_languages: list[str] | None = None
    website: str | None = Field(default=None, max_length=300)
    description: str | None = Field(default=None, max_length=5000)
    avatar_url: str | None = Field(default=None, max_length=1000)
    # Personengebundene Gastgeber-Felder (Airbnb „Persönliche Informationen").
    # IMMER auf users — auch beim Admin NICHT nach tenant_billing_profile.
    preferred_first_name: str | None = Field(default=None, max_length=200)
    residential_street: str | None = Field(default=None, max_length=200)
    residential_postal_code: str | None = Field(default=None, max_length=20)
    residential_city: str | None = Field(default=None, max_length=120)
    residential_country: str | None = Field(default=None, max_length=2)
    mailing_street: str | None = Field(default=None, max_length=200)
    mailing_postal_code: str | None = Field(default=None, max_length=20)
    mailing_city: str | None = Field(default=None, max_length=120)
    mailing_country: str | None = Field(default=None, max_length=2)
    emergency_contact_name: str | None = Field(default=None, max_length=200)
    emergency_contact_phone: str | None = Field(default=None, max_length=40)

    @field_validator("preferred_language")
    @classmethod
    def _sprache_pruefen(cls, v: str | None) -> str | None:
        return pruefe_sprache(v)

    @field_validator("spoken_languages")
    @classmethod
    def _sprachen_begrenzen(cls, v: list[str] | None) -> list[str] | None:
        return begrenze_sprachliste(v)


class UpdatePasswordRequest(BaseModel):
    # current_password optional: OAuth-Konten haben (noch) keins.
    current_password: SecretStr | None = None
    new_password: SecretStr = Field(min_length=8)


class TotpEnrollResponse(BaseModel):
    """Start des TOTP-Enrollments: Secret + QR (otpauth-URI als Data-URL)."""

    secret: str                 # Base32, zum manuellen Eintippen
    otpauth_uri: str            # otpauth://… (für QR-Scanner)
    qr_data_url: str            # data:image/png;base64,… (fertiger QR-Code)


class TotpVerifyRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)  # 6-stellig (+Slack)


class TotpVerifyResponse(BaseModel):
    totp_enabled: bool
    recovery_codes: list[str] = []  # einmalig im Klartext zurückgegeben


class TotpDisableRequest(BaseModel):
    code: str = Field(min_length=6, max_length=8)


class PhoneDisableRequest(BaseModel):
    """SMS-Zweitfaktor entfernen.

    Passwort statt SMS-Code: Wer das Telefon verloren hat, kann keinen Code
    empfangen — eine Code-Abfrage waere genau im Bedarfsfall unbenutzbar.
    Optional, weil reine OAuth-Konten kein Passwort haben.
    """

    current_password: SecretStr | None = None


class PhoneSendCodeRequest(BaseModel):
    """Nummern-Verifizierung starten. E.164 erzwungen (führendes +, 8–15 Ziffern)
    — keine erfundenen Vorwahlen (Wurzel 4)."""

    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$", max_length=16)


class PhoneVerifyRequest(BaseModel):
    phone: str = Field(pattern=r"^\+[1-9]\d{7,14}$", max_length=16)
    code: str = Field(min_length=6, max_length=6)


# Bleibt erhalten: einheitlicher Health-Endpoint über alle Slices.
class SliceHealth(BaseModel):
    slice: str
    status: str = "ok"


# --- Zwei-Faktor-Authentifizierung (GoTrue-nativ, siehe mfa_service.py) -----


class MfaFactor(BaseModel):
    """Ein verifizierter Faktor aus `auth.mfa_factors`.

    Secret und WebAuthn-Credential fehlen hier bewusst: die Oberflaeche
    braucht sie nicht, und was nicht rausgeht, kann nicht leaken (Wurzel 6).
    """

    id: str
    factor_type: str            # totp | phone | webauthn
    friendly_name: str | None = None
    status: str
    created_at: str | None = None


class MfaStatusResponse(BaseModel):
    """Der 2FA-Zustand des eigenen Kontos.

    Zwei-Faktor ist freiwillig (Entscheidung vom 25.08.2026, s.
    `mfa_service.py`) — dieses Schema enthaelt deshalb bewusst KEIN
    „Pflicht"/"Frist"-Feld mehr. Ein Feld, das nur noch False/None sein kann,
    waere eine zweite, irrefuehrende Wahrheit ueber den Zugang.
    """

    factors: list[MfaFactor] = []
    aal: str                          # aal1 | aal2 (aus dem aktuellen Token)
    mfa_enrolled: bool                # mindestens ein verifizierter Faktor
    recovery_codes_left: int = 0
    # Kann dieser Server den SMS-Faktor ueberhaupt ausliefern? Kommt aus der
    # Server-Konfiguration (`mfa_sms_available`), nicht aus einer Vermutung im
    # Browser. Ist er false, blendet die Oberflaeche den Weg nicht heimlich aus,
    # sondern zeigt ihn sichtbar als nicht verfuegbar — ohne den Schalter liefe
    # der Nutzer beim Anfordern des Codes in ein 500 „Failed to get SMS
    # provider" aus GoTrue.
    sms_available: bool = False


class MfaReauth(BaseModel):
    """Re-Auth fuer sicherheitskritische Selbst-Aenderungen (Wurzel 7).

    Entweder das aktuelle Passwort ODER ein bereits auf aal2 gehobenes Token.
    Beides optional, weil reine OAuth-Konten kein Passwort haben — der Service
    lehnt ab, wenn WEDER das eine noch das andere vorliegt (fail-closed).
    """

    current_password: SecretStr | None = None


class MfaRecoveryCodesResponse(BaseModel):
    """Neu erzeugte Wiederherstellungscodes — einmalig im Klartext."""

    codes: list[str]


class MfaRecoveryRedeemRequest(BaseModel):
    """Einen Wiederherstellungscode einloesen.

    Laenge grosszuegig begrenzt (Format XXXXX-XXXXX, Bindestrich optional),
    aber begrenzt: angreiferkontrollierter Input bekommt eine harte
    Obergrenze, statt eine unbegrenzte Zeichenkette in den Hash zu geben
    (Wurzel 8).
    """

    code: str = Field(min_length=8, max_length=32)


class MfaAdminResetRequest(BaseModel):
    """Plattform-Admin setzt die Faktoren eines fremden Kontos zurueck.

    `reason` ist Pflicht und hat eine Mindestlaenge: der maechtigste Eingriff
    im System darf nicht unbegruendet in der Revisionsspur stehen.
    """

    user_id: str
    reason: str = Field(min_length=5, max_length=500)


class MfaAdminResetResponse(BaseModel):
    removed_factors: int
    target_user_id: str
