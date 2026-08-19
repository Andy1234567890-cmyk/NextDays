import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Plăți și facturi",
  description: "Furnizori de plăți, reguli de plată și facturi.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Plăți",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Conectarea unui furnizor de plăți",
          excerpt:
            "Cum conectați Stripe sau PayPal cu myNextDays, pentru a procesa automat plățile.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Furnizori disponibili" },
            {
              type: "p",
              text: "myNextDays procesează plățile prin furnizori de plăți conectați. În prezent sunt acceptați Stripe și PayPal — puteți conecta unul sau ambii furnizori simultan și îi puteți folosi în funcție de obiect sau de preferința oaspetelui.",
            },
            {
              type: "steps",
              items: [
                "Deschideți Cont și treceți la secțiunea „Plăți”.",
                "Alegeți furnizorul dorit — Stripe sau PayPal.",
                "Urmați dialogul de conectare și autentificați-vă la furnizor sau creați un cont nou.",
                "Confirmați conexiunea — statusul trece pe „conectat”.",
              ],
            },
            { type: "h2", text: "Ce se întâmplă apoi" },
            {
              type: "p",
              text: "De îndată ce un furnizor este conectat, puteți trimite linkuri de plată, încasa avansuri și declanșa rambursări direct din rezervare. Toate sumele sunt procesate în moneda înregistrată pentru obiectul respectiv.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără un furnizor conectat, puteți marca plățile doar manual ca fiind primite — o încasare automată nu este posibilă în acest caz.",
            },
            { type: "h2", text: "Mai multe obiecte, un furnizor" },
            {
              type: "p",
              text: "O conexiune stabilită o dată se aplică la nivel de cont, pentru toate obiectele dvs. Cum se desfășoară în detaliu încasarea, stabiliți prin [Reguli de plată](/hilfe/zahlungen/zahlungsregeln). Plățile către dvs. se realizează ulterior prin furnizorul respectiv, vezi [Transferuri](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe este potrivit pentru plăți cu cardul și multe metode de plată locale",
                "PayPal oferă oaspeților o alternativă familiară",
                "Ambii furnizori pot fi deconectați și reconectați independent unul de celălalt",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Reguli de plată",
          excerpt: "Stabiliți când devine scadentă avansul și plata finală a unei rezervări.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Avans și plată finală" },
            {
              type: "p",
              text: "Regulile de plată stabilesc cum este procesată financiar o rezervare — de exemplu un avans la rezervare și o plată finală înainte de sosire, sau plata integrală imediat. Regulile se aplică per obiect și pot fi ajustate oricând.",
            },
            {
              type: "steps",
              items: [
                "Deschideți obiectul și treceți la secțiunea „Reguli de plată”.",
                "Alegeți dacă se percepe un avans și stabiliți procentul.",
                "Determinați când devine scadentă plata finală, de exemplu cu un anumit număr de zile înainte de sosire.",
                "Salvați setările.",
              ],
            },
            { type: "h2", text: "Încasare automată" },
            {
              type: "p",
              text: "Dacă este conectat un furnizor de plăți, myNextDays încasează automat avansul și plata finală la momentul stabilit și informează oaspetele în prealabil, printr-un mesaj.",
            },
            {
              type: "note",
              variant: "info",
              text: "Regulile de plată se aplică doar rezervărilor cu furnizor de plăți conectat. Fără furnizor, marcați plățile manual, în rezervare.",
            },
            { type: "h2", text: "Diferențe în funcție de canal" },
            {
              type: "p",
              text: "Pe portaluri se poate aplica, în mod diferit, procesarea proprie a plăților a acestora — verificați în acest caz condițiile portalului respectiv. Pentru rezervările prin propria platformă sau site web se aplică întotdeauna regulile dvs. înregistrate aici. Detalii despre conectarea furnizorului găsiți la [Conectarea unui furnizor de plăți](/hilfe/zahlungen/zahlungsanbieter-verbinden), despre emiterea facturilor la [Crearea facturilor](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Avans posibil ca sumă fixă sau procentaj",
                "Termenul plății finale poate fi ales liber",
                "Modificările se aplică doar rezervărilor noi, nu retroactiv",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Crearea facturilor",
          excerpt: "Cum creați o factură pentru o rezervare, cu adresa de facturare corectă.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Adăugarea unei facturi" },
            {
              type: "p",
              text: "Pentru fiecare rezervare se poate crea o factură — pentru oaspetele însuși sau pentru o companie diferită, dacă rezervarea are loc în scop de afaceri.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea în Rezervări.",
                "Alegeți „Creare factură”.",
                "Verificați sau completați adresa de facturare.",
                "Verificați pozițiile menționate — cazare, add-on-uri, taxe.",
                "Creați factura și trimiteți-o oaspetelui.",
              ],
            },
            { type: "h2", text: "Gestionarea adresei de facturare" },
            {
              type: "p",
              text: "Adresa de facturare o puteți înregistra direct în rezervare sau o puteți solicita ulterior de la oaspete, prin confirmarea rezervării. Fără o adresă completă, în anumite țări nu se poate emite o factură valabilă din punct de vedere legal.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Verificați la clienții de afaceri în special numele companiei și adresa — corecturile ulterioare necesită o factură de corecție.",
            },
            { type: "h2", text: "Sume și monedă" },
            {
              type: "p",
              text: "Toate pozițiile sunt exprimate în moneda înregistrată pentru obiect. Plățile deja efectuate sunt marcate pe factură ca încasare. Cum se compun avansul și plata finală, citiți la [Reguli de plată](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Facturile pot fi descărcate ca PDF",
                "Facturile de corecție sunt posibile oricând, în caz de modificări",
                "Add-on-urile apar ca poziție separată",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Rambursări",
          excerpt:
            "Cum rambursați integral sau parțial o plată, atunci când o rezervare este anulată sau modificată.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Când este necesară o rambursare" },
            {
              type: "p",
              text: "O rambursare este necesară de regulă în cazul unei anulări, dar poate fi necesară și în cazul unei ajustări ulterioare de preț sau al unui add-on anulat.",
            },
            {
              type: "steps",
              items: [
                "Deschideți rezervarea afectată în Rezervări.",
                "Alegeți „Rambursare” în secțiunea de plăți a rezervării.",
                "Introduceți suma de rambursat — integral sau parțial.",
                "Confirmați rambursarea.",
              ],
            },
            { type: "h2", text: "Procesul prin furnizorul de plăți" },
            {
              type: "p",
              text: "Rambursarea este executată prin furnizorul folosit la plată — Stripe sau PayPal — și transferată direct înapoi către mijlocul de plată original al oaspetelui. Procesul este înregistrat automat în linia de timp a rezervării.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Fără un furnizor de plăți conectat, o rambursare nu poate fi declanșată automat — clarificați rambursarea în acest caz direct cu oaspetele.",
            },
            { type: "h2", text: "Efect asupra comisioanelor" },
            {
              type: "p",
              text: "Comisioanele de piață sau de portal deja facturate sunt ajustate proporțional la o rambursare. Mai multe despre acest lucru la [Înțelegerea comisioanelor](/hilfe/zahlungen/provisionen-verstehen). Detalii despre anularea în sine găsiți la [Anulare și rambursare](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Rambursările parțiale sunt posibile pentru poziții individuale",
                "Statusul de procesare este vizibil oricând în rezervare",
                "Rambursările se realizează exclusiv prin furnizorul folosit inițial",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Transferuri",
          excerpt:
            "Cum primiți veniturile din rezervările dvs. transferate de la furnizorii de plăți conectați.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Cum funcționează transferurile" },
            {
              type: "p",
              text: "Plățile primite se acumulează mai întâi la furnizorul de plăți conectat. De acolo se face transferul către contul dvs. bancar înregistrat, conform ritmului obișnuit al furnizorului respectiv.",
            },
            {
              type: "steps",
              items: [
                "Deschideți Cont și treceți la secțiunea „Plăți”.",
                "Verificați la „Transferuri” statusul furnizorului respectiv.",
                "Deschideți, dacă este necesar, vizualizarea detaliată a furnizorului, pentru istoricul complet al transferurilor.",
              ],
            },
            { type: "h2", text: "Ce se scade înainte de transfer" },
            {
              type: "p",
              text: "Înainte de transfer se iau în calcul comisioanele de piață și de portal aplicabile, precum și taxele furnizorului. Suma transferată nu corespunde, prin urmare, neapărat sumei inițiale a rezervării.",
            },
            {
              type: "note",
              variant: "info",
              text: "Structura exactă a deducerilor este explicată la [Înțelegerea comisioanelor](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Mai multe obiecte și proprietari" },
            {
              type: "p",
              text: "Dacă administrați obiecte pentru diferiți proprietari, transferurile sunt alocate în funcție de decontările de proprietar înregistrate. Verificați, în caz de neconcordanțe, mai întâi statusul rezervărilor de bază în Rezervări.",
            },
            {
              type: "ul",
              items: [
                "Ritmul și metoda de transfer sunt stabilite de furnizorul respectiv",
                "Sumele reținute, de exemplu în cazul unor rambursări în curs, sunt marcate",
                "Istoricul complet este disponibil direct la furnizor pentru consultare",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Înțelegerea comisioanelor",
          excerpt:
            "O prezentare a modului în care se compun comisioanele de piață și de portal și unde sunt decontate.",
          updated: "Actualizat: iulie 2026",
          body: [
            { type: "h2", text: "Două tipuri de comisioane" },
            {
              type: "p",
              text: "La rezervările prin myNextDays pot apărea două comisioane diferite: comisionul de piață pentru rezervările prin propria platformă și comisioanele de portal pentru rezervările primite prin portaluri conectate, precum Booking sau Airbnb. Ambele sunt independente unul de celălalt și pot varia în funcție de canalul de vânzare al unei rezervări.",
            },
            {
              type: "ul",
              items: [
                "Comision de piață: se aplică la rezervările prin platforma myBestDays",
                "Comision de portal: este calculat de portalul respectiv, conform propriilor condiții",
                "Rezervările directe prin propriul dvs. site web trebuie privite independent de acestea",
              ],
            },
            { type: "h2", text: "Unde sunt vizibile comisioanele" },
            {
              type: "steps",
              items: [
                "Deschideți Cont și treceți la secțiunea „Facturare”.",
                "Alegeți luna dorită.",
                "Verificați situația per rezervare, cu comisionul aferent.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prin ce canal a intrat o rezervare vedeți direct la rezervarea respectivă — asta explică ce comision a fost aplicat.",
            },
            { type: "h2", text: "Legătura cu transferurile" },
            {
              type: "p",
              text: "Comisioanele sunt scăzute din suma rezervării înainte de transfer. Detalii despre procesul de transfer găsiți la [Transferuri](/hilfe/zahlungen/auszahlungen). La o rambursare, comisionul aferent este corectat proporțional — desfășurarea completă a unei rezervări este arătată de [Linia de timp a rezervării](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};
