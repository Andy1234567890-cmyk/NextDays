import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Csapat és jogosultságok",
  description: "Munkatársak, szerepkörök és hozzáférési jogok.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Hozzáférés",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Munkatárs meghívása",
          excerpt: "Így hívhat meg új munkatársakat myNextDays fiókjához.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Vállalkozásához tetszőleges számú munkatársat meghívhat — például recepcióra, takarításra vagy adminisztrációra. Minden meghívás egy e-mail-címhez kötött, és azonnal egy fix szerepkört rendel hozzá, amely meghatározza a hozzáférést a weben és a myNextDays alkalmazásban.",
            },
            { type: "h2", text: "Meghívó küldése" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Fiók” menüt, és váltson a „Csapat” területre.",
                "Kattintson a „Munkatárs meghívása” gombra.",
                "Adja meg a személy e-mail-címét.",
                "Válassza ki a megfelelő szerepkört, pl. munkatárs vagy takarítás.",
                "Erősítse meg a meghívást.",
              ],
            },
            { type: "h2", text: "Mi történik ezután" },
            {
              type: "p",
              text: "A meghívott személy e-mailt kap egy linkkel, amellyel saját jelszót állíthat be, és bejelentkezhet. A bejelentkezés egyaránt érvényes a webes irányítópultra és a myNextDays alkalmazásra — nincs külön fiók felületenként.",
            },
            {
              type: "ul",
              items: [
                "Egy meghívó addig érvényes, amíg elfogadják vagy visszavonják.",
                "A nyitott meghívásokat a „Csapat” területen látja „Függőben” állapottal.",
                "A szerepkör bármikor utólag módosítható.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Hogy melyik szerepkör mely területeket láthatja, arról bővebben: [Szerepkörök és jogosultságok](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kezdettől fogva a legszűkebb megfelelő szerepkört rendelje hozzá — a jogosultságok bármikor később bővíthetők.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Szerepkörök és jogosultságok",
          excerpt: "Az öt szerepkör a myNextDaysben, és hogy melyik mit tehet.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays öt szerepkört különböztet meg: admin, ko-admin, munkatárs, takarítás és tulajdonos. Minden szerepkör meghatározza, mely területek láthatók a webes irányítópulton és a myNextDays alkalmazásban — a jogosultságokat a szerver kényszeríti ki, nem csupán a felületen vannak elrejtve.",
            },
            { type: "h2", text: "A szerepkörök áttekintése" },
            {
              type: "ul",
              items: [
                "Admin: teljes hozzáférés minden területhez, beleértve a pénzügyeket, értékesítést és csapatkezelést.",
                "Ko-admin: szinte teljes hozzáférés, mint az admin, a vállalkozás második vezetői szintjéhez.",
                "Munkatárs: operatív hozzáférés a foglalásokhoz, naptárhoz és feladatokhoz, pénzügyi vagy értékesítési betekintés nélkül.",
                "Takarítás: kizárólag a hozzárendelt takarítási feladatokhoz és objektumrészletekhez való hozzáférés, pénzügyi vagy értékesítési betekintés nélkül.",
                "Tulajdonos: csak olvasható betekintés saját objektumaiba, idegen objektumok kezelése nélkül.",
              ],
            },
            { type: "h2", text: "Szerepkör hozzárendelése vagy módosítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Fiók” → „Csapat” menüt.",
                "Válassza ki az érintett munkatársat a listából.",
                "Kattintson a „Szerepkör módosítása” gombra.",
                "Válassza ki az új szerepkört, és erősítse meg.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "A munkatárs és a takarítás alapvetően nem lát árakat, bevételeket vagy foglalási csatornákat — ez a kizárás szerveroldalon érvényesül, és a felületen keresztül nem kerülhető meg.",
            },
            {
              type: "note",
              variant: "info",
              text: "Szerepkörönkénti áttekintést itt talál: [Mit lát melyik szerepkör](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Mit lát melyik szerepkör",
          excerpt: "Konkrét területek és nézetek szerepkörönként a weben és az alkalmazásban.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A [Szerepkörök és jogosultságok](/hilfe/team-rollen/rollen-berechtigungen) alapvető jogosultságai mellett egy konkrét betekintés az egyes területekbe segít abban, hogy új munkatársak bevezetésekor helyes elvárásokat állítson.",
            },
            { type: "h2", text: "Naptár és foglalások" },
            {
              type: "p",
              text: "Az admin, a ko-admin és a munkatárs látja a teljes foglalási naptárat vendégadatokkal és feladatokkal. A takarítás csak a hozzá rendelt időpontokat látja, az objektum címével és ellenőrzőlistával, de vendégnevek vagy árak nélkül. A tulajdonosok kizárólag saját objektumaikhoz látják a kihasználtsági naptárat, csak olvasható formában.",
            },
            { type: "h2", text: "Pénzügy és értékesítés" },
            {
              type: "ul",
              items: [
                "Bevételek, jutalékok és számlák: csak admin és ko-admin.",
                "Portálok (OTA-csatlakozás) és platform-láthatóság: csak admin és ko-admin.",
                "Munkatárs és takarítás: nincs hozzáférés a pénzügyi vagy értékesítési területekhez, még a részletoldalakhoz sem.",
              ],
            },
            { type: "h2", text: "Csapat és beállítások" },
            {
              type: "p",
              text: "A munkatársak, szerepkörök és fiókbeállítások kezelése kizárólag az admin és a ko-admin számára elérhető. A tulajdonosok és az operatív szerepkörök ezt a területet a myNextDays alkalmazásban és a webes irányítópulton egyáltalán nem is látják.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ez a felosztás azonosan érvényes a webes irányítópulton és a myNextDays alkalmazásban is, mivel mindkét felület ugyanazt a szerepkört kérdezi le fiókjából.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Az új szerepköröket a meghívás után röviden közösen tesztelje a munkatárssal, hogy elkerülje a látható területekkel kapcsolatos félreértéseket.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Hozzáférés visszavonása",
          excerpt: "Munkatárs hozzáférésének azonnali és teljes eltávolítása.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "Ha egy munkatárs elhagyja vállalkozását, vagy megváltozik az együttműködés, távolítsa el a hozzáférést közvetlenül a fiókban. A visszavonás szerveroldalon és azonnal érvénybe lép — nem csak egy meglévő munkamenet lejárta után.",
            },
            { type: "h2", text: "Hozzáférés eltávolítása" },
            {
              type: "steps",
              items: [
                "Nyissa meg a „Fiók” → „Csapat” menüt.",
                "Válassza ki az érintett munkatársat.",
                "Kattintson a „Hozzáférés visszavonása” gombra.",
                "Erősítse meg a folyamatot.",
              ],
            },
            { type: "h2", text: "Hatás a futó munkamenetekre" },
            {
              type: "p",
              text: "A visszavonás után a személy sem a webes irányítópulton, sem a myNextDays alkalmazásban nem tud újra bejelentkezni. A már hozzárendelt feladatokat vagy takarítási időpontokat előtte rendelje hozzá egy másik munkatárshoz, hogy semmi ne maradjon feldolgozatlanul.",
            },
            {
              type: "ul",
              items: [
                "A nyitott feladatokat a visszavonás előtt rendelje újra hozzá.",
                "A hozzáférés később ismét visszaállítható egy új meghívóval.",
                "A visszavonás csak ezt a vállalkozást érinti, a személy más fiókjait nem.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Vonja vissza a hozzáférést időben, amint egy együttműködés véget ér — a nyitott munkatársi fiókok egyébként felesleges biztonsági kockázatot jelentenek.",
            },
          ],
        },
      ],
    },
  ],
};
