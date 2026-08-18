import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Pravidla pro žádosti orgánů a orgánů činných v trestním řízení",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tato pravidla jsou určena orgánům, soudům a orgánům činným v trestním řízení, které od myBestDays požadují údaje nebo směřují příkaz proti obsahu. Zveřejňujeme je zde, aby si i uživatelé mohli přečíst, za jakých podmínek údaje vydáváme.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Údaje uživatelů vydáváme pouze tehdy, existuje-li platný právní základ a splňuje-li žádost formální požadavky. Neformální žádost o údaje nestačí.",
        "Každou žádost posuzujeme z hlediska příslušnosti, právního základu, určitosti a přiměřenosti a vydáváme pouze údaje, které žádost označuje.",
      ],
    },
    {
      id: "anforderungen",
      heading: "2. Náležitosti žádosti",
      paragraphs: ["Žádost by měla obsahovat:"],
      list: [
        "žádající orgán, spisovou značku a kontaktní údaje vyřizující osoby na úředním hlavičkovém papíře;",
        "právní základ podle vnitrostátního práva nebo práva Unie;",
        "přesné označení dotčené osoby nebo dotčeného účtu — e-mailovou adresu, číslo rezervace nebo URL inzerátu;",
        "přesně označené údaje a období;",
        "případně soudní příkaz, vyžaduje-li jej rozhodné právo;",
        "upozornění, pokud by vyrozumění dotčené osoby ohrozilo vyšetřování, s uvedením právního základu.",
      ],
    },
    {
      id: "anordnungen",
      heading: "3. Příkazy podle nařízení (EU) 2022/2065",
      paragraphs: [
        "Příkazy k zakročení proti protiprávnímu obsahu (článek 9) a příkazy k poskytnutí informací (článek 10) musí obsahovat tam uvedené údaje, zejména právní základ, přesné elektronické umístění, odůvodnění, opravné prostředky a jazyk.",
        "Přijetí potvrdíme a orgánu, který příkaz vydal, sdělíme, jaká opatření jsme přijali a kdy.",
        "O příkazu vyrozumíme dotčenou osobu nejpozději v okamžiku jeho provedení, nenařídí-li orgán s uvedením právního základu odklad.",
      ],
    },
    {
      id: "notfaelle",
      heading: "4. Naléhavé případy",
      paragraphs: [
        "Hrozí-li bezprostřední nebezpečí pro život nebo tělesnou nedotknutelnost, vydáme údaje nezbytné k jeho odvrácení i bez předchozího formálního příkazu. Takovou žádost výslovně označte jako naléhavou a nebezpečí popište.",
        "Existují-li poznatky nasvědčující trestnému činu ohrožujícímu život nebo bezpečnost osoby, vyrozumíme příslušné orgány z vlastního podnětu (článek 18 nařízení (EU) 2022/2065).",
      ],
    },
    {
      id: "was-wir-haben",
      heading: "5. Které údaje uchováváme",
      paragraphs: [
        "Které kategorie údajů zpracováváme a jak dlouho je uchováváme, uvádějí [Zásady ochrany osobních údajů](https://mybestdays.dk/rechtliches/datenschutz). Nad tam uvedené lhůty žádné údaje neuchováváme.",
        "Uchovávání údajů nad rámec potřeby neprobíhá. Výzvu k dočasnému zajištění údajů pro probíhající řízení splníme v právně přípustném rozsahu.",
        "Úplné platební údaje nemáme k dispozici; je třeba je vyžádat u poskytovatele platebních služeb.",
      ],
    },
    {
      id: "unterrichtung",
      heading: "6. Vyrozumění dotčené osoby",
      paragraphs: [
        "Dotčené uživatele o žádosti týkající se jejich údajů vyrozumíme, ledaže to zakazuje právní předpis nebo odůvodněný příkaz orgánu nebo hrozí bezprostřední nebezpečí pro život či tělesnou nedotknutelnost.",
      ],
    },
    {
      id: "kontakt",
      heading: "7. Kam žádosti směřovat",
      paragraphs: [
        "Žádosti směřujte na jednotné kontaktní místo pro orgány uvedené v části [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa). Vyřizujeme je v němčině a angličtině.",
      ],
    },
    {
      id: "transparenz",
      heading: "8. Transparentnost",
      paragraphs: [
        "Počet a druh příkazů orgánů uvádíme ve své výroční zprávě o transparentnosti; viz [Nařízení o digitálních službách](https://mybestdays.dk/rechtliches/dsa#transparenz).",
      ],
    },
  ],
};
