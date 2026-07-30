import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Savininkai ir atsiskaitymai",
  description: "Savininkų paskyros, atsiskaitymai ir komisiniai mokesčiai.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Savininkai",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Savininko sukūrimas",
          excerpt: "Kaip sukurti naują savininko paskyrą myNextDays sistemoje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Savininkai yra atskiros paskyros myNextDays sistemoje, per kurias valdote objektus, priklausančius tam tikram asmeniui ar įmonei. Savininko paskyra gauna ribotą, tik skaitymo prieigą prie savo objektų, be galimybės pačiam keisti įmonės nustatymus.",
            },
            { type: "h2", text: "Naujos savininko paskyros kūrimas" },
            {
              type: "steps",
              items: [
                "Pagrindiniame meniu atidarykite skyrių „Savininkai“.",
                "Spustelėkite „Sukurti naują savininką“.",
                "Įveskite vardą, el. pašto adresą ir kontaktinius duomenis.",
                "Prireikus nurodykite sąskaitų adresą atsiskaitymams.",
                "Išsaugokite paskyrą.",
              ],
            },
            { type: "h2", text: "Prieigos nustatymas" },
            {
              type: "p",
              text: "Sukūrę galite savininkui išsiųsti kvietimą į nuosavą prieigą. Savininkas tada prisijungia su savo prieigos duomenimis ir mato tik jam priskirtus objektus.",
            },
            {
              type: "ul",
              items: [
                "Savininko paskyra gali apimti kelis objektus.",
                "Kiekvienas objektas priklauso lygiai vienam savininkui.",
                "Kontaktinius duomenis ir sąskaitų adresą bet kada galima vėliau pakoreguoti.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Kaip esamą objektą priskirti savininkui, skaitykite skyriuje [Objekto priskyrimas savininkui](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Objekto priskyrimas savininkui",
          excerpt: "Kiekvienas objektas priklauso lygiai vienam savininkui — taip nustatote priskyrimą.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "myNextDays sistemoje kiekvienas objektas priklauso lygiai vienam savininkui. Kelių priskyrimų nenumatyta — jei objektas turi priklausyti kitam savininkui, pirmiausia panaikinkite esamą priskyrimą, prieš nustatydami naują.",
            },
            { type: "h2", text: "Priskyrimo atlikimas" },
            {
              type: "steps",
              items: [
                "Atidarykite objektą skiltyje „Objektai“.",
                "Pereikite į skirtuką „Savininkas“.",
                "Iš sąrašo pasirinkite atsakingą savininką.",
                "Patvirtinkite priskyrimą.",
                "Išsaugokite objekto pakeitimą.",
              ],
            },
            { type: "h2", text: "Savininko pakeitimas" },
            {
              type: "p",
              text: "Jei objekto savininkas keičiasi, pavyzdžiui, dėl pardavimo, esamą priskyrimą pakeičiate nauju. Jau sukurtos praeitų laikotarpių atskaitomybės tuo atveju lieka priskirtos pradiniam savininkui.",
            },
            {
              type: "ul",
              items: [
                "Objektas bet kuriuo metu gali būti priskirtas tik vienam savininkui.",
                "Be priskyrimo objektas nepasirodo jokioje savininko prieigoje.",
                "Praeities atskaitomybės išlieka pas pradinį savininką.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Objekto priskyrimas keliems savininkams vienu metu neįmanomas — sistema neleidžia antro vienalaikio priskyrimo.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Savininko atsiskaitymas (ataskaita)",
          excerpt: "Kaip sukurti savininkui ataskaitą su pajamomis, atskaičius komisinį mokestį.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Savininko atsiskaitymas, dar vadinamas ataskaita, pasirinktam laikotarpiui apibendrina visas priskirtų objektų pajamas ir išskaičiuoja jūsų sutartą komisinį mokestį. Rezultatas yra suma, kurią sumokate savininkui.",
            },
            { type: "h2", text: "Ataskaitos sukūrimas" },
            {
              type: "steps",
              items: [
                "Atidarykite skyrių „Savininkai“ ir pasirinkite norimą savininką.",
                "Pereikite į skirtuką „Atsiskaitymas“.",
                "Pasirinkite atsiskaitymo laikotarpį.",
                "Patikrinkite kiekvieno objekto išvardytas rezervacijas ir pajamas.",
                "Sukurkite ataskaitą su atskaičiuotu komisiniu mokesčiu.",
              ],
            },
            { type: "h2", text: "Ataskaitos struktūra" },
            {
              type: "p",
              text: "Ataskaitoje kiekvienam objektui nurodomos bendrosios pajamos iš rezervacijų, nuo jų atskaičiuotas komisinis mokestis ir iš to gaunama išmokos suma. Papildomos išlaidos, tokios kaip valymas ar mokesčiai, priklausomai nuo susitarimo, gali būti nurodomos atskirai.",
            },
            {
              type: "ul",
              items: [
                "Bendrosios pajamos: visų laikotarpio rezervacijų suma kiekvienam objektui.",
                "Komisinis mokestis: jūsų sutarta dalis, išskaičiuojama iš pajamų.",
                "Išmokos suma: pajamos, atskaičius komisinį mokestį ir prireikus kitas eilutes.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Sumos ataskaitoje visada nurodomos objekto valiuta — bendro atsarginio valiutos varianto nėra.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kurkite ataskaitas reguliariai tą pačią dieną, kad savininkai turėtų patikimą išmokų ritmą.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Savininko prieiga",
          excerpt: "Ką savininkai gali matyti savo tik skaitymo prieigoje.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "p",
              text: "Savininko prieiga yra atskiras, tik skaitymo prisijungimas prie myNextDays. Savininkai jame mato išimtinai jiems priskirtus objektus bei susijusius užimtumus ir atsiskaitymus — be galimybės patiems keisti nustatymus.",
            },
            { type: "h2", text: "Ką mato savininkai" },
            {
              type: "ul",
              items: [
                "Savo objektų užimtumo kalendorių.",
                "Sukurtas ataskaitas su pajamomis ir atskaičiuotu komisiniu mokesčiu.",
                "Savo objektų pagrindinius duomenis, pavyzdžiui, patogumus ir aprašymą.",
              ],
            },
            { type: "h2", text: "Prieigos aktyvavimas" },
            {
              type: "steps",
              items: [
                "Atidarykite savininką skiltyje „Savininkai“.",
                "Spustelėkite „Kviesti prieigą“.",
                "Savininkas gauna el. laišką savo slaptažodžiui nustatyti.",
                "Po prisijungimo savininkas automatiškai mato tik jam priskirtus objektus.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Savininko prieiga yra griežtai tik skaitymo: kainas, prieinamumą ar objekto duomenis gali keisti tik jūs, kaip įmonė, o ne pats savininkas.",
            },
            {
              type: "note",
              variant: "info",
              text: "Daugiau apie objektų priskyrimą rasite skyriuje [Objekto priskyrimas savininkui](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};
