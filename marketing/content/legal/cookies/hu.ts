// Ungarische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie-szabályzat",
  metaDescription:
    "Milyen sütiket használ a myNextDays: kizárólag technikailag szükséges és funkcionális sütiket, semmilyen nyomkövető vagy hirdetési sütit.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ez a szabályzat elmagyarázza, hogy a(z) ${ANBIETER.firma} milyen sütiket és hasonló tárolási technikákat használ ezen a weboldalon és a myNextDays platformon.`,
    "Röviden: kizárólag technikailag szükséges és funkcionális sütiket használunk. Nincsenek elemzési, hirdetési vagy nyomkövető sütik, és nem továbbítunk használati adatokat hirdetési hálózatoknak.",
  ],
  sections: [
    {
      heading: "Mik azok a sütik",
      paragraphs: [
        "A sütik kis szöveges fájlok, amelyeket egy weboldal a böngészőben tárol. Lehetővé teszik egy munkamenet felismerését — például azért, hogy bejelentkezés után bejelentkezve maradjon. A sütik mellett a böngészők más tárolókat is használnak, például a Local Storage-t, amelyek technikailag hasonlóan működnek.",
      ],
    },
    {
      heading: "Mihez van szükségünk a hozzájárulására",
      paragraphs: [
        "Hozzájárulás a dán süti-rendelet (Cookie-bekendtgørelsen) 9. §-a szerint (amely a 2002/58/EK irányelv 5. cikk (3) bekezdését ülteti át) csak akkor szükséges, ha az eszközéhez való hozzáférés nem kizárólag üzenet továbbítására szolgál, vagy nem feltétlenül szükséges egy Ön által kifejezetten kért szolgáltatáshoz.",
        "Minden általunk elhelyezett süti a bejelentkezéshez, a munkamenet biztonságához vagy egy Ön által saját maga beállított paraméterhez szükséges — ehhez semmit nem kérdezünk, és fordítva sem helyezünk el olyat, amihez hozzájárulás kellene.",
        "Pontosan egy dologhoz van szükségünk a hozzájárulására: kapcsolatfelvételi űrlapunk spamvédelméhez. Ez a Google-től (reCAPTCHA Enterprise) származik, tehát külső szolgáltatás, és csak akkor töltődik be, ha Ön ezt engedélyezte. Ehhez a képernyő alján egy sáv kérdez rá — az első látogatáskor, egyenrangú „Elutasítás” és „Elfogadás” gombokkal, előzetes kiválasztás nélkül. Amíg nem döntött, a „nem engedélyezett” állapot érvényes.",
        "Az Ön döntése a böngészője tárhelyén található (Local Storage, „nd_consent” érték); csak a kategóriát, az időpontot és egy verziószámot tartalmaz, semmilyen személyazonosító adatot. Ezt bármikor módosíthatja vagy visszavonhatja minden oldal bal alsó sarkában található cookie-ikon segítségével. Hat hónap után újra rákérdezünk — a hozzájárulás nem érvényes korlátlan ideig.",
      ],
    },
    {
      heading: "Ez a weboldal",
      paragraphs: [
        "A marketing weboldal nem helyez el sütiket. A betűtípusok és ikonok saját szerverünkön találhatók — ehhez nem hívunk meg semmilyen harmadik féltől származó ikon- vagy betűtípus-szolgáltatást. Ennek az oldalnak az egyetlen külső szolgáltatása a kapcsolatfelvételi űrlap spamvédelme, amely csak az Ön hozzájárulásával töltődik be. A részletek az [Adatvédelmi tájékoztatóban](/datenschutz) találhatók.",
      ],
    },
    {
      heading: "A platform sütijei",
      paragraphs: [
        "Amint bejelentkezik az irányítópultra, a piactérre vagy a mobil nézetbe, az alábbi sütik kerülnek elhelyezésre:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — bejelentkezés (technikailag szükséges)",
          list: [
            "Cél: azonosítja a bejelentkezett munkamenetét a szerver felé.",
            "Tartalom: rövid élettartamú hozzáférési token; csak a szerver számára olvasható (HttpOnly), kizárólag HTTPS-en keresztül továbbítva.",
            "Élettartam: a munkamenet időtartama, illetve a token lejárta.",
          ],
        },
        {
          titel: "nd_refresh — munkamenet-hosszabbítás (technikailag szükséges)",
          list: [
            "Cél: megújítja a hozzáférési tokent, hogy ne kelljen folyamatosan újra bejelentkeznie.",
            "Tartalom: megújítási token; HttpOnly, kizárólag HTTPS-en keresztül.",
            "Élettartam: kijelentkezésig vagy lejáratig.",
          ],
        },
        {
          titel: "nd_locale — nyelvválasztás (funkcionális)",
          list: [
            "Cél: megjegyzi az Ön által választott nyelvet.",
            "Tartalom: nyelvi kód, pl. „de” vagy „en”.",
            "Élettartam: módosításig vagy törlésig.",
          ],
        },
        {
          titel: "sidebar_state — oldalsáv (funkcionális)",
          list: [
            "Cél: megjegyzi, hogy a navigációs sáv ki- vagy összecsukott állapotban van-e.",
            "Tartalom: „true” vagy „false”.",
            "Élettartam: módosításig vagy törlésig.",
          ],
        },
        {
          titel: "sb-… — bejelentkezés Google-lal (technikailag szükséges, csak használat esetén)",
          list: [
            "Cél: fenntartja a munkamenetet, ha Google-lal jelentkezik be.",
            "Tartalom: a bejelentkezési szolgáltatás munkamenet-tokenje.",
            "Élettartam: a munkamenet időtartama, illetve a token lejárta. Csak akkor kerül elhelyezésre, ha a Google-lal történő bejelentkezést választja.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Rögzíti az Ön döntését a kapcsolatfelvételi űrlap spamvédelméről, hogy a hozzájárulási sáv ne kérdezzen rá minden látogatáskor újra. Csak a kategória, az időpont és egy verziószám kerül tárolásra. Az érték nem hagyja el az Ön eszközét, és nem kerül továbbításra a szerverünkre; ez a böngészőre vonatkozik. Érvényesség: hat hónap — ezután a sáv újra rákérdez. Ha törli az értéket, a sáv a következő látogatáskor újra rákérdez.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Csak akkor kerül elhelyezésre, ha Ön saját maga megnyitja ennek a weboldalnak a chatjét, és üzenetet küld. Ez a kulcs a saját beszélgetéséhez — enélkül oldalváltás után nem találná meg a válaszunkat. Nem tartalmaz Önről semmilyen adatot, és kizárólag erre a célra használjuk.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "A böngészőben tárolja, hogy hozzájárult-e a hangbevitel használatához, hogy a hozzájárulást ne kérdezze meg újra minden látogatáskor. Az érték nem hagyja el az Ön eszközét.",
          ],
        },
      ],
    },
    {
      heading: "A mobilalkalmazás sütijei",
      paragraphs: [
        "A mobilalkalmazás nem használ sütiket. A hozzáférési és megújítási tokeneket az eszköz biztonságos kulcstárolójában (iOS Keychain, Android Keystore) tároljuk, és kijelentkezéskor töröljük.",
      ],
    },
    {
      heading: "Harmadik felek sütijei",
      paragraphs: [
        "Ha fizetést hajt végre, a fizetési szolgáltató (Stripe vagy PayPal) a saját oldalán a feldolgozáshoz és a csalás megelőzéséhez szükséges sütiket helyezhet el. Erre az adott szolgáltató feltételei vonatkoznak.",
        "Azokon a weboldalakon, amelyeket a szolgáltatók a mi weboldalépítőnkkel hoznak létre, a további sütikről az adott szolgáltató dönt, és felelős az ott megjelenő tájékoztatásért.",
      ],
    },
    {
      heading: "Sütik törlése és kezelése",
      paragraphs: [
        "A sütiket bármikor törölheti vagy blokkolhatja a böngészője beállításaiban. Ha blokkolja a szükséges sütiket, a platformra való bejelentkezés technikailag nem lehetséges — a nyilvános weboldal és a piactér bejelentkezés nélkül is használható marad.",
        "Kijelentkezéskor a bejelentkezési sütiket magunk távolítjuk el.",
      ],
    },
    {
      heading: "E szabályzat módosításai",
      paragraphs: [
        "Ha olyan funkciók kerülnek bevezetésre, amelyekhez további sütikre van szükség, frissítjük ezt a listát. Mindig az itt közzétett verzió az irányadó; a fenti dátum mutatja az aktuális állapotot.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
