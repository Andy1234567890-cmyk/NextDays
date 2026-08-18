import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Piekļūstamības paziņojums",
  stand: "Atjaunināts: 2026. gada 18. augustā",
  intro: [
    "myBestDays ir jābūt izmantojamam visiem. Šis paziņojums apraksta Platformas piekļūstamības stāvokli, zināmos ierobežojumus un ceļu, kā mums ziņot par šķēršļiem.",
    "Tas attiecas uz Direktīvas (ES) 2019/882 par produktu un pakalpojumu piekļūstamības prasībām prasībām, kas kopš 2025. gada 28. jūnija piemērojama elektroniskās komercijas pakalpojumiem.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Piekļūstamības stāvoklis",
      paragraphs: [
        "Vadāmies pēc saskaņotā standarta EN 301 549 un tā pamatā esošajām Tīmekļa satura piekļūstamības vadlīnijām (WCAG) 2.1 atbilstības līmenī AA.",
        "Ieviests cita starpā: pilnīga vadāmība ar tastatūru, redzams fokuss, semantiska virsrakstu struktūra, apzīmējumi pie visiem formas laukiem, teksta alternatīvas vadības elementiem, pietiekams krāsu kontrasts, teksta mērogojamība bez satura zuduma, kā arī attēlojums, kas pielāgojas ekrāna izmēram.",
        "Juridiskie teksti pieejami visās 24 Savienības oficiālajās valodās un ar pareizu valodas apzīmējumu, lai ekrānlasītāji tos pareizi nolasītu.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Zināmie ierobežojumi",
      paragraphs: ["Pašlaik nav piekļūstami jo īpaši:"],
      list: [
        "Fotoattēli un apraksti sludinājumos nāk no sniedzējiem; teksta alternatīvas fotoattēliem var trūkt vai būt nepietiekamas. Aicinām sniedzējus tās papildināt.",
        "Iegultie trešo pušu karšu attēlojumi ar tastatūru vadāmi tikai ierobežoti. Visi atrašanās vietas dati pieejami arī kā teksts.",
        "Sniedzēju augšupielādētie dokumenti (piemēram, iekšējās kārtības noteikumi PDF formātā) nav konsekventi apzīmēti piekļūstamā veidā.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Naktsmītņu piekļūstamība",
      paragraphs: [
        "Šis paziņojums attiecas uz Platformu, nevis uz naktsmītnēm. Norādes par naktsmītnes būvniecisko piekļūstamību nāk no sniedzēja.",
        "Ja esat atkarīgs no konkrētām pazīmēm – piekļuve bez pakāpieniem, durvju platums, duša grīdas līmenī, lifts –, noskaidrojiet tās pirms rezervācijas ar sniedzēju, izmantojot ziņojumu funkciju. Nepatiesas norādes par piekļūstamību ir mūsu noteikumu pārkāpums, un par tām var ziņot.",
      ],
    },
    {
      id: "melden",
      heading: "4. Ziņošana par šķēršļiem",
      paragraphs: [
        `Ja sastopaties ar šķērsli, ziņojiet mums uz ${ANBIETER.email} vai pa kontaktceļiem sadaļā [Sūdzības un strīdu risināšana](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Lūdzam aprakstīt, kura lapa ir skarta, ko vēlējāties darīt un kādus palīglīdzekļus izmantojat. Saņemšanu apstiprinām un paziņojam, kā un līdz kuram brīdim šķērsli novērsīsim.",
        "Ja informācija Jums nepieciešama piekļūstamā formātā, to sniedzam pēc pieprasījuma.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Izpildes procedūra",
      paragraphs: [
        "Ja neesat apmierināts ar mūsu atbildi, varat vērsties iestādē, kas kompetenta tirgus uzraudzībā saskaņā ar Direktīvu (ES) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (agrāk Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dānija",
        "Tālrunis: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
