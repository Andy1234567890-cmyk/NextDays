// Ungarische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie-szabályzat",
  metaDescription:
    "Milyen sütiket használ a myNextDays: technikailag szükséges sütiket, valamint – csak az Ön hozzájárulásával – funkcionális, analitikai és marketing sütiket. Minden kategória külön-külön be- és kikapcsolható.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Ez a szabályzat elmagyarázza, hogy a(z) ${ANBIETER.firma} milyen sütiket és hasonló tárolási technikákat használ ezen a weboldalon és a myNextDays platformon.`,
    "Röviden: Csak azok a sütik szükségesek, amelyek nélkül a weboldal nem működik a kért módon. Minden más az Ön hozzájárulását igényli, és anélkül nem töltődik be – a kapcsolatfelvételi űrlapunk spamszűrője, a látogatottságmérés és a marketing sütik, amelyekkel hirdetéseink sikerét mérjük. Ezeket a kategóriákat egyenként engedélyezheti vagy elutasíthatja, és döntését bármikor visszavonhatja.",
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
        "Három kategóriához kell hozzájárulnia, amelyek az Ön engedélye nélkül nem töltődnek be: a kapcsolatfelvételi űrlapunk spamszűrője (reCAPTCHA a Google-tól), a weboldal látogatottságmérése (Google Analytics 4) és a marketing sütik (Meta, LinkedIn, Google Ads). Ehhez egy ablak jelenik meg egy kategórialistával – az első látogatáskor, előzetes kiválasztás nélkül, minden kategória saját kapcsolóval. Amíg nem döntött, az „nem engedélyezett” érvényes, és semmilyen értékelés, sem hirdetés nem történik.",
        "Az Ön döntése a böngészője tárhelyén található (Local Storage, „nd_consent” érték); csak a kategóriát, az időpontot és egy verziószámot tartalmaz, semmilyen személyazonosító adatot. Ezt bármikor módosíthatja vagy visszavonhatja minden oldal bal alsó sarkában található cookie-ikon segítségével. Hat hónap után újra rákérdezünk — a hozzájárulás nem érvényes korlátlan ideig.",
      ],
    },
    {
      heading: "Ez a weboldal",
      paragraphs: [
        "Ez a weboldal önmagában nem használ sütiket. A betűtípusok és ikonok a saját szerverünkön találhatók – ehhez nem hívunk meg harmadik fél ikon- vagy betűtípus-szolgáltatását. Csak az Ön által engedélyezett szolgáltatások kerülnek hozzáadásra: a kapcsolatfelvételi űrlap spamszűrője, a látogatottságmérés és a marketing szolgáltatások. Az, hogy milyen sütik kerülnek beállításra, milyen élettartammal és melyik hoszton, az alábbi „Harmadik féltől származó sütik” szakaszban található. A visszavonás a bal alsó sarokban található süti ikonon keresztül történik – az adott szolgáltatás azonnal megszűnik, és a sütik törlődnek. Részletek az [Adatvédelmi nyilatkozatban](/datenschutz) találhatók.",
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
          titel:
            "nd_refresh — munkamenet-hosszabbítás (technikailag szükséges)",
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
          titel:
            "sb-… — bejelentkezés Google-lal (technikailag szükséges, csak használat esetén)",
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
            "Rögzíti az Ön döntését a hozzájárulásköteles szolgáltatásokkal kapcsolatban (kapcsolatfelvételi űrlap spamszűrője és látogatottságmérés).",
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
        "Csak az Ön hozzájárulásával helyez el a Google szolgáltatásai ezen a weboldalon a következő sütiket – a látogatottságmérés kettőt, a spamvédelem egyet. Az Ön hozzájárulása nélkül az adott szkript nem töltődik be, és ezen sütik egyike sem kerül elhelyezésre; visszavonás esetén töröljük őket.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Hirdetésmérés (hozzájárulás szükséges)",
          list: [
            "Cél: Hozzárendeli látogatását egy hirdetéshez, hogy mérhessük kampányaink sikerét.",
            "Tartalom: Véletlenszerűen generált azonosító; nem tartalmazza az Ön nevét, e-mail címét vagy fiókadatait.",
            "Szolgáltató: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Írország.",
            "Hoszt: mynextdays.com (első féltől származó süti, a Meta szkriptje állítja be). Érvényesség: körülbelül három hónap.",
          ],
        },
        {
          titel: "_gcl_au — Google Ads hirdetésmérés (hozzájárulás szükséges)",
          list: [
            "Cél: Hozzárendeli látogatását egy Google hirdetéshez, hogy mérhessük kampányaink sikerét.",
            "Tartalom: Véletlenszerűen generált azonosító, amely nem kapcsolódik az Ön személyéhez.",
            "Szolgáltató: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írország.",
            "Hoszt: mynextdays.com (első féltől származó süti). Érvényesség: körülbelül három hónap.",
          ],
        },
        {
          titel:
            "li_gc és bcookie — LinkedIn hirdetés (hozzájárulás szükséges)",
          list: [
            "Cél: Azonosítja böngészőjét a LinkedIn számára, hogy a hirdetések és azok sikere hozzárendelhető legyen; a li_gc emellett tárolja az Ön ottani hozzájárulását.",
            "Tartalom: Böngészőazonosító és a hozzájárulás állapota; nem tartalmazza az Ön nálunk lévő fiókjának adatait.",
            "Szolgáltató: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Írország.",
            "Hoszt: linkedin.com (harmadik féltől származó sütik). Érvényesség: körülbelül hat hónap, illetve egy év.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Kapcsolatfelvételi űrlap spamszűrője (hozzájárulás szükséges)",
          list: [
            "Hoszt: www.google.com (harmadik féltől származó süti).",
            "Cél: lehetővé teszi a Google számára a kockázatértékelést, amely megkülönbözteti az automatizált tömeges üzeneteket a valódi megkeresésektől.",
            "Tartalom: a Google által generált azonosító ehhez az értékeléshez; nem tartalmazza a nevünket, e-mail címünket vagy fiókadatainkat.",
            "Szolgáltató: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írország.",
            "Időtartam: a Google határozza meg, legfeljebb hat hónap. Csak akkor kerül beállításra, ha engedélyezte a spamszűrőt és megnyitotta a kapcsolatfelvételi űrlapot.",
          ],
        },
        {
          titel: "_ga — Látogatottságmérés (hozzájárulás szükséges)",
          list: [
            "Hoszt: mynextdays.com (első féltől származó süti, a Google szkriptje állította be).",
            "Cél: megkülönbözteti a látogatókat, hogy az ismétlődő látogatások ne számolódjanak duplán.",
            "Tartalom: véletlenszerűen generált azonosító, amely nem kapcsolódik az Ön személyéhez; nincsenek név-, e-mail- vagy fiókadatok.",
            "Szolgáltató: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írország.",
            "Érvényesség: legfeljebb két év.",
          ],
        },
        {
          titel:
            "_ga_<azonosító> — A mérés munkamenet-állapota (hozzájárulás szükséges)",
          list: [
            "Hoszt: mynextdays.com (első féltől származó süti, a Google szkriptje állította be).",
            "Cél: rögzíti, mikor kezdődött az aktuális látogatása, hogy a munkamenet oldalmegtekintései összetartozzanak.",
            "Tartalom: időbélyeg és a munkamenet számlálója; a névben szereplő azonosító a mi tulajdonunkat jelöli, nem Önt.",
            "Szolgáltató: Google Ireland Limited.",
            "Érvényesség: legfeljebb két év.",
          ],
        },
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
