import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilní aplikace",
  description: "Aplikace myNextDays na cesty.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Aplikace",
      articles: [
        {
          slug: "die-app",
          title: "Aplikace myNextDays",
          excerpt: "Jeden účet, čtyři prostředí: host, agentura, vlastník a zaměstnanec.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Aplikace myNextDays je mobilní platforma pro celý váš provoz. Není to samostatný produkt, ale rovnocenné rozhraní k vašemu webovému dashboardu — obě přistupují ke stejnému účtu a stejným datům, pouze rozhraní je optimalizováno pro použití na cestách.",
            },
            { type: "h2", text: "Čtyři prostředí v jedné aplikaci" },
            {
              type: "ul",
              items: [
                "Host: prohlížení rezervací, komunikace s provozem, zobrazení informací pro check-in.",
                "Agentura: přehledná správa více provozů a objektů.",
                "Vlastník: náhled pouze pro čtení do vlastních objektů, obsazenosti a přehledů.",
                "Zaměstnanec: kalendář, úkoly a úklidové plány pro provozní každodenní práci.",
              ],
            },
            { type: "h2", text: "Které prostředí uvidíte" },
            {
              type: "p",
              text: "Po přihlášení aplikace automaticky zobrazí prostředí odpovídající vaší roli — stejné roli, jaká platí i ve webovém dashboardu. Zaměstnanec s omezenými právy vidí v aplikaci přesně stejná omezení jako v prohlížeči, protože oprávnění se ověřuje na straně serveru.",
            },
            {
              type: "note",
              variant: "info",
              text: "Více o rolích a o tom, co jednotlivé role smí vidět, najdete v článku [Role a oprávnění](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pro aplikaci nepotřebujete samostatnou registraci — přihlaste se jednoduše svými stávajícími přihlašovacími údaji myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Instalace aplikace a přihlášení",
          excerpt: "Jak si stáhnout aplikaci myNextDays a přihlásit se.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Aplikace myNextDays je k dispozici pro iOS i Android. Přihlášení probíhá stejnými přihlašovacími údaji jako ve webovém dashboardu — není potřeba žádný samostatný účet ani nová registrace.",
            },
            { type: "h2", text: "Instalace" },
            {
              type: "steps",
              items: [
                "Otevřete App Store (iOS) nebo Google Play (Android).",
                "Vyhledejte „myNextDays“.",
                "Nainstalujte aplikaci do svého smartphonu nebo tabletu.",
                "Po instalaci aplikaci otevřete.",
              ],
            },
            { type: "h2", text: "Přihlášení" },
            {
              type: "steps",
              items: [
                "Klepněte na „Přihlásit se“.",
                "Zadejte svou e-mailovou adresu a heslo.",
                "V případě potřeby potvrďte dvoufaktorové ověření.",
                "Automaticky se dostanete do prostředí odpovídajícího vaší roli.",
              ],
            },
            {
              type: "ul",
              items: [
                "Přihlašovací údaje jsou shodné s webovým dashboardem.",
                "Pokud vám byl přístup odebrán, je okamžitě zablokováno i přihlášení v aplikaci.",
                "Při problémech s heslem použijte přímo v aplikaci „Zapomenuté heslo“.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Přihlašujte se výhradně přes oficiální záznam „myNextDays“ v obchodě s aplikacemi; aplikace nikdy nevyžaduje přihlašovací údaje mimo přihlašovací obrazovku.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Správa na cestách",
          excerpt: "Zpracování rezervací, zpráv a úkolů přímo ze smartphonu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "p",
              text: "Aplikace myNextDays se hodí zejména pro běžný provoz na cestách: vidíte aktuální rezervace, odpovídáte na zprávy hostů a zpracováváte úkoly, aniž byste museli sedět u počítače — změny se v reálném čase projeví i ve webovém dashboardu.",
            },
            { type: "h2", text: "Přehled rezervací" },
            {
              type: "p",
              text: "V oblasti „Rezervace“ vidíte příjezdy a odjezdy, obsazenost a stav podle objektu. Zaměstnanci a úklid přitom vidí pouze pro ně relevantní informace, bez cen nebo obchodních detailů.",
            },
            { type: "h2", text: "Zprávy a úkoly" },
            {
              type: "steps",
              items: [
                "Otevřete oblast „Zprávy“ a odpovězte přímo na dotazy hostů.",
                "Přepněte do „Úkoly“ a zobrazte si vám přiřazené úkoly.",
                "Klepnutím na úkol otevřete jeho detail a dokončete jej.",
                "Dokončené úklidové termíny označte přímo na místě jako splněné.",
              ],
            },
            {
              type: "ul",
              items: [
                "Nové zprávy a úkoly se zobrazují živě, bez ručního obnovování.",
                "Dokončené úkoly jsou okamžitě viditelné i ve webovém dashboardu.",
                "Vlastníci vidí rezervace a přehledy svých objektů, avšak pouze pro čtení.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push oznámení vás informují o nových zprávách a přiřazených úkolech, jakmile je povolíte v nastavení zařízení.",
            },
          ],
        },
      ],
    },
  ],
};
