"""Hintergrund-Jobs (CLI-Entrypoints).

Schwere periodische Arbeit (Channex-Reconcile, ARI-Import) läuft NICHT mehr im
Live-API-Prozess, sondern als eigener kurzlebiger Prozess (`python -m
src.jobs.<job>`). So sättigt ein langer externer OTA-Call nie den uvicorn-Worker
und blockiert den Live-Traffic nicht (sonst: 504 für externe Requests).
"""
