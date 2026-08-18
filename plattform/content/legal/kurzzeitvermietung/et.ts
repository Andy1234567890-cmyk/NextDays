import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Lühiajaline üürile andmine ja registreerimiskohustused",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Paljudes linnades ja piirkondades on eluruumi lühiajaliseks üürile andmiseks vaja luba, registreerimist või teatamist. Käesolev leht selgitab, mida see tähendab pakkujatele ja külalistele.",
  ],
  sections: [
    {
      id: "rechtsrahmen",
      heading: "1. Õigusraamistik",
      paragraphs: [
        "Määrus (EL) 2024/1028 lühiajalise majutuse üürileandmise teenustega seotud andmete kogumise ja jagamise kohta loob ühtse raamistiku: kus liikmesriik või kohalik omavalitsus on kehtestanud registreerimismenetluse, saab iga ühik registreerimisnumbri.",
        "Platvormid peavad seda numbrit kuvama, selle kehtivust pisteliselt kontrollima ja edastama pädevatele asutustele korrapäraste ajavahemike järel andmeid tegevuse kohta.",
        "Kõrvuti kehtivad edasi siseriiklikud ja kohalikud sätted – näiteks eluruumi kasutusotstarbe muutmise, üürile andmise päevade ülempiiri, tuleohutuse ja külaliste registreerimise kohta.",
      ],
    },
    {
      id: "anbieter",
      heading: "2. Mida pakkujad tegema peavad",
      paragraphs: [
        "Kontrollige enne avaldamist, kas Teie majutuskohale kehtib registreerimis-, loa- või teatamiskohustus, ja täitke see.",
        "Sisestage registreerimisnumber objekti juurde, kui see on olemas. Kuvame selle kuulutuses.",
        "Järgige üürile andmise päevade ülempiiri ja muid kohalikke piire. Nende jälgimine on Teie, mitte meie ülesanne.",
        "Kuulutust ilma nõutava registreerimisnumbrita ei tohi me püsivalt kuvada. Kui see puudub või osutub kehtetuks, nõuame seda tagantjärele; kui andmet ei esitata, deaktiveerime kuulutuse.",
      ],
    },
    {
      id: "gaeste",
      heading: "3. Mida see tähendab külalistele",
      paragraphs: [
        "Kui majutuskohale kehtib registreerimiskohustus, näete registreerimisnumbrit kuulutuses. See viitab sellele, et üürile andmine on pädevale asutusele teatatud.",
        "Sihtkohas võib olla nõutav registreerimine (registreerimisleht, isikut tõendava dokumendi andmed, kuurordimaksu deklaratsioon). Pakkuja küsib vajalikud andmed; esitage need õigeaegselt.",
      ],
    },
    {
      id: "datenuebermittlung",
      heading: "4. Andmete edastamine ametiasutustele",
      paragraphs: [
        "Niivõrd, kuivõrd määrus (EL) 2024/1028 või siseriiklik õigus seda ette näeb, edastame pädevatele asutustele andmeid üürile andmise tegevuse kohta – eelkõige registreerimisnumbri, ühiku aadressi, hõivatud ööde arvu ja külaliste arvu.",
        "See edastamine toimub juriidilise kohustuse täitmiseks määruse (EL) 2016/679 artikli 6 lõike 1 punkti c kohaselt. Üksikasjad on kirjas [Privaatsuspoliitikas](https://mybestdays.dk/rechtliches/datenschutz).",
        "Sellest eraldi kehtib maksualane teatamiskohustus DAC7 kohaselt; vt [Maksupoliitika](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "melden",
      heading: "5. Rikkumistest teatamine",
      paragraphs: [
        "Kui Teil on viiteid, et majutuskohta pakutakse ilma nõutava loa või registreeringuta, teatage sellest meile kuulutuse juures oleva teatamisfunktsiooni kaudu. Uurime iga teadet.",
      ],
    },
  ],
};
