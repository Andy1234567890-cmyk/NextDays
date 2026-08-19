import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervace a objednávky",
  description: "Spravujte, přesouvejte a rušte rezervace.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervace",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Ruční zadání rezervace",
          excerpt:
            "Jak zadat telefonickou nebo e-mailovou rezervaci přímo do myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Kdy zadávat rezervaci ručně" },
            {
              type: "p",
              text: "Ne každá rezervace přichází přes portál nebo vaši vlastní platformu — poptávky po telefonu, e-mailu nebo na místě musíte založit sami, aby bylo objekt v myNextDays správně zablokován a nedošlo k dvojímu obsazení.",
            },
            {
              type: "steps",
              items: [
                "Otevřete Rezervace a klikněte na „Nová rezervace“.",
                "Vyberte objekt — každý objekt v myNextDays je jedna samostatná rezervovatelná jednotka, tedy konkrétní pokoj nebo ubytovací jednotka.",
                "Zadejte datum příjezdu a odjezdu a počet hostů.",
                "Vyplňte údaje o hostovi (jméno, kontakt, případně adresu pro fakturu).",
                "Zkontrolujte navrženou cenu a v případě potřeby ji upravte.",
                "Uložte rezervaci — noci se okamžitě zablokují v kalendáři.",
              ],
            },
            { type: "h2", text: "Platba a potvrzení" },
            {
              type: "p",
              text: "Po uložení platí stejná platební pravidla jako u online rezervací. Pokud je propojen platební poskytovatel, můžete hostovi rovnou zaslat platební odkaz nebo platbu ručně označit jako přijatou.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Zvláštní přání (brzký příjezd, přistýlky) si rovnou zapište do poznámek — tým je uvidí na časové ose rezervace.",
            },
            { type: "h2", text: "Po vytvoření" },
            {
              type: "p",
              text: "Nová rezervace se okamžitě objeví na [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste) se všemi dalšími kroky, jako jsou zprávy, úkoly a platby, na jednom místě.",
            },
            {
              type: "ul",
              items: [
                "Kalendář a portály se automaticky synchronizují ihned po uložení.",
                "Host podle potřeby obdrží automatickou potvrzovací zprávu.",
                "Změny termínu zadáváte přes „Přesunout rezervaci“.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Časová osa rezervace",
          excerpt:
            "Časová osa rezervace shromažďuje celý průběh rezervace na jednom místě.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Co časová osa zobrazuje" },
            {
              type: "p",
              text: "Každá rezervace má vlastní časovou osu, která chronologicky zobrazuje celý průběh — od poptávky nebo importu z portálu až po check-out. Na první pohled tak vidíte, co už se stalo a co je na řadě.",
            },
            {
              type: "ul",
              items: [
                "Zprávy s hostem",
                "Úkoly, například úklid nebo příprava",
                "Platby a faktury",
                "Rezervované doplňky a další služby",
                "Přesuny (Move) a storna",
              ],
            },
            { type: "h2", text: "Používání časové osy v běžném provozu" },
            {
              type: "steps",
              items: [
                "Otevřete Rezervace a vyberte požadovanou rezervaci.",
                "Přepněte na záložku „Časová osa“.",
                "Procházejte chronologicky všechny události.",
                "Pomocí rychlých akcí můžete rovnou odeslat zprávu nebo založit úkol.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pokud je rezervace přesunuta nebo stornována, objeví se tento krok také na časové ose — včetně nocí uvolněných v kalendáři.",
            },
            { type: "h2", text: "Proč je to důležité" },
            {
              type: "p",
              text: "Protože tým, vlastník i podpora vidí stejnou časovou osu, nevznikají informační mezery mezi zprávami, úkoly a platbami. Podrobnosti o vrácení peněz najdete v [Vrácení peněz](/hilfe/zahlungen/rueckerstattungen), o doplňkových službách v [Doplňky a další služby](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Přesunutí rezervace",
          excerpt:
            "Jak přesunout stávající rezervaci na nový termín, aniž byste narušili kalendář.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Před přesunutím zkontrolujte" },
            {
              type: "p",
              text: "Než rezervaci přesunete, zkontrolujte dostupnost objektu v novém termínu. myNextDays uvolní původně rezervované noci až ve chvíli, kdy je nový termín potvrzen — díky tomu nevznikne mezera, ve které by byl objekt mylně veden jako volný nebo dvojnásobně obsazený.",
            },
            {
              type: "steps",
              items: [
                "Otevřete rezervaci v Rezervacích.",
                "Zvolte „Přesunout“ a zadejte nový termín.",
                "Zkontrolujte zobrazenou dostupnost pro nové datum.",
                "Potvrďte přesun.",
                "Zkontrolujte, zda se novým počtem nocí mění cena, a v případě potřeby ji upravte.",
              ],
            },
            { type: "h2", text: "Co proběhne automaticky" },
            {
              type: "p",
              text: "Po potvrzení se v kalendáři správně uvolní původní noci a zablokují se nové, propojené portály se aktualizují. Celý proces se zaznamená do časové osy rezervace.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pokud byla rezervace přijata přes portál, může tam přesun podléhat vlastním pravidlům — před většími změnami zkontrolujte pravidla daného portálu.",
            },
            { type: "h2", text: "Rozdíly v platbě" },
            {
              type: "p",
              text: "Pokud se přesunem mění cena, upravte platební pravidla odpovídajícím způsobem — viz [Platební pravidla](/hilfe/zahlungen/zahlungsregeln). Více o celkovém průběhu rezervace najdete v [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Storno a vrácení peněz",
          excerpt:
            "Jak správně stornovat rezervaci a v případě potřeby spustit vrácení peněz.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Storno rezervace" },
            {
              type: "p",
              text: "Storno okamžitě uvolní objekt pro rezervovaný termín — v kalendáři i na všech propojených portálech. Před stornem zkontrolujte, jaké storno podmínky se na tuto rezervaci vztahují.",
            },
            {
              type: "steps",
              items: [
                "Otevřete rezervaci v Rezervacích.",
                "Zvolte „Stornovat“ a uveďte důvod.",
                "Zkontrolujte navrženou částku k vrácení.",
                "Potvrďte storno.",
              ],
            },
            { type: "h2", text: "Spuštění vrácení peněz" },
            {
              type: "p",
              text: "Pokud byla platba zpracována přes propojeného platebního poskytovatele, můžete vrácení peněz spustit přímo z rezervace. Částka se uvádí v měně nastavené u daného objektu. Podrobnosti k průběhu najdete v [Vrácení peněz](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Možné je úplné nebo částečné vrácení peněz",
                "Proces se zobrazí na časové ose rezervace",
                "U rezervací z portálů navíc platí pravidla daného portálu",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Storno nelze vzít zpět. Před potvrzením pečlivě zkontrolujte termín i hosta.",
            },
            { type: "h2", text: "Po stornu" },
            {
              type: "p",
              text: "Objekt je od té chvíle opět rezervovatelný, otevřené úkoly k rezervaci — například příprava — se automaticky označí jako již nepotřebné. Celý proces zůstává dohledatelný v [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in a check-out",
          excerpt: "Jak zaznamenat příjezd a odjezd hosta v myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Zaznamenání check-inu" },
            {
              type: "p",
              text: "Check-in označuje začátek pobytu a je užitečný zejména při samoobslužném check-inu nebo předání klíčů týmem — udržuje aktuální stav každé rezervace.",
            },
            {
              type: "steps",
              items: [
                "Otevřete rezervaci v Rezervacích.",
                "V den příjezdu zvolte „Check-in“.",
                "Podle potřeby doplňte poznámku, například čas nebo zvláštní okolnosti.",
              ],
            },
            { type: "h2", text: "Check-out a předání" },
            {
              type: "p",
              text: "Při check-outu označíte pobyt jako ukončený. V mnoha případech to automaticky spustí úkol úklidu objektu, aby byl připraven na další rezervaci.",
            },
            {
              type: "ul",
              items: [
                "Check-in a check-out jsou součástí časové osy rezervace",
                "Časy lze pro každý objekt definovat v nastavení objektu",
                "Při mobilním přístupu může tým zaznamenat check-in a check-out přímo na místě",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zmeškaný check-out automaticky neblokuje navazující úkoly — pravidelně kontrolujte v Rezervacích prošlé stavy.",
            },
            { type: "h2", text: "Souvislost s úkoly" },
            {
              type: "p",
              text: "Check-in a check-out úzce souvisejí s úkoly a časovou osou. Více o celkovém průběhu se dočtete v [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Doplňky a další služby",
          excerpt:
            "Jak hostům nabídnout rezervovatelné doplňkové služby, například snídani nebo transfer, a zapsat je do rezervace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Co jsou doplňky" },
            {
              type: "p",
              text: "Doplňky jsou volitelné další služby k rezervaci — například snídaně, brzký příjezd, transfer nebo pozdní check-out. Zadávají se pro každý objekt zvlášť a k rezervaci je může přidat sám host nebo váš tým.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt a v sekci „Doplňky“ založte požadované další služby včetně ceny.",
                "Otevřete existující rezervaci v Rezervacích.",
                "Zvolte „Přidat doplněk“ a vyberte požadovanou službu.",
                "Potvrďte množství a čas poskytnutí služby.",
              ],
            },
            { type: "h2", text: "Vyúčtování" },
            {
              type: "p",
              text: "Doplňky se vyúčtovávají v měně daného objektu a na faktuře se zobrazují jako samostatná položka. Již zaplacené doplňky lze při stornu poměrně vrátit.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Oblíbené doplňky si jednou centrálně uložte u objektu — u každé nové rezervace je pak přidáte během pár kliknutí.",
            },
            { type: "h2", text: "Viditelnost pro hosta" },
            {
              type: "p",
              text: "Je-li aktivní platforma nebo vlastní web, mohou si hosté vhodné doplňky často vybrat už během samotné rezervace. Každé doplnění se poté zobrazí na [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Doplňky lze pro každý objekt individuálně pojmenovat a ocenit",
                "Dodatečné přidání je kdykoli možné přímo z rezervace",
                "Stornované doplňky se poměrně vrací",
              ],
            },
          ],
        },
      ],
    },
  ],
};
