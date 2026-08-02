"""Groq-Client für KI-Antwortvorschläge im Posteingang.

Nutzt die OpenAI-kompatible Chat-Completions-API von Groq. Aus dem bisherigen
Nachrichtenverlauf + dem Reservierungskontext wird ein freundlicher, knapper
Antwortvorschlag für den Gastgeber erzeugt. Keine Fallback-Antwort: fehlt der
Key oder schlägt der Call fehl, wird ein klarer Fehler gemeldet (kein erfundener
Text), passend zur Projekt-Regel „keine Fallbacks".
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

if TYPE_CHECKING:
    from .schemas import AiSettings, InboxMessage, ReservationDetail

log = get_logger("nextdays.inbox.ai")

_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class GroqClient:
    def __init__(self, *, api_key: str | None = None, model: str | None = None) -> None:
        settings = get_settings()
        self._api_key = api_key or settings.groq_api_key.get_secret_value()
        self._model = model or settings.groq_model

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    def suggest_reply(
        self,
        *,
        history: list[InboxMessage],
        reservation: ReservationDetail,
        settings: AiSettings | None = None,
        knowledge: list[str] | None = None,
    ) -> str:
        """Antwortvorschlag erzeugen. `history`=Liste InboxMessage, `reservation`=
        ReservationDetail, `settings`=AiSettings (Ton/Sprache/Signatur/Prompt),
        `knowledge`=Fakten aus der Wissensdatenbank.

        Ohne `knowledge` kann das Modell auf „Wie ist das WLAN-Passwort?" nichts
        anderes tun als um Klärung zu bitten — der System-Prompt verbietet ihm
        (zu Recht) das Erfinden von Fakten. Die Wissensdatenbank ist genau die
        Menge an Angaben, die es benutzen DARF."""
        if not self.is_configured:
            raise GroqError(
                "KI-Antworten sind nicht konfiguriert (Groq-API-Key fehlt).",
                status_code=503,
            )

        context_lines = []
        r = reservation
        if r.listing_name:
            context_lines.append(f"Unterkunft: {r.listing_name}")
        if r.address:
            context_lines.append(f"Adresse: {r.address}")
        if r.guest_name:
            context_lines.append(f"Gast: {r.guest_name}")
        if r.check_in and r.check_out:
            context_lines.append(f"Aufenthalt: {r.check_in} bis {r.check_out}")
        if r.ota_name:
            context_lines.append(f"Portal: {r.ota_name}")
        context = "\n".join(context_lines) or "Keine Buchungsdetails verfügbar."

        convo = "\n".join(
            f"{'Gast' if m.sender == 'guest' else 'Gastgeber'}: {m.message}"
            for m in history
            if m.message
        ) or "(noch keine Nachrichten)"

        # Tonfall + Sprache + Signatur + Zusatzanweisung aus den Einstellungen.
        tone = getattr(settings, "tone", None) or "freundlich"
        language = getattr(settings, "language", None) or "auto"
        signature = getattr(settings, "signature", None)
        extra = getattr(settings, "extra_prompt", None)
        lang_line = (
            "in der Sprache des Gastes"
            if language == "auto"
            else f"auf {language.upper()}"
        )
        system = (
            f"Du bist ein {tone}er, professioneller Gastgeber-Assistent für "
            f"Ferienunterkünfte. Formuliere eine kurze, hilfreiche Antwort auf die "
            f"letzte Gastnachricht — {lang_line}, höflich und konkret. "
            "Erfinde KEINE Fakten (z.B. WLAN-Passwörter, Adressen), die nicht im "
            "Kontext stehen; bitte sonst um Klärung. Gib NUR den Antworttext zurück."
        )
        if signature:
            system += f" Beende die Nachricht mit dieser Signatur: {signature}."
        if extra:
            system += f" Zusätzliche Anweisung: {extra}"
        wissen = "\n".join(f"- {f}" for f in (knowledge or []) if f.strip())
        wissen_block = (
            f"Gesicherte Angaben zu dieser Unterkunft (nur diese als Fakten "
            f"verwenden):\n{wissen}\n\n"
            if wissen
            else ""
        )
        user = (
            f"Buchungskontext:\n{context}\n\n"
            f"{wissen_block}"
            f"Bisheriger Verlauf:\n{convo}\n\n"
            "Schreibe den Antwortvorschlag des Gastgebers."
        )

        return self.chat(system=system, user=user, temperature=0.4, max_tokens=400)

    def chat(
        self,
        *,
        system: str,
        user: str,
        temperature: float = 0.4,
        max_tokens: int = 400,
    ) -> str:
        """Generischer Chat-Completion-Aufruf (system+user → Text). Wiederverwendbar
        für andere KI-Funktionen (z. B. Preiserklärung). Kein Key → klarer Fehler
        (keine Fallback-Antwort).

        gpt-oss-* sind Reasoning-Modelle: ohne gedrosseltes reasoning_effort
        verbrauchen sie das gesamte Token-Budget fürs „Nachdenken" und liefern ein
        leeres content-Feld. Daher reasoning_effort=low + großzügiges max_tokens-
        Budget; das antwortende content-Feld wird normal gelesen."""
        if not self.is_configured:
            raise GroqError(
                "KI ist nicht konfiguriert (Groq-API-Key fehlt).", status_code=503
            )
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
            # Reasoning-Modelle brauchen Budget fürs Denken ZUSÄTZLICH zur Antwort.
            "max_tokens": max_tokens + 600,
            # Groq-Param für gpt-oss: knapp denken, dann antworten (sonst leeres content).
            "reasoning_effort": "low",
        }
        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    _GROQ_URL,
                    headers={
                        "Authorization": f"Bearer {self._api_key}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
        except httpx.HTTPError as exc:
            log.error("groq_network_error", error=str(exc))
            raise GroqError("KI-Dienst nicht erreichbar.") from exc

        if resp.status_code >= 400:
            log.error("groq_http_error", status=resp.status_code, body=resp.text[:500])
            raise GroqError(
                f"KI-Dienst antwortete mit Fehler ({resp.status_code}).",
                status_code=502,
            )
        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise GroqError("KI lieferte keine Antwort.")
        msg = choices[0].get("message") or {}
        # Primär content; bei Reasoning-Modellen ausnahmsweise reasoning als Quelle,
        # falls content trotz Budget leer bleibt (kein erfundener Text).
        text = (msg.get("content") or "").strip() or (msg.get("reasoning") or "").strip()
        if not text:
            raise GroqError("KI lieferte eine leere Antwort.")
        return text
