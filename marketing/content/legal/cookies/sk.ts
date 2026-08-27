// Slowakische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Zásady používania súborov cookie",
  metaDescription:
    "Aké súbory cookie myNextDays používa: technicky nevyhnutné súbory cookie a – len s vaším súhlasom – funkčné, analytické a marketingové súbory cookie. Každú kategóriu je možné jednotlivo zapnúť a vypnúť.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Tieto zásady vysvetľujú, ktoré súbory cookie a porovnateľné technológie ukladania spoločnosť ${ANBIETER.firma} používa na tejto webovej stránke a v platforme myNextDays.`,
    "Stručne povedané: Nevyhnutné sú len súbory cookie, bez ktorých webová stránka nefunguje podľa požiadaviek. Všetko ostatné si vyžaduje váš súhlas a bez neho sa nenačíta – ochrana proti spamu nášho kontaktného formulára, meranie dosahu a marketingové súbory cookie, pomocou ktorých meriame úspešnosť našej reklamy. Každú z týchto kategórií môžete jednotlivo povoliť alebo odmietnuť a svoje rozhodnutie kedykoľvek odvolať.",
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
        "Súhlas musíte udeliť pre tri kategórie, ktoré sa bez vášho povolenia nenačítajú: ochrana proti spamu nášho kontaktného formulára (reCAPTCHA od spoločnosti Google), meranie dosahu tejto webovej stránky (Google Analytics 4) a marketingové súbory cookie (Meta, LinkedIn, Google Ads). Na to slúži okno so zoznamom kategórií – pri prvej návšteve, bez predvoľby, každá kategória s vlastným prepínačom. Pokiaľ sa nerozhodnete, platí „nepovolené“ a nič sa nevyhodnocuje ani nereklamuje.",
        "Vaše rozhodnutie je uložené v pamäti vášho prehliadača (Local Storage, hodnota „nd_consent“); obsahuje iba kategóriu, čas a číslo verzie, žiadnu identifikáciu vašej osoby. Prostredníctvom ikony cookies vľavo dole na každej stránke ju môžete kedykoľvek zmeniť alebo odvolať. Po šiestich mesiacoch sa spýtame znova — súhlas nemá platiť neobmedzene.",
      ],
    },
    {
      heading: "Táto webová stránka",
      paragraphs: [
        "Táto webová stránka sama o sebe nepoužíva žiadne súbory cookie. Písma a symboly sú uložené na našom vlastnom serveri – nepoužíva sa žiadna služba symbolov ani písiem tretej strany. Pridávajú sa len služby, ktoré povolíte: ochrana proti spamu kontaktného formulára, meranie dosahu a marketingové služby. Aké súbory cookie sa pritom používajú, s akou dobou platnosti a na akom hostiteľovi, je uvedené nižšie v časti „Súbory cookie tretích strán“. Odvolanie súhlasu prostredníctvom ikony súborov cookie vľavo dole – príslušná služba sa okamžite ukončí a jej súbory cookie sa vymažú. Podrobnosti sú uvedené v [Zásadách ochrany osobných údajov](/datenschutz).",
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
            "Zaznamenáva vaše rozhodnutie o službách vyžadujúcich súhlas (ochrana proti spamu kontaktného formulára a meranie dosahu).",
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
        "S vaším súhlasom služby Google na tejto webovej stránke umiestnia nasledujúce súbory cookie – dva na meranie dosahu, jeden na ochranu pred spamom. Bez vášho súhlasu sa príslušný skript nenačíta a žiadny z týchto súborov cookie sa neumiestni; v prípade odvolania súhlasu ich vymažeme.",
      ],
      unterpunkte: [
        {
          titel: "_fbp — Meranie úspešnosti reklamy (vyžaduje sa súhlas)",
          list: [
            "Účel: priradí vašu návštevu k reklame, aby sme mohli merať úspešnosť našich kampaní.",
            "Obsah: náhodne vygenerovaný identifikátor; neobsahuje žiadne meno, e-mail ani údaje o účte od nás.",
            "Poskytovateľ: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Írsko.",
            "Hostiteľ: mynextdays.com (súbor cookie prvej strany, nastavený skriptom Meta). Trvanie: približne tri mesiace.",
          ],
        },
        {
          titel: "_gcl_au — Meranie úspešnosti Google Ads (vyžaduje sa súhlas)",
          list: [
            "Účel: priradí vašu návštevu k reklame Google, aby sme mohli merať úspešnosť našich kampaní.",
            "Obsah: náhodne vygenerovaný identifikátor bez odkazu na vašu osobu.",
            "Poskytovateľ: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko.",
            "Hostiteľ: mynextdays.com (súbor cookie prvej strany). Trvanie: približne tri mesiace.",
          ],
        },
        {
          titel: "li_gc a bcookie — Reklama LinkedIn (vyžaduje sa súhlas)",
          list: [
            "Účel: identifikuje váš prehliadač pre LinkedIn, aby bolo možné priradiť reklamy a ich úspešnosť; li_gc navyše ukladá váš súhlas.",
            "Obsah: identifikátor prehliadača a stav súhlasu; neobsahuje žiadne údaje z vášho účtu u nás.",
            "Poskytovateľ: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Írsko.",
            "Hostiteľ: linkedin.com (súbory cookie tretích strán). Trvanie: približne šesť mesiacov alebo jeden rok.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — ochrana kontaktného formulára pred spamom (vyžaduje sa súhlas)",
          list: [
            "Host: www.google.com (súbor cookie tretej strany).",
            "Účel: umožňuje spoločnosti Google vyhodnotiť riziko, ktoré odlišuje automatické hromadné správy od skutočných požiadaviek.",
            "Obsah: identifikátor vygenerovaný spoločnosťou Google pre toto hodnotenie; žiadne meno, e-mail ani údaje o účte od nás.",
            "Poskytovateľ: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko.",
            "Trvanie: stanovené spoločnosťou Google, až šesť mesiacov. Nastaví sa až po povolení ochrany proti spamu a otvorení kontaktného formulára.",
          ],
        },
        {
          titel: "_ga – meranie dosahu (vyžaduje súhlas)",
          list: [
            "Host: mynextdays.com (súbor cookie prvej strany, nastavený skriptom Google).",
            "Účel: rozlišuje návštevníkov, aby sa opakované zobrazenia nepočítali dvakrát.",
            "Obsah: náhodne vygenerovaný identifikátor bez vzťahu k vašej osobe; žiadne meno, e-mail ani údaje o účte.",
            "Poskytovateľ: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Írsko.",
            "Doba platnosti: až dva roky.",
          ],
        },
        {
          titel: "_ga_<identifikátor> – stav relácie merania (vyžaduje súhlas)",
          list: [
            "Host: mynextdays.com (súbor cookie prvej strany, nastavený skriptom Google).",
            "Účel: zaznamenáva, kedy sa začala vaša aktuálna návšteva, aby zobrazenia stránok v rámci jednej relácie patrili k sebe.",
            "Obsah: časová pečiatka a počítadlo relácie; identifikátor v názve označuje našu vlastnosť, nie vás.",
            "Poskytovateľ: Google Ireland Limited.",
            "Doba platnosti: až dva roky.",
          ],
        },
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
