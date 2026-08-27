// Tschechische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Zásady používání souborů cookie",
  metaDescription:
    "Jaké soubory cookie myNextDays nastavuje: technicky nezbytné soubory cookie a – pouze s vaším souhlasem – funkční, analytické a marketingové soubory cookie. Každou kategorii lze jednotlivě zapnout a vypnout.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tyto zásady vysvětlují, jaké soubory cookie a srovnatelné technologie ukládání používá ${ANBIETER.firma} na tomto webu a v platformě myNextDays.`,
    "Stručně řečeno: Nezbytné jsou pouze soubory cookie, bez kterých web nefunguje tak, jak je požadováno. Vše ostatní vyžaduje váš souhlas a bez něj se nenačte – ochrana proti spamu našeho kontaktního formuláře, měření dosahu a marketingové soubory cookie, pomocí kterých měříme úspěšnost naší reklamy. Každou z těchto kategorií můžete jednotlivě povolit nebo odmítnout a své rozhodnutí kdykoli odvolat.",
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
        "Musíte souhlasit se třemi kategoriemi, které se bez vašeho svolení nenačtou: ochrana proti spamu našeho kontaktního formuláře (reCAPTCHA od společnosti Google), měření dosahu tohoto webu (Google Analytics 4) a marketingové soubory cookie (Meta, LinkedIn, Google Ads). K tomu slouží okno se seznamem kategorií – při první návštěvě, bez předvolby, každá kategorie s vlastním přepínačem. Dokud se nerozhodnete, platí „nepovoleno“ a nic se nevyhodnocuje ani neinzeruje.",
        "Vaše rozhodnutí je uloženo v paměti Vašeho prohlížeče (Local Storage, hodnota „nd_consent“); obsahuje pouze kategorii, časový okamžik a číslo verze, žádný identifikátor Vaší osoby. Prostřednictvím ikony cookies vlevo dole na každé stránce jej můžete kdykoli změnit nebo odvolat. Po šesti měsících se zeptáme znovu — souhlas nemá platit neomezeně.",
      ],
    },
    {
      heading: "Tento web",
      paragraphs: [
        "Tento web sám o sobě nenastavuje žádné soubory cookie. Písma a symboly jsou uloženy na našem vlastním serveru – není volána žádná služba symbolů nebo písem třetí strany. Přidány jsou pouze služby, které povolíte: ochrana proti spamu kontaktního formuláře, měření dosahu a marketingové služby. Jaké soubory cookie jsou nastaveny, s jakou dobou platnosti a na jakém hostiteli, je uvedeno níže v sekci „Soubory cookie třetích stran“. Odvolání prostřednictvím ikony souboru cookie vlevo dole – příslušná služba okamžitě končí a její soubory cookie jsou smazány. Podrobnosti jsou uvedeny v [Zásadách ochrany osobních údajů](/datenschutz).",
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
          titel:
            "sb-… — Přihlášení přes Google (technicky nezbytné, pouze při použití)",
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
            "Zaznamenává vaše rozhodnutí ohledně služeb vyžadujících souhlas (ochrana proti spamu kontaktního formuláře a měření dosahu).",
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
        "Pouze s vaším souhlasem nastavují služby Google na tomto webu následující soubory cookie – měření dosahu dva, ochrana proti spamu jeden. Bez vašeho souhlasu se příslušný skript nenačte a žádný z těchto souborů cookie se nenastaví; v případě odvolání je smažeme.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Měření úspěšnosti reklamy (vyžaduje souhlas)",
          list: [
            "Účel: Přiřadí vaši návštěvu k reklamě, abychom mohli měřit úspěšnost našich kampaní.",
            "Obsah: Náhodně vygenerovaný identifikátor; neobsahuje jméno, e-mail ani údaje o účtu.",
            "Poskytovatel: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irsko.",
            "Hostitel: mynextdays.com (cookie první strany, nastavené skriptem Meta). Doba platnosti: přibližně tři měsíce.",
          ],
        },
        {
          titel: "_gcl_au — Měření úspěšnosti Google Ads (vyžaduje souhlas)",
          list: [
            "Účel: Přiřadí vaši návštěvu k reklamě Google, abychom mohli měřit úspěšnost našich kampaní.",
            "Obsah: Náhodně vygenerovaný identifikátor bez vztahu k vaší osobě.",
            "Poskytovatel: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko.",
            "Hostitel: mynextdays.com (cookie první strany). Doba platnosti: přibližně tři měsíce.",
          ],
        },
        {
          titel: "li_gc a bcookie — Reklama LinkedIn (vyžaduje souhlas)",
          list: [
            "Účel: Identifikuje váš prohlížeč pro LinkedIn, aby bylo možné přiřadit reklamy a jejich úspěšnost; li_gc navíc ukládá váš souhlas.",
            "Obsah: Identifikátor prohlížeče a stav souhlasu; neobsahuje údaje z vašeho účtu u nás.",
            "Poskytovatel: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irsko.",
            "Hostitel: linkedin.com (cookies třetích stran). Doba platnosti: přibližně šest měsíců nebo jeden rok.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — ochrana kontaktního formuláře před spamem (vyžaduje souhlas)",
          list: [
            "Hostitel: www.google.com (soubor cookie třetí strany).",
            "Účel: umožňuje společnosti Google vyhodnotit riziko, které rozlišuje automatizované hromadné zprávy od skutečných dotazů.",
            "Obsah: identifikátor vygenerovaný společností Google pro toto hodnocení; žádné jméno, e-mail ani údaje o účtu od nás.",
            "Poskytovatel: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko.",
            "Doba trvání: stanovena společností Google, až šest měsíců. Nastaví se až poté, co povolíte ochranu proti spamu a otevřete kontaktní formulář.",
          ],
        },
        {
          titel: "_ga — Měření dosahu (vyžaduje souhlas)",
          list: [
            "Hostitel: mynextdays.com (soubor cookie první strany, nastavený skriptem Google).",
            "Účel: rozlišuje návštěvníky, aby se opakované návštěvy nepočítaly dvakrát.",
            "Obsah: náhodně generovaný identifikátor bez vztahu k vaší osobě; žádné jméno, e-mail ani údaje o účtu.",
            "Poskytovatel: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irsko.",
            "Doba platnosti: až dva roky.",
          ],
        },
        {
          titel: "_ga_<ID> — Stav relace měření (vyžaduje souhlas)",
          list: [
            "Hostitel: mynextdays.com (soubor cookie první strany, nastavený skriptem Google).",
            "Účel: zaznamenává, kdy začala vaše aktuální návštěva, aby zobrazení stránek patřila k jedné relaci.",
            "Obsah: časové razítko a počítadlo relace; identifikátor v názvu označuje naši vlastnost, nikoli vás.",
            "Poskytovatel: Google Ireland Limited.",
            "Doba platnosti: až dva roky.",
          ],
        },
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
