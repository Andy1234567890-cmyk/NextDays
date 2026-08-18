import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Třetí strany a platební služby",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays využívá k provozu platformy služby třetích stran. Tato stránka je uvádí a vysvětluje jejich roli a to, čí podmínky se použijí.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Poskytuje-li třetí strana službu přímo vám, platí vedle našich i její podmínky a její zásady ochrany osobních údajů. Upozorňujeme na to na příslušném místě.",
        "Zpracovává-li třetí strana údaje výhradně z našeho pověření, zůstáváme vaším kontaktním partnerem. Které zpracovatele využíváme, uvádějí [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz).",
      ],
    },
    {
      id: "zahlungsdienst",
      heading: "2. Poskytovatel platebních služeb",
      paragraphs: [
        "Platby přes platformu vyřizuje Stripe. Stripe shromažďuje a zpracovává platební údaje přímo a je v tomto rozsahu samostatným správcem. Navíc platí [zásady ochrany osobních údajů Stripe](https://stripe.com/privacy).",
        "Pro výplatu hostitelům provádí Stripe zákonem předepsané ověření totožnosti.",
      ],
    },
    {
      id: "psd2",
      heading: "3. Směrnice o platebních službách a přístup třetích stran",
      paragraphs: [
        "Směrnice (EU) 2015/2366 („PSD2“) vyžaduje u mnoha plateb silné ověření zákazníka. Provádí je vaše banka nebo vydavatel karty; bez úspěšného ověření může být platba zamítnuta.",
        "myBestDays není službou iniciování platby ani službou informování o účtu a nepřistupuje k vašim bankovním účtům.",
      ],
    },
    {
      id: "karten-und-inhalte",
      heading: "4. Mapy, obrázky a vložený obsah",
      paragraphs: [
        "Pro zobrazení map a údajů o poloze vkládáme mapové služby třetích stran. Při načtení takového obsahu mohou být údaje přeneseny příslušnému poskytovateli; podrobnosti a řízení souhlasu uvádějí [Zásady používání cookies](https://mybestdays.dk/rechtliches/cookies).",
        "Obrázky a popisy v inzerátech pocházejí od příslušného poskytovatele, nikoli od nás.",
      ],
    },
    {
      id: "verlinkung",
      heading: "5. Odkazované stránky",
      paragraphs: [
        "Platforma může odkazovat na stránky třetích stran. Na jejich obsah nemáme vliv a neneseme za něj odpovědnost. Dozvíme-li se o porušení práva, odkaz neprodleně odstraníme.",
      ],
    },
    {
      id: "app-stores",
      heading: "6. Obchody s aplikacemi",
      paragraphs: [
        "Získáte-li aplikaci myBestDays přes obchod s aplikacemi, platí navíc podmínky příslušného provozovatele obchodu. Provozovatel obchodu není smluvní stranou smlouvy mezi vámi a námi a nedluží podporu ani záruku za aplikaci.",
      ],
    },
  ],
};
