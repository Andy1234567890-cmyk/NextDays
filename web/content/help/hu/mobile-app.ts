import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobilalkalmazás",
  description: "A myNextDays alkalmazás útközben.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "Alkalmazás",
      articles: [
        {
          slug: "die-app",
          title: "A myNextDays alkalmazás",
          excerpt: "Egy fiók, négy élmény: vendég, ügynökség, tulajdonos és munkatárs.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays alkalmazás a mobil platform teljes vállalkozásához. Nem különálló termék, hanem egyenrangú felület a webes irányítópulthoz — mindkettő ugyanahhoz a fiókhoz és ugyanazokhoz az adatokhoz fér hozzá, csak a felület van optimalizálva útközbeni használatra.",
            },
            { type: "h2", text: "Négy élmény egy alkalmazásban" },
            {
              type: "ul",
              items: [
                "Vendég: foglalások megtekintése, kommunikáció a vállalkozással, check-in információk lekérése.",
                "Ügynökség: több vállalkozás és objektum áttekintő kezelése.",
                "Tulajdonos: csak olvasható betekintés a saját objektumokba, kihasználtságba és jelentésekbe.",
                "Munkatárs: naptár, feladatok és takarítási tervek a mindennapi operatív munkához.",
              ],
            },
            { type: "h2", text: "Melyik élményt látja" },
            {
              type: "p",
              text: "Bejelentkezés után az alkalmazás automatikusan az Ön szerepköréhez illő élményt jeleníti meg — ugyanazt a szerepkört, amely a webes irányítópulton is érvényes. Egy korlátozott jogosultságú munkatárs pontosan ugyanazokat a korlátozásokat látja az alkalmazásban, mint a böngészőben, mivel a jogosultságot a szerver ellenőrzi.",
            },
            {
              type: "note",
              variant: "info",
              text: "A szerepkörökről és arról, hogy melyik mit láthat, bővebben itt: [Szerepkörök és jogosultságok](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Az alkalmazáshoz nincs szükség külön regisztrációra — egyszerűen jelentkezzen be meglévő myNextDays-hozzáférési adataival.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Alkalmazás telepítése és bejelentkezés",
          excerpt: "Így töltheti le a myNextDays alkalmazást, és így jelentkezhet be.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays alkalmazás elérhető iOS-re és Androidra. A bejelentkezés ugyanazokkal a hozzáférési adatokkal történik, mint a webes irányítópulton — nincs szükség külön fiókra vagy újbóli regisztrációra.",
            },
            { type: "h2", text: "Telepítés" },
            {
              type: "steps",
              items: [
                "Nyissa meg az App Store-t (iOS) vagy a Google Playt (Android).",
                "Keressen rá a „myNextDays” névre.",
                "Telepítse az alkalmazást okostelefonjára vagy táblagépére.",
                "A telepítés után nyissa meg az alkalmazást.",
              ],
            },
            { type: "h2", text: "Bejelentkezés" },
            {
              type: "steps",
              items: [
                "Koppintson a „Bejelentkezés” gombra.",
                "Adja meg e-mail-címét és jelszavát.",
                "Szükség esetén erősítse meg a kétfaktoros lekérdezést.",
                "Automatikusan a szerepköréhez illő élménybe kerül.",
              ],
            },
            {
              type: "ul",
              items: [
                "A hozzáférési adatok megegyeznek a webes irányítópulttal.",
                "Ha hozzáférését visszavonták, az alkalmazásba történő bejelentkezés is azonnal letiltásra kerül.",
                "Jelszóproblémák esetén használja az „Elfelejtett jelszó” funkciót közvetlenül az alkalmazásban.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Kizárólag a hivatalos „myNextDays” app store-bejegyzésen keresztül jelentkezzen be; az alkalmazás soha nem kér hozzáférési adatokat a bejelentkezési képernyőn kívül.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Kezelés útközben",
          excerpt: "Foglalások, üzenetek és feladatok kezelése közvetlenül okostelefonról.",
          updated: "Frissítve: 2026. július",
          body: [
            {
              type: "p",
              text: "A myNextDays alkalmazás különösen alkalmas a folyamatos üzemeltetésre útközben: megtekintheti az aktuális foglalásokat, válaszolhat a vendégüzenetekre, és elvégezheti a feladatokat anélkül, hogy számítógép előtt kellene ülnie — a változtatások valós időben a webes irányítópulton is megjelennek.",
            },
            { type: "h2", text: "Foglalások áttekintése" },
            {
              type: "p",
              text: "A „Foglalások” területen objektumonként látja az érkezéseket, távozásokat, kihasználtságot és állapotot. A munkatársak és a takarítás ezalatt csak a számukra releváns információkat látják, árak vagy értékesítési részletek nélkül.",
            },
            { type: "h2", text: "Üzenetek és feladatok" },
            {
              type: "steps",
              items: [
                "Nyissa meg az „Üzenetek” területet, hogy közvetlenül válaszoljon a vendégek megkereséseire.",
                "Váltson a „Feladatok” területre, hogy megtekintse az Önhöz rendelt teendőket.",
                "Koppintson egy feladatra a részletek megnyitásához és a lezárásához.",
                "Jelölje meg az elvégzett takarítási időpontokat helyben, azonnal befejezettként.",
              ],
            },
            {
              type: "ul",
              items: [
                "Az új üzenetek és feladatok élőben jelennek meg, manuális frissítés nélkül.",
                "A lezárt feladatok azonnal láthatók a webes irányítópulton is.",
                "A tulajdonosok látják objektumaik foglalásait és jelentéseit, de kizárólag olvasható formában.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "A push-értesítések tájékoztatják az új üzenetekről és a hozzárendelt feladatokról, amint ezt engedélyezi az eszközbeállításokban.",
            },
          ],
        },
      ],
    },
  ],
};
