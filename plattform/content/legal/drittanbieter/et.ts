import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Kolmandad pakkujad ja makseteenused",
  stand: "Uuendatud: 18. august 2026",
  intro: [
    "myBestDays kasutab Platvormi käitamiseks kolmandate isikute teenuseid. Käesolev leht nimetab need ja selgitab, milline on nende roll ja kelle tingimused igal juhul kehtivad.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Põhimõte",
      paragraphs: [
        "Seal, kus kolmas pakkuja osutab teenust vahetult Teile, kehtivad lisaks meie omadele tema tingimused ja tema privaatsuspoliitika. Juhime sellele vastavas kohas tähelepanu.",
        "Seal, kus kolmas pakkuja töötleb andmeid üksnes meie ülesandel, jääme meie Teie kontaktisikuks. Milliseid volitatud töötlejaid kasutame, on kirjas [Privaatsuspoliitikas](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Makseteenuse pakkuja",
      paragraphs: [
        "Makseid Platvormi kaudu töötleb Stripe. Stripe kogub ja töötleb makseandmeid vahetult ning on nende osas iseseisev vastutav töötleja. Lisaks kohaldub [Stripe'i privaatsuspoliitika](https://stripe.com/privacy).",
        "Väljamakseks võõrustajatele teostab Stripe seaduses ette nähtud isikusamasuse kontrolli.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Makseteenuste direktiiv ja kolmandate isikute juurdepääs",
      paragraphs: [
        "Direktiiv (EL) 2015/2366 („PSD2“) nõuab paljude maksete puhul kliendi tugevat autentimist. Selle teostab Teie pank või kaardi väljastaja; ilma eduka autentimiseta võidakse makse tagasi lükata.",
        "myBestDays ei ole makse algatamise ega kontoteabe teenus ega pääse ligi Teie pangakontodele.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Kaardid, pildid ja manustatud sisu",
      paragraphs: [
        "Kaardikuvade ja asukohaandmete jaoks manustame kolmandate isikute kaarditeenuseid. Sellise sisu laadimisel võidakse andmeid edastada vastavale pakkujale; üksikasjad ja nõusoleku haldamine on kirjas [Küpsisepoliitikas](https://mybestdays.dk/rechtliches/cookies).",
        "Kuulutuste pildid ja kirjeldused pärinevad vastavalt pakkujalt, mitte meilt.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Lingitud lehed",
      paragraphs: [
        "Platvorm võib linkida kolmandate isikute lehtedele. Nende sisu me ei mõjuta ega vastuta selle eest. Saades teada õigusrikkumisest, eemaldame lingi viivitamata.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Rakendusepoed",
      paragraphs: [
        "Kui hangite myBestDays rakenduse rakendusepoe kaudu, kehtivad lisaks vastava poe käitaja tingimused. Poe käitaja ei ole Teie ja meie vahelise lepingu pool ega võlgne ei tuge ega garantiid rakendusele.",
      ],
    },
  ],
};
