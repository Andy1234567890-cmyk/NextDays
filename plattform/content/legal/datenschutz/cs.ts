import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zásady ochrany osobních údajů",
  stand: "Aktualizováno: 18. srpna 2026",
  intro: [
    "Tyto zásady popisují, které osobní údaje myBestDays zpracovává, k jakým účelům, na jakém právním základě a jaká práva máte. Platí pro internetové stránky, mobilní aplikace a všechny další přístupy k platformě.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Správce a pověřenec pro ochranu osobních údajů",
      paragraphs: [
        `Správcem ve smyslu nařízení (EU) 2016/679 (GDPR) je ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dánsko, CVR č. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Úplné údaje o poskytovateli jsou uvedeny v [Právních informacích](https://mybestdays.dk/rechtliches/impressum).`,
        "Pověřenec pro ochranu osobních údajů nebyl jmenován; podmínky článku 37 GDPR nejsou splněny. Dotazy k ochraně osobních údajů směřujte na výše uvedenou e-mailovou adresu.",
        "Poskytovatelé, u nichž rezervujete, jsou pro údaje, které od nás obdrží, samostatnými správci. Vztahují se na ně [Standardy ochrany osobních údajů pro hostitele](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Které údaje zpracováváme",
      paragraphs: ["Podle toho, jak platformu užíváte, zpracováváme:"],
      list: [
        "základní údaje — jméno, e-mailová adresa, telefonní číslo, jazyk a měna, heslo v zašifrované podobě;",
        "údaje o rezervaci — rezervované ubytování, období, počet a jména cestujících, zvláštní přání, stav rezervace;",
        "platební údaje — částka, měna, stav platby, poslední číslice platebního prostředku a identifikátor transakce našeho poskytovatele platebních služeb. Úplné údaje o kartách se k nám nedostávají;",
        "komunikační údaje — zprávy mezi vámi a poskytovatelem, dotazy na náš zákaznický servis, stížnosti;",
        "obsahové údaje — hodnocení, fotografie, seznamy přání;",
        "údaje o užívání — navštívené stránky, vyhledávací dotazy, čas přístupu;",
        "technické údaje — IP adresa, identifikátory prohlížeče a zařízení, operační systém, odkazující stránka.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Účely a právní základy",
      paragraphs: [
        "Poskytování platformy, účet, vyhledávání, rezervace, zpracování plateb a komunikace s poskytovatelem — čl. 6 odst. 1 písm. b) GDPR (smlouva nebo předsmluvní opatření).",
        "Zákaznický servis, vyřizování stížností a řešení sporů — čl. 6 odst. 1 písm. b) a f) GDPR.",
        "Odhalování a prevence podvodů, zneužití a bezpečnostních incidentů, prosazování našich podmínek — čl. 6 odst. 1 písm. f) GDPR (oprávněný zájem na bezpečném tržišti).",
        "Hodnocení a jejich zveřejnění — čl. 6 odst. 1 písm. b) a f) GDPR.",
        "Plnění právních povinností, zejména obchodních a daňových povinností uchovávání, oznamovací povinnosti podle směrnice (EU) 2021/514 (DAC7) a povinností podle nařízení (EU) 2022/2065 — čl. 6 odst. 1 písm. c) GDPR.",
        "Zlepšování platformy analýzou agregovaných údajů o užívání — čl. 6 odst. 1 písm. f) GDPR.",
        "Reklamní e-maily a cookies, které nejsou nezbytné — čl. 6 odst. 1 písm. a) GDPR (souhlas), který můžete kdykoli odvolat s účinností do budoucna.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Příjemci",
      paragraphs: [
        "Poskytovatelé obdrží údaje, které potřebují k provedení vaší rezervace a ke splnění svých právních povinností — zejména jméno, kontaktní údaje, období, počet cestujících a vaše zprávy jim určené.",
        "Náš poskytovatel platebních služeb Stripe zpracovává platební údaje jako samostatný správce; navíc platí [zásady ochrany osobních údajů Stripe](https://stripe.com/privacy).",
        "Poskytovatelé služeb, kteří pro nás zajišťují hosting, provoz databází, rozesílání e-mailů, diagnostiku chyb a nástroje zákaznického servisu, zpracovávají údaje výhradně podle našich pokynů na základě smlouvy podle článku 28 GDPR.",
        "Orgány a soudy obdrží údaje jen v rozsahu, v jakém jsme k tomu povinni; viz [Pravidla pro žádosti orgánů a orgánů činných v trestním řízení](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Správci daně obdrží údaje o poskytovatelích oznamované podle DAC7.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Předávání do třetích zemí",
      paragraphs: [
        "Naše servery i servery našich zpracovatelů se nacházejí v Evropské unii.",
        "Dochází-li v jednotlivých případech ke zpracování mimo Evropský hospodářský prostor, děje se tak pouze na základě rozhodnutí Evropské komise o odpovídající ochraně nebo standardních smluvních doložek podle čl. 46 odst. 2 písm. c) GDPR spolu s doplňujícími zárukami.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Doby uchovávání",
      paragraphs: [
        "Údaje účtu uchováváme, dokud váš účet trvá, a poté je mažeme, nebrání-li tomu povinnost uchovávání.",
        "Údaje o rezervaci a platbě podléhají obchodním a daňovým lhůtám uchovávání; podle dánského účetního práva jsou to zpravidla pět let od konce účetního období, jehož se údaje týkají.",
        "Zprávy k rezervaci uchováváme až tři roky po skončení pobytu, aby bylo možné vyjasnit spory.",
        "Hodnocení zůstávají po smazání vašeho účtu v anonymizované podobě, protože tvoří součást hodnoticího základu ubytování.",
        "Údaje o případech podvodu a zneužití uchováváme tak dlouho, jak je nutné k odvrácení dalších porušení, nejdéle však tři roky od posledního případu.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Vaše práva",
      paragraphs: ["Podle GDPR máte tato práva:"],
      list: [
        "přístup k údajům o vás uloženým (článek 15);",
        "opravu nesprávných údajů (článek 16);",
        "výmaz (článek 17), nebrání-li tomu povinnost uchovávání;",
        "omezení zpracování (článek 18);",
        "přenositelnost údajů (článek 20);",
        "námitku proti zpracování založenému na oprávněných zájmech (článek 21), zejména proti přímému marketingu;",
        "odvolání uděleného souhlasu s účinností do budoucna (čl. 7 odst. 3);",
        `stížnost u dozorového úřadu (článek 77) — příslušný je úřad vašeho bydliště, pracoviště nebo místa údajného porušení. V sídle správce je to ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, Dánsko, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Jak svá práva uplatníte",
      paragraphs: [
        `Mnoho údajů můžete zobrazit, změnit nebo smazat přímo ve svém účtu. Ve všem ostatním se obraťte na ${ANBIETER.email}.`,
        "Odpovídáme neprodleně, nejpozději do jednoho měsíce. Nemůžeme-li lhůtu dodržet, sdělíme vám to s odůvodněním.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatizovaná rozhodnutí",
      paragraphs: [
        "Používáme automatizované postupy k odhalování podvodů, zneužití a protiprávního obsahu. Vede-li takový postup k opatření vůči vašemu účtu nebo obsahu, odůvodníme jej a můžete požadovat přezkum člověkem.",
        "Rozhodnutí založené výhradně na automatizovaném zpracování s právními účinky ve smyslu článku 22 GDPR nečiníme.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Povinnost poskytnout údaje",
      paragraphs: [
        "Údaje potřebné k rezervaci musíte poskytnout; bez nich nelze uzavřít smlouvu ani poskytnout ubytování. Všechny ostatní údaje jsou dobrovolné.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Změny těchto zásad",
      paragraphs: [
        "Tyto zásady upravujeme, změní-li se zpracování nebo právní stav. Aktuálně platné znění je dostupné zde; datum aktualizace je uvedeno nahoře.",
      ],
    },
  ],
};
