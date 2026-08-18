import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Politika par iestāžu un tiesībaizsardzības pieprasījumiem",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī politika paredzēta iestādēm, tiesām un tiesībaizsardzības struktūrām, kas no myBestDays pieprasa datus vai vērš rīkojumu pret saturu. Tā šeit ir publiska, lai arī lietotāji varētu izlasīt, ar kādiem nosacījumiem datus izsniedzam.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Princips",
      paragraphs: [
        "Lietotāju datus izsniedzam tikai tad, ja pastāv derīgs tiesiskais pamats un pieprasījums atbilst formālajām prasībām. Neformāls lūgums sniegt datus nav pietiekams.",
        "Katru pieprasījumu pārbaudām attiecībā uz kompetenci, tiesisko pamatu, noteiktību un samērīgumu un izsniedzam tikai tos datus, ko pieprasījums norāda.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Prasības pieprasījumam",
      paragraphs: ["Pieprasījumā jāietver:"],
      list: [
        "pieprasošā iestāde, lietas numurs un lietvedes personas kontaktinformācija uz oficiālas veidlapas;",
        "tiesiskais pamats saskaņā ar valsts vai Savienības tiesībām;",
        "precīza skartās personas vai skartā konta norāde – e-pasta adrese, rezervācijas numurs vai sludinājuma URL;",
        "precīzi norādītie dati un laikposms;",
        "attiecīgā gadījumā tiesas rīkojums, ciktāl to prasa piemērojamās tiesības;",
        "norāde, ja skartās personas informēšana apdraudētu izmeklēšanu, norādot tiesisko pamatu.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Rīkojumi saskaņā ar Regulu (ES) 2022/2065",
      paragraphs: [
        "Rīkojumos rīkoties pret prettiesisku saturu (9. pants) un rīkojumos sniegt informāciju (10. pants) jāietver tur minētās norādes, jo īpaši tiesiskais pamats, precīza elektroniskā atrašanās vieta, pamatojums, tiesiskās aizsardzības līdzekļi un valoda.",
        "Saņemšanu apstiprinām un rīkojumu izdevušajai iestādei paziņojam, kādus pasākumus esam veikuši un kad.",
        "Par rīkojumu informējam skarto personu vēlākais izpildes brīdī, ja vien iestāde, norādot tiesisko pamatu, nav noteikusi atlikšanu.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Ārkārtas gadījumi",
      paragraphs: [
        "Ja pastāv tiešs apdraudējums dzīvībai vai miesas neaizskaramībai, tā novēršanai nepieciešamos datus izsniedzam arī bez iepriekšēja formāla rīkojuma. Šādu pieprasījumu skaidri apzīmējiet kā ārkārtas un aprakstiet apdraudējumu.",
        "Ja ir norādes uz noziedzīgu nodarījumu, kas rada apdraudējumu personas dzīvībai vai drošībai, kompetentās iestādes informējam pēc savas iniciatīvas (Regulas (ES) 2022/2065 18. pants).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Kādus datus glabājam",
      paragraphs: [
        "Kādas datu kategorijas apstrādājam un cik ilgi tās glabājam, norādīts [Privātuma politikā](https://mybestdays.dk/rechtliches/datenschutz). Pāri tur minētajiem termiņiem datus neglabājam.",
        "Datu glabāšana pāri vajadzībai netiek veikta. Aicinājumu uz laiku nodrošināt datus notiekošam procesam izpildām tiesiski pieļaujamā apmērā.",
        "Pilnu maksājumu datu mums nav; tie jāpieprasa maksājumu pakalpojumu sniedzējam.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Skartās personas informēšana",
      paragraphs: [
        "Skartos lietotājus par pieprasījumu, kas attiecas uz viņu datiem, informējam, ja vien to neaizliedz tiesību norma vai pamatots iestādes rīkojums vai nepastāv tiešs apdraudējums dzīvībai vai miesas neaizskaramībai.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kur adresēt pieprasījumus",
      paragraphs: [
        "Pieprasījumus adresējiet vienotajam kontaktpunktam iestādēm, kas norādīts sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa). Tos izskatām vācu un angļu valodā.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Pārredzamība",
      paragraphs: [
        "Iestāžu rīkojumu skaitu un veidu norādām savā gada pārredzamības ziņojumā; sk. [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
