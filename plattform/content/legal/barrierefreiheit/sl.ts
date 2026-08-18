import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Izjava o dostopnosti",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays naj bo uporaben za vse. Ta izjava opisuje stanje dostopnosti Platforme, znane omejitve in pot za prijavo ovir.",
    "Nanaša se na zahteve Direktive (EU) 2019/882 o zahtevah glede dostopnosti za proizvode in storitve, ki od 28. junija 2025 velja za storitve elektronskega poslovanja.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stanje dostopnosti",
      paragraphs: [
        "Ravnamo se po harmoniziranem standardu EN 301 549 in po smernicah Web Content Accessibility Guidelines (WCAG) 2.1, na katerih temelji, na ravni skladnosti AA.",
        "Uresničeno je med drugim: dosledna upravljivost s tipkovnico, viden fokus, semantična struktura naslovov, oznake pri vseh poljih obrazcev, besedilne alternative za upravljalne elemente, zadosten barvni kontrast, možnost povečave besedila brez izgube vsebine ter prikaz, ki se prilagaja velikosti zaslona.",
        "Pravna besedila so na voljo v vseh 24 uradnih jezikih Unije in imajo pravilno jezikovno oznako, da jih bralniki zaslona pravilno preberejo.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Znane omejitve",
      paragraphs: ["Trenutno niso dostopni zlasti:"],
      list: [
        "Fotografije in opisi v oglasih izhajajo od ponudnikov; besedilne alternative k fotografijam lahko manjkajo ali so nezadostne. Ponudnike pozivamo, naj jih dopolnijo.",
        "Vgrajeni prikazi zemljevidov tretjih oseb so s tipkovnico upravljivi le omejeno. Vsi podatki o legi so na voljo tudi kot besedilo.",
        "Dokumenti, ki jih naložijo ponudniki (na primer hišni red v obliki PDF), niso dosledno označeni na dostopen način.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Dostopnost nastanitev",
      paragraphs: [
        "Ta izjava zadeva Platformo, ne nastanitev. Podatki o gradbeni dostopnosti nastanitve izhajajo od ponudnika.",
        "Če ste odvisni od določenih lastnosti — dostop brez stopnic, širine vrat, tuš v ravni tal, dvigalo —, jih pred rezervacijo razjasnite s ponudnikom prek funkcije sporočil. Netočni podatki o dostopnosti so kršitev naših pravil in jih je mogoče prijaviti.",
      ],
    },
    {
      id: "melden",
      heading: "4. Prijava ovir",
      paragraphs: [
        `Če naletite na oviro, nam jo prijavite na ${ANBIETER.email} ali prek kontaktnih poti v razdelku [Pritožbe in reševanje sporov](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Prosimo, opišite, katera stran je prizadeta, kaj ste želeli storiti in katere pripomočke uporabljate. Prejem potrdimo in vam sporočimo, kako in do kdaj bomo oviro odpravili.",
        "Če informacijo potrebujete v dostopni obliki, vam jo na zahtevo zagotovimo.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Izvršilni postopek",
      paragraphs: [
        "Če z našim odgovorom niste zadovoljni, se lahko obrnete na organ, pristojen za nadzor trga po Direktivi (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (prej Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Danska",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
