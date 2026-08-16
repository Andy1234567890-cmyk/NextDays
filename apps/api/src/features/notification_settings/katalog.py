"""Der Katalog der Benachrichtigungs-Kategorien — EINE Quelle der Wahrheit.

Hier steht, welche Kategorien es gibt, in welchem Tab und welcher Gruppe sie
haengen, welche Kanaele sie anbieten und ob E-Mail abwaehlbar ist. Schemas,
Service und die Spaltennamen leiten sich daraus ab — so kann eine neue
Kategorie nicht an drei Stellen auseinanderlaufen (Wurzel 4).

Die Spaltennamen in public.notification_settings folgen strikt
`<schluessel>_<kanal>` (siehe Migration 0225).
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class Kanal(StrEnum):
    EMAIL = "email"
    SMS = "sms"
    PHONE = "phone"
    # In-App (die Glocke). BEWUSST OHNE Praeferenzspalte und darum in KEINER
    # Kategorie unten aufgefuehrt: `SPALTEN` leitet sich aus den Kanaelen ab,
    # ein vierter Kanal je Kategorie erzwaenge 15 neue `*_inapp`-Spalten samt
    # Schaltern — fuer eine Anzeige, die niemand abschalten koennen soll.
    #
    # Fachlich ist das der Unterschied: E-Mail und SMS gehen HINAUS und stoeren,
    # deshalb sind sie waehlbar. Die Glocke ist der Ort IN der Anwendung, an dem
    # das System seine eigenen Probleme meldet („Raum ohne Foto", abgelaufener
    # Token). Wer sie abschalten koennte, saehe nie, dass etwas klemmt.
    #
    # `soll_senden` gibt fuer diesen Kanal darum immer True zurueck.
    INAPP = "inapp"


class Tab(StrEnum):
    # Marketing — frei abwaehlbar, Sammel-Opt-out moeglich.
    ANGEBOTE = "angebote"
    # Betrieb — E-Mail teils nicht abwaehlbar.
    KONTO = "konto"


@dataclass(frozen=True, slots=True)
class Kategorie:
    """Eine Zeile in der Benachrichtigungs-Liste."""

    schluessel: str
    tab: Tab
    gruppe: str
    kanaele: tuple[Kanal, ...]
    # True = E-Mail kann NICHT abgeschaltet werden (rechtlich/vertraglich
    # noetig: Buchungsbestaetigungen, Richtlinien, Konto-Sicherheit).
    # Airbnb zeigt den Schalter dort ausgegraut-an.
    email_pflicht: bool = False

    def spalte(self, kanal: Kanal) -> str:
        return f"{self.schluessel}_{kanal.value}"


_ALLE_KANAELE = (Kanal.EMAIL, Kanal.SMS, Kanal.PHONE)
_MAIL_SMS = (Kanal.EMAIL, Kanal.SMS)

KATALOG: tuple[Kategorie, ...] = (
    # --- Tab „Angebote und Updates" (Marketing) --------------------------
    Kategorie("insights_recognition", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_tips", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_pricing", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("insights_perks", Tab.ANGEBOTE, "insights", _ALLE_KANAELE),
    Kategorie("hosting_news", Tab.ANGEBOTE, "hosting", _ALLE_KANAELE),
    Kategorie("hosting_local_laws", Tab.ANGEBOTE, "hosting", _ALLE_KANAELE),
    Kategorie("travel_inspiration", Tab.ANGEBOTE, "travel", _ALLE_KANAELE),
    Kategorie("travel_planning", Tab.ANGEBOTE, "travel", _ALLE_KANAELE),
    Kategorie("platform_news", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    Kategorie("platform_feedback", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    Kategorie("platform_travel_regulations", Tab.ANGEBOTE, "platform", _ALLE_KANAELE),
    # --- Tab „Konto" (Betrieb) -------------------------------------------
    # E-Mail hier Pflicht: Buchungs-/Kontoaktivitaet und Richtlinien sind
    # vertraglich nötig — ein Gastgeber darf eine Stornierung oder eine
    # Richtlinienaenderung nicht stillschweigend abschalten koennen.
    Kategorie("account_activity", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("listing_activity", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("guest_policies", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("host_policies", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("reminders", Tab.KONTO, "erinnerungen", _MAIL_SMS),
    Kategorie("messages", Tab.KONTO, "nachrichten", _MAIL_SMS),
    # --- Betrieb: Aufgaben und Eigentümer-Meldungen (0331) ----------------
    # Eigene Kategorien statt „listing_activity" mitzubenutzen, weil die
    # EMPFAENGER verschieden sind: task_assigned geht an einen Mitarbeiter,
    # owner_* an den Eigentuemer. Sonst bekaeme eine Reinigungskraft SMS zu
    # Buchungen fremder Objekte, und ein Eigentuemer koennte die Auftrags-
    # Mails nur zusammen mit seinen Buchungsmeldungen abschalten.
    Kategorie("task_assigned", Tab.KONTO, "aufgaben", _MAIL_SMS),
    # E-Mail Pflicht: Buchung/Aenderung/Storno am eigenen Objekt ist die
    # vertragliche Kerninformation des Eigentuemers (wie guest_policies).
    Kategorie("owner_booking", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    Kategorie("owner_service", Tab.KONTO, "aufgaben", _MAIL_SMS),
    # --- Betrieb: Buchungseingang (16.08.2026) ----------------------------
    # Wieder eine eigene Kategorie und kein Mitbenutzen von `owner_booking` —
    # aus demselben Grund wie oben, dem EMPFAENGER: `owner_booking` geht an den
    # Eigentuemer des betroffenen Objekts, diese hier an den BETRIEB (Admin /
    # Property-Manager), der alle Objekte fuehrt. Wer nicht als Eigentuemer
    # eingetragen war, erfuhr von einer neuen Portal-Buchung bisher gar nichts:
    # `melde_buchungs_ereignis` kennt als Empfaenger ausschliesslich
    # `eigentuemer_nutzer_ids`.
    #
    # email_pflicht NEIN, und das ist der Unterschied zu `owner_booking`: fuer
    # den Eigentuemer ist die Buchung an seinem Objekt die vertragliche
    # Kerninformation, fuer den Betrieb ist sie Tagesgeschaeft. Ein Betrieb mit
    # 200 Buchungen im Monat muss den Mail-Kanal abwaehlen duerfen — die Glocke
    # bleibt ohnehin an (INAPP ist nicht abwaehlbar), und genau sie ist hier
    # gemeint.
    Kategorie("betrieb_buchung", Tab.KONTO, "aktivitaet", _MAIL_SMS),
    # --- Sperr-Antrags-Workflow (0332) ------------------------------------
    # Wieder getrennte Kategorien wegen der EMPFAENGER: „block_request" geht an
    # die Entscheider der Agentur (APPROVE_BLOCK), „block_decision" an den
    # antragstellenden Eigentuemer. Zusammengelegt koennte ein Eigentuemer die
    # Antwort auf seinen eigenen Antrag nur abschalten, indem er auch die
    # Antraege fremder Leute abschaltet — und umgekehrt.
    #
    # email_pflicht NEIN: ein Sperrantrag ist eine interne Abstimmung, keine
    # vertragliche Kerninformation wie eine Stornierung (owner_booking). Wer
    # taeglich Antraege bearbeitet, darf den Mail-Kanal abwaehlen — die Glocke
    # bleibt ohnehin an.
    Kategorie("block_request", Tab.KONTO, "aktivitaet", _MAIL_SMS),
    Kategorie("block_decision", Tab.KONTO, "aktivitaet", _MAIL_SMS),
    # --- Stufe 1 der Freigabe (0389) --------------------------------------
    # Dritte Kategorie aus demselben Grund wie die beiden darueber: ein
    # anderer EMPFAENGER. Diese geht an den EIGENTUEMER, dessen Familie eine
    # Sperrzeit wuenscht — nicht an die Agentur (fuer die existiert der Antrag
    # in diesem Zustand noch gar nicht) und nicht an den Antragsteller.
    #
    # Wer keine Familienzugaenge vergeben hat, bekommt hier nie etwas; die
    # Kategorie steht trotzdem im Katalog, damit die Einstellung auffindbar
    # ist, BEVOR der erste Antrag kommt.
    Kategorie("block_freigabe", Tab.KONTO, "aktivitaet", _MAIL_SMS),
    # --- Zustellprobleme (15.08.2026) -------------------------------------
    # „Eine Nachricht an einen Gast konnte nicht zugestellt werden."
    #
    # KEINE Kanaele — und das ist der ganze Punkt. Die Kategorie erzeugt damit
    # KEINE Praeferenzspalten, taucht in den Einstellungen nicht auf und geht
    # ausschliesslich in die Glocke (Kanal.INAPP laeuft immer, s. oben).
    #
    # Warum bewusst ohne Mail und SMS: der Ausloeser ist typischerweise eine
    # STOERUNG, und die trifft viele Nachrichten gleichzeitig. Eine Portal-
    # Stoerung von Minuten haette so eine Mailflut ausgeloest — ausgerechnet
    # in dem Moment, in dem der Betrieb Ruhe braucht, um sie zu beheben. Die
    # Glocke sammelt still und zeigt beim Hinsehen den Stand.
    #
    # Warum trotzdem nicht abwaehlbar: ein Gast, der seinen Tuercode nie
    # bekommen hat, steht vor der Tuer. Das ist keine Marketing-Meldung, die
    # man wegschalten koennen soll — es ist der einzige Weg, auf dem der
    # Betrieb ueberhaupt davon erfaehrt (bis hierher gab es keinen).
    Kategorie("zustellproblem", Tab.KONTO, "aktivitaet", ()),
)

NACH_SCHLUESSEL: dict[str, Kategorie] = {k.schluessel: k for k in KATALOG}

# Alle Spalten der Tabelle (ohne user_id/updated_at) — fuer select().
SPALTEN: tuple[str, ...] = tuple(
    k.spalte(kanal) for k in KATALOG for kanal in k.kanaele
) + ("marketing_unsubscribed_all",)

# Nur die Marketing-Spalten — das Sammel-Opt-out schaltet genau diese aus.
MARKETING_SPALTEN: tuple[str, ...] = tuple(
    k.spalte(kanal)
    for k in KATALOG
    if k.tab is Tab.ANGEBOTE
    for kanal in k.kanaele
)

# E-Mail-Spalten, die nicht abgeschaltet werden duerfen.
PFLICHT_EMAIL_SPALTEN: frozenset[str] = frozenset(
    k.spalte(Kanal.EMAIL) for k in KATALOG if k.email_pflicht
)
