import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tretji ponudniki in plačilne storitve",
  stand: "Posodobljeno: 18. avgusta 2026",
  intro: [
    "myBestDays za delovanje Platforme uporablja storitve tretjih oseb. Ta stran jih navaja in pojasnjuje, kakšno vlogo imajo in čigavi pogoji veljajo v posameznem primeru.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Načelo",
      paragraphs: [
        "Kjer tretji ponudnik storitev opravlja neposredno za vas, poleg naših veljajo njegovi pogoji in njegova politika zasebnosti. Na to opozorimo na ustreznem mestu.",
        "Kjer tretji ponudnik obdeluje izključno po našem naročilu, ostajamo mi vaš sogovornik. Katere obdelovalce uporabljamo, je navedeno v [Politiki zasebnosti](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Ponudnik plačilnih storitev",
      paragraphs: [
        "Plačila prek Platforme izvaja Stripe. Stripe plačilne podatke zbira in obdeluje neposredno ter je zanje samostojni upravljavec. Dodatno velja [Politika zasebnosti Stripe](https://stripe.com/privacy).",
        "Za izplačilo gostiteljem Stripe opravi zakonsko predpisano preverjanje identitete.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Direktiva o plačilnih storitvah in dostop tretjih oseb",
      paragraphs: [
        "Direktiva (EU) 2015/2366 (»PSD2«) za mnoga plačila zahteva močno avtentikacijo stranke. Izvede jo vaša banka ali izdajatelj kartice; brez uspešne avtentikacije je plačilo lahko zavrnjeno.",
        "myBestDays ni storitev odreditve plačil ali storitev zagotavljanja informacij o računih in ne dostopa do vaših bančnih računov.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Zemljevidi, slike in vgrajena vsebina",
      paragraphs: [
        "Za prikaze zemljevidov in podatke o legi vgrajujemo kartografske storitve tretjih oseb. Ob nalaganju take vsebine se lahko podatki prenesejo posameznemu ponudniku; podrobnosti in upravljanje privolitve so navedeni v [Politiki piškotkov](https://mybestdays.dk/rechtliches/cookies).",
        "Slike in opisi v oglasih izhajajo od posameznega ponudnika, ne od nas.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Povezane strani",
      paragraphs: [
        "Platforma lahko vsebuje povezave na strani tretjih oseb. Na njihovo vsebino nimamo vpliva in zanjo ne prevzemamo odgovornosti. Takoj ko izvemo za kršitev prava, povezavo nemudoma odstranimo.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Trgovine z aplikacijami",
      paragraphs: [
        "Če aplikacijo myBestDays pridobite prek trgovine z aplikacijami, dodatno veljajo pogoji posameznega upravljavca trgovine. Upravljavec trgovine ni stranka pogodbe med vami in nami ter ne dolguje ne podpore ne jamstva za aplikacijo.",
      ],
    },
  ],
};
