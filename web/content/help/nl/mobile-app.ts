import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobiele app",
  description: "De myNextDays-app voor onderweg.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "De myNextDays-app",
          excerpt: "Eén account, vier ervaringen: gast, agentschap, eigenaar en medewerker.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De myNextDays-app is het mobiele platform voor uw hele bedrijf. Het is geen apart product, maar een gelijkwaardige frontend van uw webdashboard — beide gebruiken hetzelfde account en dezelfde gegevens, alleen de interface is geoptimaliseerd voor onderweg.",
            },
            { type: "h2", text: "Vier ervaringen in één app" },
            {
              type: "ul",
              items: [
                "Gast: boekingen bekijken, communiceren met het bedrijf, check-in-informatie opvragen.",
                "Agentschap: meerdere bedrijven en objecten in overzicht beheren.",
                "Eigenaar: alleen-lezen inzicht in de eigen objecten, bezetting en rapportages.",
                "Medewerker: kalender, taken en schoonmaakplanningen voor de dagelijkse operatie.",
              ],
            },
            { type: "h2", text: "Welke ervaring u ziet" },
            {
              type: "p",
              text: "Na het inloggen toont de app automatisch de bijpassende ervaring voor uw rol — dezelfde rol die ook in het webdashboard geldt. Een medewerker met beperkte rechten ziet in de app precies dezelfde beperkingen als in de browser, omdat de bevoegdheid serverzijdig wordt gecontroleerd.",
            },
            {
              type: "note",
              variant: "info",
              text: "Meer over rollen en wat zij mogen zien vindt u onder [Rollen & bevoegdheden](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "U hoeft zich niet apart te registreren voor de app — meld u gewoon aan met uw bestaande myNextDays-inloggegevens.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "App installeren & inloggen",
          excerpt: "Zo downloadt u de myNextDays-app en logt u in.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De myNextDays-app is beschikbaar voor iOS en Android. Inloggen gebeurt met dezelfde inloggegevens als in het webdashboard — er is geen apart account en geen nieuwe registratie nodig.",
            },
            { type: "h2", text: "Installatie" },
            {
              type: "steps",
              items: [
                "Open de App Store (iOS) of Google Play (Android).",
                "Zoek naar “myNextDays”.",
                "Installeer de app op uw smartphone of tablet.",
                "Open de app na installatie.",
              ],
            },
            { type: "h2", text: "Inloggen" },
            {
              type: "steps",
              items: [
                "Tik op “Inloggen”.",
                "Voer uw e-mailadres en wachtwoord in.",
                "Bevestig eventueel de tweefactorcontrole.",
                "U komt automatisch in de bij uw rol passende ervaring terecht.",
              ],
            },
            {
              type: "ul",
              items: [
                "Inloggegevens zijn identiek aan het webdashboard.",
                "Is uw toegang ingetrokken, dan is ook het inloggen in de app direct geblokkeerd.",
                "Bij problemen met het wachtwoord gebruikt u “Wachtwoord vergeten” rechtstreeks in de app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Log uitsluitend in via de officiële app-store-vermelding “myNextDays”; de app vraagt nooit om inloggegevens buiten het inlogscherm.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Onderweg beheren",
          excerpt: "Boekingen, berichten en taken rechtstreeks vanaf de smartphone verwerken.",
          updated: "Bijgewerkt: juli 2026",
          body: [
            {
              type: "p",
              text: "De myNextDays-app is bij uitstek geschikt voor de dagelijkse gang van zaken onderweg: u ziet actuele boekingen, beantwoordt gastberichten en werkt taken af zonder achter de computer te hoeven zitten — wijzigingen verschijnen in realtime ook in het webdashboard.",
            },
            { type: "h2", text: "Boekingen in beeld" },
            {
              type: "p",
              text: "In het onderdeel “Boekingen” ziet u aankomsten en vertrekken, bezetting en status per object. Medewerkers en schoonmaak zien daarbij alleen de voor hen relevante informatie, zonder prijzen of verkoopdetails.",
            },
            { type: "h2", text: "Berichten & taken" },
            {
              type: "steps",
              items: [
                "Open het onderdeel “Berichten” om gastvragen rechtstreeks te beantwoorden.",
                "Ga naar “Taken” om de aan u toegewezen to-do's te zien.",
                "Tik op een taak om details te openen en deze af te ronden.",
                "Markeer uitgevoerde schoonmaakafspraken direct ter plaatse als afgerond.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nieuwe berichten en taken verschijnen live, zonder handmatig vernieuwen.",
                "Afgeronde taken zijn meteen ook zichtbaar in het webdashboard.",
                "Eigenaren zien boekingen en rapportages van hun objecten, maar uitsluitend lezend.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pushmeldingen informeren u over nieuwe berichten en toegewezen taken, zodra u deze in de apparaatinstellingen toestaat.",
            },
          ],
        },
      ],
    },
  ],
};
