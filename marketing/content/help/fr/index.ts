// Contenus français du centre d'aide, traduits depuis la base allemande. Ordre =
// ordre d'affichage. Chaque langue fournit un module avec le même export
// `categories` et des slugs/icons/collection identiques — seuls les textes
// sont traduits.
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
  ucMietpreise,
  ucWebsite,
  ucReservierungen,
  ucZahlungen,
  ucKanalmanager,
  ucEigentuemer,
];
