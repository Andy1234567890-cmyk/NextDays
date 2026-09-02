import type { HelpCategory } from "../types";

// Übersetzt aus de/partnerprogramm.ts (Gemini, 02.09.2026). Struktur identisch.
export const partnerprogramm: HelpCategory = {
  slug: "partnerprogramm",
  title: "Program de parteneriat",
  description: "Recomandați proprietăți, construiți o echipă și câștigați din veniturile din abonamente.",
  icon: "ph:handshake",
  collection: "kb",
  sections: [
    {
      heading: "Cum funcționează",
      articles: [
        {
          slug: "ueberblick",
          title: "Prezentare generală a programului de parteneriat",
          excerpt: "Cine poate participa, cum se generează comisionul și ce vedeți.",
          updated: "Situația: septembrie 2026",
          body: [
            {
              type: "p",
              text: "În calitate de partener, recomandați myNextDays proprietarilor, agențiilor și hotelurilor. Dacă o proprietate se înregistrează cu codul dvs. sau prin linkul dvs. și își plătește facturile de abonament, veți primi o parte din venitul net din abonament timp de douăsprezece luni. Nivelurile în funcție de clienții plătitori sunt disponibile live pe pagina programului.",
            },
            { type: "h2", text: "Cine poate deveni partener" },
            {
              type: "ul",
              items: [
                "Persoane fizice și companii din UE, Elveția sau Regatul Unit cu un canal autentic către gazde: influenceri, consultanți, agenții, firme de contabilitate, asociații.",
                "De asemenea, clienții myNextDays înșiși – un abonament nu este o condiție prealabilă.",
                "Obligatoriu în aplicație: cel puțin un cont de social media (Instagram, TikTok, YouTube, Facebook, LinkedIn...) cu adresă, nume de utilizator și acoperire. Un site web sau un newsletter sunt binevenite în plus.",
              ],
            },
            { type: "h2", text: "Cum vi se atribuie o proprietate" },
            {
              type: "steps",
              items: [
                "Distribuiți linkul dvs. (mynextdays.com/p/CODUL-DVS.) sau codul dvs.",
                "Proprietatea vede codul la înregistrare în câmpul „Recomandat de” și îl confirmă prin trimitere – fără cookie.",
                "Perioada de douăsprezece luni începe cu prima factură de abonament plătită.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vedeți clienții dvs. pseudonim (Client #1, #2...) cu țară, status și sume – niciodată nume sau e-mail. O proprietate este atribuită unui singur partener; primul câștigă.",
            },
            { type: "h2", text: "Ce găsiți în tabloul de bord" },
            {
              type: "ul",
              items: [
                "Prezentare generală: rang, clicuri, proprietăți înregistrate și plătitoare, comision deschis, plătibil și plătit.",
                "Comisioane: fiecare factură de abonament plătită ca rând cu bază, rată, sumă și status.",
                "Plăți: lunar pe monedă de la suma minimă, cu credit (self-billing) ca dovadă.",
                "Linkuri și materiale: codurile dvs., materiale promoționale și etichetarea obligatorie pentru fiecare țară.",
                "Mesaje: legătura directă cu echipa de parteneri.",
              ],
            },
          ],
        },
        {
          slug: "team-provision",
          title: "Construiți o echipă: comisionul de echipă",
          excerpt: "Recrutați parteneri care se alătură cu codul dvs. – și câștigați din veniturile clienților lor.",
          updated: "Situația: septembrie 2026",
          body: [
            {
              type: "p",
              text: "Puteți aduce alți parteneri în echipa dvs. Dacă cineva aplică prin linkul dvs. de echipă (mynextdays.com/p/CODUL-DVS.?team=1) și introduce codul dvs. vizibil în aplicație, el va face parte din echipa dvs. după aprobare. Veți primi un comision de echipă din venitul net din abonament al clienților partenerilor dvs. de echipă.",
            },
            { type: "h2", text: "Die Regeln" },
            {
              type: "ul",
              items: [
                "Rata de echipă depinde de rangul DVS. la momentul plății – nu de mărimea echipei dvs. Ratele sunt disponibile pe pagina programului.",
                "Rangul dvs. este generat doar de clienții dvs. plătitori. Clienții de echipă nu contează pentru rang.",
                "Exact un nivel: partenerii dvs. de echipă nu își construiesc propria echipă sub dvs.",
                "Fără taxă de participare, fără bani pentru recrutarea unui partener. Comisionul de echipă provine exclusiv din veniturile din abonamente plătite.",
                "Douăsprezece luni de la prima factură plătită a clientului de echipă respectiv, fereastră de rambursare de 30 de zile, retragere în caz de rambursare sau chargeback – la fel ca în cazul propriului comision.",
                "Comisionul de echipă se generează doar dacă dumneavoastră și partenerul dumneavoastră de echipă sunteți aprobați; în caz contrar, acesta va fi suspendat.",
              ],
            },
            { type: "h2", text: "Evaluarea echipei" },
            {
              type: "p",
              text: "Sub „Echipă” veți vedea fiecare partener de echipă cu rangul, clienții plătitori, veniturile din abonamente ale clienților săi (pe 30 de zile și total) și comisionul dumneavoastră de echipă rezultat din acestea — deschis, plătibil, plătit — precum și istoricul ultimelor douăsprezece luni. Nu veți vedea detaliile clienților partenerilor dumneavoastră de echipă; acestea le aparțin.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Prin „Echipă” puteți contacta direct partenerii dumneavoastră de echipă prin mesaj — și sponsorul dumneavoastră pe dumneavoastră.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Același domeniu de e-mail sau aceleași detalii bancare între sponsor și partenerul de echipă vor fi marcate și verificate de echipa de parteneri înainte ca comisionul de echipă să fie plătit.",
            },
          ],
        },
        {
          slug: "auszahlung-und-steuern",
          title: "Plată, credit și taxe",
          excerpt: "Când devine plătibil comisionul, cum arată creditul și ce se aplică din punct de vedere fiscal.",
          updated: "Situația: septembrie 2026",
          body: [
            {
              type: "steps",
              items: [
                "O linie de comision se generează odată cu factura de abonament plătită și este „deschisă” timp de 30 de zile (fereastra de rambursare).",
                "După aceea, este plătibilă. La începutul lunii, grupăm toate liniile plătibile pe fiecare monedă.",
                "Dacă suma depășește suma minimă a monedei dumneavoastră, se generează o plată cu credit (autofacturare). Nu este necesar să emiteți o factură.",
                "După transfer, plata apare ca „Plătită” cu referință în tabloul de bord.",
              ],
            },
            {
              type: "ul",
              items: [
                "Companii: Creditul poartă mențiunea de taxare inversă; condiția prealabilă este un număr de TVA confirmat (verificare VIES).",
                "Persoane fizice: Creditul nu indică TVA; comisionul trebuie impozitat de dumneavoastră.",
                "Plată prin SEPA, Wise sau PayPal — introduceți datele în profil; modificările necesită parola dumneavoastră.",
                "Fără conversie: Comisionul în DKK va fi plătit în DKK, comisionul în EUR în EUR.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Publicitatea trebuie să fie identificabilă ca publicitate — la începutul postării, în limba postării. Formulele exacte aprobate pentru fiecare țară le găsiți sub „Linkuri și Materiale”. Încălcările pot duce la blocare.",
            },
          ],
        },
      ],
    },
  ],
};
