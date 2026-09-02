import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerski program",
  description: "Priporočite podjetja, zgradite ekipo in zaslužite z naročninami.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Kako deluje",
      articles: [
        {
          slug: "ueberblick",
          title: "Pregled partnerskega programa",
          excerpt: "Kdo lahko sodeluje, kako se ustvarja provizija in kaj vidite.",
          updated: "Status: september 2026",
          body: [
            {
              type: "p",
              text: "Kot partner priporočate myNextDays najemodajalcem, agencijam in hotelom. Če se podjetje registrira z vašo kodo ali prek vaše povezave in plača račune za naročnino, boste dvanajst mesecev prejemali delež neto prihodkov od naročnin. Lestvica glede na število plačljivih strank je v živo na strani programa.",
            },
            { type: "h2", text: "Kdo lahko postane partner" },
            {
              type: "ul",
              items: [
                "Posamezniki in podjetja v EU, Švici ali Združenem kraljestvu z resničnim kanalom do gostiteljev: vplivneži, svetovalci, agencije, davčne pisarne, združenja.",
                "Tudi stranke myNextDays – naročnina ni pogoj.",
                "Obvezno pri prijavi: vsaj en račun za družabna omrežja (Instagram, TikTok, YouTube, Facebook, LinkedIn …) z naslovom, uporabniškim imenom in dosegom. Spletna stran ali glasilo sta dobrodošla.",
              ],
            },
            { type: "h2", text: "Kako vam je dodeljeno podjetje" },
            {
              type: "steps",
              items: [
                "Delite svojo povezavo (mynextdays.com/p/VAŠA-KODA) ali svojo kodo.",
                "Podjetje vidi kodo ob registraciji v polju »Priporočil/-a« in jo potrdi z oddajo – brez piškotka.",
                "Z prvim plačanim računom za naročnino se začne dvanajstmesečno obdobje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Svoje stranke vidite psevdonimno (stranka #1, #2 …) z državo, statusom in zneski – nikoli imena ali e-pošte. Podjetje je dodeljeno natanko enemu partnerju; prvi zmaga.",
            },
            { type: "h2", text: "Kaj najdete na nadzorni plošči" },
            {
              type: "ul",
              items: [
                "Pregled: uvrstitev, kliki, registrirana in plačljiva podjetja, odprte, izplačljive in izplačane provizije.",
                "Provizije: vsak plačan račun za naročnino kot vrstica z osnovo, stopnjo, zneskom in statusom.",
                "Izplačila: mesečno po valuti od minimalnega zneska, z dobropisom (samofakturiranje) kot dokazilom.",
                "Povezave in gradivo: vaše kode, promocijsko gradivo in obvezna oznaka za vsako državo.",
                "Sporočila: neposredna povezava do partnerske ekipe.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Zgradite ekipo: provizija za ekipo",
          excerpt: "Pridobite partnerje, ki se pridružijo z vašo kodo – in zaslužite z njihovimi strankami.",
          updated: "Status: september 2026",
          body: [
            {
              type: "p",
              text: "V svojo ekipo lahko povabite druge partnerje. Če se nekdo prijavi prek vaše ekipne povezave (mynextdays.com/p/VAŠA-KODA?team=1) in v prijavi jasno navede vašo kodo, bo po odobritvi del vaše ekipe. Za neto prihodke od naročnin strank vaših ekipnih partnerjev boste prejeli ekipno provizijo.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Stopnja ekipe je odvisna od VAŠE uvrstitve v času plačila – ne od velikosti vaše ekipe. Stopnje so navedene na strani programa.",
                "Vaša uvrstitev je ustvarjena samo iz vaših lastnih plačljivih strank. Stranke ekipe ne štejejo za uvrstitev.",
                "Natančno ena raven: vaši ekipni partnerji ne gradijo lastne ekipe pod vami.",
                "Brez pristojbine za sodelovanje, brez denarja za pridobivanje partnerja. Ekipna provizija nastane izključno iz plačanih prihodkov od naročnin.",
                "Dvanajst mesecev od prvega plačanega računa zadevne stranke ekipe, 30-dnevno okno za vračilo, preklic v primeru vračila ali stornacije – kot pri lastni proviziji.",
                "Provizija za ekipo nastane le, če ste vi in vaš ekipni partner odobreni; sicer bo zadržana.",
              ],
            },
            { type: "h2", text: "Analiza ekipe" },
            {
              type: "p",
              text: "Pod »Ekipa« vidite vsakega ekipnega partnerja z rangom, plačljivimi strankami, prihodki od naročnin njegovih strank (30 dni in skupno) in vašo ekipno provizijo od tega – odprto, izplačljivo, izplačano – ter zgodovino zadnjih dvanajstih mesecev. Podrobnosti o strankah vaših ekipnih partnerjev ne vidite; te pripadajo njim.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Preko »Ekipa« lahko neposredno kontaktirate svoje ekipne partnerje – in vaš sponzor vas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ista e-poštna domena ali ista bančna povezava med sponzorjem in ekipnim partnerjem bosta označeni in preverjeni s strani partnerske ekipe, preden bo izplačana provizija za ekipo.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Izplačilo, dobropis in davki",
          excerpt: "Kdaj provizija postane izplačljiva, kako izgleda dobropis in kaj velja davčno.",
          updated: "Stanje: september 2026",
          body: [
            {
              type: "steps",
              items: [
                "Vrstica provizije nastane s plačanim računom za naročnino in je 30 dni »odprta« (obdobje za vračilo).",
                "Nato je izplačljiva. Prvega v mesecu združimo vse izplačljive vrstice po valuti.",
                "Če je vsota nad minimalnim zneskom vaše valute, nastane izplačilo z dobropisom (samofakturiranje). Računa vam ni treba izdati.",
                "Po nakazilu je izplačilo v nadzorni plošči označeno kot »Plačano« z referenco.",
              ],
            },
            {
              type: "ul",
              items: [
                "Podjetja: Dobropis vsebuje opombo o obrnjeni davčni obveznosti; pogoj je potrjena ID številka za DDV (preverjanje VIES).",
                "Zasebniki: Dobropis ne vsebuje DDV; provizijo je treba samostojno obdavčiti.",
                "Izplačilo preko SEPA, Wise ali PayPal – podatke vnesete v profil; spremembe zahtevajo vaše geslo.",
                "Brez pretvorbe: Provizija v DKK se izplača v DKK, provizija v EUR v EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Oglaševanje mora biti prepoznavno kot oglaševanje – na začetku objave, v jeziku objave. Potrjene besedne zveze za posamezno državo najdete pod »Povezave in gradivo«. Kršitve lahko vodijo do blokade.",
            },
          ],
        },
      ],
    },
  ],
};
