import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Paslaugos mokesčiai",
  stand: "Atnaujinta: 2026 m. rugpjūčio 18 d.",
  intro: [
    "myBestDays finansuojamas paslaugos mokesčiu už tarpininkautas rezervacijas. Šis puslapis paaiškina, kas jį moka, kaip jis apskaičiuojamas ir kur nurodomas.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kas moka paslaugos mokestį",
      paragraphs: [
        "Paslaugos mokestį padengia teikėjas. Jis išskaičiuojamas iš rezervacijos vertės ir sumažina išmokėjimą jam; svečias jo papildomai nemoka.",
        "Jei išimtiniais atvejais rezervacijai atsiranda paslaugos mokestis svečiui, jį prieš užbaigiant rezervaciją nurodome kaip atskirą poziciją bendroje kainoje. Be tokio nurodymo svečiui joks mokestis neatsiranda.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Kaip jis apskaičiuojamas",
      paragraphs: [
        "Paslaugos mokestis yra procentinė per Platformą apskaičiuotos rezervacijos vertės dalis. Jūsų rezervacijoms taikomas tarifas nurodytas Jūsų šeimininko paskyroje ir susitarime, su kuriuo sutikote registruodamiesi.",
        "Apskaičiavimo pagrindas yra nakvynės kaina ir per Platformą apskaičiuotos priemokos. Neįtraukiamos tranzitinės pozicijos, kurios nėra teikėjo atlygintinis veiksmas – visų pirma kurortinis mokestis ir užstatas.",
        "Paslaugos mokestis apskaičiuojamas ir nurodomas skelbimo valiuta.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Pridėtinės vertės mokestis",
      paragraphs: [
        "Paslaugos mokesčiui taikomas PVM, jei jis mokėtinas pagal teisės aktus. Ar jis nurodomas, ar taikomas atvirkštinis apmokestinimas, priklauso nuo teikėjo buveinės ir statuso.",
        "Dėl paslaugos mokesčio teikėjui išrašome atsiskaitymą, prieinamą jo paskyroje.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Atšaukimas ir grąžinimas",
      paragraphs: [
        "Jei rezervacija grąžinama visiškai, paslaugos mokestį grąžiname proporcingai tiek, kiek grąžinama rezervacijos vertė.",
        "Jei teikėjas atšaukia be svarbios priežasties, paslaugos mokestis automatiškai neišnyksta; pasiliekame teisę reikalauti dėl atšaukimo patirtų išlaidų.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Paslaugos mokesčio keitimas",
      paragraphs: [
        "Apie tarifo pakeitimą teikėjams pranešame ne vėliau kaip prieš 30 dienų iki įsigaliojimo patvarioje laikmenoje; tai atitinka Reglamento (ES) 2019/1150 3 straipsnio 2 dalį.",
        "Jau patvirtintoms rezervacijoms taikomas tarifas, galiojęs rezervacijos metu.",
      ],
    },
  ],
};
