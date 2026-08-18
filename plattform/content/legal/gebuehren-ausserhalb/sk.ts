import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Poplatky mimo platformy",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto zásady upravujú, ktoré sumy smie poskytovateľ požadovať mimo Platformy a ktoré nie. Chránia hostí pred tým, aby na mieste čelili požiadavkám, ktoré neboli uvedené v inzeráte.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Zásada",
      paragraphs: [
        "Všetko, čo sa má za rezervovanú službu zaplatiť, musí byť pred dokončením rezervácie uvedené v inzeráte — buď ako súčasť celkovej ceny, alebo ako položka nákladov na mieste.",
        "Suma, ktorá nebola uvedená ani v celkovej cene, ani ako náklad na mieste, nie je hosťom dlžná.",
      ],
    },
    {
      id: "erlaubt",
      heading: "2. Čo možno požadovať na mieste",
      paragraphs: ["Na mieste možno požadovať výlučne:"],
      list: [
        "sumy výslovne uvedené v inzeráte ako náklady na mieste (napríklad záverečné upratovanie, balík bielizne, parkovacie miesto);",
        "miestne poplatky ako kúpeľný poplatok, pokiaľ sa podľa miestnych predpisov platí na mieste;",
        "zábezpeku uvedenú v inzeráte;",
        "služby, ktoré si hosť doobjedná až na mieste a dobrovoľne, za vopred uvedenú cenu;",
        "náhradu preukázaných škôd, ktoré hosť spôsobil.",
      ],
    },
    {
      id: "nicht-erlaubt",
      heading: "3. Čo požadovať nemožno",
      paragraphs: ["Neprípustné je najmä:"],
      list: [
        "dodatočná požiadavka na cenu za nocľah po dokončení rezervácie;",
        "poplatok za to, že rezervácia prebehla cez myBestDays;",
        "spracovateľský, rezervačný alebo kartový poplatok, ktorý nebol uvedený v inzeráte;",
        "výzva zrušiť rezerváciu a to isté ubytovanie znovu rezervovať mimo Platformy;",
        "výzva uhradiť cenu alebo jej časť prevodom, v hotovosti alebo platobnou službou mimo Platformy, keď inzerát predpokladá platbu cez Platformu.",
      ],
    },
    {
      id: "umgehung",
      heading: "4. Obchádzanie Platformy",
      paragraphs: [
        "Ak kontakt medzi hosťom a poskytovateľom vznikol cez Platformu, rezerváciu nemožno vybaviť mimo nej. Platí to pre obe strany.",
        "Kto obchádza Platformu, stráca jej ochranu: platby nie sú zabezpečené, naše zásady zrušenia a vrátenia peňazí sa neuplatnia a v prípade sporu nemôžeme sprostredkovať.",
        "Porušenia môžu viesť k zablokovaniu účtu. U poskytovateľov môžeme dodatočne uplatniť ušlý servisný poplatok.",
      ],
    },
    {
      id: "melden",
      heading: "5. Nahlásenie",
      paragraphs: [
        "Ak od Vás na mieste požadujú sumu, ktorá nebola uvedená v inzeráte, nezaplaťte ju a nahláste nám to cez kontaktné cesty uvedené v časti [Sťažnosti a riešenie sporov](https://mybestdays.dk/rechtliches/beschwerden). Ak ste už zaplatili, pomôžeme pri vymáhaní.",
      ],
    },
  ],
};
