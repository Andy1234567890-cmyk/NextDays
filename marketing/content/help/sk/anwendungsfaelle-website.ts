import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Webová stránka",
  description: "Optimálne využitie vašej webovej stránky.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Webová stránka",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Uvedenie vašej webovej stránky do prevádzky",
          excerpt: "Ako zverejníte svoju vlastnú webovú stránku ako samostatný predajný kanál.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Vaša webová stránka je vlastný predajný kanál popri portáloch a platforme. Stránky budujete v editore, no až zverejnením sa webová stránka stane viditeľnou pre hostí a vaše objekty sa na nej zobrazia ako rezervovateľné.",
            },
            {
              type: "steps",
              items: [
                "Otvorte editor webových stránok a skontrolujte, či sú všetky požadované stránky vyplnené obsahom.",
                "V karte objektu vyberte pre jednotlivý objekt, či má byť viditeľný na webovej stránke — táto viditeľnosť je nezávislá od portálov a platformy.",
                "Skontrolujte náhľad v počítačovom aj mobilnom zobrazení, kým prejdete do prevádzky.",
                "Kliknite na „Zverejniť“, aby ste webovú stránku sprístupnili hosťom.",
                "Po zverejnení skontrolujte verejnú URL adresu a otestujte vzorovú rezerváciu cez webovú stránku.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Viditeľnosť objektu na webovej stránke je vlastná os — objekt môže byť aktívny na portáloch, ale na webovej stránke skrytý, a naopak. Podrobnosti v [Nastavenie vlastnej domény](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Nastavenie vlastnej domény",
          excerpt: "Ako prepojíte svoju vlastnú doménu s vašou webovou stránkou myNextDays.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Vlastná doména ako www.vasa-prevadzka.sk pôsobí profesionálnejšie ako štandardná adresa a posilňuje vašu značku voči hosťom, ktorí chcú rezervovať priamo u vás.",
            },
            {
              type: "steps",
              items: [
                "V editore webových stránok otvorte sekciu „Doména“ a zadajte svoju požadovanú vlastnú doménu.",
                "U poskytovateľa svojej domény nastavte zobrazené DNS záznamy (spravidla CNAME alebo A-Record).",
                "Počkajte, kým sa doména zobrazí ako pripojená a SSL certifikát ako aktívny — to môže podľa poskytovateľa trvať niekoľko hodín.",
                "Otestujte prístup na vlastnú doménu v súkromnom okne prehliadača, aby ste vylúčili uložené staré záznamy.",
                "Skontrolujte, či staré štandardné adresy naďalej presmerúvajú na novú doménu, aby existujúce odkazy neviedli do prázdna.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Meňte DNS záznamy len podľa zobrazeného návodu — nesprávne hodnoty môžu narušiť existujúce e-mailové nastavenia vašej domény. V prípade pochybností to preverte so svojím poskytovateľom domény, kým prepíšete existujúce záznamy.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Zvyšovanie priamych rezervácií",
          excerpt: "Ako nasmerujete viac hostí na svoju vlastnú webovú stránku namiesto portálov.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Rezervácie cez vlastnú webovú stránku sú pre vašu prevádzku spravidla lacnejšie ako cez portály, keďže tu neplatíte províziu portálu. Niekoľkými cielenými opatreniami zvýšite podiel priamych rezervácií cez vašu webovú stránku ako samostatný kanál.",
            },
            {
              type: "steps",
              items: [
                "Zabezpečte, aby boli všetky rezervovateľné objekty viditeľné na webovej stránke a mali aktuálne fotografie a popisy.",
                "Nastavte výhodu výhradnú pre webovú stránku, napríklad malú cenovú zľavu oproti portálom.",
                "Prepojte svoju vlastnú doménu v potvrdeniach rezervácií a komunikácii s hosťami, ktorí už raz rezervovali.",
                "Pravidelne sledujte štatistiku rezervácií, aby ste sledovali podiel webovej stránky na všetkých rezerváciách v čase.",
                "Optimalizujte rýchlosť načítania a mobilné zobrazenie webovej stránky, keďže väčšina hostí rezervuje cez smartfón.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Výhoda výhradná pre webovú stránku funguje len vtedy, ak hostia webovú stránku vôbec nájdu — aktívne na ňu odkazujte, namiesto spoliehania sa len na portály. K zverejneniu pozri [Uvedenie vašej webovej stránky do prevádzky](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
