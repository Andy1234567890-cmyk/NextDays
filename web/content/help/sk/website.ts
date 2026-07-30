import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Editor webových stránok",
  description: "Vytvorte si vlastnú rezervačnú webovú stránku pomocou editora.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Editor webových stránok",
      articles: [
        {
          slug: "website-erstellen",
          title: "Vytvorenie webovej stránky",
          excerpt: "Pomocou editora si za pár minút vytvoríte vlastnú rezervačnú webovú stránku.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Editor webových stránok vám vytvorí vlastnú rezervačnú webovú stránku — ďalší predajný kanál popri portáloch a trhovisku myNextDays. Zachovávate si plnú kontrolu nad štruktúrou, obsahom a brandingom.",
            },
            { type: "h2", text: "Ako vytvoriť webovú stránku" },
            {
              type: "steps",
              items: [
                "V menu otvorte Webová stránka.",
                "Kliknite na Vytvoriť webovú stránku.",
                "Vyberte šablónu ako východiskový bod pre svoje rozloženie.",
                "Potvrďte pomocou Vytvoriť webovú stránku — dostanete sa priamo do editora.",
              ],
            },
            { type: "h2", text: "Čo editor obsahuje" },
            {
              type: "ul",
              items: [
                "Vizuálny editor so stránkami, vrstvami a náhľadom",
                "Pripravené bloky pre zoznamy objektov, galérie a kontaktné formuláre",
                "Priamu rezervačnú cestu založenú na dostupnosti vo vašom kalendári",
                "Prispôsobiteľné farby, písma a logo v súlade s vašou značkou",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Začnite šablónou, ktorá sa blíži vášmu typu objektu — rekreačný objekt alebo hotel — ušetríte si tak neskôr čas pri úprave blokov.",
            },
            { type: "h2", text: "Ďalšie kroky" },
            {
              type: "p",
              text: "Po vytvorení upravíte stránky a rozloženie, pozri [Úprava stránok a rozloženia](/hilfe/website/seiten-layout), a zobrazíte svoje objekty na webovej stránke, pozri [Zobrazenie objektov na webovej stránke](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Úprava stránok a rozloženia",
          excerpt: "Prispôsobenie stránok, vrstiev a blokov vo vizuálnom editore.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Editor sa člení na tri oblasti: vľavo prehľad stránok a vrstiev, v strede náhľad vašej webovej stránky, vpravo nastavenia práve vybraného bloku.",
            },
            { type: "h2", text: "Úprava stránky" },
            {
              type: "steps",
              items: [
                "Vľavo v sekcii Stránky vyberte požadovanú stránku.",
                "V náhľade kliknite na blok, aby ste ho vybrali.",
                "Vpravo upravte text, obrázok alebo odsadenie bloku.",
                "Presúvajte bloky metódou ťahania, aby ste zmenili poradie.",
              ],
            },
            { type: "h2", text: "Pridávanie nových stránok a blokov" },
            {
              type: "p",
              text: "Cez tlačidlo Pridať stránku vytvoríte ďalšie podstránky, napríklad O nás alebo Kontakt. V rámci stránky pridáte cez Pridať blok nové sekcie ako galériu, hodnotenia alebo kontaktný formulár.",
            },
            {
              type: "ul",
              items: [
                "Domovská stránka, prehľad objektov a kontakt sú predvyplnené v každej šablóne",
                "Ďalšie stránky možno voľne pomenovať a zaradiť do navigácie",
                "Bloky sú responzívne a prispôsobujú sa počítaču, tabletu a smartfónu",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Zmeny v editore sú najprv len koncept. Až kliknutím na Zverejniť sa prevezmú na vašu verejnú webovú stránku.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Prepojenie domény",
          excerpt: "Prepojenie vlastnej domény s vašou webovou stránkou myNextDays.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Predvolene je vaša webová stránka dostupná cez subdoménu myNextDays. Ak chcete namiesto toho použiť vlastnú doménu, napríklad vasa-prevadzka.sk, prepojíte ju v sekcii Doména.",
            },
            { type: "h2", text: "Uloženie domény" },
            {
              type: "steps",
              items: [
                "Na webovej stránke otvorte nastavenia a tam Doména.",
                "Zadajte svoju vlastnú doménu a kliknite na Prepojiť.",
                "U svojho poskytovateľa domény vytvorte zobrazené DNS záznamy.",
                "Počkajte na potvrdenie — kontrola prebieha automaticky na pozadí.",
              ],
            },
            { type: "h2", text: "Správne nastavenie DNS záznamov" },
            {
              type: "p",
              text: "myNextDays vám zobrazí presne požadované záznamy pre vášho poskytovateľa domény. Prepojenie sa aktivuje až vtedy, keď sú tieto záznamy správne nastavené a rozšírené na celom svete — to môže podľa poskytovateľa trvať niekoľko hodín.",
            },
            {
              type: "ul",
              items: [
                "Nastavte CNAME alebo A záznam podľa zobrazeného návodu",
                "Predtým odstráňte existujúce, protichodné záznamy pre tú istú doménu",
                "Certifikát pre https sa po úspešnom prepojení vystaví automaticky",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez správne nastavených DNS záznamov zostane vaša webová stránka na vlastnej doméne nedostupná — starostlivo skontrolujte zápis oproti údajom svojho poskytovateľa.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Zobrazenie objektov na webovej stránke",
          excerpt: "Ktoré objekty sú viditeľné a rezervovateľné cez webovú stránku, riadite samostatne pre jednotlivý objekt.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Aby sa objekt zobrazoval na vašej webovej stránke, musí byť pre tento objekt zapnutá viditeľnosť na webovej stránke. Tento prepínač je nezávislý od viditeľnosti na trhovisku myNextDays alebo na portáloch.",
            },
            { type: "h2", text: "Aktivácia objektu pre webovú stránku" },
            {
              type: "steps",
              items: [
                "Otvorte objekt v sekcii Objekty.",
                "Prepnite na záložku Viditeľnosť.",
                "Aktivujte prepínač Webová stránka.",
                "Prejdite na webovú stránku a v náhľade skontrolujte blok Prehľad objektov.",
              ],
            },
            { type: "h2", text: "Prispôsobenie poradia a zobrazenia" },
            {
              type: "p",
              text: "V bloku Prehľad objektov určíte, či sa objekty triedia automaticky podľa dostupnosti, alebo zadáte pevné poradie. Každý objekt zobrazuje titulnú fotografiu, základnú cenu v uloženej mene a najdôležitejšie vlastnosti vybavenia.",
            },
            {
              type: "ul",
              items: [
                "Automatické triedenie podľa dostupnosti alebo manuálne poradie",
                "Voliteľne aktivovateľné filtrovanie podľa typu objektu alebo vybavenia",
                "Rezervačné kroky prebiehajú priamo na webovej stránke, bez obchádzky cez portál",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Objekt bez aktivovanej viditeľnosti na webovej stránke zostáva skrytý z prehľadu objektov, aj keď je viditeľný na trhovisku alebo na portáloch.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Zverejnenie webovej stránky",
          excerpt: "Koncepty sa stanú verejne viditeľnými až kliknutím na Zverejniť.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Kým pracujete v editore, aktuálny koncept vidíte len vy. Až kliknutie na Zverejniť sprístupní zmeny na vašej doméne všetkým návštevníkom.",
            },
            { type: "h2", text: "Ako zverejniť" },
            {
              type: "steps",
              items: [
                "V editore otvorte náhľad a skontrolujte všetky stránky.",
                "Vpravo hore kliknite na Zverejniť.",
                "Potvrďte dialóg — webová stránka je hneď potom live.",
                "Otvorte svoju doménu na novej karte, aby ste skontrolovali výsledok.",
              ],
            },
            { type: "h2", text: "Koncepty a resetovanie" },
            {
              type: "p",
              text: "Kým ste ešte nezverejnili, môžete sa kedykoľvek vrátiť k poslednému zverejnenému stavu bez toho, aby ste koncept definitívne stratili — použite na to Zahodiť koncept v nastaveniach webovej stránky.",
            },
            {
              type: "ul",
              items: [
                "Zverejnené zmeny sú okamžite viditeľné na vašej doméne",
                "Nezverejnený koncept zostáva interný, kým ho nepotvrdíte",
                "Každé zverejnenie sa zaznamenáva s dátumom v histórii",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pred zverejnením skontrolujte v náhľade mobilné zobrazenie — väčšina hostí navštevuje rezervačné webové stránky cez smartfón.",
            },
          ],
        },
      ],
    },
  ],
};
