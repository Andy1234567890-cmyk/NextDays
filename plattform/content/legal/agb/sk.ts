import type { LegalDoc } from "../types";

// Slowakische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. Zielgruppe sind Verbraucher (Gäste).
export const agb: LegalDoc = {
  title: "Podmienky používania pre hostí (VOP)",
  stand: "Stav ku dňu: 3. júla 2026",
  intro: [
    "Tieto podmienky používania upravujú používanie rezervačného portálu myBestDays (ďalej len „platforma“) cestujúcimi a objednávateľmi (ďalej len „hosť“).",
    "Prevádzkovateľom platformy je [úplné obchodné meno, právna forma, adresa a registrové údaje prevádzkovateľa — doplniť pred zverejnením] (ďalej len „myBestDays“ alebo „my“).",
  ],
  sections: [
    {
      heading: "§ 1 Rozsah pôsobnosti",
      paragraphs: [
        "Tieto podmienky sa vzťahujú na používanie platformy, najmä na vyhľadávanie ubytovania a rezerváciu ubytovacích služieb prostredníctvom platformy.",
        "Na samotnú ubytovaciu službu sa navyše vzťahujú podmienky príslušného poskytovateľa (napr. domový poriadok, storno podmienky), ktoré sú uvedené v ponuke.",
      ],
    },
    {
      heading: "§ 2 Úloha myBestDays; uzavretie zmluvy",
      paragraphs: [
        "myBestDays sprostredkúva ubytovacie služby, ktoré ponúkajú príslušní poskytovatelia (agentúry, prenajímatelia alebo vlastníci, ďalej len „poskytovateľ“). Zmluva o ubytovaní sa uzatvára výlučne medzi hosťom a príslušným poskytovateľom. myBestDays sa nestáva zmluvnou stranou zmluvy o ubytovaní.",
        "Príslušný poskytovateľ je uvedený v ponuke a v potvrdení rezervácie.",
      ],
    },
    {
      heading: "§ 3 Rezervácia a potvrdenie rezervácie",
      paragraphs: [
        "Prezentácia ubytovaní na platforme predstavuje výzvu na predloženie ponuky na rezerváciu. Dokončením rezervačného procesu (kliknutím na rezervačné tlačidlo spojené s povinnosťou platby) predkladá hosť záväznú ponuku na uzavretie zmluvy o ubytovaní s poskytovateľom.",
        "Zmluva je uzavretá potvrdením rezervácie. Potvrdenie rezervácie sa hosťovi zasiela na ním uvedenú e-mailovú adresu.",
        "Hosť je povinný pri rezervácii uviesť správne a úplné údaje (najmä meno, kontaktné údaje a počet cestujúcich).",
      ],
    },
    {
      heading: "§ 4 Ceny a platba",
      paragraphs: [
        "Platia ceny uvedené v ponuke v čase rezervácie vrátane daní, poplatkov a dodatočných nákladov, ktoré sú v nej uvedené. Ceny sa zobrazujú v mene uvedenej v ponuke. Na mieste môžu vzniknúť ďalšie miestne poplatky (napr. miestna daň za ubytovanie), pokiaľ je to uvedené v ponuke.",
        "Platba sa spracúva prostredníctvom poskytovateľa platobných služieb Stripe. Platobné údaje (napr. údaje o karte) získava a spracúva priamo Stripe; myBestDays neukladá úplné údaje o karte. Stripe spracúva osobné údaje v súlade so [zásadami ochrany osobných údajov spoločnosti Stripe](https://stripe.com/privacy).",
        "Ak je v ponuke uvedená kaucia, môže byť pri rezervácii alebo pri príchode predautorizovaná a v prípade škody úplne alebo čiastočne zadržaná; rozhodujúce sú údaje uvedené v ponuke.",
      ],
    },
    {
      heading: "§ 5 Stornovanie, zmena rezervácie a odstúpenie od zmluvy",
      paragraphs: [
        "Či a za akých podmienok možno rezerváciu bezplatne stornovať alebo zmeniť, sa riadi storno podmienkami poskytovateľa uvedenými v ponuke.",
        "Pri ubytovacích službách rezervovaných na konkrétne obdobie spravidla neexistuje zákonné právo na odstúpenie od zmluvy podľa čl. 16 písm. l) smernice EÚ o právach spotrebiteľov, resp. zodpovedajúcich vnútroštátnych predpisov. Kogentné zákonné práva hosťa zostávajú nedotknuté.",
      ],
    },
    {
      heading: "§ 6 Povinnosti hosťa",
      paragraphs: [
        "Hosť užíva ubytovanie v súlade so zmluvou, dodržiava maximálnu obsadenosť uvedenú v ponuke a rešpektuje domový poriadok poskytovateľa.",
        "Platforma sa nesmie zneužívať, najmä nie na fiktívne rezervácie, podvodné platby alebo zverejňovanie protiprávneho obsahu (napr. v recenziách alebo správach).",
      ],
    },
    {
      heading: "§ 7 Zodpovednosť myBestDays",
      paragraphs: [
        "Za poskytnutie ubytovacej služby zodpovedá výlučne poskytovateľ. myBestDays nezodpovedá za správnosť obsahu ponúk vložených poskytovateľmi, sprostredkovanie a spracovanie platieb však vykonáva so starostlivosťou riadneho obchodníka.",
        "myBestDays zodpovedá neobmedzene za úmysel a hrubú nedbanlivosť, ako aj za škody vzniknuté ujmou na živote, tele alebo zdraví. Pri ľahkej nedbanlivosti zodpovedá myBestDays len za porušenie podstatných zmluvných povinností (kardinálnych povinností), a to v rozsahu obmedzenom na predvídateľnú škodu typickú pre daný typ zmluvy. Kogentné zákonné pravidlá zodpovednosti zostávajú nedotknuté.",
      ],
    },
    {
      heading: "§ 8 Ochrana osobných údajov",
      paragraphs: [
        "myBestDays spracúva osobné údaje hosťa na účely sprostredkovania a rezervácie. Rezervačné údaje sa odovzdávajú príslušnému poskytovateľovi v rozsahu potrebnom na plnenie zmluvy o ubytovaní. Na spracovanie platieb sa vzťahuje § 4.",
        "Podrobnosti vyplývajú z informácií o ochrane osobných údajov platformy.",
      ],
    },
    {
      heading: "§ 9 Reklamácie a riešenie sporov",
      paragraphs: [
        "Výhrady týkajúce sa ubytovania adresuje hosť najprv poskytovateľovi; pri otázkach k rezervácii alebo platbe pomôže podpora myBestDays prostredníctvom kontaktných kanálov uvedených na platforme.",
        "myBestDays nie je povinná ani ochotná zúčastňovať sa na riešení sporov pred subjektom alternatívneho riešenia spotrebiteľských sporov, pokiaľ jej takáto povinnosť nevyplýva zo zákona.",
      ],
    },
    {
      heading: "§ 10 Zmeny týchto podmienok",
      paragraphs: [
        "myBestDays môže tieto podmienky zmeniť s účinnosťou do budúcnosti, pokiaľ je to potrebné zo závažných dôvodov (najmä pri zmenách právnych predpisov alebo judikatúry) a hosť tým nie je neprimerane znevýhodnený. Na už uzavreté rezervácie sa vzťahuje znenie účinné v čase rezervácie.",
      ],
    },
    {
      heading: "§ 11 Záverečné ustanovenia",
      paragraphs: [
        "Uplatňuje sa právo štátu, v ktorom má prevádzkovateľ platformy svoje sídlo, s vylúčením Dohovoru OSN o zmluvách o medzinárodnej kúpe tovaru. Ak je hosť spotrebiteľom, kogentné predpisy na ochranu spotrebiteľa štátu, v ktorom má hosť svoj obvyklý pobyt, zostávajú nedotknuté.",
        "Ak by jednotlivé ustanovenia týchto podmienok boli alebo sa stali neplatnými, platnosť ostatných ustanovení tým zostáva nedotknutá.",
      ],
    },
  ],
};
