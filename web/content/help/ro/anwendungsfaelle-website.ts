import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Site web",
  description: "Folosiți-vă site-ul web în mod optim.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Site web",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Punerea live a site-ului dvs. web",
          excerpt: "Cum publicați propriul dvs. site web ca un canal de vânzare de sine stătător.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Site-ul dvs. web este un canal de vânzare propriu, alături de portaluri și de piață. Construiți paginile în editor, dar abia odată cu publicarea site-ul devine vizibil pentru oaspeți, iar obiectele dvs. apar acolo ca fiind rezervabile.",
            },
            {
              type: "steps",
              items: [
                "Deschideți editorul de site web și verificați dacă toate paginile dorite sunt completate cu conținut.",
                "Alegeți în fila Obiect, per obiect, dacă acesta trebuie să fie vizibil pe site-ul web — această vizibilitate este independentă de portaluri și de piață.",
                "Verificați previzualizarea în vizualizarea desktop și mobilă, înainte de a merge live.",
                "Apăsați pe „Publicare”, pentru a activa site-ul web pentru oaspeți.",
                "Verificați, după publicare, URL-ul public și testați o rezervare exemplu prin site-ul web.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vizibilitatea pe site-ul web a unui obiect este o axă proprie — un obiect poate fi activ pe portaluri, dar ascuns pe site-ul web, și invers. Detalii la [Configurarea unui domeniu propriu](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Configurarea unui domeniu propriu",
          excerpt: "Cum conectați propriul dvs. domeniu cu site-ul dvs. web myNextDays.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Un domeniu propriu, precum www.compania-dvs.ro, are un efect mai profesionist decât o adresă standard și vă întărește marca în fața oaspeților care doresc să rezerve direct la dvs.",
            },
            {
              type: "steps",
              items: [
                "Deschideți în editorul de site web secțiunea „Domeniu” și introduceți domeniul propriu dorit.",
                "Configurați la furnizorul domeniului dvs. înregistrările DNS afișate (de regulă CNAME sau A-Record).",
                "Așteptați până când domeniul este afișat ca fiind conectat, iar certificatul SSL ca activ — acest lucru poate dura câteva ore, în funcție de furnizor.",
                "Testați accesarea propriului domeniu într-o fereastră de browser privată, pentru a exclude intrări vechi stocate în cache.",
                "Verificați dacă adresele standard vechi continuă să redirecționeze către noul domeniu, pentru ca linkurile existente să nu rămână inactive.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Modificați înregistrările DNS doar conform indicațiilor afișate — valorile greșite pot perturba setările de e-mail existente ale domeniului dvs. Verificați, în caz de dubiu, cu furnizorul dvs. de domeniu, înainte de a suprascrie înregistrări existente.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Creșterea rezervărilor directe",
          excerpt: "Cum atrageți mai mulți oaspeți către propriul dvs. site web în locul portalurilor.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Rezervările prin propriul site web sunt de regulă mai avantajoase pentru compania dvs. decât prin portaluri, deoarece aici nu se aplică niciun comision de portal. Cu câteva măsuri țintite, creșteți ponderea rezervărilor directe prin site-ul dvs. web, ca un canal de sine stătător.",
            },
            {
              type: "steps",
              items: [
                "Asigurați-vă că toate obiectele rezervabile sunt vizibile pe site-ul web și dotate cu fotografii și descrieri actuale.",
                "Configurați o reducere sau un avantaj exclusiv pentru site-ul web, de exemplu o mică reducere de preț față de portaluri.",
                "Includeți linkul propriului dvs. domeniu în confirmările de rezervare și în comunicarea cu oaspeții care au rezervat deja o dată.",
                "Verificați regulat statistica de rezervări, pentru a urmări în timp ponderea site-ului web în toate rezervările.",
                "Optimizați timpul de încărcare și afișarea mobilă a site-ului web, întrucât majoritatea oaspeților rezervă de pe smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Un avantaj exclusiv pentru site-ul web funcționează doar dacă oaspeții găsesc deloc site-ul web — direcționați-i în mod activ către acesta, în loc să mizați doar pe portaluri. Pentru publicare vezi [Punerea live a site-ului dvs. web](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
