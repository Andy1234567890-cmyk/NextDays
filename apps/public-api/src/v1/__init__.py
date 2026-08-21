"""Zusammenbau der v1.

Die Reihenfolge ist nicht beliebig: FastAPI vergleicht Pfade in der Reihenfolge
der Registrierung. `rates` bringt `/rate-plans` und `/rates` mit und muss vor
Routern stehen, die einen Pfadparameter auf derselben Ebene tragen — sonst
schluckt `/{etwas}` den festen Pfad.
"""
from fastapi import APIRouter

from . import availability, guests, oauth, properties, rates, reservations, tasks, webhooks

router = APIRouter()

# Auth und Selbstauskunft zuerst: sie haben feste Pfade ohne Parameter.
router.include_router(oauth.router)
router.include_router(rates.router)
router.include_router(properties.router)
router.include_router(availability.router)
router.include_router(reservations.router)
router.include_router(guests.router)
router.include_router(tasks.router)
router.include_router(webhooks.router)

__all__ = ["router"]
