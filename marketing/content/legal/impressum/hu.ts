// Magyar fordítás az impresszumról. A referenciaverzió a ./de.ts —
// a tartalmi módosításokat ELŐSZÖR ott kell elvégezni, csak azután itt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const impressum: LegalDoc = {
  slug: "impressum",
  title: "Impresszum",
  metaDescription:
    "A myNextDays ApS szolgáltatói adatai a dán e-kereskedelmi törvény (e-handelslov) 7. §-a szerint: cég, székhely, ügyvezetés, CVR-szám és elérhetőség.",
  standIso: RECHTSSTAND_ISO,
  numbered: false,
  toc: false,
  intro: [
    `Adatok a myNextDays platform szolgáltatójáról — egy property management system és channel manager, amelyet a(z) ${ANBIETER.firma} üzemeltet.`,
    "Kötelező tájékoztatás a dán e-kereskedelmi törvény (e-handelslov) 7. §-a alapján, amely a 2000/31/EK irányelv 5. cikkét ülteti át az elektronikus kereskedelemről.",
  ],
  sections: [
    {
      heading: "Szolgáltató",
      zeilen: [
        {
          label: "Cégnév",
          werte: [ANBIETER.firma, ANBIETER.rechtsform],
        },
        {
          label: "Székhely",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "Képviseletre jogosult ügyvezetés",
          werte: [`${ANBIETER.direktion.join(" és ")} (direktører)`],
        },
      ],
    },
    {
      heading: "Kapcsolat",
      zeilen: [
        {
          label: "E-mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
        {
          label: "Internet",
          werte: [ANBIETER.website],
          href: ANBIETER.websiteUrl,
        },
      ],
    },
    {
      heading: "Cégjegyzék és áfa",
      zeilen: [
        {
          label: "Cégjegyzék",
          werte: [
            `CVR-nr. ${ANBIETER.cvr}`,
            "Det Centrale Virksomhedsregister (CVR), Erhvervsstyrelsen, Dánia",
          ],
        },
        // Nur zeigen, wenn eine Momsregistrierung tatsächlich vorliegt.
        ...(ANBIETER.ustId
          ? [
              {
                label: "Közösségi adószám",
                werte: [ANBIETER.ustId],
              },
            ]
          : []),
      ],
    },
    {
      heading: "Kapcsolattartási pont a digitális szolgáltatásokról szóló jogszabály alapján",
      paragraphs: [
        `Központi kapcsolattartási pont a hatóságok számára a 11. cikk, és a felhasználók számára a 12. cikk alapján a (EU) 2022/2065 rendelet (Digital Services Act) értelmében: ${ANBIETER.email}.`,
        "A kommunikáció nyelve a német, a dán és az angol.",
      ],
    },
    {
      heading: "Fogyasztói jogvitarendezés",
      paragraphs: [
        "Nem vagyunk sem hajlandók, sem kötelesek részt venni fogyasztói vitarendezési testület előtti eljárásban.",
      ],
    },
    {
      heading: "Felelősség a linkekért",
      paragraphs: [
        "Gondos tartalomellenőrzés ellenére sem vállalunk felelősséget a külső linkek tartalmáért. A hivatkozott oldalak tartalmáért kizárólag azok üzemeltetői felelnek.",
      ],
    },
    {
      heading: "Szerzői jog",
      paragraphs: [
        `A weboldalon közzétett tartalmak, szövegek, grafikák és védjegyek szerzői jogi és védjegyjogi védelem alatt állnak. A törvényben megengedett eseteken túli bármilyen felhasználáshoz a(z) ${ANBIETER.firma} előzetes írásbeli hozzájárulása szükséges.`,
      ],
    },
    {
      heading: "További jogi dokumentumok",
      paragraphs: [
        "A platform használatára az Általános Szerződési Feltételeink vonatkoznak. A személyes adatok kezelésének módját az Adatvédelmi tájékoztató tartalmazza; a használt sütiket a Sütitájékoztató sorolja fel.",
      ],
      links: [
        { label: "Általános Szerződési Feltételek", href: AGB_URL },
        { label: "Adatvédelmi tájékoztató", href: "/datenschutz" },
        { label: "Sütitájékoztató", href: "/cookie-richtlinie" },
        { label: "Adatfeldolgozási megállapodás (DPA)", href: "/auftragsverarbeitung" },
      ],
    },
    {
      heading: "Alkalmazandó jog",
      paragraphs: [
        `A(z) ${ANBIETER.firma} székhelye Dánia, és kizárólag ott letelepedett. Erre az online kínálatra ezért a dán jog vonatkozik — a magyar nyelvű változatra is (a származási ország elve a 2000/31/EK irányelv 3. cikke alapján). A tájékoztatási kötelezettségek a dán e-kereskedelmi törvény (e-handelslov) 7. §-ából erednek.`,
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default impressum;
