// Slowakische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Zásady používania súborov cookie",
  metaDescription:
    "Aké súbory cookie myNextDays používa: výlučne technicky nevyhnutné a funkčné súbory cookie, žiadne sledovacie ani reklamné súbory cookie.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tieto zásady vysvetľujú, ktoré súbory cookie a porovnateľné technológie ukladania spoločnosť ${ANBIETER.firma} používa na tejto webovej stránke a v platforme myNextDays.`,
    "V skratke: používame výlučne technicky nevyhnutné a funkčné súbory cookie. Neexistujú žiadne analytické, reklamné ani sledovacie súbory cookie a žiadne odovzdávanie údajov o používaní reklamným sieťam.",
  ],
  sections: [
    {
      heading: "Čo sú súbory cookie",
      paragraphs: [
        "Súbory cookie sú malé textové súbory, ktoré webová stránka ukladá v prehliadači. Umožňujú rozpoznať reláciu — napríklad aby ste po prihlásení zostali prihlásení. Okrem súborov cookie používajú prehliadače aj ďalšie úložiská, ako je Local Storage, ktoré fungujú technicky podobne.",
      ],
    },
    {
      heading: "Na čo potrebujeme váš súhlas",
      paragraphs: [
        "Súhlas je podľa § 9 dánskej vyhlášky o cookies (Cookie-bekendtgørelsen) (ktorou sa transponuje čl. 5 ods. 3 smernice 2002/58/ES) potrebný len vtedy, keď prístup k vášmu zariadeniu neslúži výlučne na prenos správy alebo nie je bezpodmienečne nevyhnutný pre výslovne požadovanú službu.",
        "Všetky súbory cookie, ktoré nastavujeme, sú potrebné na prihlásenie, na zabezpečenie relácie alebo na nastavenie, ktoré ste si sami zvolili — preto si k nim nepýtame žiadny súhlas a naopak nenastavujeme nič, na čo by bol súhlas potrebný.",
        "Súhlas musíte udeliť len pre jednu vec: ochranu proti spamu nášho kontaktného formulára. Tá pochádza od spoločnosti Google (reCAPTCHA Enterprise), ide teda o externú službu, a načíta sa iba vtedy, ak ste ju povolili. Na to sa vás pri prvej návšteve opýta lišta v dolnej časti obrazovky — s rovnocennými tlačidlami „Odmietnuť“ a „Prijať“ a bez prednastaveného výberu. Kým sa nerozhodnete, platí „nepovolené“.",
        "Vaše rozhodnutie je uložené v pamäti vášho prehliadača (Local Storage, hodnota „nd_consent“); obsahuje iba kategóriu, čas a číslo verzie, žiadnu identifikáciu vašej osoby. Na konci tejto stránky ju môžete kedykoľvek zmeniť alebo odvolať.",
      ],
    },
    {
      heading: "Táto webová stránka",
      paragraphs: [
        "Marketingová webová stránka nenastavuje žiadne súbory cookie. Písma a ikony sú uložené na našom vlastnom serveri — na tento účel sa nevolá žiadna služba tretej strany pre ikony či písma. Jedinou externou službou tejto stránky je ochrana proti spamu kontaktného formulára, ktorá sa načíta iba s vaším súhlasom. Podrobnosti nájdete v [Zásadách ochrany osobných údajov](/datenschutz).",
      ],
    },
    {
      heading: "Súbory cookie platformy",
      paragraphs: [
        "Hneď ako sa prihlásite do dashboardu, na trhovisku alebo v mobilnom zobrazení, nastavia sa tieto súbory cookie:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Prihlásenie (technicky nevyhnutné)",
          list: [
            "Účel: identifikuje vašu prihlásenú reláciu voči serveru.",
            "Obsah: krátkodobý prístupový token; čitateľný iba pre server (HttpOnly), prenášaný iba cez HTTPS.",
            "Trvanie: relácia, resp. do vypršania platnosti tokenu.",
          ],
        },
        {
          titel: "nd_refresh — Predĺženie relácie (technicky nevyhnutné)",
          list: [
            "Účel: obnovuje prístupový token, aby ste sa nemuseli neustále znova prihlasovať.",
            "Obsah: obnovovací token; HttpOnly, iba cez HTTPS.",
            "Trvanie: do odhlásenia alebo do vypršania platnosti.",
          ],
        },
        {
          titel: "nd_locale — Voľba jazyka (funkčné)",
          list: [
            "Účel: zapamätá si vami zvolený jazyk.",
            "Obsah: skratka jazyka, napr. „de“ alebo „en“.",
            "Trvanie: do zmeny alebo vymazania.",
          ],
        },
        {
          titel: "sidebar_state — Bočný panel (funkčné)",
          list: [
            "Účel: zapamätá si, či je navigačný panel rozbalený alebo zbalený.",
            "Obsah: „true“ alebo „false“.",
            "Trvanie: do zmeny alebo vymazania.",
          ],
        },
        {
          titel:
            "sb-… — Prihlásenie cez Google (technicky nevyhnutné, iba pri použití)",
          list: [
            "Účel: udržiava reláciu, keď sa prihlásite cez Google.",
            "Obsah: token relácie prihlasovacej služby.",
            "Trvanie: relácia, resp. do vypršania platnosti tokenu. Nastaví sa iba vtedy, ak zvolíte prihlásenie cez Google.",
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
            "Zaznamenáva vaše rozhodnutie o ochrane proti spamu kontaktného formulára, aby sa vás lišta súhlasu nepýtala znova pri každej návšteve. Ukladá sa iba kategória, čas a číslo verzie. Hodnota neopúšťa vaše zariadenie a neprenáša sa na náš server; platí pre tento prehliadač. Ak ju vymažete, lišta sa pri ďalšej návšteve opýta znova.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Nastaví sa iba vtedy, ak si sami otvoríte chat na tejto webovej stránke a odošlete správu. Je kľúčom k vašej vlastnej konverzácii — bez neho by ste po zmene stránky našu odpoveď už nenašli. Neobsahuje žiadne údaje o vás a používa sa iba na tento účel.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Ukladá v prehliadači, či ste súhlasili s používaním hlasového vstupu, aby sa súhlas nepýtal znova pri každej návšteve. Hodnota neopúšťa vaše zariadenie.",
          ],
        },
      ],
    },
    {
      heading: "Súbory cookie mobilnej aplikácie",
      paragraphs: [
        "Mobilná aplikácia nepracuje so súbormi cookie. Prístupové a obnovovacie tokeny sa ukladajú do zabezpečeného úložiska kľúčov zariadenia (iOS Keychain, Android Keystore) a pri odhlásení sa vymažú.",
      ],
    },
    {
      heading: "Súbory cookie tretích strán",
      paragraphs: [
        "Ak vykonáte platbu, poskytovateľ platobných služieb (Stripe alebo PayPal) môže na svojej vlastnej stránke nastaviť súbory cookie potrebné na spracovanie a prevenciu podvodov. Platia pre ne ustanovenia príslušného poskytovateľa.",
        "Na webových stránkach, ktoré prevádzkovatelia vytvárajú pomocou nášho konštruktéra stránok, rozhoduje o ďalších súboroch cookie príslušný prevádzkovateľ a zodpovedá za tam uvedené informácie.",
      ],
    },
    {
      heading: "Vymazanie a správa súborov cookie",
      paragraphs: [
        "Súbory cookie môžete kedykoľvek vymazať alebo zablokovať v nastaveniach svojho prehliadača. Ak zablokujete nevyhnutné súbory cookie, prihlásenie na platformu nie je technicky možné — verejná webová stránka a trhovisko zostávajú použiteľné aj bez prihlásenia.",
        "Pri odhlásení odstraňujeme prihlasovacie súbory cookie sami.",
      ],
    },
    {
      heading: "Zmeny týchto zásad",
      paragraphs: [
        "Ak pribudnú funkcie, ktoré si vyžadujú ďalšie súbory cookie, tento zoznam aktualizujeme. Vždy platí tu zverejnená verzia; dátum uvedený vyššie ukazuje stav aktualizácie.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
