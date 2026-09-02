import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerski program",
  description: "Preporučite objekte, izgradite tim i zaradite na prihodima od pretplate.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Kako funkcionira",
      articles: [
        {
          slug: "ueberblick",
          title: "Pregled partnerskog programa",
          excerpt: "Tko može sudjelovati, kako se generira provizija i što vidite.",
          updated: "Status: rujan 2026.",
          body: [
            {
              type: "p",
              text: "Kao partner, preporučujete myNextDays iznajmljivačima, agencijama i hotelima. Ako se objekt registrira s vašim kodom ili putem vaše veze i plati račune za pretplatu, dobivate udio u neto prihodu od pretplate tijekom dvanaest mjeseci. Razina prema broju kupaca koji plaćaju prikazana je uživo na stranici programa.",
            },
            { type: "h2", text: "Tko može postati partner" },
            {
              type: "ul",
              items: [
                "Osobe i tvrtke u EU, Švicarskoj ili Ujedinjenom Kraljevstvu s autentičnim kanalom prema domaćinima: influenceri, savjetnici, agencije, porezni uredi, udruge.",
                "Također i sami myNextDays korisnici — pretplata nije uvjet.",
                "Obavezno u prijavi: barem jedan račun na društvenim mrežama (Instagram, TikTok, YouTube, Facebook, LinkedIn…) s adresom, korisničkim imenom i dosegom. Web stranica ili newsletter su dobrodošli kao dodatak.",
              ],
            },
            { type: "h2", text: "Kako vam se dodjeljuje objekt" },
            {
              type: "steps",
              items: [
                "Dijelite svoju vezu (mynextdays.com/p/VAŠ-KOD) ili svoj kod.",
                "Objekt vidi kod prilikom registracije u polju „Preporučio” i potvrđuje ga slanjem — bez kolačića.",
                "S prvim plaćenim računom za pretplatu počinje dvanaestomjesečno razdoblje.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Svoje kupce vidite pseudonimno (Kupac #1, #2…) s državom, statusom i iznosima — nikada ime ili e-mail. Objekt se dodjeljuje točno jednom partneru; prvi pobjeđuje.",
            },
            { type: "h2", text: "Što ćete pronaći na nadzornoj ploči" },
            {
              type: "ul",
              items: [
                "Pregled: rang, klikovi, registrirani i plaćajući objekti, otvorene, isplative i isplaćene provizije.",
                "Provizije: svaki plaćeni račun za pretplatu kao redak s osnovom, stopom, iznosom i statusom.",
                "Isplate: mjesečno po valuti od minimalnog iznosa, s kreditnom notom (samofakturiranje) kao dokazom.",
                "Veze i materijali: vaši kodovi, promotivni materijali i obvezna oznaka po zemlji.",
                "Poruke: izravna veza s partnerskim timom.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Izgradnja tima: provizija za tim",
          excerpt: "Regrutirajte partnere koji se pridružuju s vašim kodom — i zaradite na prihodima njihovih kupaca.",
          updated: "Status: rujan 2026.",
          body: [
            {
              type: "p",
              text: "Možete dovesti druge partnere u svoj tim. Ako se netko prijavi putem vaše timske veze (mynextdays.com/p/VAŠ-KOD?team=1) i vidljivo unese vaš kod u prijavu, nakon odobrenja postaje dio vašeg tima. Dobivate timsku proviziju na neto prihod od pretplate kupaca vaših timskih partnera.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Stopa tima ovisi o VAŠEM rangu u trenutku plaćanja — ne o veličini vašeg tima. Stope su navedene na stranici programa.",
                "Vaš rang proizlazi samo iz vaših vlastitih kupaca koji plaćaju. Timski kupci se ne računaju za rang.",
                "Točno jedna razina: vaši timski partneri ne grade vlastiti tim ispod vas.",
                "Nema naknade za sudjelovanje, nema novca za regrutiranje partnera. Timski provizija proizlazi isključivo iz plaćenih prihoda od pretplate.",
                "Dvanaest mjeseci od prvog plaćenog računa dotičnog timskog kupca, 30-dnevni rok za povrat, povrat u slučaju povrata ili povrata sredstava — kao i kod vlastite provizije.",
                "Timski bonus nastaje samo ako ste vi i vaš timski partner odobreni; u suprotnom će biti zadržan.",
              ],
            },
            { type: "h2", text: "Evaluacija tima" },
            {
              type: "p",
              text: "Pod „Tim“ vidjet ćete svakog timskog partnera s rangom, klijentima koji plaćaju, prihodom od pretplate njihovih klijenata (30 dana i ukupno) i vašim timskim bonusom od toga — otvoreno, isplativo, isplaćeno — kao i povijest zadnjih dvanaest mjeseci. Detalje o klijentima vaših timskih partnera ne vidite; oni su njihovi.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Preko „Tima“ možete izravno kontaktirati svoje timske partnere porukom — a vaš sponzor vas.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ista domena e-pošte ili isti bankovni podaci između sponzora i timskog partnera bit će označeni i provjereni od strane partnerskog tima prije isplate timskog bonusa.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Isplata, kredit i porezi",
          excerpt: "Kada provizija postaje isplativa, kako izgleda kredit i što vrijedi porezno.",
          updated: "Status: rujan 2026.",
          body: [
            {
              type: "steps",
              items: [
                "Redak provizije nastaje s plaćenim računom za pretplatu i 30 dana je „otvoren“ (razdoblje povrata).",
                "Nakon toga je isplativ. Prvog u mjesecu objedinjujemo sve isplative retke po valuti.",
                "Ako je zbroj iznad minimalnog iznosa vaše valute, nastaje isplata s kreditom (samofakturiranje). Ne morate izdavati račun.",
                "Nakon prijenosa, isplata se prikazuje kao „Plaćeno“ s referencom na nadzornoj ploči.",
              ],
            },
            {
              type: "ul",
              items: [
                "Tvrtke: Kredit nosi oznaku obrnutog oporezivanja; preduvjet je potvrđeni PDV identifikacijski broj (VIES provjera).",
                "Privatne osobe: Kredit ne prikazuje PDV; provizija se mora samostalno oporezivati.",
                "Isplata putem SEPA-e, Wise-a ili PayPal-a — podatke unosite u profil; promjene zahtijevaju vašu lozinku.",
                "Nema konverzije: provizija u DKK isplaćuje se u DKK, provizija u EUR u EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Oglašavanje mora biti prepoznatljivo kao oglašavanje — na početku objave, na jeziku objave. Potvrđene formulacije po zemlji možete pronaći pod „Poveznice i materijali“. Kršenja mogu dovesti do blokade.",
            },
          ],
        },
      ],
    },
  ],
};
