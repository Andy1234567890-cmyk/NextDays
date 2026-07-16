"""structlog-Setup: Console-Renderer lokal, JSON in Produktion."""
import logging
import sys

import structlog


def configure_logging(level: str = "INFO", *, json_logs: bool = False) -> None:
    log_level = getattr(logging, level.upper(), logging.INFO)

    logging.basicConfig(format="%(message)s", stream=sys.stdout, level=log_level)

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer()
        if json_logs
        else structlog.dev.ConsoleRenderer()
    )

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)


def mask_email(email: str | None) -> str:
    """E-Mail für Logs maskieren (DSGVO/CWE-532): erstes Zeichen + Domain, Rest
    durch '***'. ``None``/leer → '—'. Genug zur Fehlersuche, keine PII im Klartext."""
    if not email or "@" not in email:
        return "—"
    local, _, domain = email.partition("@")
    head = local[0] if local else ""
    return f"{head}***@{domain}"


def mask_phone(phone: str | None) -> str:
    """Telefonnummer für Logs maskieren: nur die letzten 3 Ziffern sichtbar."""
    if not phone:
        return "—"
    digits = [c for c in phone if c.isdigit()]
    if len(digits) <= 3:
        return "***"
    return "***" + "".join(digits[-3:])
