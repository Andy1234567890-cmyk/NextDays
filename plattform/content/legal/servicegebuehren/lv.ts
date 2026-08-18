import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pakalpojuma maksas",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "myBestDays finansējas no pakalpojuma maksas par starpniekotajām rezervācijām. Šī lapa skaidro, kas to maksā, kā tā tiek aprēķināta un kur tā ir norādīta.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Kas maksā pakalpojuma maksu",
      paragraphs: [
        "Pakalpojuma maksu sedz sniedzējs. Tā tiek ieturēta no rezervācijas vērtības un samazina izmaksu viņam; viesis to papildus nemaksā.",
        "Ja izņēmuma kārtā rezervācijai rodas pakalpojuma maksa viesim, to pirms rezervācijas pabeigšanas norādām kā atsevišķu pozīciju kopējā cenā. Bez šādas norādes viesim maksa nerodas.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Kā tā tiek aprēķināta",
      paragraphs: [
        "Pakalpojuma maksa ir procentuāla daļa no caur Platformu aprēķinātās rezervācijas vērtības. Jūsu rezervācijām piemērojamā likme norādīta Jūsu saimnieka kontā un vienošanās dokumentā, kam piekritāt reģistrējoties.",
        "Aprēķina bāze ir nakšņošanas cena, pieskaitot caur Platformu aprēķinātās piemaksas. Netiek iekļautas caurejošās pozīcijas, kas nav sniedzēja pretizpildījums – jo īpaši kūrorta nodeva un drošības nauda.",
        "Pakalpojuma maksa tiek aprēķināta un norādīta sludinājuma valūtā.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Pievienotās vērtības nodoklis",
      paragraphs: [
        "Pakalpojuma maksai piemēro PVN, ciktāl tas ir likumiski maksājams. Vai tas tiek uzrādīts vai piemēro apgrieztās maksāšanas kārtību, atkarīgs no sniedzēja juridiskās adreses un statusa.",
        "Par pakalpojuma maksu sniedzējam izsniedzam norēķinu, kas pieejams viņa kontā.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Atcelšana un atmaksa",
      paragraphs: [
        "Ja rezervācija tiek atmaksāta pilnībā, pakalpojuma maksu atmaksājam proporcionāli tādā apmērā, kādā tiek atmaksāta rezervācijas vērtība.",
        "Ja sniedzējs atceļ bez svarīga iemesla, pakalpojuma maksa automātiski nezūd; paturam tiesības pieprasīt atcelšanas dēļ radušās izmaksas.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Pakalpojuma maksas grozīšana",
      paragraphs: [
        "Par likmes grozījumu sniedzējiem paziņojam vismaz 30 dienas pirms spēkā stāšanās uz pastāvīga informācijas nesēja; tas atbilst Regulas (ES) 2019/1150 3. panta 2. punktam.",
        "Jau apstiprinātām rezervācijām piemēro likmi, kas bija spēkā rezervācijas brīdī.",
      ],
    },
  ],
};
