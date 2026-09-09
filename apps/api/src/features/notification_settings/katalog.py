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
    # Push aufs Telefon (mobile-nextdays/-bestdays, FCM). ANDERS als die
    # Glocke abwaehlbar und darum MIT Praeferenzspalte: die Glocke wartet
    # geduldig in der Anwendung, ein Push klingelt nachts auf dem Nachttisch.
    # Er hat deshalb nur an den zwei Kategorien einen Schalter, bei denen der
    # Betrieb sofort reagieren muss (`betrieb_buchung`, `messages`) — nicht an
    # den Marketing-Kategorien (Migration 0414).
    PUSH = "push"


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
    # In WELCHER App ein Push dieser Kategorie landet (ADR-0019/0022). Ein Push
    # erreicht ein GERAET, nicht ein Konto — dieselbe Person kann Verwaltungs-
    # und Eigentuemer-App installiert haben, und die Meldung gehoert genau in
    # eine davon. Steht hier und nicht im Versandpfad, weil die Zustaendigkeit
    # eine Eigenschaft der Kategorie ist: wer eine neue anlegt, entscheidet sie
    # in derselben Zeile mit. Aus dem Schluesselnamen ableiten waere falsch —
    # `block_decision` geht an den Eigentuemer und traegt kein `owner_`.
    push_app: str = "mynextdays"

    def spalte(self, kanal: Kanal) -> str:
        return f"{self.schluessel}_{kanal.value}"


_ALLE_KANAELE = (Kanal.EMAIL, Kanal.SMS, Kanal.PHONE)
_MAIL_SMS = (Kanal.EMAIL, Kanal.SMS)
# Nur Mail. Fuer Meldungen mit Tagen Vorlauf, die einen Link tragen —
# SMS waere hier die falsche Dringlichkeit.
_MAIL = (Kanal.EMAIL,)
# Mail + SMS + Push. Nur fuer Ereignisse, die den Betrieb SOFORT erreichen
# muessen; jede Kategorie hier braucht eine `*_push`-Spalte in der DB.
_MAIL_SMS_PUSH = (Kanal.EMAIL, Kanal.SMS, Kanal.PUSH)
# Mail + Push ohne SMS. Fuer Meldungen, die den Betrieb schnell erreichen
# sollen, aber keine SMS wert sind.
_MAIL_PUSH = (Kanal.EMAIL, Kanal.PUSH)
# Die Eigentuemer-App (ADR-0022). Steht als Konstante da, damit ein Tippfehler
# im String nicht erst beim Versand auffaellt — dort waere er stumm: ein
# unbekannter Wert findet einfach kein Geraet.
_OWNER_APP = "mynextdaysowner"

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
    Kategorie("messages", Tab.KONTO, "nachrichten", _MAIL_SMS_PUSH),
    # --- Betrieb: Aufgaben und Eigentümer-Meldungen (0331) ----------------
    # Eigene Kategorien statt „listing_activity" mitzubenutzen, weil die
    # EMPFAENGER verschieden sind: task_assigned geht an einen Mitarbeiter,
    # owner_* an den Eigentuemer. Sonst bekaeme eine Reinigungskraft SMS zu
    # Buchungen fremder Objekte, und ein Eigentuemer koennte die Auftrags-
    # Mails nur zusammen mit seinen Buchungsmeldungen abschalten.
    Kategorie("task_assigned", Tab.KONTO, "aufgaben", _MAIL_SMS),
    # Vertretung (0415). Wieder eine eigene Kategorie wegen des EMPFAENGERS:
    # `task_assigned` geht an die EINE zustaendige Person, diese hier an alle,
    # die einspringen koennten — und die Entscheidung zurueck an den
    # Anfragenden. Mit PUSH, weil hier die Zeit zaehlt: faellt jemand heute aus,
    # ist die Reinigung in drei Stunden faellig. Eine Mail, die abends gelesen
    # wird, hilft niemandem; die Glocke sieht nur, wer die Anwendung offen hat.
    Kategorie("task_substitution", Tab.KONTO, "aufgaben", _MAIL_SMS_PUSH),
    # E-Mail Pflicht: Buchung/Aenderung/Storno am eigenen Objekt ist die
    # vertragliche Kerninformation des Eigentuemers (wie guest_policies).
    # PUSH seit ADR-0022, weil es jetzt eine Eigentuemer-App gibt, die ihn
    # empfangen kann. `push_app` MUSS mitgesetzt werden: ohne das ginge die
    # Meldung an Geraete der Verwaltungs-App (Default) — also an ein Telefon,
    # auf dem der Eigentuemer gar nicht angemeldet ist.
    Kategorie(
        "owner_booking", Tab.KONTO, "aktivitaet", _MAIL_SMS_PUSH,
        email_pflicht=True, push_app=_OWNER_APP,
    ),
    Kategorie(
        "owner_service", Tab.KONTO, "aufgaben", _MAIL_SMS_PUSH,
        push_app=_OWNER_APP,
    ),
    # --- Eigentuemer-Chat (0611, ADR-0029) --------------------------------
    # ZWEI Kategorien, weil sie an verschiedene APPS gehen — dieselbe
    # Begruendung wie bei block_request/block_decision: `owner_chat` meldet dem
    # EIGENTUEMER, dass die Verwaltung geschrieben hat (Eigentuemer-App),
    # `betrieb_chat` meldet dem BETRIEB die Nachricht des Eigentuemers
    # (Verwaltungs-App). Eine gemeinsame Kategorie liesse sich nur fuer beide
    # Richtungen zugleich abschalten.
    #
    # KEINE SMS: der Inhalt ist Ende-zu-Ende verschluesselt (ADR-0029), eine
    # SMS koennte also nur „neue Nachricht" sagen — dafuer ist sie zu teuer und
    # zu aufdringlich. Aus demselben Grund `email_pflicht=False`: eine Mail
    # ohne Inhalt ist ein Klick-Anreiz, keine Information.
    #
    # Der TEXT der Meldung nennt NIE den Nachrichteninhalt — der Server kennt
    # ihn nicht. Wer hier je einen Auszug einbaut, hat entweder Chiffretext
    # verschickt oder die Verschluesselung aufgehoben.
    Kategorie(
        "owner_chat", Tab.KONTO, "aktivitaet", _MAIL_PUSH,
        push_app=_OWNER_APP,
    ),
    Kategorie("betrieb_chat", Tab.KONTO, "aktivitaet", _MAIL_PUSH),
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
    Kategorie("betrieb_buchung", Tab.KONTO, "aktivitaet", _MAIL_SMS_PUSH),
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
    # An den ANTRAGSTELLENDEN Eigentuemer, darum `push_app` wie bei owner_*.
    # Der Schluessel traegt kein `owner_`-Praefix — ein Ableiten aus dem Namen
    # haette diese Kategorie an die falsche App geschickt.
    Kategorie(
        "block_decision", Tab.KONTO, "aktivitaet", _MAIL_SMS_PUSH,
        push_app=_OWNER_APP,
    ),
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
    # Eine Buchung kam mit einer Portal-Rate an, die keinem eigenen Preisplan
    # zugeordnet werden konnte, und blieb es auch nach dem sofortigen Abgleich
    # (0432 — der Ratencode war beim Eintreffen der Buchung bereits ungueltig,
    # keine Datenquelle mehr vorhanden, um ihn zu benennen). Nur die Glocke:
    # dieselbe Begruendung wie bei Zustellproblemen — der Betrieb soll es im
    # eigenen Preise-Bereich nachtragen koennen, ohne dass ein fremdes Wort
    # wie „Channex" je auftaucht (Wurzel: Kunde sieht nie den Aggregator).
    Kategorie("portal_rate_verwaist", Tab.KONTO, "aktivitaet", ()),
    # Systemwarnung (§4.1): ein Hintergrundlauf ist gescheitert — Portal-
    # Abgleich, Push an ein Portal, Zimmer-Rueckmeldung. Empfaenger ist, wer
    # die Faehigkeit RECEIVE_SYSTEM_ALERTS traegt (admin UND co_admin), nicht
    # eine fest verdrahtete Rolle (`ereignisse.system_warnungs_empfaenger`).
    # Nur die Glocke, wie bei Zustellproblemen: eine Stoerung trifft viele
    # Laeufe kurz hintereinander, eine Mail je Lauf waere eine Flut.
    Kategorie("systemwarnung", Tab.KONTO, "aktivitaet", ()),
    # Der Gast hat auf ein Buchungsangebot geantwortet (0586, Lastenheft §2.2).
    # E-MAIL IST WAEHLBAR, nicht Pflicht: die Zusage fuehrt von selbst weiter
    # (Zahlung → Buchung), es ist also keine Frist, die jemand verpassen kann.
    # Die Glocke ist immer an, weil der Betrieb den Zeitraum bis zur Zahlung
    # nicht anderweitig verkaufen sollte.
    Kategorie("angebot_antwort", Tab.KONTO, "aktivitaet", _MAIL_SMS),
    # Eine offene Portal-Anfrage (Voranfrage, Buchungsanfrage,
    # Aenderungswunsch, 0398). E-MAIL IST PFLICHT und das ist keine Willkuer:
    # Anders als bei einer Gastnachricht ist Nichtstun hier eine ENTSCHEIDUNG —
    # Airbnb lehnt nach Ablauf der Frist selbst ab. Wer die Meldung abschalten
    # koennte, verloere Buchungen, ohne je zu erfahren, dass es sie gab. SMS
    # bleibt waehlbar, weil die Frist knapp sein kann.
    Kategorie("anfrage_offen", Tab.KONTO, "aktivitaet", _MAIL_SMS, email_pflicht=True),
    # Die kostenlose Testphase laeuft in wenigen Tagen ab (Stripe meldet es drei
    # Tage vorher per `customer.subscription.trial_will_end`).
    #
    # E-MAIL IST PFLICHT, aus demselben Grund wie bei `anfrage_offen`: Nichtstun
    # ist hier eine ENTSCHEIDUNG mit Geldfolge. Am Tag danach zieht Stripe den
    # ersten Beitrag ein — wer die Meldung abschalten koennte, wuerde ohne
    # Vorwarnung belastet. Genau das ist die Beschwerde, die man sich mit einer
    # abwaehlbaren Erinnerung einhandelt.
    #
    # KEIN SMS: die Nachricht traegt einen Link auf die Abo-Seite, und drei Tage
    # sind reichlich Zeit. SMS ist fuer Fristen von Stunden da.
    Kategorie("testphase_endet", Tab.KONTO, "konto", _MAIL, email_pflicht=True),
    # Die KI hat einen Verlauf eskaliert (0498/0499) — negative Stimmung oder
    # eine Eskalationsregel des Betriebs.
    #
    # MAIL + PUSH, KEIN SMS: dieselbe Abwaegung wie bei den anderen
    # Posteingang-Kategorien. Eine Beschwerde ist dringend, aber SMS ist fuer
    # Fristen von Stunden reserviert (`anfrage_offen`), nicht fuer „ein Gast
    # ist veraergert".
    #
    # E-MAIL NICHT PFLICHT, anders als bei `anfrage_offen`: Nichtstun ist hier
    # keine Entscheidung mit Geldfolge — die Eskalation bleibt im Posteingang
    # sichtbar, auch wenn niemand eine Mail bekommt. Ein Betrieb, der den
    # Posteingang ohnehin offen hat, darf den Mail-Kanal abwaehlen.
    Kategorie("ki_eskalation", Tab.KONTO, "nachrichten", _MAIL_PUSH),
    # --- Personal & Dienstplan (0541) -------------------------------------
    # Fuenf Kategorien, je EMPFAENGER eine — dieselbe Regel wie bei Aufgaben
    # und Sperrantraegen: wer eine Meldung abschaltet, darf keine fremde
    # mit-abschalten. Alle mit Push (die spaetere Mitarbeiter-App), keine SMS:
    # Dienstplan und Antraege haben Tage Vorlauf, keine Stunden.
    # An die MITARBEITENDE: Plan veroeffentlicht / geaendert.
    Kategorie("dienstplan", Tab.KONTO, "personal", _MAIL_PUSH),
    # An die LEITUNG (admin/co_admin/shift_lead im Scope): Antrag eingegangen.
    Kategorie("abwesenheit_antrag", Tab.KONTO, "personal", _MAIL_PUSH),
    # An den ANTRAGSTELLER: genehmigt / abgelehnt.
    Kategorie("abwesenheit_entscheidung", Tab.KONTO, "personal", _MAIL_PUSH),
    # An Mitarbeitende mit Freigabe fuer das Objekt: offene Schicht (Bewerbung).
    Kategorie("schicht_offen", Tab.KONTO, "personal", _MAIL_PUSH),
    # An die LEITUNG: Stempelung offen seit Stunden / weicht vom Plan ab. Nur
    # Mail — der Hinweis kommt aus dem Worker-Tick, nicht aus einer Handlung.
    Kategorie("zeit_hinweis", Tab.KONTO, "personal", _MAIL),
    # --- Ausbau 0544/0548: vier weitere, je EMPFAENGER eine ----------------
    # An die angefragte Person (Kollegin bietet ihre Schicht an) UND an die
    # Leitung, sobald angenommen wurde und die Freigabe fehlt.
    Kategorie("schicht_tausch", Tab.KONTO, "personal", _MAIL_PUSH),
    # An die LEITUNG: Ueberstundenantrag eingegangen.
    Kategorie("ueberstunden_antrag", Tab.KONTO, "personal", _MAIL_PUSH),
    # An den ANTRAGSTELLER: genehmigt / abgelehnt.
    Kategorie("ueberstunden_entscheidung", Tab.KONTO, "personal", _MAIL_PUSH),
    # An die LEITUNG: die Schicht hat begonnen, es wurde nicht gestempelt.
    # Die EINZIGE Personal-Kategorie, bei der Push die Dringlichkeit trifft:
    # ein unbesetzter Dienst ist in einer Stunde nicht mehr zu retten.
    Kategorie("verspaetung", Tab.KONTO, "personal", _MAIL_PUSH),
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
