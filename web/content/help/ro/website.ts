import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Constructorul de site-uri web",
  description: "Creați propriul site web de rezervări cu constructorul.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Constructorul de site-uri web",
      articles: [
        {
          slug: "website-erstellen",
          title: "Crearea unui site web",
          excerpt: "Cu constructorul, creați în câteva minute propriul site web de rezervări.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Constructorul de site-uri web vă creează propriul site web de rezervări — un canal de vânzare suplimentar, alături de portaluri și piața myBestDays. Păstrați controlul deplin asupra structurii, conținutului și brandingului.",
            },
            { type: "h2", text: "Cum creați un site web" },
            {
              type: "steps",
              items: [
                "Deschideți Website din meniu.",
                "Apăsați pe Creare website.",
                "Alegeți un șablon ca punct de plecare pentru layout-ul dvs.",
                "Confirmați cu Adăugare website — ajungeți direct în editor.",
              ],
            },
            { type: "h2", text: "Ce conține constructorul" },
            {
              type: "ul",
              items: [
                "Un editor vizual cu pagini, straturi și vizualizare de previzualizare",
                "Componente predefinite pentru liste de obiecte, galerii și formulare de contact",
                "Un traseu de rezervare direct, bazat pe disponibilitatea din calendarul dvs.",
                "Culori, fonturi și logo personalizabile, potrivite mărcii dvs.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Începeți cu un șablon apropiat de tipul dvs. de obiect — unitate de cazare de vacanță sau hotel — asta vă economisește timp mai târziu, la ajustarea componentelor.",
            },
            { type: "h2", text: "Pașii următori" },
            {
              type: "p",
              text: "După creare, ajustați paginile și layout-ul, vezi [Editarea paginilor și layout-ului](/hilfe/website/seiten-layout), și afișați-vă obiectele pe site-ul web, vezi [Afișarea obiectelor pe site-ul web](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Editarea paginilor și layout-ului",
          excerpt: "Ajustați paginile, straturile și componentele în editorul vizual.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Editorul este structurat în trei zone: în stânga, privirea de ansamblu asupra paginilor și straturilor, în mijloc, previzualizarea site-ului dvs. web, în dreapta, setările componentei selectate.",
            },
            { type: "h2", text: "Editarea unei pagini" },
            {
              type: "steps",
              items: [
                "Alegeți în stânga, la Pagini, pagina dorită.",
                "Apăsați în previzualizare pe o componentă, pentru a o selecta.",
                "Ajustați în dreapta textul, imaginea sau spațierea componentei.",
                "Trageți componentele cu mouse-ul (drag-and-drop), pentru a modifica ordinea.",
              ],
            },
            { type: "h2", text: "Adăugarea de pagini și componente noi" },
            {
              type: "p",
              text: "Prin butonul Adăugare pagină creați subpagini suplimentare, de exemplu Despre noi sau Contact. În cadrul unei pagini, adăugați prin Adăugare componentă secțiuni noi, precum galerie, recenzii sau formular de contact.",
            },
            {
              type: "ul",
              items: [
                "Pagina principală, prezentarea obiectelor și contactul sunt predefinite la fiecare șablon",
                "Alte pagini pot fi denumite liber și incluse în navigare",
                "Componentele sunt responsive și se adaptează la desktop, tabletă și smartphone",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Modificările din editor sunt inițial doar o ciornă. Abia un clic pe Publicare le preia pe site-ul dvs. web public.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Conectarea unui domeniu",
          excerpt: "Asociați un domeniu propriu cu site-ul dvs. web myNextDays.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Implicit, site-ul dvs. web este accesibil printr-un subdomeniu myNextDays. Dacă doriți în schimb să folosiți un domeniu propriu, de exemplu compania-dvs.ro, îl conectați în secțiunea Domeniu.",
            },
            { type: "h2", text: "Înregistrarea domeniului" },
            {
              type: "steps",
              items: [
                "Deschideți în Website setările și acolo Domeniu.",
                "Introduceți domeniul dvs. propriu și apăsați pe Conectare.",
                "Adăugați la furnizorul dvs. de domeniu înregistrările DNS afișate.",
                "Așteptați confirmarea — verificarea are loc automat, în fundal.",
              ],
            },
            { type: "h2", text: "Setarea corectă a înregistrărilor DNS" },
            {
              type: "p",
              text: "myNextDays vă arată exact înregistrările necesare pentru furnizorul dvs. de domeniu. Conexiunea devine activă abia după ce aceste înregistrări sunt setate corect și s-au propagat la nivel mondial — acest lucru poate dura câteva ore, în funcție de furnizor.",
            },
            {
              type: "ul",
              items: [
                "Setați înregistrarea CNAME sau A, conform instrucțiunilor afișate",
                "Eliminați în prealabil înregistrările existente, contradictorii, pentru același domeniu",
                "Certificatul pentru https este emis automat după conectarea reușită",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără înregistrări DNS setate corect, site-ul dvs. web rămâne inaccesibil sub domeniul propriu — verificați cu atenție scrierea, comparativ cu datele furnizorului dvs.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Afișarea obiectelor pe site-ul web",
          excerpt: "Ce obiecte sunt vizibile și rezervabile prin site-ul web, controlați separat per obiect.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Pentru ca un obiect să apară pe site-ul dvs. web, vizibilitatea pe site-ul web trebuie activată pentru acest obiect. Acest comutator este independent de vizibilitatea pe piața myBestDays sau pe portaluri.",
            },
            { type: "h2", text: "Activarea unui obiect pentru site-ul web" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul în secțiunea Obiecte.",
                "Treceți la fila Vizibilitate.",
                "Activați comutatorul Site web.",
                "Treceți pe Website și verificați componenta Prezentarea obiectelor în previzualizare.",
              ],
            },
            { type: "h2", text: "Ajustarea ordinii și prezentării" },
            {
              type: "p",
              text: "În componenta Prezentarea obiectelor stabiliți dacă obiectele sunt sortate automat după disponibilitate sau dacă specificați o ordine fixă. Fiecare obiect arată fotografia principală, prețul de bază în moneda sa înregistrată și cele mai importante caracteristici de dotare.",
            },
            {
              type: "ul",
              items: [
                "Sortare automată după disponibilitate sau ordine manuală",
                "Filtrare opțională după tipul obiectului sau dotări",
                "Pașii de rezervare se derulează direct pe site-ul web, fără ocol prin portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Un obiect fără vizibilitate pe site-ul web activată rămâne ascuns din prezentarea obiectelor, chiar dacă este vizibil pe piață sau pe portaluri.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Publicarea site-ului web",
          excerpt: "Ciornele devin vizibile public abia cu un clic pe Publicare.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Cât timp lucrați în editor, doar dvs. vedeți ciorna curentă. Abia un clic pe Publicare face modificările vizibile pentru toți vizitatorii, sub domeniul dvs.",
            },
            { type: "h2", text: "Cum publicați" },
            {
              type: "steps",
              items: [
                "Deschideți în editor previzualizarea și verificați toate paginile.",
                "Apăsați în dreapta sus pe Publicare.",
                "Confirmați dialogul — site-ul web este live imediat după aceea.",
                "Deschideți domeniul dvs. într-o filă nouă, pentru a verifica rezultatul.",
              ],
            },
            { type: "h2", text: "Ciorne și resetare" },
            {
              type: "p",
              text: "Cât timp încă nu ați publicat, puteți reveni oricând la ultima stare publicată, fără a pierde definitiv ciorna — folosiți pentru asta Anulare ciornă în setările site-ului web.",
            },
            {
              type: "ul",
              items: [
                "Modificările publicate sunt vizibile imediat sub domeniul dvs.",
                "O ciornă nepublicată rămâne internă, până când o confirmați.",
                "Fiecare publicare este înregistrată cu dată în istoric.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Verificați înainte de publicare vizualizarea mobilă în previzualizare — majoritatea oaspeților accesează site-urile de rezervări prin smartphone.",
            },
          ],
        },
      ],
    },
  ],
};
