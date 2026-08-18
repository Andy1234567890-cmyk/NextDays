import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Datu aizsardzības standarti saimniekiem",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Piedāvājot caur myBestDays, Jūs saņemat savu viesu personas datus. Par to apstrādi esat patstāvīgs pārzinis Regulas (ES) 2016/679 (VDAR) izpratnē. Šie standarti apraksta, ko no Jums sagaidām.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Nolūka ierobežojums",
      paragraphs: [
        "Viesu datus izmantojat tikai rezervācijas izpildei, saziņai ar viesi un savu likumisko pienākumu izpildei (piemēram, reģistrācijas veidlapa, kūrorta nodeva, nodokļu un glabāšanas pienākumi).",
        "Jebkura cita izmantošana – jo īpaši reklāma, jaunumu vēstules, nodošana trešajām personām, iekļaušana savā viesu datubāzē vēlākām tiešajām rezervācijām – prasa atsevišķu tiesisko pamatu, parasti viesa piekrišanu.",
        "Viesu datus neizmantojat, lai pamudinātu viesi rezervēt ārpus Platformas.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Datu minimizēšana",
      paragraphs: [
        "Ievācat tikai tos datus, kas Jums patiešām nepieciešami. Personu apliecinošu dokumentu kopijas pieprasāt tikai tad, ja to prasa tiesību norma, un glabājat tās tikai tik ilgi, cik norma paredz.",
        "Maksājumu datus nepieprasāt. Maksājumi notiek caur Platformu.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Drošība",
      paragraphs: [
        "Viesu datus aizsargājat ar atbilstošiem tehniskiem un organizatoriskiem pasākumiem – piekļuve tikai personām, kurām dati nepieciešami, aizsargātas ierīces, šifrēta pārraide.",
        "Ja nodarbināt darbiniekus, uzkopšanas personālu vai līdzsaimniekus, uzliekat tiem konfidencialitātes pienākumu un dodat tikai tos datus, kas nepieciešami viņu uzdevumam.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Glabāšana un dzēšana",
      paragraphs: [
        "Viesu datus dzēšat, tiklīdz nolūks ir zudis un glabāšanas pienākums vairs nepastāv.",
        "Reģistrācijas veidlapas un nodokļu ziņā būtiskus dokumentus glabājat tik ilgi, cik nosaka Jūsu valsts tiesības – ne ilgāk.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Viesu tiesības",
      paragraphs: [
        "Ja viesis vēršas pie Jums ar piekļuves, labošanas, dzēšanas vai iebilduma pieprasījumu, to atbildat savlaicīgi. Ja tas attiecas uz datiem, kas atrodas pie mums, novirzāt viņu pie mums.",
        "Informējat savus viesus par to, kā apstrādājat viņu datus, ciktāl pārsniedzat rezervācijas izpildi.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Datu aizsardzības pārkāpumi",
      paragraphs: [
        "Ja notiek viesu datu aizsardzības pārkāpums, nekavējoties informējat kompetento uzraudzības iestādi un, kur nepieciešams, skartos viesus.",
        "Ja incidents attiecas uz datiem, kas saņemti caur Platformu, papildus informējat arī mūs, lai varētu pārbaudīt savus pienākumus.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kameras un ierakstīšanas ierīces",
      paragraphs: [
        "Iekštelpās ar pamatotu privātuma gaidu – guļamistabās, vannas istabās – kameras un mikrofoni nav pieļaujami, arī izslēgti.",
        "Visas pārējās kameras, kustības sensorus ar ierakstīšanu, durvju zvanus ar kameru un trokšņa sensorus atklājat sludinājumā, norādot atrašanās vietu un to, kas tiek ierakstīts.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Pārkāpumu sekas",
      paragraphs: [
        "Šo standartu pārkāpumus izskatām kā [Papildu noteikumu saimniekiem](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) pārkāpumus un varam veikt pasākumus līdz konta bloķēšanai.",
      ],
    },
  ],
};
