import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Tým a oprávnění",
  description: "Zaměstnanci, role a přístupová práva.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Přístup",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Pozvání zaměstnance",
          excerpt: "Jak pozvat nové zaměstnance do vašeho účtu myNextDays.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Do svého provozu můžete pozvat libovolný počet zaměstnanců — například na recepci, úklid nebo správu. Každá pozvánka je vázána na e-mailovou adresu a okamžitě přiděluje pevnou roli, která určuje přístup na webu i v aplikaci myNextDays.",
            },
            { type: "h2", text: "Odeslání pozvánky" },
            {
              type: "steps",
              items: [
                "Otevřete „Účet“ a přepněte do sekce „Tým“.",
                "Klikněte na „Pozvat zaměstnance“.",
                "Zadejte e-mailovou adresu dané osoby.",
                "Vyberte odpovídající roli, např. zaměstnanec nebo úklid.",
                "Pozvánku potvrďte.",
              ],
            },
            { type: "h2", text: "Co se stane dál" },
            {
              type: "p",
              text: "Pozvaná osoba obdrží e-mail s odkazem, kde si nastaví vlastní heslo a přihlásí se. Přihlášení platí stejně pro webový dashboard i pro aplikaci myNextDays — neexistuje samostatný účet pro každé rozhraní.",
            },
            {
              type: "ul",
              items: [
                "Pozvánka platí, dokud není přijata nebo zrušena.",
                "Otevřené pozvánky vidíte v sekci „Tým“ se stavem „Čeká na vyřízení“.",
                "Roli lze kdykoli dodatečně upravit.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jaká role smí vidět jaké oblasti, se dozvíte v článku [Role a oprávnění](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Od začátku přidělujte nejužší vyhovující roli — práva lze kdykoli později rozšířit.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Role a oprávnění",
          excerpt: "Pět rolí v myNextDays a co každá z nich smí.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "myNextDays rozlišuje pět rolí: administrátor, spoluadministrátor, zaměstnanec, úklid a vlastník. Každá role určuje, které oblasti jsou viditelné ve webovém dashboardu a v aplikaci myNextDays — práva jsou přitom vynucována na straně serveru, nejen skryta v rozhraní.",
            },
            { type: "h2", text: "Přehled rolí" },
            {
              type: "ul",
              items: [
                "Administrátor: plný přístup do všech oblastí, včetně financí, obchodu a správy týmu.",
                "Spoluadministrátor: téměř plný přístup jako administrátor, pro druhou řídicí úroveň provozu.",
                "Zaměstnanec: provozní přístup k rezervacím, kalendáři a úkolům, bez náhledu do financí nebo obchodu.",
                "Úklid: přístup výhradně k přiřazeným úklidovým úkolům a detailům objektu, bez náhledu do financí nebo obchodu.",
                "Vlastník: náhled pouze pro čtení do vlastních objektů, bez správy cizích objektů.",
              ],
            },
            { type: "h2", text: "Přiřazení nebo změna role" },
            {
              type: "steps",
              items: [
                "Otevřete „Účet“ → „Tým“.",
                "Vyberte příslušného zaměstnance ze seznamu.",
                "Klikněte na „Změnit roli“.",
                "Vyberte novou roli a potvrďte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Zaměstnanec a úklid zásadně nevidí ceny, tržby ani prodejní kanály — toto omezení platí na straně serveru a nelze jej obejít přes rozhraní.",
            },
            {
              type: "note",
              variant: "info",
              text: "Přehled podle jednotlivých rolí najdete v článku [Co která role vidí](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Co která role vidí",
          excerpt: "Konkrétní oblasti a náhledy podle role na webu i v aplikaci.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Kromě základních práv z článku [Role a oprávnění](/hilfe/team-rollen/rollen-berechtigungen) pomáhá konkrétní pohled na jednotlivé oblasti nastavit správná očekávání při zaškolování nových zaměstnanců.",
            },
            { type: "h2", text: "Kalendář a rezervace" },
            {
              type: "p",
              text: "Administrátor, spoluadministrátor a zaměstnanec vidí kompletní plán obsazenosti s údaji o hostech a úkoly. Úklid vidí pouze jemu přiřazené termíny včetně adresy objektu a kontrolního seznamu, avšak žádná jména hostů ani ceny. Vlastníci vidí kalendář obsazenosti výhradně pro své vlastní objekty, pouze pro čtení.",
            },
            { type: "h2", text: "Finance a obchod" },
            {
              type: "ul",
              items: [
                "Tržby, provize a faktury: pouze administrátor a spoluadministrátor.",
                "Portály (napojení na OTA) a viditelnost na platformě: pouze administrátor a spoluadministrátor.",
                "Zaměstnanec a úklid: žádný přístup do oblastí financí nebo obchodu, ani na detailní stránky.",
              ],
            },
            { type: "h2", text: "Tým a nastavení" },
            {
              type: "p",
              text: "Správa zaměstnanců, rolí a nastavení účtu zůstává vyhrazena administrátorovi a spoluadministrátorovi. Vlastníci a provozní role tuto oblast v aplikaci myNextDays ani ve webovém dashboardu vůbec nevidí.",
            },
            {
              type: "note",
              variant: "info",
              text: "Toto rozdělení platí shodně ve webovém dashboardu i v aplikaci myNextDays, protože obě rozhraní čerpají stejnou roli z vašeho účtu.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Nové role po pozvání krátce společně se zaměstnancem otestujte, abyste předešli nedorozuměním ohledně viditelných oblastí.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Odebrání přístupu",
          excerpt: "Okamžité a úplné odebrání přístupu zaměstnance.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Pokud zaměstnanec opustí váš provoz nebo se změní forma spolupráce, odeberte přístup přímo v účtu. Odebrání se projeví na straně serveru a okamžitě — nikoli až po vypršení stávající relace.",
            },
            { type: "h2", text: "Odebrání přístupu" },
            {
              type: "steps",
              items: [
                "Otevřete „Účet“ → „Tým“.",
                "Vyberte příslušného zaměstnance.",
                "Klikněte na „Odebrat přístup“.",
                "Potvrďte akci.",
              ],
            },
            { type: "h2", text: "Dopad na běžící relace" },
            {
              type: "p",
              text: "Po odebrání se daná osoba už nebude moci znovu přihlásit ani do webového dashboardu, ani do aplikace myNextDays. Již přiřazené úkoly nebo úklidové termíny byste měli předem přiřadit jinému zaměstnanci, aby nic nezůstalo nedokončeno.",
            },
            {
              type: "ul",
              items: [
                "Otevřené úkoly před odebráním znovu přiřaďte.",
                "Přístup lze později znovu obnovit pomocí pozvánky.",
                "Odebrání se týká pouze tohoto provozu, nikoli dalších účtů dané osoby.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Přístup odeberte co nejdříve po skončení spolupráce — otevřené zaměstnanecké účty jinak zůstávají zbytečným bezpečnostním rizikem.",
            },
          ],
        },
      ],
    },
  ],
};
