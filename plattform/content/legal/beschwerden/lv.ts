import { ANBIETER, VERBRAUCHERSCHLICHTUNG } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Sūdzības un strīdu risināšana",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "Šī lapa apraksta, kā sasniegt myBestDays, kā izskatām sūdzības un kādi ceļi Jums ir pieejami, ja nepiekrītat mūsu lēmumam.",
  ],
  sections: [
    {
      id: "kontakt",
      heading: "1. Kā mūs sasniegt",
      paragraphs: [
        "Visātrāk mūs sasniegsiet caur palīdzības centru un tur norādītajiem kontaktceļiem. Par esošu rezervāciju izmantojiet ziņojumu funkciju savā kontā – tad rezervācija un vēsture mums jau ir pieejama.",
        `Rakstiski mūs sasniegsiet ${ANBIETER.email} vai ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dānija; pa tālruni ${ANBIETER.telefon}.`,
      ],
    },
    {
      id: "was-angeben",
      heading: "2. Kas jāietver Jūsu sūdzībā",
      paragraphs: ["Lai varētu ātri palīdzēt, lūdzam norādīt:"],
      list: [
        "savu rezervācijas numuru un rezervācijai izmantoto e-pasta adresi;",
        "īsu problēmas aprakstu;",
        "kādu risinājumu vēlaties;",
        "attiecīgos pierādījumus – fotoattēlus, ziņojumus, kvītis, konta izrakstus.",
      ],
    },
    {
      id: "ablauf",
      heading: "3. Kā izskatām",
      paragraphs: [
        "Katra sūdzība tiek reģistrēta un saņem lietas numuru, ar kuru varat sekot līdzi statusam.",
        "Saņemšanu nekavējoties apstiprinām un pēc būtības atbildam parasti septiņu dienu laikā. Ja nepieciešama ilgāka izskatīšana, paziņojam Jums starpstāvokli.",
        "Sūdzības, kurās apdraudētas personas vai tuvojas ierašanās, izskatām prioritāri.",
        "Savu lēmumu pamatojam un norādām pamatu, uz kura tas balstās.",
      ],
    },
    {
      id: "beschwerde-gegen-massnahme",
      heading: "4. Sūdzība par mūsu pasākumu",
      paragraphs: [
        "Ja esam noņēmuši saturu, ierobežojuši tā redzamību, atcēluši rezervāciju vai bloķējuši kontu, par to sešu mēnešu laikā varat bez maksas iesniegt sūdzību. Tas atbilst Regulas (ES) 2022/2065 20. pantam.",
        "Sūdzību izskata cilvēki, nevis tikai automatizētas procedūras. Ja tā izrādās pamatota, pasākumu atceļam.",
      ],
    },
    {
      id: "aussergerichtlich",
      heading: "5. Ārpustiesas strīdu risināšana",
      paragraphs: [
        "Eiropas Komisijas strīdu izšķiršanas tiešsaistē platforma tika atcelta ar Regulu (ES) 2024/3228 un pārtrauca darbību. Caur to sūdzības vairs nevar iesniegt.",
        "Mums nav pienākuma un mēs neesam gatavi piedalīties strīdu risināšanas procedūrā patērētāju strīdu alternatīvas risināšanas iestādē.",
        `Neatkarīgi no tā kā patērētājs varat vērsties kompetentajā Dānijas iestādē: ${VERBRAUCHERSCHLICHTUNG.name}, ${VERBRAUCHERSCHLICHTUNG.traeger}, ${VERBRAUCHERSCHLICHTUNG.strasse}, ${VERBRAUCHERSCHLICHTUNG.ort}, Dānija ([naevneneshus.dk](${VERBRAUCHERSCHLICHTUNG.website})). Ja dzīvojat citā dalībvalstī, Jums palīdz Jūsu valsts Eiropas Patērētāju centrs.`,
        "Ja strīds attiecas uz pasākumu, ko esam veikuši pret Jūsu saturu vai kontu, papildus varat vērsties ārpustiesas strīdu risināšanas iestādē, kas sertificēta saskaņā ar Regulas (ES) 2022/2065 21. pantu. Tās lēmumi mums nav saistoši, un piedalīties šādās procedūrās mums nav pienākuma.",
      ],
    },
    {
      id: "gericht",
      heading: "6. Tiesas ceļš",
      paragraphs: [
        "Ceļš uz tiesām Jums ir pieejams jebkurā brīdī, arī bez iepriekšējas sūdzību procedūras. Kuras tiesas ir kompetentas, norādīts [Lietošanas noteikumu](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a19-recht-und-gerichtsstand) A19 iedaļā.",
      ],
    },
    {
      id: "anbieter",
      heading: "7. Sniedzēju sūdzības",
      paragraphs: [
        "Sniedzēji tajā pašā kārtībā var iesniegt sūdzības par šo noteikumu piemērošanu, par ranžēšanas lēmumiem un par viņu piedāvājuma ierobežojumiem. Tas atbilst Regulas (ES) 2019/1150 11. pantam.",
        "Par šādu sūdzību skaitu, priekšmetu un vidējo izskatīšanas ilgumu ziņojam katru gadu; ziņojums pieejams sadaļā [Digitālo pakalpojumu akts](https://mybestdays.dk/rechtliches/dsa).",
      ],
    },
  ],
};
