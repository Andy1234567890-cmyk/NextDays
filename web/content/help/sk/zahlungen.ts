import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Platby a faktúry",
  description: "Poskytovatelia platieb, platobné pravidlá a faktúry.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Platby",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Prepojenie poskytovateľa platieb",
          excerpt:
            "Ako prepojiť Stripe alebo PayPal s myNextDays na automatické spracovanie platieb.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Dostupní poskytovatelia" },
            {
              type: "p",
              text: "myNextDays spracováva platby cez prepojených poskytovateľov platieb. Aktuálne sú podporovaní Stripe a PayPal — môžete prepojiť jedného alebo oboch poskytovateľov súčasne a využívať ich podľa objektu alebo želania hosťa.",
            },
            {
              type: "steps",
              items: [
                "Otvorte Konto a prepnite na sekciu „Platby“.",
                "Vyberte požadovaného poskytovateľa — Stripe alebo PayPal.",
                "Postupujte podľa dialógu prepojenia a prihláste sa u poskytovateľa, alebo si vytvorte nové konto.",
                "Potvrďte prepojenie — status sa zmení na „prepojené“.",
              ],
            },
            { type: "h2", text: "Čo sa deje potom" },
            {
              type: "p",
              text: "Akonáhle je poskytovateľ prepojený, môžete posielať platobné odkazy, vyberať zálohy a spúšťať vrátenie platieb priamo z rezervácie. Všetky sumy sa spracúvajú v mene uloženej pre príslušný objekt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez prepojeného poskytovateľa môžete platby označiť len manuálne ako prijaté — automatické stiahnutie platby vtedy nie je možné.",
            },
            { type: "h2", text: "Viacero objektov, jeden poskytovateľ" },
            {
              type: "p",
              text: "Raz vytvorené prepojenie platí pre celé konto pre všetky vaše objekty. Ako presne prebieha stiahnutie platby, určíte prostredníctvom [Platobné pravidlá](/hilfe/zahlungen/zahlungsregeln). Výplaty vám následne prebiehajú cez príslušného poskytovateľa, pozri [Výplaty](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe je vhodný pre platby kartou a mnohé lokálne spôsoby platby",
                "PayPal ponúka hosťom overenú alternatívu",
                "Oboch poskytovateľov možno nezávisle od seba odpojiť a znova prepojiť",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Platobné pravidlá",
          excerpt: "Určite, kedy je splatná záloha a doplatok rezervácie.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Záloha a doplatok" },
            {
              type: "p",
              text: "Platobné pravidlá určujú, ako sa rezervácia finančne vybaví — napríklad záloha pri rezervácii a doplatok pred príchodom, alebo plná platba okamžite. Pravidlá platia pre jednotlivý objekt a možno ich kedykoľvek upraviť.",
            },
            {
              type: "steps",
              items: [
                "Otvorte objekt a prepnite na sekciu „Platobné pravidlá“.",
                "Vyberte, či sa vyberá záloha, a určte jej podiel.",
                "Určte, kedy je splatný doplatok, napríklad určitý počet dní pred príchodom.",
                "Uložte nastavenia.",
              ],
            },
            { type: "h2", text: "Automatické stiahnutie" },
            {
              type: "p",
              text: "Ak je prepojený poskytovateľ platieb, myNextDays automaticky vyberie zálohu a doplatok v uloženom termíne a vopred o tom informuje hosťa prostredníctvom správy.",
            },
            {
              type: "note",
              variant: "info",
              text: "Platobné pravidlá platia len pri rezerváciách s prepojeným poskytovateľom platieb. Bez poskytovateľa platby označujete manuálne v rezervácii.",
            },
            { type: "h2", text: "Rozdiely podľa kanálu" },
            {
              type: "p",
              text: "Na portáloch môže odchylne platiť ich vlastné spracovanie platieb — v takom prípade skontrolujte podmienky príslušného portálu. Pri rezerváciách cez vlastnú platformu alebo webovú stránku vždy platia vaše tu uložené pravidlá. Podrobnosti o prepojení poskytovateľa nájdete v [Prepojenie poskytovateľa platieb](/hilfe/zahlungen/zahlungsanbieter-verbinden), k fakturácii v [Vystavovanie faktúr](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Záloha ako pevná suma alebo percentuálny podiel",
                "Termín doplatku voľne nastaviteľný",
                "Zmeny platia len pre nové rezervácie, nie spätne",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Vystavovanie faktúr",
          excerpt: "Ako vystavíte k rezervácii faktúru so správnou fakturačnou adresou.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Vytvorenie faktúry" },
            {
              type: "p",
              text: "Ku každej rezervácii možno vystaviť faktúru — pre samotného hosťa alebo pre odlišnú firmu, ak ide o firemnú rezerváciu.",
            },
            {
              type: "steps",
              items: [
                "Otvorte rezerváciu v sekcii Rezervácie.",
                "Vyberte „Vystaviť faktúru“.",
                "Skontrolujte alebo doplňte fakturačnú adresu.",
                "Skontrolujte uvedené položky — ubytovanie, doplnky, poplatky.",
                "Vystavte faktúru a odošlite ju hosťovi.",
              ],
            },
            { type: "h2", text: "Správa fakturačnej adresy" },
            {
              type: "p",
              text: "Fakturačnú adresu môžete uložiť priamo v rezervácii, alebo si ju od hosťa vyžiadať dodatočne cez potvrdenie rezervácie. Bez úplnej adresy nemožno v niektorých krajinách vystaviť právne platnú faktúru.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Pri firemných zákazníkoch skontrolujte najmä názov firmy a adresu — dodatočné opravy si vyžadujú opravnú faktúru.",
            },
            { type: "h2", text: "Sumy a mena" },
            {
              type: "p",
              text: "Všetky položky sa uvádzajú v mene uloženej pre objekt. Už prijaté platby sa na faktúre vyznačia ako platba prijatá. Ako vznikajú záloha a doplatok, si prečítajte v [Platobné pravidlá](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Faktúry si možno stiahnuť ako PDF",
                "Opravné faktúry sú pri zmenách kedykoľvek možné",
                "Doplnky sa objavujú ako samostatná položka",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Vrátenie platieb",
          excerpt:
            "Ako vrátite platbu úplne alebo čiastočne, ak sa rezervácia zruší alebo zmení.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Kedy je vrátenie platby potrebné" },
            {
              type: "p",
              text: "Vrátenie platby zvyčajne vzniká pri storne, ale môže byť potrebné aj pri dodatočnej úprave ceny alebo zrušenom doplnku.",
            },
            {
              type: "steps",
              items: [
                "Otvorte dotknutú rezerváciu v sekcii Rezervácie.",
                "V oblasti platieb rezervácie vyberte „Vrátenie platby“.",
                "Zadajte sumu na vrátenie — úplne alebo čiastočne.",
                "Potvrďte vrátenie platby.",
              ],
            },
            { type: "h2", text: "Priebeh cez poskytovateľa platieb" },
            {
              type: "p",
              text: "Vrátenie platby sa vykoná cez poskytovateľa použitého pri platbe — Stripe alebo PayPal — a prevedie sa priamo na pôvodný spôsob platby hosťa. Proces sa automaticky zaznamená v časovej osi rezervácie.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez prepojeného poskytovateľa platieb nemožno vrátenie platby spustiť automaticky — v takom prípade vrátenie vybavte priamo s hosťom.",
            },
            { type: "h2", text: "Vplyv na provízie" },
            {
              type: "p",
              text: "Už vyúčtované provízie z trhoviska alebo portálu sa pri vrátení platby pomerne upravia. Viac o tom v [Pochopenie provízií](/hilfe/zahlungen/provisionen-verstehen). Podrobnosti o samotnom storne nájdete v [Storno a vrátenie platby](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Čiastočné vrátenia platieb sú možné pre jednotlivé položky",
                "Status spracovania je kedykoľvek viditeľný v rezervácii",
                "Vrátenia platieb prebiehajú výhradne cez pôvodne použitého poskytovateľa",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Výplaty",
          excerpt:
            "Ako vám budú vyplatené výnosy z vašich rezervácií od prepojených poskytovateľov platieb.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Ako výplaty fungujú" },
            {
              type: "p",
              text: "Prichádzajúce platby sa najprv zhromažďujú u prepojeného poskytovateľa platieb. Odtiaľ prebieha výplata na váš uložený bankový účet podľa zvyčajného rytmu daného poskytovateľa.",
            },
            {
              type: "steps",
              items: [
                "Otvorte Konto a prepnite na sekciu „Platby“.",
                "V sekcii „Výplaty“ skontrolujte status príslušného poskytovateľa.",
                "V prípade potreby otvorte podrobný pohľad poskytovateľa pre úplnú históriu výplat.",
              ],
            },
            { type: "h2", text: "Čo sa odpočíta pred výplatou" },
            {
              type: "p",
              text: "Pred výplatou sa zohľadnia príslušné provízie z trhoviska a portálov, ako aj poplatky poskytovateľa. Vyplatená suma preto nemusí nutne zodpovedať pôvodnej sume rezervácie.",
            },
            {
              type: "note",
              variant: "info",
              text: "Presné zloženie odpočtov vysvetľuje [Pochopenie provízií](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Viacero objektov a vlastníkov" },
            {
              type: "p",
              text: "Ak spravujete objekty pre rôznych vlastníkov, výplaty sa priraďujú podľa uložených vyúčtovaní vlastníkov. Pri nezrovnalostiach skontrolujte najprv status príslušných rezervácií v sekcii Rezervácie.",
            },
            {
              type: "ul",
              items: [
                "Rytmus a spôsob výplaty určuje príslušný poskytovateľ",
                "Zadržané sumy, napríklad pri prebiehajúcich vráteniach platieb, sú označené",
                "Úplná história je k nahliadnutiu priamo u poskytovateľa",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Pochopenie provízií",
          excerpt:
            "Prehľad, ako sa skladajú provízie z trhoviska a portálov a kde sa vyúčtujú.",
          updated: "Aktualizované: júl 2026",
          body: [
            { type: "h2", text: "Dva typy provízií" },
            {
              type: "p",
              text: "Pri rezerváciách cez myNextDays môžu vzniknúť dve rôzne provízie: provízia z trhoviska pre rezervácie cez vlastnú platformu a provízie z portálov pre rezervácie prichádzajúce cez pripojené portály ako Booking alebo Airbnb. Obe sú navzájom nezávislé a môžu byť rôzne v závislosti od predajnej cesty rezervácie.",
            },
            {
              type: "ul",
              items: [
                "Provízia z trhoviska: vzniká pri rezerváciách cez platformu myNextDays",
                "Provízia z portálu: počíta ju príslušný portál podľa svojich vlastných podmienok",
                "Priame rezervácie cez vašu vlastnú webovú stránku treba posudzovať nezávisle od toho",
              ],
            },
            { type: "h2", text: "Kde sú provízie viditeľné" },
            {
              type: "steps",
              items: [
                "Otvorte Konto a prepnite na sekciu „Vyúčtovanie“.",
                "Vyberte požadovaný mesiac.",
                "Skontrolujte prehľad podľa rezervácie s príslušnou províziou.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Cez ktorý kanál rezervácia prišla, uvidíte priamo pri samotnej rezervácii — to vysvetľuje, aká provízia bola v danom prípade uplatnená.",
            },
            { type: "h2", text: "Súvislosť s výplatami" },
            {
              type: "p",
              text: "Provízie sa odpočítajú zo sumy rezervácie pred výplatou. Podrobnosti o procese výplaty nájdete v [Výplaty](/hilfe/zahlungen/auszahlungen). Pri vrátení platby sa príslušná provízia pomerne opraví — kompletný priebeh rezervácie zobrazuje [Časová os rezervácie](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
