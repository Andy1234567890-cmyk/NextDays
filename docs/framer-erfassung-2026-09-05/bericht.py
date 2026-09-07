"""Baut docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md aus notizen.md + dumps/*.txt."""
import re, pathlib, json
HERE = pathlib.Path(__file__).parent
ZIEL = pathlib.Path('/Users/andystaudinger/NextDays/docs/FRAMER-EDITOR-VOLLERFASSUNG-2026-09-05.md')
TITEL = json.loads((HERE/'titel.json').read_text()) if (HERE/'titel.json').exists() else {}

def clean(txt):
    out, prev = [], None
    for l in txt.splitlines():
        l = re.sub(r' @-?\d+,-?\d+ \d+x\d+', '', l)
        if l.startswith('div[presentation]') or l.startswith('svg'): continue
        if l.startswith('font '):
            m = re.match(r'font text=(".*")', l)
            if prev and m and m.group(1) in prev: continue
        if l == prev: continue
        out.append(l); prev = l
    return '\n'.join(out)

teile = [(HERE/'notizen.md').read_text() if (HERE/'notizen.md').exists() else '']
teile.append('\n\n---\n\n## Anhang — Roh-Erfassung je Zustand (DOM, bereinigt)\n\n'
             'Format je Zeile: `tag[role] key=value …`. `title`/`aria` = englischer Originaltext (Tooltip), '
             '`text` = sichtbarer Text (durch Chrome-Übersetzung teils deutsch). `opts` = alle Optionen eines Selects. '
             'Zustände mit Präfix `p` sind Popover/Untermenüs als DIFF zum vorherigen Zustand (ADDED/REMOVED).\n')
for f in sorted((HERE/'dumps').glob('*.txt')):
    if f.stem in ('test','probe'): continue
    t = TITEL.get(f.stem, f.stem)
    teile.append(f'\n### {f.stem} — {t}\n\n```\n{clean(f.read_text())}\n```\n')
ZIEL.write_text('\n'.join(teile))
print(ZIEL, ZIEL.stat().st_size, 'Bytes')
