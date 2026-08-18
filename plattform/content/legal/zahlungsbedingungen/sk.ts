import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Platobné podmienky",
  stand: "Aktualizované: 18. augusta 2026",
  intro: [
    "Tieto platobné podmienky upravujú, ako sa vybavujú platby v súvislosti s rezerváciou cez myBestDays. Dopĺňajú [Podmienky používania pre hostí](https://mybestdays.dk/rechtliches/nutzungsbedingungen); pri rozporoch v otázkach platby majú prednosť tieto platobné podmienky.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Naša úloha pri platbe",
      paragraphs: [
        "myBestDays vybavuje platby v mene poskytovateľa. Nie sme platobnou inštitúciou ani inštitúciou elektronických peňazí; samotnú platobnú službu poskytuje náš poskytovateľ platobných služieb.",
        "Platby cez Platformu vybavuje Stripe (Stripe Payments Europe, Limited). Údaje o kartách a ostatné platobné údaje zbiera a spracúva priamo Stripe. myBestDays neukladá úplné údaje o kartách.",
        "Ak platíte cez Platformu, Vaša platobná povinnosť voči poskytovateľovi sa vo výške uhradenej sumy považuje za splnenú, len čo je platba úspešne autorizovaná a inkasovaná naším poskytovateľom platobných služieb.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Spôsoby platby",
      paragraphs: [
        "Ktoré spôsoby platby sú k dispozícii, závisí od inzerátu, od krajiny poskytovateľa a od Vašej krajiny. Dostupné spôsoby platby sa Vám zobrazia pred dokončením rezervácie.",
        "Pri určitých spôsoboch platby je potrebné silné overenie zákazníka podľa smernice (EÚ) 2015/2366. Bez úspešného overenia nemožno platbu vykonať.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Splatnosť, záloha a doplatok",
      paragraphs: [
        "Kedy je splatná ktorá suma, určuje poskytovateľ v inzeráte. Bežné sú tri modely: plná platba pri rezervácii, záloha pri rezervácii s doplatkom pred príchodom, alebo platba na mieste u poskytovateľa.",
        "Model platný pre Vašu rezerváciu a termíny splatnosti sa zobrazia pred dokončením rezervácie a zopakujú sa v potvrdení rezervácie.",
        "Pred splatnosťou doplatku Vám pošleme pripomienku na uvedenú e-mailovú adresu. Ak doplatok nepríde, poskytovateľ môže podľa svojich storno podmienok od zmluvy odstúpiť.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Mena",
      paragraphs: [
        "Účtuje sa v mene inzerátu. Táto mena je uvedená pri každej cene aj v platobnom procese.",
        "Ak sa Vám suma zobrazí aj v inej mene, ide o nezáväzný prepočet na orientáciu, nie o záväznú cenu.",
        "Ak Váš poskytovateľ platobných služieb prepočíta na inú menu alebo si účtuje poplatok za zahraničnú transakciu, tieto náklady znášate Vy. Nie sú súčasťou celkovej ceny a ani ich neurčujeme, ani ich nevyberáme.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Zábezpeka",
      paragraphs: [
        "Ak inzerát predpokladá zábezpeku, jej výška sa uvádza pred dokončením rezervácie.",
        "Podľa inzerátu sa zábezpeka na Vašom platobnom prostriedku predautorizuje (suma sa zablokuje, ale neodpíše) alebo sa inkasuje. Predautorizácia môže dočasne znížiť dostupný limit Vašej karty.",
        "Po pobyte sa predautorizácia uvoľní alebo sa inkasovaná zábezpeka vráti, pokiaľ poskytovateľ neuplatní škodu. Ak poskytovateľ uplatní škodu, musí ju preukázať; o oprávnenosti rozhoduje vzťah medzi Vami a poskytovateľom.",
        "Ak poskytovateľ požaduje zábezpeku namiesto toho na mieste, je to položka nákladov na mieste a nevybavuje sa cez Platformu.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Vrátenie peňazí",
      paragraphs: [
        "Vrátenie peňazí sa vykonáva na platobný prostriedok použitý na platbu, pokiaľ nie je dohodnuté inak alebo to nie je technicky možné.",
        "Vrátenie iniciujeme bezodkladne, len čo je jeho dôvod zistený. Ako dlho potrvá, kým sa pripísanie zobrazí na Vašom účte alebo karte, určuje Váš poskytovateľ platobných služieb; bežne päť až desať bankových pracovných dní.",
        "Či a v akej výške existuje nárok na vrátenie, sa riadi [Storno podmienkami](https://mybestdays.dk/rechtliches/stornierungsbedingungen) a [Zásadami zmeny rezervácie a vrátenia peňazí](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Neúspešné platby a stornovania",
      paragraphs: [
        "Ak platba zlyhá, informujeme Vás a dáme Vám možnosť zadať iný platobný prostriedok. Ak platba nepríde, rezervácia môže byť zrušená.",
        "Ak stornujete už vykonanú platbu bez toho, aby existoval nárok na vrátenie, poskytovateľ môže sumu naďalej požadovať. Náklady, ktoré nám vzniknú neoprávneným stornovaním, Vám môžeme vyúčtovať.",
        "Ak platbu považujeme za podvodnú, môžeme ju zadržať alebo rezerváciu zrušiť. Informujeme Vás o tom a rozhodnutie odôvodníme.",
      ],
    },
    {
      id: "belege",
      heading: "8. Doklady a vyúčtovania",
      paragraphs: [
        "Za sumy uhradené cez Platformu Vám poskytneme doklad, ktorý nájdete vo svojom účte v časti „Rezervácie“.",
        "Faktúru za ubytovaciu službu vystavuje poskytovateľ; on je poskytujúcim podnikateľom. K daniam pozri [Daňové zásady](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Zmeny týchto platobných podmienok",
      paragraphs: [
        "Na zmeny týchto platobných podmienok sa vzťahuje oddiel A22 [Podmienok používania](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};
