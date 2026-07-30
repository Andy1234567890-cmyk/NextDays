// Basis-URL der Haupt-App (Dashboard). Die Rechtsdokumente AGB/Datenschutz
// liegen dort, nicht in dieser Marketing-App — daher absolute Links.
// Abgeleitet aus derselben Env wie der Login-Link in der Nav, damit es beim
// Domain-Wechsel nur EINE Stelle gibt.
const LOGIN_URL_FALLBACK =
  "https://bln3q0n1l1se2hna8utkuag9.65.21.144.136.sslip.io/login";

export const LOGIN_URL = process.env.NEXT_PUBLIC_LOGIN_URL ?? LOGIN_URL_FALLBACK;

export const APP_URL = LOGIN_URL.replace(/\/login\/?$/, "");

export const AGB_URL = `${APP_URL}/agb`;
export const HILFE_URL = `${APP_URL}/hilfe`;
// Registrierung liegt in der web-App unter /signup (NICHT /register — diese
// Route existiert nirgends und lief vorher in einen 404).
export const SIGNUP_URL = `${APP_URL}/signup`;
