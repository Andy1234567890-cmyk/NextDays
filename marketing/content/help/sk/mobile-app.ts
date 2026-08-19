import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilná aplikácia",
  description: "Aplikácia myNextDays na cesty.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplikácia",
      articles: [
        {
          slug: "die-app",
          title: "Aplikácia myNextDays",
          excerpt: "Jedno konto, štyri zážitky: hosť, agentúra, vlastník a zamestnanec.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Aplikácia myNextDays je mobilná platforma pre celú vašu prevádzku. Nejde o samostatný produkt, ale o rovnocenné frontend rozhranie k vášmu webovému dashboardu — obe pristupujú k rovnakému kontu a rovnakým údajom, len rozhranie je optimalizované na cesty.",
            },
            { type: "h2", text: "Štyri zážitky v jednej aplikácii" },
            {
              type: "ul",
              items: [
                "Hosť: prezeranie rezervácií, komunikácia s prevádzkou, získanie informácií o check-ine.",
                "Agentúra: prehľad a správa viacerých prevádzok a objektov.",
                "Vlastník: prístup len na čítanie k vlastným objektom, obsadenosti a správam.",
                "Zamestnanec: kalendár, úlohy a plány upratovania pre operatívny každodenný chod.",
              ],
            },
            { type: "h2", text: "Ktorý zážitok vidíte" },
            {
              type: "p",
              text: "Po prihlásení aplikácia automaticky zobrazí zážitok vhodný pre vašu rolu — rovnakú rolu, aká platí aj vo webovom dashboarde. Zamestnanec s obmedzenými právami vidí v aplikácii presne rovnaké obmedzenia ako v prehliadači, keďže oprávnenie sa overuje na strane servera.",
            },
            {
              type: "note",
              variant: "info",
              text: "Viac o rolách a čo môžu vidieť, nájdete v [Role a oprávnenia](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pre aplikáciu nepotrebujete samostatnú registráciu — jednoducho sa prihláste svojimi existujúcimi prihlasovacími údajmi myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Inštalácia a prihlásenie do aplikácie",
          excerpt: "Ako stiahnete aplikáciu myNextDays a prihlásite sa.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Aplikácia myNextDays je dostupná pre iOS a Android. Prihlásenie prebieha rovnakými prihlasovacími údajmi ako vo webovom dashboarde — nie je potrebné samostatné konto ani nová registrácia.",
            },
            { type: "h2", text: "Inštalácia" },
            {
              type: "steps",
              items: [
                "Otvorte App Store (iOS) alebo Google Play (Android).",
                "Vyhľadajte „myNextDays“.",
                "Nainštalujte aplikáciu na svoj smartfón alebo tablet.",
                "Po inštalácii aplikáciu otvorte.",
              ],
            },
            { type: "h2", text: "Prihlásenie" },
            {
              type: "steps",
              items: [
                "Ťuknite na „Prihlásiť sa“.",
                "Zadajte svoju e-mailovú adresu a heslo.",
                "V prípade potreby potvrďte dvojfaktorové overenie.",
                "Automaticky sa dostanete do zážitku vhodného pre vašu rolu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Prihlasovacie údaje sú identické s webovým dashboardom.",
                "Ak vám bol odobratý prístup, prihlásenie do aplikácie je tiež okamžite zablokované.",
                "Pri problémoch s heslom použite priamo v aplikácii „Zabudnuté heslo“.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prihlasujte sa výhradne cez oficiálny záznam v obchode s aplikáciami „myNextDays“; aplikácia nikdy nepýta prihlasovacie údaje mimo prihlasovacej obrazovky.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Správa na cestách",
          excerpt: "Spracovanie rezervácií, správ a úloh priamo zo smartfónu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Aplikácia myNextDays sa hodí najmä na bežnú prevádzku na cestách: vidíte aktuálne rezervácie, odpovedáte na správy hostí a spracúvate úlohy bez toho, aby ste museli sedieť pri počítači — zmeny sa v reálnom čase objavia aj vo webovom dashboarde.",
            },
            { type: "h2", text: "Prehľad rezervácií" },
            {
              type: "p",
              text: "V sekcii „Rezervácie“ vidíte príchody a odchody, obsadenosť a status podľa objektu. Zamestnanci a upratovanie pritom vidia len informácie relevantné pre nich, bez cien alebo predajných detailov.",
            },
            { type: "h2", text: "Správy a úlohy" },
            {
              type: "steps",
              items: [
                "Otvorte sekciu „Správy“, aby ste priamo odpovedali na žiadosti hostí.",
                "Prepnite na „Úlohy“, aby ste videli sebe priradené úlohy.",
                "Ťuknutím na úlohu otvorte podrobnosti a dokončite ju.",
                "Splnené termíny upratovania označte priamo na mieste ako dokončené.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nové správy a úlohy sa zobrazujú okamžite, bez manuálneho obnovovania.",
                "Dokončené úlohy sú okamžite viditeľné aj vo webovom dashboarde.",
                "Vlastníci vidia rezervácie a správy svojich objektov, no len na čítanie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push upozornenia vás informujú o nových správach a priradených úlohách, hneď ako to povolíte v nastaveniach zariadenia.",
            },
          ],
        },
      ],
    },
  ],
};
