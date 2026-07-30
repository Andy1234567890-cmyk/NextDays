import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanálový manažer",
  description: "Zvládněte portály a kanálového manažera.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanálový manažer",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Propojení vašeho prvního portálu",
          excerpt: "Jak poprvé aktivujete portál pro objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: máte vytvořený objekt, ale ještě žádný propojený portál",
            },
            {
              type: "p",
              text: "Váš objekt je v myNextDays kompletně nastaven, ale zatím není viditelný na žádném portálu, jako je Booking.com nebo Airbnb. Než portál objekt přijme, potřebuje váš účet jednorázově propojení s portálem platné pro celý účet — poté už pro každý další objekt stačí jen mapování.",
            },
            {
              type: "steps",
              items: [
                "Otevřete /konto, sekci „Portály a kanálový manažer“, a nastavte propojení platné pro celý účet s údaji vašeho provozu",
                "Poté otevřete objekt v /objekte a přepněte na záložku „Portály“",
                "Vyberte požadovaný portál a přiřaďte ho odpovídajícímu typu pokoje, resp. nabídky",
                "Zkontrolujte fotografie, vybavení, ceny a storno podmínky — portály vyžadují úplné údaje",
                "Aktivujte viditelnost; stav se po kontrole ze strany portálu změní na „Propojeno“",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Propojení platné pro celý účet nastavíte jen jednou. Podrobnosti k tomu najdete v článcích [Propojení s Booking.com](/hilfe/portale-kanalmanager/booking-verbinden) a [Propojení s Airbnb](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Propojení s Booking.com",
          excerpt: "Jak přes kanálového manažera zpřístupníte objekt k rezervaci na Booking.com.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: váš objekt se má navíc zobrazit na Booking.com",
            },
            {
              type: "p",
              text: "Booking.com je jeden z portálů, které se napojují přes kanálového manažera. Podmínkou je propojení s portálem platné pro celý účet — je-li již nastaveno, potřebujete pro Booking.com už jen mapování pro každý objekt.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Ze seznamu dostupných portálů vyberte „Booking.com“",
                "Přiřaďte odpovídající typ pokoje, resp. nabídky a potvrďte alespoň jednu sazbu s cenou a storno podmínkami",
                "Uložte platnou platební metodu pro vyúčtování provize",
                "Aktivujte viditelnost pro Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Schválení ze strany Booking.com může trvat několik hodin. Stav na záložce „Portály“ ukáže, jakmile je propojení aktivní.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Propojení s Airbnb",
          excerpt: "Jak přes kanálového manažera zpřístupníte objekt k rezervaci na Airbnb.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: váš objekt se má navíc zobrazit na Airbnb",
            },
            {
              type: "p",
              text: "Airbnb se napojuje stejně jako každý jiný portál přes propojení platné pro celý účet. Je-li nastaveno, aktivujete Airbnb pro daný objekt pomocí mapování — bez ohledu na to, zda je objekt již viditelný na Booking.com nebo jiných portálech.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Ze seznamu dostupných portálů vyberte „Airbnb“",
                "Potvrďte kategorii objektu a přiřazený typ nabídky",
                "Doplňte fotografie, vybavení a domovní řád — Airbnb před aktivací vyžaduje úplné údaje",
                "Aktivujte viditelnost pro Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez uložených storno podmínek a domovního řádu Airbnb aktivaci odmítne. Tyto údaje nejprve doplňte u objektu.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Udržování synchronizace cen napříč portály",
          excerpt: "Stačí jeden kalendář — kanálový manažer automaticky rozdělí změny cen na všechny portály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: měníte cenu a chcete zajistit, aby seděla všude",
            },
            {
              type: "p",
              text: "Ceny spravujete výhradně v kalendáři myNextDays objektu — nikdy jednotlivě přímo v samotných portálech. Kanálový manažer automaticky přenáší každou změnu na všechny portály, pro které je objekt aktivně namapován.",
            },
            {
              type: "steps",
              items: [
                "Otevřete cenový kalendář, resp. cenové plány objektu",
                "Upravte denní cenu, minimální délku pobytu nebo omezení příjezdu/odjezdu",
                "Uložte změnu — nejprve se projeví interně v objektu",
                "Na záložce „Portály“ zkontrolujte, že jsou všechny požadované portály nadále aktivně namapované",
                "Počkejte několik minut, než se změna přenese na portály",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Nikdy nezadávejte ceny přímo v portálu — takové změny se při dalším sladění přepíší z kalendáře myNextDays.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Import rezervace z portálu",
          excerpt: "Rezervace z portálů se automaticky objeví v kalendáři — zde zkontrolujete, že import proběhl.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: host rezervoval přes portál, rezervace se má dostat do myNextDays",
            },
            {
              type: "p",
              text: "Pokud host rezervuje přes Booking.com, Airbnb nebo jiný propojený portál, kanálový manažer rezervaci automaticky importuje — nic nemusíte přenášet ručně. Tento postup popisuje, jak import ověřit a potvrdit.",
            },
            {
              type: "steps",
              items: [
                "Otevřete kalendář nebo seznam rezervací daného objektu",
                "Najděte novou rezervaci — nese štítek původu portálu, například Booking.com nebo Airbnb",
                "Zkontrolujte úplnost údajů hosta, období a ceny",
                "Zkontrolujte, že se rezervované noci na všech ostatních kanálech zobrazují jako zablokované",
                "V případě potřeby otevřete podrobnosti rezervace a zpracujte doplňkové služby nebo zprávy hosta",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pokud host stornuje rezervaci přes portál nebo změní období, přenese se to rovněž automaticky a noci se opět uvolní.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Vyřešení dvojité rezervace",
          excerpt: "Jak postupovat, pokud se stejná noc výjimečně prodala na dvou kanálech.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: dvě rezervace se překrývají pro stejný objekt a stejné noci",
            },
            {
              type: "p",
              text: "Kanálový manažer obvykle okamžitě blokuje rezervované noci napříč kanály. Dvojitá rezervace přesto může vzniknout, například při současných rezervacích na dvou portálech ve stejném okamžiku, nebo u ručně vytvořené rezervace, která koliduje s rezervací z portálu.",
            },
            {
              type: "steps",
              items: [
                "Otevřete kalendář objektu a identifikujte obě překrývající se rezervace",
                "Zkontrolujte čas rezervace a štítek původu obou rezervací",
                "Kontaktujte hosta, který rezervoval později, a nabídněte mu náhradní objekt nebo alternativní období",
                "Zrušte neudržitelnou rezervaci přímo v příslušném portálu, nejen v myNextDays",
                "Pro dotčené noci následně nastavte Stop-Sell, dokud nebude případ zcela vyřešen",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Rezervaci z portálu vždy rušte přímo přes daný portál — storno pouze v myNextDays sice interně uvolní noc, ale spolehlivě o tom neinformuje portál.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Dočasné pozastavení portálu",
          excerpt: "Vypnutí viditelnosti pro jednotlivý portál bez ztráty mapování.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: objekt má být na jednom portálu dočasně nerezervovatelný",
            },
            {
              type: "p",
              text: "Viditelnost je přepínatelná jednotlivě pro každý portál — nezávisle na webu a tržišti platformy. Chcete-li například krátkodobě pozastavit Airbnb, ale Booking.com ponechat v provozu, deaktivujte výhradně tento jeden kanál.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Najděte záznam portálu, který chcete pozastavit",
                "Vypněte viditelnost pro tento portál",
                "Uložte — změna se projeví během několika minut, objekt zmizí z výsledků vyhledávání tohoto portálu",
                "Zapněte viditelnost znovu, jakmile má být objekt opět rezervovatelný",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Mapování při pozastavení zůstává zachováno — přiřazení k portálu nemusíte později nastavovat znovu. Pro úplné zablokování všech kanálů použijte místo toho Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Kontrola mapování objektu",
          excerpt: "Jak zkontrolujete, zda je váš objekt stále správně přiřazen ke správnému typu nabídky v portálu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: ceny nebo dostupnost na portálu už nesedí s myNextDays",
            },
            {
              type: "p",
              text: "Liší-li se zobrazení v portálu od vašeho kalendáře myNextDays, příčinou bývá často chybné nebo přerušené mapování — propojení mezi vaším objektem a typem pokoje, resp. nabídky v portálu.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt v /objekte, záložka „Portály“",
                "Zkontrolujte stav daného portálu — měl by zobrazovat „Propojeno“, nikoli „Chyba“ nebo „Čeká se“",
                "Zkontrolujte, zda přiřazený typ pokoje, resp. nabídky v portálu ještě odpovídá skutečnému objektu",
                "Při odchylce: mapování zrušte a znovu přiřaďte, poté znovu aktivujte viditelnost",
                "Po opravě počkejte několik minut a znovu zkontrolujte ceny a dostupnost v portálu",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Objekt může být přiřazen více portálům současně — při nesrovnalostech zkontrolujte cíleně jen ten jeden dotčený portál, ne všechny najednou.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Různé sazby podle portálu",
          excerpt: "Jak portálu přiřadit vlastní cenový plán, aniž byste ovlivnili ostatní kanály.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: chcete na jednom portálu nabízet jinou cenu než na ostatních kanálech",
            },
            {
              type: "p",
              text: "Cenové plány lze přiřadit jednotlivě podle portálu, například nevratný cenový plán pro jeden portál a flexibilní pro jiný. Základní ceny zůstávají centrálně spravované v objektu, mapování určuje, který cenový plán jde na který portál.",
            },
            {
              type: "steps",
              items: [
                "V objektu vytvořte další cenový plán s požadovanými podmínkami (cena, storno podmínky, minimální délka pobytu)",
                "Otevřete záložku „Portály“ a vyberte příslušný portál",
                "V mapování přiřaďte tomuto portálu nový cenový plán",
                "Ostatní portály ponechte beze změny na jejich dosavadním cenovém plánu",
                "Uložte a po několika minutách zkontrolujte zobrazení ceny v příslušném portálu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Každý cenový plán se přenáší nezávisle — změna jednoho cenového plánu neovlivňuje portály přiřazené k jinému cenovému plánu.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Řešení častých chyb portálu",
          excerpt: "Typické příčiny, když portál odmítne objekt nebo synchronizace vázne.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace: stav portálu ukazuje chybu, nebo se objekt nepřevzal",
            },
            {
              type: "p",
              text: "Portály obvykle odmítají propojení kvůli chybějícím základním údajům nebo neúplným údajům objektu. Projděte postupně nejčastější příčiny, než se obrátíte na podporu.",
            },
            {
              type: "steps",
              items: [
                "V /konto zkontrolujte, zda jsou kompletně uloženy adresa, daňové informace a kontaktní údaje",
                "V objektu zkontrolujte, zda jsou úplné popis, fotografie, vybavení a alespoň jedna sazba",
                "Zkontrolujte, zda je uložena platná platební metoda pro provize",
                "Otevřete záložku „Portály“ a přečtěte si přesné chybové hlášení u dotčeného portálu",
                "Odstraňte uvedený nedostatek a znovu aktivujte viditelnost",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Chyba portálu se vždy týká jen tohoto jednoho portálu — ostatní kanály běží nezávisle na tom dál, pokud jsou splněny jejich vlastní požadavky.",
            },
          ],
        },
      ],
    },
  ],
};
