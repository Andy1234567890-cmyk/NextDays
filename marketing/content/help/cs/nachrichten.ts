import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Zprávy a hosté",
  description: "Doručená pošta, šablony a komunikace s hosty.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Komunikace",
      articles: [
        {
          slug: "posteingang",
          title: "Posteingang platformy",
          excerpt: "Všechny zprávy hostů vašich objektů se scházejí centrálně v posteingangu platformy.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Jedna doručená pošta pro všechny objekty" },
            {
              type: "p",
              text: "Posteingang platformy sdružuje všechny zprávy vašich hostů na jednom místě — bez ohledu na to, přes který objekt nebo za jaké období konverzace probíhá. Otevřete jej na /nachrichten a každou konverzaci uvidíte jako samostatné vlákno.",
            },
            { type: "h2", text: "Uspořádání doručené pošty" },
            {
              type: "ul",
              items: [
                "Levý sloupec: seznam všech konverzací, nejnovější první",
                "Prostřední sloupec: aktivní historie zpráv s hostem",
                "Pravý sloupec: kontext k rezervaci — období, objekt, údaje o hostovi",
              ],
            },
            { type: "h2", text: "Odpověď na zprávu" },
            {
              type: "steps",
              items: [
                "Otevřete /nachrichten a vyberte požadovanou konverzaci",
                "Napište odpověď do textového pole nebo použijte rychlou odpověď",
                "Odešlete zprávu — host ji obdrží stejnou cestou, kterou napsal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Posteingang platformy zobrazuje výhradně přímou komunikaci mezi vámi a vašimi hosty na myNextDays — zprávy z portálů nadále zpracováváte tam.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Rychlé odpovědi",
          excerpt: "Šablony pro časté otázky šetří čas při komunikaci s hosty.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Co jsou rychlé odpovědi" },
            {
              type: "p",
              text: "Rychlé odpovědi jsou předem naformulované textové bloky pro opakující se otázky — například k příjezdu, heslu k Wi-Fi nebo parkování. Místo psaní každé odpovědi znovu vložíte vhodnou šablonu jedním kliknutím do [posteingangu platformy](/hilfe/nachrichten/posteingang).",
            },
            { type: "h2", text: "Vytvoření rychlé odpovědi" },
            {
              type: "steps",
              items: [
                "Otevřete /nachrichten a klikněte na „Spravovat rychlé odpovědi“",
                "Klikněte na „Nová šablona“ a zadejte název, například „Informace k check-inu“",
                "Napište text odpovědi; zástupné symboly jako jméno hosta nebo datum příjezdu se při odeslání automaticky doplní",
                "Uložte šablonu — od nynějška je dostupná v každé konverzaci",
              ],
            },
            { type: "h2", text: "Používání rychlých odpovědí v praxi" },
            {
              type: "p",
              text: "V okně zpráv otevřete seznam šablon přes ikonu blesku, vyberete vhodnou odpověď a v případě potřeby ji ještě individuálně upravíte, než ji odešlete.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vytvořte šablony pro nejčastějších pět až deset otázek — to v praxi pokryje většinu příchozích zpráv.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatické zprávy",
          excerpt: "Potvrzení, informace k check-inu a upomínky lze hostům odesílat automaticky.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Automatizace opakujících se zpráv" },
            {
              type: "p",
              text: "Místo ručního odesílání potvrzení rezervace, pokynů k check-inu nebo poděkování je jednou uložíte jako pravidlo — myNextDays je pak automaticky odešle ve vhodný okamžik před pobytem, během něj nebo po něm.",
            },
            { type: "h2", text: "Typické spouštěče automatických zpráv" },
            {
              type: "ul",
              items: [
                "Ihned po rezervaci — potvrzení s nejdůležitějšími údaji",
                "Několik dní před příjezdem — informace k check-inu a přístupový kód",
                "V den odjezdu — poděkování a žádost o recenzi",
              ],
            },
            { type: "h2", text: "Nastavení automatické zprávy" },
            {
              type: "steps",
              items: [
                "Otevřete /nachrichten, sekci „Automatické zprávy“",
                "Vyberte spouštěč, například „X dní před příjezdem“",
                "Uložte text — zástupné symboly jako jméno hosta, objekt nebo datum příjezdu se doplní automaticky",
                "Aktivujte pravidlo; platí pro všechny objekty, pokud není jinak omezeno",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatické zprávy se běžně zobrazují v [posteingangu platformy](/hilfe/nachrichten/posteingang) a lze je tam kdykoli dodatečně dohledat.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Blokování zpráv",
          excerpt: "Osobu můžete pro další kontakt zablokovat přímo z historie zpráv.",
          updated: "Aktualizováno: červenec 2026",
          body: [
            { type: "h2", text: "Kdy je blokace vhodná" },
            {
              type: "p",
              text: "Při urážlivých zprávách, obtěžování nebo opakovaně nevhodném chování můžete osobu zablokovat přímo z vlákna zpráv. Zablokovaná osoba vám poté nemůže psát nové zprávy ani u vás vytvářet nové rezervace.",
            },
            { type: "h2", text: "Blokování osoby z vlákna" },
            {
              type: "steps",
              items: [
                "Otevřete dotčenou konverzaci v [posteingangu platformy](/hilfe/nachrichten/posteingang)",
                "Klikněte nahoře ve vlákně na menu a vyberte „Zablokovat osobu“",
                "Potvrďte postup — blokace platí okamžitě",
              ],
            },
            { type: "h2", text: "Co blokace znamená — a co ne" },
            {
              type: "ul",
              items: [
                "Nové zprávy zablokované osoby se již nedoručují",
                "Nové poptávky na rezervaci od dané osoby se odmítají",
                "Probíhá-li aktuálně rezervace této osoby, komunikace po dobu pobytu výjimečně zůstává možná",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Blokaci lze kdykoli zrušit v přehledu „Blokované osoby“ v účtu. Před blokováním zkontrolujte, zda již neexistuje probíhající rezervace.",
            },
          ],
        },
      ],
    },
  ],
};
