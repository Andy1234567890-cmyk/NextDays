"""Partnerprogramm (Affiliate): Partner werben Betriebe, erhalten zwölf Monate
lang einen gestaffelten Anteil am Abo-Umsatz. Plan: docs/AFFILIATE-PROGRAMM-PLAN.md.

Aufbau des Slices:
  * `service.py`      — Bewerbung, Login, Profil, Steuerdaten, Dashboard
  * `attribution.py`  — Klick → Registrierung → Zuordnung (mit Betrugsregeln)
  * `provision.py`    — Stripe `invoice.paid` → Ertragszeile; Erstattung → Gegenzeile
  * `stufen.py`       — Monatslauf: Rang nach zahlenden Kunden
  * `auszahlung.py`   — Auszahlungslauf je Währung + Gutschrift (Self-Billing)
  * `vies.py`         — USt-IdNr. gegen VIES prüfen
  * `mails.py`        — alle Mails an Partner (24 Sprachen über core.mail_texte)
  * `router.py`       — öffentliche + Partner-Routen (/api/v1/affiliates)
  * `router_backoffice.py` — Backoffice (/api/v1/platform/affiliates)
"""
