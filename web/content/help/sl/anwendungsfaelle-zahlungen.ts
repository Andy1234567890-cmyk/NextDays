import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Plačila",
  description: "Pravilna obdelava plačil.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Plačila",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Nastavitev akontacije",
          excerpt: "Tako ob rezervaciji zahtevate le delni znesek namesto celotnega zneska.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Namesto da bi takoj obračunali celoten znesek rezervacije, lahko kot pravilo plačila določite akontacijo. Gost ob rezervaciji plača le delni znesek prek Stripe ali PayPal, preostanek pa pozneje z doplačilom.",
            },
            {
              type: "steps",
              items: [
                "V objektu odprite razdelek »Pravila plačila«.",
                "Ustvarite novo pravilo tipa »Akontacija«.",
                "Določite znesek akontacije kot odstotek ali fiksni znesek celotne vsote.",
                "Določite, kdaj zapade akontacija, običajno takoj ob rezervaciji.",
                "Shranite pravilo in ga preverite na testni rezervaciji.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Akontacija se obdela prek ponudnika plačil, nastavljenega pri objektu. Ustrezen znesek za preostanek nastavite pod [Avtomatizacija doplačila](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Avtomatizacija doplačila",
          excerpt: "Tako se odprti preostali znesek samodejno obračuna pred prihodom.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Po akontaciji ostane odprt preostali znesek. Namesto da ga ročno spremljate, nastavite pravilo plačila, ki doplačilo samodejno obračuna ob določenem času pred prihodom prek Stripe ali PayPal.",
            },
            {
              type: "steps",
              items: [
                "V objektu odprite razdelek »Pravila plačila«.",
                "Ustvarite novo pravilo tipa »Doplačilo«, če že obstaja pravilo za akontacijo.",
                "Določite, koliko dni pred prihodom zapade doplačilo.",
                "Aktivirajte samodejno bremenitev, da nastavljeni ponudnik plačil znesek obračuna samostojno.",
                "Nato preverite stanje doplačila v časovnici rezervacije zadevne rezervacije.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Če samodejna bremenitev ne uspe, na primer zaradi pretečene kartice, rezervacija ne bo samodejno odpovedana. Neuspela doplačila pravočasno preverite in gosta kontaktirajte neposredno.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Izvedba vračila",
          excerpt: "Tako gostu v celoti ali delno vrnete plačan znesek.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Ob odpovedi ali reklamaciji lahko gostu plačan znesek vrnete v celoti ali delno. Vračilo poteka prek istega ponudnika plačil, prek katerega je bilo prvotno plačano — Stripe ali PayPal.",
            },
            {
              type: "steps",
              items: [
                "Odprite zadevno rezervacijo v časovnici rezervacije.",
                "V razdelku »Plačila« izberite prvotno plačilo, ki naj se vrne.",
                "Izberite med popolnim ali delnim vračilom.",
                "Pri delnem vračilu vnesite želeni znesek.",
                "Potrdite vračilo in preverite posodobljen status plačila v časovnici.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Vračilo samodejno ne spremeni statusa rezervacije niti zasedenih koledarskih noči. Pri odpovedi dodatno preverite, ali je treba zadevne noči v koledarju zasedenosti ponovno sprostiti.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Upravljanje varščine",
          excerpt: "Tako nastavite varščino in jo po bivanju ponovno sprostite.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Varščina vas ščiti pred škodo med bivanjem. Nastavi se kot lastno pravilo plačila in se prek Stripe ali PayPal, odvisno od konfiguracije objekta, bodisi predhodno avtorizira bodisi obračuna.",
            },
            {
              type: "steps",
              items: [
                "V objektu odprite razdelek »Pravila plačila« in ustvarite pravilo tipa »Varščina«.",
                "Določite znesek varščine in trenutek avtorizacije, običajno malo pred prihodom.",
                "Po odjavi preverite stanje objekta.",
                "Če je stanje brezhibno, varščino prek rezervacije v celoti sprostite.",
                "Pri škodi vrnite le nepotrebni del in dokumentirajte razlog za zadržanje.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Avtorizirana, a neobračunana varščina glede na ponudnika plačil po določenem roku samodejno preneha veljati. Varščino sprostite pravočasno po odjavi ali pravočasno obračunajte potrebni znesek.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Popravek računa",
          excerpt: "Tako naknadno popravite že izdan račun.",
          updated: "Posodobljeno: julij 2026",
          body: [
            {
              type: "h2",
              text: "Izhodišče",
            },
            {
              type: "p",
              text: "Če že izdan račun vsebuje napako, na primer pri naslovu za izstavitev računa ali pri postavki, ga popravite prek rezervacije, namesto da bi prvotni račun preprosto izbrisali.",
            },
            {
              type: "steps",
              items: [
                "Odprite zadevno rezervacijo v časovnici rezervacije in preklopite na razdelek »Računi«.",
                "Izberite napačen račun.",
                "Ustvarite popravek oz. stornirani račun k prvotnemu računu.",
                "Nato ustvarite nov, popravljen račun s pravilnimi podatki.",
                "Popravljen račun znova pošljite gostu oz. na naslov za izstavitev računa.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Že poslanega računa zaradi sledljivosti ne smete neposredno prepisati. Popravek prek storniranega računa ohrani prvotno listino in naredi spremembo sledljivo.",
            },
          ],
        },
      ],
    },
  ],
};
