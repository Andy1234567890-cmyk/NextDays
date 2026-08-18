import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kaebused ja vaidluste lahendamine",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "Käesolev leht kirjeldab, kuidas jõuda myBestDays-ini, kuidas menetleme kaebusi ja millised teed on Teile avatud, kui Te meie otsusega ei nõustu.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kuidas meieni jõuda",
      paragraphs: [
        "Kõige kiiremini jõuate meieni abikeskuse ja seal esitatud kontaktiteede kaudu. Olemasoleva broneeringu puhul kasutage oma kontol olevat sõnumifunktsiooni – siis on broneering ja ajalugu meil juba olemas.",
        `Kirjalikult jõuate meieni aadressil ${ANBIETER.email} või ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Taani; telefoni teel ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Mida Teie kaebus peaks sisaldama",
      paragraphs: ["Et saaksime kiiresti aidata, palume märkida:"],
      list: [
        "oma broneeringu numbri ja broneeringuks kasutatud e-posti aadressi;",
        "lühikese probleemi kirjelduse;",
        "millist lahendust soovite;",
        "asjakohased tõendid – fotod, sõnumid, kviitungid, kontoväljavõtted.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kuidas menetleme",
      paragraphs: [
        "Iga kaebus registreeritakse ja saab toimiku numbri, mille abil saate seisu jälgida.",
        "Kinnitame kättesaamist viivitamata ja vastame sisuliselt üldjuhul seitsme päeva jooksul. Kui on vaja pikemat kontrolli, teatame Teile vahepealse seisu.",
        "Kaebusi, kus inimesed on ohus või saabumine on vahetult ees, menetleme eelisjärjekorras.",
        "Oma otsuse põhjendame ja nimetame aluse, millel see põhineb.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Kaebus meie meetme peale",
      paragraphs: [
        "Kui oleme eemaldanud sisu, piiranud selle nähtavust, tühistanud broneeringu või blokeerinud konto, võite selle peale esitada kuue kuu jooksul tasuta kaebuse. See vastab määruse (EL) 2022/2065 artiklile 20.",
        "Kaebust hindavad inimesed, mitte üksnes automatiseeritud menetlused. Kui see osutub põhjendatuks, võtame meetme tagasi.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Kohtuväline vaidluste lahendamine",
      paragraphs: [
        "Euroopa Komisjoni veebipõhine vaidluste lahendamise platvorm tunnistati kehtetuks määrusega (EL) 2024/3228 ja lõpetas tegevuse. Selle kaudu kaebusi enam esitada ei saa.",
        "Me ei ole kohustatud ega valmis osalema vaidluste lahendamise menetluses tarbijavaidluste kohtuvälise lahendamise organis.",
        `Sellest sõltumatult võite tarbijana pöörduda pädeva Taani organi poole: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Taani ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Kui elate teises liikmesriigis, aitab Teid Teie riigi Euroopa tarbijakeskus.`,
        "Kui vaidlus puudutab meetet, mille oleme võtnud Teie sisu või konto vastu, võite lisaks pöörduda määruse (EL) 2022/2065 artikli 21 kohaselt sertifitseeritud kohtuvälise vaidluste lahendamise organi poole. Selle otsused ei ole meile siduvad ja me ei ole kohustatud sellistes menetlustes osalema.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Kohtutee",
      paragraphs: [
        "Tee kohtutesse on Teile igal ajal avatud, ka ilma eelneva kaebemenetluseta. Millised kohtud on pädevad, on kirjas [Kasutustingimuste](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand) punktis A19.",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Pakkujate kaebused",
      paragraphs: [
        "Pakkujad võivad sama menetluse kaudu esitada kaebusi käesolevate tingimuste kohaldamise, järjestusotsuste ja oma pakkumise piirangute kohta. See vastab määruse (EL) 2019/1150 artiklile 11.",
        "Selliste kaebuste arvu, eseme ja keskmise menetlusaja kohta anname aru igal aastal; aruanne on kättesaadav jaotises [Digiteenuste õigusakt](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
