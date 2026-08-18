import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Prohlášení o přístupnosti",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "myBestDays má být použitelný pro každého. Toto prohlášení popisuje stav přístupnosti platformy, známá omezení a způsob, jak nám bariéry oznámit.",
    "Vztahuje se k požadavkům směrnice (EU) 2019/882 o požadavcích na přístupnost u výrobků a služeb, která se od 28. června 2025 vztahuje na služby elektronického obchodu.",
  ],
  sections: [
    {
      id: "stand",
      heading: "1. Stav přístupnosti",
      paragraphs: [
        "Řídíme se harmonizovanou normou EN 301 549 a pravidly Web Content Accessibility Guidelines (WCAG) 2.1, z nichž vychází, na úrovni shody AA.",
        "Zavedeno je mimo jiné: průběžná ovladatelnost klávesnicí, viditelné zaměření, sémantická struktura nadpisů, popisky u všech formulářových polí, textové alternativy ovládacích prvků, dostatečný barevný kontrast, škálovatelnost textu bez ztráty obsahu a zobrazení přizpůsobující se velikosti obrazovky.",
        "Právní texty jsou dostupné ve všech 24 úředních jazycích Unie a mají správné jazykové označení, aby je čtečky obrazovky správně přečetly.",
      ],
    },
    {
      id: "einschraenkungen",
      heading: "2. Známá omezení",
      paragraphs: ["Přístupné v současnosti nejsou zejména:"],
      list: [
        "Fotografie a popisy v inzerátech pocházejí od poskytovatelů; textové alternativy k fotografiím mohou chybět nebo být nedostatečné. Poskytovatele vyzýváme, aby je doplnili.",
        "Vložené mapové podklady třetích stran lze klávesnicí ovládat jen omezeně. Všechny údaje o poloze jsou k dispozici i jako text.",
        "Dokumenty nahrané poskytovateli (například domovní řád ve formátu PDF) nejsou průběžně označeny přístupným způsobem.",
      ],
    },
    {
      id: "unterkuenfte",
      heading: "3. Přístupnost ubytování",
      paragraphs: [
        "Toto prohlášení se týká platformy, nikoli ubytování. Údaje o stavební přístupnosti ubytování pocházejí od poskytovatele.",
        "Jste-li odkázáni na určité vlastnosti — bezbariérový přístup, šířka dveří, sprcha v úrovni podlahy, výtah —, vyjasněte si je před rezervací s poskytovatelem prostřednictvím funkce zpráv. Nesprávné údaje o přístupnosti jsou porušením našich pravidel a lze je oznámit.",
      ],
    },
    {
      id: "melden",
      heading: "4. Oznámení bariéry",
      paragraphs: [
        `Narazíte-li na bariéru, oznamte nám ji na ${ANBIETER.email} nebo kontaktními cestami uvedenými v části [Stížnosti a řešení sporů](https://mybestdays.dk/rechtliches/beschwerden).`,
        "Popište prosím, které stránky se to týká, co jste chtěli udělat a jaké pomůcky používáte. Přijetí potvrdíme a sdělíme vám, jak a do kdy bariéru odstraníme.",
        "Potřebujete-li informaci v přístupné podobě, poskytneme vám ji na vyžádání.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "5. Vymáhací řízení",
      paragraphs: [
        "Nejste-li s naší odpovědí spokojeni, můžete se obrátit na orgán příslušný pro dozor nad trhem podle směrnice (EU) 2019/882.",
        "Erhvervsstyrelsen | Markedsovervågning (dříve Sikkerhedsstyrelsen), Esbjerg Brygge 30, 6700 Esbjerg, Dánsko",
        "Telefon: [+45 33 73 20 00](tel:+4533732000) · [sik.dk](https://www.sik.dk/erhverv/tilgaengelighed-produkter-og-tjenester)",
      ],
    },
  ],
};
