import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerystės programa",
  description: "Rekomenduokite įmones, suburkite komandą ir gaukite dalį pajamų iš prenumeratos.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Kaip tai veikia",
      articles: [
        {
          slug: "ueberblick",
          title: "Partnerystės programos apžvalga",
          excerpt: "Kas gali dalyvauti, kaip uždirbamas komisinis atlyginimas ir ką matote.",
          updated: "Būsena: 2026 m. rugsėjis",
          body: [
            {
              type: "p",
              text: "Kaip partneris, jūs rekomenduojate „myNextDays“ nuomotojams, agentūroms ir viešbučiams. Jei įmonė užsiregistruoja su jūsų kodu arba per jūsų nuorodą ir apmoka savo prenumeratos sąskaitas, jūs dvylika mėnesių gausite dalį grynųjų prenumeratos pajamų. Mokančių klientų lygis rodomas tiesiogiai programos puslapyje.",
            },
            { type: "h2", text: "Kas gali tapti partneriu" },
            {
              type: "ul",
              items: [
                "Asmenys ir įmonės ES, Šveicarijoje ar Jungtinėje Karalystėje, turintys realų kanalą į šeimininkus: nuomonės formuotojai, konsultantai, agentūros, mokesčių biurai, asociacijos.",
                "Taip pat patys „myNextDays“ klientai – prenumerata nėra būtina sąlyga.",
                "Privaloma paraiškoje: bent viena socialinės žiniasklaidos paskyra („Instagram“, „TikTok“, „YouTube“, „Facebook“, „LinkedIn“...) su adresu, vartotojo vardu ir pasiekiamumu. Svetainė ar naujienlaiškis yra papildomas privalumas.",
              ],
            },
            { type: "h2", text: "Kaip įmonė jums priskiriama" },
            {
              type: "steps",
              items: [
                "Jūs dalinatės savo nuoroda (mynextdays.com/p/JŪSŲ-KODAS) arba savo kodu.",
                "Įmonė registracijos metu mato kodą laukelyje „Rekomendavo“ ir patvirtina jį pateikdama – be slapuko.",
                "Su pirma apmokėta prenumeratos sąskaita prasideda dvylikos mėnesių laikotarpis.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jūs matote savo klientus pseudonimu (Klientas #1, #2...) su šalimi, būsena ir sumomis – niekada vardo ar el. pašto. Įmonė priskiriama tik vienam partneriui; pirmasis laimi.",
            },
            { type: "h2", text: "Ką rasite prietaisų skydelyje" },
            {
              type: "ul",
              items: [
                "Apžvalga: reitingas, paspaudimai, užregistruotos ir mokančios įmonės, atviras, išmokėtinas ir išmokėtas komisinis atlyginimas.",
                "Komisiniai: kiekviena apmokėta prenumeratos sąskaita kaip eilutė su pagrindu, tarifu, suma ir būsena.",
                "Išmokos: kas mėnesį kiekviena valiuta nuo minimalios sumos, su kredito nota (savisąskaita) kaip įrodymu.",
                "Nuorodos ir medžiaga: jūsų kodai, reklaminė medžiaga ir privalomas žymėjimas kiekvienai šaliai.",
                "Žinutės: tiesioginis ryšys su partnerių komanda.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Suburkite komandą: komandos komisinis atlyginimas",
          excerpt: "Pritraukite partnerius, kurie prisijungia su jūsų kodu – ir gaukite dalį pajamų iš jų klientų.",
          updated: "Būsena: 2026 m. rugsėjis",
          body: [
            {
              type: "p",
              text: "Galite įtraukti kitus partnerius į savo komandą. Jei kas nors kreipiasi per jūsų komandos nuorodą (mynextdays.com/p/JŪSŲ-KODAS?team=1) ir aiškiai nurodo jūsų kodą paraiškoje, jis po patvirtinimo priklauso jūsų komandai. Už grynųjų prenumeratos pajamų, gautų iš jūsų komandos partnerių klientų, gausite komandos komisinį atlyginimą.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Komandos tarifas priklauso nuo JŪSŲ reitingo mokėjimo metu – ne nuo jūsų komandos dydžio. Tarifai nurodyti programos puslapyje.",
                "Jūsų reitingas susidaro tik iš jūsų pačių mokančių klientų. Komandos klientai neįskaitomi į reitingą.",
                "Tik vienas lygis: jūsų komandos partneriai nesukuria savo komandos po jumis.",
                "Jokio dalyvio mokesčio, jokių pinigų už partnerio pritraukimą. Komandos komisinis atlyginimas gaunamas tik iš apmokėtų prenumeratos pajamų.",
                "Dvylika mėnesių nuo pirmos apmokėtos atitinkamo komandos kliento sąskaitos, 30 dienų grąžinimo langas, atšaukimas grąžinus arba atšaukus mokėjimą – kaip ir su jūsų pačių komisiniu atlyginimu.",
                "Komandinis atlygis mokamas tik tada, kai jūs ir jūsų komandos partneris yra patvirtinti; kitu atveju jis sustabdomas.",
              ],
            },
            { type: "h2", text: "Komandos įvertinimas" },
            {
              type: "p",
              text: "Skiltyje „Komanda“ matysite kiekvieną komandos partnerį su reitingu, mokančiais klientais, jų klientų prenumeratos pajamomis (30 dienų ir bendrai) ir jūsų komandos atlygiu iš to – atviru, išmokėtinu, išmokėtu – bei paskutinių dvylikos mėnesių istorija. Jūs nematote savo komandos partnerių klientų detalių; jos priklauso jiems.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Per „Komandą“ galite tiesiogiai susisiekti su savo komandos partneriais žinute – o jūsų rėmėjas su jumis.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Tas pats el. pašto domenas arba ta pati banko sąskaita tarp rėmėjo ir komandos partnerio bus pažymėti ir patikrinti partnerių komandos, prieš išmokant komandos atlygį.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Išmokėjimas, kreditas ir mokesčiai",
          excerpt: "Kada atlygis tampa išmokėtinas, kaip atrodo kreditas ir kokios yra mokesčių taisyklės.",
          updated: "Būsena: 2026 m. rugsėjis",
          body: [
            {
              type: "steps",
              items: [
                "Atlygio eilutė atsiranda su apmokėta prenumeratos sąskaita ir yra „atvira“ 30 dienų (grąžinimo laikotarpis).",
                "Po to ji tampa išmokėtina. Kiekvieno mėnesio pirmą dieną mes sugrupuojame visas išmokėtinas eilutes pagal valiutą.",
                "Jei suma viršija minimalią jūsų valiutos sumą, atliekamas išmokėjimas su kreditu (savarankiškas sąskaitų išrašymas). Jums nereikia išrašyti sąskaitos.",
                "Po pavedimo išmokėjimas bus rodomas kaip „Apmokėtas“ su nuoroda prietaisų skydelyje.",
              ],
            },
            {
              type: "ul",
              items: [
                "Įmonės: Kredite nurodomas atvirkštinio apmokestinimo įrašas; būtina patvirtinta PVM mokėtojo identifikavimo numeris (VIES patikra).",
                "Privatūs asmenys: Kredite nenurodomas PVM; atlygis apmokestinamas savarankiškai.",
                "Išmokėjimas per SEPA, Wise arba PayPal – duomenis įveskite profilyje; pakeitimams reikalingas jūsų slaptažodis.",
                "Jokio konvertavimo: DKK atlygis išmokamas DKK, EUR atlygis EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklama turi būti atpažįstama kaip reklama – įrašo pradžioje, įrašo kalba. Patvirtintus žodžius kiekvienai šaliai rasite skiltyje „Nuorodos ir medžiaga“. Pažeidimai gali sukelti blokavimą.",
            },
          ],
        },
      ],
    },
  ],
};
