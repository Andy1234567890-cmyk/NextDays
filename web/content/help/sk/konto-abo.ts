import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto a predplatné",
  description: "Základné údaje, tarif, bezpečnosť a 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Základné údaje prevádzky",
          excerpt: "Centrálna správa názvu firmy, adresy a kontaktných údajov vašej prevádzky.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "V sekcii /konto myNextDays zoskupuje všetky funkcie prevádzky a konta ako sekcie na jednej stránke — nemusíte prechádzať medzi mnohými podstránkami. Základné údaje prevádzky tvoria pritom základ: názov firmy, právna forma, adresa a kontaktné údaje, ktoré sa používajú pre faktúry, portály a komunikáciu s hosťami.",
            },
            { type: "h2", text: "Otvorenie a úprava základných údajov" },
            {
              type: "steps",
              items: [
                "Otvorte /konto.",
                "Prepnite na sekciu „Základné údaje prevádzky“.",
                "Skontrolujte názov firmy, adresu, telefónne číslo a e-mailovú adresu pre spätné otázky.",
                "Vykonajte svoje zmeny.",
                "Uložte sekciu.",
              ],
            },
            { type: "h2", text: "Prečo sú tieto údaje dôležité" },
            {
              type: "p",
              text: "Základné údaje prevádzky sa premietajú do faktúr, do registrácie u pripojených portálov a do právne záväzných údajov ako tiráž. Neúplná alebo zastaraná adresa môže spôsobiť chybne vystavené faktúry alebo oneskorenie pripojenia portálov.",
            },
            {
              type: "ul",
              items: [
                "Názov firmy a právna forma sa objavujú na všetkých vystavených faktúrach.",
                "Adresa je potrebná na registráciu u portálov.",
                "Kontaktné údaje slúžia ako záložná cesta, ak systémové upozornenia neprídu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Po zmene fakturačnej adresy skontrolujte už vystavené faktúry v [Vyúčtovanie a kalkulačka tarifov](/hilfe/konto-abo/abrechnung-tarifrechner) — existujúce doklady sa spätne neupravujú.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Predplatné a tarif",
          excerpt: "Váš tarif určuje kontingent objektov — aktuálne obsadený počet objektov vidíte kedykoľvek v konte.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Vaše predplatné myNextDays zahŕňa kontingent objektov: maximálny počet objektov (izieb alebo rekreačných objektov), ktoré môžete súčasne aktívne spravovať. Aktuálne obsadený počet objektov sa zobrazuje v sekcii „Predplatné a tarif“ v /konto spolu so zostávajúcim kontingentom.",
            },
            { type: "h2", text: "Sledovanie kontingentu" },
            {
              type: "p",
              text: "Kontingent sa vynucuje na strane servera: ak dosiahnete hornú hranicu svojho tarifu, nemožno vytvoriť ďalší objekt, kým nejaký existujúci objekt nedeaktivujete, alebo tarif nerozšírite. To platí bez ohľadu na to, či je nový objekt izba alebo rekreačný objekt — obe sa do kontingentu počítajú rovnako.",
            },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „Predplatné a tarif“.",
                "Skontrolujte obsadený počet objektov v pomere ku kontingentu vášho tarifu.",
                "V prípade potreby vyberte väčší tarif, aby ste mohli vytvoriť viac objektov.",
                "Potvrďte zmenu tarifu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Každý objekt sa počíta do kontingentu jednotlivo, bez ohľadu na typ objektu.",
                "Zmena tarifu sa okamžite prejaví na dostupnom kontingente.",
                "Downgrade je možný len vtedy, ak aktívny počet objektov zodpovedá novému kontingentu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Downgrade na tarif s menším kontingentom sa zamietne, kým je aktívnych viac objektov, než nový tarif povoľuje. Najprv deaktivujte nadbytočné objekty.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o faktúrach a výpočte tarifu nájdete v [Vyúčtovanie a kalkulačka tarifov](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Vyúčtovanie a kalkulačka tarifov",
          excerpt: "Fakturačná adresa, doterajšie faktúry a kalkulačka tarifov pre váš kontingent objektov.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Sekcia „Vyúčtovanie a kalkulačka tarifov“ v /konto zoskupuje všetko okolo fakturácie: vašu fakturačnú adresu, zoznam doterajších faktúr na stiahnutie, ako aj kalkulačku tarifov, pomocou ktorej si viete overiť náklady na váš aktuálny alebo väčší kontingent objektov.",
            },
            { type: "h2", text: "Fakturačná adresa a faktúry" },
            {
              type: "p",
              text: "Fakturačná adresa sa môže líšiť od adresy vašej prevádzky, napríklad ak doklady dostáva daňová kancelária. Už vystavené faktúry nájdete chronologicky zoradené; každú si možno stiahnuť ako PDF.",
            },
            { type: "h2", text: "Používanie kalkulačky tarifov" },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „Vyúčtovanie a kalkulačka tarifov“.",
                "V kalkulačke tarifov zadajte požadovaný počet objektov.",
                "Porovnajte výsledné náklady podľa tarifového stupňa.",
                "V prípade potreby prejdite priamo z kalkulačky na vhodný tarif.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kalkulačka tarifov zobrazuje náklady v mene uloženej pre vaše konto.",
                "Faktúry sú trvalo dostupné na stiahnutie.",
                "Fakturačnú adresu možno spravovať nezávisle od základných údajov prevádzky.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pomocou kalkulačky tarifov pravidelne porovnávajte, či váš kontingent objektov ešte zodpovedá skutočne obsadenému počtu objektov — pozri [Predplatné a tarif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Zmena hesla a e-mailu",
          excerpt: "Bezpečnostne kritické zmeny vyžadujú opätovné prihlásenie a potvrdzovací krok.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Heslo a e-mailová adresa patria medzi najbezpečnostnejšie kritické údaje vášho konta. myNextDays preto pri oboch zmenách vyžaduje opätovnú autentifikáciu — zmenu potvrdíte svojím aktuálnym heslom, aj keď ste už prihlásení.",
            },
            { type: "h2", text: "Zmena hesla" },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „Zmena hesla a e-mailu“.",
                "Zadajte svoje aktuálne heslo na potvrdenie.",
                "Zadajte nové heslo a zopakujte ho.",
                "Uložte zmenu.",
              ],
            },
            { type: "h2", text: "Zmena e-mailovej adresy" },
            {
              type: "p",
              text: "Zmena e-mailovej adresy prebieha ako dvojité potvrdenie: po potvrdení aktuálneho hesla dostanete potvrdzovací odkaz na NOVÚ adresu. Až kliknutím na tento odkaz sa zmena stane platnou — stará adresa zostáva dovtedy aktívna, aby nikdy nebol prerušený prístup do vášho konta.",
            },
            {
              type: "ul",
              items: [
                "Bez aktuálneho hesla nemožno zmeniť ani heslo, ani e-mail.",
                "Potvrdzovací odkaz pre novú e-mailovú adresu je časovo obmedzene platný.",
                "Do potvrdenia zostáva doterajšia e-mailová adresa aktívna pre prihlásenie a upozornenia.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Po zmene e-mailu skontrolujte aj dvojfaktorové overenie — pozri [Dvojfaktorové overenie](/hilfe/konto-abo/zwei-faktor) — ak boli obnovovacie kódy viazané na starú adresu.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Dvojfaktorové overenie",
          excerpt: "Dodatočný krok prihlásenia chráni vaše konto pred neoprávneným prístupom.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Dvojfaktorové overenie (2FA) dopĺňa vaše heslo o druhý faktor cez aplikáciu Authenticator. Ukradnuté heslo samo osebe tak už nestačí na prihlásenie do vášho konta myNextDays.",
            },
            { type: "h2", text: "Nastavenie 2FA" },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „Dvojfaktorové overenie“.",
                "Potvrďte svoje aktuálne heslo pre opätovnú autentifikáciu.",
                "Naskenujte zobrazený QR kód aplikáciou Authenticator.",
                "Zadajte vygenerovaný kód na potvrdenie.",
                "Zobrazené obnovovacie kódy si uložte na bezpečnom mieste.",
              ],
            },
            { type: "h2", text: "Deaktivácia 2FA" },
            {
              type: "p",
              text: "Aj deaktivácia dvojfaktorového overenia vyžaduje opätovnú autentifikáciu vaším aktuálnym heslom. Tak myNextDays zabraňuje tomu, aby niekto s už otvorenou reláciou jednoducho vypol vašu ochranu.",
            },
            {
              type: "ul",
              items: [
                "Obnovovacie kódy umožňujú prístup, ak sa strátí aplikácia Authenticator.",
                "Každý obnovovací kód je použiteľný len raz.",
                "Zapnutie aj vypnutie 2FA je rovnako viazané na potvrdenie hesla.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Uchovávajte svoje obnovovacie kódy oddelene od zariadenia s aplikáciou Authenticator, napríklad v správcovi hesiel.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "História zariadení",
          excerpt: "Majte prehľad, z ktorých zariadení je vaše konto prihlásené.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "História zariadení v /konto vám ukáže, na ktorých zariadeniach je vaše konto aktuálne prihlásené — s typom zariadenia, približnou polohou a časom poslednej aktivity. Tak rýchlo rozpoznáte, či prihlásenie skutočne pochádza od vás.",
            },
            { type: "h2", text: "Kontrola histórie zariadení" },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „História zariadení“.",
                "Prezrite si zoznam prihlásených zariadení.",
                "Ak rozpoznáte neznáme zariadenie, odhláste ho.",
                "Následne pre istotu zmeňte svoje heslo.",
              ],
            },
            { type: "h2", text: "Kedy má zmysel skontrolovať" },
            {
              type: "p",
              text: "Históriu zariadení skontrolujte najmä po zmene hesla alebo e-mailu, ako aj po použití cudzieho alebo verejného zariadenia. Neznámy záznam je jasným varovným signálom neoprávneného prístupu.",
            },
            {
              type: "ul",
              items: [
                "Každý záznam zobrazuje typ zariadenia, približnú polohu a poslednú aktivitu.",
                "Jednotlivé zariadenia možno cielene odhlásiť bez toho, aby to ovplyvnilo ostatné.",
                "Neznámy záznam je dôvodom na okamžitú zmenu hesla.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ak zariadenie nerozpoznáte, okamžite ho odhláste a následne zmeňte heslo v [Zmena hesla a e-mailu](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Ochrana osobných údajov",
          excerpt: "Riadenie indexovania vyhľadávačmi podľa objektu a export vašich údajov.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "V sekcii „Ochrana osobných údajov“ v /konto riadite dve veci: či môžu byť vaše stránky objektov indexované vyhľadávačmi, a ako môžete exportovať svoje údaje uložené v myNextDays.",
            },
            { type: "h2", text: "Indexovanie vyhľadávačmi podľa objektu" },
            {
              type: "p",
              text: "Predvolene je indexovanie vyhľadávačmi pre nové objekty deaktivované. Až keď ho vedome zapnete pre jednotlivý objekt, môžu vyhľadávače ako Google zaradiť verejnú stránku objektu do svojho indexu. Tak si zachovávate kontrolu nad tým, ktoré objekty sú nájditeľné mimo portálov a vlastnej platformy.",
            },
            {
              type: "steps",
              items: [
                "Otvorte /konto a sekciu „Ochrana osobných údajov“.",
                "Vyberte požadovaný objekt zo zoznamu.",
                "Zapnite alebo vypnite indexovanie vyhľadávačmi.",
                "Pri viacerých objektoch použite hromadný prepínač na jednotné nastavenie všetkých objektov.",
              ],
            },
            { type: "h2", text: "Export údajov" },
            {
              type: "p",
              text: "Cez funkciu exportu údajov si vyžiadate úplnú kópiu svojich údajov uložených v konte. Export sa zostaví a následne vám ho sprístupníme na stiahnutie.",
            },
            {
              type: "ul",
              items: [
                "Indexovanie je jednotlivo riadené podľa objektu, s hromadným prepínačom pre všetky objekty.",
                "Nové objekty zásadne štartujú bez indexovania vyhľadávačmi.",
                "Export údajov obsahuje vaše údaje o konte a objektoch v štruktúrovanej forme.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indexovanie vyhľadávačmi je nezávislé od viditeľnosti na portáloch a vlastnom trhovisku — týka sa výhradne verejnej stránky objektu vo vyhľadávačoch.",
            },
          ],
        },
      ],
    },
  ],
};
