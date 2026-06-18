// CSS-Importe als Nebeneffekt typisieren (z. B. `import "./globals.css"`).
// Next.js handhabt das zur Build-Zeit; diese Deklaration stellt sicher, dass
// auch der TS-Sprachserver den Import kennt.
declare module "*.css";
