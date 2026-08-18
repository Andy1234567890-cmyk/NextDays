import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady používání cookies",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto zásady vysvětlují, které cookies a podobné technologie myBestDays používá, k čemu, jak dlouho se uchovávají a jak je můžete ovládat.",
    "Doplňují [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Co jsou cookies",
      paragraphs: [
        "Cookies jsou malé textové soubory, které webová stránka ukládá do vašeho prohlížeče. Podobnými technologiemi jsou místní úložiště prohlížeče a sledovací pixely v e-mailech.",
        "Cookies nezbytně nutné pro provoz platformy smíme nastavit bez vašeho souhlasu. U všech ostatních si vyžádáme váš souhlas (čl. 5 odst. 3 směrnice 2002/58/ES).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Nezbytné cookies",
      paragraphs: [
        "Tyto cookies jsou pro provoz nezbytné a nelze je vypnout. V současnosti nastavujeme:",
      ],
      list: [
        "„nd_access“ — udržuje vaše přihlášení. Čitelný pouze pro server (HttpOnly), doba platnosti odpovídá platnosti relace.",
        "„nd_refresh“ — obnovuje vaše přihlášení, abyste se nemuseli stále znovu přihlašovat. Čitelný pouze pro server, doba platnosti 30 dnů.",
        "„nd_gast_locale“ — pamatuje si zvolený jazyk. Doba platnosti jeden rok.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funkční, statistické a marketingové cookies",
      paragraphs: [
        "myBestDays v současnosti nenastavuje cookies pro statistiku, měření návštěvnosti ani reklamu a nevkládá reklamní sítě ani analytické služby.",
        "Pokud by se to změnilo, vyžádáme si předem váš souhlas prostřednictvím dialogu, v němž je odmítnutí stejně snadné jako souhlas, a tyto zásady doplníme o konkrétní cookies.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Vložený obsah třetích stran",
      paragraphs: [
        "Na stránkách s podrobnostmi mohou být vloženy mapy. Takový obsah načítáme až poté, co jej výslovně aktivujete; teprve poté mohou být údaje přeneseny příslušnému poskytovateli.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Jak cookies ovládáte",
      paragraphs: [
        "Svůj souhlas můžete kdykoli změnit nebo odvolat v nastavení cookies v patičce.",
        "Cookies můžete navíc mazat nebo blokovat ve svém prohlížeči. Smažete-li nezbytné cookies, budete odhlášeni a platforma bude fungovat omezeně.",
      ],
    },
  ],
};
