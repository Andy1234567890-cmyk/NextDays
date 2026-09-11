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
  /* `table-layout:fixed` statt `auto`: Bei `auto` verteilt der Browser die
     Breiten nach Inhalt und laesst lange Werte ueber den Zellenrand
     hinauslaufen. Der ueberstehende Text wird dann UEBER die angeheftete
     Spalte gemalt — sichtbar war "000019DEMO01" quer ueber der
     Zeilennummer. Feste Breiten plus `clip` beenden das. */
  table.csv { font-size:.8rem; white-space:nowrap; table-layout:fixed;
              width:auto; min-width:100%; }
  table.csv td, table.csv th { overflow:clip; text-overflow:ellipsis;
                               min-width:9rem; max-width:16rem; }
  table.csv th { font-weight:600; opacity:.8; position:sticky; top:0;
                 background:#fff; }
  @media (prefers-color-scheme: dark) { table.csv th { background:#1d2126; } }
  table.csv td, table.csv th { padding:.35rem .55rem; }
  table.csv td.zahl { text-align:right; font-variant-numeric:tabular-nums; }
  table.csv td:empty::after { content:"·"; opacity:.25; }
  /* Zebra ZUERST: Die angehefteten Spalten weiter unten muessen sie
     ueberschreiben, sonst scheint beim Rollen der Text darunter durch.
     Genau das war der Fehler — die Regel stand hinter den sticky-Regeln
     und gewann bei gerader Zeilennummer. */
  /* JEDE Zelle deckend, nicht nur die angehefteten. Eine Zelle ohne
     eigenen Hintergrund ist durchsichtig — rollt sie unter die klebende
     Spalte, scheint ihr Text dort durch. Genau das war zu sehen: unter
     der Zeilennummer stand die weggerollte RS_DOC_REF_ID. */
  table.csv td, table.csv th { background:#fff; }
  table.csv tr:nth-child(even) td { background:#fafbfc; }
  @media (prefers-color-scheme: dark) {
    table.csv td, table.csv th { background:#1d2126; }
    table.csv tr:nth-child(even) td { background:#191d22; } }

  /* KEINE klebenden Spalten mehr.

     Sie sollten beim Rollen die Orientierung halten, haben aber genau das
     Gegenteil bewirkt: In Zeilen mit wenigen belegten Feldern schien der
     Text weggerollter Spalten durch die klebende Zelle hindurch — "_ID"
     ueber dem Spaltenkopf "#", "000019DEMO01" quer ueber der
     Zeilennummer. Drei Anlaeufe ueber Stapelreihenfolge, deckende
     Hintergruende und feste Tabellenbreiten haben es nicht behoben.

     Eine Darstellung, die Werte uebereinanderlegt, ist bei einer
     Steuermeldung schlimmer als eine, die beim Rollen die Zeilennummer
     verliert: Wer zwei Zahlen uebereinander sieht, liest eine falsche.
     Deshalb rollt die Tabelle jetzt als Ganzes — wie eine CSV im Editor.

     Die Orientierung uebernimmt stattdessen der ROW_TYPE, der in JEDER
     Zeile als eigene Spalte mitlaeuft, und die Zeilennummer, die der
     Nummer in der Datei entspricht. */
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
  .kacheln { display:grid; gap:.75rem; margin-bottom:.5rem;
             grid-template-columns:repeat(auto-fit,minmax(11rem,1fr)); }
  .kacheln > div { border:1px solid #dfe3e8; border-radius:.6rem;
                   padding:.8rem .9rem; font-size:.82rem; opacity:.85; }
  .kacheln b { display:block; font-size:1.5rem; opacity:1; font-weight:600;
               font-variant-numeric:tabular-nums; }
  .kacheln i { display:block; font-style:normal; opacity:.6; font-size:.76rem;
               margin-top:.2rem; }
  @media (prefers-color-scheme: dark) { .kacheln > div { border-color:#2e343c; } }
  .anmerkung { font-size:.8rem; opacity:.6; margin:.6rem 0 0; max-width:44rem; }
  table.schutz { max-width:52rem; }
  table.schutz th { width:9rem; white-space:nowrap; vertical-align:top; }
  table.schutz td { font-size:.86rem; opacity:.85; }
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


def _dauer(ms: float) -> str:
    """Millisekunden lesbar. Unter 1000 als ms, darueber als Sekunden."""
    return f"{ms:.0f} ms" if ms < 1000 else f"{ms / 1000:.1f} s"


def _uebermittlung(k) -> str:  # noqa: ANN001 — Kennzahlen, Import waere zirkulaer
    """Wie die Uebermittlung laeuft: Quote, Laufzeiten, Menge.

    Gerechnet aus den aufbewahrten Einreichungen, nicht aus einem eigenen
    Zaehler — was verfaellt, faellt auch aus der Statistik, sonst liesse
    sich die Zahl nicht nachpruefen.
    """
    if not k.gesamt:
        return ""
    return f"""
<div class="blockkopf">Übermittlung
  <span>über die aufbewahrten {k.gesamt} Einreichungen</span></div>
<div class="kacheln">
  <div><b>{k.annahmequote:.0f} %</b>angenommen
    <i>{k.angenommen} von {k.gesamt}</i></div>
  <div><b>{_dauer(k.dauer_mittel_ms)}</b>im Mittel
    <i>schnellste {_dauer(k.dauer_schnellste_ms)}</i></div>
  <div><b>{_dauer(k.dauer_p80_ms)}</b>langsamstes Fünftel
    <i>schlechteste {_dauer(k.dauer_langsamste_ms)}</i></div>
  <div><b>{k.bytes_gesamt / 1024:.0f} kB</b>empfangen
    <i>{k.bytes_gesamt // max(k.gesamt, 1) // 1024} kB je Meldung</i></div>
</div>
<p class="anmerkung">Gemessen vom Eintreffen der Bytes bis zur Quittung,
ohne Netzlaufzeit. Das langsamste Fünftel steht dabei, weil der
Mittelwert den einen langsamen Fall zwischen neunundneunzig schnellen
verschweigt.</p>
"""


def _schutz(einstellungen) -> str:  # noqa: ANN001 — Settings, Import waere zirkulaer
    """Womit die Schnittstelle geschuetzt ist — nachpruefbar, nicht behauptet.

    Jede Zeile nennt den Mechanismus und was er bewirkt. Es steht hier,
    weil eine Empfangsstelle fuer Steuerdaten sonst niemand beurteilen
    kann: Wer nicht sieht, wie sie schuetzt, muss es glauben.

    Bewusst OHNE Werte: keine Tokenlaenge, kein Auszug, keine Herkunft.
    Die Seite ist erreichbar, und wer angreift, soll nichts mitnehmen.
    """
    stunden = einstellungen.aufbewahrung_stunden
    grenze = einstellungen.max_datei_bytes // (1024 * 1024)
    cors = (
        f"{len(einstellungen.herkunft_liste())} erlaubte Herkunft(en)"
        if einstellungen.herkunft_liste()
        else "aus — kein Browser-Zugriff von fremden Seiten"
    )
    punkte = [
        ("Zugang", "Gemeinsames Geheimnis im Kopf <code>X-Staging-Token</code>, "
                   "byteweise verglichen (<code>secrets.compare_digest</code>) — "
                   "die Antwortzeit verrät nicht, wie viele Zeichen stimmten."),
        ("Fail-closed", "Fehlt das Geheimnis in der Umgebung, fährt der Dienst "
                        "nicht hoch. Kein Vorgabewert: Ein Standardpasswort wird "
                        "nie geändert."),
        ("Transport", "Nur über HTTPS erreichbar, davor Basic-Auth im Webserver. "
                      "Zwei Schranken, die unabhängig voneinander greifen."),
        ("Obergrenze", f"{grenze} MB je Einreichung. Eine echte Meldung liegt weit "
                       "darunter; alles darüber wird abgewiesen, statt Speicher "
                       "zu belegen."),
        ("XML", "Ohne DTD und ohne externe Entitäten. Ein Verweis auf eine "
                "lokale Datei oder eine fremde Adresse wird abgewiesen, nicht "
                "aufgelöst."),
        ("Einmaligkeit", "Dieselbe Datei wird kein zweites Mal angenommen — "
                         "eine Einnahme darf nicht doppelt gemeldet werden."),
        ("Aufbewahrung", f"{stunden} Stunden, nur im Arbeitsspeicher. Neustart "
                         "und „Protokoll leeren“ löschen alles; nichts geht auf "
                         "Platte, nichts in ein Log."),
        ("CORS", cors),
    ]
    zeilen = "".join(
        f"<tr><th>{n}</th><td>{t}</td></tr>" for n, t in punkte
    )
    return f"""
<div class="blockkopf">Schutz der Schnittstelle
  <span>was greift, und wogegen</span></div>
<table class="schutz">{zeilen}</table>
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


def startseite(eintraege: list | None = None, k=None, einstellungen=None) -> str:  # noqa: ANN001
    """Die Startseite: Posteingang, Uebermittlungsgueten, Schutz.

    In dieser Reihenfolge, weil sie der Frage folgt, die jemand an eine
    Empfangsstelle hat: Was ist angekommen — wie zuverlaessig laeuft das —
    und wie ist der Weg abgesichert.
    """
    return (
        _KOPF
        + _posteingang(eintraege or [])
        + (_uebermittlung(k) if k else "")
        + (_schutz(einstellungen) if einstellungen else "")
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
