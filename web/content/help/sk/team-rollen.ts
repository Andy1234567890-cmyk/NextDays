import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Tím a oprávnenia",
  description: "Zamestnanci, role a prístupové práva.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Prístup",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Pozvanie zamestnancov",
          excerpt: "Ako pozvete nových zamestnancov do svojho konta myNextDays.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Do svojej prevádzky môžete pozvať ľubovoľný počet zamestnancov — napríklad na recepciu, upratovanie alebo správu. Každá pozvánka je viazaná na e-mailovú adresu a okamžite pridelí pevnú rolu, ktorá určuje prístup na webe aj v aplikácii myNextDays.",
            },
            { type: "h2", text: "Odoslanie pozvánky" },
            {
              type: "steps",
              items: [
                "Otvorte „Konto“ a prepnite na sekciu „Tím“.",
                "Kliknite na „Pozvať zamestnanca“.",
                "Zadajte e-mailovú adresu osoby.",
                "Vyberte vhodnú rolu, napr. zamestnanec alebo upratovanie.",
                "Potvrďte pozvánku.",
              ],
            },
            { type: "h2", text: "Čo sa deje potom" },
            {
              type: "p",
              text: "Pozvaná osoba dostane e-mail s odkazom na nastavenie vlastného hesla a prihlásenie. Prihlásenie platí rovnako pre webový dashboard aj aplikáciu myNextDays — neexistuje samostatné konto pre každé frontend rozhranie.",
            },
            {
              type: "ul",
              items: [
                "Pozvánka je platná, kým sa neprijme alebo nezruší.",
                "Otvorené pozvánky vidíte v sekcii „Tím“ so statusom „Čaká sa“.",
                "Rolu možno kedykoľvek dodatočne upraviť.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ktorá rola smie vidieť ktoré oblasti, sa dozviete v [Role a oprávnenia](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pridelujte od začiatku najužšiu vhodnú rolu — práva možno kedykoľvek neskôr rozšíriť.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Role a oprávnenia",
          excerpt: "Päť rolí v myNextDays a čo môže každá z nich robiť.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozlišuje päť rolí: Admin, Co-Admin, Zamestnanec, Upratovanie a Vlastník. Každá rola určuje, ktoré oblasti sú viditeľné vo webovom dashboarde a v aplikácii myNextDays — práva sa pritom vynucujú na strane servera, nielen skryjú v rozhraní.",
            },
            { type: "h2", text: "Prehľad rolí" },
            {
              type: "ul",
              items: [
                "Admin: plný prístup do všetkých oblastí, vrátane financií, predaja a správy tímu.",
                "Co-Admin: takmer plný prístup ako Admin, pre druhú úroveň vedenia prevádzky.",
                "Zamestnanec: operatívny prístup k rezerváciám, kalendáru a úlohám, bez prehľadu o financiách alebo predaji.",
                "Upratovanie: prístup výhradne k priradeným úlohám upratovania a podrobnostiam objektu, bez prehľadu o financiách alebo predaji.",
                "Vlastník: prístup len na čítanie k vlastným objektom, žiadna správa cudzích objektov.",
              ],
            },
            { type: "h2", text: "Priradenie alebo zmena roly" },
            {
              type: "steps",
              items: [
                "Otvorte „Konto“ → „Tím“.",
                "Vyberte príslušného zamestnanca zo zoznamu.",
                "Kliknite na „Zmeniť rolu“.",
                "Vyberte novú rolu a potvrďte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zamestnanec a Upratovanie zásadne nevidia ceny, tržby ani rezervačné kanály — toto obmedzenie platí na strane servera a nemožno ho obísť cez rozhranie.",
            },
            {
              type: "note",
              variant: "info",
              text: "Prehľad podľa roly nájdete v [Čo ktorá rola vidí](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Čo ktorá rola vidí",
          excerpt: "Konkrétne oblasti a zobrazenia podľa roly na webe a v aplikácii.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Popri základných právach z [Role a oprávnenia](/hilfe/team-rollen/rollen-berechtigungen) pomáha konkrétny pohľad na jednotlivé oblasti nastaviť pri onboardingu nových zamestnancov správne očakávania.",
            },
            { type: "h2", text: "Kalendár a rezervácie" },
            {
              type: "p",
              text: "Admin, Co-Admin a Zamestnanec vidia úplný plán obsadenosti s údajmi hostí a úlohami. Upratovanie vidí len jemu priradené termíny vrátane adresy objektu a kontrolného zoznamu, no žiadne mená hostí ani ceny. Vlastníci vidia kalendár obsadenosti výhradne pre svoje vlastné objekty, len na čítanie.",
            },
            { type: "h2", text: "Financie a predaj" },
            {
              type: "ul",
              items: [
                "Tržby, provízie a faktúry: len Admin a Co-Admin.",
                "Portály (napojenie na OTA) a viditeľnosť na platforme: len Admin a Co-Admin.",
                "Zamestnanec a Upratovanie: žiadny prístup k oblastiam financií alebo predaja, ani na podrobné stránky.",
              ],
            },
            { type: "h2", text: "Tím a nastavenia" },
            {
              type: "p",
              text: "Správa zamestnancov, rolí a nastavení konta zostáva vyhradená Adminovi a Co-Adminovi. Vlastníci a operatívne role túto oblasť v aplikácii myNextDays ani vo webovom dashboarde vôbec nevidia.",
            },
            {
              type: "note",
              variant: "info",
              text: "Toto rozdelenie platí identicky vo webovom dashboarde aj v aplikácii myNextDays, keďže obe frontendy pracujú s rovnakou rolou z vášho konta.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Otestujte nové role po pozvaní krátko spoločne so zamestnancom, aby ste predišli nedorozumeniam o viditeľných oblastiach.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Odobratie prístupu",
          excerpt: "Okamžité a úplné odstránenie prístupu zamestnanca.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "p",
              text: "Ak zamestnanec opustí vašu prevádzku, alebo sa zmení spolupráca, odstráňte prístup priamo v konte. Odobratie pôsobí na strane servera a okamžite — nie až po vypršaní existujúcej relácie.",
            },
            { type: "h2", text: "Odstránenie prístupu" },
            {
              type: "steps",
              items: [
                "Otvorte „Konto“ → „Tím“.",
                "Vyberte príslušného zamestnanca.",
                "Kliknite na „Odobrať prístup“.",
                "Potvrďte proces.",
              ],
            },
            { type: "h2", text: "Vplyv na prebiehajúce relácie" },
            {
              type: "p",
              text: "Po odobratí sa osoba nemôže znova prihlásiť ani vo webovom dashboarde, ani v aplikácii myNextDays. Už priradené úlohy alebo termíny upratovania by ste mali vopred priradiť inému zamestnancovi, aby nič nezostalo nespracované.",
            },
            {
              type: "ul",
              items: [
                "Otvorené úlohy pred odobratím prístupu znova priraďte.",
                "Prístup možno neskôr obnoviť opätovnou pozvánkou.",
                "Odobratie sa týka len tejto prevádzky, nie iných kont danej osoby.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Odoberte prístup včas, hneď ako spolupráca skončí — otvorené kontá zamestnancov inak zostávajú zbytočným bezpečnostným rizikom.",
            },
          ],
        },
      ],
    },
  ],
};
