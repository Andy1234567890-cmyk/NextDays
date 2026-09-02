import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerský program",
  description: "Doporučujte podniky, budujte tým a podílejte se na příjmech z předplatného.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Jak to funguje",
      articles: [
        {
          slug: "ueberblick",
          title: "Přehled partnerského programu",
          excerpt: "Kdo se může zúčastnit, jak vzniká provize a co uvidíte.",
          updated: "Stav k: září 2026",
          body: [
            {
              type: "p",
              text: "Jako partner doporučujete myNextDays pronajímatelům, agenturám a hotelům. Pokud se podnik zaregistruje s vaším kódem nebo přes váš odkaz a zaplatí faktury za předplatné, obdržíte po dobu dvanácti měsíců podíl z čistého obratu z předplatného. Stupnice podle platících zákazníků je k dispozici živě na stránce programu.",
            },
            { type: "h2", text: "Kdo se může stát partnerem" },
            {
              type: "ul",
              items: [
                "Fyzické osoby a firmy v EU, Švýcarsku nebo Spojeném království se skutečným kanálem k hostitelům: influenceři, poradci, agentury, daňové kanceláře, sdružení.",
                "Také samotní zákazníci myNextDays – předplatné není podmínkou.",
                "Povinné v žádosti: minimálně jeden účet na sociálních sítích (Instagram, TikTok, YouTube, Facebook, LinkedIn…) s adresou, uživatelským jménem a dosahem. Webové stránky nebo newsletter jsou vítány jako doplněk.",
              ],
            },
            { type: "h2", text: "Jak je vám podnik přiřazen" },
            {
              type: "steps",
              items: [
                "Sdílíte svůj odkaz (mynextdays.com/p/VÁŠ-KÓD) nebo svůj kód.",
                "Podnik vidí kód při registraci v poli „Doporučeno od“ a potvrdí jej odesláním – bez souboru cookie.",
                "Dvanáctiměsíční období začíná první zaplacenou fakturou za předplatné.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Své zákazníky vidíte pseudonymně (Zákazník #1, #2…) s zemí, stavem a částkami – nikdy jméno nebo e-mail. Podnik je přiřazen přesně jednomu partnerovi; vyhrává ten první.",
            },
            { type: "h2", text: "Co najdete na řídicím panelu" },
            {
              type: "ul",
              items: [
                "Přehled: pořadí, kliknutí, registrované a platící podniky, otevřené, vyplatitelné a vyplacené provize.",
                "Provize: každá zaplacená faktura za předplatné jako řádek se základem, sazbou, částkou a stavem.",
                "Výplaty: měsíčně za každou měnu od minimální částky, s dobropisem (self-billing) jako dokladem.",
                "Odkazy a materiály: vaše kódy, propagační materiály a povinné označení pro každou zemi.",
                "Zprávy: přímá linka k partnerskému týmu.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Budování týmu: týmová provize",
          excerpt: "Získávejte partnery, kteří se připojí s vaším kódem – a podílejte se na příjmech jejich zákazníků.",
          updated: "Stav k: září 2026",
          body: [
            {
              type: "p",
              text: "Můžete do svého týmu získat další partnery. Pokud se někdo přihlásí přes váš týmový odkaz (mynextdays.com/p/VÁŠ-KÓD?team=1) a viditelně zadá váš kód do žádosti, po schválení se stane součástí vašeho týmu. Z čistého obratu z předplatného zákazníků vašich týmových partnerů obdržíte týmovou provizi.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Týmová sazba se řídí VAŠÍM pořadím v době platby – nikoli velikostí vašeho týmu. Sazby jsou uvedeny na stránce programu.",
                "Vaše pořadí vzniká pouze z vašich vlastních platících zákazníků. Týmoví zákazníci se do pořadí nepočítají.",
                "Přesně jedna úroveň: vaši týmoví partneři si pod vámi nebudují vlastní tým.",
                "Žádný účastnický poplatek, žádné peníze za získání partnera. Týmová provize vzniká výhradně z placeného obratu z předplatného.",
                "Dvanáct měsíců od první zaplacené faktury příslušného týmového zákazníka, 30denní lhůta pro vrácení peněz, vrácení při vrácení peněz nebo chargeback – stejně jako u vlastní provize.",
                "Týmová provize vzniká pouze tehdy, když jste vy a váš týmový partner schváleni; jinak je pozastavena.",
              ],
            },
            { type: "h2", text: "Vyhodnocení týmu" },
            {
              type: "p",
              text: "V sekci „Tým“ uvidíte každého týmového partnera s hodností, platícími zákazníky, příjmy z předplatného jeho zákazníků (za 30 dní a celkem) a vaši týmovou provizi z toho – otevřenou, splatnou, vyplacenou – a také vývoj za posledních dvanáct měsíců. Podrobnosti o zákaznících vašich týmových partnerů nevidíte; ty patří jim.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Přes „Tým“ se můžete přímo spojit se svými týmovými partnery zprávou – a váš sponzor s vámi.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Stejná e-mailová doména nebo stejné bankovní spojení mezi sponzorem a týmovým partnerem budou označeny a zkontrolovány partnerským týmem, než bude týmová provize vyplacena.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Výplata, dobropis a daně",
          excerpt: "Kdy se provize stává splatnou, jak vypadá dobropis a co platí z daňového hlediska.",
          updated: "Stav: září 2026",
          body: [
            {
              type: "steps",
              items: [
                "Řádek provize vzniká s uhrazenou fakturou za předplatné a je 30 dní „otevřený“ (okno pro vrácení peněz).",
                "Poté je splatný. Prvního dne v měsíci shromažďujeme všechny splatné řádky podle měny.",
                "Pokud je součet vyšší než minimální částka vaší měny, vzniká výplata s dobropisem (self-billing). Nemusíte vystavovat fakturu.",
                "Po převodu se výplata zobrazí jako „Zaplaceno“ s referencí v dashboardu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Firmy: Dobropis obsahuje poznámku o reverse-charge; předpokladem je potvrzené DIČ (kontrola VIES).",
                "Soukromé osoby: Dobropis neuvádí DPH; provize je třeba zdanit samostatně.",
                "Výplata přes SEPA, Wise nebo PayPal – údaje zadáte do profilu; změny vyžadují vaše heslo.",
                "Žádná konverze: Provize v DKK bude vyplacena v DKK, provize v EUR v EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reklama musí být rozpoznatelná jako reklama – na začátku příspěvku, v jazyce příspěvku. Použité formulace pro každou zemi naleznete pod „Odkazy a materiály“. Porušení může vést k zablokování.",
            },
          ],
        },
      ],
    },
  ],
};
