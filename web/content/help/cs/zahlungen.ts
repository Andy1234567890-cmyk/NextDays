import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Platby a faktury",
  description: "Poskytovatelé plateb, platební pravidla a faktury.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Platby",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Propojení poskytovatele plateb",
          excerpt:
            "Jak propojit Stripe nebo PayPal s myNextDays a automaticky zpracovávat platby.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Dostupní poskytovatelé" },
            {
              type: "p",
              text: "myNextDays zpracovává platby prostřednictvím propojených poskytovatelů plateb. Aktuálně jsou podporovány Stripe a PayPal — můžete propojit jednoho nebo oba poskytovatele současně a používat je podle objektu nebo přání hosta.",
            },
            {
              type: "steps",
              items: [
                "Otevřete Účet a přepněte se do sekce „Platby“.",
                "Vyberte požadovaného poskytovatele — Stripe nebo PayPal.",
                "Postupujte podle dialogu pro propojení a přihlaste se u poskytovatele, nebo si vytvořte nový účet.",
                "Potvrďte propojení — stav se změní na „propojeno“.",
              ],
            },
            { type: "h2", text: "Co se stane poté" },
            {
              type: "p",
              text: "Jakmile je poskytovatel propojen, můžete odesílat platební odkazy, vybírat zálohy a spouštět vrácení peněz přímo z rezervace. Všechny částky se zpracovávají v měně uložené pro daný objekt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez propojeného poskytovatele můžete platby označit jen ručně jako přijaté — automatické inkaso pak není možné.",
            },
            { type: "h2", text: "Více objektů, jeden poskytovatel" },
            {
              type: "p",
              text: "Jednou vytvořené propojení platí v celém účtu pro všechny vaše objekty. Jak přesně inkaso probíhá, nastavíte v sekci [Platební pravidla](/hilfe/zahlungen/zahlungsregeln). Výplaty vám poté probíhají přes příslušného poskytovatele, viz [Výplaty](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe se hodí pro platby kartou a mnoho místních platebních metod",
                "PayPal nabízí hostům důvěrně známou alternativu",
                "Oba poskytovatele lze nezávisle na sobě odpojit a znovu propojit",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Platební pravidla",
          excerpt: "Nastavte, kdy je splatná záloha a doplatek rezervace.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Záloha a doplatek" },
            {
              type: "p",
              text: "Platební pravidla určují, jak se rezervace finančně vyřizuje — například záloha při rezervaci a doplatek před příjezdem, nebo okamžitá platba celé částky. Pravidla platí pro jednotlivý objekt a lze je kdykoli upravit.",
            },
            {
              type: "steps",
              items: [
                "Otevřete objekt a přepněte se do sekce „Platební pravidla“.",
                "Vyberte, zda se vybírá záloha, a nastavte její podíl.",
                "Určete, kdy je splatný doplatek, například určitý počet dní před příjezdem.",
                "Uložte nastavení.",
              ],
            },
            { type: "h2", text: "Automatické inkaso" },
            {
              type: "p",
              text: "Je-li propojen poskytovatel plateb, myNextDays automaticky vybere zálohu i doplatek v uloženém termínu a předem o tom informuje hosta zprávou.",
            },
            {
              type: "note",
              variant: "info",
              text: "Platební pravidla platí pouze pro rezervace s propojeným poskytovatelem plateb. Bez poskytovatele označujete platby ručně v rezervaci.",
            },
            { type: "h2", text: "Rozdíly podle kanálu" },
            {
              type: "p",
              text: "Na portálech může výjimečně platit jejich vlastní zpracování plateb — v takovém případě zkontrolujte příslušné podmínky portálu. Pro rezervace přes vlastní platformu nebo web platí vždy vaše zde uložená pravidla. Podrobnosti k napojení poskytovatele najdete v článku [Propojení poskytovatele plateb](/hilfe/zahlungen/zahlungsanbieter-verbinden), k fakturaci v článku [Vystavení faktur](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Záloha lze nastavit jako pevnou částku nebo procento",
                "Lhůtu doplatku lze volně zvolit",
                "Změny platí jen pro nové rezervace, ne zpětně",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Vystavení faktur",
          excerpt: "Jak k rezervaci vystavit fakturu se správnou fakturační adresou.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Vytvoření faktury" },
            {
              type: "p",
              text: "Ke každé rezervaci lze vystavit fakturu — pro samotného hosta, nebo pro odlišnou firmu, pokud jde o firemní rezervaci.",
            },
            {
              type: "steps",
              items: [
                "Otevřete rezervaci v sekci Rezervace.",
                "Vyberte „Vystavit fakturu“.",
                "Zkontrolujte nebo doplňte fakturační adresu.",
                "Zkontrolujte uvedené položky — ubytování, doplňkové služby, poplatky.",
                "Vystavte fakturu a odešlete ji hostovi.",
              ],
            },
            { type: "h2", text: "Správa fakturační adresy" },
            {
              type: "p",
              text: "Fakturační adresu můžete uložit přímo v rezervaci, nebo nechat hosta doplnit přes potvrzení rezervace. Bez úplné adresy nelze v některých zemích vystavit právně platnou fakturu.",
            },
            {
              type: "note",
              variant: "warn",
              text: "U firemních zákazníků zkontrolujte zejména název firmy a adresu — dodatečné opravy vyžadují opravný daňový doklad.",
            },
            { type: "h2", text: "Částky a měna" },
            {
              type: "p",
              text: "Všechny položky se uvádějí v měně uložené pro objekt. Již provedené platby se na faktuře uvádějí jako přijatá platba. Jak vznikají záloha a doplatek, se dočtete v článku [Platební pravidla](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Faktury lze stáhnout jako PDF",
                "Opravné doklady jsou při změnách možné kdykoli",
                "Doplňkové služby se zobrazují jako samostatná položka",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Vrácení peněz",
          excerpt:
            "Jak vrátit platbu zcela nebo částečně, pokud je rezervace zrušena nebo změněna.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Kdy je vrácení peněz potřeba" },
            {
              type: "p",
              text: "Vrácení peněz je typicky nutné při zrušení rezervace, ale může být potřeba i při dodatečné úpravě ceny nebo zrušené doplňkové službě.",
            },
            {
              type: "steps",
              items: [
                "Otevřete dotčenou rezervaci v sekci Rezervace.",
                "V platební sekci rezervace vyberte „Vrácení peněz“.",
                "Zadejte částku k vrácení — celou nebo částečnou.",
                "Potvrďte vrácení peněz.",
              ],
            },
            { type: "h2", text: "Průběh přes poskytovatele plateb" },
            {
              type: "p",
              text: "Vrácení peněz se provádí přes poskytovatele použitého při platbě — Stripe nebo PayPal — a putuje přímo zpět na původní platební prostředek hosta. Proces se automaticky zaznamená v časové ose rezervace.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Bez propojeného poskytovatele plateb nelze vrácení peněz spustit automaticky — v takovém případě si vrácení peněz vyřešte přímo s hostem.",
            },
            { type: "h2", text: "Dopad na provize" },
            {
              type: "p",
              text: "Již vyúčtované provize tržiště nebo portálu se při vrácení peněz poměrně upraví. Více k tomu v článku [Pochopení provizí](/hilfe/zahlungen/provisionen-verstehen). Podrobnosti k samotnému zrušení najdete v článku [Zrušení a vrácení peněz](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Částečné vrácení peněz je možné u jednotlivých položek",
                "Stav zpracování je v rezervaci vždy viditelný",
                "Vrácení peněz probíhá výhradně přes původně použitého poskytovatele",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Výplaty",
          excerpt:
            "Jak obdržíte výnosy ze svých rezervací vyplacené od propojených poskytovatelů plateb.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Jak výplaty fungují" },
            {
              type: "p",
              text: "Příchozí platby se nejprve shromažďují u propojeného poskytovatele plateb. Odtud probíhá výplata na váš uložený bankovní účet podle obvyklého rytmu daného poskytovatele.",
            },
            {
              type: "steps",
              items: [
                "Otevřete Účet a přepněte se do sekce „Platby“.",
                "Zkontrolujte v sekci „Výplaty“ stav příslušného poskytovatele.",
                "V případě potřeby otevřete podrobné zobrazení poskytovatele pro kompletní historii výplat.",
              ],
            },
            { type: "h2", text: "Co se odečítá před výplatou" },
            {
              type: "p",
              text: "Před výplatou se zohledňují vzniklé provize tržiště a portálu i poplatky poskytovatele. Vyplacená částka tak nemusí nutně odpovídat původní částce rezervace.",
            },
            {
              type: "note",
              variant: "info",
              text: "Přesné složení odpočtů vysvětluje článek [Pochopení provizí](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Více objektů a vlastníků" },
            {
              type: "p",
              text: "Spravujete-li objekty pro různé vlastníky, výplaty se přiřazují podle uložených vyúčtování vlastníků. Při nesrovnalostech nejprve zkontrolujte stav dotčených rezervací v sekci Rezervace.",
            },
            {
              type: "ul",
              items: [
                "Rytmus a způsob výplaty určuje příslušný poskytovatel",
                "Zadržené částky, například při probíhajícím vrácení peněz, jsou označeny",
                "Kompletní historie je k nahlédnutí přímo u poskytovatele",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Pochopení provizí",
          excerpt:
            "Přehled, jak se skládají provize tržiště a portálu a kde se vyúčtovávají.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Dva druhy provizí" },
            {
              type: "p",
              text: "U rezervací přes myNextDays mohou vznikat dvě odlišné provize: provize tržiště za rezervace přes vlastní platformu a provize portálu za rezervace přicházející přes napojené portály jako Booking nebo Airbnb. Obě jsou na sobě nezávislé a mohou se podle distribučního kanálu rezervace lišit.",
            },
            {
              type: "ul",
              items: [
                "Provize tržiště: vzniká u rezervací přes platformu myNextDays",
                "Provize portálu: počítá příslušný portál podle vlastních podmínek",
                "Přímé rezervace přes váš vlastní web je třeba posuzovat nezávisle na tom",
              ],
            },
            { type: "h2", text: "Kde jsou provize vidět" },
            {
              type: "steps",
              items: [
                "Otevřete Účet a přepněte se do sekce „Vyúčtování“.",
                "Vyberte požadovaný měsíc.",
                "Zkontrolujte přehled podle rezervace s příslušnou provizí.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Přes jaký kanál rezervace přišla, vidíte přímo u samotné rezervace — to vysvětluje, jaká provize byla v daném případě uplatněna.",
            },
            { type: "h2", text: "Souvislost s výplatami" },
            {
              type: "p",
              text: "Provize se odečítají z částky rezervace před výplatou. Podrobnosti o procesu výplaty najdete v článku [Výplaty](/hilfe/zahlungen/auszahlungen). Při vrácení peněz se příslušná provize poměrně opraví — kompletní průběh rezervace ukazuje [Časová osa rezervace](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
