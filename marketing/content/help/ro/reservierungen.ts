import type { HelpCategory } from "../types";

export const reservierungen: HelpCategory = {
  slug: "reservierungen",
  title: "Rezervări",
  description: "Gestionați, mutați și anulați rezervări.",
  icon: "ph:book-open",
  collection: "kb",
  sections: [
    {
      heading: "Rezervări",
      articles: [
        {
          slug: "buchung-erfassen",
          title: "Înregistrarea manuală a unei rezervări",
          excerpt:
            "Cum înregistrați direct în myNextDays o rezervare primită telefonic sau prin e-mail.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Când înregistrați manual" },
            {
              type: "p",
              text: "Nu fiecare rezervare vine printr-un portal sau prin propria dvs. platformă — cererile prin telefon, e-mail sau la fața locului trebuie să le adăugați dvs. înșivă, pentru ca obiectul să fie blocat corect în myNextDays și să nu apară o dublă ocupare.",
            },
            {
              type: "steps",
              items: [
                "Deschideți Rezervări și apăsați pe „Rezervare nouă”.",
                "Alegeți obiectul — fiecare obiect din myNextDays este o unitate rezervabilă individuală, deci o anumită cameră sau unitate de cazare de vacanță.",
                "Stabiliți sosirea și plecarea, precum și numărul de oaspeți.",
                "Completați datele oaspetelui (nume, contact, eventual adresa pentru factură).",
                "Verificați prețul propus și ajustați-l dacă este necesar.",
                "Salvați rezervarea — nopțile sunt blocate imediat în calendar.",
              ],
            },
            { type: "h2", text: "Plata și confirmarea" },
            {
              type: "p",
              text: "După salvare se aplică aceleași reguli de plată ca la rezervările online. Dacă este conectat un furnizor de plăți, puteți trimite direct un link de plată oaspetelui sau puteți marca manual plata ca fiind primită.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Introduceți dorințele speciale (sosire timpurie, paturi suplimentare) direct în note — echipa le vede în linia de timp a rezervării.",
            },
            { type: "h2", text: "După adăugare" },
            {
              type: "p",
              text: "Noua rezervare apare imediat în [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste), cu toți pașii următori — mesaje, sarcini și plăți — reuniți într-un singur loc.",
            },
            {
              type: "ul",
              items: [
                "Calendarul și portalurile se sincronizează automat de îndată ce salvați.",
                "Oaspetele primește, dacă este necesar, un mesaj automat de confirmare.",
                "Modificările datelor le înregistrați prin „Mutarea rezervării”.",
              ],
            },
          ],
        },
        {
          slug: "buchungs-zeitleiste",
          title: "Linia de timp a rezervării",
          excerpt:
            "Linia de timp a rezervării reunește într-un singur loc întregul parcurs al unei rezervări.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Ce arată linia de timp" },
            {
              type: "p",
              text: "Fiecare rezervare are propria linie de timp, care reprezintă cronologic întregul parcurs — de la cererea de rezervare sau importul din portal, până la check-out. Astfel vedeți dintr-o privire ce s-a întâmplat deja și ce urmează.",
            },
            {
              type: "ul",
              items: [
                "Mesaje cu oaspetele",
                "Sarcini, de exemplu curățenie sau pregătire",
                "Plăți și facturi",
                "Add-on-uri și servicii suplimentare rezervate",
                "Mutări (Move) și anulări",
              ],
            },
            { type: "h2", text: "Folosirea liniei de timp în practica zilnică" },
            {
              type: "steps",
              items: [
                "Deschideți Rezervări și alegeți rezervarea dorită.",
                "Treceți la fila „Linia de timp”.",
                "Parcurgeți cronologic toate evenimentele.",
                "Folosiți acțiunile rapide, pentru a trimite direct un mesaj sau a adăuga o sarcină.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă o rezervare este mutată sau anulată, acest pas apare de asemenea în linia de timp — inclusiv nopțile eliberate în calendar.",
            },
            { type: "h2", text: "De ce este important acest lucru" },
            {
              type: "p",
              text: "Deoarece echipa, proprietarul și suportul văd aceeași linie de timp, nu apar goluri de informație între mesaje, sarcini și plăți. Detalii despre rambursări găsiți la [Rambursări](/hilfe/zahlungen/rueckerstattungen), despre servicii suplimentare la [Add-on-uri și servicii suplimentare](/hilfe/reservierungen/add-ons).",
            },
          ],
        },
        {
          slug: "buchung-verschieben",
          title: "Mutarea unei rezervări",
          excerpt:
            "Cum mutați o rezervare existentă într-o nouă perioadă, fără a perturba calendarul.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Verificarea înainte de mutare" },
            {
              type: "p",
              text: "Înainte de a muta o rezervare, verificați disponibilitatea în noua perioadă pentru obiectul rezervat. myNextDays eliberează nopțile rezervate inițial abia după confirmarea noii perioade — astfel nu apare niciun gol în care obiectul să fie considerat în mod eronat liber sau dublu ocupat.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea în Rezervări.",
                "Alegeți „Mutare” și introduceți noua perioadă.",
                "Verificați disponibilitatea afișată pentru noile date.",
                "Confirmați mutarea.",
                "Verificați dacă prețul se modifică din cauza noului număr de nopți și ajustați-l dacă este necesar.",
              ],
            },
            { type: "h2", text: "Ce se întâmplă automat" },
            {
              type: "p",
              text: "După confirmare, nopțile vechi sunt eliberate corect în calendar, iar cele noi sunt blocate, iar portalurile conectate sunt actualizate. Procesul este înregistrat în linia de timp a rezervării.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Dacă rezervarea a fost primită printr-un portal, o mutare poate fi supusă acolo unor reguli proprii — verificați politicile portalului, înainte de a face modificări majore.",
            },
            { type: "h2", text: "Diferențe de plată" },
            {
              type: "p",
              text: "Dacă prețul se modifică din cauza mutării, ajustați regulile de plată în consecință — vezi [Reguli de plată](/hilfe/zahlungen/zahlungsregeln). Mai multe despre desfășurarea completă a unei rezervări găsiți la [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "stornierung-rueckerstattung",
          title: "Anulare și rambursare",
          excerpt:
            "Cum anulați corect o rezervare și, dacă este necesar, declanșați o rambursare.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Anularea unei rezervări" },
            {
              type: "p",
              text: "O anulare eliberează imediat obiectul pentru perioada rezervată — atât în calendarul dvs., cât și pe toate portalurile conectate. Verificați înainte de anulare ce condiții de anulare se aplică acestei rezervări.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea în Rezervări.",
                "Alegeți „Anulare” și indicați un motiv.",
                "Verificați suma de rambursare propusă.",
                "Confirmați anularea.",
              ],
            },
            { type: "h2", text: "Declanșarea unei rambursări" },
            {
              type: "p",
              text: "Dacă plata a fost procesată printr-un furnizor de plăți conectat, puteți iniția rambursarea direct din rezervare. Suma este afișată în moneda înregistrată pentru acest obiect. Detalii despre proces găsiți la [Rambursări](/hilfe/zahlungen/rueckerstattungen).",
            },
            {
              type: "ul",
              items: [
                "Rambursare completă sau parțială posibilă",
                "Procesul apare în linia de timp a rezervării",
                "La rezervările prin portal se aplică suplimentar regulile portalului respectiv",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "O anulare nu poate fi anulată. Verificați cu atenție perioada și oaspetele, înainte de a confirma.",
            },
            { type: "h2", text: "După anulare" },
            {
              type: "p",
              text: "Obiectul este de acum rezervabil din nou, iar sarcinile deschise legate de rezervare — de exemplu pregătirea — sunt marcate automat ca nemaifiind necesare. Întregul proces rămâne trasabil în [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "checkin-checkout",
          title: "Check-in și check-out",
          excerpt: "Cum documentați sosirea și plecarea unui oaspete în myNextDays.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Înregistrarea check-in-ului" },
            {
              type: "p",
              text: "Check-in-ul marchează începutul sejurului și este util în special în cazul auto-check-in-ului sau al predării cheii de către echipă, pentru a menține actualizat statusul fiecărei rezervări.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea în Rezervări.",
                "Alegeți „Check-in” în ziua sosirii.",
                "Completați, dacă este necesar, o notă, de exemplu ora sau particularități.",
              ],
            },
            { type: "h2", text: "Check-out și predare" },
            {
              type: "p",
              text: "La check-out marcați sejurul ca fiind încheiat. Acest lucru declanșează în multe cazuri automat o sarcină de curățenie pentru obiect, pentru ca acesta să fie pregătit pentru următoarea rezervare.",
            },
            {
              type: "ul",
              items: [
                "Check-in-ul și check-out-ul fac parte din linia de timp a rezervării",
                "Orele pot fi definite per obiect, în setările obiectului",
                "În cazul accesului mobil, echipa poate înregistra check-in-ul și check-out-ul direct la fața locului",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un check-out ratat nu blochează automat sarcinile ulterioare — verificați regulat statusurile restante în Rezervări.",
            },
            { type: "h2", text: "Legătura cu sarcinile" },
            {
              type: "p",
              text: "Check-in-ul și check-out-ul sunt strâns legate de sarcini și de linia de timp. Mai multe despre desfășurarea completă citiți la [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
        {
          slug: "add-ons",
          title: "Add-on-uri și servicii suplimentare",
          excerpt:
            "Cum oferiți oaspeților servicii suplimentare rezervabile, precum micul dejun sau transferul, și le înregistrați în rezervare.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Ce sunt add-on-urile" },
            {
              type: "p",
              text: "Add-on-urile sunt servicii suplimentare opționale la o rezervare — de exemplu mic dejun, sosire timpurie, transfer sau check-out întârziat. Acestea se înregistrează per obiect și pot fi adăugate la rezervare fie de oaspete însuși, fie de echipa dvs.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și adăugați la „Add-on-uri” serviciile suplimentare dorite, cu preț.",
                "Deschideți o rezervare existentă în Rezervări.",
                "Alegeți „Adăugare add-on” și selectați serviciul dorit.",
                "Confirmați cantitatea și momentul serviciului.",
              ],
            },
            { type: "h2", text: "Facturare" },
            {
              type: "p",
              text: "Add-on-urile sunt facturate în moneda obiectului respectiv și apar ca poziție separată pe factură. Add-on-urile deja plătite pot fi rambursate proporțional în caz de anulare.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Înregistrați o dată, centralizat, la obiect, add-on-urile populare — astfel pot fi adăugate cu câteva clicuri la fiecare rezervare nouă.",
            },
            { type: "h2", text: "Vizibilitate pentru oaspete" },
            {
              type: "p",
              text: "Dacă platforma sau propriul site web este activ, oaspeții pot adesea alege add-on-urile potrivite deja în timpul rezervării. Fiecare completare apare apoi în [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
            {
              type: "ul",
              items: [
                "Add-on-urile pot fi denumite și tarifate individual per obiect",
                "Adăugarea ulterioară este posibilă oricând prin rezervare",
                "Add-on-urile anulate sunt rambursate proporțional",
              ],
            },
          ],
        },
      ],
    },
  ],
};
