import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Úlohy a upratovanie",
  description: "Organizácia plánov upratovania a tímových úloh.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Prevádzka",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Vytváranie úloh",
          excerpt: "Ako vytvoríte novú úlohu pre objekt alebo obdobie.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Úlohy zhromažďujú všetko, čo treba okolo objektu vybaviť — od upratovania po check-oute až po údržbové práce alebo žiadosti hostí. Každá úloha je viazaná na presne jeden objekt a možno ju priradiť členovi tímu.",
            },
            { type: "h2", text: "Vytvorenie novej úlohy" },
            {
              type: "steps",
              items: [
                "V hlavnom menu otvorte sekciu „Úlohy“.",
                "Kliknite na „Nová úloha“.",
                "Vyberte dotknutý objekt.",
                "Zadajte názov a voliteľne popis.",
                "Nastavte dátum a čas splatnosti.",
                "Uložte úlohu.",
              ],
            },
            { type: "h2", text: "Typy úloh" },
            {
              type: "p",
              text: "Popri voľných úlohách existujú aj systémovo generované úlohy, napríklad automaticky naplánované upratovania po check-oute. Tie sú už prepojené s objektom a vhodným časovým oknom a treba ich už len priradiť členovi tímu.",
            },
            {
              type: "ul",
              items: [
                "Manuálna úloha: voľne zadaná, napr. údržba alebo osobitná požiadavka.",
                "Automatická úloha upratovania: odvodená z dátumu check-outu.",
                "Opakovaná úloha: pre pravidelné kontroly alebo inšpekcie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o automatickom časovom plánovaní nájdete v [Plány upratovania](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zadávajte presné názvy — členovia tímu v mobilnom zobrazení často vidia na prvý pohľad len názov a objekt.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Plány upratovania",
          excerpt: "Nechajte upratovania po check-oute plánovať automaticky.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Plán upratovania zabezpečuje, že po každom check-oute automaticky vznikne úloha upratovania pre dotknutý objekt — bez toho, aby ste museli jednotlivo sledovať každú rezerváciu. To znižuje počet zabudnutých odovzdávok a zaisťuje spoľahlivý priebeh medzi dvoma pobytmi.",
            },
            { type: "h2", text: "Aktivácia automatického plánovania" },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na kartu „Upratovanie“.",
                "Aktivujte „Automaticky plánovať upratovanie po check-oute“.",
                "Určte, koľko času sa naplánuje na upratovanie po check-oute.",
                "Voliteľne určte predvolený tím alebo predvolenú upratovaciu silu.",
                "Uložte nastavenie.",
              ],
            },
            { type: "h2", text: "Súčinnosť s kalendárom" },
            {
              type: "p",
              text: "Akonáhle sa rezervácia zruší alebo presunie, príslušná úloha upratovania sa automaticky prispôsobí novému dátumu check-outu. Tak zostáva plán upratovania vždy synchronizovaný so skutočným stavom obsadenosti.",
            },
            {
              type: "ul",
              items: [
                "Upratovanie vzniká automaticky pri každom check-oute s aktívnym plánom.",
                "Ak sa rezervácia presunie, presunie sa aj úloha upratovania.",
                "Ak hosť zruší pobyt, úloha upratovania sa odstráni.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez aktivovaného plánu upratovania nevznikajú žiadne automatické úlohy — vtedy vytvorte upratovania manuálne v [Vytváranie úloh](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Priraďovanie úloh",
          excerpt: "Cielené priraďovanie úloh upratovacím silám alebo členom tímu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Aby bola úloha splnená, priradíte ju konkrétnemu členovi tímu — napríklad upratovacej sile alebo zamestnancovi zodpovednému za údržbu. Štandardne úlohu vo vlastnom prehľade vidí len priradená osoba.",
            },
            { type: "h2", text: "Manuálne priradenie úlohy" },
            {
              type: "steps",
              items: [
                "Otvorte úlohu v zozname „Úlohy“.",
                "Kliknite na „Priradiť“.",
                "Zo zoznamu vyberte zodpovedného člena tímu.",
                "Potvrďte priradenie.",
              ],
            },
            { type: "h2", text: "Priradenie podľa objektu" },
            {
              type: "p",
              text: "Ak je upratovacej sile už pevne priradený objekt, môžete úlohy pre tento objekt nechať automaticky priraďovať tejto osobe. To pri opakujúcich sa upratovaniach šetrí kliknutia a znižuje počet spätných otázok.",
            },
            {
              type: "ul",
              items: [
                "Manuálne priradenie: osobu pre úlohu vyberáte sami.",
                "Pevné priradenie objektu: nové úlohy pre tento objekt idú automaticky na uloženú osobu.",
                "Úloha má vždy presne jednu zodpovednú osobu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Upratovacie sily a zamestnanci vidia výhradne svoje vlastné priradené úlohy, žiadne finančné ani predajné údaje objektu.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Sledovanie statusu úloh",
          excerpt: "Majte v reálnom čase prehľad o stave spracovania úloh.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Každá úloha prechádza jasným statusom — od otvorenej cez rozpracovanú až po dokončenú. Tak kedykoľvek vidíte, či bude upratovanie alebo údržba hotová včas pred ďalším check-inom.",
            },
            { type: "h2", text: "Prehľad statusov" },
            {
              type: "ul",
              items: [
                "Otvorená: úloha je vytvorená, ale ešte sa nezačala.",
                "Rozpracovaná: priradená osoba úlohu spustila.",
                "Dokončená: úloha je splnená a potvrdená.",
              ],
            },
            { type: "h2", text: "Aktualizácia statusu" },
            {
              type: "steps",
              items: [
                "Otvorte úlohu zo zoznamu „Úlohy“.",
                "Vyberte vhodný status, napr. „Rozpracovaná“ alebo „Dokončená“.",
                "V prípade potreby doplňte krátku poznámku, napríklad o nezrovnalostiach v objekte.",
                "Uložte zmenu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Zmeny statusu sa okamžite objavia v zdieľanom zozname úloh — manuálne obnovenie nie je potrebné.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ak je upratovanie krátko pred ďalším check-inom stále otvorené, najprv skontrolujte priradenie, kým kontaktujete hosťa.",
            },
          ],
        },
      ],
    },
  ],
};
