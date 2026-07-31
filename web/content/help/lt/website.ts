import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Svetainių kūrimo įrankis",
  description: "Sukurti nuosavą rezervacijų svetainę naudojant kūrimo įrankį.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Svetainių kūrimo įrankis",
      articles: [
        {
          slug: "website-erstellen",
          title: "Svetainės kūrimas",
          excerpt: "Naudodami kūrimo įrankį per kelias minutes sukursite nuosavą rezervacijų svetainę.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Svetainių kūrimo įrankis sukuria jums nuosavą rezervacijų svetainę — papildomą pardavimo kanalą šalia portalų ir myBestDays prekyvietės. Jūs išlaikote visišką struktūros, turinio ir prekės ženklo kontrolę.",
            },
            { type: "h2", text: "Kaip sukurti svetainę" },
            {
              type: "steps",
              items: [
                "Meniu atidarykite Svetainė.",
                "Spustelėkite Sukurti svetainę.",
                "Pasirinkite šabloną kaip pradinį tašką savo maketui.",
                "Patvirtinkite paspausdami Sukurti svetainę — atsidursite tiesiai redaktoriuje.",
              ],
            },
            { type: "h2", text: "Ką apima kūrimo įrankis" },
            {
              type: "ul",
              items: [
                "Vizualų redaktorių su puslapiais, sluoksniais ir peržiūros vaizdu",
                "Paruoštus elementus objektų sąrašams, galerijoms ir kontaktinėms formoms",
                "Tiesioginę rezervacijos eigą, pagrįstą jūsų kalendoriaus prieinamumu",
                "Pritaikomas spalvas, šriftus ir logotipą, atitinkančius jūsų prekės ženklą",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pradėkite nuo šablono, artimo jūsų objekto tipui — poilsio objektui ar viešbučiui — tai vėliau sutaupys jums laiko koreguojant elementus.",
            },
            { type: "h2", text: "Kiti žingsniai" },
            {
              type: "p",
              text: "Po sukūrimo pakoreguokite puslapius ir maketą, žr. [Puslapių ir maketo redagavimas](/hilfe/website/seiten-layout), ir rodykite savo objektus svetainėje, žr. [Objektų rodymas svetainėje](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Puslapių ir maketo redagavimas",
          excerpt: "Koreguoti puslapius, sluoksnius ir elementus vizualiame redaktoriuje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Redaktorius suskirstytas į tris sritis: kairėje — puslapių ir sluoksnių apžvalga, viduryje — jūsų svetainės peržiūra, dešinėje — pasirinkto elemento nustatymai.",
            },
            { type: "h2", text: "Puslapio redagavimas" },
            {
              type: "steps",
              items: [
                "Kairėje, skiltyje Puslapiai, pasirinkite norimą puslapį.",
                "Peržiūroje spustelėkite elementą, norėdami jį pasirinkti.",
                "Dešinėje pakoreguokite elemento tekstą, vaizdą ar tarpus.",
                "Tempkite elementus pele, norėdami pakeisti jų tvarką.",
              ],
            },
            { type: "h2", text: "Naujų puslapių ir elementų pridėjimas" },
            {
              type: "p",
              text: "Per mygtuką Pridėti puslapį sukuriate papildomus antrinius puslapius, pavyzdžiui, Apie mus ar Kontaktai. Puslapio viduje per Pridėti elementą įterpiate naujas sekcijas, pavyzdžiui, galeriją, vertinimus ar kontaktinę formą.",
            },
            {
              type: "ul",
              items: [
                "Pradžios puslapis, objektų apžvalga ir kontaktai iš anksto yra kiekviename šablone",
                "Papildomus puslapius galima laisvai pavadinti ir įtraukti į navigaciją",
                "Elementai yra pritaikomi ir prisitaiko prie kompiuterio, planšetės ir išmaniojo telefono ekranų",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Redaktoriuje atlikti pakeitimai iš pradžių yra tik juodraštis. Tik paspaudus Publikuoti jie perkeliami į jūsų viešą svetainę.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domeno prijungimas",
          excerpt: "Susieti nuosavą domeną su jūsų myNextDays svetaine.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Numatytuoju atveju jūsų svetainė pasiekiama per myNextDays subdomeną. Jei vietoj to norite naudoti nuosavą domeną, pavyzdžiui, jusu-imone.lt, prijunkite jį skyriuje Domenas.",
            },
            { type: "h2", text: "Domeno nurodymas" },
            {
              type: "steps",
              items: [
                "Svetainėje atidarykite Nustatymus ir juose Domeną.",
                "Įveskite savo nuosavą domeną ir spustelėkite Prijungti.",
                "Pas savo domeno teikėją sukurkite rodomus DNS įrašus.",
                "Palaukite patvirtinimo — tikrinimas vyksta automatiškai fone.",
              ],
            },
            { type: "h2", text: "Teisingas DNS įrašų nustatymas" },
            {
              type: "p",
              text: "myNextDays parodo jums tiksliai reikalingus įrašus jūsų domeno teikėjui. Ryšys tampa aktyvus tik tada, kai šie įrašai teisingai nustatyti ir pasklinda visame pasaulyje — tai, priklausomai nuo teikėjo, gali užtrukti kelias valandas.",
            },
            {
              type: "ul",
              items: [
                "Nustatyti CNAME arba A įrašą pagal rodomą instrukciją",
                "Iš anksto pašalinti esamus, prieštaraujančius to paties domeno įrašus",
                "Sėkmingai prisijungus https sertifikatas išduodamas automatiškai",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Be teisingai nustatytų DNS įrašų jūsų svetainė nuosavu domenu liks nepasiekiama — kruopščiai patikrinkite rašybą pagal savo teikėjo duomenis.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objektų rodymas svetainėje",
          excerpt: "Kurie objektai matomi ir rezervuojami svetainėje, valdote atskirai kiekvienam objektui.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kad objektas pasirodytų jūsų svetainėje, šiam objektui turi būti įjungtas svetainės matomumas. Šis jungiklis nepriklauso nuo matomumo myBestDays prekyvietėje ar portaluose.",
            },
            { type: "h2", text: "Objekto aktyvavimas svetainei" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje Objektai.",
                "Pereikite į skirtuką Matomumas.",
                "Aktyvuokite jungiklį Svetainė.",
                "Pereikite į svetainę ir peržiūroje patikrinkite elementą Objektų apžvalga.",
              ],
            },
            { type: "h2", text: "Tvarkos ir vaizdavimo koregavimas" },
            {
              type: "p",
              text: "Elemente Objektų apžvalga nustatote, ar objektai automatiškai rūšiuojami pagal prieinamumą, ar nustatote fiksuotą tvarką. Kiekvienas objektas rodo titulinę nuotrauką, bazinę kainą jam priskirta valiuta ir svarbiausius patogumų požymius.",
            },
            {
              type: "ul",
              items: [
                "Automatinis rūšiavimas pagal prieinamumą arba rankinė tvarka",
                "Pasirinktinai galima aktyvuoti filtrus pagal objekto tipą ar patogumus",
                "Rezervacijos žingsniai vyksta tiesiogiai svetainėje, be aplinkkelio per portalą",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objektas be aktyvuoto svetainės matomumo lieka paslėptas objektų apžvalgoje, net jei jis matomas prekyvietėje ar portaluose.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Svetainės publikavimas",
          excerpt: "Juodraščiai tampa viešai matomi tik paspaudus Publikuoti.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Kol dirbate redaktoriuje, tik jūs matote aktualų juodraštį. Tik paspaudus Publikuoti pakeitimai tampa matomi visiems lankytojams jūsų domene.",
            },
            { type: "h2", text: "Kaip publikuoti" },
            {
              type: "steps",
              items: [
                "Redaktoriuje atidarykite peržiūrą ir patikrinkite visus puslapius.",
                "Viršuje dešinėje spustelėkite Publikuoti.",
                "Patvirtinkite dialogo langą — svetainė iškart po to yra vieša.",
                "Atidarykite savo domeną naujame skirtuke, norėdami patikrinti rezultatą.",
              ],
            },
            { type: "h2", text: "Juodraščiai ir atstatymas" },
            {
              type: "p",
              text: "Kol dar nepublikavote, bet kada galite grįžti prie paskutinės paskelbtos versijos, galutinai neprarasdami juodraščio — tam naudokite Atmesti juodraštį svetainės nustatymuose.",
            },
            {
              type: "ul",
              items: [
                "Paskelbti pakeitimai iš karto matomi jūsų domene",
                "Nepaskelbtas juodraštis lieka vidinis, kol jo nepatvirtinate",
                "Kiekvienas paskelbimas su data fiksuojamas istorijoje",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prieš publikuodami peržiūroje patikrinkite mobilųjį vaizdą — dauguma svečių rezervacijų svetaines atsidaro per išmanųjį telefoną.",
            },
          ],
        },
      ],
    },
  ],
};
