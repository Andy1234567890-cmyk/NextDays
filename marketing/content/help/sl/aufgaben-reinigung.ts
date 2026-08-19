import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Naloge in čiščenje",
  description: "Organizacija čistilnih načrtov in nalog ekipe.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Obratovanje",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Ustvarjanje nalog",
          excerpt: "Tako ustvarite novo nalogo za objekt ali obdobje.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Naloge združujejo vse, kar je treba opraviti v zvezi z objektom — od čiščenja po odjavi do vzdrževalnih del ali povpraševanj gostov. Vsaka naloga je vezana natanko na en objekt in jo je mogoče dodeliti članu ekipe.",
            },
            { type: "h2", text: "Ustvarjanje nove naloge" },
            {
              type: "steps",
              items: [
                "Odprite razdelek „Naloge“ v glavnem meniju.",
                "Kliknite „Nova naloga“.",
                "Izberite zadevni objekt.",
                "Vnesite naslov in po želji opis.",
                "Določite datum in uro zapadlosti.",
                "Shranite nalogo.",
              ],
            },
            { type: "h2", text: "Tipi nalog" },
            {
              type: "p",
              text: "Poleg prostih nalog obstajajo tudi sistemsko ustvarjene naloge, na primer samodejno načrtovana čiščenja po odjavi. Te so že povezane z objektom in ustreznim časovnim oknom ter jih je treba le še dodeliti članu ekipe.",
            },
            {
              type: "ul",
              items: [
                "Ročna naloga: prosto vnesena, npr. vzdrževanje ali posebna želja.",
                "Samodejna naloga čiščenja: izpeljana iz datuma odjave.",
                "Ponavljajoča se naloga: za redne preglede ali inšpekcije.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o samodejnem časovnem načrtovanju najdete pod [Čistilni načrti](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Uporabljajte natančne naslove — člani ekipe v mobilnem pogledu pogosto na prvi pogled vidijo le naslov in objekt.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Čistilni načrti",
          excerpt: "Samodejno načrtovanje čiščenj po odjavi.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Čistilni načrt poskrbi, da po vsaki odjavi samodejno nastane naloga čiščenja za zadevni objekt — brez da bi morali vsako rezervacijo spremljati posamično. To zmanjša pozabljene predaje in zagotavlja zanesljiv potek med dvema bivanjema.",
            },
            { type: "h2", text: "Aktiviranje samodejnega načrtovanja" },
            {
              type: "steps",
              items: [
                "Odprite objekt in preklopite na zavihek „Čiščenje“.",
                "Aktivirajte „Samodejno načrtovanje čiščenja po odjavi“.",
                "Določite, koliko časa po odjavi je predvidenega za čiščenje.",
                "Po želji določite privzeto ekipo ali privzeto čistilko oz. čistilca.",
                "Shranite nastavitev.",
              ],
            },
            { type: "h2", text: "Povezava s koledarjem" },
            {
              type: "p",
              text: "Takoj ko je rezervacija odpovedana ali premaknjena, se pripadajoča naloga čiščenja samodejno prilagodi novemu datumu odjave. Tako čistilni načrt vedno ostane usklajen z dejanskim stanjem zasedenosti.",
            },
            {
              type: "ul",
              items: [
                "Čiščenje samodejno nastane ob vsaki odjavi z aktivnim načrtom.",
                "Če se rezervacija premakne, se z njo premakne tudi naloga čiščenja.",
                "Če gost odpove bivanje, se naloga čiščenja odstrani.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Brez aktiviranega čistilnega načrta samodejne naloge ne nastanejo — čiščenja v tem primeru ustvarite ročno pod [Ustvarjanje nalog](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Dodeljevanje nalog",
          excerpt: "Ciljno dodeljevanje nalog čistilkam/čistilcem ali članom ekipe.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Da bo naloga opravljena, jo dodelite konkretnemu članu ekipe — na primer čistilki/čistilcu ali zaposlenemu, pristojnemu za vzdrževanje. Privzeto nalogo v svojem pregledu vidi le dodeljena oseba.",
            },
            { type: "h2", text: "Ročno dodeljevanje naloge" },
            {
              type: "steps",
              items: [
                "Odprite nalogo v seznamu „Naloge“.",
                "Kliknite „Dodeli“.",
                "S seznama izberite pristojnega člana ekipe.",
                "Potrdite dodelitev.",
              ],
            },
            { type: "h2", text: "Dodeljevanje po objektu" },
            {
              type: "p",
              text: "Če je čistilki/čistilcu že trajno dodeljen objekt, lahko naloge za ta objekt samodejno dodeljujete isti osebi. To pri ponavljajočih se čiščenjih prihrani klike in zmanjša povpraševanja.",
            },
            {
              type: "ul",
              items: [
                "Ročno dodeljevanje: osebo za vsako nalogo izberete sami.",
                "Trajna dodelitev objekta: nove naloge za ta objekt gredo samodejno k določeni osebi.",
                "Naloga ima vedno natanko eno pristojno osebo.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Čistilke/čistilci in zaposleni vidijo izključno svoje lastne dodeljene naloge, brez finančnih ali prodajnih podatkov objekta.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Spremljanje statusa nalog",
          excerpt: "Stanje obdelave nalog spremljajte v realnem času.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "p",
              text: "Vsaka naloga preide skozi jasen status — od odprte prek v obdelavi do zaključene. Tako vedno vidite, ali bo čiščenje ali vzdrževanje pravočasno pripravljeno pred naslednjo prijavo.",
            },
            { type: "h2", text: "Pregled statusov" },
            {
              type: "ul",
              items: [
                "Odprto: naloga je ustvarjena, a še ni začeta.",
                "V obdelavi: dodeljena oseba je nalogo začela.",
                "Zaključeno: naloga je opravljena in potrjena.",
              ],
            },
            { type: "h2", text: "Posodabljanje statusa" },
            {
              type: "steps",
              items: [
                "Odprite nalogo s seznama „Naloge“.",
                "Izberite ustrezen status, npr. „V obdelavi“ ali „Zaključeno“.",
                "Po potrebi dodajte kratko opombo, na primer o posebnostih v objektu.",
                "Shranite spremembo.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Spremembe statusa se takoj prikažejo v deljenem seznamu nalog — ročno ponovno nalaganje ni potrebno.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Če je čiščenje tik pred naslednjo prijavo še vedno odprto, najprej preverite dodelitev, preden kontaktirate gosta.",
            },
          ],
        },
      ],
    },
  ],
};
