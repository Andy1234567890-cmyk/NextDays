import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portály a kanálový manažér",
  description: "Centrálna správa Booking, Airbnb, Expedia a ďalších.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Prepojenie portálov",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Čo je kanálový manažér?",
          excerpt:
            "Kanálový manažér automaticky zosúlaďuje ceny, dostupnosť a rezervácie medzi myNextDays a portálmi.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Jedno prepojenie pre všetky portály" },
            {
              type: "p",
              text: "Kanálový manažér je mostom medzi myNextDays a veľkými rezervačnými portálmi ako Booking, Airbnb a ďalšie. Namiesto toho, aby ste v každom portáli zvlášť spravovali ceny, dostupnosť a obsadenosť, zadáte všetko raz do myNextDays — kanálový manažér to automaticky rozdelí na všetky prepojené portály.",
            },
            { type: "h2", text: "Čo sa synchronizuje automaticky" },
            {
              type: "ul",
              items: [
                "Dostupnosť — každá rezervácia okamžite zablokuje noc na všetkých portáloch",
                "Ceny a minimálne pobyty z vášho cenového kalendára",
                "Prichádzajúce rezervácie z portálov sa automaticky importujú do myNextDays",
                "Storná a Stop-Sell pôsobia naprieč kanálmi",
              ],
            },
            { type: "h2", text: "Čo už nemusíte robiť manuálne" },
            {
              type: "p",
              text: "Bez kanálového manažéra by ste po každej rezervácii museli ručne zablokovať noc v každom portáli — častá príčina dvojitých rezervácií. S aktívnym kanálovým manažérom preberá myNextDays tento zosúladenie v oboch smeroch, viackrát denne a v reálnom čase pri nových rezerváciách.",
            },
            {
              type: "note",
              variant: "info",
              text: "Prepojenie s portálmi sa nastavuje jedenkrát pre celé konto. Pre každý jednotlivý objekt následne aktivujete už len mapovanie — viac o tom v [Priradenie objektu portálu](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Nastavenie prepojenia s portálmi",
          excerpt:
            "Prepojenie s portálmi nastavíte jedenkrát pre celé konto — nie znova pre každý objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Jedenkrát pre celé konto" },
            {
              type: "p",
              text: "Pripojenie k portálom je nastavenie platné pre celé konto: svoje konto myNextDays prepojíte s kanálovým manažérom presne raz. Všetky objekty, ktoré neskôr vytvoríte, automaticky využívajú toto jedno prepojenie — nemusíte ho budovať znova pre každý objekt.",
            },
            { type: "h2", text: "Ako nastaviť prepojenie" },
            {
              type: "steps",
              items: [
                "Otvorte /konto a vyberte sekciu „Portály a kanálový manažér“",
                "Kliknite na „Nastaviť prepojenie“ a potvrďte údaje o svojej prevádzke (adresa, kontakt, právna forma)",
                "Skontrolujte automaticky prevzaté základné údaje — odosielajú sa na všetky portály",
                "Dokončite nastavenie; status sa zmení na „Pripojené“",
              ],
            },
            { type: "h2", text: "Ďalší krok: priradenie objektov" },
            {
              type: "p",
              text: "Po jednorazovom nastavení ešte nie je viditeľný žiadny objekt — na to priradíte každý objekt jednotlivo portálu (mapovanie) a prepojíte požadované portály ako Booking.com alebo Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez úplných základných údajov (adresa, daňové informácie, kontakt) portály prepojenie odmietnu. Tieto údaje skontrolujte najprv v sekcii /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Priradenie objektu portálu",
          excerpt:
            "Po prepojení platnom pre celé konto aktivujete pre jednotlivý objekt už len mapovanie k danému portálu.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Mapovanie namiesto nového prepojenia" },
            {
              type: "p",
              text: "Ak je prepojenie s portálom raz nastavené pre celé konto, každý objekt prepojíte už len prostredníctvom takzvaného mapovania: určíte, ktorý objekt myNextDays zodpovedá ktorému typu izby, resp. ponuky v portáli. Ide o jednorazový krok pre jednotlivý objekt.",
            },
            { type: "h2", text: "Ako priradiť objekt" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii /objekte a prepnite na kartu „Portály“",
                "Vyberte požadovaný portál, napríklad Booking.com alebo Airbnb",
                "Priraďte objekt k zodpovedajúcemu typu izby, resp. ponuky v portáli",
                "Aktivujte synchronizáciu — ceny a dostupnosť sa odteraz prenášajú",
              ],
            },
            { type: "h2", text: "Jeden objekt, viacero portálov" },
            {
              type: "p",
              text: "Jednotlivý objekt môže byť súčasne priradený k viacerým portálom. Každé priradenie je nezávislé — objekt môžete napríklad zviditeľniť na Booking.com a Airbnb, ale na Expedii ho zatiaľ nechať deaktivovaný.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po mapovaní hneď skontrolujte viditeľnosť — pozri [Viditeľnosť podľa portálu](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Prepojenie s Booking.com",
          excerpt: "Ako aktivujete Booking.com ako predajný kanál pre objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Predpoklad: prepojenie platné pre celé konto" },
            {
              type: "p",
              text: "Pred aktiváciou Booking.com pre objekt musí byť nastavené prepojenie s portálom platné pre celé konto (pozri [Nastavenie prepojenia s portálmi](/hilfe/portale-kanalmanager/portal-verbindung)). Potom je Booking.com pre každý ďalší objekt už len otázkou mapovania.",
            },
            { type: "h2", text: "Aktivácia Booking.com" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii /objekte, karta „Portály“",
                "Zo zoznamu dostupných portálov vyberte „Booking.com“",
                "Priraďte zodpovedajúci typ izby, resp. ponuky a potvrďte cenové plány",
                "Aktivujte viditeľnosť — objekt bude po kontrole zo strany Booking.com uvedený do prevádzky",
              ],
            },
            { type: "h2", text: "Čo od vás Booking.com očakáva" },
            {
              type: "ul",
              items: [
                "Úplný popis objektu, obrázky a vybavenie",
                "Minimálne jedna sadzba s cenou a storno podmienkami",
                "Platný spôsob platby pre provízie",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Uvedenie do prevádzky zo strany Booking.com môže trvať niekoľko hodín. Status v karte objektu „Portály“ ukazuje, či je prepojenie už aktívne.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Prepojenie s Airbnb",
          excerpt: "Ako urobíte objekt rezervovateľným na Airbnb cez kanálového manažéra.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Airbnb ako ďalší portál" },
            {
              type: "p",
              text: "Airbnb sa pripája ako každý iný portál cez prepojenie platné pre celé konto. Ak je to nastavené, aktivujete Airbnb pre jednotlivý objekt cez mapovanie — bez ohľadu na to, či je objekt už viditeľný na Booking.com alebo iných portáloch.",
            },
            { type: "h2", text: "Aktivácia Airbnb pre objekt" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii /objekte, karta „Portály“",
                "Zo zoznamu dostupných portálov vyberte „Airbnb“",
                "Potvrďte kategóriu objektu a priradený typ ponuky",
                "Skontrolujte fotografie, vybavenie a domáci poriadok — Airbnb pred aktiváciou vyžaduje úplné údaje",
                "Aktivujte viditeľnosť pre Airbnb",
              ],
            },
            { type: "h2", text: "Po aktivácii" },
            {
              type: "p",
              text: "Akonáhle Airbnb objekt schváli, ceny a dostupnosť bežia automaticky cez kanálového manažéra. Rezervácie, ktoré prídu na Airbnb, sa následne automaticky objavia vo vašom kalendári rezervácií.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uložených storno podmienok a domáceho poriadku Airbnb aktiváciu odmietne. Tieto údaje najprv doplňte v objekte.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synchronizácia cien a dostupnosti",
          excerpt:
            "Ceny a dostupnosť sa automaticky prenášajú na všetky prepojené portály.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Jeden kalendár, všetky portály" },
            {
              type: "p",
              text: "Ceny a dostupnosť spravujete výhradne v kalendári myNextDays príslušného objektu. Kanálový manažér automaticky prenáša každú zmenu na všetky portály, pre ktoré je objekt aktívne namapovaný — bez toho, aby ste čokoľvek zadávali duplicitne.",
            },
            { type: "h2", text: "Čo sa prenáša" },
            {
              type: "ul",
              items: [
                "Denné ceny z vášho cenového kalendára, resp. cenových plánov",
                "Dostupné noci a blokovania",
                "Minimálny pobyt a obmedzenia príchodu/odchodu",
                "Dni so Stop-Sell — tie sa automaticky zablokujú na všetkých portáloch",
              ],
            },
            { type: "h2", text: "Ako rýchlo synchronizácia funguje" },
            {
              type: "p",
              text: "Zmeny cien a dostupnosti sa na portály odošlú v priebehu niekoľkých minút. Nové rezervácie okamžite zablokujú dotknuté noci, aby sa na žiadnom inom kanáli nedala tá istá noc predať znova.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Viac o blokovaní jednotlivých dní naprieč kanálmi nájdete v [Predchádzanie nadmerným rezerváciám](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Prijímanie rezervácií z portálov",
          excerpt: "Rezervácie z Booking, Airbnb a ďalších sa automaticky objavia vo vašom kalendári.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Automatický import" },
            {
              type: "p",
              text: "Ak hosť rezervuje cez portál ako Booking.com alebo Airbnb, kanálový manažér automaticky importuje rezerváciu do myNextDays. Nič nemusíte manuálne prenášať — rezervácia sa objaví v kalendári a v zozname rezervácií príslušného objektu.",
            },
            { type: "h2", text: "Čo sa deje pri rezervácii z portálu" },
            {
              type: "steps",
              items: [
                "Portál nahlási novú rezerváciu kanálovému manažérovi",
                "myNextDays vytvorí rezerváciu s údajmi hosťa, obdobím a cenou",
                "Rezervované noci sa okamžite zablokujú na všetkých ostatných kanáloch",
                "Dostanete upozornenie a rezerváciu nájdete v kalendári",
              ],
            },
            { type: "h2", text: "Storná a zmeny" },
            {
              type: "p",
              text: "Ak hosť zruší rezerváciu cez portál alebo zmení obdobie, prenesie sa to automaticky aj do myNextDays a dotknuté noci sa opäť uvoľnia.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezervácie z portálov spoznáte v podrobnostiach rezervácie podľa štítku pôvodu, napríklad Booking.com alebo Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Predchádzanie nadmerným rezerváciám",
          excerpt: "Stop-Sell a automatické blokovania zabraňujú dvojitým rezerváciám naprieč viacerými portálmi.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Prečo vznikajú nadmerné rezervácie" },
            {
              type: "p",
              text: "Bez centrálneho riadenia sa ľahko stane, že tá istá noc sa predá súčasne na dvoch portáloch — napríklad ak sa ceny a dostupnosť spravujú manuálne vo viacerých systémoch. Kanálový manažér túto medzeru uzatvára tým, že každá rezervácia na ktoromkoľvek kanáli okamžite zablokuje všetky ostatné kanály.",
            },
            { type: "h2", text: "Vaše nástroje proti nadmerným rezerváciám" },
            {
              type: "ul",
              items: [
                "Automatické blokovanie: každá nová rezervácia — bez ohľadu na kanál — zablokuje noci všade",
                "Stop-Sell: manuálne zablokuje deň na všetkých kanáloch súčasne, napríklad pre vlastné využívanie alebo údržbu",
                "Minimálny pobyt a obmedzenia príchodu zabraňujú nevhodným krátkym rezerváciám",
              ],
            },
            { type: "h2", text: "Nastavenie Stop-Sell" },
            {
              type: "steps",
              items: [
                "Otvorte kalendár obsadenosti objektu",
                "Označte dotknutý deň alebo obdobie",
                "Vyberte „Stop-Sell“ — deň je potom zablokovaný na všetkých portáloch, ako aj na webovej stránke a platforme",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell platí bezvýnimočne pre všetky kanály. Neexistuje možnosť zablokovať deň len pre jeden portál a pre ostatné ho nechať otvorený.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Viditeľnosť podľa portálu",
          excerpt: "Každý portál možno zapnúť alebo vypnúť nezávisle od webovej stránky a trhoviska platformy.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Tri nezávislé predajné cesty" },
            {
              type: "p",
              text: "Objekt možno predávať súčasne viacerými spôsobmi: cez portály (Booking, Airbnb a ďalšie), cez trhovisko platformy myNextDays a cez vašu vlastnú webovú stránku. Každá cesta má vlastný prepínač viditeľnosti — sú navzájom úplne nezávislé.",
            },
            { type: "h2", text: "Riadenie viditeľnosti podľa portálu" },
            {
              type: "p",
              text: "V rámci portálov je navyše samostatne prepínateľný každý jednotlivý portál. Objekt môže byť napríklad aktívny na Booking.com, ale deaktivovaný na Airbnb — obe priradenia zostávajú tým nedotknuté.",
            },
            { type: "h2", text: "Ako zmeniť viditeľnosť" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii /objekte, karta „Portály“",
                "Jednotlivo zapnite alebo vypnite požadovaný kanál (jednotlivý portál, webová stránka alebo trhovisko platformy)",
                "Uložte — zmena sa prejaví v priebehu niekoľkých minút",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Status objektu (aktívny/neaktívny), ako aj Stop-Sell, pôsobia nadradene na všetky kanály. Prepínače viditeľnosti riadia len to, na ktorých ďalších kanáloch sa už aktívny objekt zobrazuje.",
            },
          ],
        },
      ],
    },
  ],
};
