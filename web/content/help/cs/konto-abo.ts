import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Účet a předplatné",
  description: "Základní údaje, tarif, bezpečnost a 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Účet",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Základní údaje provozu",
          excerpt: "Centrální správa názvu firmy, adresy a kontaktních údajů vašeho provozu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Na stránce /konto myNextDays sdružuje všechny funkce provozu a účtu jako oddíly na jedné stránce — nemusíte přepínat mezi mnoha podstránkami. Základní údaje provozu tvoří přitom základ: název firmy, právní forma, adresa a kontaktní údaje, které se používají pro faktury, portály a komunikaci s hosty.",
            },
            { type: "h2", text: "Otevření a úprava základních údajů" },
            {
              type: "steps",
              items: [
                "Otevřete /konto.",
                "Přepněte do oddílu „Základní údaje provozu“.",
                "Zkontrolujte název firmy, adresu, telefonní číslo a e-mailovou adresu pro dotazy.",
                "Proveďte požadované změny.",
                "Oddíl uložte.",
              ],
            },
            { type: "h2", text: "Proč jsou tyto údaje důležité" },
            {
              type: "p",
              text: "Základní údaje provozu se propisují do faktur, do registrace u napojených portálů a do právně povinných údajů, jako je tiráž. Neúplná nebo zastaralá adresa může vést k chybně vystaveným fakturám nebo ke zpoždění napojení na portály.",
            },
            {
              type: "ul",
              items: [
                "Název firmy a právní forma se zobrazují na všech vystavených fakturách.",
                "Adresa je potřebná pro registraci u portálů.",
                "Kontaktní údaje slouží jako záložní cesta, pokud systémová oznámení nedorazí.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Po změně fakturační adresy zkontrolujte již vystavené faktury v článku [Vyúčtování a kalkulačka tarifů](/hilfe/konto-abo/abrechnung-tarifrechner) — stávající doklady se zpětně neupravují.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Předplatné a tarif",
          excerpt: "Váš tarif určuje kontingent objektů — aktuálně zarezervovaný počet objektů vidíte kdykoli v účtu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Vaše předplatné myNextDays zahrnuje kontingent objektů: maximální počet objektů (pokoje nebo rekreační objekty), které můžete současně aktivně spravovat. Aktuálně zarezervovaný počet objektů se zobrazuje v oddílu „Předplatné a tarif“ na stránce /konto spolu se zbývajícím kontingentem.",
            },
            { type: "h2", text: "Sledování kontingentu" },
            {
              type: "p",
              text: "Kontingent je vynucován na straně serveru: jakmile dosáhnete horní hranice svého tarifu, nelze založit další objekt, dokud stávající objekt nedeaktivujete nebo tarif nerozšíříte. To platí bez ohledu na to, zda je nový objekt pokoj nebo rekreační objekt — obojí se do kontingentu počítá stejně.",
            },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Předplatné a tarif“.",
                "Zkontrolujte zarezervovaný počet objektů vůči kontingentu svého tarifu.",
                "V případě potřeby zvolte větší tarif, abyste mohli založit více objektů.",
                "Potvrďte změnu tarifu.",
              ],
            },
            {
              type: "ul",
              items: [
                "Každý objekt se do kontingentu počítá zvlášť, bez ohledu na typ objektu.",
                "Změna tarifu se okamžitě projeví na dostupném kontingentu.",
                "Downgrade je možný pouze tehdy, pokud počet aktivních objektů odpovídá novému kontingentu.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Downgrade na tarif s menším kontingentem bude odmítnut, dokud je aktivních více objektů, než nový tarif povoluje. Nejprve deaktivujte přebytečné objekty.",
            },
            {
              type: "note",
              variant: "info",
              text: "Podrobnosti o fakturách a výpočtu tarifu najdete v článku [Vyúčtování a kalkulačka tarifů](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Vyúčtování a kalkulačka tarifů",
          excerpt: "Fakturační adresa, dosavadní faktury a kalkulačka tarifu pro váš kontingent objektů.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Oddíl „Vyúčtování a kalkulačka tarifů“ na stránce /konto sdružuje vše kolem fakturace: vaši fakturační adresu, seznam dosavadních faktur ke stažení a kalkulačku tarifu, pomocí které si můžete propočítat náklady na svůj aktuální nebo větší kontingent objektů.",
            },
            { type: "h2", text: "Fakturační adresa a faktury" },
            {
              type: "p",
              text: "Fakturační adresa se může lišit od adresy vašeho provozu, například pokud doklady přijímá daňová kancelář. Již vystavené faktury najdete chronologicky seřazené; každou lze stáhnout jako PDF.",
            },
            { type: "h2", text: "Použití kalkulačky tarifů" },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Vyúčtování a kalkulačka tarifů“.",
                "Do kalkulačky tarifů zadejte požadovaný počet objektů.",
                "Porovnejte výsledné náklady podle jednotlivých úrovní tarifu.",
                "V případě potřeby přejděte přímo z kalkulačky na odpovídající tarif.",
              ],
            },
            {
              type: "ul",
              items: [
                "Kalkulačka tarifů zobrazuje náklady v měně uložené u vašeho účtu.",
                "Faktury jsou trvale k dispozici ke stažení.",
                "Fakturační adresu lze spravovat nezávisle na základních údajích provozu.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Pomocí kalkulačky tarifů pravidelně kontrolujte, zda váš kontingent objektů stále odpovídá skutečně zarezervovanému počtu objektů — viz [Předplatné a tarif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Změna hesla a e-mailu",
          excerpt: "Bezpečnostně kritické změny vyžadují opětovné přihlášení a potvrzovací krok.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Heslo a e-mailová adresa patří k nejbezpečnostně kritičtějším údajům vašeho účtu. myNextDays proto u obou změn vyžaduje opětovné ověření — změnu potvrzujete svým aktuálním heslem, i když jste již přihlášeni.",
            },
            { type: "h2", text: "Změna hesla" },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Změna hesla a e-mailu“.",
                "Pro potvrzení zadejte své aktuální heslo.",
                "Zadejte nové heslo a zopakujte jej.",
                "Změnu uložte.",
              ],
            },
            { type: "h2", text: "Změna e-mailové adresy" },
            {
              type: "p",
              text: "Změna e-mailové adresy probíhá jako dvojité potvrzení: po ověření vašeho aktuálního hesla obdržíte potvrzovací odkaz na NOVOU adresu. Změna se projeví až po kliknutí na tento odkaz — stará adresa zůstává do té doby aktivní, aby přístup k vašemu účtu nebyl nikdy přerušen.",
            },
            {
              type: "ul",
              items: [
                "Bez aktuálního hesla nelze změnit ani heslo, ani e-mail.",
                "Potvrzovací odkaz pro novou e-mailovou adresu má časově omezenou platnost.",
                "Do potvrzení zůstává dosavadní e-mailová adresa aktivní pro přihlášení i oznámení.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Po změně e-mailu zkontrolujte i dvoufaktorové ověřování — viz [Dvoufaktorové ověřování](/hilfe/konto-abo/zwei-faktor) — pokud byly obnovovací kódy vázány na starou adresu.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Dvoufaktorové ověřování",
          excerpt: "Dodatečný krok přihlášení chrání váš účet před neoprávněným přístupem.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Dvoufaktorové ověřování (2FA) doplňuje vaše heslo o druhý faktor prostřednictvím aplikace pro ověřování. Díky tomu už samotné odcizené heslo nestačí k přihlášení do vašeho účtu myNextDays.",
            },
            { type: "h2", text: "Nastavení 2FA" },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Dvoufaktorové ověřování“.",
                "Potvrďte své aktuální heslo pro opětovné ověření.",
                "Naskenujte zobrazený QR kód pomocí aplikace pro ověřování.",
                "Zadejte vygenerovaný kód pro potvrzení.",
                "Zobrazené obnovovací kódy si uložte na bezpečné místo.",
              ],
            },
            { type: "h2", text: "Deaktivace 2FA" },
            {
              type: "p",
              text: "I deaktivace dvoufaktorového ověřování vyžaduje opětovné ověření vaším aktuálním heslem. Tím myNextDays zabraňuje tomu, aby někdo s již otevřenou relací jednoduše vypnul vaši ochranu.",
            },
            {
              type: "ul",
              items: [
                "Obnovovací kódy umožňují přístup, pokud se ztratí aplikace pro ověřování.",
                "Každý obnovovací kód lze použít pouze jednou.",
                "Zapnutí i vypnutí 2FA jsou stejně vázána na potvrzení heslem.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Uchovávejte své obnovovací kódy odděleně od zařízení s aplikací pro ověřování, například ve správci hesel.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Historie zařízení",
          excerpt: "Mějte přehled o tom, ze kterých zařízení je váš účet přihlášen.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Historie zařízení na stránce /konto vám ukazuje, na kterých zařízeních je váš účet aktuálně přihlášen — s typem zařízení, přibližnou polohou a časem poslední aktivity. Snadno tak rozpoznáte, zda přihlášení skutečně pochází od vás.",
            },
            { type: "h2", text: "Kontrola historie zařízení" },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Historie zařízení“.",
                "Projděte si seznam přihlášených zařízení.",
                "Pokud rozpoznáte neznámé zařízení, odhlaste jej.",
                "Poté z bezpečnostních důvodů změňte své heslo.",
              ],
            },
            { type: "h2", text: "Kdy má kontrola smysl" },
            {
              type: "p",
              text: "Historii zařízení zkontrolujte zejména po změně hesla nebo e-mailu a po použití cizího nebo veřejného zařízení. Neznámý záznam je jasným varovným signálem neoprávněného přístupu.",
            },
            {
              type: "ul",
              items: [
                "Každý záznam ukazuje typ zařízení, přibližnou polohu a poslední aktivitu.",
                "Jednotlivá zařízení lze cíleně odhlásit, aniž by to ovlivnilo ostatní.",
                "Neznámé zařízení je důvodem k okamžité změně hesla.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pokud zařízení nerozpoznáte, okamžitě jej odhlaste a poté změňte heslo v článku [Změna hesla a e-mailu](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Ochrana osobních údajů",
          excerpt: "Řízení indexace vyhledávači podle objektu a export vašich dat.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "V oddílu „Ochrana osobních údajů“ na stránce /konto řídíte dvě věci: zda smí být vaše stránky objektů indexovány vyhledávači, a jak si můžete exportovat data uložená u myNextDays.",
            },
            { type: "h2", text: "Indexace vyhledávači podle objektu" },
            {
              type: "p",
              text: "U nových objektů je indexace vyhledávači ve výchozím nastavení deaktivovaná. Teprve když ji vědomě zapnete pro daný objekt, smí vyhledávače jako Google zařadit veřejnou stránku objektu do svého indexu. Máte tak pod kontrolou, které objekty jsou dohledatelné mimo portály a vlastní platformu.",
            },
            {
              type: "steps",
              items: [
                "Otevřete /konto a oddíl „Ochrana osobních údajů“.",
                "Vyberte požadovaný objekt ze seznamu.",
                "Zapněte nebo vypněte indexaci vyhledávači.",
                "U více objektů využijte hromadný přepínač pro jednotné nastavení všech objektů.",
              ],
            },
            { type: "h2", text: "Export dat" },
            {
              type: "p",
              text: "Prostřednictvím funkce exportu dat vyžádáte kompletní kopii dat uložených ve vašem účtu. Export se sestaví a poté vám bude poskytnut ke stažení.",
            },
            {
              type: "ul",
              items: [
                "Indexaci lze řídit jednotlivě podle objektu, s hromadným přepínačem pro všechny objekty.",
                "Nové objekty vždy začínají bez indexace vyhledávači.",
                "Export dat obsahuje vaše data účtu a objektů ve strukturované podobě.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indexace vyhledávači je nezávislá na viditelnosti na portálech a na vlastním tržišti — týká se výhradně veřejné stránky objektu ve vyhledávačích.",
            },
          ],
        },
      ],
    },
  ],
};
