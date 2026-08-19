import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalendář a dostupnost",
  description: "Obsazenostní plán, Stop-sell a minimální délka pobytu.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalendář",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Čtení obsazenostního plánu",
          excerpt: "Jak správně číst rezervace, dostupnost a ceny v obsazenostním plánu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Obsazenostní plán vám na první pohled ukáže, které noci jsou rezervované, dostupné nebo zablokované. U rekreačních objektů vidíte jeden řádek na objekt, u hotelů vnořené zobrazení s jedním řádkem pro každou kategorii pokoje a cenový plán.",
            },
            { type: "h2", text: "Uspořádání zobrazení" },
            {
              type: "steps",
              items: [
                "Otevřete kalendář přes položku menu „Obsazenostní plán“.",
                "Nahoře vyberte období, které chcete zobrazit.",
                "V případě potřeby filtrujte podle jednotlivých objektů nebo kategorií pokojů.",
                "Klikněte na den, chcete-li otevřít podrobnosti o ceně a dostupnosti.",
                "Klikněte na obsazené období, chcete-li otevřít příslušnou rezervaci.",
              ],
            },
            { type: "h2", text: "Barvy a symboly" },
            {
              type: "ul",
              items: [
                "Obsazeno: období je rezervováno na základě rezervace.",
                "Dostupné: den lze rezervovat na všech aktivních kanálech.",
                "Zablokováno: den nelze rezervovat kvůli Stop-sell nebo ruční blokaci.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Každý řádek v obsazenostním plánu představuje přesně jednu rezervovatelnou jednotku — pokoj nebo rekreační objekt. Neexistuje žádný souhrnný řádek pro více pokojů současně.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Více o cíleném otevírání a uzavírání jednotlivých dní najdete v článku [Nastavení dostupnosti](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Nastavení dostupnosti",
          excerpt: "Cíleně otevřete nebo zavřete jednotlivé dny nebo období.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Dostupnost určuje, zda lze objekt rezervovat v konkrétní den. Jednotlivé dny nebo celá období můžete otevírat nebo zavírat přímo v obsazenostním plánu.",
            },
            { type: "h2", text: "Úprava období" },
            {
              type: "steps",
              items: [
                "Otevřete obsazenostní plán požadovaného objektu.",
                "Označte požadované období kliknutím a tažením.",
                "V nabídce akcí vyberte „Změnit dostupnost“.",
                "Potvrďte, zda se má období otevřít, nebo zavřít.",
                "Uložte změnu.",
              ],
            },
            { type: "h2", text: "Dopad na kanály" },
            {
              type: "p",
              text: "Změna dostupnosti se projeví na všech distribučních kanálech, na kterých je objekt viditelný: portály jako Booking, Airbnb a další, vlastní platforma i aplikace. Přenos na portály probíhá automaticky na pozadí.",
            },
            {
              type: "ul",
              items: [
                "Otevřít: den se stane rezervovatelným na všech aktivních kanálech.",
                "Zavřít: den zmizí z rezervovatelnosti, ale zůstává viditelný v kalendáři.",
                "Již existující rezervace nejsou změnou dostupnosti dotčeny.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Nezavírejte období se záměrem zablokovat je kompletně a trvale pro prodej — k tomu slouží funkce Stop-sell, viz [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-sell",
          excerpt: "Stop-sell okamžitě zablokuje den na všech distribučních kanálech současně.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Stop-sell je nejrychlejší způsob, jak jednotlivý den zcela vyřadit z prodeje. Na rozdíl od pouhé změny dostupnosti působí Stop-sell tvrdě a okamžitě na všech kanálech současně — na portálech, vlastní platformě i v aplikaci.",
            },
            { type: "h2", text: "Nastavení Stop-sell" },
            {
              type: "steps",
              items: [
                "Otevřete obsazenostní plán dotčeného objektu.",
                "Vyberte požadovaný den nebo období.",
                "V nabídce akcí klikněte na „Aktivovat Stop-sell“.",
                "Potvrďte blokaci.",
              ],
            },
            { type: "h2", text: "Kdy je Stop-sell vhodný" },
            {
              type: "ul",
              items: [
                "Krátkodobé údržbové práce nebo technické problémy v objektu.",
                "Mimořádný případ, kdy okamžitě a bez výjimky nechcete žádnou novou rezervaci.",
                "Rychlá, celoplatformní nouzová blokace bez nutnosti upravovat každý kanál zvlášť.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-sell nezná žádnou výjimku podle kanálu: je-li den zablokován, žádný host nemůže rezervovat přes žádný kanál, ani přes recepci, ani přes přímou poptávku.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pro trvalé vlastní využití nebo plánovanou údržbu se místo toho hodí [Ruční blokace](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Minimální a maximální délka pobytu",
          excerpt: "Jak dlouho mohou hosté minimálně nebo maximálně rezervovat.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Pomocí minimální a maximální délky pobytu určíte, kolik nocí může host pro daný den příjezdu minimálně nebo maximálně rezervovat. To pomáhá předcházet krátkým mezerovým rezervacím nebo cíleně nastavit objekt pro delší pobyty.",
            },
            { type: "h2", text: "Nastavení pravidla" },
            {
              type: "steps",
              items: [
                "Otevřete v objektu obsazenostní plán nebo záložku „Ceny“.",
                "Vyberte dotčené období.",
                "Zadejte minimální počet nocí v poli „Minimální délka pobytu“.",
                "Volitelně zadejte maximální počet nocí v poli „Maximální délka pobytu“.",
                "Uložte pravidlo.",
              ],
            },
            { type: "h2", text: "Typické případy použití" },
            {
              type: "ul",
              items: [
                "Hlavní sezóna: vyšší minimální délka pobytu, aby se sdružily dny výměny hostů.",
                "Mimo sezónu: nižší minimální délka pobytu, aby bylo možné více rezervací.",
                "Maximální délka pobytu: vhodná, pokud musí být objekt poté volný pro údržbu nebo jiné využití.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Pravidlo platí pro den příjezdu: host nemůže v den s minimální délkou pobytu tři noci přijet jen na dvě noci, i kdyby byly jednotlivé dny dostupné.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinujte delší minimální délku pobytu se [Slevami za délku pobytu](/hilfe/preise-raten/aufenthaltsrabatte), abyste zvýšili motivaci hostů.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Ruční blokace",
          excerpt: "Cíleně rezervujte období pro vlastní využití nebo údržbu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Ruční blokace rezervuje období v kalendáři, aniž by existovala skutečná rezervace hosta — například pro vlastní využití, plánované údržbové práce nebo rekonstrukce. Období se v obsazenostním plánu zobrazuje jako rezervace, ale je jasně rozeznatelné jako blokace.",
            },
            { type: "h2", text: "Vytvoření blokace" },
            {
              type: "steps",
              items: [
                "Otevřete obsazenostní plán dotčeného objektu.",
                "Označte požadované období.",
                "V nabídce akcí vyberte „Ručně zablokovat“.",
                "Uveďte důvod, např. „Vlastní využití“ nebo „Údržba“.",
                "Uložte blokaci.",
              ],
            },
            { type: "h2", text: "Rozdíl oproti Stop-sell" },
            {
              type: "p",
              text: "Ruční blokace konkrétně rezervuje období pro určitý, dokumentovaný účel a lze ji později znovu uvolnit. Pro okamžitou, celoplatformní nouzovou blokaci bez dokumentovaného období je naopak určen Stop-sell.",
            },
            {
              type: "ul",
              items: [
                "Ruční blokace: plánovaná, s důvodem, pro vlastní využití nebo údržbu.",
                "Uvolnění kdykoli možné, jakmile období již není potřeba.",
                "Zablokované noci se nepočítají jako rezervace hosta a neobjevují se v přehledu tržeb.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Smažte ruční blokaci, jakmile pomine důvod — jinak zůstane objekt zbytečně zablokovaný na všech kanálech.",
            },
            {
              type: "note",
              variant: "info",
              text: "Pro okamžitou blokaci bez plánovaného období použijte [Stop-sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};
