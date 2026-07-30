import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Koledar in razpoložljivost",
  description: "Koledar zasedenosti, Stop-Sell in minimalno bivanje.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Koledar",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Branje koledarja zasedenosti",
          excerpt: "Tako pravilno berete rezervacije, razpoložljivost in cene v koledarju zasedenosti.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Koledar zasedenosti vam na prvi pogled pokaže, katere noči so rezervirane, razpoložljive ali zaprte. Pri počitniških objektih vidite eno vrstico na objekt, pri hotelih pa vgnezden prikaz z eno vrstico na kategorijo sobe in cenovni načrt.",
            },
            { type: "h2", text: "Zgradba prikaza" },
            {
              type: "steps",
              items: [
                "Odprite koledar prek menijske postavke „Koledar zasedenosti“.",
                "Zgoraj izberite obdobje, ki ga želite pregledati.",
                "Po potrebi filtrirajte po posameznih objektih ali kategorijah sob.",
                "Kliknite na dan, da odprete podrobnosti o ceni in razpoložljivosti.",
                "Kliknite na zasedeno obdobje, da odprete pripadajočo rezervacijo.",
              ],
            },
            { type: "h2", text: "Barve in simboli" },
            {
              type: "ul",
              items: [
                "Zasedeno: obdobje je rezervirano z rezervacijo.",
                "Razpoložljivo: dan je mogoče rezervirati na vseh aktivnih kanalih.",
                "Zaprto: dan ni rezervljiv zaradi Stop-Sell ali ročne zapore.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vsaka vrstica v koledarju zasedenosti predstavlja natanko eno rezervljivo enoto — sobo ali počitniški objekt. Skupinske vrstice za več sob hkrati ni.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Več o ciljnem odpiranju in zapiranju posameznih dni najdete pod [Nastavitev razpoložljivosti](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Nastavitev razpoložljivosti",
          excerpt: "Ciljno odpiranje in zapiranje posameznih dni ali obdobij.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Razpoložljivost določa, ali je objekt na določen dan mogoče rezervirati. Posamezne dni ali celotna obdobja lahko odprete ali zaprete neposredno v koledarju zasedenosti.",
            },
            { type: "h2", text: "Urejanje obdobja" },
            {
              type: "steps",
              items: [
                "Odprite koledar zasedenosti želenega objekta.",
                "Označite želeno obdobje s klikom in vlečenjem.",
                "V akcijskem meniju izberite „Spremeni razpoložljivost“.",
                "Potrdite, ali naj bo obdobje odprto ali zaprto.",
                "Shranite spremembo.",
              ],
            },
            { type: "h2", text: "Vpliv na kanale" },
            {
              type: "p",
              text: "Sprememba razpoložljivosti vpliva na vse prodajne kanale, na katerih je objekt viden: portale, kot so Booking, Airbnb in drugi, lastno platformo ter aplikacijo. Prenos na portale poteka samodejno v ozadju.",
            },
            {
              type: "ul",
              items: [
                "Odpiranje: dan postane rezervljiv na vseh aktivnih kanalih.",
                "Zapiranje: dan izgine iz rezervljivosti, v koledarju pa ostane viden.",
                "Že obstoječih rezervacij sprememba razpoložljivosti ne prizadene.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Obdobja ne zapirajte z namenom, da bi ga popolnoma in trajno zaprli za prodajo — za to je pravilna funkcija Stop-Sell, glejte [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell takoj zapre dan hkrati na vseh prodajnih kanalih.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell je najhitrejši način, da posamezen dan popolnoma umaknete iz prodaje. Za razliko od navadne spremembe razpoložljivosti Stop-Sell deluje strogo in takoj na vseh kanalih hkrati — na portalih, lastni platformi in v aplikaciji.",
            },
            { type: "h2", text: "Nastavitev Stop-Sell" },
            {
              type: "steps",
              items: [
                "Odprite koledar zasedenosti zadevnega objekta.",
                "Izberite želeni dan ali obdobje.",
                "V akcijskem meniju kliknite „Aktiviraj Stop-Sell“.",
                "Potrdite zaporo.",
              ],
            },
            { type: "h2", text: "Kdaj je Stop-Sell smiseln" },
            {
              type: "ul",
              items: [
                "Kratkoročna vzdrževalna dela ali tehnične težave v objektu.",
                "Poseben primer, ko takoj in brez izjeme ne želite nove rezervacije.",
                "Hitra zapora na ravni celotne platforme brez urejanja vsakega kanala posebej.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell ne pozna kanalsko specifičnih izjem: če je dan zaprt, noben gost ne more rezervirati prek nobenega kanala, tudi ne prek recepcije ali neposrednega povpraševanja.",
            },
            {
              type: "note",
              variant: "info",
              text: "Za trajno lastno uporabo ali načrtovano vzdrževanje je namesto tega primerna [Ročna zapora](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Najkrajše in najdaljše bivanje",
          excerpt: "Koliko časa najmanj ali največ smejo gostje rezervirati.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Z najkrajšim in najdaljšim bivanjem določite, koliko noči lahko gost za določen dan prihoda najmanj oz. največ rezervira. To pomaga preprečiti kratke vmesne rezervacije ali ciljno pozicionirati objekt za daljša bivanja.",
            },
            { type: "h2", text: "Nastavitev pravila" },
            {
              type: "steps",
              items: [
                "Pri objektu odprite koledar zasedenosti ali zavihek „Cene“.",
                "Izberite zadevno obdobje.",
                "Pod „Najkrajše bivanje“ vnesite minimalno število noči.",
                "Po želji pod „Najdaljše bivanje“ vnesite največje število noči.",
                "Shranite pravilo.",
              ],
            },
            { type: "h2", text: "Tipični primeri uporabe" },
            {
              type: "ul",
              items: [
                "Visoka sezona: daljše najkrajše bivanje, da se dnevi menjav združijo.",
                "Nizka sezona: krajše najkrajše bivanje, da je mogoče več rezervacij.",
                "Najdaljše bivanje: smiselno, kadar mora biti objekt nato prost za vzdrževanje ali drugo uporabo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pravilo velja za dan prihoda: gost na dan z najkrajšim bivanjem treh noči ne more prispeti za samo dve noči, tudi če so posamezni dnevi razpoložljivi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Daljša najkrajša bivanja kombinirajte s [Popusti za dolžino bivanja](/hilfe/preise-raten/aufenthaltsrabatte), da povečate spodbudo za goste.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Ročna zapora",
          excerpt: "Ciljna rezervacija obdobij za lastno uporabo ali vzdrževanje.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Ročna zapora rezervira obdobje v koledarju, ne da bi obstajala dejanska rezervacija gosta — na primer za lastno uporabo, načrtovana vzdrževalna dela ali prenovo. Obdobje je v koledarju zasedenosti prikazano podobno kot rezervacija, vendar jasno prepoznavno kot zapora.",
            },
            { type: "h2", text: "Ustvarjanje zapore" },
            {
              type: "steps",
              items: [
                "Odprite koledar zasedenosti zadevnega objekta.",
                "Označite želeno obdobje.",
                "V akcijskem meniju izberite „Ročno zapri“.",
                "Navedite razlog, npr. „lastna uporaba“ ali „vzdrževanje“.",
                "Shranite zaporo.",
              ],
            },
            { type: "h2", text: "Razlika glede na Stop-Sell" },
            {
              type: "p",
              text: "Ročna zapora konkretno rezervira obdobje za določen, dokumentiran namen in jo je mogoče pozneje ponovno sprostiti. Za takojšnjo zaporo na ravni celotne platforme brez dokumentiranega obdobja je namesto tega namenjen Stop-Sell.",
            },
            {
              type: "ul",
              items: [
                "Ročna zapora: načrtovana, z razlogom, za lastno uporabo ali vzdrževanje.",
                "Sprostitev je mogoča kadar koli, ko obdobje ni več potrebno.",
                "Zaprte noči ne štejejo kot rezervacija gosta in se ne pojavijo v pregledu prihodkov.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ročno zaporo izbrišite takoj, ko razlog odpade — sicer objekt na vseh kanalih ostane po nepotrebnem zaprt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Za takojšnjo zaporo brez načrtovanega obdobja uporabite [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
