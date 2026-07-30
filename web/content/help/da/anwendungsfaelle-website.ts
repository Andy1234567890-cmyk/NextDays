import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Hjemmeside",
  description: "Få mest muligt ud af din hjemmeside.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Hjemmeside",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Gør din hjemmeside live",
          excerpt: "Sådan offentliggør du din egen hjemmeside som selvstændig salgskanal.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Din hjemmeside er en selvstændig salgskanal ved siden af portaler og Platform. Du opbygger siderne i editoren, men først når hjemmesiden offentliggøres, bliver den synlig for gæster, og dine boliger fremstår som bookbare der.",
            },
            {
              type: "steps",
              items: [
                "Åbn hjemmeside-editoren, og kontrollér, at alle ønskede sider er udfyldt med indhold.",
                "Vælg under boligens fane, om den skal være synlig på hjemmesiden — denne synlighed er uafhængig af portaler og Platform.",
                "Kontrollér forhåndsvisningen i både desktop- og mobilvisning, før du går live.",
                "Klik på »Offentliggør« for at frigive hjemmesiden for gæster.",
                "Kontrollér den offentlige URL efter offentliggørelsen, og test en eksempelbooking via hjemmesiden.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "En bolig hjemmeside-synlighed er en selvstændig akse — en bolig kan være aktiv på portaler, men skjult på hjemmesiden, og omvendt. Læs mere under [Opsæt et eget domæne](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Opsæt et eget domæne",
          excerpt: "Sådan forbinder du dit eget domæne med din myNextDays-hjemmeside.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Et eget domæne som www.din-virksomhed.dk virker mere professionelt end en standardadresse og styrker dit brand over for gæster, der ønsker at booke direkte hos dig.",
            },
            {
              type: "steps",
              items: [
                "Åbn afsnittet »Domæne« i hjemmeside-editoren, og indtast dit ønskede eget domæne.",
                "Opsæt de viste DNS-poster (som regel CNAME eller A-record) hos din domæneudbyder.",
                "Vent, til domænet vises som forbundet, og SSL-certifikatet vises som aktivt — det kan tage nogle timer afhængigt af udbyder.",
                "Test at åbne det egne domæne i et privat browservindue for at udelukke mellemlagrede gamle poster.",
                "Kontrollér, at gamle standardadresser fortsat viderestiller til det nye domæne, så eksisterende links ikke fejler.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ret kun DNS-poster som vist — forkerte værdier kan forstyrre dit domænes eksisterende e-mailopsætning. Kontakt i tvivlstilfælde din domæneudbyder, før du overskriver eksisterende poster.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Øg direkte bookinger",
          excerpt: "Sådan leder du flere gæster hen til din egen hjemmeside i stedet for portaler.",
          updated: "Opdateret: juli 2026",
          body: [
            {
              type: "h2",
              text: "Udgangspunkt",
            },
            {
              type: "p",
              text: "Bookinger via din egen hjemmeside er som regel billigere for din virksomhed end via portaler, da der her ikke er nogen portalprovision. Med et par målrettede tiltag øger du andelen af direkte bookinger via din hjemmeside som selvstændig kanal.",
            },
            {
              type: "steps",
              items: [
                "Sørg for, at alle bookbare boliger er synlige på hjemmesiden og forsynet med aktuelle billeder og beskrivelser.",
                "Opsæt en hjemmeside-eksklusiv rabat eller fordel, for eksempel en lille prisreduktion i forhold til portaler.",
                "Link til dit eget domæne i bookingbekræftelser og i kommunikationen med gæster, der allerede har booket én gang.",
                "Følg jævnligt bookingstatistikken for at se hjemmesidens andel af alle bookinger over tid.",
                "Optimér hjemmesidens indlæsningstid og mobilvisning, da størstedelen af gæsterne booker via smartphone.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "En hjemmeside-eksklusiv fordel virker kun, hvis gæsterne overhovedet finder hjemmesiden — henvis aktivt til den, i stedet for kun at satse på portaler. Om offentliggørelse, se [Gør din hjemmeside live](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};
