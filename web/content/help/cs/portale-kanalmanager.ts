import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portály a propojení s portály",
  description: "Centrálně řiďte Booking, Airbnb, Expedia a další.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Propojení portálů",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Co je propojení s portály?",
          excerpt:
            "Propojení s portály automaticky sladí ceny, dostupnost a rezervace mezi myNextDays a portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Jedno propojení pro všechny portály" },
            {
              type: "p",
              text: "Propojení s portály je most mezi myNextDays a velkými rezervačními portály, jako je Booking, Airbnb a další. Místo abyste ceny, dostupnost a obsazenost spravovali zvlášť v každém portálu, zadáte vše jednou v myNextDays — propojení s portály to automaticky rozdistribuuje na všechny napojené portály.",
            },
            { type: "h2", text: "Co se synchronizuje automaticky" },
            {
              type: "ul",
              items: [
                "Dostupnost — každá rezervace okamžitě zablokuje noc na všech portálech",
                "Ceny a minimální délka pobytu z vašeho cenového kalendáře",
                "Příchozí rezervace z portálů se automaticky importují do myNextDays",
                "Storna a Stop-Sell platí napříč všemi kanály",
              ],
            },
            { type: "h2", text: "Co už díky tomu nemusíte dělat ručně" },
            {
              type: "p",
              text: "Bez propojení s portály byste museli po každé rezervaci ručně zablokovat noc v každém portálu — což je častá příčina dvojích rezervací. S aktivním propojením s portály tento souběh zajišťuje myNextDays automaticky oběma směry, několikrát denně a u nových rezervací v reálném čase.",
            },
            {
              type: "note",
              variant: "info",
              text: "Propojení s portály se nastavuje jednorázově pro celý účet. Pro každý jednotlivý objekt poté aktivujete už jen mapování — více k tomu v [Přiřazení objektu k portálu](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Nastavení propojení s portály",
          excerpt:
            "Propojení s portály nastavíte jednou pro celý účet — ne znovu pro každý objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Jednorázově pro celý účet" },
            {
              type: "p",
              text: "Napojení na portály je nastavení platné pro celý účet: svůj účet myNextDays propojíte s propojením s portály přesně jednou. Všechny objekty, které později založíte, automaticky využívají toto jedno propojení — nemusíte je budovat znovu pro každý objekt.",
            },
            { type: "h2", text: "Jak propojení nastavit" },
            {
              type: "steps",
              items: [
                "Otevřete /konto a vyberte sekci „Portály a propojení s portály“",
                "Klikněte na „Nastavit propojení“ a potvrďte údaje o svém provozu (adresa, kontakt, právní forma)",
                "Zkontrolujte automaticky převzaté základní údaje — předávají se všem portálům",
                "Dokončete nastavení; stav se změní na „Propojeno“",
              ],
            },
            { type: "h2", text: "Další krok: přiřazení objektů" },
            {
              type: "p",
              text: "Po jednorázovém nastavení zatím není viditelný žádný objekt — proto každý objekt jednotlivě přiřadíte k portálu (mapování) a propojíte požadované portály, například Booking.com nebo Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez kompletních základních údajů (adresa, daňové informace, kontakt) portály propojení odmítnou. Tyto údaje nejprve zkontrolujte v /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Přiřazení objektu k portálu",
          excerpt:
            "Po propojení platném pro celý účet u každého objektu aktivujete už jen mapování k danému portálu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Mapování místo nového propojení" },
            {
              type: "p",
              text: "Jakmile je propojení s portály jednou nastaveno pro celý účet, každý objekt propojíte už jen pomocí takzvaného mapování: určíte, který objekt v myNextDays odpovídá kterému typu pokoje či nabídky v portálu. Jde o jednorázový krok pro každý objekt.",
            },
            { type: "h2", text: "Jak objekt přiřadíte" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte a přepněte na záložku „Portály“",
                "Vyberte požadovaný portál, například Booking.com nebo Airbnb",
                "Přiřaďte objekt k odpovídajícímu typu pokoje či nabídky v portálu",
                "Aktivujte synchronizaci — ceny a dostupnost se od této chvíle přenášejí",
              ],
            },
            { type: "h2", text: "Jeden objekt, více portálů" },
            {
              type: "p",
              text: "Jeden objekt může být přiřazen k více portálům současně. Každé přiřazení je nezávislé — objekt můžete zviditelnit například na Booking.com a Airbnb, zatímco na Expedii ho zatím necháte deaktivovaný.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Po mapování rovnou zkontrolujte viditelnost — viz [Viditelnost podle portálu](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Propojení s Booking.com",
          excerpt: "Jak zprovoznit Booking.com jako prodejní kanál pro daný objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Podmínka: propojení platné pro celý účet" },
            {
              type: "p",
              text: "Než aktivujete Booking.com pro určitý objekt, musí být nastaveno propojení s portály platné pro celý účet (viz [Nastavení propojení s portály](/hilfe/portale-kanalmanager/portal-verbindung)). Poté je Booking.com pro každý další objekt už jen otázkou mapování.",
            },
            { type: "h2", text: "Aktivace Booking.com" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Ze seznamu dostupných portálů vyberte „Booking.com“",
                "Přiřaďte odpovídající typ pokoje či nabídky a potvrďte cenové plány",
                "Aktivujte viditelnost — objekt bude po ověření ze strany Booking.com spuštěn naostro",
              ],
            },
            { type: "h2", text: "Co od vás Booking.com očekává" },
            {
              type: "ul",
              items: [
                "Kompletní popis objektu, fotografie a vybavení",
                "Alespoň jednu sazbu s cenou a storno podmínkami",
                "Platnou platební metodu pro provize",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Schválení ze strany Booking.com může trvat několik hodin. Stav na záložce objektu „Portály“ ukazuje, zda je propojení již aktivní.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Propojení s Airbnb",
          excerpt: "Jak zpřístupnit objekt k rezervaci na Airbnb přes propojení s portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Airbnb jako další portál" },
            {
              type: "p",
              text: "Airbnb se napojuje stejně jako každý jiný portál přes propojení platné pro celý účet. Jakmile je nastaveno, aktivujete Airbnb pro daný objekt pomocí mapování — bez ohledu na to, zda je objekt už viditelný na Booking.com nebo jiných portálech.",
            },
            { type: "h2", text: "Aktivace Airbnb pro objekt" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Ze seznamu dostupných portálů vyberte „Airbnb“",
                "Potvrďte kategorii objektu a přiřazený typ nabídky",
                "Zkontrolujte fotografie, vybavení a domovní řád — Airbnb před schválením vyžaduje kompletní údaje",
                "Aktivujte viditelnost pro Airbnb",
              ],
            },
            { type: "h2", text: "Po aktivaci" },
            {
              type: "p",
              text: "Jakmile Airbnb objekt schválí, ceny a dostupnost běží automaticky přes propojení s portály. Rezervace, které přijdou z Airbnb, se poté automaticky objeví ve vašem rezervačním kalendáři.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uvedených storno podmínek a domovního řádu Airbnb schválení odmítne. Tyto údaje nejprve doplňte u objektu.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Synchronizace cen a dostupnosti",
          excerpt:
            "Ceny a dostupnost se automaticky přenášejí na všechny propojené portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Jeden kalendář, všechny portály" },
            {
              type: "p",
              text: "Ceny a dostupnost spravujete výhradně v kalendáři myNextDays u daného objektu. Propojení s portály automaticky přenese každou změnu na všechny portály, ke kterým je objekt aktivně namapován — aniž byste cokoli zadávali dvakrát.",
            },
            { type: "h2", text: "Co se přenáší" },
            {
              type: "ul",
              items: [
                "Denní ceny z vašeho cenového kalendáře, resp. cenových plánů",
                "Dostupné noci a blokace",
                "Minimální délka pobytu a omezení příjezdu/odjezdu",
                "Dny se Stop-Sell — ty se automaticky zablokují na všech portálech",
              ],
            },
            { type: "h2", text: "Jak rychle synchronizace působí" },
            {
              type: "p",
              text: "Změny cen a dostupnosti se na portály přenesou během několika minut. Nové rezervace okamžitě zablokují dotčené noci, aby stejnou noc nebylo možné prodat znovu na jiném kanálu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Více o blokování jednotlivých dní napříč kanály najdete v [Jak předcházet přebookování](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Příjem rezervací z portálů",
          excerpt: "Rezervace z Booking, Airbnb a dalších se automaticky objeví ve vašem kalendáři.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Automatický import" },
            {
              type: "p",
              text: "Když host rezervuje přes portál, jako je Booking.com nebo Airbnb, propojení s portály rezervaci automaticky importuje do myNextDays. Nic nemusíte přenášet ručně — rezervace se objeví v kalendáři i v seznamu rezervací daného objektu.",
            },
            { type: "h2", text: "Co se stane při rezervaci z portálu" },
            {
              type: "steps",
              items: [
                "Portál nahlásí novou rezervaci propojení s portály",
                "myNextDays založí rezervaci s údaji o hostovi, termínem a cenou",
                "Rezervované noci se okamžitě zablokují na všech ostatních kanálech",
                "Obdržíte upozornění a rezervaci najdete v kalendáři",
              ],
            },
            { type: "h2", text: "Storna a změny" },
            {
              type: "p",
              text: "Pokud host stornuje rezervaci přes portál nebo změní termín, přenese se to rovněž automaticky do myNextDays a dotčené noci se opět uvolní.",
            },
            {
              type: "note",
              variant: "info",
              text: "Rezervace z portálů poznáte v detailu rezervace podle štítku s jejich zdrojem, například Booking.com nebo Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Jak předcházet přebookování",
          excerpt: "Stop-Sell a automatické blokace zabraňují dvojím rezervacím napříč portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Proč přebookování vzniká" },
            {
              type: "p",
              text: "Bez centrálního řízení se snadno stane, že stejná noc se prodá na dvou portálech současně — například když se ceny a dostupnost spravují ručně ve více systémech. Propojení s portály tuto mezeru uzavírá tím, že každá rezervace na kterémkoli kanálu okamžitě zablokuje všechny ostatní kanály.",
            },
            { type: "h2", text: "Vaše nástroje proti přebookování" },
            {
              type: "ul",
              items: [
                "Automatická blokace: každá nová rezervace — bez ohledu na kanál — zablokuje noci všude",
                "Stop-Sell: ručně zablokuje den na všech kanálech současně, například kvůli vlastnímu využití nebo údržbě",
                "Minimální délka pobytu a omezení příjezdu zabraňují nevhodným krátkým rezervacím",
              ],
            },
            { type: "h2", text: "Nastavení Stop-Sell" },
            {
              type: "steps",
              items: [
                "Otevřete obsazenostní kalendář objektu",
                "Označte dotčený den nebo období",
                "Vyberte „Stop-Sell“ — den je poté zablokovaný na všech portálech i na webu a platformě",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell platí bezvýhradně pro všechny kanály. Neexistuje možnost zablokovat den jen pro jeden konkrétní portál a pro ostatní ho nechat otevřený.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Viditelnost podle portálu",
          excerpt: "Každý portál lze zapnout nebo vypnout nezávisle na webu a marketplace platformy.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Tři nezávislé prodejní cesty" },
            {
              type: "p",
              text: "Objekt lze prodávat současně několika způsoby: přes portály (Booking, Airbnb a další), přes marketplace platformy myNextDays a přes váš vlastní web. Každá cesta má vlastní přepínač viditelnosti — jsou na sobě zcela nezávislé.",
            },
            { type: "h2", text: "Řízení viditelnosti podle jednotlivých portálů" },
            {
              type: "p",
              text: "V rámci portálů lze navíc samostatně přepínat každý jednotlivý portál. Objekt může být například aktivní na Booking.com, ale na Airbnb deaktivovaný — obě přiřazení přitom zůstávají zachována.",
            },
            { type: "h2", text: "Jak viditelnost změnit" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Jednotlivě zapněte nebo vypněte požadovaný kanál (konkrétní portál, web nebo marketplace platformy)",
                "Uložte — změna se projeví během několika minut",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Stav objektu (aktivní/neaktivní) i Stop-Sell působí nadřazeně na všechny kanály. Přepínače viditelnosti řídí pouze to, na kterých dalších kanálech se již aktivní objekt zobrazuje.",
            },
          ],
        },
      ],
    },
  ],
};
