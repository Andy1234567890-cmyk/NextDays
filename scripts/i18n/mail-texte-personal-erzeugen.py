# -*- coding: utf-8 -*-
"""Erzeugt `apps/api/src/core/mail_texte_personal.py` — Weiterleitung.

Der Erzeuger ist seit dem zweiten Fachgebiet (Angebote, 0586) generisch:
`mail-texte-erzeugen.py <gebiet> <uebersetzung.json>`. Diese Datei bleibt, weil
der Aufruf in der Doku und im Gedächtnis steht — sie ruft nur durch, damit es
nicht zwei Erzeuger gibt, die auseinanderlaufen.

Aufruf (unverändert, aus apps/api):

    uv run python ../../scripts/i18n/mail-texte-personal-erzeugen.py /tmp/personal-mail.json
"""
from __future__ import annotations

import runpy
import sys
from pathlib import Path

GENERISCH = Path(__file__).resolve().parent / "mail-texte-erzeugen.py"

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(
            "Aufruf: mail-texte-personal-erzeugen.py <uebersetzung.json>",
            file=sys.stderr,
        )
        sys.exit(2)
    sys.argv = [str(GENERISCH), "personal", sys.argv[1]]
    runpy.run_path(str(GENERISCH), run_name="__main__")
