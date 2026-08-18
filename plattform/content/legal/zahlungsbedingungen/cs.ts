import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Platební podmínky",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto platební podmínky upravují, jak se vyřizují platby související s rezervací přes myBestDays. Doplňují [Podmínky použití pro hosty](https://mybestdays.dk/rechtliches/nutzungsbedingungen); při rozporu v platebních otázkách mají přednost tyto platební podmínky.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Naše role při platbě",
      paragraphs: [
        "myBestDays vyřizuje platby jménem poskytovatele. Nejsme platební institucí ani institucí elektronických peněz; samotnou platební službu poskytuje náš poskytovatel platebních služeb.",
        "Platby přes platformu vyřizuje Stripe (Stripe Payments Europe, Limited). Údaje o kartách a další platební údaje shromažďuje a zpracovává přímo Stripe. myBestDays neuchovává úplné údaje o kartách.",
        "Platíte-li přes platformu, považuje se vaše platební povinnost vůči poskytovateli za splněnou ve výši uhrazené částky, jakmile je platba úspěšně autorizována a stržena naším poskytovatelem platebních služeb.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Platební způsoby",
      paragraphs: [
        "Které platební způsoby jsou k dispozici, závisí na inzerátu, na zemi poskytovatele a na vaší zemi. Dostupné způsoby se zobrazují před dokončením rezervace.",
        "U některých platebních způsobů je vyžadováno silné ověření zákazníka podle směrnice (EU) 2015/2366. Bez úspěšného ověření nelze platbu provést.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Splatnost, záloha a doplatek",
      paragraphs: [
        "Kdy je která částka splatná, určuje poskytovatel v inzerátu. Obvyklé jsou tři modely: plná platba při rezervaci, záloha při rezervaci s doplatkem před příjezdem, nebo platba na místě poskytovateli.",
        "Model platný pro vaši rezervaci a termíny splatnosti se zobrazují před dokončením rezervace a opakují se v potvrzení rezervace.",
        "Před splatností doplatku vám zašleme připomenutí na uvedenou e-mailovou adresu. Nebude-li doplatek uhrazen, může poskytovatel podle svých storno podmínek od smlouvy odstoupit.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Měna",
      paragraphs: [
        "Vyúčtování probíhá v měně inzerátu. Tato měna je uvedena u každé ceny a v platebním procesu.",
        "Je-li částka zobrazena navíc v jiné měně, jde o nezávazný orientační přepočet, nikoli o závaznou cenu.",
        "Přepočítává-li váš poskytovatel platebních služeb do jiné měny nebo účtuje poplatek za zahraniční transakci, nesete tyto náklady vy. Nejsou součástí celkové ceny a my je nestanovujeme ani nevybíráme.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Kauce",
      paragraphs: [
        "Počítá-li inzerát s kaucí, je její výše uvedena před dokončením rezervace.",
        "Podle inzerátu se kauce na vašem platebním prostředku předautorizuje (částka se rezervuje, ale nestrhne) nebo strhne. Předautorizace může dočasně snížit dostupný limit vaší karty.",
        "Po pobytu se předautorizace uvolní nebo se stržená kauce vrátí, pokud poskytovatel neuplatní škodu. Uplatní-li škodu, musí ji doložit; o oprávněnosti nároku se rozhoduje ve vztahu mezi vámi a poskytovatelem.",
        "Požaduje-li poskytovatel kauci namísto toho na místě, jde o položku nákladů na místě a nevyřizuje se přes platformu.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Vrácení peněz",
      paragraphs: [
        "Vrácení peněz probíhá na platební prostředek použitý k platbě, není-li dohodnuto jinak nebo není-li to technicky možné.",
        "Vrácení iniciujeme neprodleně, jakmile je jeho důvod postaven najisto. Jak dlouho trvá, než se připsání projeví na vašem účtu nebo kartě, určuje váš poskytovatel platebních služeb; obvyklých je pět až deset bankovních pracovních dnů.",
        "Zda a v jakém rozsahu existuje nárok na vrácení, se řídí [Storno podmínkami](https://mybestdays.dk/rechtliches/stornierungsbedingungen) a [Zásadami přeubytování a vrácení peněz](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Neúspěšné platby a zpětné strhávání",
      paragraphs: [
        "Selže-li platba, informujeme vás a dáme vám možnost uložit jiný platební prostředek. Nebude-li platba provedena, může být rezervace zrušena.",
        "Necháte-li si již provedenou platbu zpětně strhnout, aniž by existoval nárok na vrácení, může poskytovatel částku nadále požadovat. Náklady, které nám neoprávněným zpětným stržením vzniknou, vám můžeme vyúčtovat.",
        "Považujeme-li platbu za podvodnou, můžeme ji zadržet nebo rezervaci zrušit. Informujeme vás o tom a rozhodnutí odůvodníme.",
      ],
    },
    {
      id: "belege",
      heading: "8. Doklady a vyúčtování",
      paragraphs: [
        "K částkám uhrazeným přes platformu poskytujeme doklad, který si můžete stáhnout ve svém účtu v části „Rezervace“.",
        "Fakturu za ubytovací službu vystavuje poskytovatel; je poskytujícím podnikatelem. K daním viz [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Změny těchto platebních podmínek",
      paragraphs: [
        "Na změny těchto platebních podmínek se použije oddíl A22 [Podmínek použití](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
