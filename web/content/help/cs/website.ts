import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Editor webových stránek",
  description: "Vytvořte si vlastní rezervační web pomocí editoru.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Editor webových stránek",
      articles: [
        {
          slug: "website-erstellen",
          title: "Vytvoření webu",
          excerpt: "S editorem si během několika minut vytvoříte vlastní rezervační web.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Editor webových stránek vám vytvoří vlastní rezervační web — další distribuční kanál vedle portálů a tržiště myNextDays. Zachováváte si plnou kontrolu nad strukturou, obsahem i vizuální identitou.",
            },
            { type: "h2", text: "Jak vytvořit web" },
            {
              type: "steps",
              items: [
                "Otevřete v menu Web.",
                "Klikněte na Vytvořit web.",
                "Vyberte šablonu jako výchozí bod pro svůj vzhled.",
                "Potvrďte tlačítkem Vytvořit web — dostanete se přímo do editoru.",
              ],
            },
            { type: "h2", text: "Co editor obsahuje" },
            {
              type: "ul",
              items: [
                "Vizuální editor se stránkami, vrstvami a náhledovým zobrazením",
                "Předpřipravené bloky pro seznamy objektů, galerie a kontaktní formuláře",
                "Přímý rezervační proces založený na dostupnosti ve vašem kalendáři",
                "Přizpůsobitelné barvy, písma a logo odpovídající vaší značce",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Začněte šablonou, která se blíží typu vašeho objektu — rekreační objekt nebo hotel — ušetříte si tak později čas při úpravě bloků.",
            },
            { type: "h2", text: "Další kroky" },
            {
              type: "p",
              text: "Po vytvoření upravte stránky a rozvržení, viz [Úprava stránek a rozvržení](/hilfe/website/seiten-layout), a zobrazte své objekty na webu, viz [Zobrazení objektů na webu](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Úprava stránek a rozvržení",
          excerpt: "Upravte stránky, vrstvy a bloky ve vizuálním editoru.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Editor se dělí na tři oblasti: vlevo přehled stránek a vrstev, uprostřed náhled vašeho webu, vpravo nastavení právě vybraného bloku.",
            },
            { type: "h2", text: "Úprava stránky" },
            {
              type: "steps",
              items: [
                "Vyberte vlevo v sekci Stránky požadovanou stránku.",
                "Klikněte v náhledu na blok, chcete-li ho vybrat.",
                "Vpravo upravte text, obrázek nebo rozestup daného bloku.",
                "Přetáhněte bloky pomocí drag-and-drop, chcete-li změnit jejich pořadí.",
              ],
            },
            { type: "h2", text: "Přidávání nových stránek a bloků" },
            {
              type: "p",
              text: "Pomocí tlačítka Přidat stránku vytvoříte další podstránky, například O nás nebo Kontakt. V rámci stránky pomocí tlačítka Přidat blok vkládáte nové sekce, jako je galerie, recenze nebo kontaktní formulář.",
            },
            {
              type: "ul",
              items: [
                "Úvodní stránka, přehled objektů a kontakt jsou předvyplněné u každé šablony",
                "Další stránky lze volně pojmenovat a zařadit do navigace",
                "Bloky jsou responzivní a přizpůsobují se počítači, tabletu i telefonu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Změny v editoru jsou nejprve pouze konceptem. Teprve kliknutí na Zveřejnit je přenese na váš veřejný web.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Propojení domény",
          excerpt: "Propojte vlastní doménu s vaším webem myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Váš web je standardně dostupný přes subdoménu myNextDays. Chcete-li místo toho použít vlastní doménu, například vas-podnik.cz, propojte ji v sekci Doména.",
            },
            { type: "h2", text: "Uložení domény" },
            {
              type: "steps",
              items: [
                "Otevřete na webu Nastavení a v nich Doména.",
                "Zadejte svou vlastní doménu a klikněte na Propojit.",
                "Vytvořte u svého poskytovatele domény zobrazené DNS záznamy.",
                "Počkejte na potvrzení — kontrola probíhá automaticky na pozadí.",
              ],
            },
            { type: "h2", text: "Správné nastavení DNS záznamů" },
            {
              type: "p",
              text: "myNextDays vám zobrazí přesně potřebné záznamy pro vašeho poskytovatele domény. Propojení se aktivuje až poté, co jsou tyto záznamy správně nastaveny a rozšíří se celosvětově — to může podle poskytovatele trvat několik hodin.",
            },
            {
              type: "ul",
              items: [
                "Nastavte CNAME nebo A záznam podle zobrazeného návodu",
                "Předem odstraňte existující, protichůdné záznamy pro stejnou doménu",
                "Certifikát pro https se po úspěšném propojení vystaví automaticky",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez správně nastavených DNS záznamů zůstane váš web na vlastní doméně nedostupný — pečlivě zkontrolujte zápis oproti údajům svého poskytovatele.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Zobrazení objektů na webu",
          excerpt: "Které objekty jsou na webu viditelné a rezervovatelné, řídíte samostatně pro každý objekt.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Aby se objekt zobrazil na vašem webu, musí být pro tento objekt zapnuta viditelnost na webu. Tento přepínač je nezávislý na viditelnosti na tržišti myNextDays nebo na portálech.",
            },
            { type: "h2", text: "Zpřístupnění objektu pro web" },
            {
              type: "steps",
              items: [
                "Otevřete objekt v sekci Objekty.",
                "Přepněte se do záložky Viditelnost.",
                "Aktivujte přepínač Web.",
                "Přepněte se na web a zkontrolujte blok Přehled objektů v náhledu.",
              ],
            },
            { type: "h2", text: "Úprava pořadí a zobrazení" },
            {
              type: "p",
              text: "V bloku Přehled objektů určíte, zda se objekty řadí automaticky podle dostupnosti, nebo zda zadáte pevné pořadí. Každý objekt zobrazuje titulní fotografii, základní cenu v uložené měně a nejdůležitější vlastnosti vybavení.",
            },
            {
              type: "ul",
              items: [
                "Automatické řazení podle dostupnosti nebo ruční pořadí",
                "Filtr podle typu objektu nebo vybavení lze volitelně aktivovat",
                "Rezervační kroky probíhají přímo na webu, bez odbočky přes portál",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekt bez aktivované viditelnosti na webu zůstává skrytý z přehledu objektů, i když je viditelný na tržišti nebo u portálů.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Zveřejnění webu",
          excerpt: "Koncepty se stanou veřejně viditelnými teprve po kliknutí na Zveřejnit.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Dokud pracujete v editoru, aktuální koncept vidíte jen vy. Teprve kliknutí na Zveřejnit zpřístupní změny na vaší doméně všem návštěvníkům.",
            },
            { type: "h2", text: "Jak zveřejnit web" },
            {
              type: "steps",
              items: [
                "Otevřete v editoru náhled a zkontrolujte všechny stránky.",
                "Klikněte vpravo nahoře na Zveřejnit.",
                "Potvrďte dialog — web je bezprostředně poté aktivní.",
                "Otevřete svou doménu v novém panelu, abyste zkontrolovali výsledek.",
              ],
            },
            { type: "h2", text: "Koncepty a vrácení zpět" },
            {
              type: "p",
              text: "Dokud jste ještě nezveřejnili, můžete se kdykoli vrátit k poslednímu zveřejněnému stavu, aniž byste koncept definitivně ztratili — použijte k tomu Zahodit koncept v nastavení webu.",
            },
            {
              type: "ul",
              items: [
                "Zveřejněné změny jsou na vaší doméně viditelné okamžitě",
                "Nezveřejněný koncept zůstává interní, dokud jej nepotvrdíte",
                "Každé zveřejnění se zaznamenává s datem v historii",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Před zveřejněním zkontrolujte v náhledu mobilní zobrazení — většina hostů otevírá rezervační weby přes telefon.",
            },
          ],
        },
      ],
    },
  ],
};
