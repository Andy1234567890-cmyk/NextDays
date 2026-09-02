// České (přeložené) obsahy centra nápovědy. Pořadí = pořadí zobrazení.
// Stejný export `categories` jako v základní němčině — pouze texty přeloženy,
// slugy/ikony/collection zůstávají identické.
import { ersteSchritte } from "./erste-schritte";
import { objekte } from "./objekte";
import { preiseRaten } from "./preise-raten";
import { kalenderVerfuegbarkeit } from "./kalender-verfuegbarkeit";
import { reservierungen } from "./reservierungen";
import { portaleKanalmanager } from "./portale-kanalmanager";
import { plattformMarktplatz } from "./plattform-marktplatz";
import { website } from "./website";
import { zahlungen } from "./zahlungen";
import { nachrichten } from "./nachrichten";
import { aufgabenReinigung } from "./aufgaben-reinigung";
import { eigentuemer } from "./eigentuemer";
import { teamRollen } from "./team-rollen";
import { kontoAbo } from "./konto-abo";
import { mobileApp } from "./mobile-app";
import { ucMietpreise } from "./anwendungsfaelle-mietpreise";
import { ucWebsite } from "./anwendungsfaelle-website";
import { ucReservierungen } from "./anwendungsfaelle-reservierungen";
import { ucZahlungen } from "./anwendungsfaelle-zahlungen";
import { ucKanalmanager } from "./anwendungsfaelle-kanalmanager";
import { ucEigentuemer } from "./anwendungsfaelle-eigentuemererklaerungen";
import { partnerprogramm } from "./partnerprogramm";
import type { HelpCategory } from "../types";

export const categories: HelpCategory[] = [
  ersteSchritte,
  objekte,
  preiseRaten,
  kalenderVerfuegbarkeit,
  reservierungen,
  portaleKanalmanager,
  plattformMarktplatz,
  website,
  zahlungen,
  nachrichten,
  aufgabenReinigung,
  eigentuemer,
  teamRollen,
  kontoAbo,
  mobileApp,
  partnerprogramm,
  ucMietpreise,
  ucWebsite,
  ucReservierungen,
  ucZahlungen,
  ucKanalmanager,
  ucEigentuemer,
];
