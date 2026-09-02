import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerský program",
  description: "Odporúčajte prevádzky, budujte tím a zarábajte na príjmoch z predplatného.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Ako to funguje",
      articles: [
        {
          slug: "ueberblick",
          title: "Prehľad partnerského programu",
          excerpt: "Kto sa môže zúčastniť, ako vzniká provízia a čo vidíte.",
          updated: "Stav k: september 2026",
          body: [
            {
              type: "p",
              text: "Ako partner odporúčate myNextDays prenajímateľom, agentúram a hotelom. Ak sa prevádzka zaregistruje s vaším kódom alebo cez váš odkaz a zaplatí svoje faktúry za predplatné, získate dvanásť mesiacov podiel na čistom príjme z predplatného. Stupnica podľa platiacich zákazníkov je k dispozícii na stránke programu.",
            },
            { type: "h2", text: "Kto sa môže stať partnerom" },
            {
              type: "ul",
              items: [
                "Fyzické osoby a firmy v EÚ, Švajčiarsku alebo Spojenom kráľovstve so skutočným kanálom k hostiteľom: influenceri, konzultanti, agentúry, daňové kancelárie, združenia.",
                "Aj samotní zákazníci myNextDays – predplatné nie je podmienkou.",
                "Povinné pri žiadosti: minimálne jeden účet na sociálnych médiách (Instagram, TikTok, YouTube, Facebook, LinkedIn …) s adresou, menom a dosahom. Webová stránka alebo newsletter sú vítané ako doplnok.",
              ],
            },
            { type: "h2", text: "Ako sa vám priradí prevádzka" },
            {
              type: "steps",
              items: [
                "Zdieľate svoj odkaz (mynextdays.com/p/VÁŠ-KÓD) alebo svoj kód.",
                "Prevádzka vidí kód pri registrácii v poli „Odporúčané od“ a potvrdí ho odoslaním – bez súboru cookie.",
                "S prvou zaplatenou faktúrou za predplatné začína dvanásťmesačné obdobie.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Svojich zákazníkov vidíte pseudonymne (Zákazník #1, #2 …) s krajinou, stavom a sumami – nikdy nie meno alebo e-mail. Prevádzka je priradená presne jednému partnerovi; vyhráva prvý.",
            },
            { type: "h2", text: "Čo nájdete na hlavnom paneli" },
            {
              type: "ul",
              items: [
                "Prehľad: poradie, kliknutia, registrované a platiace prevádzky, otvorené, vyplatiteľné a vyplatené provízie.",
                "Provízie: každá zaplatená faktúra za predplatné ako riadok so základom, sadzbou, sumou a stavom.",
                "Výplaty: mesačne za každú menu od minimálnej sumy, s dobropisom (self-billing) ako dokladom.",
                "Odkazy a materiály: vaše kódy, reklamné materiály a povinné označenie pre každú krajinu.",
                "Správy: priama linka k partnerskému tímu.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Budovanie tímu: provízia za tím",
          excerpt: "Získajte partnerov, ktorí sa pripoja s vaším kódom – a zarábajte na príjmoch ich zákazníkov.",
          updated: "Stav k: september 2026",
          body: [
            {
              type: "p",
              text: "Môžete získať ďalších partnerov do svojho tímu. Ak sa niekto prihlási cez váš tímový odkaz (mynextdays.com/p/VÁŠ-KÓD?team=1) a viditeľne zadá váš kód do žiadosti, po schválení sa stane súčasťou vášho tímu. Z čistého príjmu z predplatného zákazníkov vašich tímových partnerov získate tímovú províziu.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Tímová sadzba sa riadi VAŠOU pozíciou v čase platby – nie veľkosťou vášho tímu. Sadzby sú uvedené na stránke programu.",
                "Vaša pozícia vzniká len z vašich vlastných platiacich zákazníkov. Tímoví zákazníci sa do pozície nezapočítavajú.",
                "Presne jedna úroveň: vaši tímoví partneri si pod vami nevytvárajú vlastný tím.",
                "Žiadny účastnícky poplatok, žiadne peniaze za získanie partnera. Tímová provízia vzniká výlučne z plateného príjmu z predplatného.",
                "Dvanásť mesiacov od prvej zaplatenej faktúry príslušného tímového zákazníka, 30-dňové okno na vrátenie peňazí, storno pri vrátení peňazí alebo chargeback – rovnako ako pri vlastnej provízii.",
                "Tímová provízia vzniká len vtedy, ak ste vy a váš tímový partner schválení; inak bude pozastavená.",
              ],
            },
            { type: "h2", text: "Vyhodnotenie tímu" },
            {
              type: "p",
              text: "V časti „Tím“ vidíte každého tímového partnera s hodnosťou, platiacimi zákazníkmi, príjmami z predplatného od jeho zákazníkov (za 30 dní a celkovo) a vašou tímovou províziou z toho – otvorenou, splatnou, vyplatenou – ako aj vývoj za posledných dvanásť mesiacov. Podrobnosti o zákazníkoch vašich tímových partnerov nevidíte; tie patria im.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Cez „Tím“ môžete priamo kontaktovať svojich tímových partnerov správou – a váš sponzor vás.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Rovnaká e-mailová doména alebo rovnaký bankový účet medzi sponzorom a tímovým partnerom budú označené a skontrolované partnerským tímom predtým, ako bude vyplatená tímová provízia.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Výplata, dobropis a dane",
          excerpt: "Kedy sa provízia stane splatnou, ako vyzerá dobropis a čo platí z daňového hľadiska.",
          updated: "Stav: september 2026",
          body: [
            {
              type: "steps",
              items: [
                "Riadok provízie vzniká s uhradenou faktúrou za predplatné a je 30 dní „otvorený“ (obdobie na vrátenie peňazí).",
                "Potom je splatný. Prvého dňa v mesiaci zoskupíme všetky splatné riadky podľa meny.",
                "Ak je suma vyššia ako minimálna suma vašej meny, vznikne výplata s dobropisom (self-billing). Nemusíte vystavovať faktúru.",
                "Po prevode je výplata v dashboarde označená ako „Zaplatené“ s referenciou.",
              ],
            },
            {
              type: "ul",
              items: [
                "Firmy: Dobropis obsahuje poznámku o prenesení daňovej povinnosti; predpokladom je potvrdené IČ DPH (kontrola VIES).",
                "Súkromné osoby: Dobropis neuvádza DPH; provízia sa zdaňuje samostatne.",
                "Výplata cez SEPA, Wise alebo PayPal – údaje zadáte do profilu; zmeny vyžadujú vaše heslo.",
                "Žiadna konverzia: Provízia v DKK sa vypláca v DKK, provízia v EUR v EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklama musí byť rozpoznateľná ako reklama – na začiatku príspevku, v jazyku príspevku. Použité formulácie pre jednotlivé krajiny nájdete pod „Odkazy a materiály“. Porušenia môžu viesť k zablokovaniu.",
            },
          ],
        },
      ],
    },
  ],
};
