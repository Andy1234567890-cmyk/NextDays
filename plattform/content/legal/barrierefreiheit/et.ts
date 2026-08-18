import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Ligipääsetavuse deklaratsioon",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "myBestDays peab olema kasutatav kõigile. Käesolev deklaratsioon kirjeldab Platvormi ligipääsetavuse seisu, teadaolevaid piiranguid ja teed takistustest teatamiseks.",
    "See puudutab direktiivi (EL) 2019/882 (toodete ja teenuste ligipääsetavusnõuete kohta) nõudeid, mis kehtivad alates 28. juunist 2025 e-kaubanduse teenustele.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Ligipääsetavuse seis",
      paragraphs: [
        "Lähtume harmoneeritud standardist EN 301 549 ja selle aluseks olevatest veebisisu ligipääsetavuse suunistest (WCAG) 2.1 vastavustasemel AA.",
        "Rakendatud on muu hulgas: läbiv juhitavus klaviatuuriga, nähtav fookus, semantiline pealkirjastruktuur, sildid kõigil vormiväljadel, tekstilised alternatiivid juhtelementidele, piisav värvikontrast, teksti skaleeritavus ilma sisu kaota ning ekraani suurusega kohanduv kuvamine.",
        "Õigustekstid on kättesaadavad kõigis 24 liidu ametlikus keeles ja õige keelemärgendusega, et ekraanilugejad neid õigesti ette loeksid.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Teadaolevad piirangud",
      paragraphs: ["Praegu ei ole ligipääsetavad eelkõige:"],
      list: [
        "Kuulutuste fotod ja kirjeldused pärinevad pakkujatelt; fotode tekstilised alternatiivid võivad puududa või olla ebapiisavad. Kutsume pakkujaid neid täiendama.",
        "Manustatud kolmandate isikute kaardikuvad on klaviatuuriga juhitavad üksnes piiratult. Kõik asukohaandmed on kättesaadavad ka tekstina.",
        "Pakkujate üleslaaditud dokumendid (näiteks majareeglid PDF-vormingus) ei ole järjekindlalt ligipääsetavalt märgendatud.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Majutuskohtade ligipääsetavus",
      paragraphs: [
        "Käesolev deklaratsioon puudutab Platvormi, mitte majutuskohti. Andmed majutuskoha ehituslikust ligipääsetavusest pärinevad pakkujalt.",
        "Kui sõltute kindlatest omadustest – trepivaba juurdepääs, uste laius, põrandaga ühetasane dušš, lift –, selgitage need enne broneerimist pakkujaga sõnumifunktsiooni kaudu välja. Ebaõiged andmed ligipääsetavuse kohta on meie reeglite rikkumine ja neist saab teatada.",
      ],
    },
    {
      id: "melden",
      heading: "4. Takistustest teatamine",
      paragraphs: [
        `Kui satute takistuse otsa, teatage sellest meile aadressil ${ANBIETER.email} või kontaktiteid pidi jaotises [Kaebused ja vaidluste lahendamine](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Palume kirjeldada, milline leht on puudutatud, mida soovisite teha ja milliseid abivahendeid kasutate. Kinnitame kättesaamist ja teatame, kuidas ja mis ajaks takistuse kõrvaldame.",
        "Kui vajate teavet ligipääsetavas vormis, anname selle Teile taotluse korral.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Jõustamismenetlus",
      paragraphs: [
        "Kui Te ei ole meie vastusega rahul, võite pöörduda direktiivi (EL) 2019/882 kohase turujärelevalve eest vastutava asutuse poole.",
        "Erhvervsstyrelsen | Markedsovervågning (varem Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Taani",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
