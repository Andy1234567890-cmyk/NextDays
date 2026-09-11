"""Die Oberfläche der Empfangsstelle — der Posteingang des Amtes.

DIE PERSPEKTIVE IST DIE DER BEHÖRDE, NICHT DIE DES ABSENDERS.
Das Amt reicht nichts ein. Es sieht, WAS ANGEKOMMEN IST: welche Meldung
wann von wem, angenommen oder abgewiesen, und mit welchen Befunden.

Hier stand zuerst ein Hochladeformular. Das war die Sicht des Betriebs —
genau verkehrt herum: Bei TastSelv Erhverv lädt der Betrieb in SEINER
Ansicht hoch, die Behörde sieht in IHRER den Eingang. Wer beides in eine
Seite legt, verwischt, wer hier wem gegenübersteht.

Das Hochladen bleibt möglich, aber als das, was es ist: ein Werkzeug zum
Prüfen der Gegenstelle, nachgeordnet und als solches benannt.

Bewusst EINE Datei ohne Vorlagen-System, ohne Javascript-Rahmenwerk und
ohne externe Schriften: Dieser Dienst nimmt Steuerdaten entgegen, jede
zusätzliche Abhängigkeit ist Angriffsfläche.

WAS HIER NIE HINEINGEHÖRT
=========================
Kein Feldwert einer eingereichten Datei außer dem, was der Prüfbericht
ohnehin nennt (Spalte, Regel, beanstandeter Wert). Keine Namen, keine
CPR-Nummern, keine Beträge.
"""
from __future__ import annotations

import html

from .core import vorlage

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
  /* Die Satztabelle traegt so viele Spalten wie die CSV belegt — sie
     rollt waagerecht, statt die Seite zu sprengen. */
  .breit { overflow-x:auto; margin:0 -.25rem; }
  table.csv { font-size:.8rem; white-space:nowrap; width:auto; min-width:100%; }
  table.csv th { font-weight:600; opacity:.8; position:sticky; top:0;
                 background:#fff; }
  @media (prefers-color-scheme: dark) { table.csv th { background:#1d2126; } }
  table.csv td, table.csv th { padding:.35rem .55rem; }
  table.csv tr:nth-child(even) td { background:#fafbfc; }
  @media (prefers-color-scheme: dark) {
    table.csv tr:nth-child(even) td { background:#191d22; } }
  td.zeilennr { opacity:.5; font-variant-numeric:tabular-nums; }
  pre.roh { overflow-x:auto; margin:0; padding:.9rem; border-radius:.5rem;
            background:#f0f2f5; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
            font-size:.78rem; line-height:1.5; white-space:pre; }
  @media (prefers-color-scheme: dark) { pre.roh { background:#12151a; } }
  .fuss { font-size:.82rem; opacity:.65; margin-top:2rem; }
  .fuss a { color:inherit; }
</style>
<div class="rahmen">
<h1>DAC7 Teststufe</h1>
<p class="unterzeile">Simulierte Empfangsstelle der Steuerbehörde —
Posteingang der DAC7-Meldungen.</p>
<div class="hinweisfeld">
  <strong>Keine Behörde.</strong> Diese Stelle gehört myNextDays, nicht der
  Skattestyrelsen. Eine Annahme hier ist keine Zusage der Behörde — die
  Meldung muss weiterhin über TastSelv Erhverv eingereicht werden.
  <br>Eingereichte Dateien liegen <strong>nur im Arbeitsspeicher</strong>
  und nur befristet: Ein Neustart löscht sie, ebenso „Protokoll leeren".
  Nichts wird auf Platte geschrieben.
</div>
"""

_FUSS = """
<p class="fuss">
  <a href="/docs">API-Referenz</a> ·
  <a href="/v1/quittungen">Empfangsprotokoll (JSON)</a> ·
  <a href="/health">Status</a>
</p>
</div>
"""


_LEERER_EINGANG = """
<div class="karte">
  <h2>Posteingang</h2>
  <p style="opacity:.75;margin:0">Es liegt keine Meldung vor. Eingegangene
  Meldungen erscheinen hier, sobald ein Betrieb eine einreicht.</p>
</div>
"""


def _eingangszeile(e) -> str:  # noqa: ANN001 — Eintrag, Import waere zirkulaer
    """Eine eingegangene Meldung als Zeile des Posteingangs.

    Gezeigt wird NUR, was die Behoerde protokolliert: wann, welches Format,
    angenommen oder nicht, wie viele Zeilen, welche Pruefsumme. Kein Name,
    keine Nummer, kein Betrag aus der Datei — die stehen hier nie
    (siehe Kopf dieser Datei).
    """
    stand = (
        '<span class="ok">angenommen</span>'
        if e.angenommen
        else '<span class="fehler">abgewiesen</span>'
    )
    befunde = len(e.fehler)
    spalte_befunde = f'<span class="fehler">{befunde}</span>' if befunde else "—"
    nummer = html.escape(e.quittungsnummer)
    return (
        f'<tr><td><a href="/meldung/{nummer}"><code>{nummer}</code></a></td>'

        f"<td>{e.empfangen_am:%d-%m-%Y %H:%M} UTC</td>"
        f"<td>{stand}</td>"
        f"<td>{html.escape(e.format.upper())}</td>"
        f"<td>{e.zeilen}</td>"
        f"<td>{spalte_befunde}</td>"
        f"<td><code>{html.escape(e.pruefsumme[:12])}…</code></td></tr>"
    )


def _posteingang(eintraege: list) -> str:
    """Was bei der Stelle angekommen ist — der eigentliche Inhalt der Seite.

    Das Amt reicht nichts ein, es empfaengt. Deshalb steht diese Tabelle
    oben und das Pruefwerkzeug darunter.
    """
    if not eintraege:
        return _LEERER_EINGANG
    angenommen = sum(1 for e in eintraege if e.angenommen)
    zeilen = "".join(_eingangszeile(e) for e in eintraege)
    return f"""
<div class="karte">
  <h2>Posteingang</h2>
  <div class="zahlen">
    <div><b>{len(eintraege)}</b>Meldungen</div>
    <div><b>{angenommen}</b>angenommen</div>
    <div><b>{len(eintraege) - angenommen}</b>abgewiesen</div>
  </div>
  <table>
    <tr><th>Quittung</th><th>Empfangen</th><th>Ergebnis</th><th>Format</th>
        <th>Zeilen</th><th>Fehler</th><th>Prüfsumme</th></tr>
    {zeilen}
  </table>
</div>
"""


def startseite(eintraege: list | None = None) -> str:
    """Die Startseite: erst der Posteingang, dann das Pruefwerkzeug."""
    return _KOPF + _posteingang(eintraege or []) + _FUSS


def _satztabelle(saetze: list[dict]) -> str:
    """Die uebermittelten Saetze als Tabelle — aufgebaut wie die CSV.

    EINE ZEILE JE SATZ, so wie die Datei sie fuehrt: Ein Betrieb mit 100
    Objekten hat 100 ACT_Immovable_Property-Zeilen, und die gehoeren
    untereinander in EINE Tabelle, nicht in 100 Bloecke. Nur so laesst
    sich eine Spalte ueber alle Objekte vergleichen — genau das tut, wer
    eine Meldung prueft.

    Gezeigt werden die Spalten, die in DIESEM Satztyp belegt sind: Die
    Vorlage hat 89, und ein Satz fuellt davon ein Dutzend. Alle 89 zu
    zeigen hiesse, die belegten in leeren Spalten zu verstecken. Die
    Reihenfolge ist die der Vorlage, nicht die des Auftretens.

    Jeder Wert ist escaped — er stammt aus einer fremden Datei.
    """
    if not saetze:
        return ""
    belegt = {s for satz in saetze for s in satz if s not in ("__nr", "ROW_TYPE")}
    # Reihenfolge der Vorlage beibehalten: Wer die CSV daneben legt, findet
    # die Spalte an derselben Stelle.
    spalten = [s for s in vorlage.SPALTEN if s in belegt]
    ausgelassen = len(vorlage.SPALTEN) - len(spalten) - 1

    kopf = "".join(f"<th><code>{html.escape(s)}</code></th>" for s in spalten)
    zeilen = "".join(
        "<tr>"
        + f'<td class="zeilennr">{html.escape(satz.get("__nr", "?"))}</td>'
        + "".join(
            f"<td>{html.escape(satz.get(s, ''))}</td>" for s in spalten
        )
        + "</tr>"
        for satz in saetze
    )
    typ = saetze[0].get("ROW_TYPE", "—")
    return f"""
<div class="karte">
  <h2>{html.escape(typ)}
    <span style="opacity:.55;font-weight:400">{len(saetze)} Zeilen</span></h2>
  <div class="breit">
    <table class="csv">
      <tr><th>#</th>{kopf}</tr>
      {zeilen}
    </table>
  </div>
  <p style="margin:.7rem 0 0;font-size:.82rem;opacity:.65">
    {ausgelassen} weitere Spalten der Vorlage sind in diesen Sätzen leer.
  </p>
</div>
"""


def _saetze_nach_typ(saetze: list[dict]) -> str:
    """Je Satztyp eine Tabelle, in der Reihenfolge des Auftretens.

    Getrennt wird nach Typ, weil die Vorlage je Typ ANDERE Spalten fuellt:
    Ein Verkaeufersatz traegt Namen und Steuernummer, ein Objektsatz
    Quartalswerte und Matrikel. In einer gemeinsamen Tabelle stuenden
    ueberall Luecken.
    """
    reihenfolge: list[str] = []
    nach_typ: dict[str, list[dict]] = {}
    for satz in saetze:
        typ = satz.get("ROW_TYPE", "—")
        if typ not in nach_typ:
            nach_typ[typ] = []
            reihenfolge.append(typ)
        nach_typ[typ].append(satz)
    return "".join(_satztabelle(nach_typ[t]) for t in reihenfolge)


def _rohansicht(eintrag) -> str:  # noqa: ANN001 — Eintrag, Import waere zirkulaer
    """Die eingereichte Datei im Original, Zeile fuer Zeile.

    Die Feldansicht darueber ist aufbereitet; hier steht, was wirklich
    ankam — jedes Semikolon, jedes leere Feld. Wer eine Abweichung sucht,
    braucht genau das und keine Darstellung davon.
    """
    if not eintrag.rohtext:
        return ""
    zeilen = eintrag.rohtext.replace("\r\n", "\n").split("\n")
    nummeriert = "\n".join(
        f"{nr:>3}  {html.escape(z)}"
        for nr, z in enumerate(zeilen, start=1)
        if z.strip()
    )
    art = "XML" if eintrag.format == "xml" else "CSV"
    return f"""
<div class="karte">
  <h2>Datei im Original ({art})</h2>
  <p style="margin:-.35rem 0 .9rem;font-size:.88rem;opacity:.75">
    Was wirklich ankam — unveraendert.
    <a href="/meldung/{html.escape(eintrag.quittungsnummer)}/datei">herunterladen</a>
  </p>
  <pre class="roh">{nummeriert}</pre>
</div>
"""


def meldungsseite(eintrag) -> str:  # noqa: ANN001 — Eintrag, Import waere zirkulaer
    """Eine einzelne Meldung: was uebermittelt wurde, Satz fuer Satz."""
    stand = (
        '<span class="ok">angenommen</span>'
        if eintrag.angenommen
        else '<span class="fehler">abgewiesen</span>'
    )
    kopf = f"""
<p class="fuss" style="margin:0 0 1rem"><a href="/">← Posteingang</a></p>
<div class="karte">
  <h2>Meldung {html.escape(eintrag.quittungsnummer)}</h2>
  <div class="zahlen">
    <div><b>{stand}</b>Ergebnis</div>
    <div><b>{eintrag.zeilen}</b>Sätze</div>
    <div><b>{len(eintrag.fehler)}</b>Fehler</div>
  </div>
  <table>
    <tr><th>Empfangen</th><td>{eintrag.empfangen_am:%d-%m-%Y %H:%M} UTC</td></tr>
    <tr><th>Datei</th><td>{html.escape(eintrag.dateiname)}</td></tr>
    <tr><th>Prüfsumme</th><td><code>{html.escape(eintrag.pruefsumme)}</code></td></tr>
  </table>
</div>
"""
    saetze = _saetze_nach_typ(eintrag.saetze) or (
        '<div class="karte"><p style="margin:0;opacity:.75">Keine lesbaren '
        "Sätze — die Datei war nicht auswertbar.</p></div>"
    )
    return (
        _KOPF
        + kopf
        + _befundtabelle(
            "Fehler — so nimmt die Behörde die Datei nicht an",
            eintrag.fehler,
            "fehler",
        )
        + _befundtabelle(
            "Hinweise — verhindern die Annahme nicht", eintrag.hinweise, "ok"
        )
        + '<h2 style="margin:2rem 0 1rem">Übermittelte Daten</h2>'
        + saetze
        + _rohansicht(eintrag)
        + _FUSS
    )


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
