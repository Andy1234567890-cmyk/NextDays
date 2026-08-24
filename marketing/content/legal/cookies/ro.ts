// Rumänische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politica privind modulele cookie",
  metaDescription:
    "Ce module cookie folosește myNextDays: exclusiv module cookie necesare din punct de vedere tehnic și funcționale, fără module cookie de urmărire sau publicitare.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Această politică explică ce module cookie și tehnici de stocare similare utilizează ${ANBIETER.firma} pe acest site web și în platforma myNextDays.`,
    "Pe scurt: utilizăm exclusiv module cookie necesare din punct de vedere tehnic și funcționale. Nu există module cookie de analiză, publicitare sau de urmărire și nicio transmitere de date de utilizare către rețele publicitare.",
  ],
  sections: [
    {
      heading: "Ce sunt modulele cookie",
      paragraphs: [
        "Modulele cookie sunt fișiere text mici pe care un site web le stochează în browser. Ele permit recunoașterea unei sesiuni — de exemplu, pentru a rămâne autentificat după ce v-ați conectat. Pe lângă modulele cookie, browserele folosesc și alte forme de stocare, precum Local Storage, care funcționează tehnic în mod similar.",
      ],
    },
    {
      heading: "Pentru ce avem nevoie de consimțământul dumneavoastră",
      paragraphs: [
        "Un consimțământ este necesar, conform art. 9 din regulamentul danez privind modulele cookie (Cookie-bekendtgørelsen) (care transpune art. 5 alin. (3) din Directiva 2002/58/CE), doar atunci când accesul la dispozitivul dumneavoastră nu servește exclusiv transmiterii unui mesaj sau nu este strict necesar pentru un serviciu solicitat în mod expres de dumneavoastră.",
        "Toate modulele cookie pe care le setăm sunt necesare pentru autentificare, pentru securitatea sesiunii sau pentru o setare aleasă chiar de dumneavoastră — prin urmare, nu solicităm nimic pentru acestea și, invers, nu setăm nimic pentru care ar fi necesar consimțământul.",
        "Trebuie să vă dați consimțământul pentru un singur lucru: protecția anti-spam a formularului nostru de contact. Aceasta provine de la Google (reCAPTCHA Enterprise), fiind deci un serviciu extern, și se încarcă numai dacă ați permis-o. Pentru aceasta apare o bară în partea de jos a ecranului — la prima vizită, cu butoane de aceeași importanță pentru „Respingere” și „Acceptare” și fără nicio selecție prealabilă. Atât timp cât nu ați decis, se aplică „nepermis”.",
        "Decizia dumneavoastră este stocată în memoria browserului dumneavoastră (Local Storage, valoarea „nd_consent”); aceasta conține doar categoria, momentul și un număr de versiune, fără nicio identificare a persoanei dumneavoastră. O puteți modifica sau revoca oricând prin pictograma modulelor cookie din colțul din stânga jos al fiecărei pagini. După șase luni, vă vom întreba din nou — un consimțământ nu trebuie să rămână valabil pe termen nelimitat.",
      ],
    },
    {
      heading: "Acest site web",
      paragraphs: [
        "Site-ul web de marketing nu setează niciun cookie. Fonturile și pictogramele sunt găzduite pe propriul nostru server — pentru aceasta nu este apelat niciun serviciu de pictograme sau fonturi al unui terț. Singurul serviciu extern al acestei pagini este protecția anti-spam a formularului de contact, care se încarcă numai cu consimțământul dumneavoastră. Detaliile sunt disponibile în [Politica de confidențialitate](/datenschutz).",
      ],
    },
    {
      heading: "Modulele cookie ale platformei",
      paragraphs: [
        "De îndată ce vă autentificați în panoul de control, în marketplace sau în vizualizarea mobilă, sunt setate următoarele module cookie:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Autentificare (necesar din punct de vedere tehnic)",
          list: [
            "Scop: identifică sesiunea dumneavoastră autentificată în fața serverului.",
            "Conținut: token de acces cu durată scurtă de viață; poate fi citit doar de server (HttpOnly), este transmis doar prin HTTPS.",
            "Durată: sesiunea, respectiv până la expirarea tokenului.",
          ],
        },
        {
          titel: "nd_refresh — Prelungirea sesiunii (necesar din punct de vedere tehnic)",
          list: [
            "Scop: reînnoiește tokenul de acces, astfel încât să nu fie nevoie să vă autentificați din nou în mod constant.",
            "Conținut: token de reînnoire; HttpOnly, doar prin HTTPS.",
            "Durată: până la deconectare sau până la expirare.",
          ],
        },
        {
          titel: "nd_locale — Selectarea limbii (funcțional)",
          list: [
            "Scop: reține limba aleasă de dumneavoastră.",
            "Conținut: cod de limbă, de ex. „de” sau „en”.",
            "Durată: până la modificare sau ștergere.",
          ],
        },
        {
          titel: "sidebar_state — Bara laterală (funcțional)",
          list: [
            "Scop: reține dacă bara de navigare este extinsă sau restrânsă.",
            "Conținut: „true” sau „false”.",
            "Durată: până la modificare sau ștergere.",
          ],
        },
        {
          titel:
            "sb-… — Autentificare cu Google (necesar din punct de vedere tehnic, doar în caz de utilizare)",
          list: [
            "Scop: menține sesiunea atunci când vă autentificați prin Google.",
            "Conținut: token de sesiune al serviciului de autentificare.",
            "Durată: sesiunea, respectiv până la expirarea tokenului. Este setat doar dacă alegeți autentificarea prin Google.",
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
            "Reține decizia dumneavoastră privind protecția anti-spam a formularului de contact, astfel încât bara de consimțământ să nu vă întrebe din nou la fiecare vizită. Sunt stocate doar categoria, momentul și un număr de versiune. Valoarea nu părăsește dispozitivul dumneavoastră și nu este transmisă serverului nostru; se aplică acestui browser. Valabilitate: șase luni — după acest termen, bara vă va întreba din nou. Dacă ștergeți valoarea, bara vă va întreba din nou la vizita următoare.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Este setat doar dacă deschideți chatul de pe acest site web și trimiteți un mesaj. Este cheia propriei dumneavoastră conversații — fără el, nu ați mai găsi răspunsul nostru după schimbarea paginii. Nu conține nicio informație despre dumneavoastră și este utilizat exclusiv în acest scop.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Stochează în browser dacă ați fost de acord cu utilizarea introducerii vocale, astfel încât acordul să nu fie solicitat din nou la fiecare vizită. Valoarea nu părăsește dispozitivul dumneavoastră.",
          ],
        },
      ],
    },
    {
      heading: "Modulele cookie ale aplicației mobile",
      paragraphs: [
        "Aplicația mobilă nu funcționează cu module cookie. Tokenurile de acces și de reînnoire sunt stocate în spațiul securizat de chei al dispozitivului (iOS Keychain, Android Keystore) și sunt șterse la deconectare.",
      ],
    },
    {
      heading: "Module cookie de la terți",
      paragraphs: [
        "Dacă efectuați o plată, furnizorul de servicii de plată (Stripe sau PayPal) poate seta pe propria pagină module cookie necesare pentru procesare și prevenirea fraudei. Se aplică prevederile furnizorului respectiv.",
        "Pe site-urile web pe care operatorii le creează cu ajutorul constructorului nostru de site-uri, operatorul respectiv decide cu privire la module cookie suplimentare și este responsabil pentru informațiile prezentate acolo.",
      ],
    },
    {
      heading: "Ștergerea și controlul modulelor cookie",
      paragraphs: [
        "Puteți șterge sau bloca modulele cookie oricând, din setările browserului dumneavoastră. Dacă blocați modulele cookie necesare, autentificarea pe platformă nu mai este posibilă din punct de vedere tehnic — site-ul public și marketplace-ul rămân utilizabile fără autentificare.",
        "La deconectare, eliminăm noi înșine modulele cookie de autentificare.",
      ],
    },
    {
      heading: "Modificări ale acestei politici",
      paragraphs: [
        "Dacă se adaugă funcții care necesită module cookie suplimentare, vom actualiza această listă. Se aplică întotdeauna versiunea publicată aici; data de mai sus indică actualizarea.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;
