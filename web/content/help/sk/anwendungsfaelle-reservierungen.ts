import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Rezervácie a kalendár",
  description: "Udržte si prehľad nad rezerváciami a kalendárom.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Rezervácie a kalendár",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Spoľahlivé predchádzanie nadmerným rezerváciám",
          excerpt: "Ako zaistíte, aby objekt nikdy nebol dvojito rezervovaný.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Objekt sa predáva súčasne cez viacero kanálov — portály ako Booking, Airbnb a ďalšie, vlastnú platformu, ako aj aplikáciu. Nadmerná rezervácia vzniká vtedy, keď sa dostupnosť na jednom kanáli nezablokuje včas po tom, ako bola vykonaná rezervácia na inom kanáli.",
            },
            {
              type: "steps",
              items: [
                "V pláne obsadenosti skontrolujte, či je každý objekt presne jeden riadok s jednou rezervovateľnou jednotkou — žiadna spoločná kapacita viacerých izieb.",
                "Nové rezervácie vytvárajte výhradne cez plán obsadenosti alebo pripojené kanály, nikdy manuálnym popisovaním jednotlivých dní.",
                "Po každej rezervácii skontrolujte, či sa rezervované noci v kalendári okamžite zobrazujú ako obsadené.",
                "Pri technických problémoch alebo údržbe okamžite použite Stop-Sell, namiesto ponechania dňa otvoreného.",
                "Pri nejasnostiach skontrolujte časovú os príslušnej rezervácie, aby ste pochopili chronologický priebeh.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nikdy meňte noci alebo blokovania manuálne mimo plánu obsadenosti — len tak zostáva zaistené, že všetky kanály vidia rovnaký stav dostupnosti a nevznikne medzera pre dvojitú rezerváciu.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Presun rezervácie do iného objektu",
          excerpt: "Ako čisto presuniete existujúcu rezerváciu do iného objektu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Niekedy musí hosť prejsť z jedného objektu do iného, napríklad kvôli technickej poruche alebo na želanie hosťa. Pri presune sa doterajšie noci v kalendári automaticky uvoľnia a v cieľovom objekte znova obsadia.",
            },
            {
              type: "steps",
              items: [
                "Otvorte dotknutú rezerváciu v časovej osi rezervácie.",
                "V menu akcií vyberte „Zmeniť objekt“, resp. „Presunúť“.",
                "Vyberte cieľový objekt a skontrolujte jeho dostupnosť vo zvolenom období.",
                "Potvrďte presun.",
                "Následne v pláne obsadenosti skontrolujte, či sa staré noci v pôvodnom objekte znova zobrazujú ako dostupné.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uvoľnenie starých nocí preberá systém automaticky — pôvodné obdobie nemusíte sami manuálne otvárať. Informujte hosťa o zmene objektu, najmä ak sa líši vybavenie alebo prístup.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Vytvorenie dlhodobej rezervácie",
          excerpt: "Ako správne vytvoríte rezerváciu na dlhšie obdobie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Pre dlhodobých hostí — napríklad na niekoľko týždňov či mesiacov — vytvoríte rezerváciu ako obvykle, no navyše dbáte na minimálny pobyt, platobné pravidlá a viditeľnosť objektu na kanáloch počas celého obdobia.",
            },
            {
              type: "steps",
              items: [
                "Otvorte plán obsadenosti požadovaného objektu a označte celé obdobie.",
                "Vytvorte rezerváciu s údajmi hosťa a plánovaným dátumom príchodu a odchodu.",
                "V prípade potreby nastavte platobné pravidlo so zálohou a doplatkom, namiesto okamžitej splatnosti celej sumy.",
                "Skontrolujte, či dlhému obdobiu neodporuje žiadne pravidlo minimálneho alebo maximálneho pobytu.",
                "Uložte rezerváciu a skontrolujte, či sa celé obdobie v kalendári správne zobrazuje ako obsadené.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pri veľmi dlhých pobytoch sa odporúča doplatok vo viacerých čiastkach namiesto jednej veľkej splatnosti — tak zostáva platobné riziko prehľadné. Podrobnosti v [Automatizácia doplatku](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};
