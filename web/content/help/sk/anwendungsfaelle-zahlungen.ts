import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Platby",
  description: "Správne spracovanie platieb.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Platby",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Nastavenie zálohy",
          excerpt: "Ako pri rezervácii vyžiadate len čiastočnú sumu namiesto celej sumy.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Namiesto okamžitého výberu celej sumy rezervácie môžete ako platobné pravidlo určiť zálohu. Hosť pri rezervácii zaplatí len časť sumy cez Stripe alebo PayPal, zvyšok neskôr prostredníctvom doplatku.",
            },
            {
              type: "steps",
              items: [
                "V objekte otvorte sekciu „Platobné pravidlá“.",
                "Vytvorte nové pravidlo typu „Záloha“.",
                "Určte sumu zálohy ako percentuálny podiel alebo pevnú sumu z celkovej sumy.",
                "Určte, kedy je záloha splatná, spravidla ihneď pri rezervácii.",
                "Uložte pravidlo a otestujte ho na skúšobnej rezervácii.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Záloha sa spracúva cez poskytovateľa platieb uloženého pri objekte. Vhodnú sumu k zostávajúcej čiastke nastavíte v [Automatizácia doplatku](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizácia doplatku",
          excerpt: "Ako sa otvorená zostávajúca suma automaticky vyberie pred príchodom.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Po zálohe zostáva otvorená zostávajúca suma. Namiesto manuálneho sledovania nastavíte platobné pravidlo, ktoré doplatok automaticky vyberie v pevnom termíne pred príchodom cez Stripe alebo PayPal.",
            },
            {
              type: "steps",
              items: [
                "V objekte otvorte sekciu „Platobné pravidlá“.",
                "Vytvorte nové pravidlo typu „Doplatok“, ak už existuje pravidlo zálohy.",
                "Určte, koľko dní pred príchodom je doplatok splatný.",
                "Aktivujte automatický výber, aby uložený poskytovateľ platieb sumu samostatne stiahol.",
                "Následne skontrolujte status doplatku v časovej osi príslušnej rezervácie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ak automatický výber zlyhá, napríklad kvôli exspirovanej karte, rezervácia sa automaticky nezruší. Nevydarené doplatky skontrolujte včas a kontaktujte hosťa priamo.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Vykonanie vrátenia platby",
          excerpt: "Ako hosťovi vrátite sumu úplne alebo čiastočne.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Pri storne alebo reklamácii môžete hosťovi vrátiť zaplatenú sumu úplne alebo čiastočne. Vrátenie platby prebieha cez rovnakého poskytovateľa platieb, cez ktorého sa pôvodne platilo — Stripe alebo PayPal.",
            },
            {
              type: "steps",
              items: [
                "Otvorte dotknutú rezerváciu v časovej osi rezervácie.",
                "V sekcii „Platby“ vyberte pôvodnú platbu, ktorá sa má vrátiť.",
                "Vyberte medzi úplným alebo čiastočným vrátením platby.",
                "Pri čiastočnom vrátení platby zadajte požadovanú sumu.",
                "Potvrďte vrátenie platby a skontrolujte aktualizovaný status platby v časovej osi.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vrátenie platby automaticky nemení nič na statuse rezervácie ani na obsadených nociach v kalendári. Pri storne dodatočne skontrolujte, či treba dotknuté noci v pláne obsadenosti znova uvoľniť.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Správa kaucie",
          excerpt: "Ako nastavíte kauciu a po pobyte ju znova uvoľníte.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Kaucia vás chráni pred škodami počas pobytu. Ukladá sa ako vlastné platobné pravidlo a cez Stripe alebo PayPal sa buď vopred autorizuje, alebo vyberie, v závislosti od konfigurácie objektu.",
            },
            {
              type: "steps",
              items: [
                "V objekte otvorte sekciu „Platobné pravidlá“ a vytvorte pravidlo typu „Kaucia“.",
                "Určte sumu kaucie a čas autorizácie, spravidla krátko pred príchodom.",
                "Po check-oute skontrolujte stav objektu.",
                "Pri bezchybnom stave kauciu cez rezerváciu úplne uvoľnite.",
                "Pri škode vráťte len nepotrebnú časť a zdokumentujte dôvod zadržania.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autorizovaná, ale nevybraná kaucia podľa poskytovateľa platieb po určitej lehote automaticky prepadne. Kauciu uvoľnite čo najskôr po check-oute alebo potrebnú sumu vyberte včas.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Oprava faktúry",
          excerpt: "Ako dodatočne opravíte už vystavenú faktúru.",
          updated: "Aktualizované: júl 2026",
          body: [
            {
              type: "h2",
              text: "Východisková situácia",
            },
            {
              type: "p",
              text: "Ak už vystavená faktúra obsahuje chybu, napríklad vo fakturačnej adrese alebo položke, opravíte ju cez rezerváciu, namiesto jednoduchého vymazania pôvodnej faktúry.",
            },
            {
              type: "steps",
              items: [
                "Otvorte dotknutú rezerváciu v časovej osi rezervácie a prepnite na sekciu „Faktúry“.",
                "Vyberte chybnú faktúru.",
                "Vytvorte opravu, resp. dobropis k pôvodnej faktúre.",
                "Následne vytvorte novú, opravenú faktúru so správnymi údajmi.",
                "Opravenú faktúru znova odošlite hosťovi, resp. na fakturačnú adresu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Už odoslaná faktúra by sa z dôvodu sledovateľnosti nemala priamo prepisovať. Oprava cez dobropis zachováva pôvodný doklad a robí zmenu sledovateľnou.",
            },
          ],
        },
      ],
    },
  ],
};
