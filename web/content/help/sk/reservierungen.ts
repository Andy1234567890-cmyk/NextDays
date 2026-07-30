import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervácie a objednávky",
  description: "Správa, presúvanie a rušenie rezervácií.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervácie",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Manuálne zadanie rezervácie",
          excerpt:
            "Ako priamo v myNextDays zadáte rezerváciu prijatú telefonicky alebo e-mailom.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Kedy zadávať manuálne" },
            {
              type: "p",
              text: "Nie každá rezervácia príde cez portál alebo vašu vlastnú platformu — žiadosti telefonicky, e-mailom alebo osobne musíte vytvoriť sami, aby bol objekt v myNextDays správne zablokovaný a nevznikla dvojitá obsadenosť.",
            },
            {
              type: "steps",
              items: [
                "Otvorte Rezervácie a kliknite na „Nová rezervácia“.",
                "Vyberte objekt — každý objekt v myNextDays je jednotlivá rezervovateľná jednotka, teda konkrétna izba alebo rekreačný objekt.",
                "Určte príchod a odchod, ako aj počet hostí.",
                "Uložte údaje hosťa (meno, kontakt, prípadne adresu pre faktúru).",
                "Skontrolujte navrhovanú cenu a v prípade potreby ju upravte.",
                "Uložte rezerváciu — noci sa okamžite zablokujú v kalendári.",
              ],
            },
            { type: "h2", text: "Platba a potvrdenie" },
            {
              type: "p",
              text: "Po uložení platia rovnaké platobné pravidlá ako pri online rezerváciách. Ak je pripojený poskytovateľ platieb, môžete hosťovi priamo zaslať platobný odkaz alebo platbu manuálne označiť ako prijatú.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Osobitné požiadavky (skorý príchod, prístelky) zadajte hneď do poznámok — tím ich uvidí v časovej osi rezervácie.",
            },
            { type: "h2", text: "Po vytvorení" },
            {
              type: "p",
              text: "Nová rezervácia sa okamžite objaví v [Časovej osi rezervácie](/hilfe/reservierungen/buchungs-zeitleiste) so všetkými ďalšími krokmi ako správy, úlohy a platby na jednom mieste.",
            },
            {
              type: "ul",
              items: [
                "Kalendár a portály sa automaticky synchronizujú hneď po uložení.",
                "Hosť v prípade potreby dostane automatickú potvrdzovaciu správu.",
                "Zmeny termínov zaznamenávate cez „Presunúť rezerváciu“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Časová os rezervácie",
          excerpt:
            "Časová os rezervácie zhŕňa celý priebeh rezervácie na jednom mieste.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Čo časová os zobrazuje" },
            {
              type: "p",
              text: "Každá rezervácia má vlastnú časovú os, ktorá chronologicky zobrazuje celý priebeh — od žiadosti o rezerváciu alebo importu z portálu až po check-out. Tak na prvý pohľad vidíte, čo sa už udialo a čo je ďalšie na rade.",
            },
            {
              type: "ul",
              items: [
                "Správy s hosťom",
                "Úlohy, napríklad upratovanie alebo príprava",
                "Platby a faktúry",
                "Rezervované doplnky a dodatočné služby",
                "Presuny (Move) a storná",
              ],
            },
            { type: "h2", text: "Používanie časovej osi v praxi" },
            {
              type: "steps",
              items: [
                "Otvorte Rezervácie a vyberte požadovanú rezerváciu.",
                "Prepnite na kartu „Časová os“.",
                "Prechádzajte chronologicky všetkými udalosťami.",
                "Použite rýchle akcie na priame odoslanie správy alebo vytvorenie úlohy.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ak sa rezervácia presunie alebo zruší, tento krok sa tiež objaví v časovej osi — vrátane nocí uvoľnených v kalendári.",
            },
            { type: "h2", text: "Prečo je to dôležité" },
            {
              type: "p",
              text: "Keďže tím, vlastník aj podpora vidia rovnakú časovú os, nevznikajú informačné medzery medzi správami, úlohami a platbami. Podrobnosti o vrátení platieb nájdete v [Vrátenie platieb](/hilfe/zahlungen/rueckerstattungen), o doplnkových službách v [Doplnky a dodatočné služby](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Presunutie rezervácie",
          excerpt:
            "Ako presuniete existujúcu rezerváciu na nové obdobie bez narušenia kalendára.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Kontrola pred presunutím" },
            {
              type: "p",
              text: "Pred presunutím rezervácie skontrolujte dostupnosť v novom období pre rezervovaný objekt. myNextDays uvoľní pôvodne rezervované noci až po potvrdení nového obdobia — tak nevznikne medzera, v ktorej by sa objekt nesprávne javil ako voľný alebo dvojito obsadený.",
            },
            {
              type: "steps",
              items: [
                "Otvorte rezerváciu v sekcii Rezervácie.",
                "Vyberte „Presunúť“ a zadajte nové obdobie.",
                "Skontrolujte zobrazenú dostupnosť pre nové dátumy.",
                "Potvrďte presunutie.",
                "Skontrolujte, či sa cena mení v dôsledku nového počtu nocí, a v prípade potreby ju upravte.",
              ],
            },
            { type: "h2", text: "Čo sa deje automaticky" },
            {
              type: "p",
              text: "Po potvrdení sa staré noci v kalendári správne uvoľnia a nové noci zablokujú, prepojené portály sa aktualizujú. Proces sa zaznamenáva v časovej osi rezervácie.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ak bola rezervácia prijatá cez portál, môže tam presun podliehať vlastným pravidlám — pred väčšími zmenami skontrolujte podmienky portálu.",
            },
            { type: "h2", text: "Rozdiely v platbách" },
            {
              type: "p",
              text: "Ak sa cena presunutím zmení, primerane upravte platobné pravidlá — pozri [Platobné pravidlá](/hilfe/zahlungen/zahlungsregeln). Viac o celkovom priebehu rezervácie nájdete v [Časová os rezervácie](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Storno a vrátenie platby",
          excerpt:
            "Ako správne zrušíte rezerváciu a v prípade potreby vyvoláte vrátenie platby.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Zrušenie rezervácie" },
            {
              type: "p",
              text: "Storno okamžite opäť uvoľní objekt na rezervované obdobie — v kalendári aj na všetkých prepojených portáloch. Pred zrušením skontrolujte, aké storno podmienky pre túto rezerváciu platia.",
            },
            {
              type: "steps",
              items: [
                "Otvorte rezerváciu v sekcii Rezervácie.",
                "Vyberte „Zrušiť“ a zadajte dôvod.",
                "Skontrolujte navrhovanú sumu vrátenia platby.",
                "Potvrďte storno.",
              ],
            },
            { type: "h2", text: "Vyvolanie vrátenia platby" },
            {
              type: "p",
              text: "Ak bola platba spracovaná cez pripojeného poskytovateľa platieb, môžete vrátenie platby spustiť priamo z rezervácie. Suma sa uvádza v mene uloženej pre tento objekt. Podrobnosti o procese nájdete v [Vrátenie platieb](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Možné je úplné alebo čiastočné vrátenie platby",
                "Proces sa objaví v časovej osi rezervácie",
                "Pri rezerváciách z portálu platia navyše pravidlá príslušného portálu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Storno nie je možné vrátiť späť. Pred potvrdením starostlivo skontrolujte obdobie a hosťa.",
            },
            { type: "h2", text: "Po zrušení" },
            {
              type: "p",
              text: "Objekt je odteraz opäť rezervovateľný, otvorené úlohy súvisiace s rezerváciou — napríklad príprava — sa automaticky označia ako už nepotrebné. Celý proces zostáva sledovateľný v [Časová os rezervácie](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in a check-out",
          excerpt: "Ako v myNextDays zdokumentujete príchod a odchod hosťa.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Zaznamenanie check-inu" },
            {
              type: "p",
              text: "Check-in označuje začiatok pobytu a je obzvlášť užitočný pri samo-check-ine alebo odovzdaní kľúčov tímom, aby sa udržal aktuálny status každej rezervácie.",
            },
            {
              type: "steps",
              items: [
                "Otvorte rezerváciu v sekcii Rezervácie.",
                "V deň príchodu vyberte „Check-in“.",
                "V prípade potreby pridajte poznámku, napríklad čas alebo osobitosti.",
              ],
            },
            { type: "h2", text: "Check-out a odovzdanie" },
            {
              type: "p",
              text: "Pri check-oute označíte pobyt ako ukončený. V mnohých prípadoch to automaticky spustí úlohu upratovania pre objekt, aby bol pripravený na ďalšiu rezerváciu.",
            },
            {
              type: "ul",
              items: [
                "Check-in a check-out sú súčasťou časovej osi rezervácie",
                "Časy možno definovať pre jednotlivý objekt v nastaveniach objektu",
                "Pri mobilnom prístupe môže tím zaznamenať check-in a check-out priamo na mieste",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vynechaný check-out automaticky neblokuje nadväzujúce úlohy — pravidelne kontrolujte oneskorené statusy v sekcii Rezervácie.",
            },
            { type: "h2", text: "Súvislosť s úlohami" },
            {
              type: "p",
              text: "Check-in a check-out úzko súvisia s úlohami a časovou osou. Viac o celkovom priebehu si prečítajte v [Časová os rezervácie](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Doplnky a dodatočné služby",
          excerpt:
            "Ako ponúknete hosťom rezervovateľné dodatočné služby ako raňajky alebo transfer a zaznamenáte ich v rezervácii.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Čo sú doplnky" },
            {
              type: "p",
              text: "Doplnky sú voliteľné dodatočné služby k rezervácii — napríklad raňajky, skorý príchod, transfer alebo neskorý check-out. Ukladajú sa pre jednotlivý objekt a môže ich k rezervácii pridať hosť sám, alebo váš tím.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt a v sekcii „Doplnky“ vytvorte požadované dodatočné služby s cenou.",
                "Otvorte existujúcu rezerváciu v sekcii Rezervácie.",
                "Vyberte „Pridať doplnok“ a vyberte požadovanú službu.",
                "Potvrďte množstvo a čas služby.",
              ],
            },
            { type: "h2", text: "Vyúčtovanie" },
            {
              type: "p",
              text: "Doplnky sa vyúčtujú v mene príslušného objektu a na faktúre sa objavia ako samostatná položka. Už zaplatené doplnky možno pri storne pomerne vrátiť.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Uložte obľúbené doplnky raz centrálne pri objekte — tak ich možno pri každej novej rezervácii pridať niekoľkými kliknutiami.",
            },
            { type: "h2", text: "Viditeľnosť pre hosťa" },
            {
              type: "p",
              text: "Ak je aktívna platforma alebo vlastná webová stránka, hostia si často môžu vybrať príslušné doplnky už počas samotnej rezervácie. Každé doplnenie sa následne objaví v [Časová os rezervácie](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Doplnky možno pre jednotlivý objekt individuálne pomenovať a oceniť",
                "Dodatočné pridanie je kedykoľvek možné cez rezerváciu",
                "Zrušené doplnky sa vracajú pomerne",
              ],
            },
          ],
        },
      ],
    },
  ],
};
