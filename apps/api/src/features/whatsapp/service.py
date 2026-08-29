"""Service-Schicht für whatsapp.

Bidirektionaler WhatsApp-Kanal (Meta Cloud API). Konversation je Gast-Nummer,
Nachrichten in beide Richtungen. Versand über die Cloud API (oder Sandbox-Mock,
wenn WHATSAPP_SANDBOX=true). Eingehende Nachrichten/Status kommen per Webhook.

Tenant-scoped (tenant_id aus dem JWT); der Webhook bestimmt den Tenant über die
bestehende Konversation bzw. den konfigurierten Default-Tenant — nie geraten.
"""
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from supabase import Client

from src.core.config import get_settings
from src.core.logging import get_logger, mask_phone
from src.core.security import AuthContext
from src.features.guests.identity import (
    GuestContact as ResolverContact,
)
from src.features.guests.identity import (
    resolve_or_create_guest,
)

from .client import WhatsAppClient, WhatsAppError
from .onboarding import OnboardingError, WhatsAppOnboarding
from .schemas import (
    OnboardingResult,
    OnboardingStartLink,
    OnboardingStatus,
    SliceHealth,
    TemplateRolloutResult,
    WhatsAppConversation,
    WhatsAppConversationList,
    WhatsAppMessage,
    WhatsAppMessageList,
    WhatsAppStatus,
)
from .templates import rollout, satz_feldreihenfolgen
from .vorlagen_felder import (
    VorlagenFeldFehler,
    nach_katalog,
    nach_meta,
)

log = get_logger("nextdays.whatsapp")

# WhatsApp ist KEIN kostenpflichtiges Zusatzmodul: der Kanal gehört zum
# Grundtarif. Eine eigene Gebühr wäre nach Metas Tech-Provider-Terms (Section 5,
# No Resale) eine unzulässige "fee for your Customers' use of the WhatsApp
# Business Platform" — erlaubt sind nur Gebühren für Leistungen, die von der
# Plattform-Nutzung unabhängig sind. Deshalb steht hier bewusst kein Feature-Gate.
# Metas gehostete Onboarding-Seite (Business-Suite-Domain, NICHT graph.facebook.com).
_SIGNUP_HOST = "https://business.facebook.com"


class WhatsAppServiceError(Exception):
    def __init__(self, message: str, *, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalize_phone(phone: str) -> str:
    """Auf reine Ziffern reduzieren (E.164 ohne '+', wie Meta es nutzt)."""
    return re.sub(r"\D", "", phone or "")


class WhatsAppService:
    slice_name = "whatsapp"

    def __init__(
        self,
        service_client: Client | None = None,
        client: WhatsAppClient | None = None,
    ) -> None:
        self._db = service_client
        self._client = client or WhatsAppClient()

    def health(self) -> SliceHealth:
        return SliceHealth(slice=self.slice_name)

    def status(self) -> WhatsAppStatus:
        s = get_settings()
        return WhatsAppStatus(
            configured=self._client.is_configured,
            sandbox=s.whatsapp_sandbox,
            phone_number_id_set=bool(s.whatsapp_phone_number_id),
        )

    # --- Kunden-Onboarding (Embedded Signup, Tech-Provider-Modell) ----------
    @staticmethod
    def onboarding_startlink() -> OnboardingStartLink:
        """Die Adresse von Metas gehosteter Embedded-Signup-Seite.

        Wird serverseitig gebaut, damit App- und Konfigurations-ID nicht im
        Frontend-Bundle stehen und sich ohne Neu-Deploy des Frontends ändern
        lassen. Fehlt eine der beiden IDs, ist der Vorgang nicht startbar —
        dann sagt der Endpunkt das klar, statt eine kaputte URL zu liefern
        (Wurzel 4).
        """
        s = get_settings()
        if not s.whatsapp_app_id or not s.whatsapp_signup_config_id:
            return OnboardingStartLink(
                available=False,
                reason=(
                    "Das WhatsApp-Onboarding ist noch nicht konfiguriert "
                    "(App- oder Konfigurations-ID fehlt)."
                ),
            )
        query = urlencode(
            {
                "app_id": s.whatsapp_app_id,
                "config_id": s.whatsapp_signup_config_id,
                "extras": '{"version":"v4"}',
            }
        )
        return OnboardingStartLink(
            available=True,
            url=f"{_SIGNUP_HOST}/messaging/whatsapp/onboard/?{query}",
        )

    def onboarding_verbinden(
        self, ctx: AuthContext, *, code: str
    ) -> OnboardingResult:
        """Embedded-Signup abschließen und den Kanal des Betriebs anlegen.

        Setzt das gebuchte Modul voraus: das Verbinden einer Nummer ist Teil der
        kostenpflichtigen Leistung, nicht Vorleistung.
        """
        db, tenant_id = self._require(ctx)
        schluessel = (code or "").strip()
        if not schluessel:
            raise WhatsAppServiceError(
                "Kein Freigabe-Code von Meta erhalten.", status_code=422
            )
        try:
            ergebnis = WhatsAppOnboarding(db).verbinden(tenant_id, schluessel)
        except OnboardingError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        return OnboardingResult(
            waba_id=ergebnis["waba_id"],
            phone_number_id=ergebnis["phone_number_id"],
            display_phone_number=ergebnis.get("display_phone_number"),
            can_send_message=ergebnis.get("can_send_message"),
            send_block_reason=ergebnis.get("send_block_reason"),
            templates=TemplateRolloutResult(**(ergebnis.get("templates") or {})),
        )

    def onboarding_status(self, ctx: AuthContext) -> OnboardingStatus:
        """Kanal-Zustand des Betriebs. Das Zugangstoken wird NICHT selektiert —
        es darf den Server nicht verlassen (Wurzel 6)."""
        db, tenant_id = self._require(ctx)
        res = (
            db.table("whatsapp_account")
            .select(
                "waba_id, phone_number_id, display_phone_number, verified_name, "
                "can_send_message, send_block_reason, quality_rating, "
                "messaging_limit_tier, status"
            )
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            return OnboardingStatus(connected=False)
        row = rows[0]
        return OnboardingStatus(
            connected=row.get("status") == "connected",
            waba_id=row.get("waba_id"),
            phone_number_id=row.get("phone_number_id"),
            display_phone_number=row.get("display_phone_number"),
            verified_name=row.get("verified_name"),
            can_send_message=row.get("can_send_message"),
            send_block_reason=row.get("send_block_reason"),
            quality_rating=row.get("quality_rating"),
            messaging_limit_tier=row.get("messaging_limit_tier"),
            status=row.get("status"),
        )

    # --- Vorlagen (WABA-Ebene, kein Tenant-Bezug bei EINER eigenen Nummer) ---
    # Metas mitgelieferte Beispielvorlagen. Sie gehören keinem Betrieb, lassen
    # sich weder ändern noch löschen und interessieren niemanden hier — sie
    # werden deshalb gar nicht erst ausgeliefert. Erkannt am Namen, weil die
    # API kein Merkmal dafür führt (live geprüft: library_template_name,
    # sub_category und parameter_format sehen aus wie bei eigenen Vorlagen).
    _META_BEISPIELE = ("hello_world", "jaspers_market_")

    @classmethod
    def _ist_meta_beispiel(cls, name: str) -> bool:
        return name.startswith(cls._META_BEISPIELE)

    def list_templates(self, ctx: AuthContext, *, mit_ausgeblendeten: bool = False) -> list[dict]:
        """Vorlagen der WABA DIESES Betriebs mit Prüfstatus.

        Meta ist die Quelle der Wahrheit — wir spiegeln den Status nicht in die
        DB, sonst driftet er. Abgefragt wird die WABA des Betriebs, nicht die
        zentrale: sonst sähe jeder Kunde fremde Vorlagen.
        """
        db, tenant_id = self._require(ctx)
        try:
            vorlagen = self._client_fuer(db, tenant_id).list_templates()
        except WhatsAppError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        vorlagen = [
            v for v in vorlagen if not self._ist_meta_beispiel(v.get("name", ""))
        ]
        # Ausgeblendete raus — es sei denn, der Betrieb will sie sehen, um eine
        # zurückzuholen (Migration 0490).
        versteckt = {
            (z["template_name"], z["language"])
            for z in (
                self._db.table("whatsapp_template_hidden")  # type: ignore[union-attr]
                .select("template_name, language")
                .eq("tenant_id", tenant_id)
                .execute()
            ).data
            or []
        }
        for vorlage in vorlagen:
            vorlage["hidden"] = (
                vorlage.get("name", ""),
                vorlage.get("language", ""),
            ) in versteckt
        if not mit_ausgeblendeten:
            vorlagen = [v for v in vorlagen if not v["hidden"]]
        # Metas {{1}} zurück in {{guest_first_name}}: der Betrieb hat nie eine
        # andere Schreibweise gesehen und soll auch keine zu sehen bekommen.
        #
        # Fehlt die gespeicherte Zuordnung, springt der Standardsatz ein: seine
        # Feldreihenfolge steht im Code, also ist sie auch für Vorlagen bekannt,
        # die vor der Tabelle 0489 ausgerollt wurden. Ohne diesen Rückgriff
        # müsste der Betrieb erst „Satz einreichen" drücken, damit sein Text
        # lesbar wird — eine Bringschuld, die er nicht erraten kann.
        zuordnung = {**satz_feldreihenfolgen(), **self._felder_lesen(db, tenant_id)}
        for vorlage in vorlagen:
            reihenfolge = zuordnung.get(
                (vorlage.get("name", ""), vorlage.get("language", "")), []
            )
            for komponente in vorlage.get("components") or []:
                if (
                    komponente.get("type", "").upper() == "BODY"
                    and komponente.get("text")
                ):
                    komponente["text"] = nach_katalog(
                        komponente["text"], reihenfolge
                    )
        return vorlagen

    # --- Vorlagen anlegen/ändern/löschen (Meta prüft jede Änderung neu) -----
    @staticmethod
    def _pruefe_vorlagentext(text: str) -> list[str]:
        """Metas Textregeln vorab prüfen, statt auf die Ablehnung zu warten.

        Beim ersten Ausrollen unseres eigenen Satzes hat Meta sechs Vorlagen
        abgelehnt — an genau diesen beiden Regeln. Sie stehen in keiner
        Fehlermeldung, sondern nur in der Ablehnung, Tage später. Deshalb hier,
        wo der Text entsteht.

        Geprüft wird der Text in UNSERER Schreibweise ({{guest_first_name}}),
        denn das ist der, den der Betrieb vor sich hat; die Umschrift in Metas
        Positionen ändert an Anfang und Ende nichts.
        """
        fehler: list[str] = []
        gestutzt = (text or "").strip()
        if not gestutzt:
            return ["Der Text darf nicht leer sein."]
        if gestutzt.startswith("{{"):
            fehler.append(
                "Der Text darf nicht mit einem Platzhalter beginnen — "
                "Meta lehnt das ab."
            )
        if gestutzt.endswith("}}"):
            fehler.append(
                "Nach dem letzten Platzhalter muss noch Text folgen; ein "
                "Satzpunkt allein genügt Meta nicht."
            )
        return fehler

    def _felder_speichern(
        self,
        db: Client,
        tenant_id: str,
        name: str,
        sprache: str,
        reihenfolge: list[str],
    ) -> None:
        """Die Zuordnung Position → Feld sichern (Migration 0489).

        Meta speichert sie nicht. Vorher die alten Zeilen löschen, sonst bliebe
        nach dem Kürzen eines Textes eine Position stehen, die es nicht mehr
        gibt — der Gegenzustand zur Änderung (Wurzel 1).
        """
        db.table("whatsapp_template_field").delete().eq(
            "tenant_id", tenant_id
        ).eq("template_name", name).eq("language", sprache).execute()
        if reihenfolge:
            db.table("whatsapp_template_field").insert(
                [
                    {
                        "tenant_id": tenant_id,
                        "template_name": name,
                        "language": sprache,
                        "position": i + 1,
                        "field_key": feld,
                    }
                    for i, feld in enumerate(reihenfolge)
                ]
            ).execute()

    def _felder_lesen(
        self, db: Client, tenant_id: str
    ) -> dict[tuple[str, str], list[str]]:
        """Alle Zuordnungen des Betriebs, je (Vorlage, Sprache) nach Position."""
        zeilen = (
            db.table("whatsapp_template_field")
            .select("template_name, language, position, field_key")
            .eq("tenant_id", tenant_id)
            .execute()
        ).data or []
        gesammelt: dict[tuple[str, str], list[tuple[int, str]]] = {}
        for z in zeilen:
            gesammelt.setdefault(
                (z["template_name"], z["language"]), []
            ).append((z["position"], z["field_key"]))
        return {k: [feld for _, feld in sorted(v)] for k, v in gesammelt.items()}

    def _komponenten(
        self, body: str, footer: str | None
    ) -> tuple[list[dict], list[str]]:
        """Unseren Vorlagentext in Metas Komponenten übersetzen.

        Rückgabe zusätzlich die Feldreihenfolge — sie ist das Wissen, das Meta
        nicht speichert und das ohne uns verloren wäre.
        """
        if fehler := self._pruefe_vorlagentext(body):
            raise WhatsAppServiceError(" ".join(fehler), status_code=422)
        try:
            meta_text, reihenfolge, beispiele = nach_meta(body)
        except VorlagenFeldFehler as exc:
            raise WhatsAppServiceError(str(exc), status_code=422) from exc
        komponenten: list[dict] = [{"type": "BODY", "text": meta_text.strip()}]
        if beispiele:
            komponenten[0]["example"] = {"body_text": [beispiele]}
        if footer and footer.strip():
            komponenten.append({"type": "FOOTER", "text": footer.strip()})
        return komponenten, reihenfolge

    def create_template(
        self,
        ctx: AuthContext,
        *,
        name: str,
        language: str,
        category: str,
        body: str,
        footer: str | None = None,
    ) -> dict:
        """Eine neue Vorlage in der WABA des Betriebs anlegen.

        ``body`` kommt in UNSERER Schreibweise ({{guest_first_name}}) und wird
        hier in Metas Positionen übersetzt — die einzige Stelle, an der beide
        Formen aufeinandertreffen.
        """
        db, tenant_id = self._require(ctx)
        schluessel = (name or "").strip().lower()
        if not re.fullmatch(r"[a-z0-9_]{1,512}", schluessel):
            raise WhatsAppServiceError(
                "Der Name darf nur Kleinbuchstaben, Ziffern und Unterstriche "
                "enthalten (Metas Vorgabe).",
                status_code=422,
            )
        komponenten, reihenfolge = self._komponenten(body, footer)
        try:
            ergebnis = self._client_fuer(db, tenant_id).create_template(
                {
                    "name": schluessel,
                    "language": language,
                    "category": category.upper(),
                    "components": komponenten,
                }
            )
        except WhatsAppError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        # Erst nach Metas Zusage speichern: eine Zuordnung zu einer Vorlage,
        # die es dort nicht gibt, wäre eine Karteileiche.
        self._felder_speichern(db, tenant_id, schluessel, language, reihenfolge)
        return ergebnis

    def update_template(
        self,
        ctx: AuthContext,
        *,
        template_id: str,
        name: str,
        language: str,
        body: str,
        footer: str | None = None,
    ) -> dict:
        """Text einer vorhandenen Vorlage ändern.

        Metas Update ersetzt ALLE Komponenten. Die Fußzeile wird deshalb
        mitgeschickt: wer sie wegließe, verlöre sie ohne Fehlermeldung
        (Wurzel 1). Name und Sprache dienen nur dem Wiederfinden der
        Feld-Zuordnung — ändern lassen sie sich bei Meta ohnehin nicht.
        """
        db, tenant_id = self._require(ctx)
        komponenten, reihenfolge = self._komponenten(body, footer)
        try:
            ergebnis = self._client_fuer(db, tenant_id).update_template(
                template_id, komponenten
            )
        except WhatsAppError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        self._felder_speichern(db, tenant_id, name, language, reihenfolge)
        return ergebnis

    def hide_template(
        self, ctx: AuthContext, *, name: str, language: str, hidden: bool
    ) -> dict:
        """Eine Vorlage in myNextDays aus- oder wieder einblenden.

        Bei Meta ändert das nichts: die Vorlage bleibt bestehen, samt Freigabe.
        Genau das ist der Unterschied zum Löschen, und deshalb sind es zwei
        verschiedene Wege und nicht derselbe Knopf.
        """
        db, tenant_id = self._require(ctx)
        gestutzt = (name or "").strip()
        if not gestutzt or not (language or "").strip():
            raise WhatsAppServiceError(
                "Name und Sprache der Vorlage fehlen.", status_code=422
            )
        if hidden:
            db.table("whatsapp_template_hidden").upsert(
                {
                    "tenant_id": tenant_id,
                    "template_name": gestutzt,
                    "language": language,
                },
                on_conflict="tenant_id,template_name,language",
            ).execute()
        else:
            db.table("whatsapp_template_hidden").delete().eq(
                "tenant_id", tenant_id
            ).eq("template_name", gestutzt).eq("language", language).execute()
        return {"name": gestutzt, "language": language, "hidden": hidden}

    def delete_template(
        self, ctx: AuthContext, *, name: str, template_id: str | None = None
    ) -> dict:
        """Eine Vorlage löschen (mit ID genau diese Sprachfassung)."""
        db, tenant_id = self._require(ctx)
        gestutzt = (name or "").strip()
        if not gestutzt:
            raise WhatsAppServiceError("Name der Vorlage fehlt.", status_code=422)
        try:
            ergebnis = self._client_fuer(db, tenant_id).delete_template(
                gestutzt, template_id=template_id
            )
        except WhatsAppError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        # Gegenzustand: die Feld-Zuordnung der gelöschten Vorlage mitnehmen,
        # sonst bleibt sie liegen und trifft später eine gleichnamige neue
        # Vorlage mit einer falschen Reihenfolge (Wurzel 1).
        db.table("whatsapp_template_field").delete().eq(
            "tenant_id", tenant_id
        ).eq("template_name", gestutzt).execute()
        return ergebnis

    def rollout_templates(self, ctx: AuthContext) -> dict:
        """Den Vorlagensatz in die WABA des Betriebs ausrollen (idempotent).

        Beim Onboarding läuft das automatisch; hier ist der Weg, ihn später
        nachzuziehen — etwa wenn der Satz um eine Vorlage wächst oder Meta eine
        abgelehnt hat (s. templates.py).
        """
        db, tenant_id = self._require(ctx)
        try:
            ergebnis = rollout(self._client_fuer(db, tenant_id))
        except WhatsAppError as exc:
            raise WhatsAppServiceError(
                exc.message, status_code=exc.status_code
            ) from exc
        # Die Feldreihenfolge auch fuer uebersprungene Vorlagen sichern: sie
        # koennen aus einem Rollout stammen, der aelter ist als die
        # Zuordnungstabelle (0489). Ohne diesen Nachtrag zeigte der Editor bei
        # genau diesen Vorlagen weiter Metas {{1}}.
        felder = ergebnis.pop("felder", {}) or {}
        for kennung, reihenfolge in felder.items():
            name, _, sprache = str(kennung).partition("/")
            if name and sprache:
                self._felder_speichern(db, tenant_id, name, sprache, reihenfolge)
        return ergebnis

    def _client_fuer(self, db: Client, tenant_id: str) -> WhatsAppClient:
        """Der WhatsApp-Client DIESES Betriebs — Token, Nummer und WABA aus
        ``whatsapp_account`` (Embedded Signup, Migration 0255).

        Warum nicht der global konfigurierte Client: im Tech-Provider-Modell
        bringt jeder Betrieb seine EIGENE Nummer mit. Ein Versand über die
        zentrale Nummer wäre für den Gast der falsche Absender und für uns ein
        Fremdversand auf fremde Rechnung — beides still, weil ein Aufruf über
        den globalen Client genauso 200 liefert.

        Der globale Client bleibt NUR für den einen Altbestands-Betrieb, der
        über ``WHATSAPP_DEFAULT_TENANT_ID`` an der zentralen Nummer hängt; er
        verschwindet mit der letzten Zeile, die keinen eigenen Account hat.
        Kein Konto und kein Default → klarer 409 statt eines Versands über eine
        fremde Nummer (Wurzel 4: kein plausibler Ersatzwert).
        """
        zeile = (
            db.table("whatsapp_account")
            .select("access_token, phone_number_id, waba_id, status")
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        ).data
        if zeile:
            konto = zeile[0]
            if konto.get("status") == "disconnected":
                raise WhatsAppServiceError(
                    "Die WhatsApp-Nummer dieses Betriebs ist getrennt. "
                    "Bitte im Kanalmanager neu verbinden.",
                    status_code=409,
                )
            return WhatsAppClient(
                access_token=konto.get("access_token") or None,
                phone_number_id=konto.get("phone_number_id") or None,
                waba_id=konto.get("waba_id") or None,
            )
        if tenant_id == (get_settings().whatsapp_default_tenant_id or None):
            log.info("whatsapp_client_ueber_default", tenant_id=tenant_id)
            return self._client
        raise WhatsAppServiceError(
            "Für diesen Betrieb ist keine WhatsApp-Nummer verbunden.",
            status_code=409,
        )

    def _require(self, ctx: AuthContext) -> tuple[Client, str]:
        if not ctx.tenant_id:
            raise WhatsAppServiceError("Kein Tenant im Token.", status_code=403)
        if self._db is None:
            raise WhatsAppServiceError("WhatsApp-DB nicht verfügbar.", status_code=500)
        return self._db, ctx.tenant_id

    @staticmethod
    def _sandbox() -> bool:
        return get_settings().whatsapp_sandbox

    # --- Lesen --------------------------------------------------------------
    def list_conversations(self, ctx: AuthContext) -> WhatsAppConversationList:
        db, tenant_id = self._require(ctx)
        # Gastname über die zentrale Maske (Daten-Split §4): ohne VIEW_GUEST_NAME
        # nur Vorname — dieselbe Wahrheit wie inbox/reservations.
        from src.features.auth.guest_masking import load_guest_mask

        mask = load_guest_mask(db, ctx.user_id)
        res = (
            db.table("whatsapp_conversation")
            .select("id, wa_phone, guest_name, reservation_id, last_message, last_at, is_read")
            .eq("tenant_id", tenant_id)
            .order("last_at", desc=True)
            .limit(200)
            .execute()
        )
        items = [
            WhatsAppConversation(
                id=c["id"], wa_phone=c["wa_phone"],
                guest_name=mask.name(c.get("guest_name")),
                reservation_id=c.get("reservation_id"),
                last_message=c.get("last_message"), last_at=c.get("last_at"),
                is_read=bool(c.get("is_read", True)),
            )
            for c in (res.data or [])
        ]
        return WhatsAppConversationList(items=items, total=len(items))

    def list_messages(
        self, ctx: AuthContext, conversation_id: str
    ) -> WhatsAppMessageList:
        db, tenant_id = self._require(ctx)
        self._load_conversation(db, tenant_id, conversation_id)
        res = (
            db.table("whatsapp_message")
            .select("id, direction, body, status, created_at")
            .eq("tenant_id", tenant_id)
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
        items = [
            WhatsAppMessage(
                id=m["id"], direction=m["direction"], body=m.get("body") or "",
                status=m.get("status") or "sent", sent_at=m.get("created_at"),
            )
            for m in (res.data or [])
        ]
        # Eingehende als gelesen markieren (Konversation öffnen).
        db.table("whatsapp_conversation").update({"is_read": True}).eq(
            "tenant_id", tenant_id
        ).eq("id", conversation_id).execute()
        return WhatsAppMessageList(items=items, total=len(items))

    def _load_conversation(self, db: Client, tenant_id: str, conv_id: str) -> dict:
        res = (
            db.table("whatsapp_conversation")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("id", conv_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise WhatsAppServiceError("Konversation nicht gefunden.", status_code=404)
        return res.data[0]

    def _upsert_conversation(
        self, db: Client, tenant_id: str, wa_phone: str, *, guest_name: str | None = None
    ) -> dict:
        existing = (
            db.table("whatsapp_conversation")
            .select("*")
            .eq("tenant_id", tenant_id)
            .eq("wa_phone", wa_phone)
            .limit(1)
            .execute()
        ).data
        if existing:
            conv = existing[0]
            # Nachzügler: Gast verknüpfen, falls eine Alt-Konversation ohne
            # guest_id existiert (z. B. vor Einführung des Resolvers angelegt).
            if not conv.get("guest_id"):
                guest_id = self._resolve_guest(db, tenant_id, wa_phone, guest_name)
                if guest_id:
                    db.table("whatsapp_conversation").update(
                        {"guest_id": guest_id}
                    ).eq("id", conv["id"]).execute()
                    conv["guest_id"] = guest_id
            return conv
        # Neue Konversation: Gast zentral auflösen (Telefon-/Kanal-ID-Match).
        guest_id = self._resolve_guest(db, tenant_id, wa_phone, guest_name)
        ins = (
            db.table("whatsapp_conversation")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "wa_phone": wa_phone,
                    "guest_name": guest_name,
                    "guest_id": guest_id,
                }
            )
            .execute()
        ).data
        return ins[0]

    @staticmethod
    def _resolve_guest(
        db: Client, tenant_id: str, wa_phone: str, guest_name: str | None
    ) -> str | None:
        """WhatsApp-Kontakt → Gast über den zentralen Resolver.

        wa_phone ist E.164 ohne '+' (Meta-Format); für die Normalisierung im
        Resolver mit '+' präfixen. Kanal-ID = WhatsApp-Nummer (stabil je Gast)."""
        return resolve_or_create_guest(
            db,
            tenant_id,
            ResolverContact(
                name=guest_name,
                phone=f"+{wa_phone}" if wa_phone else None,
                channel="whatsapp",
                external_ref=wa_phone or None,
            ),
        )

    # --- Senden -------------------------------------------------------------
    # Meta-Regel: freie Textnachrichten sind nur INNERHALB von 24 h nach der
    # letzten EINGEHENDEN Nachricht erlaubt. Außerhalb (oder ohne jede eingehende
    # Nachricht) sind ausschließlich Template-Nachrichten zulässig.
    _SERVICE_WINDOW = timedelta(hours=24)

    def _last_inbound_at(self, db: Client, tenant_id: str, conv_id: str) -> datetime | None:
        """Zeitpunkt der jüngsten EINGEHENDEN Nachricht der Konversation (oder None)."""
        res = (
            db.table("whatsapp_message")
            .select("created_at")
            .eq("tenant_id", tenant_id)
            .eq("conversation_id", conv_id)
            .eq("direction", "in")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        ).data
        if not res:
            return None
        raw = res[0].get("created_at")
        if not raw:
            return None
        try:
            return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            return None

    def _within_service_window(self, db: Client, tenant_id: str, conv_id: str) -> bool:
        """True, wenn die letzte eingehende Nachricht < 24 h her ist."""
        last_in = self._last_inbound_at(db, tenant_id, conv_id)
        if last_in is None:
            return False
        if last_in.tzinfo is None:
            last_in = last_in.replace(tzinfo=UTC)
        return datetime.now(UTC) - last_in < self._SERVICE_WINDOW

    def _resolve_target(
        self, db: Client, tenant_id: str, conversation_id: str | None, to_phone: str | None
    ) -> dict:
        """Ziel-Konversation laden oder per Telefonnummer anlegen (gemeinsam)."""
        if conversation_id:
            return self._load_conversation(db, tenant_id, conversation_id)
        phone = _normalize_phone(to_phone or "")
        if len(phone) < 6:
            raise WhatsAppServiceError(
                "Gültige Telefonnummer mit Ländervorwahl nötig.", status_code=422
            )
        return self._upsert_conversation(db, tenant_id, phone)

    def _persist_outgoing(
        self,
        db: Client,
        tenant_id: str,
        conv: dict,
        *,
        body: str,
        wa_message_id: str | None,
        status: str,
        last_message: str,
    ) -> WhatsAppMessage:
        """Ausgehende Nachricht speichern + Konversation aktualisieren (gemeinsam)."""
        ins = (
            db.table("whatsapp_message")
            .insert(
                {
                    "tenant_id": tenant_id,
                    "conversation_id": conv["id"],
                    "direction": "out",
                    "body": body,
                    "wa_message_id": wa_message_id,
                    "status": status,
                }
            )
            .execute()
        ).data
        m = ins[0] if ins else {}
        db.table("whatsapp_conversation").update(
            {"last_message": last_message}
        ).eq("tenant_id", tenant_id).eq("id", conv["id"]).execute()
        return WhatsAppMessage(
            id=m.get("id"), direction="out", body=body,
            status=status, sent_at=m.get("created_at"),
        )

    def send(
        self,
        ctx: AuthContext,
        *,
        conversation_id: str | None,
        to_phone: str | None,
        body: str,
    ) -> WhatsAppMessage:
        db, tenant_id = self._require(ctx)
        text = (body or "").strip()
        if not text:
            raise WhatsAppServiceError("Nachricht darf nicht leer sein.", status_code=422)

        conv = self._resolve_target(db, tenant_id, conversation_id, to_phone)

        # 24-h-Servicefenster: freier Text nur innerhalb. Außerhalb → Template nötig.
        if not self._sandbox() and not self._within_service_window(
            db, tenant_id, conv["id"]
        ):
            raise WhatsAppServiceError(
                "Außerhalb des 24-Stunden-Servicefensters: Es ist nur eine "
                "Template-Nachricht erlaubt (send-template).",
                status_code=409,
            )

        wa_message_id = None
        if not self._sandbox():
            try:
                res = self._client_fuer(db, tenant_id).send_text(conv["wa_phone"], text)
            except WhatsAppError as exc:
                raise WhatsAppServiceError(exc.message, status_code=exc.status_code) from exc
            msgs = res.get("messages") or []
            wa_message_id = msgs[0].get("id") if msgs else None

        return self._persist_outgoing(
            db, tenant_id, conv,
            body=text, wa_message_id=wa_message_id, status="sent", last_message=text,
        )

    def send_template(
        self,
        ctx: AuthContext,
        *,
        conversation_id: str | None,
        to_phone: str | None,
        template_name: str,
        language_code: str = "de",
        variables: list[str] | None = None,
    ) -> WhatsAppMessage:
        """Template-Nachricht senden (auch außerhalb des 24-h-Fensters erlaubt)."""
        db, tenant_id = self._require(ctx)
        name = (template_name or "").strip()
        if not name:
            raise WhatsAppServiceError("Template-Name nötig.", status_code=422)

        conv = self._resolve_target(db, tenant_id, conversation_id, to_phone)

        # Body-Variablen → Meta-Components (geordnete {{1}}, {{2}}, …).
        components: list[dict] | None = None
        if variables:
            components = [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": v} for v in variables],
                }
            ]

        wa_message_id = None
        if not self._sandbox():
            try:
                res = self._client_fuer(db, tenant_id).send_template(
                    conv["wa_phone"], name, language_code, components
                )
            except WhatsAppError as exc:
                raise WhatsAppServiceError(exc.message, status_code=exc.status_code) from exc
            msgs = res.get("messages") or []
            wa_message_id = msgs[0].get("id") if msgs else None

        # Im Verlauf als „Vorlage: <name>" sichtbar (der gerenderte Text liegt bei Meta).
        body_label = f"[Vorlage: {name}]"
        return self._persist_outgoing(
            db, tenant_id, conv,
            body=body_label, wa_message_id=wa_message_id, status="sent",
            last_message=body_label,
        )

    # --- Webhook (eingehend, kein JWT) -------------------------------------
    def ingest_webhook(self, payload: dict) -> dict:
        """Eingehende WhatsApp-Nachrichten + Status verarbeiten (Meta-Format).

        Tenant: bestehende Konversation (per Nummer) → deren Tenant; sonst der
        konfigurierte Default-Tenant. Ohne beides wird die Nachricht protokolliert
        verworfen (kein Raten)."""
        if self._db is None:
            raise WhatsAppServiceError("WhatsApp-DB nicht verfügbar.", status_code=500)
        db = self._db
        received = 0
        verloren = 0
        for entry in payload.get("entry", []) or []:
            # entry.id ist die WABA-ID des Betriebs. Sie ist der EINDEUTIGE
            # Zuordnungsschlüssel im Tech-Provider-Modell (Meta: Webhooks
            # Overview) — anders als die Gast-Nummer, die bei zwei Betrieben
            # mit demselben Gast doppelt vorkommt.
            waba_id = entry.get("id")
            for change in entry.get("changes", []) or []:
                value = change.get("value") or {}
                phone_number_id = (value.get("metadata") or {}).get(
                    "phone_number_id"
                )
                besitzer = self._tenant_aus_account(db, waba_id, phone_number_id)
                contacts = {
                    c.get("wa_id"): (c.get("profile") or {}).get("name")
                    for c in (value.get("contacts") or [])
                }
                for msg in value.get("messages") or []:
                    # Ein einzelner Schreibfehler darf weder die übrigen
                    # Nachrichten des Payloads mitreissen noch nach aussen als
                    # 500 gehen: Meta wiederholt dann bis zu vier Mal und die
                    # Nachricht ist am Ende trotzdem verloren — still, weil
                    # niemand den Webhook beobachtet. Live passiert am
                    # 29.08.2026: WHATSAPP_DEFAULT_TENANT_ID zeigte auf einen
                    # Tenant, den es nicht gab; der Fremdschluessel schlug zu,
                    # und JEDE eingehende Gastnachricht ging verloren
                    # (whatsapp_message war leer). Deshalb hier LAUT loggen und
                    # weitermachen (Wurzel 5).
                    try:
                        if self._store_incoming(db, msg, contacts, besitzer):
                            received += 1
                    except Exception as exc:  # noqa: BLE001 — siehe oben
                        verloren += 1
                        log.error(
                            "whatsapp_eingang_verworfen",
                            fehler=str(exc),
                            waba_id=waba_id,
                            phone_number_id=phone_number_id,
                            wa_message_id=msg.get("id"),
                        )
                # Status-Updates (sent/delivered/read/failed) der Ausgangsnachrichten.
                for st in value.get("statuses") or []:
                    try:
                        self._apply_status(db, st)
                    except Exception as exc:  # noqa: BLE001 — wie oben
                        log.error("whatsapp_status_verworfen", fehler=str(exc))
        if verloren:
            log.error("whatsapp_eingang_verluste", anzahl=verloren)
        return {"received": received, "verloren": verloren}

    @staticmethod
    def _tenant_aus_account(
        db: Client, waba_id: str | None, phone_number_id: str | None
    ) -> str | None:
        """Betrieb über die EMPFANGENDE Nummer bestimmen (whatsapp_account).

        Das ist die belastbare Zuordnung: die Nummer, an die der Gast schreibt,
        gehört genau einem Betrieb (unique auf phone_number_id, Migration 0255).
        Zuerst über die Nummer, dann über die WABA — eine WABA kann mehrere
        Nummern tragen, die Nummer ist der genauere Schlüssel.
        """
        if phone_number_id:
            treffer = (
                db.table("whatsapp_account")
                .select("tenant_id")
                .eq("phone_number_id", str(phone_number_id))
                .limit(1)
                .execute()
            ).data
            if treffer:
                return treffer[0]["tenant_id"]
        if waba_id:
            treffer = (
                db.table("whatsapp_account")
                .select("tenant_id")
                .eq("waba_id", str(waba_id))
                .limit(1)
                .execute()
            ).data
            if treffer:
                return treffer[0]["tenant_id"]
        return None

    def _resolve_tenant(self, db: Client, wa_phone: str) -> str | None:
        """Rückfallweg, wenn der Webhook keine bekannte Nummer/WABA trägt.

        NUR für den Altbestand mit einer einzigen globalen Nummer. Die Gast-Nummer
        ist KEIN eindeutiger Schlüssel — schreiben zwei Betriebe mit demselben
        Gast, trifft es den erstgefundenen. Deshalb wird der Treffer protokolliert,
        damit dieser Pfad sichtbar bleibt und mit dem letzten Altkunden verschwindet.
        """
        existing = (
            db.table("whatsapp_conversation")
            .select("tenant_id")
            .eq("wa_phone", wa_phone)
            .limit(1)
            .execute()
        ).data
        if existing:
            log.info(
                "whatsapp_tenant_ueber_gastnummer",
                wa_phone=mask_phone(wa_phone),
                hinweis="kein whatsapp_account-Treffer, Altpfad",
            )
            return existing[0]["tenant_id"]
        default = get_settings().whatsapp_default_tenant_id
        if not default:
            return None
        # Der Default ist eine Umgebungsvariable — sie kann auf einen Betrieb
        # zeigen, den es nicht (mehr) gibt. Ungeprüft übernommen bricht der
        # Fremdschlüssel beim Insert, und zwar bei JEDER Nachricht. Also einmal
        # nachsehen und den Mangel benennen, statt ihn als Datenbankfehler
        # weiterzureichen (Wurzel 4/5).
        if not (
            db.table("tenants").select("id").eq("id", default).limit(1).execute()
        ).data:
            log.error(
                "whatsapp_default_tenant_unbekannt",
                tenant_id=default,
                hinweis="WHATSAPP_DEFAULT_TENANT_ID zeigt auf keinen Betrieb",
            )
            return None
        log.info("whatsapp_tenant_ueber_default", wa_phone=mask_phone(wa_phone))
        return default

    def _store_incoming(
        self, db: Client, msg: dict, contacts: dict, tenant_id: str | None = None
    ) -> bool:
        wa_phone = _normalize_phone(msg.get("from") or "")
        if not wa_phone:
            return False
        body = ((msg.get("text") or {}).get("body")) or ""
        wa_message_id = msg.get("id")
        tenant_id = tenant_id or self._resolve_tenant(db, wa_phone)
        if not tenant_id:
            log.warning("whatsapp_no_tenant", wa_phone=mask_phone(wa_phone))
            return False
        conv = self._upsert_conversation(
            db, tenant_id, wa_phone, guest_name=contacts.get(wa_phone)
        )
        # Idempotenz: gleiche Meta-ID nicht doppelt (unique index fängt es auch ab).
        if wa_message_id:
            dup = (
                db.table("whatsapp_message")
                .select("id")
                .eq("tenant_id", tenant_id)
                .eq("wa_message_id", wa_message_id)
                .limit(1)
                .execute()
            ).data
            if dup:
                return False
        db.table("whatsapp_message").insert(
            {
                "tenant_id": tenant_id,
                "conversation_id": conv["id"],
                "direction": "in",
                "body": body,
                "wa_message_id": wa_message_id,
                "status": "received",
            }
        ).execute()
        db.table("whatsapp_conversation").update(
            {"last_message": body, "is_read": False}
        ).eq("tenant_id", tenant_id).eq("id", conv["id"]).execute()
        return True

    def _apply_status(self, db: Client, st: dict) -> None:
        wa_message_id = st.get("id")
        status = st.get("status")
        if not (wa_message_id and status):
            return
        # Der Meta-Status-Webhook trägt keinen Tenant. Die wa_message_id ist NUR pro
        # (tenant_id, wa_message_id) eindeutig (0041) — dieselbe Meta-ID KANN unter
        # zwei Tenants existieren. Ein Update allein über wa_message_id würde dann
        # beide Zeilen tenant-übergreifend treffen (falscher Zustellstatus in fremder
        # Konversation). Deshalb die Zeile(n) zuerst laden und je Zeile TENANT-scoped
        # aktualisieren (jede bleibt in ihrem Tenant) — nie ein tenant-loser Update.
        rows = (
            db.table("whatsapp_message")
            .select("tenant_id")
            .eq("wa_message_id", wa_message_id)
            .execute()
        ).data or []
        for row in rows:
            db.table("whatsapp_message").update({"status": status}).eq(
                "tenant_id", row["tenant_id"]
            ).eq("wa_message_id", wa_message_id).execute()
