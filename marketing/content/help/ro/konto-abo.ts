import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Cont și abonament",
  description: "Date de bază, tarif, securitate și 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Cont",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Datele de bază ale companiei",
          excerpt: "Gestionați centralizat numele companiei, adresa și datele de contact.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "La /konto, myNextDays reunește toate funcțiile companiei și ale contului ca secțiuni pe o singură pagină — nu trebuie să treceți între multe subpagini. Datele de bază ale companiei formează fundamentul: numele companiei, forma juridică, adresa și datele de contact, folosite pentru facturi, portaluri și comunicarea cu oaspeții.",
            },
            { type: "h2", text: "Deschiderea și editarea datelor de bază" },
            {
              type: "steps",
              items: [
                "Deschideți /konto.",
                "Treceți la secțiunea „Date de bază ale companiei”.",
                "Verificați numele companiei, adresa, numărul de telefon și adresa de e-mail pentru întrebări.",
                "Faceți modificările dorite.",
                "Salvați secțiunea.",
              ],
            },
            { type: "h2", text: "De ce sunt importante aceste date" },
            {
              type: "p",
              text: "Datele de bază ale companiei sunt folosite în facturi, în înregistrarea la portalurile conectate și în informații obligatorii legal, precum mențiunile legale. O adresă incompletă sau depășită poate duce la emiterea eronată a facturilor sau la întârzierea conectărilor cu portalurile.",
            },
            {
              type: "ul",
              items: [
                "Numele companiei și forma juridică apar pe toate facturile emise.",
                "Adresa este necesară pentru înregistrarea la portaluri.",
                "Datele de contact servesc drept cale de rezervă, în cazul în care notificările sistemului nu ajung.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă modificați adresa dvs. de facturare, verificați apoi facturile deja emise la [Facturare și calculator de tarife](/hilfe/konto-abo/abrechnung-tarifrechner) — documentele existente nu se ajustează retroactiv.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonament și tarif",
          excerpt: "Tariful dvs. determină contingentul de obiecte — numărul de obiecte comandate îl vedeți oricând în Cont.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Abonamentul dvs. myNextDays cuprinde un contingent de obiecte: numărul maxim de obiecte (camere sau unități de cazare de vacanță) pe care le puteți administra activ simultan. Numărul de obiecte comandat în prezent este afișat în secțiunea „Abonament și tarif” din /konto, împreună cu contingentul rămas.",
            },
            { type: "h2", text: "Ținerea sub control a contingentului" },
            {
              type: "p",
              text: "Contingentul este impus la nivel de server: dacă atingeți limita maximă a tarifului dvs., nu mai puteți adăuga niciun alt obiect, până când dezactivați un obiect existent sau vă extindeți tariful. Acest lucru se aplică indiferent dacă noul obiect este o cameră sau o unitate de cazare de vacanță — ambele contează la fel în contingent.",
            },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Abonament și tarif”.",
                "Verificați numărul de obiecte comandat, raportat la contingentul tarifului dvs.",
                "Alegeți, dacă este necesar, un tarif mai mare, pentru a adăuga mai multe obiecte.",
                "Confirmați schimbarea tarifului.",
              ],
            },
            {
              type: "ul",
              items: [
                "Fiecare obiect contează individual în contingent, indiferent de tipul obiectului.",
                "O schimbare de tarif acționează imediat asupra contingentului disponibil.",
                "Un downgrade este posibil doar dacă numărul de obiecte active se încadrează în noul contingent.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un downgrade la un tarif cu contingent mai mic este respins, atât timp cât sunt active mai multe obiecte decât permite noul tarif. Dezactivați mai întâi obiectele în plus.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalii despre facturi și calculul tarifului găsiți la [Facturare și calculator de tarife](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Facturare și calculator de tarife",
          excerpt: "Adresa de facturare, facturile anterioare și calculatorul de tarife pentru contingentul dvs. de obiecte.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Secțiunea „Facturare și calculator de tarife” din /konto reunește tot ce ține de emiterea facturilor: adresa dvs. de facturare, lista facturilor anterioare, disponibile pentru descărcare, precum și un calculator de tarife, cu care puteți estima costurile pentru contingentul dvs. actual sau pentru unul mai mare de obiecte.",
            },
            { type: "h2", text: "Adresa de facturare și facturile" },
            {
              type: "p",
              text: "Adresa de facturare poate diferi de adresa companiei dvs., de exemplu dacă un cabinet de contabilitate primește documentele. Facturile deja emise le găsiți sortate cronologic; fiecare poate fi descărcată ca PDF.",
            },
            { type: "h2", text: "Folosirea calculatorului de tarife" },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Facturare și calculator de tarife”.",
                "Introduceți în calculatorul de tarife numărul de obiecte dorit.",
                "Comparați costurile rezultate per nivel de tarif.",
                "Treceți, dacă este necesar, direct din calculator la tariful potrivit.",
              ],
            },
            {
              type: "ul",
              items: [
                "Calculatorul de tarife arată costurile în moneda înregistrată pentru contul dvs.",
                "Facturile sunt disponibile permanent pentru descărcare.",
                "Adresa de facturare poate fi gestionată independent de datele de bază ale companiei.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Comparați regulat, cu ajutorul calculatorului de tarife, dacă contingentul dvs. de obiecte mai corespunde numărului efectiv de obiecte comandate — vezi [Abonament și tarif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Modificarea parolei și a e-mailului",
          excerpt: "Modificările critice pentru securitate necesită o nouă autentificare și un pas de confirmare.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Parola și adresa de e-mail se numără printre datele cele mai critice pentru securitatea contului dvs. myNextDays impune, prin urmare, la ambele modificări, o nouă autentificare — confirmați modificarea cu parola dvs. actuală, chiar dacă sunteți deja autentificat.",
            },
            { type: "h2", text: "Modificarea parolei" },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Modificare parolă și e-mail”.",
                "Introduceți parola dvs. actuală, pentru confirmare.",
                "Stabiliți noua parolă și repetați-o.",
                "Salvați modificarea.",
              ],
            },
            { type: "h2", text: "Modificarea adresei de e-mail" },
            {
              type: "p",
              text: "Schimbarea adresei de e-mail se desfășoară ca dublu opt-in: după confirmarea parolei dvs. actuale, primiți un link de confirmare la adresa NOUĂ. Abia cu clicul pe acest link modificarea devine efectivă — adresa veche rămâne activă până atunci, pentru ca accesul la contul dvs. să nu fie niciodată întrerupt.",
            },
            {
              type: "ul",
              items: [
                "Fără parola actuală nu se poate modifica nici parola, nici e-mailul.",
                "Linkul de confirmare pentru noua adresă de e-mail este valabil pentru un timp limitat.",
                "Până la confirmare, adresa de e-mail anterioară rămâne activă pentru autentificare și notificări.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Verificați, după o modificare de e-mail, și autentificarea în doi factori — vezi [Autentificare în doi factori](/hilfe/konto-abo/zwei-faktor) — dacă codurile de recuperare erau legate de adresa veche.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Autentificare în doi factori",
          excerpt: "Un pas suplimentar de autentificare vă protejează contul de accesul neautorizat.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Autentificarea în doi factori (2FA) completează parola dvs. cu un al doilea factor, printr-o aplicație de autentificare. Astfel, o parolă furată singură nu mai este suficientă pentru a vă accesa contul myNextDays.",
            },
            { type: "h2", text: "Configurarea 2FA" },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Autentificare în doi factori”.",
                "Confirmați parola dvs. actuală, pentru o nouă autentificare.",
                "Scanați codul QR afișat cu o aplicație de autentificare.",
                "Introduceți codul generat, pentru confirmare.",
                "Păstrați codurile de recuperare afișate într-un loc sigur.",
              ],
            },
            { type: "h2", text: "Dezactivarea 2FA" },
            {
              type: "p",
              text: "Și dezactivarea autentificării în doi factori necesită o nouă autentificare, cu parola dvs. actuală. Astfel myNextDays previne posibilitatea ca cineva cu o sesiune deja deschisă să vă dezactiveze pur și simplu protecția.",
            },
            {
              type: "ul",
              items: [
                "Codurile de recuperare permit accesul, dacă aplicația de autentificare se pierde.",
                "Fiecare cod de recuperare poate fi folosit o singură dată.",
                "Activarea și dezactivarea 2FA sunt ambele legate de o confirmare a parolei.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Păstrați codurile de recuperare separat de dispozitivul cu aplicația de autentificare, de exemplu într-un manager de parole.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Istoricul dispozitivelor",
          excerpt: "Țineți sub control de pe ce dispozitive este autentificat contul dvs.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Istoricul dispozitivelor din /konto vă arată pe ce dispozitive este autentificat în prezent contul dvs. — cu tipul dispozitivului, locația aproximativă și momentul ultimei activități. Astfel recunoașteți rapid dacă o autentificare provine efectiv de la dvs.",
            },
            { type: "h2", text: "Verificarea istoricului dispozitivelor" },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Istoricul dispozitivelor”.",
                "Vizualizați lista dispozitivelor autentificate.",
                "Dacă recunoașteți un dispozitiv necunoscut, deconectați-l.",
                "Modificați apoi, din motive de siguranță, parola dvs.",
              ],
            },
            { type: "h2", text: "Când este utilă o verificare" },
            {
              type: "p",
              text: "Verificați istoricul dispozitivelor în special după o modificare de parolă sau de e-mail, precum și după folosirea unui dispozitiv străin sau public. O intrare necunoscută este un semnal clar de avertizare pentru acces neautorizat.",
            },
            {
              type: "ul",
              items: [
                "Fiecare intrare arată tipul dispozitivului, locația aproximativă și ultima activitate.",
                "Dispozitivele individuale pot fi deconectate în mod țintit, fără a afecta celelalte.",
                "Un dispozitiv nerecunoscut este motiv pentru o schimbare imediată a parolei.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dacă nu recunoașteți un dispozitiv, deconectați-l imediat și modificați apoi parola la [Modificare parolă și e-mail](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Confidențialitate",
          excerpt: "Controlați indexarea în motoarele de căutare per obiect și exportați-vă datele.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "În secțiunea „Confidențialitate” din /konto controlați două lucruri: dacă paginile obiectelor dvs. pot fi indexate de motoarele de căutare și cum vă puteți exporta datele stocate la myNextDays.",
            },
            { type: "h2", text: "Indexarea în motoarele de căutare per obiect" },
            {
              type: "p",
              text: "Implicit, indexarea în motoarele de căutare este dezactivată pentru obiectele noi. Abia atunci când o activați conștient per obiect, motoare de căutare precum Google pot include pagina publică a obiectului în indexul lor. Astfel păstrați controlul asupra căror obiecte pot fi găsite în afara portalurilor și a propriei platforme.",
            },
            {
              type: "steps",
              items: [
                "Deschideți /konto și secțiunea „Confidențialitate”.",
                "Alegeți obiectul dorit din listă.",
                "Activați sau dezactivați indexarea în motoarele de căutare.",
                "Folosiți, la mai multe obiecte, comutatorul general, pentru a le seta uniform pe toate.",
              ],
            },
            { type: "h2", text: "Exportul datelor" },
            {
              type: "p",
              text: "Prin funcția de export al datelor solicitați o copie completă a datelor dvs. stocate în cont. Exportul este pregătit și ulterior pus la dispoziție pentru descărcare.",
            },
            {
              type: "ul",
              items: [
                "Indexarea poate fi controlată individual per obiect, cu un comutator general pentru toate obiectele.",
                "Obiectele noi pornesc în mod fundamental fără indexare în motoarele de căutare.",
                "Exportul de date conține datele de cont și de obiect, în formă structurată.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Indexarea în motoarele de căutare este independentă de vizibilitatea pe portaluri și pe propria piață — aceasta privește exclusiv pagina publică a obiectului în motoarele de căutare.",
            },
          ],
        },
      ],
    },
  ],
};
