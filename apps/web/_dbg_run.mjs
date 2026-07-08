import { importLodgifyProperties } from "./lib/lodgify-import.ts";
console.log(">>> START Import-Lauf mit Debug");
const t0 = Date.now();
try {
  const props = await importLodgifyProperties(process.env.LG_EMAIL, process.env.LG_PW);
  console.log(`>>> ERFOLG — ${props.length} Objekte in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log(">>> Namen:", props.slice(0,5).map(p=>p.name).join(" | "), "…");
} catch (e) {
  console.log(`>>> FEHLER ${e.status}: ${e.message}`);
}
