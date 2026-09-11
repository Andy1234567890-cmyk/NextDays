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

_STIL = """<!doctype html>
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
  /* Die Meldungsseite traegt eine Tabelle mit bis zu 89 Spalten. In
     52rem gequetscht sieht man fuenf davon und rollt durch einen
     Briefschlitz — unbrauchbar fuer eine Pruefung. Sie bekommt deshalb
     die ganze Fensterbreite. */
  .rahmen.weit { max-width:none; }
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
  .breit { overflow-x:auto; overflow-y:auto; max-height:75vh; margin:0 -.25rem;
           /* Ein sichtbarer Rollbalken, nicht der ausgeblendete von macOS:
              Sonst sieht niemand, dass rechts noch 50 Spalten stehen. */
           scrollbar-width:auto; }
  .breit::-webkit-scrollbar { height:.85rem; width:.85rem; }
  .breit::-webkit-scrollbar-thumb { background:#9aa3ad; border-radius:.45rem; }
  .breit::-webkit-scrollbar-track { background:#e7eaee; border-radius:.45rem; }
  @media (prefers-color-scheme: dark) {
    .breit::-webkit-scrollbar-thumb { background:#4a525c; }
    .breit::-webkit-scrollbar-track { background:#20252b; } }
  table.csv { font-size:.8rem; white-space:nowrap; width:auto; min-width:100%; }
  table.csv th { font-weight:600; opacity:.8; position:sticky; top:0;
                 background:#fff; }
  @media (prefers-color-scheme: dark) { table.csv th { background:#1d2126; } }
  table.csv td, table.csv th { padding:.35rem .55rem; }
  /* Zeilennummer und ROW_TYPE bleiben beim waagerechten Rollen stehen —
     sonst weiss man in Spalte 60 nicht mehr, welche Zeile man liest. */
  table.csv td:first-child, table.csv th:first-child { position:sticky; left:0;
      background:#fff; z-index:2; }
  table.csv td:nth-child(2), table.csv th:nth-child(2) { position:sticky;
      left:2.5rem; background:#fff; z-index:2; font-weight:600; }
  @media (prefers-color-scheme: dark) {
    table.csv td:first-child, table.csv th:first-child,
    table.csv td:nth-child(2), table.csv th:nth-child(2) { background:#1d2126; } }
  table.csv td.zahl { text-align:right; font-variant-numeric:tabular-nums; }
  table.csv td:empty::after { content:"·"; opacity:.25; }
  table.csv tr:nth-child(even) td { background:#fafbfc; }
  @media (prefers-color-scheme: dark) {
    table.csv tr:nth-child(even) td { background:#191d22; } }
  td.zeilennr { opacity:.5; font-variant-numeric:tabular-nums; }
  pre.roh { overflow-x:auto; margin:0; padding:.9rem; border-radius:.5rem;
            background:#f0f2f5; font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
            font-size:.78rem; line-height:1.5; white-space:pre; }
  @media (prefers-color-scheme: dark) { pre.roh { background:#12151a; } }
  /* Meldungsseite: schmaler Kopf, darunter die Daten ueber die ganze
     Breite. Keine Karte — sie wuerde die Tabelle nur einschnueren. */
  .seitenkopf { margin-bottom:1.5rem; }
  .zurueck { font-size:.85rem; opacity:.7; color:inherit; }
  .seitenkopf h1 { margin:.5rem 0 .4rem; font-size:1.35rem;
                   font-family:ui-monospace,SFMono-Regular,Menlo,monospace; }
  .kopfzahlen { display:flex; gap:1.2rem; flex-wrap:wrap; align-items:baseline;
                font-size:.85rem; opacity:.8; }
  .kopfzahlen .pruefsumme { opacity:.55; font-size:.78rem; }
  .blockkopf { font-weight:600; font-size:1.05rem; margin:2rem 0 .75rem; }
  .blockkopf span { font-weight:400; opacity:.6; font-size:.85rem;
                    margin-left:.5rem; }
  .blockkopf a { color:inherit; }
  .fuss { font-size:.82rem; opacity:.65; margin-top:2rem; }
  .fuss a { color:inherit; }
</style>
"""

# Der Rumpf beginnt hier: Die Startseite fuehrt Titel und Hinweiskasten,
# die Meldungsseite nicht — dort steht die Tabelle im Mittelpunkt, und
# sie traegt ihren eigenen Kopf.
_KOPF = _STIL + """
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

# Die Meldungsseite: ganze Fensterbreite, kein Titel, kein Hinweiskasten.
# In einem 52rem-Rahmen sieht man von 89 Spalten fuenf.
_KOPF_WEIT = _STIL + '\n<div class="rahmen weit">\n'


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
        f'<div class="blockkopf {klasse}">{html.escape(titel)}'
        f" ({len(befunde)})</div>"
        f"<table class=\"befunde\"><tr><th>Zeile</th><th>Spalte</th>"
        f"<th>Regel</th><th>Grund</th><th>Wert</th></tr>{zeilen}</table>"
    )


def _satztabelle(saetze: list[dict]) -> str:
    """Alle Saetze in EINER Tabelle — genau so wie die CSV.

    Die Datei ist ein Raster: 89 Spalten, und jede Zeile fuellt die, die
    ihr Satztyp braucht. Genau das steht hier. Kein Block je Satztyp, denn
    die Datei kennt keine Bloecke — sie kennt Zeilen. Wer die Meldung
    prueft, liest sie wie die CSV im Editor, nur lesbar ausgerichtet.

    Leere Zellen bleiben leer. Sie sind Teil des Rasters: Dass ein
    Objektsatz keinen Namen traegt und ein Verkaeufersatz keine
    Quartalswerte, sieht man nur, wenn die Spalte da ist.

    Gezeigt werden die Spalten, die IRGENDEINE Zeile der Datei belegt, in
    der Reihenfolge der Vorlage. Die durchweg leeren wegzulassen ist keine
    Auswahl, sondern Platz: Von 89 Spalten fuellt eine echte Meldung rund
    die Haelfte, und die restlichen wuerden die belegten
    auseinanderziehen.

    Jeder Wert ist escaped — er stammt aus einer fremden Datei.
    """
    if not saetze:
        return ""
    belegt = {s for satz in saetze for s in satz if s != "__nr"}
    spalten = [s for s in vorlage.SPALTEN if s in belegt]
    leer = len(vorlage.SPALTEN) - len(spalten)

    kopf = "".join(f"<th><code>{html.escape(s)}</code></th>" for s in spalten)
    zeilen = "".join(
        '<tr>'
        + f'<td class="zeilennr">{html.escape(satz.get("__nr", "?"))}</td>'
        + "".join(
            f'<td class="{_zellklasse(s)}">{html.escape(satz.get(s, ""))}</td>'
            for s in spalten
        )
        + "</tr>"
        for satz in saetze
    )
    nachsatz = (
        f'<p style="margin:.7rem 0 0;font-size:.82rem;opacity:.65">'
        f"{leer} der 89 Spalten sind in der ganzen Datei leer und stehen "
        f"deshalb nicht in der Tabelle. Die Datei im Original steht "
        f"darunter.</p>"
        if leer
        else ""
    )
    return f"""
<div class="blockkopf">Übermittelte Daten
  <span>{len(saetze)} Zeilen · {len(spalten)} von 89 Spalten belegt</span></div>
<div class="breit">
  <table class="csv">
    <tr><th>#</th>{kopf}</tr>
    {zeilen}
  </table>
</div>
{nachsatz}
"""


def _zellklasse(spalte: str) -> str:
    """Zahlen rechtsbuendig, damit sich Betraege einer Spalte vergleichen lassen."""
    return "zahl" if spalte.startswith("RS_ACT_") and not spalte.endswith("_CCY") else ""


def _rohansicht(eintrag) -> str:  # noqa: ANN001 — Eintrag, Import waere zirkulaer
    """Die eingereichte Datei im Original, Zeile fuer Zeile.

    Die Tabelle darueber ist ausgerichtet; hier steht, was wirklich ankam
    — jedes Semikolon, jedes leere Feld. Wer eine Abweichung sucht,
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
    nummer = html.escape(eintrag.quittungsnummer)
    return f"""
<div class="blockkopf">Datei im Original ({art})
  <span>unverändert, wie sie ankam ·
    <a href="/meldung/{nummer}/datei">herunterladen</a></span></div>
<pre class="roh">{nummeriert}</pre>
"""


def meldungsseite(eintrag) -> str:  # noqa: ANN001 — Eintrag, Import waere zirkulaer
    """Eine einzelne Meldung: die Datei als Raster, darunter im Original.

    Ohne Karten und ohne Breitenbegrenzung: Die Tabelle hat bis zu 89
    Spalten, und in einer 52rem breiten Karte sieht man fuenf davon. Wer
    eine Meldung prueft, braucht sie so breit wie das Fenster.
    """
    stand = (
        '<span class="ok">angenommen</span>'
        if eintrag.angenommen
        else '<span class="fehler">abgewiesen</span>'
    )
    kopf = f"""
<div class="seitenkopf">
  <a href="/" class="zurueck">← Posteingang</a>
  <h1>{html.escape(eintrag.quittungsnummer)}</h1>
  <div class="kopfzahlen">
    {stand}
    <span>{eintrag.zeilen} Sätze</span>
    <span>{len(eintrag.fehler)} Fehler</span>
    <span>{eintrag.empfangen_am:%d-%m-%Y %H:%M} UTC</span>
    <span>{html.escape(eintrag.dateiname)}</span>
    <span class="pruefsumme"><code>{html.escape(eintrag.pruefsumme)}</code></span>
  </div>
</div>
"""
    tabelle = _satztabelle(eintrag.saetze) or (
        '<p style="opacity:.75">Keine lesbaren Sätze — die Datei war nicht '
        "auswertbar.</p>"
    )
    return (
        _KOPF_WEIT
        + kopf
        + _befundtabelle(
            "Fehler — so nimmt die Behörde die Datei nicht an",
            eintrag.fehler,
            "fehler",
        )
        + _befundtabelle(
            "Hinweise — verhindern die Annahme nicht", eintrag.hinweise, "ok"
        )
        + tabelle
        + _rohansicht(eintrag)
        + _FUSS
    )
