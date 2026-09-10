"""Die Startseite der Teststufe — hochladen, prüfen, Quittung lesen.

WOZU EINE OBERFLAECHE
=====================
Die Behoerde hat eine: TastSelv Erhverv ist eine Webseite, auf der man
eine Datei auswaehlt und eine Quittung zurueckbekommt. Eine Teststufe,
die nur per `curl` bedienbar ist, uebt den Weg nicht, den ein Betrieb
spaeter geht — und niemand ausser einem Entwickler kann sie benutzen.

Bewusst EINE Datei ohne Vorlagen-System, ohne Javascript-Rahmenwerk und
ohne externe Schriften: Dieser Dienst soll klein bleiben. Er nimmt
Steuerdaten entgegen, jede zusaetzliche Abhaengigkeit ist Angriffsflaeche.
Das Formular ist reines HTML, das Ergebnis kommt serverseitig gerendert
zurueck.

WAS HIER NIE HINEINGEHOERT
==========================
Kein Feldwert einer eingereichten Datei ausser dem, was der Pruefbericht
ohnehin nennt (Spalte, Regel, beanstandeter Wert). Keine Namen, keine
CPR-Nummern, keine Betraege. Wer die Datei sehen will, oeffnet seine
eigene.
"""
from __future__ import annotations

import html

from .core.pruefung_csv import Quittung

_KOPF = """<!doctype html>
<html lang="da">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>DAC7 Teststufe</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { margin:0; padding:2rem 1rem; font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;
         background:#f6f7f9; color:#1a1d21; }
  @media (prefers-color-scheme: dark) { body { background:#14161a; color:#e6e8ea; } }
  .rahmen { max-width:52rem; margin:0 auto; }
  .karte { background:#fff; border:1px solid #dfe3e8; border-radius:.75rem;
           padding:1.5rem; margin-bottom:1.25rem; }
  @media (prefers-color-scheme: dark) {
    .karte { background:#1d2126; border-color:#2e343c; } }
  h1 { margin:0 0 .25rem; font-size:1.5rem; }
  h2 { margin:0 0 .75rem; font-size:1.05rem; }
  .unterzeile { margin:0 0 1.75rem; opacity:.72; }
  .hinweisfeld { border-left:3px solid #c9a227; padding:.75rem 1rem;
                 margin-bottom:1.5rem; background:#fdf8e7;
                 border-radius:0 .4rem .4rem 0; font-size:.9rem; }
  @media (prefers-color-scheme: dark) { .hinweisfeld { background:#2a2410; } }
  label { display:block; font-weight:600; margin-bottom:.4rem; }
  input[type=file] { width:100%; padding:.6rem; border:1px dashed #b9c0c8;
                     border-radius:.5rem; background:transparent;
                     color:inherit; }
  select, button { font:inherit; padding:.55rem .9rem; border-radius:.5rem;
                   border:1px solid #b9c0c8; background:transparent; color:inherit; }
  button { background:#1a1d21; color:#fff; border-color:#1a1d21; cursor:pointer; font-weight:600; }
  @media (prefers-color-scheme: dark) {
    button { background:#e6e8ea; color:#14161a; border-color:#e6e8ea; } }
  .reihe { display:flex; gap:1rem; flex-wrap:wrap; align-items:flex-end; margin-top:1rem; }
  .reihe > div { flex:1 1 14rem; }
  table { width:100%; border-collapse:collapse; font-size:.88rem; }
  th, td { text-align:left; padding:.45rem .6rem; vertical-align:top;
           border-bottom:1px solid #e6e9ed; }
  @media (prefers-color-scheme: dark) { th,td { border-color:#2e343c; } }
  th { font-weight:600; opacity:.72; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.86em; }
  .ok { color:#1a7f45; font-weight:600; }
  .fehler { color:#b3261e; font-weight:600; }
  @media (prefers-color-scheme: dark) { .ok{color:#5fd08a} .fehler{color:#f2836b} }
  .zahlen { display:flex; gap:1.5rem; flex-wrap:wrap; margin:.5rem 0 1rem; }
  .zahlen div { font-size:.85rem; opacity:.8; }
  .zahlen b { display:block; font-size:1.25rem; opacity:1; }
  .fuss { font-size:.82rem; opacity:.65; margin-top:2rem; }
  .fuss a { color:inherit; }
</style>
<div class="rahmen">
<h1>DAC7 Teststufe</h1>
<p class="unterzeile">Simulierte Empfangsstelle — prüft eine Meldung gegen die
amtliche Vorlage, bevor sie zur Behörde geht.</p>
<div class="hinweisfeld">
  <strong>Keine Behörde.</strong> Diese Stelle gehört myNextDays, nicht der
  Skattestyrelsen. Eine Annahme hier ist keine Zusage der Behörde — die
  Meldung muss weiterhin über TastSelv Erhverv eingereicht werden.
  <br>Eingereichte Dateien werden <strong>nicht gespeichert</strong>:
  abgelegt werden nur Prüfsumme, Kennzahlen und Befunde, und auch die nur
  befristet.
</div>
"""

_FORMULAR = """
<form class="karte" method="post" action="/einreichen" enctype="multipart/form-data">
  <h2>Meldung einreichen</h2>
  <label for="datei">Meldedatei (CSV oder XML)</label>
  <input id="datei" type="file" name="datei" accept=".csv,.xml,text/csv,application/xml" required>
  <div class="reihe">
    <div>
      <label for="verhalten">Verhalten der Empfangsstelle</label>
      <select id="verhalten" name="verhalten">
        <option value="normal">regulär prüfen</option>
        <option value="ablehnen">ablehnen (unabhängig vom Inhalt)</option>
        <option value="wartung">nicht erreichbar (503)</option>
        <option value="doppelt">bereits eingereicht</option>
      </select>
    </div>
    <div style="flex:0 0 auto"><button type="submit">Einreichen</button></div>
  </div>
  <p style="font-size:.85rem;opacity:.7;margin:.9rem 0 0">
    Der Gutfall lässt sich einmal im Jahr auch gegen die echte Behörde prüfen —
    der Fehlerpfad nie. Dafür ist die Auswahl da.
  </p>
</form>
"""

_FUSS = """
<p class="fuss">
  <a href="/docs">API-Referenz</a> ·
  <a href="/v1/quittungen">Empfangsprotokoll (JSON)</a> ·
  <a href="/health">Status</a>
</p>
</div>
"""


def startseite() -> str:
    return _KOPF + _FORMULAR + _FUSS


def _eine_zeile(b) -> str:  # noqa: ANN001 — Befund aus zwei Modulen
    """Ein Befund als Tabellenzeile. Alles escaped: Der beanstandete WERT
    stammt aus einer fremden Datei und ist angreiferkontrolliert."""
    return (
        f"<tr><td><code>{b.zeile}</code></td>"
        f"<td><code>{html.escape(b.spalte or '—')}</code></td>"
        f"<td>{html.escape(b.regel)}</td>"
        f"<td>{html.escape(b.grund)}</td>"
        f"<td><code>{html.escape(b.wert[:40]) if b.wert else ''}</code></td></tr>"
    )


def _befundtabelle(titel: str, befunde: list, klasse: str) -> str:
    if not befunde:
        return ""
    zeilen = "".join(_eine_zeile(b) for b in befunde)
    return (
        f'<div class="karte"><h2 class="{klasse}">{html.escape(titel)}'
        f" ({len(befunde)})</h2><table><tr><th>Zeile</th><th>Spalte</th>"
        f"<th>Regel</th><th>Grund</th><th>Wert</th></tr>{zeilen}</table></div>"
    )


def ergebnisseite(quittung: Quittung, nummer: str, pruefsumme: str, name: str) -> str:
    """Die Quittung als Seite — dieselben Angaben wie in der JSON-Antwort."""
    status = (
        '<span class="ok">angenommen</span>'
        if quittung.angenommen
        else '<span class="fehler">abgewiesen</span>'
    )
    typen = ", ".join(f"{k}: {v}" for k, v in sorted(quittung.zeilentypen.items()))
    kopf = f"""
<div class="karte">
  <h2>Quittung {html.escape(nummer)}</h2>
  <div class="zahlen">
    <div><b>{status}</b>Ergebnis</div>
    <div><b>{quittung.zeilen}</b>Zeilen</div>
    <div><b>{len(quittung.fehler)}</b>Fehler</div>
    <div><b>{len(quittung.hinweise)}</b>Hinweise</div>
  </div>
  <table>
    <tr><th>Datei</th><td>{html.escape(name)}</td></tr>
    <tr><th>Prüfsumme</th><td><code>{html.escape(pruefsumme)}</code></td></tr>
    <tr><th>Zeilentypen</th><td>{html.escape(typen) or "—"}</td></tr>
  </table>
</div>
"""
    return (
        _KOPF
        + kopf
        + _befundtabelle("Fehler — so nimmt die Behörde die Datei nicht an",
                         quittung.fehler, "fehler")
        + _befundtabelle("Hinweise — verhindern die Annahme nicht",
                         quittung.hinweise, "ok")
        + _FORMULAR
        + _FUSS
    )
