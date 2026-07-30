import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "App Mobbli",
  description: "L-app ta' myNextDays għal meta tkun barra.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "L-App ta' myNextDays",
          excerpt: "Kont wieħed, erba' esperjenzi: Mistieden, Aġenzija, Sid u Impjegat.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-app ta' myNextDays hija l-pjattaforma mobbli għan-negozju kollu tiegħek. Mhijiex prodott separat, imma front-end ekwivalenti għad-dashboard tal-web tiegħek — it-tnejn jaċċessaw l-istess kont u l-istess dejta, biss l-interfaċċja hija ottimizzata għal meta tkun barra.",
            },
            { type: "h2", text: "Erba' esperjenzi f'app waħda" },
            {
              type: "ul",
              items: [
                "Mistieden: ara l-prenotazzjonijiet, ikkomunika man-negozju, aċċessa l-informazzjoni tal-check-in.",
                "Aġenzija: immaniġġja diversi negozji u proprjetajiet f'ħarsa ġenerali.",
                "Sid: aċċess read-only lill-proprjetajiet tiegħu stess, l-okkupazzjoni u r-rapporti.",
                "Impjegat: kalendarju, kompiti u pjani tat-tindif għall-ħidma ta' kuljum.",
              ],
            },
            { type: "h2", text: "Liema esperjenza tara" },
            {
              type: "p",
              text: "Wara d-dħul, l-app turi awtomatikament l-esperjenza xierqa għar-rwol tiegħek — l-istess rwol li japplika wkoll fid-dashboard tal-web. Impjegat b'drittijiet limitati jara fl-app eżattament l-istess limitazzjonijiet bħal fil-brawżer, peress li l-permessi jiġu vverifikati fuq in-naħa tas-server.",
            },
            {
              type: "note",
              variant: "info",
              text: "Aktar dettalji dwar ir-rwoli u x'jistgħu jaraw ssibhom taħt [Rwoli u Permessi](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "M'għandekx bżonn reġistrazzjoni separata għall-app — sempliċement idħol bid-dettalji tal-aċċess eżistenti tiegħek ta' myNextDays.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "Installa l-App u Idħol",
          excerpt: "Hekk tniżżel l-app ta' myNextDays u tidħol.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-app ta' myNextDays hija disponibbli għal iOS u Android. Id-dħul isir bl-istess dettalji ta' aċċess bħad-dashboard tal-web — mhux meħtieġ kont separat u lanqas reġistrazzjoni ġdida.",
            },
            { type: "h2", text: "Installazzjoni" },
            {
              type: "steps",
              items: [
                "Iftaħ l-App Store (iOS) jew Google Play (Android).",
                "Fittex “myNextDays”.",
                "Installa l-app fuq il-mobile jew it-tablet tiegħek.",
                "Iftaħ l-app wara l-installazzjoni.",
              ],
            },
            { type: "h2", text: "Dħul" },
            {
              type: "steps",
              items: [
                "Agħfas “Idħol”.",
                "Daħħal l-indirizz tal-email u l-password tiegħek.",
                "Ikkonferma l-mistoqsija tal-2FA jekk applikabbli.",
                "Tidħol awtomatikament fl-esperjenza xierqa għar-rwol tiegħek.",
              ],
            },
            {
              type: "ul",
              items: [
                "Id-dettalji ta' aċċess huma identiċi mad-dashboard tal-web.",
                "Jekk l-aċċess tiegħek jitneħħa, id-dħul fl-app jiġi mblukkat ukoll minnufih.",
                "F'każ ta' problemi bil-password, uża “Insejt il-Password” direttament fl-app.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Idħol esklussivament permezz tal-entrata uffiċjali tal-App Store “myNextDays”; l-app qatt ma titlob dettalji ta' aċċess barra mill-iskrin tad-dħul.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Immaniġġja Meta Tkun Barra",
          excerpt: "Ipproċessa prenotazzjonijiet, messaġġi u kompiti direttament mill-mobile.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "L-app ta' myNextDays hija adattata b'mod partikolari għat-tmexxija kurrenti meta tkun barra: tara l-prenotazzjonijiet attwali, twieġeb il-messaġġi tal-mistiedna u tipproċessa l-kompiti, mingħajr ma jkollok bżonn toqgħod bilqiegħda quddiem il-kompjuter — il-bidliet jidhru f'ħin reali wkoll fid-dashboard tal-web.",
            },
            { type: "h2", text: "Il-prenotazzjonijiet f'moħħok" },
            {
              type: "p",
              text: "Fit-taqsima “Prenotazzjonijiet” tara l-waslet u t-tluq, l-okkupazzjoni u l-istatus għal kull proprjetà. L-Impjegat u t-Tindif jaraw biss l-informazzjoni rilevanti għalihom, mingħajr prezzijiet jew dettalji ta' distribuzzjoni.",
            },
            { type: "h2", text: "Messaġġi u Kompiti" },
            {
              type: "steps",
              items: [
                "Iftaħ it-taqsima “Messaġġi” biex twieġeb direttament it-talbiet tal-mistiedna.",
                "Aqleb għal “Kompiti” biex tara l-kompiti assenjati lilek.",
                "Agħfas kompitu biex tiftaħ id-dettalji u tikkompletah.",
                "Immarka appuntamenti ta' tindif imwettqa bħala kompluti direttament fuq il-post.",
              ],
            },
            {
              type: "ul",
              items: [
                "Messaġġi u kompiti ġodda jidhru live, mingħajr aġġornament manwali.",
                "Il-kompiti kompluti jkunu viżibbli minnufih ukoll fid-dashboard tal-web.",
                "Is-Sidien jaraw il-prenotazzjonijiet u r-rapporti tal-proprjetajiet tagħhom, iżda biss għall-qari.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "In-notifiki push jgħarrfuk dwar messaġġi ġodda u kompiti assenjati, ladarba tippermettihom fl-issettjar tal-apparat.",
            },
          ],
        },
      ],
    },
  ],
};
