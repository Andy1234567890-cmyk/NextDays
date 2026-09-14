"""Bereiche der Buchhaltung (Ausbau 12.09.2026).

Jeder Bereich ist ein Unterpaket mit eigenem ``router`` — die Liste hier ist
die EINZIGE Stelle, an der sie eingehängt werden. ``../router.py`` bindet
``BEREICHS_ROUTER`` ein; die Bereiche selbst fassen ``router.py`` nicht an.
Warum so: dreizehn Bereiche entstehen gleichzeitig, und ein gemeinsamer
Import-Block in einer Datei wäre dreizehnmal derselbe Konflikt.
"""
from .artikel.router import router as artikel_router
from .ausgaben.router import router as ausgaben_router
from .belege.router import router as belege_router
from .berichte.router import router as berichte_router
from .datev.router import router as datev_router
from .erechnung.router import router as erechnung_router
from .gobd.router import router as gobd_router
from .kontakte.router import router as kontakte_router
from .kontenplan.router import router as kontenplan_router
from .mahnwesen.router import router as mahnwesen_router
from .steuer.router import router as steuer_router
from .versand.router import router as versand_router
from .zahlungen.router import router as zahlungen_router

BEREICHS_ROUTER = (
    artikel_router,
    ausgaben_router,
    belege_router,
    berichte_router,
    datev_router,
    erechnung_router,
    gobd_router,
    kontakte_router,
    kontenplan_router,
    mahnwesen_router,
    steuer_router,
    versand_router,
    zahlungen_router,
)
