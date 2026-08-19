import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Prețuri și tarife",
  description: "Planuri de tarifare, prețuri sezoniere și prețuri dinamice.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Stabilirea prețurilor",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Preț de bază și monedă",
          excerpt: "Cum stabiliți prețul de bază și atribuiți moneda corectă obiectului dvs.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Fiecare obiect din myNextDays este exact o unitate rezervabilă — o singură cameră sau o unitate de cazare de vacanță. Pentru această unitate stabiliți un preț de bază, precum și o monedă centrală, care se aplică întregului obiect.",
            },
            { type: "h2", text: "Stabilirea centralizată a monedei" },
            {
              type: "p",
              text: "Moneda obiectului se stabilește o singură dată per obiect și se aplică automat tuturor planurilor de tarifare pe care le creați pentru acest obiect. Nu există o monedă implicită de rezervă — dacă lipsește moneda, nu puteți salva prețuri.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul dvs. în secțiunea „Obiecte”.",
                "Treceți la fila „Prețuri”.",
                "Alegeți moneda potrivită la „Moneda obiectului”.",
                "Introduceți prețul de bază pentru ocuparea standard.",
                "Salvați modificările.",
              ],
            },
            { type: "h2", text: "Ce se întâmplă la o modificare a monedei" },
            {
              type: "p",
              text: "Dacă modificați ulterior moneda obiectului, aceasta afectează toate planurile de tarifare existente ale acestui obiect, deoarece acestea sunt întotdeauna gestionate în moneda obiectului. Verificați apoi prețurile dvs., înainte de a le transmite din nou către portaluri.",
            },
            {
              type: "ul",
              items: [
                "Un obiect are exact o monedă — nu mai multe per plan de tarifare.",
                "Prețul de bază este valoarea de plecare pentru tarifele derivate.",
                "Sumele sunt afișate întotdeauna în moneda obiectului înregistrată.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără o monedă înregistrată, nu se poate salva niciun preț și nu se poate transmite niciun tarif către portaluri. Verificați acest lucru mai întâi, dacă o modificare de preț eșuează.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mai multe despre tarifele derivate găsiți la [Tarife derivate](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Adăugarea planurilor de tarifare",
          excerpt: "Planurile de tarifare reunesc prețul, condițiile de anulare și masa pentru un obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Un plan de tarifare definește condițiile în care poate fi rezervat un obiect: preț, reguli de anulare, masă și sejur minim. Un obiect poate oferi simultan mai multe planuri de tarifare, de exemplu unul flexibil și unul nerambursabil.",
            },
            { type: "h2", text: "Crearea unui nou plan de tarifare" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la fila „Prețuri”.",
                "Apăsați pe „Adăugare plan de tarifare nou”.",
                "Atribuiți un nume sugestiv, de ex. „Flexibil” sau „Nerambursabil”.",
                "Stabiliți dacă planul este un tarif de bază sau un tarif derivat.",
                "Completați condițiile de anulare și masa.",
                "Salvați și activați planul de tarifare.",
              ],
            },
            { type: "h2", text: "Tarif de bază vs. alte planuri de tarifare" },
            {
              type: "p",
              text: "Creați mai întâi tariful dvs. de bază (denumit adesea „BAR”, Best Available Rate). Toate celelalte planuri de tarifare pot fi gestionate fie independent, fie derivate din acest tarif de bază.",
            },
            {
              type: "ul",
              items: [
                "Tarif de bază: preț de bază per noapte, gestionat manual.",
                "Alte planuri de tarifare: independente sau ca supliment/reducere față de tariful de bază.",
                "Fiecare plan de tarifare poate fi transmis individual către portaluri.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Păstrați numărul de planuri de tarifare per obiect ușor de gestionat — prea multe variante îngreunează comparația pentru oaspeți și cresc efortul de întreținere.",
            },
            {
              type: "note",
              variant: "info",
              text: "Detalii despre suplimente și reduceri găsiți la [Tarife derivate](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Tarife derivate",
          excerpt: "Planurile de tarifare derivate se calculează automat dintr-un tarif de bază.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Un tarif derivat este un plan de tarifare al cărui preț nu este gestionat manual, ci se calculează automat dintr-un tarif de bază — ca supliment fix, reducere sau procentaj. Acest lucru economisește efort de întreținere, deoarece o modificare a prețului la tariful de bază actualizează automat toate planurile derivate.",
            },
            { type: "h2", text: "Exemplu tipic" },
            {
              type: "p",
              text: "Un model frecvent este un plan cu mic dejun, derivat din tariful de bază fără masă: prețul micului dejun este definit ca supliment per noapte și persoană la tariful de bază. Dacă modificați tariful de bază, prețul micului dejun se ajustează automat.",
            },
            { type: "h2", text: "Configurarea unui tarif derivat" },
            {
              type: "steps",
              items: [
                "Deschideți planul de tarifare dorit în fila „Prețuri”.",
                "Alegeți ca sursă de preț „Derivat din …” și tariful de bază corespunzător.",
                "Stabiliți dacă diferența se aplică ca sumă fixă sau ca procentaj.",
                "Stabiliți dacă este vorba de un supliment sau de o reducere.",
                "Salvați atribuirea.",
              ],
            },
            {
              type: "ul",
              items: [
                "Supliment: de ex. masă, posibilitate de anulare ulterioară.",
                "Reducere: de ex. plan nerambursabil cu avantaj de preț.",
                "Tariful de bază rămâne singura sursă gestionată manual.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Un tarif derivat nu poate fi simultan suprascris manual. Eliminați mai întâi derivarea, dacă doriți să setați un preț individual diferit.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Prețuri sezoniere și de weekend",
          excerpt: "Ajustați în mod țintit prețurile pentru perioade sezoniere și weekenduri.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Cererea variază de-a lungul anului și în interiorul săptămânii. Cu prețurile sezoniere și de weekend ajustați prețul de bază pentru anumite perioade sau zile ale săptămânii, fără a intra separat în calendar pentru fiecare zi.",
            },
            { type: "h2", text: "Adăugarea unei perioade sezoniere" },
            {
              type: "steps",
              items: [
                "Deschideți în obiect fila „Prețuri” și secțiunea „Prețuri sezoniere”.",
                "Adăugați o nouă perioadă cu dată de început și de sfârșit.",
                "Completați prețul sau abaterea procentuală față de prețul de bază pentru această perioadă.",
                "Salvați perioada sezonieră.",
              ],
            },
            { type: "h2", text: "Prețuri de weekend" },
            {
              type: "p",
              text: "Suplimentar, puteți atribui zile individuale ale săptămânii, de exemplu vineri și sâmbătă, cu un supliment propriu. Acest supliment se aplică în plus față de prețul sezonier sau de bază valabil în momentul respectiv.",
            },
            {
              type: "ul",
              items: [
                "Prețurile sezoniere se aplică pentru perioade consecutive.",
                "Prețurile de weekend se aplică per zi a săptămânii, independent de sezon.",
                "Ambele reguli pot fi combinate.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă se suprapun mai multe perioade sezoniere, se aplică regula adăugată cel mai recent, respectiv cea mai specifică. Verificați calendarul după salvare.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Pentru ajustări automate, bazate pe cerere, se pretează suplimentar [Prețurile dinamice](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Prețuri dinamice",
          excerpt: "Ajustați automat prețurile în funcție de cerere, timp de anticipare și grad de ocupare.",
          updated: "Actualizat: august 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Prețurile dinamice sunt un modul suplimentar cu plată. Îl activați din „Extensii”, unde este afișat și prețul. Fără modul, automatizarea nu calculează.",
            },
            {
              type: "p",
              text: "Prețurile dinamice ajustează automat prețul de bază pe baza unor factori precum timpul de anticipare al rezervării, gradul de ocupare curent și cererea — similar cu ceea ce fac portalurile mari cu propriile lor recomandări de preț. Astfel reacționați la schimbările pieței fără să ajustați manual fiecare zi.",
            },
            { type: "h2", text: "Activarea prețurilor dinamice" },
            {
              type: "steps",
              items: [
                "Achiziționați modulul din „Instrumente → Extensii” — fără modul automatizarea nu calculează.",
                "Deschideți în meniul principal „Distribuție → Prețuri dinamice”.",
                "În tabelul obiectelor, faceți clic pe pictograma creion de la obiectul dorit („Stabilește prețul de bază”).",
                "Alegeți strategia prețului de bază: bazată pe date sau un preț de bază fix.",
                "Stabiliți prețul minim și maxim și determinați în câmpul „Sensibilitate la grad de ocupare (%)” cât de puternic influențează gradul de ocupare.",
                "Activați „Prețuri dinamice active” și salvați.",
              ],
            },
            { type: "h2", text: "Limite și siguranță" },
            {
              type: "p",
              text: "Limita inferioară și limita superioară a prețului împiedică algoritmul automat să stabilească prețuri care nu sunt sustenabile pentru afacerea dvs. Planurile de tarifare derivate urmează automat tariful de bază calculat dinamic.",
            },
            {
              type: "ul",
              items: [
                "Limita inferioară a prețului protejează împotriva prețurilor prea scăzute în perioade de cerere slabă.",
                "Limita superioară a prețului protejează împotriva prețurilor exagerate în perioade de cerere mare.",
                "Tarifele derivate preiau automat noul tarif de bază.",
                "Un preț zilnic setat manual în calendar are întotdeauna prioritate față de automatizare.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prețurile dinamice acționează doar asupra tarifului de bază. Planurile de tarifare setate manual, fix, fără derivare, nu se modifică automat odată cu acesta.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Reduceri pentru sejur",
          excerpt: "Configurați reduceri pentru sejururi mai lungi și rezervări timpurii.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Reducerile pentru sejur recompensează oaspeții pentru rezervări mai lungi sau pentru rezervarea din timp. Acestea se aplică ca procentaj din prețul total al sejurului și pot fi configurate independent pentru fiecare obiect.",
            },
            { type: "h2", text: "Tipuri de reduceri" },
            {
              type: "ul",
              items: [
                "Reducere pentru sejur lung: de la un anumit număr de nopți, de ex. de la 7 sau 28 de nopți.",
                "Reducere pentru rezervare timpurie: la rezervare cu suficient timp înainte.",
                "Reducere de ultim moment: la rezervare pe termen scurt, aproape de data sosirii.",
              ],
            },
            { type: "h2", text: "Configurarea unei reduceri" },
            {
              type: "steps",
              items: [
                "Deschideți în obiect fila „Prețuri” și secțiunea „Reduceri”.",
                "Alegeți tipul de reducere dorit.",
                "Stabiliți pragul, de ex. numărul minim de nopți sau timpul de anticipare.",
                "Introduceți reducerea în procente.",
                "Salvați regula.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reducerile se aplică prețului total al planului de tarifare respectiv și sunt afișate oaspetelui deja în privirea de ansamblu asupra prețului.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Combinați reducerile pentru sejur lung cu [Sejur minim și maxim](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), pentru a stimula în mod țintit rezervările mai lungi.",
            },
          ],
        },
      ],
    },
  ],
};
