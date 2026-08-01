// ESLint-Flat-Config dieser App — Regeln kommen zentral aus
// packages/eslint-config (eine Basis für alle Next-Frontends, ADR-0016).
// App-eigene Ausnahmen gehören HIERHIN, nicht in die geteilte Basis.
import { nextConfig } from "@nextdays/eslint-config";

export default nextConfig({ tsconfigRootDir: import.meta.dirname });
