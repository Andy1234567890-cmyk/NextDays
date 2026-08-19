import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Omistajaselvitykset",
  description: "Omistajaselvitysten luominen.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Omistajaselvitykset",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Omistajan Statementin luominen",
          excerpt: "Näin luot omistajalle selkeän tilityksen hänen ajanjaksoltaan.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Jos hallinnoit kohteita omistajille, he tarvitsevat säännöllisesti jäljitettävän yleiskatsauksen tuloista, vähennetystä provisiosta ja kohteidensa tilityksestä tietylle ajanjaksolle — omistajan Statement kokoaa nämä tiedot automaattisesti.",
            },
            {
              type: "steps",
              items: [
                "Avaa tilissä osio Omistajat ja valitse kyseinen omistaja.",
                "Valitse ajanjakso, jolle Statement luodaan.",
                "Tarkista, että kaikki tämän omistajan kohteet on kohdistettu oikein, sillä vain kohdistetut kohteet sisältyvät Statementiin.",
                "Anna luoda Statement ja tarkista listattujen varausten täydellisyys.",
                "Toimita Statement omistajalle omistajan käyttöoikeuden kautta tai vie se dokumenttina.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Statement näyttää jokaisen varauksen summan kyseisen kohteen valuutassa — yleistä valuuttamerkintää ei ole, koska useilla kohteilla voi olla myös eri valuutat. Lisää kohdistuksesta kohdassa [Kohteen kohdistaminen omistajalle](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Provision tilittäminen omistajan kanssa",
          excerpt: "Näin varmistat, että provisiosi lasketaan oikein omistajan tuloista.",
          updated: "Päivitetty: heinäkuu 2026",
          body: [
            {
              type: "h2",
              text: "Lähtötilanne",
            },
            {
              type: "p",
              text: "Provisiosi kohteen hallinnoinnista on tallennettu omistajan hinnastoon, ja se vähennetään automaattisesti bruttotuloista jokaisessa Statementissa. Jotta tilitys täsmää, provisioprosentin on oltava oikein asetettuna ennen ajanjakson ensimmäistä varausta.",
            },
            {
              type: "steps",
              items: [
                "Avaa tilissä kyseisen omistajan hinnasto ja tarkista tallennettu provisioprosentti.",
                "Säädä prosenttia tarvittaessa ennen kuin uusia varauksia tulee tulevalle tilityskaudelle.",
                "Luo omistajan Statement kyseiselle ajanjaksolle ja tarkista, että provisio ilmoitetaan oikein jokaiselle varaukselle.",
                "Tarkista bruttotulojen, vähennetyn provision ja nettotilityksen summan looginen johdonmukaisuus.",
                "Selvitä poikkeamat suoraan omistajan kanssa ennen Statementin hyväksymistä sen sijaan, että muuttaisit Statementia jälkikäteen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Provisioprosentin jälkikäteinen muutos vaikuttaa vain tuleviin ajanjaksoihin, ei taannehtivasti jo luotuihin Statementeihin. Tarkista prosentti siis ajoissa ennen uuden tilityskauden alkua — katso myös [Omistajan tilitys (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};
