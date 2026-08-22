"""Zusammenbau der v1.

Die Reihenfolge ist nicht beliebig: FastAPI vergleicht Pfade in der Reihenfolge
der Registrierung. `rates` bringt `/rate-plans` und `/rates` mit und muss vor
Routern stehen, die einen Pfadparameter auf derselben Ebene tragen — sonst
schluckt `/{etwas}` den festen Pfad.
"""
from fastapi import APIRouter

from . import (
    availability,
    events,
    global_,
    guests,
    oauth,
    objekt_beiwerk,
    properties,
    quotes,
    rates,
    reservations,
    reservations_verwalten,
    tasks,
    webhooks,
)

router = APIRouter()

# Auth und Selbstauskunft zuerst: sie haben feste Pfade ohne Parameter.
router.include_router(oauth.router)
# Normdaten: feste Pfade, kein Mandantenbezug.
router.include_router(global_.router)
# `/quote` ist ein fester Pfad und muss vor Routern mit Pfadparametern auf
# derselben Ebene stehen.
router.include_router(quotes.router)
router.include_router(rates.router)
# Das Beiwerk eines Objekts (Zusatzleistungen, Konditionen, Kanäle, Zugang)
# steht VOR `properties`: seine Pfade sind tiefer, aber die Registrierung
# entscheidet, und ein `/{property_id}` davor würde `addons` als ID lesen.
router.include_router(objekt_beiwerk.router)
router.include_router(properties.router)
router.include_router(availability.router)
# Die Verwaltung einer bestehenden Buchung ZUERST: sie bringt `/unread` mit,
# einen festen Pfad, den `/{reservation_id}` sonst als ID lesen würde.
router.include_router(reservations_verwalten.router)
router.include_router(reservations.router)
router.include_router(guests.router)
router.include_router(tasks.router)
router.include_router(webhooks.router)
# `/events` liegt neben `/webhooks`: dieselbe Domäne (Ereignisse), derselbe
# Scope, aber der ABHOL-Weg statt des Push-Wegs.
router.include_router(events.router)

__all__ = ["router"]
