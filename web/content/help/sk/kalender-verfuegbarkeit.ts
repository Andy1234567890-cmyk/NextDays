import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendár a dostupnosť",
  description: "Plán obsadenosti, Stop-Sell a minimálny pobyt.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendár",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Čítanie plánu obsadenosti",
          excerpt: "Ako správne čítať rezervácie, dostupnosť a ceny v pláne obsadenosti.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Plán obsadenosti vám na prvý pohľad ukáže, ktoré noci sú rezervované, dostupné alebo zablokované. Pri rekreačných objektoch vidíte jeden riadok na objekt, pri hoteloch vnorené zobrazenie s riadkom pre každú kategóriu izieb a cenový plán.",
            },
            { type: "h2", text: "Štruktúra zobrazenia" },
            {
              type: "steps",
              items: [
                "Otvorte kalendár cez položku menu „Plán obsadenosti“.",
                "Hore vyberte obdobie, ktoré chcete zobraziť.",
                "V prípade potreby filtrujte podľa jednotlivých objektov alebo kategórií izieb.",
                "Kliknutím na deň otvoríte podrobnosti o cene a dostupnosti.",
                "Kliknutím na obsadené obdobie otvoríte príslušnú rezerváciu.",
              ],
            },
            { type: "h2", text: "Farby a symboly" },
            {
              type: "ul",
              items: [
                "Obsadené: obdobie je rezervované na základe rezervácie.",
                "Dostupné: deň je možné rezervovať na všetkých aktívnych kanáloch.",
                "Zablokované: deň nie je rezervovateľný z dôvodu Stop-Sell alebo manuálneho blokovania.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Každý riadok v pláne obsadenosti predstavuje presne jednu rezervovateľnú jednotku — izbu alebo rekreačný objekt. Neexistuje žiadny riadok kontajnera pre viacero izieb súčasne.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Viac o cielenom otváraní a zatváraní jednotlivých dní nájdete v [Nastavenie dostupnosti](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Nastavenie dostupnosti",
          excerpt: "Cielené otváranie a zatváranie jednotlivých dní alebo období.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Dostupnosť určuje, či je objekt v konkrétny deň rezervovateľný. Jednotlivé dni alebo celé obdobia môžete otvoriť alebo zatvoriť priamo v pláne obsadenosti.",
            },
            { type: "h2", text: "Úprava obdobia" },
            {
              type: "steps",
              items: [
                "Otvorte plán obsadenosti požadovaného objektu.",
                "Označte požadované obdobie kliknutím a ťahaním.",
                "V menu akcií vyberte „Zmeniť dostupnosť“.",
                "Potvrďte, či sa má obdobie otvoriť, alebo zatvoriť.",
                "Uložte zmenu.",
              ],
            },
            { type: "h2", text: "Vplyv na kanály" },
            {
              type: "p",
              text: "Zmena dostupnosti ovplyvňuje všetky predajné kanály, na ktorých je objekt viditeľný: portály ako Booking, Airbnb a ďalšie, vlastnú platformu, ako aj aplikáciu. Prenos na portály prebieha automaticky na pozadí.",
            },
            {
              type: "ul",
              items: [
                "Otvorenie: deň sa stane rezervovateľným na všetkých aktívnych kanáloch.",
                "Zatvorenie: deň zmizne z možnosti rezervácie, ale zostáva viditeľný v kalendári.",
                "Zmena dostupnosti sa netýka už existujúcich rezervácií.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nezatvárajte obdobie so zámerom úplne a trvalo ho zablokovať pre predaj — na to slúži funkcia Stop-Sell, pozri [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell okamžite zablokuje deň na všetkých predajných kanáloch súčasne.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell je najrýchlejší spôsob, ako úplne vyradiť jeden deň z predaja. Na rozdiel od bežnej zmeny dostupnosti pôsobí Stop-Sell tvrdo a okamžite na všetkých kanáloch súčasne — na portáloch, vlastnej platforme i v aplikácii.",
            },
            { type: "h2", text: "Nastavenie Stop-Sell" },
            {
              type: "steps",
              items: [
                "Otvorte plán obsadenosti príslušného objektu.",
                "Vyberte požadovaný deň alebo obdobie.",
                "V menu akcií kliknite na „Aktivovať Stop-Sell“.",
                "Potvrďte blokovanie.",
              ],
            },
            { type: "h2", text: "Kedy je Stop-Sell vhodný" },
            {
              type: "ul",
              items: [
                "Krátkodobé údržbové práce alebo technické problémy v objekte.",
                "Osobitný prípad, kedy okamžite a bez výnimky nechcete žiadnu novú rezerváciu.",
                "Rýchle núdzové zablokovanie naprieč platformou, bez potreby upravovať každý kanál zvlášť.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell nepozná žiadnu kanálovo špecifickú výnimku: ak je deň zablokovaný, žiadny hosť nemôže rezervovať cez žiadny kanál, ani cez recepciu, ani priamou žiadosťou.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pre trvalé vlastné využívanie alebo plánovanú údržbu je vhodné namiesto toho [Manuálne blokovanie](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimálny a maximálny pobyt",
          excerpt: "Ako dlho môžu hostia minimálne alebo maximálne rezervovať.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Pomocou minimálneho a maximálneho pobytu určíte, koľko nocí môže hosť pre daný deň príchodu minimálne alebo maximálne rezervovať. Pomáha to zabrániť krátkym rezerváciám v medzerách alebo cielene pozicionovať váš objekt pre dlhšie pobyty.",
            },
            { type: "h2", text: "Nastavenie pravidla" },
            {
              type: "steps",
              items: [
                "V objekte otvorte plán obsadenosti alebo kartu „Ceny“.",
                "Vyberte príslušné obdobie.",
                "V položke „Minimálny pobyt“ zadajte minimálny počet nocí.",
                "Voliteľne v položke „Maximálny pobyt“ zadajte maximálny počet nocí.",
                "Uložte pravidlo.",
              ],
            },
            { type: "h2", text: "Typické prípady použitia" },
            {
              type: "ul",
              items: [
                "Hlavná sezóna: vyšší minimálny pobyt na zoskupenie výmenných dní.",
                "Mimosezóna: nižší minimálny pobyt na umožnenie väčšieho počtu rezervácií.",
                "Maximálny pobyt: vhodný, ak musí byť objekt následne voľný pre údržbu alebo iné využitie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pravidlo platí pre deň príchodu: hosť nemôže prísť v deň s minimálnym pobytom troch nocí len na dve noci, aj keď sú jednotlivé dni dostupné.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinujte dlhšie minimálne pobyty so [Zľavy za dĺžku pobytu](/hilfe/preise-raten/aufenthaltsrabatte), aby ste zvýšili motiváciu pre hostí.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manuálne blokovanie",
          excerpt: "Cielené vyhradenie období pre vlastné využívanie alebo údržbu.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Manuálne blokovanie vyhradí obdobie v kalendári bez toho, aby existovala reálna rezervácia hosťa — napríklad pre vlastné využívanie, plánované údržbové práce alebo renovácie. Obdobie sa v pláne obsadenosti zobrazuje ako rezervácia, ale je jasne rozpoznateľné ako blokovanie.",
            },
            { type: "h2", text: "Vytvorenie blokovania" },
            {
              type: "steps",
              items: [
                "Otvorte plán obsadenosti príslušného objektu.",
                "Označte požadované obdobie.",
                "V menu akcií vyberte „Manuálne zablokovať“.",
                "Zadajte dôvod, napr. „Vlastné využívanie“ alebo „Údržba“.",
                "Uložte blokovanie.",
              ],
            },
            { type: "h2", text: "Rozdiel oproti Stop-Sell" },
            {
              type: "p",
              text: "Manuálne blokovanie konkrétne vyhradí obdobie pre určitý, zdokumentovaný účel a neskôr sa dá opäť uvoľniť. Pre okamžité núdzové zablokovanie naprieč platformou bez zdokumentovaného obdobia je namiesto toho určený Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Manuálne blokovanie: plánované, s dôvodom, pre vlastné využívanie alebo údržbu.",
                "Uvoľnenie je možné kedykoľvek, hneď ako obdobie už nie je potrebné.",
                "Zablokované noci sa nepočítajú ako rezervácia hosťa a neobjavujú sa v prehľade tržieb.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vymažte manuálne blokovanie hneď, ako dôvod pominie — inak zostáva objekt na všetkých kanáloch zbytočne zablokovaný.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pre okamžité zablokovanie bez plánovaného obdobia použite [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
