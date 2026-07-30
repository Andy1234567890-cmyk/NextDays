import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Primii pași",
  description: "Configurați-vă contul și porniți la drum în câteva minute.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Configurare",
      articles: [
        {
          slug: "willkommen",
          title: "Bine ați venit la myNextDays",
          excerpt: "O prezentare a PMS-ului, managerului de canale, pieței și aplicației.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "myNextDays este platforma dvs. centrală pentru unități de cazare de vacanță și hoteluri. În loc de mai multe soluții separate, gestionați disponibilitatea, prețurile, rezervările și comunicarea cu oaspeții într-un singur loc — indiferent dacă aveți o singură casă de vacanță sau mai multe camere de hotel.",
            },
            { type: "h2", text: "Cele patru componente" },
            {
              type: "ul",
              items: [
                "PMS (sistem de management al proprietăților): obiecte, calendar, prețuri, rezervări, sarcini și plăți.",
                "Managerul de canale: conexiunea cu portaluri precum Booking, Airbnb & Co. — o singură introducere de date, sincronizată cu multe portaluri.",
                "Piața myNextDays: propria piață myNextDays, un canal de rezervare de rang egal alături de portaluri.",
                "Aplicația: aplicația mobilă pentru oaspeți, proprietari și angajați, cu aceleași date ca pe web.",
              ],
            },
            { type: "h2", text: "Cum interacționează componentele" },
            {
              type: "p",
              text: "Introduceți obiectul, prețurile și disponibilitatea o singură dată, centralizat, în PMS. De acolo, myNextDays distribuie automat datele către toate canalele active. O rezervare — indiferent de canalul prin care ajunge — blochează imediat nopțile corespunzătoare peste tot, astfel încât suprarezervările sunt excluse.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Începeți cu configurarea contului și a companiei, apoi adăugați primul dvs. obiect — această ordine vă scutește ulterior de corecturi.",
            },
            { type: "h2", text: "Pașii următori" },
            {
              type: "steps",
              items: [
                "Deschideți Cont din meniu și completați datele companiei dvs.",
                "Adăugați primul dvs. obiect în secțiunea Obiecte.",
                "Verificați dacă dotările, fotografiile și prețurile sunt complete.",
                "Apăsați pe Publicare, pentru a face obiectul vizibil pe toate canalele.",
              ],
            },
            {
              type: "p",
              text: "Mai multe despre pașii individuali găsiți la [Configurarea contului și a companiei](/hilfe/erste-schritte/konto-einrichten) și [Adăugarea primului dvs. obiect](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Configurarea contului și a companiei",
          excerpt: "Completați corect datele de bază, adresa de facturare și moneda.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Înainte de a adăuga obiecte, configurați-vă compania în secțiunea Cont. Aceste date sunt necesare pentru facturi, portaluri și decontarea cu myNextDays și, prin urmare, trebuie să fie complete și corecte.",
            },
            { type: "h2", text: "Completarea datelor de bază" },
            {
              type: "steps",
              items: [
                "Deschideți Cont din meniu.",
                "Introduceți la Date de bază numele companiei, respectiv numele întreprinderii individuale, adresa și datele de contact.",
                "Completați adresa de facturare — aceasta va apărea pe toate facturile emise.",
                "Alegeți moneda dvs. de bază. Aceasta se aplică tuturor prețurilor, până când o modificați punctual pentru fiecare obiect.",
              ],
            },
            { type: "h2", text: "De ce este importantă moneda" },
            {
              type: "p",
              text: "Moneda nu este ghicită și nici completată automat: dacă lipsește, niciun preț nu poate fi afișat sau facturat corect. De aceea myNextDays impune o alegere conștientă la configurare, în loc să folosească o valoare implicită.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Dacă modificați ulterior moneda unui obiect, toate planurile de tarifare aferente vor fi actualizate în consecință. Verificați apoi o dată prețurile.",
            },
            { type: "h2", text: "Adresa de facturare și facturarea" },
            {
              type: "p",
              text: "În secțiunea Facturare din Cont vedeți facturile dvs. curente și adresa de facturare înregistrată. Păstrați-o actualizată, în special în cazul unei schimbări a formei juridice sau a adresei, pentru ca facturile să fie emise corect.",
            },
            {
              type: "ul",
              items: [
                "Numele companiei, respectiv numele întreprinderii individuale",
                "Adresa de facturare, cu țara",
                "Codul fiscal, respectiv codul de TVA, dacă există",
                "Moneda de bază pentru obiectele noi",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Adăugarea primului dvs. obiect",
          excerpt: "Cum să adăugați pas cu pas primul dvs. obiect rezervabil.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Un obiect în myNextDays este întotdeauna exact o unitate rezervabilă: fie o singură cameră dintr-un hotel, fie o unitate de cazare de vacanță completă. Dacă administrați un hotel cu mai multe camere, adăugați câte un obiect separat pentru fiecare cameră.",
            },
            { type: "h2", text: "Adăugarea unui obiect" },
            {
              type: "steps",
              items: [
                "Deschideți Obiecte din meniu.",
                "Apăsați pe Adăugare obiect.",
                "Alegeți tipul obiectului: categorie, tip de imobil și tip de ofertă.",
                "Completați adresa, capacitatea și prețul de bază în moneda dvs. înregistrată.",
                "Salvați obiectul ca ciornă, pentru a-l completa mai târziu.",
              ],
            },
            { type: "h2", text: "Ce mai lipsește după aceea" },
            {
              type: "p",
              text: "Un obiect nou adăugat este inițial o ciornă și nu este vizibil pe niciun canal. Completați dotările, fotografiile, descrierea și disponibilitatea calendarului înainte de a-l publica — doar un obiect complet poate fi comercializat în mod fiabil.",
            },
            {
              type: "ul",
              items: [
                "Selectați dotările din lista de categorii",
                "Adăugați cel puțin o fotografie principală și o descriere",
                "Completați corect capacitatea (adulți, copii, paturi)",
                "Verificați prețul de bază și disponibilitatea calendarului",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dacă administrați mai multe tipuri de camere, repetați acest proces pentru fiecare cameră în parte — nu există un nivel superior de tip clădire cu camere subordonate.",
            },
            {
              type: "p",
              text: "Dacă toate câmpurile obligatorii sunt completate, puteți publica obiectul, vezi [Publicarea unui obiect](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Publicarea unui obiect",
          excerpt: "Un singur clic activează simultan piața, portalurile și site-ul web.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "Publicarea face un obiect vizibil și rezervabil. În mod normal, un singur clic este suficient pentru a activa simultan toate cele trei canale de vânzare — dar puteți ajusta oricând vizibilitatea individual, pe fiecare canal.",
            },
            { type: "h2", text: "Cum publicați" },
            {
              type: "steps",
              items: [
                "Deschideți obiectul din secțiunea Obiecte.",
                "Verificați în fila Prezentare generală dacă toate datele obligatorii sunt marcate cu verde.",
                "Apăsați pe Publicare.",
                "Confirmați dialogul — piața, portalurile și site-ul web vor fi activate.",
              ],
            },
            { type: "h2", text: "Controlul individual al canalelor" },
            {
              type: "p",
              text: "După publicare, găsiți în fila Vizibilitate trei comutatoare separate: Site web, Piață și Portaluri. Dacă doriți, de exemplu, să oferiți un obiect doar pe site-ul dvs. propriu, dar nu prin portaluri, dezactivați pur și simplu comutatorul corespunzător.",
            },
            {
              type: "ul",
              items: [
                "Site web: vizibilitate pe propriul dvs. site myNextDays",
                "Piață: vizibilitate pe piața globală myNextDays",
                "Portaluri: vizibilitate pe Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Aceste trei comutatoare sunt independente de starea obiectului (activ/inactiv). Un obiect activ poate fi totuși invizibil pe canale individuale.",
            },
            { type: "h2", text: "Blocarea temporară a unui obiect" },
            {
              type: "p",
              text: "Dacă doriți să blocați o singură zi în loc de întregul obiect, folosiți Stop-Sell în calendar — acesta blochează ziua pe toate canalele simultan, indiferent de comutatoarele de vizibilitate.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Înțelegerea celor trei canale de vânzare",
          excerpt: "O prezentare a portalurilor, pieței și aplicației.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "p",
              text: "myNextDays comercializează fiecare obiect simultan prin mai multe căi de rang egal. Înțelegerea modului în care acestea interacționează vă ajută să controlați în mod țintit vizibilitatea și prețurile.",
            },
            { type: "h2", text: "Portaluri" },
            {
              type: "p",
              text: "Prin intermediul managerului de canale, vă conectați obiectul cu portaluri mari de rezervare precum Booking, Airbnb & Co. Disponibilitatea și prețurile sunt sincronizate automat, astfel încât nu trebuie să actualizați manual mai multe calendare de portal.",
            },
            { type: "h2", text: "Piața" },
            {
              type: "p",
              text: "Piața myNextDays este un canal de rezervare propriu, global — comparabil cu Booking sau Airbnb, dar parte a aceleiași platforme. Nu este un înlocuitor pentru „rezervarea directă”, ci un canal de rang egal, cu propria axă de vizibilitate.",
            },
            { type: "h2", text: "Aplicația" },
            {
              type: "p",
              text: "Aplicația mobilă oferă oaspeților, proprietarilor și angajaților acces la aceleași date ca pe web — de exemplu detalii despre rezervare, mesaje sau sarcini, în funcție de rol.",
            },
            { type: "h2", text: "Trei axe de vizibilitate separate" },
            {
              type: "ul",
              items: [
                "Site web — propriul dvs. site myNextDays",
                "Piață — piața globală myNextDays",
                "Portaluri — Booking, Airbnb & Co. prin managerul de canale",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Toate cele trei axe pot fi activate independent una de cealaltă. Stop-Sell și starea obiectului acționează, în schimb, transversal pe toate cele trei simultan.",
            },
          ],
        },
      ],
    },
  ],
};
