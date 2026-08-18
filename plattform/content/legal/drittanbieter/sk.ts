import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Tretí poskytovatelia a platobné služby",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "myBestDays využíva na prevádzku Platformy služby tretích strán. Táto stránka ich uvádza a vysvetľuje, akú úlohu majú a čie podmienky sa v jednotlivých prípadoch uplatnia.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Tam, kde tretia strana poskytuje službu priamo Vám, platia popri našich aj jej podmienky a jej zásady ochrany osobných údajov. Na príslušnom mieste na to upozorňujeme.",
        "Tam, kde tretia strana spracúva výlučne z nášho poverenia, zostávame Vaším kontaktným partnerom. Ktorých sprostredkovateľov využívame, uvádzajú [Zásady ochrany osobných údajov](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Poskytovateľ platobných služieb",
      paragraphs: [
        "Platby cez Platformu vybavuje Stripe. Stripe zbiera a spracúva platobné údaje priamo a je za ne samostatným prevádzkovateľom. Dodatočne platia [Zásady ochrany osobných údajov Stripe](https://stripe.com/privacy).",
        "Na výplatu hostiteľom vykonáva Stripe zákonom predpísané overenie totožnosti.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Smernica o platobných službách a prístup tretích strán",
      paragraphs: [
        "Smernica (EÚ) 2015/2366 („PSD2“) vyžaduje pri mnohých platbách silné overenie zákazníka. Vykonáva ho Vaša banka alebo vydavateľ karty; bez úspešného overenia môže byť platba zamietnutá.",
        "myBestDays nie je službou iniciovania platby ani službou informovania o účte a nepristupuje k Vašim bankovým účtom.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mapy, obrázky a vložený obsah",
      paragraphs: [
        "Na zobrazenie máp a údajov o polohe vkladáme mapové služby tretích strán. Pri načítaní takého obsahu môžu byť údaje prenesené príslušnému poskytovateľovi; podrobnosti a správu súhlasu uvádzajú [Zásady používania súborov cookie](https://mybestdays.dk/rechtliches/cookies).",
        "Obrázky a opisy v inzerátoch pochádzajú od príslušného poskytovateľa, nie od nás.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Odkazované stránky",
      paragraphs: [
        "Platforma môže odkazovať na stránky tretích strán. Na ich obsah nemáme vplyv a nepreberáme zaň zodpovednosť. Len čo sa dozvieme o porušení práva, odkaz bezodkladne odstránime.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Obchody s aplikáciami",
      paragraphs: [
        "Ak získate aplikáciu myBestDays cez obchod s aplikáciami, platia dodatočne podmienky príslušného prevádzkovateľa obchodu. Prevádzkovateľ obchodu nie je stranou zmluvy medzi Vami a nami a nedlží ani podporu, ani záruku za aplikáciu.",
      ],
    },
  ],
};
