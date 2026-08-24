// Tschechische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Zásady používání souborů cookie",
  metaDescription:
    "Jaké soubory cookie myNextDays používá: výhradně technicky nezbytné a funkční soubory cookie, žádné sledovací ani reklamní soubory cookie.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tyto zásady vysvětlují, jaké soubory cookie a srovnatelné technologie ukládání používá ${ANBIETER.firma} na tomto webu a v platformě myNextDays.`,
    "Stručně řečeno: používáme výhradně technicky nezbytné a funkční soubory cookie. Neexistují žádné analytické, reklamní ani sledovací soubory cookie a žádné předávání údajů o používání reklamním sítím.",
  ],
  sections: [
    {
      heading: "Co jsou soubory cookie",
      paragraphs: [
        "Soubory cookie jsou malé textové soubory, které webová stránka ukládá v prohlížeči. Umožňují znovu rozpoznat relaci — například abyste po přihlášení zůstali přihlášeni. Kromě souborů cookie používají prohlížeče i další úložiště, jako je Local Storage, které fungují technicky obdobně.",
      ],
    },
    {
      heading: "Kdy potřebujeme Váš souhlas",
      paragraphs: [
        "Souhlas je podle § 9 dánské vyhlášky o cookies (Cookie-bekendtgørelsen) (provádějící čl. 5 odst. 3 směrnice 2002/58/ES) nutný pouze tehdy, pokud přístup k Vašemu zařízení neslouží výhradně k přenosu zprávy nebo není nezbytně nutný pro výslovně požadovanou službu.",
        "Všechny soubory cookie, které nastavujeme, jsou nezbytné pro přihlášení, zabezpečení relace nebo nastavení, které jste sami provedli — pro tyto účely od Vás nic nežádáme, a naopak nenastavujeme nic, k čemu by byl souhlas potřeba.",
        "Souhlas musíte udělit pouze pro jednu věc: ochranu proti spamu v našem kontaktním formuláři. Pochází od Googlu (reCAPTCHA Enterprise), jde tedy o externí službu, a načte se pouze tehdy, pokud jste ji povolili. Na to se ptá lišta v dolní části obrazovky — při první návštěvě, s rovnocennými tlačítky pro odmítnutí a přijetí a bez předvyplněné volby. Dokud se nerozhodnete, platí „nepovoleno“.",
        "Vaše rozhodnutí je uloženo v paměti Vašeho prohlížeče (Local Storage, hodnota „nd_consent“); obsahuje pouze kategorii, časový okamžik a číslo verze, žádný identifikátor Vaší osoby. Prostřednictvím ikony cookies vlevo dole na každé stránce jej můžete kdykoli změnit nebo odvolat. Po šesti měsících se zeptáme znovu — souhlas nemá platit neomezeně.",
      ],
    },
    {
      heading: "Tento web",
      paragraphs: [
        "Marketingový web nepoužívá žádné soubory cookie. Písma a ikony jsou umístěny na našem vlastním serveru — nevolá se pro ně žádná služba pro ikony nebo písma třetí strany. Jedinou externí službou na této stránce je ochrana proti spamu v kontaktním formuláři, a ta se načte pouze s Vaším souhlasem. Podrobnosti najdete v [Zásadách ochrany osobních údajů](/datenschutz).",
      ],
    },
    {
      heading: "Cookies platformy",
      paragraphs: [
        "Jakmile se přihlásíte do dashboardu, na tržišti nebo v mobilním zobrazení, nastaví se následující soubory cookie:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Přihlášení (technicky nezbytné)",
          list: [
            "Účel: prokazuje Vaši přihlášenou relaci vůči serveru.",
            "Obsah: krátkodobý přístupový token; čitelný pouze pro server (HttpOnly), přenášený pouze přes HTTPS.",
            "Doba trvání: relace, resp. do vypršení tokenu.",
          ],
        },
        {
          titel: "nd_refresh — Prodloužení relace (technicky nezbytné)",
          list: [
            "Účel: obnovuje přístupový token, abyste se nemuseli neustále znovu přihlašovat.",
            "Obsah: obnovovací token; HttpOnly, pouze přes HTTPS.",
            "Doba trvání: do odhlášení nebo vypršení.",
          ],
        },
        {
          titel: "nd_locale — Volba jazyka (funkční)",
          list: [
            "Účel: zapamatuje si Vámi zvolený jazyk.",
            "Obsah: jazykový kód, např. „de“ nebo „en“.",
            "Doba trvání: do změny nebo smazání.",
          ],
        },
        {
          titel: "sidebar_state — Postranní panel (funkční)",
          list: [
            "Účel: zapamatuje si, zda je navigační panel rozbalený nebo sbalený.",
            "Obsah: „true“ nebo „false“.",
            "Doba trvání: do změny nebo smazání.",
          ],
        },
        {
          titel: "sb-… — Přihlášení přes Google (technicky nezbytné, pouze při použití)",
          list: [
            "Účel: udržuje relaci, když se přihlásíte přes Google.",
            "Obsah: relační token přihlašovací služby.",
            "Doba trvání: relace, resp. do vypršení tokenu. Nastavuje se pouze v případě, že zvolíte přihlášení přes Google.",
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
            "Uchovává Vaše rozhodnutí ohledně ochrany proti spamu v kontaktním formuláři, aby se lišta souhlasu neptala znovu při každém načtení. Ukládá se pouze kategorie, časový okamžik a číslo verze. Hodnota neopouští Vaše zařízení a nepřenáší se na náš server; platí pro tento prohlížeč. Platnost: šest měsíců — poté se lišta zeptá znovu. Smažete-li hodnotu, zeptá se lišta při příští návštěvě znovu.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Nastavuje se pouze tehdy, když sami otevřete chat na tomto webu a odešlete zprávu. Je klíčem k Vaší vlastní konverzaci — bez něj byste po přechodu na jinou stránku nenašli naši odpověď. Neobsahuje žádné údaje o Vás a používá se pouze pro tento účel.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Ukládá v prohlížeči, zda jste souhlasili s používáním hlasového vstupu, aby se souhlas nezjišťoval znovu při každém načtení. Hodnota neopouští Vaše zařízení.",
          ],
        },
      ],
    },
    {
      heading: "Cookies mobilní aplikace",
      paragraphs: [
        "Mobilní aplikace nepoužívá soubory cookie. Přístupové a obnovovací tokeny se ukládají do zabezpečeného úložiště klíčů zařízení (iOS Keychain, Android Keystore) a při odhlášení se smažou.",
      ],
    },
    {
      heading: "Cookies třetích stran",
      paragraphs: [
        "Při provádění platby může poskytovatel platebních služeb (Stripe nebo PayPal) na své vlastní stránce nastavit soubory cookie potřebné pro zpracování platby a prevenci podvodů. Platí pro ně podmínky příslušného poskytovatele.",
        "Na webových stránkách, které provozovny vytvářejí pomocí našeho stavebnicového systému, rozhoduje o dalších souborech cookie příslušná provozovna a je odpovědná za tamní upozornění.",
      ],
    },
    {
      heading: "Mazání a správa cookies",
      paragraphs: [
        "Soubory cookie můžete kdykoli smazat nebo zablokovat v nastavení svého prohlížeče. Pokud zablokujete nezbytné soubory cookie, přihlášení k platformě technicky nebude možné — veřejný web a tržiště zůstávají použitelné i bez přihlášení.",
        "Při odhlášení odstraníme přihlašovací soubory cookie sami.",
      ],
    },
    {
      heading: "Změny těchto zásad",
      paragraphs: [
        "Pokud přibudou funkce, které vyžadují další soubory cookie, tento seznam aktualizujeme. Vždy platí zde zveřejněná verze; datum nahoře udává aktuální stav.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
