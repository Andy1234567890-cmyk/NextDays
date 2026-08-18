import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Izjava o pristupačnosti",
  stand: "Ažurirano: 18. kolovoza 2026.",
  intro: [
    "myBestDays treba biti upotrebljiv za sve. Ova izjava opisuje stanje pristupačnosti Platforme, poznata ograničenja i put za prijavu prepreka.",
    "Odnosi se na zahtjeve Direktive (EU) 2019/882 o zahtjevima za pristupačnost proizvoda i usluga, koja se od 28. lipnja 2025. primjenjuje na usluge elektroničke trgovine.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stanje pristupačnosti",
      paragraphs: [
        "Ravnamo se prema usklađenoj normi EN 301 549 i smjernicama Web Content Accessibility Guidelines (WCAG) 2.1 na kojima se temelji, na razini sukladnosti AA.",
        "Provedeno je među ostalim: dosljedna upravljivost tipkovnicom, vidljiv fokus, semantička struktura naslova, oznake uz sva polja obrazaca, tekstualne alternative za upravljačke elemente, dovoljan kontrast boja, mogućnost povećanja teksta bez gubitka sadržaja te prikaz koji se prilagođava veličini zaslona.",
        "Pravni su tekstovi dostupni na svih 24 službena jezika Unije i imaju ispravnu jezičnu oznaku kako bi ih čitači zaslona ispravno pročitali.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Poznata ograničenja",
      paragraphs: ["Trenutačno pristupačni nisu osobito:"],
      list: [
        "Fotografije i opisi u oglasima potječu od pružatelja; tekstualne alternative fotografijama mogu nedostajati ili biti nedostatne. Pružatelje pozivamo da ih dopune.",
        "Ugrađeni prikazi karata trećih strana tipkovnicom su upravljivi samo ograničeno. Svi podaci o položaju dostupni su i kao tekst.",
        "Dokumenti koje učitaju pružatelji (primjerice kućni red u PDF obliku) nisu dosljedno označeni na pristupačan način.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Pristupačnost smještaja",
      paragraphs: [
        "Ova se izjava odnosi na Platformu, a ne na smještaje. Podaci o građevinskoj pristupačnosti smještaja potječu od pružatelja.",
        "Ako ovisite o određenim značajkama — pristup bez stuba, širine vrata, tuš u razini poda, dizalo —, razjasnite ih prije rezervacije s pružateljem putem funkcije poruka. Netočni podaci o pristupačnosti povreda su naših pravila i mogu se prijaviti.",
      ],
    },
    {
      id: "melden",
      heading: "4. Prijava prepreka",
      paragraphs: [
        `Naiđete li na prepreku, prijavite nam je na ${ANBIETER.email} ili putem kontaktnih putova u dijelu [Pritužbe i rješavanje sporova](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Molimo, opišite koja je stranica pogođena, što ste htjeli učiniti i koja pomagala koristite. Primitak potvrđujemo i priopćavamo Vam kako i do kada ćemo prepreku otkloniti.",
        "Trebate li informaciju u pristupačnom obliku, stavljamo Vam je na raspolaganje na zahtjev.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Postupak provedbe",
      paragraphs: [
        "Ako niste zadovoljni našim odgovorom, možete se obratiti tijelu nadležnom za nadzor tržišta prema Direktivi (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (prije Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danska",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
