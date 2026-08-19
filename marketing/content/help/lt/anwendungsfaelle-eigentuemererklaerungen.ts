import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Savininkų ataskaitos",
  description: "Kurti savininkų ataskaitas.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Savininkų ataskaitos",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Sukurti savininko ataskaitą",
          excerpt: "Kaip sukurti savininkui aiškią jo laikotarpio atskaitomybę.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Jei valdote objektus savininkams, jiems reguliariai reikia aiškios apžvalgos apie pajamas, išskaičiuotą komisinį mokestį ir išmoką už jų objektus per tam tikrą laikotarpį — savininko ataskaita šiuos duomenis apibendrina automatiškai.",
            },
            {
              type: "steps",
              items: [
                "Paskyroje atidarykite skyrių Savininkai ir pasirinkite atitinkamą savininką.",
                "Pasirinkite atsiskaitymo laikotarpį, kuriam turi būti sukurta ataskaita.",
                "Patikrinkite, ar visi šio savininko objektai priskirti teisingai, nes į ataskaitą įtraukiami tik priskirti objektai.",
                "Sukurkite ataskaitą ir patikrinkite, ar joje nurodytos rezervacijos yra išsamios.",
                "Pateikite ataskaitą savininkui per savininko prieigą arba eksportuokite ją kaip dokumentą.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ataskaitoje kiekviena rezervacija rodoma su suma atitinkamo objekto valiuta — bendros valiutos nuorodos nėra, nes skirtingi objektai gali turėti ir skirtingas valiutas. Daugiau apie priskyrimą skaitykite [Objekto priskyrimas savininkui](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Atsiskaityti su savininku dėl komisinio mokesčio",
          excerpt: "Kaip užtikrinti, kad jūsų komisinis mokestis būtų teisingai apskaičiuotas iš savininko pajamų.",
          updated: "Atnaujinta: 2026 m. liepa",
          body: [
            {
              type: "h2",
              text: "Pradinė situacija",
            },
            {
              type: "p",
              text: "Jūsų komisinis mokestis už objekto valdymą nurodytas savininko tarife ir kiekvienoje ataskaitoje automatiškai išskaičiuojamas iš bendrųjų pajamų. Kad atsiskaitymas būtų teisingas, komisinio mokesčio tarifas turi būti teisingai nustatytas prieš pirmąją laikotarpio rezervaciją.",
            },
            {
              type: "steps",
              items: [
                "Paskyroje atidarykite atitinkamo savininko tarifą ir patikrinkite nurodytą komisinio mokesčio tarifą.",
                "Prireikus pakoreguokite tarifą prieš gaunant naujas rezervacijas kitame atsiskaitymo laikotarpyje.",
                "Sukurkite savininko ataskaitą už laikotarpį ir patikrinkite, ar komisinis mokestis kiekvienai rezervacijai nurodytas teisingai.",
                "Patikrinkite, ar bendrųjų pajamų, išskaičiuoto komisinio mokesčio ir grynosios išmokos suma yra logiška.",
                "Neatitikimus aptarkite tiesiogiai su savininku prieš patvirtindami ataskaitą, o ne keiskite ją vėliau.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vėlesnis komisinio mokesčio tarifo pakeitimas galioja tik būsimiems laikotarpiams, o ne atgaline data jau sukurtoms ataskaitoms. Todėl tarifą patikrinkite laiku, prieš prasidedant naujam atsiskaitymo laikotarpiui — žr. taip pat [Savininko atsiskaitymas (ataskaita)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
