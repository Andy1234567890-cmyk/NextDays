import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilna aplikacija",
  description: "Aplikacija myNextDays za na poti.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplikacija",
      articles: [
        {
          slug: "die-app",
          title: "Aplikacija myNextDays",
          excerpt: "En račun, štiri izkušnje: gost, agencija, lastnik in zaposleni.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Aplikacija myNextDays je mobilna platforma za celoten vaš obrat. Ni ločen izdelek, temveč enakovreden vmesnik do vaše spletne nadzorne plošče — oba dostopata do istega računa in istih podatkov, le vmesnik je optimiziran za uporabo na poti.",
            },
            { type: "h2", text: "Štiri izkušnje v eni aplikaciji" },
            {
              type: "ul",
              items: [
                "Gost: ogled rezervacij, komunikacija z obratom, priklic informacij za prijavo.",
                "Agencija: pregled in upravljanje več obratov in objektov.",
                "Lastnik: vpogled samo za branje v lastne objekte, zasedenost in poročila.",
                "Zaposleni: koledar, naloge in čistilni načrti za operativni vsakdanjik.",
              ],
            },
            { type: "h2", text: "Katero izkušnjo vidite" },
            {
              type: "p",
              text: "Po prijavi aplikacija samodejno prikaže ustrezno izkušnjo za vašo vlogo — isto vlogo, ki velja tudi v spletni nadzorni plošči. Zaposleni z omejenimi pravicami v aplikaciji vidi natanko iste omejitve kot v brskalniku, saj se pooblastilo preverja na strani strežnika.",
            },
            {
              type: "note",
              variant: "info",
              text: "Več o vlogah in kaj lahko posamezna vloga vidi, najdete pod [Vloge in pooblastila](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Za aplikacijo ne potrebujete ločene registracije — preprosto se prijavite z obstoječimi podatki za dostop do myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Namestitev aplikacije in prijava",
          excerpt: "Tako prenesete aplikacijo myNextDays in se prijavite.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Aplikacija myNextDays je na voljo za iOS in Android. Prijava poteka z istimi podatki za dostop kot v spletni nadzorni plošči — ločen račun ali ponovna registracija nista potrebna.",
            },
            { type: "h2", text: "Namestitev" },
            {
              type: "steps",
              items: [
                "Odprite App Store (iOS) ali Google Play (Android).",
                "Poiščite „myNextDays“.",
                "Namestite aplikacijo na svoj pametni telefon ali tablico.",
                "Po namestitvi odprite aplikacijo.",
              ],
            },
            { type: "h2", text: "Prijava" },
            {
              type: "steps",
              items: [
                "Tapnite „Prijava“.",
                "Vnesite svoj e-poštni naslov in geslo.",
                "Po potrebi potrdite poziv za dvofaktorsko avtentikacijo.",
                "Samodejno se znajdete v izkušnji, ki ustreza vaši vlogi.",
              ],
            },
            {
              type: "ul",
              items: [
                "Podatki za dostop so enaki kot v spletni nadzorni plošči.",
                "Če vam je dostop odvzet, je takoj zaprta tudi prijava v aplikaciji.",
                "Pri težavah z geslom uporabite „Pozabljeno geslo“ neposredno v aplikaciji.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prijavite se izključno prek uradnega vnosa „myNextDays“ v trgovini z aplikacijami; aplikacija nikoli ne zahteva podatkov za dostop zunaj prijavnega zaslona.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Upravljanje na poti",
          excerpt: "Rezervacije, sporočila in naloge urejajte neposredno s pametnega telefona.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Aplikacija myNextDays je še posebej primerna za tekoče poslovanje na poti: vidite trenutne rezervacije, odgovarjate na sporočila gostov in izvajate naloge, ne da bi morali sedeti za računalnikom — spremembe se v realnem času prikažejo tudi v spletni nadzorni plošči.",
            },
            { type: "h2", text: "Rezervacije na dosegu roke" },
            {
              type: "p",
              text: "V razdelku „Rezervacije“ vidite prihode in odhode, zasedenost in status po objektu. Zaposleni in osebje za čiščenje pri tem vidijo le zanje pomembne informacije, brez cen ali prodajnih podrobnosti.",
            },
            { type: "h2", text: "Sporočila in naloge" },
            {
              type: "steps",
              items: [
                "Odprite razdelek „Sporočila“, da neposredno odgovorite na povpraševanja gostov.",
                "Preklopite na „Naloge“, da vidite vam dodeljene opravke.",
                "Tapnite nalogo, da odprete podrobnosti in jo zaključite.",
                "Opravljene termine čiščenja neposredno na kraju samem označite kot zaključene.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nova sporočila in naloge se prikažejo v živo, brez ročnega posodabljanja.",
                "Zaključene naloge so takoj vidne tudi v spletni nadzorni plošči.",
                "Lastniki vidijo rezervacije in poročila svojih objektov, vendar izključno za branje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Potisna obvestila vas obveščajo o novih sporočilih in dodeljenih nalogah, takoj ko jih dovolite v nastavitvah naprave.",
            },
          ],
        },
      ],
    },
  ],
};
