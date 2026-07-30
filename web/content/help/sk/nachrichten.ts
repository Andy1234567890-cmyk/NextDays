import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Správy a hostia",
  description: "Doručená pošta, šablóny a komunikácia s hosťami.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikácia",
      articles: [
        {
          slug: "posteingang",
          title: "Doručená pošta platformy",
          excerpt: "Všetky správy hostí vašich objektov sa zhromažďujú centrálne v doručenej pošte platformy.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Jedna doručená pošta pre všetky objekty" },
            {
              type: "p",
              text: "Doručená pošta platformy zhromažďuje všetky správy vašich hostí na jednom mieste — bez ohľadu na to, cez ktorý objekt alebo obdobie konverzácia prebieha. Otvoríte ju v sekcii /nachrichten a vidíte tam každý rozhovor ako samostatné vlákno.",
            },
            { type: "h2", text: "Štruktúra doručenej pošty" },
            {
              type: "ul",
              items: [
                "Ľavý stĺpec: zoznam všetkých konverzácií, najnovšie prvé",
                "Stredný stĺpec: aktívna história správ s hosťom",
                "Pravý stĺpec: kontext k rezervácii — obdobie, objekt, údaje hosťa",
              ],
            },
            { type: "h2", text: "Odpoveď na správu" },
            {
              type: "steps",
              items: [
                "Otvorte /nachrichten a vyberte požadovanú konverzáciu",
                "Napíšte svoju odpoveď do textového poľa alebo použite rýchlu odpoveď",
                "Odošlite správu — hosť ju dostane rovnakým spôsobom, akým napísal on",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Doručená pošta platformy zobrazuje výhradne priamu komunikáciu medzi vami a vašimi hosťami na myNextDays — správy z portálov naďalej vybavujete tam.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Rýchle odpovede",
          excerpt: "Šablóny pre časté otázky šetria čas pri kontakte s hosťami.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Čo sú rýchle odpovede" },
            {
              type: "p",
              text: "Rýchle odpovede sú vopred sformulované textové bloky pre opakujúce sa otázky — napríklad o príchode, hesle k WiFi alebo možnostiach parkovania. Namiesto písania každej odpovede odznova vložíte vhodnú šablónu jedným kliknutím do [Doručená pošta platformy](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Vytvorenie rýchlej odpovede" },
            {
              type: "steps",
              items: [
                "Otvorte /nachrichten a kliknite na „Spravovať rýchle odpovede“",
                "Kliknite na „Nová šablóna“ a zadajte názov, napríklad „Informácie k check-inu“",
                "Napíšte text odpovede; zástupné symboly ako meno hosťa alebo dátum príchodu sa pri odoslaní automaticky doplnia",
                "Uložte šablónu — odteraz je k dispozícii v každej konverzácii",
              ],
            },
            { type: "h2", text: "Používanie rýchlych odpovedí v praxi" },
            {
              type: "p",
              text: "V okne správ otvoríte zoznam šablón cez symbol blesku, vyberiete vhodnú odpoveď a v prípade potreby ju ešte individuálne upravíte pred odoslaním.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vytvorte si šablóny pre päť až desať najčastejších otázok — to v praxi pokryje väčšinu prichádzajúcich správ.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatické správy",
          excerpt: "Potvrdenia, informácie o check-ine a pripomienky možno hosťom posielať automaticky.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Automatizácia opakujúcich sa správ" },
            {
              type: "p",
              text: "Namiesto manuálneho odosielania potvrdení rezervácií, pokynov k check-inu alebo poďakovaní ich raz uložíte ako pravidlo — myNextDays ich potom automaticky odošle vo vhodnom čase pred, počas alebo po pobyte.",
            },
            { type: "h2", text: "Typické spúšťače automatických správ" },
            {
              type: "ul",
              items: [
                "Priamo po rezervácii — potvrdenie s najdôležitejšími údajmi",
                "Pár dní pred príchodom — informácie o check-ine a prístupový kód",
                "V deň odchodu — poďakovanie a žiadosť o hodnotenie",
              ],
            },
            { type: "h2", text: "Nastavenie automatickej správy" },
            {
              type: "steps",
              items: [
                "Otvorte /nachrichten, sekciu „Automatické správy“",
                "Vyberte spúšťač, napríklad „X dní pred príchodom“",
                "Uložte text — zástupné symboly ako meno hosťa, objekt alebo dátum príchodu sa vyplnia automaticky",
                "Aktivujte pravidlo; platí pre všetky objekty, ak nie je inak obmedzené",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatické správy sa štandardne objavia v [Doručená pošta platformy](/hilfe/nachrichten/posteingang) a tam ich možno kedykoľvek dodatočne nahliadnuť.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blokovanie správ",
          excerpt: "Osobu môžete zablokovať pre ďalší kontakt priamo z histórie správ.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Kedy je blokovanie vhodné" },
            {
              type: "p",
              text: "Pri urážlivých správach, obťažovaní alebo opakovanom nevhodnom správaní môžete osobu zablokovať priamo z vlákna správ. Zablokovaná osoba vám potom už nemôže písať nové správy ani vytvárať novú rezerváciu.",
            },
            { type: "h2", text: "Zablokovanie osoby z vlákna" },
            {
              type: "steps",
              items: [
                "Otvorte dotknutú konverzáciu v [Doručená pošta platformy](/hilfe/nachrichten/posteingang)",
                "Hore vo vlákne kliknite na menu a vyberte „Zablokovať osobu“",
                "Potvrďte proces — blokovanie platí okamžite",
              ],
            },
            { type: "h2", text: "Čo blokovanie znamená — a čo nie" },
            {
              type: "ul",
              items: [
                "Nové správy zablokovanej osoby sa už nedoručia",
                "Nové žiadosti o rezerváciu tejto osoby sa zamietnu",
                "Ak práve prebieha rezervácia tejto osoby, komunikácia zostáva výnimočne možná počas trvania pobytu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokovanie možno kedykoľvek zrušiť v prehľade „Blokované osoby“ v konte. Pred blokovaním skontrolujte, či už existuje prebiehajúca rezervácia.",
            },
          ],
        },
      ],
    },
  ],
};
