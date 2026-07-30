import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Ekipa in pooblastila",
  description: "Zaposleni, vloge in pravice dostopa.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Dostop",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Povabilo zaposlenih",
          excerpt: "Tako povabite nove zaposlene v svoj račun myNextDays.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "V svoj obrat lahko povabite poljubno število zaposlenih — na primer za recepcijo, čiščenje ali upravo. Vsako povabilo je vezano na e-poštni naslov in takoj dodeli trdno vlogo, ki določa dostop v spletni različici in aplikaciji myNextDays.",
            },
            { type: "h2", text: "Pošiljanje povabila" },
            {
              type: "steps",
              items: [
                "Odprite „Konto“ in preklopite v razdelek „Ekipa“.",
                "Kliknite „Povabi zaposlenega“.",
                "Vnesite e-poštni naslov osebe.",
                "Izberite ustrezno vlogo, npr. zaposleni ali čiščenje.",
                "Potrdite povabilo.",
              ],
            },
            { type: "h2", text: "Kaj se zgodi nato" },
            {
              type: "p",
              text: "Povabljena oseba prejme e-pošto s povezavo za nastavitev lastnega gesla in prijavo. Prijava velja enako za spletno nadzorno ploščo in aplikacijo myNextDays — ločenega računa za posamezen vmesnik ni.",
            },
            {
              type: "ul",
              items: [
                "Povabilo velja, dokler ni sprejeto ali preklicano.",
                "Odprta povabila vidite v razdelku „Ekipa“ s statusom „V obdelavi“.",
                "Vlogo je mogoče kadar koli naknadno prilagoditi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Katera vloga sme videti katere razdelke, izveste pod [Vloge in pooblastila](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Od začetka dodelite najožjo ustrezno vlogo — pravice je mogoče kadar koli pozneje razširiti.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Vloge in pooblastila",
          excerpt: "Pet vlog v myNextDays in kaj lahko posamezna vloga počne.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "myNextDays razlikuje pet vlog: skrbnik, sozadolžen skrbnik, zaposleni, čiščenje in lastnik. Vsaka vloga določa, kateri razdelki so vidni v spletni nadzorni plošči in aplikaciji myNextDays — pravice se pri tem uveljavljajo na strani strežnika, ne le skrivajo v vmesniku.",
            },
            { type: "h2", text: "Pregled vlog" },
            {
              type: "ul",
              items: [
                "Skrbnik: poln dostop do vseh razdelkov, vključno s financami, prodajo in upravljanjem ekipe.",
                "Sozadolžen skrbnik: skoraj poln dostop kot skrbnik, za drugo raven vodenja obrata.",
                "Zaposleni: operativen dostop do rezervacij, koledarja in nalog, brez vpogleda v finance ali prodajo.",
                "Čiščenje: dostop izključno do dodeljenih nalog čiščenja in podrobnosti objekta, brez vpogleda v finance ali prodajo.",
                "Lastnik: vpogled samo za branje v lastne objekte, brez upravljanja tujih objektov.",
              ],
            },
            { type: "h2", text: "Dodelitev ali sprememba vloge" },
            {
              type: "steps",
              items: [
                "Odprite „Konto“ → „Ekipa“.",
                "S seznama izberite zadevnega zaposlenega.",
                "Kliknite „Spremeni vlogo“.",
                "Izberite novo vlogo in potrdite.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zaposleni in čiščenje načeloma ne vidijo cen, prometa ali rezervacijskih kanalov — ta izključitev velja na strani strežnika in je ni mogoče zaobiti prek vmesnika.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pregled po posamezni vlogi najdete pod [Kaj vidi katera vloga](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Kaj vidi katera vloga",
          excerpt: "Konkretni razdelki in pogledi po posamezni vlogi v spletni in mobilni različici.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Poleg osnovnih pravic iz [Vloge in pooblastila](/hilfe/team-rollen/rollen-berechtigungen) konkreten pregled posameznih razdelkov pomaga, da pri uvajanju novih zaposlenih postavite pravilna pričakovanja.",
            },
            { type: "h2", text: "Koledar in rezervacije" },
            {
              type: "p",
              text: "Skrbnik, sozadolžen skrbnik in zaposleni vidijo popoln koledar zasedenosti s podatki gostov in nalogami. Čiščenje vidi le zanj dodeljene termine skupaj z naslovom objekta in kontrolnim seznamom, vendar brez imen gostov ali cen. Lastniki vidijo koledar zasedenosti izključno za svoje lastne objekte, samo za branje.",
            },
            { type: "h2", text: "Finance in prodaja" },
            {
              type: "ul",
              items: [
                "Promet, provizije in računi: samo skrbnik in sozadolžen skrbnik.",
                "Portali (povezava OTA) in vidnost na platformi: samo skrbnik in sozadolžen skrbnik.",
                "Zaposleni in čiščenje: brez dostopa do finančnih ali prodajnih razdelkov, tudi ne do podrobnih strani.",
              ],
            },
            { type: "h2", text: "Ekipa in nastavitve" },
            {
              type: "p",
              text: "Upravljanje zaposlenih, vlog in nastavitev računa ostaja pridržano skrbniku in sozadolženemu skrbniku. Lastniki in operativne vloge tega razdelka v aplikaciji myNextDays in spletni nadzorni plošči sploh ne vidijo.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ta razdelitev velja enako v spletni nadzorni plošči in aplikaciji myNextDays, saj oba vmesnika poizvedujeta isto vlogo iz vašega računa.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nove vloge po povabilu na kratko preizkusite skupaj z zaposlenim, da se izognete nesporazumom o vidnih razdelkih.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Odvzem dostopa",
          excerpt: "Takojšen in popoln odvzem dostopa zaposlenemu.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Če zaposleni zapusti vaš obrat ali se sodelovanje spremeni, dostop odstranite neposredno v računu. Odvzem deluje na strani strežnika in takoj — ne šele po poteku obstoječe seje.",
            },
            { type: "h2", text: "Odstranitev dostopa" },
            {
              type: "steps",
              items: [
                "Odprite „Konto“ → „Ekipa“.",
                "Izberite zadevnega zaposlenega.",
                "Kliknite „Odvzemi dostop“.",
                "Potrdite postopek.",
              ],
            },
            { type: "h2", text: "Vpliv na tekoče seje" },
            {
              type: "p",
              text: "Po odvzemu se oseba ne more ponovno prijaviti ne v spletno nadzorno ploščo ne v aplikacijo myNextDays. Že dodeljene naloge ali termine čiščenja morate pred tem dodeliti drugemu zaposlenemu, da nič ne ostane neobdelano.",
            },
            {
              type: "ul",
              items: [
                "Odprte naloge pred odvzemom znova dodelite.",
                "Dostop je mogoče pozneje ponovno vzpostaviti s povabilom.",
                "Odvzem zadeva samo ta obrat, ne drugih računov te osebe.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dostop odvzemite pravočasno, takoj ko se sodelovanje konča — odprti računi zaposlenih sicer ostanejo nepotrebno varnostno tveganje.",
            },
          ],
        },
      ],
    },
  ],
};
