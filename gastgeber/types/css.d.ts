// CSS-Importe als Nebeneffekt typisieren (z. B. `import "./globals.css"`).
// Next.js handhabt das zur Build-Zeit; diese Deklaration stellt sicher, dass
// auch der TS-Sprachserver den Import kennt.
//
// Body-Form `{}` (nicht `declare module "*.css";`) — ab TypeScript 6.0 ist
// `noUncheckedSideEffectImports` per Default aktiv und wirft sonst ts(2882) bei
// Side-Effect-CSS-Importen. Die leere Body-Form ist die von TS dokumentierte
// Variante (typescriptlang.org/tsconfig/noUncheckedSideEffectImports).
declare module "*.css" {}
