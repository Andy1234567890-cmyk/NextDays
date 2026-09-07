#!/usr/bin/env node
// Findet Knopf-ATTRAPPEN: <button> ohne onClick, ohne type="submit" und ohne
// form-Bezug. So einer sieht bedienbar aus und tut nichts — im Test faellt das
// nie auf, weil nichts bricht; es faellt dem NUTZER auf, der klickt und wartet.
//
// Anlass (05.09.2026): der Knopf „Fragen?" im Objekt-Assistenten hatte keinen
// Handler. Die Suche danach foerderte acht weitere zutage, darunter
// „E-Mail bestätigen" und „Raum löschen" — beide versprachen eine Handlung,
// die nirgends stattfand.
//
// WARUM KLAMMER-GENAU statt Zeilen-Regex: ein `onClick` steht oft drei Zeilen
// unter dem `<button`. Ein zeilenweiser Test meldet solche Knoepfe faelschlich,
// und in der Menge an Falschmeldungen geht der echte Befund unter.
//
// KEIN Befund sind Knoepfe in `asChild`-Wrappern (DialogTrigger, SheetTrigger,
// DropdownMenuTrigger, DialogClose): dort haengt der Handler am Elternteil.
//
// Aufruf:  node scripts/diagnose/tote-knoepfe-pruefen.mjs [app ...]
// Vorgabe: gastgeber. Exit 1, sobald etwas gefunden wird (CI-tauglich).
import fs from "node:fs";
import path from "node:path";

const APPS = process.argv.slice(2).length ? process.argv.slice(2) : ["gastgeber"];
const WRAPPER = /(DialogTrigger|SheetTrigger|DropdownMenuTrigger|PopoverTrigger|TooltipTrigger|DialogClose|AlertDialogTrigger|AlertDialogCancel|AlertDialogAction|CollapsibleTrigger|TabsTrigger)\s+asChild/;

function tsxDateien(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tsxDateien(p));
    else if (e.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Text des oeffnenden Tags ab Position i — zaehlt {} und Strings mit. */
function tagText(src, i) {
  let tiefe = 0, inStr = null, out = "";
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    out += c;
    if (inStr) {
      if (c === inStr && src[k - 1] !== "\\") inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") { inStr = c; continue; }
    if (c === "{") tiefe++;
    else if (c === "}") tiefe--;
    else if (c === ">" && tiefe === 0) return out;
  }
  return out;
}

const treffer = [];
for (const app of APPS) {
  for (const ordner of ["app", "components"]) {
    for (const datei of tsxDateien(path.join(app, ordner))) {
      const src = fs.readFileSync(datei, "utf8");
      for (const m of src.matchAll(/<button\b/g)) {
        const tag = tagText(src, m.index);
        if (/onClick|onSubmit|onPointerDown|onMouseDown|type=["']submit["']|\bform=/.test(tag)) continue;
        // Steht der Knopf in einem asChild-Wrapper? Blick auf die Zeilen davor.
        const davor = src.slice(Math.max(0, m.index - 400), m.index);
        if (WRAPPER.test(davor)) continue;
        const zeile = src.slice(0, m.index).split("\n").length;
        const label = (tag.match(/aria-label=\{?["']?([^"'}\n]{0,40})/) ?? [])[1] ?? "";
        treffer.push(`${datei}:${zeile}${label ? `  [${label}]` : ""}`);
      }
    }
  }
}

if (treffer.length) {
  console.error("Knopf-Attrappen (ohne Handler):");
  for (const t of treffer) console.error("  " + t);
  console.error(`\n${treffer.length} Treffer — jeder Knopf braucht eine Wirkung`);
  console.error("oder gehoert als Text/Hinweis dargestellt, wenn es kein Ziel gibt.");
  process.exit(1);
}
console.log(`✓ keine Knopf-Attrappen (${APPS.join(", ")})`);
