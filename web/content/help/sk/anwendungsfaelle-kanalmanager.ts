import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanálový manažér",
  description: "Zvládnite portály a kanálového manažéra.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanálový manažér",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Prepojenie vášho prvého portálu",
          excerpt: "Ako prvýkrát aktivujete portál pre objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: máte vytvorený objekt, ale ešte žiadny prepojený portál",
            },
            {
              type: "p",
              text: "Váš objekt je v myNextDays kompletne nastavený, ale ešte nie je viditeľný na žiadnom portáli ako Booking.com alebo Airbnb. Skôr než portál objekt prijme, vaše konto jedenkrát potrebuje prepojenie s portálom platné pre celé konto — potom pre každý ďalší objekt stačí už len mapovanie.",
            },
            {
              type: "steps",
              items: [
                "Otvorte /konto, sekciu „Portály a kanálový manažér“, a nastavte prepojenie platné pre celé konto s údajmi svojej prevádzky",
                "Následne otvorte objekt v /objekte a prepnite na kartu „Portály“",
                "Vyberte požadovaný portál a priraďte ho k vhodnému typu izby, resp. ponuky",
                "Skontrolujte fotografie, vybavenie, ceny a storno podmienky — portály vyžadujú úplné údaje",
                "Aktivujte viditeľnosť; status sa po kontrole zo strany portálu zmení na „Prepojené“",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Prepojenie platné pre celé konto nastavíte len raz. Podrobnosti k tomu nájdete v [Napojenie na Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) a [Napojenie na Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Napojenie na Booking.com",
          excerpt: "Ako urobíte objekt rezervovateľným na Booking.com cez kanálového manažéra.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: váš objekt sa má navyše zobraziť na Booking.com",
            },
            {
              type: "p",
              text: "Booking.com je jeden z portálov, ktoré sa napájajú cez kanálového manažéra. Predpokladom je prepojenie s portálom platné pre celé konto — ak je už nastavené, pre Booking.com potrebujete už len mapovanie pre jednotlivý objekt.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt v /objekte, karta „Portály“",
                "Zo zoznamu dostupných portálov vyberte „Booking.com“",
                "Priraďte vhodný typ izby, resp. ponuky a potvrďte aspoň jednu sadzbu s cenou a storno podmienkami",
                "Uložte platný spôsob platby pre vyúčtovanie provízie",
                "Aktivujte viditeľnosť pre Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uvedenie do prevádzky zo strany Booking.com môže trvať niekoľko hodín. Status na karte „Portály“ ukáže, hneď ako je prepojenie aktívne.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Napojenie na Airbnb",
          excerpt: "Ako urobíte objekt rezervovateľným na Airbnb cez kanálového manažéra.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: váš objekt sa má navyše zobraziť na Airbnb",
            },
            {
              type: "p",
              text: "Airbnb sa pripája ako každý iný portál cez prepojenie platné pre celé konto. Ak je to nastavené, aktivujete Airbnb pre jednotlivý objekt cez mapovanie — bez ohľadu na to, či je objekt už viditeľný na Booking.com alebo iných portáloch.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt v /objekte, karta „Portály“",
                "Zo zoznamu dostupných portálov vyberte „Airbnb“",
                "Potvrďte kategóriu objektu a priradený typ ponuky",
                "Doplňte fotografie, vybavenie a domáci poriadok — Airbnb pred aktiváciou vyžaduje úplné údaje",
                "Aktivujte viditeľnosť pre Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uložených storno podmienok a domáceho poriadku Airbnb aktiváciu odmietne. Tieto údaje najprv doplňte v objekte.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Udržiavanie synchronizácie cien naprieč portálmi",
          excerpt: "Stačí jeden kalendár — kanálový manažér automaticky rozdelí zmeny cien na všetky portály.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: meníte cenu a chcete zabezpečiť, aby sedela všade",
            },
            {
              type: "p",
              text: "Ceny spravujete výhradne v kalendári myNextDays objektu — nikdy jednotlivo priamo v samotných portáloch. Kanálový manažér automaticky prenáša každú zmenu na všetky portály, pre ktoré je objekt aktívne namapovaný.",
            },
            {
              type: "steps",
              items: [
                "Otvorte cenový kalendár, resp. cenové plány objektu",
                "Upravte dennú cenu, minimálny pobyt alebo obmedzenie príchodu/odchodu",
                "Uložte zmenu — najprv sa prejaví interne v objekte",
                "Na karte „Portály“ skontrolujte, či sú všetky požadované portály naďalej aktívne namapované",
                "Počkajte niekoľko minút, kým sa zmena prenesie na portály",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nikdy nezadávajte ceny priamo v portáli — takéto zmeny sa pri ďalšom zosúladení prepíšu z kalendára myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Import rezervácie z portálu",
          excerpt: "Rezervácie z portálov sa automaticky objavia v kalendári — tu skontrolujete, že import prebehol.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: hosť rezervoval cez portál, rezervácia sa má dostať do myNextDays",
            },
            {
              type: "p",
              text: "Ak hosť rezervuje cez Booking.com, Airbnb alebo iný prepojený portál, kanálový manažér rezerváciu automaticky importuje — nič nemusíte manuálne prenášať. Tento postup opisuje, ako import overiť a potvrdiť.",
            },
            {
              type: "steps",
              items: [
                "Otvorte kalendár alebo zoznam rezervácií dotknutého objektu",
                "Nájdite novú rezerváciu — nesie štítok pôvodu z portálu, napríklad Booking.com alebo Airbnb",
                "Skontrolujte úplnosť údajov hosťa, obdobia a ceny",
                "Skontrolujte, či sa rezervované noci zobrazujú na všetkých ostatných kanáloch ako zablokované",
                "V prípade potreby otvorte podrobnosti rezervácie a spracujte doplnkové služby alebo správy hosťa",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ak hosť zruší rezerváciu cez portál alebo zmení obdobie, prenesie sa to tiež automaticky a noci sa opäť uvoľnia.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Vyriešenie dvojitej rezervácie",
          excerpt: "Ako postupovať, ak sa tá istá noc výnimočne predala na dvoch kanáloch.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: dve rezervácie sa prekrývajú pre ten istý objekt a tie isté noci",
            },
            {
              type: "p",
              text: "Kanálový manažér spravidla okamžite blokuje rezervované noci naprieč kanálmi. Dvojitá rezervácia napriek tomu môže vzniknúť, napríklad pri súčasných rezerváciách na dvoch portáloch v tej istej chvíli, alebo pri manuálne vytvorenej rezervácii, ktorá koliduje s rezerváciou z portálu.",
            },
            {
              type: "steps",
              items: [
                "Otvorte kalendár objektu a identifikujte obe prekrývajúce sa rezervácie",
                "Skontrolujte čas rezervácie a štítok pôvodu oboch rezervácií",
                "Kontaktujte hosťa, ktorý rezervoval neskôr, a ponúknite mu náhradný objekt alebo alternatívne obdobie",
                "Zrušte neudržateľnú rezerváciu priamo v príslušnom portáli, nielen v myNextDays",
                "Pre dotknuté noci následne nastavte Stop-Sell, kým sa prípad úplne nevyrieši",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rezerváciu z portálu vždy zrušte priamo cez daný portál — storno len v myNextDays síce interne uvoľní noc, no spoľahlivo o tom neinformuje portál.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Dočasné pozastavenie portálu",
          excerpt: "Vypnutie viditeľnosti pre jednotlivý portál bez straty mapovania.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: objekt má byť dočasne nerezervovateľný na jednom portáli",
            },
            {
              type: "p",
              text: "Viditeľnosť je prepínateľná jednotlivo pre každý portál — nezávisle od webovej stránky a trhoviska platformy. Ak chcete napríklad krátkodobo pozastaviť Airbnb, no Booking.com nechať bežať ďalej, deaktivujte výhradne tento jeden kanál.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt v /objekte, karta „Portály“",
                "Nájdite záznam portálu, ktorý chcete pozastaviť",
                "Vypnite viditeľnosť pre tento portál",
                "Uložte — zmena sa prejaví v priebehu niekoľkých minút, objekt zmizne z výsledkov vyhľadávania tohto portálu",
                "Viditeľnosť znova zapnite, hneď ako má byť objekt opäť rezervovateľný",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mapovanie pri pozastavení zostáva zachované — priradenie k portálu nemusíte neskôr nastavovať znova. Pre úplné zablokovanie všetkých kanálov použite namiesto toho Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Kontrola mapovania objektu",
          excerpt: "Ako skontrolujete, či je váš objekt stále správne priradený k správnemu typu ponuky v portáli.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: ceny alebo dostupnosť na portáli už nesedia s myNextDays",
            },
            {
              type: "p",
              text: "Ak sa zobrazenie v portáli odlišuje od vášho kalendára myNextDays, príčinou je často chybné alebo prerušené mapovanie — prepojenie medzi vaším objektom a typom izby, resp. ponuky v portáli.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt v /objekte, karta „Portály“",
                "Skontrolujte status príslušného portálu — mal by ukazovať „Prepojené“, nie „Chyba“ alebo „Čaká sa“",
                "Skontrolujte, či priradený typ izby, resp. ponuky v portáli ešte zodpovedá skutočnému objektu",
                "Pri odchýlke: mapovanie zrušte a znova priraďte, následne opäť aktivujte viditeľnosť",
                "Po oprave počkajte niekoľko minút a znova skontrolujte ceny a dostupnosť v portáli",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekt môže byť súčasne priradený viacerým portálom — pri nezrovnalostiach skontrolujte cielene ten jeden dotknutý portál, nie všetky naraz.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Rôzne sadzby podľa portálu",
          excerpt: "Ako portálu priradíte vlastný cenový plán bez ovplyvnenia ostatných kanálov.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: chcete na jednom portáli ponúkať inú cenu ako na ostatných kanáloch",
            },
            {
              type: "p",
              text: "Cenové plány možno priradiť jednotlivo podľa portálu, napríklad nevratný cenový plán pre jeden portál a flexibilný pre iný. Základné ceny zostávajú centrálne spravované v objekte, mapovanie určuje, ktorý cenový plán ide na ktorý portál.",
            },
            {
              type: "steps",
              items: [
                "V objekte vytvorte dodatočný cenový plán s požadovanými podmienkami (cena, storno podmienky, minimálny pobyt)",
                "Otvorte kartu „Portály“ a vyberte dotknutý portál",
                "V mapovaní priraďte tomuto portálu nový cenový plán",
                "Ostatné portály nechajte nezmenené na ich doterajšom cenovom pláne",
                "Uložte a po niekoľkých minútach skontrolujte zobrazenie ceny v príslušnom portáli",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Každý cenový plán sa prenáša nezávisle — zmena jedného cenového plánu neovplyvňuje portály priradené k inému cenovému plánu.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Riešenie častých chýb portálu",
          excerpt: "Typické príčiny, keď portál odmietne objekt alebo sa synchronizácia zasekne.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia: status portálu ukazuje chybu, alebo sa objekt neprevzal",
            },
            {
              type: "p",
              text: "Portály zvyčajne odmietajú prepojenie kvôli chýbajúcim základným údajom alebo neúplným údajom objektu. Prejdite postupne najčastejšie príčiny, kým sa obrátite na podporu.",
            },
            {
              type: "steps",
              items: [
                "V /konto skontrolujte, či sú kompletne uložené adresa, daňové informácie a kontaktné údaje",
                "V objekte skontrolujte, či sú úplné popis, fotografie, vybavenie a aspoň jedna sadzba",
                "Skontrolujte, či je uložený platný spôsob platby pre provízie",
                "Otvorte kartu „Portály“ a prečítajte si presné chybové hlásenie pri dotknutom portáli",
                "Odstráňte uvedený nedostatok a znova aktivujte viditeľnosť",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Chyba portálu sa vždy týka len tohto jedného portálu — ostatné kanály bežia nezávisle od toho ďalej, pokiaľ sú splnené ich vlastné požiadavky.",
            },
          ],
        },
      ],
    },
  ],
};
