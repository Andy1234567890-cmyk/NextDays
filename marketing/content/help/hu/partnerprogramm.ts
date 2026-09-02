import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Partnerprogram",
  description: "Ajánljon vállalkozásokat, építsen csapatot, és keressen pénzt az előfizetési bevételekből.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Így működik",
      articles: [
        {
          slug: "ueberblick",
          title: "A partnerprogram áttekintése",
          excerpt: "Ki vehet részt, hogyan keletkezik jutalék, és mit láthat.",
          updated: "Állapot: 2026. szeptember",
          body: [
            {
              type: "p",
              text: "Partnerként Ön a myNextDays-t ajánlja szállásadóknak, ügynökségeknek és szállodáknak. Ha egy vállalkozás az Ön kódjával vagy linkjén keresztül regisztrál, és kifizeti az előfizetési számláit, Ön tizenkét hónapon keresztül részesedést kap a nettó előfizetési bevételből. A fizető ügyfelek szerinti szint élőben látható a programoldalon.",
            },
            { type: "h2", text: "Ki lehet partner" },
            {
              type: "ul",
              items: [
                "Magánszemélyek és cégek az EU-ban, Svájcban vagy az Egyesült Királyságban, akik valódi kapcsolattal rendelkeznek a szállásadókkal: influencerek, tanácsadók, ügynökségek, adótanácsadó irodák, egyesületek.",
                "Akár a myNextDays ügyfelei is – az előfizetés nem feltétel.",
                "Jelentkezéshez kötelező: legalább egy közösségi média fiók (Instagram, TikTok, YouTube, Facebook, LinkedIn…) címmel, felhasználónévvel és eléréssel. Weboldal vagy hírlevél is szívesen látott.",
              ],
            },
            { type: "h2", text: "Hogyan rendelnek Önhöz egy vállalkozást" },
            {
              type: "steps",
              items: [
                "Megosztja a linkjét (mynextdays.com/p/AZ-ÖN-KÓDJA) vagy a kódját.",
                "A vállalkozás a regisztráció során látja a kódot az „Ajánló” mezőben, és elküldéssel megerősíti – cookie nélkül.",
                "Az első kifizetett előfizetési számlával kezdődik a tizenkét hónapos időszak.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ügyfeleit álnéven (Ügyfél #1, #2…) látja, országgal, státusszal és összegekkel – soha nem névvel vagy e-mail címmel. Egy vállalkozás pontosan egy partnerhez van rendelve; az első nyer.",
            },
            { type: "h2", text: "Mit talál a műszerfalon" },
            {
              type: "ul",
              items: [
                "Áttekintés: rang, kattintások, regisztrált és fizető vállalkozások, nyitott, kifizethető és kifizetett jutalék.",
                "Jutalékok: minden kifizetett előfizetési számla soronként alappal, rátával, összeggel és státusszal.",
                "Kifizetések: havonta, pénznemenként a minimális összegtől, jóváírással (önelszámolás) bizonylatként.",
                "Linkek és anyagok: az Ön kódjai, promóciós anyagok és az országonkénti kötelező jelölés.",
                "Üzenetek: közvetlen kapcsolat a partnercsapattal.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Csapatépítés: a csapatjutalék",
          excerpt: "Toborozzon partnereket, akik az Ön kódjával csatlakoznak – és keressen pénzt az ügyfeleik bevételeiből.",
          updated: "Állapot: 2026. szeptember",
          body: [
            {
              type: "p",
              text: "Más partnereket is bevonhat a csapatába. Ha valaki az Ön csapatlinkjén (mynextdays.com/p/AZ-ÖN-KÓDJA?team=1) keresztül jelentkezik, és a jelentkezésben jól láthatóan beírja az Ön kódját, a jóváhagyás után a csapatához tartozik. A csapatpartnerei ügyfeleinek nettó előfizetési bevétele után csapatjutalékot kap.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "A csapatráta az Ön rangjától függ a fizetés időpontjában – nem a csapata méretétől. A ráták a programoldalon találhatók.",
                "Az Ön rangja kizárólag az Ön saját fizető ügyfeleiből adódik. A csapatügyfelek nem számítanak a ranghoz.",
                "Pontosan egy szint: a csapatpartnerei nem építenek saját csapatot Ön alatt.",
                "Nincs részvételi díj, nincs pénz egy partner toborzásáért. A csapatjutalék kizárólag a kifizetett előfizetési bevételből származik.",
                "Tizenkét hónap az adott csapatügyfél első kifizetett számlájától, 30 napos visszatérítési időszak, visszavétel visszatérítés vagy visszaterhelés esetén – mint a saját jutaléknál.",
                "A csapatjutalék csak akkor keletkezik, ha Ön és csapattársa jóváhagyásra kerül; ellenkező esetben felfüggesztésre kerül.",
              ],
            },
            { type: "h2", text: "A csapatértékelés" },
            {
              type: "p",
              text: "A „Csapat” alatt minden csapattársat láthat ranggal, fizető ügyfelekkel, ügyfeleik előfizetési bevételével (30 nap és összesen), valamint az ebből származó csapatjutalékával – nyitott, kifizethető, kifizetett – és az elmúlt tizenkét hónap alakulásával. Csapattársai ügyféladatait nem láthatja; azok az övék.",
            },
            {
              type: "note",
              variant: "tip",
              text: "A „Csapat” menüpont alatt közvetlenül üzenetben érheti el csapattársait – és szponzora Önt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Az azonos e-mail domain vagy azonos bankszámlaszám a szponzor és a csapattárs között megjelölésre kerül, és a partnercsapat ellenőrzi, mielőtt a csapatjutalék kifizetésre kerül.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Kifizetés, jóváírás és adók",
          excerpt: "Mikor válik kifizethetővé a jutalék, hogyan néz ki a jóváírás, és mi vonatkozik az adózásra.",
          updated: "Állapot: 2026. szeptember",
          body: [
            {
              type: "steps",
              items: [
                "A jutalék sor a kifizetett előfizetési számlával jön létre, és 30 napig „nyitott” (visszatérítési időszak).",
                "Ezt követően kifizethető. A hónap első napján az összes kifizethető sort pénznemenként csoportosítjuk.",
                "Ha az összeg meghaladja az Ön pénznemének minimális összegét, kifizetés jön létre jóváírással (önelszámolás). Nem kell számlát kiállítania.",
                "Az átutalás után a kifizetés „Kifizetett” státuszban jelenik meg referenciával a műszerfalon.",
              ],
            },
            {
              type: "ul",
              items: [
                "Vállalatok: A jóváírás tartalmazza a fordított adózás megjegyzést; feltétel az igazolt adószám (VIES ellenőrzés).",
                "Magánszemélyek: A jóváírás nem tartalmaz áfát; a jutalékot saját maga kell adóznia.",
                "Kifizetés SEPA, Wise vagy PayPal útján – az adatokat a profilban adhatja meg; a változtatásokhoz jelszó szükséges.",
                "Nincs átváltás: A DKK-ban lévő jutalék DKK-ban kerül kifizetésre, az EUR-ban lévő jutalék EUR-ban.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A reklámnak felismerhetőnek kell lennie reklámként – a bejegyzés elején, a bejegyzés nyelvén. Az egyes országokra vonatkozó igazolt megfogalmazásokat a „Linkek és anyagok” alatt találja. A szabálysértések kizáráshoz vezethetnek.",
            },
          ],
        },
      ],
    },
  ],
};
