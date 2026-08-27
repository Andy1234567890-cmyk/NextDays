// Rumänische Übersetzung der Cookie-Richtlinie. Referenzfassung ist ./de.ts —
// inhaltliche Änderungen gehören ZUERST dorthin, dann hierher.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Politica privind modulele cookie",
  metaDescription:
    "Ce cookie-uri setează myNextDays: cookie-uri strict necesare, precum și — doar cu acordul dumneavoastră — cookie-uri funcționale, analitice și de marketing. Fiecare categorie poate fi activată și dezactivată individual.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Această politică explică ce module cookie și tehnici de stocare similare utilizează ${ANBIETER.firma} pe acest site web și în platforma myNextDays.`,
    "Pe scurt: Necesare sunt doar cookie-urile fără de care site-ul nu funcționează conform cerințelor. Orice altceva necesită acordul dumneavoastră și nu se încarcă fără acesta — protecția anti-spam a formularului nostru de contact, măsurarea audienței și cookie-urile de marketing cu care măsurăm succesul publicității noastre. Puteți permite sau refuza individual fiecare dintre aceste categorii și vă puteți retrage decizia în orice moment.",
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
        "Trebuie să vă dați acordul pentru trei categorii, care nu se încarcă fără permisiunea dumneavoastră: protecția anti-spam a formularului nostru de contact (reCAPTCHA de la Google), măsurarea audienței acestui site web (Google Analytics 4) și cookie-urile de marketing (Meta, LinkedIn, Google Ads). Pentru aceasta, o fereastră cu o listă de categorii — la prima vizită, fără preselecție, fiecare categorie cu propriul comutator — va apărea. Atâta timp cât nu ați decis, se aplică „nepermis”, și nu se va efectua nicio evaluare sau publicitate.",
        "Decizia dumneavoastră este stocată în memoria browserului dumneavoastră (Local Storage, valoarea „nd_consent”); aceasta conține doar categoria, momentul și un număr de versiune, fără nicio identificare a persoanei dumneavoastră. O puteți modifica sau revoca oricând prin pictograma modulelor cookie din colțul din stânga jos al fiecărei pagini. După șase luni, vă vom întreba din nou — un consimțământ nu trebuie să rămână valabil pe termen nelimitat.",
      ],
    },
    {
      heading: "Acest site web",
      paragraphs: [
        "Acest site web nu setează cookie-uri de la sine. Fonturile și simbolurile sunt stocate pe propriul nostru server — nu este apelat niciun serviciu de simboluri sau fonturi de la terți. Se adaugă doar serviciile pe care le permiteți: protecția anti-spam a formularului de contact, măsurarea audienței și serviciile de marketing. Ce cookie-uri sunt setate, cu ce durată și pe ce gazdă, este detaliat mai jos în secțiunea „Cookie-uri de la terți”. Retragerea acordului se face prin intermediul pictogramei cookie din stânga jos — serviciul respectiv se încheie imediat și cookie-urile sale sunt șterse. Detalii sunt disponibile în [Politica de confidențialitate](/datenschutz).",
      ],
    },
    {
      heading: "Modulele cookie ale platformei",
      paragraphs: [
        "De îndată ce vă autentificați în panoul de control, în marketplace sau în vizualizarea mobilă, sunt setate următoarele module cookie:",
      ],
      unterpunkte: [
        {
          titel:
            "nd_access — Autentificare (necesar din punct de vedere tehnic)",
          list: [
            "Scop: identifică sesiunea dumneavoastră autentificată în fața serverului.",
            "Conținut: token de acces cu durată scurtă de viață; poate fi citit doar de server (HttpOnly), este transmis doar prin HTTPS.",
            "Durată: sesiunea, respectiv până la expirarea tokenului.",
          ],
        },
        {
          titel:
            "nd_refresh — Prelungirea sesiunii (necesar din punct de vedere tehnic)",
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
            "Înregistrează decizia dumneavoastră privind serviciile care necesită consimțământ (protecția împotriva spamului a formularului de contact și măsurarea audienței).",
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
        "Numai cu acordul dumneavoastră, serviciile Google de pe acest site web plasează următoarele cookie-uri — două pentru măsurarea audienței, unul pentru protecția împotriva spamului. Fără acordul dumneavoastră, scriptul respectiv nu va fi încărcat și niciunul dintre aceste cookie-uri nu va fi plasat; în cazul revocării, le vom șterge.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp — Măsurarea succesului publicității (este necesar acordul)",
          list: [
            "Scop: atribuie vizita dumneavoastră unei reclame, astfel încât să putem măsura succesul campaniilor noastre.",
            "Conținut: un identificator generat aleatoriu; nu conține numele, adresa de e-mail sau informațiile contului dumneavoastră de la noi.",
            "Furnizor: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irlanda.",
            "Gazdă: mynextdays.com (cookie primar, setat de scriptul Meta). Durată: aproximativ trei luni.",
          ],
        },
        {
          titel:
            "_gcl_au — Măsurarea succesului Google Ads (este necesar acordul)",
          list: [
            "Scop: atribuie vizita dumneavoastră unei reclame Google, astfel încât să putem măsura succesul campaniilor noastre.",
            "Conținut: un identificator generat aleatoriu, fără legătură cu persoana dumneavoastră.",
            "Furnizor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Gazdă: mynextdays.com (cookie primar). Durată: aproximativ trei luni.",
          ],
        },
        {
          titel:
            "li_gc și bcookie — Publicitate LinkedIn (este necesar acordul)",
          list: [
            "Scop: identifică browserul dumneavoastră pentru LinkedIn, astfel încât reclamele și succesul acestora să poată fi atribuite; li_gc stochează și acordul dumneavoastră acolo.",
            "Conținut: un identificator de browser și starea acordului; nu conține informații din contul dumneavoastră de la noi.",
            "Furnizor: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irlanda.",
            "Gazdă: linkedin.com (cookie-uri terțe). Durată: aproximativ șase luni, respectiv un an.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Protecție împotriva spamului pentru formularul de contact (este necesar acordul)",
          list: [
            "Gazdă: www.google.com (cookie terță parte).",
            "Scop: permite Google să evalueze riscul, diferențiind mesajele automate în masă de solicitările reale.",
            "Conținut: un identificator generat de Google pentru această evaluare; nu conține numele, adresa de e-mail sau informațiile contului nostru.",
            "Furnizor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Durată: stabilită de Google, până la șase luni. Este setat doar dacă ați permis protecția împotriva spamului și ați deschis formularul de contact.",
          ],
        },
        {
          titel: "_ga — Măsurarea audienței (necesită acord)",
          list: [
            "Gazdă: mynextdays.com (cookie primar, setat de scriptul Google).",
            "Scop: distinge vizitatorii, astfel încât apelurile recurente să nu fie contorizate de două ori.",
            "Conținut: identificator generat aleatoriu fără legătură cu persoana dumneavoastră; fără nume, e-mail sau informații de cont.",
            "Furnizor: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda.",
            "Durată: până la doi ani.",
          ],
        },
        {
          titel:
            "_ga_<identificator> — Starea sesiunii de măsurare (necesită acord)",
          list: [
            "Gazdă: mynextdays.com (cookie primar, setat de scriptul Google).",
            "Scop: înregistrează când a început vizita dumneavoastră curentă, astfel încât vizualizările de pagină dintr-o sesiune să aparțină împreună.",
            "Conținut: marcaj de timp și contor al sesiunii; identificatorul din nume se referă la proprietatea noastră, nu la dumneavoastră.",
            "Furnizor: Google Ireland Limited.",
            "Durată: până la doi ani.",
          ],
        },
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
