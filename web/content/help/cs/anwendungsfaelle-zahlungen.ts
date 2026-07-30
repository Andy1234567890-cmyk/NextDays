import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Platby",
  description: "Správné zpracování plateb.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Platby",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Nastavení zálohy",
          excerpt: "Jak při rezervaci vyžadovat jen část částky místo celé sumy.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Místo okamžitého výběru celé částky rezervace můžete jako platební pravidlo nastavit zálohu. Host při rezervaci zaplatí přes Stripe nebo PayPal jen část částky, zbytek později formou doplatku.",
            },
            {
              type: "steps",
              items: [
                "V objektu otevřete sekci „Platební pravidla“.",
                "Vytvořte nové pravidlo typu „Záloha“.",
                "Určete výši zálohy jako procento nebo pevnou částku z celkové sumy.",
                "Určete, kdy je záloha splatná, zpravidla ihned při rezervaci.",
                "Uložte pravidlo a otestujte ho na zkušební rezervaci.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Záloha se zpracovává přes poskytovatele plateb uloženého u objektu. Odpovídající částku ke zbývající sumě nastavíte v článku [Automatizace doplatku](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Automatizace doplatku",
          excerpt: "Jak se otevřená zbývající částka automaticky vybere před příjezdem.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Po záloze zůstává otevřená zbývající částka. Místo ručního sledování nastavíte platební pravidlo, které doplatek automaticky vybere v pevně stanoveném termínu před příjezdem přes Stripe nebo PayPal.",
            },
            {
              type: "steps",
              items: [
                "V objektu otevřete sekci „Platební pravidla“.",
                "Vytvořte nové pravidlo typu „Doplatek“, pokud již existuje pravidlo zálohy.",
                "Určete, kolik dní před příjezdem je doplatek splatný.",
                "Aktivujte automatický výběr, aby uložený poskytovatel plateb částku samostatně strhl.",
                "Poté zkontrolujte stav doplatku v časové ose příslušné rezervace.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Pokud automatický výběr selže, například kvůli propadlé kartě, rezervace se automaticky nezruší. Nezdařené doplatky kontrolujte včas a kontaktujte hosta přímo.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Provedení vrácení peněz",
          excerpt: "Jak hostovi vrátíte částku zcela nebo částečně.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Při stornu nebo reklamaci můžete hostovi vrátit zaplacenou částku zcela nebo částečně. Vrácení peněz probíhá přes stejného poskytovatele plateb, přes kterého bylo původně placeno — Stripe nebo PayPal.",
            },
            {
              type: "steps",
              items: [
                "Otevřete danou rezervaci v časové ose rezervace.",
                "V sekci „Platby“ vyberte původní platbu, která se má vrátit.",
                "Vyberte mezi úplným nebo částečným vrácením peněz.",
                "Při částečném vrácení peněz zadejte požadovanou částku.",
                "Potvrďte vrácení peněz a zkontrolujte aktualizovaný stav platby v časové ose.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vrácení peněz automaticky nemění stav rezervace ani obsazené noci v kalendáři. Při stornu navíc zkontrolujte, zda je třeba dotčené noci v obsazenostním kalendáři znovu uvolnit.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Správa kauce",
          excerpt: "Jak nastavit kauci a po pobytu ji opět uvolnit.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Kauce vás chrání proti škodám během pobytu. Ukládá se jako samostatné platební pravidlo a přes Stripe nebo PayPal se buď předem autorizuje, nebo vybere, v závislosti na konfiguraci objektu.",
            },
            {
              type: "steps",
              items: [
                "V objektu otevřete sekci „Platební pravidla“ a vytvořte pravidlo typu „Kauce“.",
                "Určete výši kauce a okamžik autorizace, obvykle krátce před příjezdem.",
                "Po check-outu zkontrolujte stav objektu.",
                "Při bezvadném stavu kauci přes rezervaci zcela uvolněte.",
                "Při škodě vraťte jen nepotřebnou část a zdokumentujte důvod zadržení.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Autorizovaná, ale nevybraná kauce podle poskytovatele plateb po určité lhůtě automaticky propadne. Uvolněte kauci co nejdříve po check-outu, nebo potřebnou částku včas vyberte.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Oprava faktury",
          excerpt: "Jak dodatečně opravíte již vystavenou fakturu.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            {
              type: "h2",
              text: "Výchozí situace",
            },
            {
              type: "p",
              text: "Obsahuje-li již vystavená faktura chybu, například ve fakturační adrese nebo v položce, opravte ji přes rezervaci, místo abyste původní fakturu jednoduše smazali.",
            },
            {
              type: "steps",
              items: [
                "Otevřete danou rezervaci v časové ose rezervace a přepněte se do sekce „Faktury“.",
                "Vyberte chybnou fakturu.",
                "Vytvořte opravu, resp. dobropis k původní faktuře.",
                "Poté vytvořte novou, opravenou fakturu se správnými údaji.",
                "Opravenou fakturu znovu odešlete hostovi, resp. na fakturační adresu.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Již odeslaná faktura by se z důvodu sledovatelnosti neměla přímo přepisovat. Oprava pomocí dobropisu zachovává původní doklad a zůstává tak sledovatelná.",
            },
          ],
        },
      ],
    },
  ],
};
