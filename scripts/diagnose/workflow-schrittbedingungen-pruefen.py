"""Findet Schritt-Bedingungen in GitHub-Workflows, die NIE wahr werden koennen.

WARUM ES DAS BRAUCHT (16.09.2026): Der Job `mobile-android-release` in ci.yml
traegt am ersten Schritt — dem, der die Betroffenheit ERMITTELT — die
Bedingung `if: steps.pruefen.outputs.laufen == 'true'`, also seine EIGENE
Ausgabe. Die ist beim Auswerten leer. Der Schritt wurde jedes Mal
uebersprungen, `laufen` damit nie gesetzt, und weil jeder folgende Schritt
daran haengt, lief der ganze Job leer durch — und meldete `success`.

Das ist die teuerste Sorte Fehler in einer CI: kein rotes Kreuz, keine
Warnung, nur ein Gate, das nicht mehr prueft. Der Android-Release-Build hat
auf diesem Weg vom 09.09. bis zum 16.09.2026 fuer BEIDE Apps kein einziges
Mal gebaut (Lauf 34995333441: alle zwoelf Schritte `skipped`, Job gruen).
Gefunden wurde es beim Nachsehen, nicht von einem Gate — also gibt es jetzt
eines.

GEPRUEFT WERDEN ZWEI FORMEN, beide immer-falsch und beide still:
  1. Selbstbezug: ein Schritt bedingt sich auf `steps.<eigene id>.outputs…`.
  2. Vorwaertsbezug: ein Schritt bedingt sich auf einen Schritt, der im selben
     Job ERST SPAETER kommt (oder gar nicht existiert). GitHub kennt dessen
     Ausgaben zu diesem Zeitpunkt nicht; das Ergebnis ist ebenfalls leer.

NICHT geprueft wird, ob eine Bedingung inhaltlich sinnvoll ist — das ist
Sache des Menschen. Gemeldet wird nur, was strukturell gar nicht wahr werden
KANN.

Aufruf:
    python3 scripts/diagnose/workflow-schrittbedingungen-pruefen.py [pfad …]
"""

from __future__ import annotations

import pathlib
import re
import sys

# Kein PyYAML: der Runner bringt es nicht sicher mit, und ein Gate, das an
# einer fehlenden Abhaengigkeit scheitert, wird abgeschaltet statt repariert.
# Die Workflows dieses Repos sind einheitlich eingerueckt; der Parser verlaesst
# sich darauf und sagt es LAUT, wenn er nichts findet (siehe unten).
_JOB = re.compile(r"^  ([A-Za-z_][\w-]*):\s*$")
_STEPS = re.compile(r"^(\s*)steps:\s*$")
_SCHRITT_ANFANG = re.compile(r"^(\s*)-\s+(.*)$")
_ID = re.compile(r"^id:\s*(\S+)\s*$")
_IF = re.compile(r"^if:\s*(.*)$")
_NAME = re.compile(r"^name:\s*(.*)$")
_BEZUG = re.compile(r"steps\.([A-Za-z_][\w-]*)\.")


class Schritt:
    """Ein Schritt mit dem, was fuer diese Pruefung zaehlt."""

    def __init__(self, zeile: int) -> None:
        self.zeile = zeile
        self.name = ""
        self.id = ""
        self.bedingung = ""


def _schritte_je_job(pfad: pathlib.Path) -> dict[str, list[Schritt]]:
    """Zerlegt einen Workflow in Jobs und deren Schritte."""
    jobs: dict[str, list[Schritt]] = {}
    job = ""
    in_steps = False
    steps_einzug = -1
    schritt_einzug = -1
    aktuell: Schritt | None = None

    for nr, roh in enumerate(pfad.read_text(encoding="utf-8").splitlines(), 1):
        if not roh.strip() or roh.lstrip().startswith("#"):
            continue
        treffer_job = _JOB.match(roh)
        if treffer_job and not in_steps:
            job = treffer_job.group(1)
            jobs.setdefault(job, [])
            continue
        if _STEPS.match(roh) and job:
            in_steps = True
            steps_einzug = len(_STEPS.match(roh).group(1))
            schritt_einzug = -1
            aktuell = None
            continue
        if not in_steps:
            continue

        einzug = len(roh) - len(roh.lstrip())
        # Ein Schluessel auf Hoehe von `steps:` oder darueber beendet die Liste
        # (naechster Job-Schluessel, `env:`, das Ende der Datei …).
        if einzug <= steps_einzug and not roh.lstrip().startswith("-"):
            in_steps = False
            aktuell = None
            if (t := _JOB.match(roh)) is not None:
                job = t.group(1)
                jobs.setdefault(job, [])
            continue

        treffer_schritt = _SCHRITT_ANFANG.match(roh)
        if treffer_schritt and (
            schritt_einzug == -1 or len(treffer_schritt.group(1)) == schritt_einzug
        ):
            schritt_einzug = len(treffer_schritt.group(1))
            aktuell = Schritt(nr)
            jobs[job].append(aktuell)
            rest = treffer_schritt.group(2)
        elif aktuell is not None and einzug > schritt_einzug:
            rest = roh.strip()
        else:
            continue

        if aktuell is None:
            continue
        if (t := _NAME.match(rest)) is not None and not aktuell.name:
            aktuell.name = t.group(1).strip().strip("'\"")
        elif (t := _ID.match(rest)) is not None:
            aktuell.id = t.group(1).strip().strip("'\"")
        elif (t := _IF.match(rest)) is not None:
            aktuell.bedingung = t.group(1).strip()

    return jobs


def _pruefen(pfad: pathlib.Path) -> tuple[list[str], int]:
    """Gibt (Befunde, Zahl geprueftr Schritte) zurueck."""
    befunde: list[str] = []
    gezaehlt = 0
    for job, schritte in _schritte_je_job(pfad).items():
        for i, s in enumerate(schritte):
            gezaehlt += 1
            if not s.bedingung:
                continue
            frueher = {x.id for x in schritte[:i] if x.id}
            for bezug in _BEZUG.findall(s.bedingung):
                wie = s.name or f"Schritt {i + 1}"
                if bezug == s.id:
                    befunde.append(
                        f"{pfad}:{s.zeile}  {job} · {wie!r} bedingt sich auf die "
                        f"EIGENE Ausgabe (steps.{bezug}) — wird nie ausgefuehrt."
                    )
                elif bezug not in frueher:
                    spaeter = any(x.id == bezug for x in schritte[i + 1 :])
                    grund = (
                        "steht erst SPAETER im Job"
                        if spaeter
                        else "gibt es in diesem Job nicht"
                    )
                    befunde.append(
                        f"{pfad}:{s.zeile}  {job} · {wie!r} bedingt sich auf "
                        f"steps.{bezug} — der {grund}, die Ausgabe ist hier leer."
                    )
    return befunde, gezaehlt


def main(argv: list[str]) -> int:
    pfade = [pathlib.Path(a) for a in argv[1:]] or sorted(
        pathlib.Path(".github/workflows").glob("*.yml")
    )
    alle: list[str] = []
    gesamt = 0
    for p in pfade:
        befunde, gezaehlt = _pruefen(p)
        alle += befunde
        gesamt += gezaehlt

    # Fail-closed gegen die eigene Blindheit: findet der Parser keine Schritte,
    # hat sich die Schreibweise geaendert und diese Pruefung waere ab sofort
    # eine Attrappe — genau der Fehler, den sie sucht.
    if gesamt == 0:
        print(
            "FEHLER: kein einziger Schritt erkannt. Entweder gibt es keine "
            "Workflows, oder ihre Einrueckung passt nicht mehr zum Parser.",
            file=sys.stderr,
        )
        return 1

    if alle:
        for z in alle:
            print(z, file=sys.stderr)
        print(
            f"\n{len(alle)} Bedingung(en), die nie wahr werden. Ein Schritt, der "
            "seine eigene Ausgabe abfragt, wird uebersprungen — und der Job "
            "meldet trotzdem Erfolg.",
            file=sys.stderr,
        )
        return 1

    print(f"OK — {gesamt} Workflow-Schritte, keine unerfuellbare Bedingung.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
