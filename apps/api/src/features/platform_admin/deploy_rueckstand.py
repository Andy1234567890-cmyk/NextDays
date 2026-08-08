"""Was liegt zwischen dem ausgerollten Stand und `main`? — je Anwendung.

Die Frage, die der Deploy-Monitor bisher nicht beantworten konnte: „welche App
muss ich deployen?" Der Monitor zeigte den ausgerollten Commit, aber nicht, ob
inzwischen etwas dazugekommen ist, das diese App überhaupt betrifft.

Zwei Quellen, beide führend für ihre Hälfte:

1. **GitHub** liefert die Commits zwischen ausgerolltem Stand und `main`
   (`/compare`), samt der Dateien, die jeder Commit anfasst.
2. **Coolify** liefert die `watch_paths` je Anwendung — dieselbe Regel, nach
   der Coolify auch selbst entscheiden würde, ob ein Push die App betrifft.

Bewusst NICHT aus `scripts/ci/coolify-apps.txt`: die Datei ist eine Kopie für
die CI. Ändert jemand die Pfade in Coolify, wäre die Anzeige hier still falsch —
und zwar in der gefährlichen Richtung („betrifft dich nicht", obwohl doch).
Coolify ist die ausführende Instanz, also ist Coolify die Wahrheit.

Ohne GitHub-Token wird NICHTS geraten: `commits_gesamt` bleibt None und die
Oberfläche sagt „nicht abrufbar" (Wurzel 4). Eine 0 hieße „alles ausgerollt" —
das ist eine Aussage, die wir ohne Abruf nicht treffen dürfen.
"""
from __future__ import annotations

from datetime import datetime

import httpx

from src.core.config import get_settings
from src.core.logging import get_logger

from .schemas import DeployRueckstand, OffenerCommit

log = get_logger(__name__)

_TIMEOUT = httpx.Timeout(20.0)

# Wurzel 8: harte Obergrenze. Mehr als 100 Commits Rückstand sind ohnehin keine
# Liste mehr, die jemand durchliest — die ZAHL bleibt trotzdem korrekt, weil
# GitHub sie im Feld `total_commits` unabhängig von der Seitengröße meldet.
MAX_COMMITS = 100

# Nur so viele Dateien je Commit ausweisen; die Zahl selbst bleibt vollständig.
MAX_DATEIEN = 20


def _kopf() -> dict[str, str] | None:
    """Auth-Kopf für GitHub, oder None wenn kein Token hinterlegt ist."""
    einst = get_settings()
    token = getattr(einst, "github_token", None)
    wert = token.get_secret_value().strip() if token is not None else ""
    if not wert:
        return None
    return {
        "Authorization": f"Bearer {wert}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


def _zeit(wert: object) -> datetime | None:
    if not isinstance(wert, str) or not wert.strip():
        return None
    try:
        return datetime.fromisoformat(wert.replace("Z", "+00:00"))
    except ValueError:
        return None


def watch_pfade(roh: object) -> tuple[str, ...]:
    """Coolifys `watch_paths` → Pfad-Präfixe zum Vergleichen.

    Coolify speichert sie zeilenweise mit Glob-Ende (`apps/api/**`). Für den
    Präfix-Vergleich fällt das `**` weg; `apps/api/` bleibt übrig.
    """
    if not isinstance(roh, str):
        return ()
    pfade: list[str] = []
    for zeile in roh.splitlines():
        p = zeile.strip()
        if not p:
            continue
        p = p.removesuffix("**").removesuffix("*")
        if p:
            pfade.append(p)
    return tuple(pfade)


def _betrifft(dateien: list[str], pfade: tuple[str, ...]) -> list[str]:
    """Die Teilmenge der Dateien, die unter einem der watch_paths liegt.

    Ohne watch_paths gilt NICHTS als betroffen — nicht alles. Eine App ohne
    Pfade würde Coolify auch selbst nie automatisch deployen; „betrifft alles"
    wäre hier der erfundene Wert, der zum unnötigen Deploy führt.
    """
    if not pfade:
        return []
    return [d for d in dateien if any(d.startswith(p) for p in pfade)]


def _repo_pfad() -> str:
    """`owner/repo` aus der Konfiguration."""
    einst = get_settings()
    return (getattr(einst, "github_repo", "") or "").strip().strip("/")


def main_sha() -> str | None:
    """Kopf-Commit von `main`. None, wenn nicht abrufbar."""
    kopf = _kopf()
    repo = _repo_pfad()
    if kopf is None or not repo:
        return None
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.get(
                f"https://api.github.com/repos/{repo}/commits/main", headers=kopf
            )
            antwort.raise_for_status()
            wert = antwort.json().get("sha")
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("github_main_sha_fehlgeschlagen", error=str(exc)[:200])
        return None
    return wert if isinstance(wert, str) else None


class _Vergleich:
    """Ein `compare`-Ergebnis von GitHub, für alle Apps wiederverwendbar.

    Der Abruf je Anwendung wäre die naheliegende Bauform und die falsche: bei
    zwölf Apps mit je zehn offenen Commits wären das über hundert Aufrufe pro
    Seitenaufbau, gegen ein Ratelimit von 5000/Stunde. Stattdessen holt
    `sammler` jeden Commit EINMAL — die Zuordnung zu den Apps ist danach reine
    Rechnerei auf den schon geladenen Dateilisten.
    """

    def __init__(
        self, gesamt: int, commits: list[tuple[OffenerCommit, list[str]]]
    ) -> None:
        self.gesamt = gesamt
        # (Commit ohne App-Bezug, ALLE seine Dateien)
        self.commits = commits


def _compare(repo: str, kopf: dict[str, str], basis: str, ziel: str) -> _Vergleich | None:
    """Commits zwischen zwei Ständen, inklusive der Dateien je Commit."""
    url = f"https://api.github.com/repos/{repo}/compare/{basis}...{ziel}"
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            antwort = client.get(url, headers=kopf, params={"per_page": MAX_COMMITS})
            if antwort.status_code == 404:
                return None
            antwort.raise_for_status()
            daten = antwort.json()

            gesamt = daten.get("total_commits")
            gesamt = gesamt if isinstance(gesamt, int) else 0
            eintraege: list[tuple[OffenerCommit, list[str]]] = []
            for eintrag in (daten.get("commits") or [])[:MAX_COMMITS]:
                if not isinstance(eintrag, dict):
                    continue
                sha = eintrag.get("sha")
                if not isinstance(sha, str):
                    continue
                commit = eintrag.get("commit") or {}
                autor_block = commit.get("author") or {}
                nachricht = commit.get("message") or ""
                eintraege.append((
                    OffenerCommit(
                        sha=sha,
                        kurz_sha=sha[:8],
                        # Nur die Betreffzeile: der Rumpf sprengt jede Zelle.
                        nachricht=nachricht.split("\n", 1)[0][:200],
                        autor=autor_block.get("name") or None,
                        zeitpunkt=_zeit(autor_block.get("date")),
                    ),
                    _dateien(client, repo, sha, kopf),
                ))
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("github_compare_fehlgeschlagen", repo=repo, error=str(exc)[:200])
        raise
    # Neueste zuerst — GitHub liefert chronologisch aufsteigend.
    eintraege.reverse()
    return _Vergleich(gesamt, eintraege)


def _dateien(
    client: httpx.Client, repo: str, sha: str, kopf: dict[str, str]
) -> list[str]:
    """Geänderte Dateipfade eines Commits. Leer, wenn nicht abrufbar."""
    try:
        antwort = client.get(
            f"https://api.github.com/repos/{repo}/commits/{sha}", headers=kopf
        )
        antwort.raise_for_status()
        daten = antwort.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning(
            "github_commit_dateien_fehlgeschlagen", sha=sha[:8], error=str(exc)[:200]
        )
        return []
    return [
        d["filename"]
        for d in (daten.get("files") or [])
        if isinstance(d, dict) and isinstance(d.get("filename"), str)
    ]


class Sammler:
    """Hält die GitHub-Abrufe eines Seitenaufbaus zusammen.

    Ein Sammler je Übersicht: derselbe ausgerollte Commit kommt bei mehreren
    Apps vor (api und worker stehen fast immer gleich) — der Vergleich wird
    dann nur einmal geholt.
    """

    def __init__(self) -> None:
        self._kopf = _kopf()
        self._repo = _repo_pfad()
        self._zwischenspeicher: dict[str, _Vergleich | None] = {}
        self._tot = False

    @property
    def einsatzbereit(self) -> bool:
        return self._kopf is not None and bool(self._repo)

    def _hindernis(self, ausgerollt: str | None) -> str | None:
        """Grund, warum kein Vergleich möglich ist — oder None."""
        if self._kopf is None:
            return "Kein GitHub-Zugang hinterlegt."
        if not self._repo:
            return "GITHUB_REPO ist nicht gesetzt."
        if not ausgerollt:
            return "Kein ausgerollter Commit bekannt."
        if self._tot:
            return "GitHub nicht erreichbar."
        return None

    def fuer(self, ausgerollt: str | None, watch_paths: object) -> DeployRueckstand:
        """Rückstand einer Anwendung — Commits, die IHRE Pfade berühren."""
        grund = self._hindernis(ausgerollt)
        # `_hindernis` hat beides bereits geprüft; die erneute Abfrage ist für
        # die Typprüfung da (kein `assert`: das fällt unter -O weg).
        if grund is not None or self._kopf is None or not ausgerollt:
            return DeployRueckstand(fehler=grund or "Kein Vergleich möglich.")

        if ausgerollt not in self._zwischenspeicher:
            try:
                self._zwischenspeicher[ausgerollt] = _compare(
                    self._repo, self._kopf, ausgerollt, "main"
                )
            except (httpx.HTTPError, ValueError):
                # Einmal unerreichbar heißt für diesen Seitenaufbau: gar nicht
                # mehr versuchen. Sonst wartet der Nutzer zwölfmal auf denselben
                # Timeout.
                self._tot = True
                return DeployRueckstand(fehler="GitHub nicht erreichbar.")

        vergleich = self._zwischenspeicher[ausgerollt]
        if vergleich is None:
            return DeployRueckstand(
                fehler="Ausgerollter Commit auf GitHub nicht gefunden."
            )

        pfade = watch_pfade(watch_paths)
        offene: list[OffenerCommit] = []
        for commit, dateien in vergleich.commits:
            eigene = _betrifft(dateien, pfade)
            if eigene:
                offene.append(commit.model_copy(update={
                    "dateien": eigene[:MAX_DATEIEN]
                }))
        return DeployRueckstand(
            commits_gesamt=vergleich.gesamt,
            commits_relevant=len(offene),
            betrifft_mich=bool(offene),
            # Nur die Commits, die diese App wirklich angehen. Der Rest ist für
            # DIESE Zeile Rauschen — er steht bei der App, die er betrifft.
            offene=offene,
        )
