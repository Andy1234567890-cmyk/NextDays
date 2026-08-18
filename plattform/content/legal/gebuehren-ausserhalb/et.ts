import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tasud väljaspool platvormi",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev poliitika reguleerib, milliseid summasid tohib pakkuja väljaspool Platvormi nõuda ja milliseid mitte. See kaitseb külalisi selle eest, et neile esitatakse kohapeal nõudeid, mida kuulutuses ei olnud.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Põhimõte",
      paragraphs: [
        "Kõik, mis broneeritud teenuse eest tuleb maksta, peab olema enne broneeringu lõpetamist kuulutuses välja toodud – kas kogumaksumuse osana või kohapealse kuluartiklina.",
        "Summa, mida ei toodud välja ei kogumaksumuses ega kohapealsete kuludena, ei ole külalise poolt tasumisele kuuluv.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Mida tohib kohapeal nõuda",
      paragraphs: ["Kohapeal tohib nõuda üksnes:"],
      list: [
        "summasid, mis on kuulutuses sõnaselgelt välja toodud kohapealsete kuludena (näiteks lõppkoristus, voodipesukomplekt, parkimiskoht);",
        "kohalikke lõive nagu kuurordimaks, kui see tuleb kohalike normide kohaselt tasuda kohapeal;",
        "kuulutuses välja toodud tagatisraha;",
        "teenuseid, mille külaline tellib alles kohapeal ja vabatahtlikult, eelnevalt nimetatud hinnaga;",
        "külalise põhjustatud tõendatud kahju hüvitamist.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Mida ei tohi nõuda",
      paragraphs: ["Lubamatu on eelkõige:"],
      list: [
        "täiendav nõue ööbimishinnale pärast broneeringu lõpetamist;",
        "tasu selle eest, et broneering toimus myBestDays kaudu;",
        "menetlus-, broneerimis- või kaarditasu, mida kuulutuses välja ei toodud;",
        "üleskutse broneering tühistada ja sama majutuskoht väljaspool Platvormi uuesti broneerida;",
        "üleskutse tasuda hind või osa sellest ülekandega, sularahas või makseteenusega väljaspool Platvormi, kui kuulutus näeb ette maksmise Platvormi kaudu.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Platvormist möödahiilimine",
      paragraphs: [
        "Kui kontakt külalise ja pakkuja vahel tekkis Platvormi kaudu, ei tohi broneeringut vormistada sellest mööda. See kehtib mõlemale poolele.",
        "Kes hiilib Platvormist mööda, kaotab selle kaitse: maksed ei ole tagatud, meie tühistamis- ja tagasimaksepoliitikad ei kohaldu ning vaidluse korral me vahendada ei saa.",
        "Rikkumised võivad viia konto blokeerimiseni. Pakkujatelt võime lisaks nõuda saamata jäänud teenustasu.",
      ],
    },
    {
      id: "melden",
      heading: "5. Teatamine",
      paragraphs: [
        "Kui Teilt nõutakse kohapeal summat, mida kuulutuses ei olnud, ärge seda makske ja teatage meile kontaktiteid pidi jaotises [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden). Kui olete juba maksnud, aitame selle tagasinõudmisel.",
      ],
    },
  ],
};
