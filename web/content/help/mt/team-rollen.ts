import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Tim u Permessi",
  description: "Impjegati, rwoli u drittijiet ta' aċċess.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Aċċess",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Istieden Impjegati",
          excerpt: "Hekk tistieden impjegati ġodda għall-kont tiegħek ta' myNextDays.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Tista' tistieden kemm trid impjegati man-negozju tiegħek — pereżempju għar-riċezzjoni, it-tindif jew l-amministrazzjoni. Kull stedina hija marbuta ma' indirizz tal-email u tagħti minnufih rwol fiss, li jiddetermina l-aċċess fil-web u fl-app ta' myNextDays.",
            },
            { type: "h2", text: "Ibgħat stedina" },
            {
              type: "steps",
              items: [
                "Iftaħ “Kont” u aqleb għat-taqsima “Tim”.",
                "Ikklikkja “Istieden Impjegat”.",
                "Daħħal l-indirizz tal-email tal-persuna.",
                "Agħżel ir-rwol xieraq, eż. Impjegat jew Tindif.",
                "Ikkonferma l-istedina.",
              ],
            },
            { type: "h2", text: "X'jiġri wara" },
            {
              type: "p",
              text: "Il-persuna mistiedna tirċievi email b'link biex tistabbilixxi password tagħha stess u tidħol. Il-login japplika bl-istess mod għad-dashboard tal-web u għall-app ta' myNextDays — ma jeżisti ebda kont separat għal kull front-end.",
            },
            {
              type: "ul",
              items: [
                "Stedina tibqa' valida sakemm tiġi aċċettata jew irtirata.",
                "L-istediniet miftuħa tarahom fit-taqsima “Tim” bl-istatus “Pendenti”.",
                "Ir-rwol jista' jiġi aġġustat fi kwalunkwe ħin aktar tard.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Liema rwol jista' jara liema oqsma, ssir taf taħt [Rwoli u Permessi](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Agħti mill-bidu l-aktar rwol strett u xieraq — id-drittijiet jistgħu jiġu estiżi fi kwalunkwe ħin aktar tard.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Rwoli u Permessi",
          excerpt: "Il-ħames rwoli f'myNextDays u x'jista' jagħmel kull wieħed.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "myNextDays tiddistingwi ħames rwoli: Admin, Ko-Admin, Impjegat, Tindif u Sid. Kull rwol jiddetermina liema oqsma huma viżibbli fid-dashboard tal-web u fl-app ta' myNextDays — id-drittijiet jiġu infurzati fuq in-naħa tas-server, mhux moħbija biss fl-interfaċċja.",
            },
            { type: "h2", text: "Ħarsa ġenerali lejn ir-rwoli" },
            {
              type: "ul",
              items: [
                "Admin: aċċess sħiħ għall-oqsma kollha, inkluż finanzi, distribuzzjoni u ġestjoni tat-tim.",
                "Ko-Admin: aċċess kważi sħiħ bħall-Admin, għat-tieni livell ta' tmexxija tan-negozju.",
                "Impjegat: aċċess operattiv għall-prenotazzjonijiet, il-kalendarju u l-kompiti, mingħajr aċċess finanzjarju jew ta' distribuzzjoni.",
                "Tindif: aċċess esklussiv għall-kompiti ta' tindif assenjati u d-dettalji tal-proprjetà, mingħajr aċċess finanzjarju jew ta' distribuzzjoni.",
                "Sid: aċċess read-only lill-proprjetajiet tiegħu stess, ebda ġestjoni ta' proprjetajiet ta' ħaddieħor.",
              ],
            },
            { type: "h2", text: "Assenja jew ibdel rwol" },
            {
              type: "steps",
              items: [
                "Iftaħ “Kont” → “Tim”.",
                "Agħżel l-impjegat ikkonċernat mil-lista.",
                "Ikklikkja “Ibdel Rwol”.",
                "Agħżel ir-rwol il-ġdid u ikkonferma.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "L-Impjegati u t-Tindif bażikament ma jarawx prezzijiet, dħul jew kanali ta' prenotazzjoni — din l-esklużjoni tapplika fuq in-naħa tas-server u ma tistax tiġi evitata mill-interfaċċja.",
            },
            {
              type: "note",
              variant: "info",
              text: "Ħarsa ġenerali għal kull rwol issibha taħt [X'Jara Kull Rwol](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "X'Jara Kull Rwol",
          excerpt: "Oqsma u vedituri konkreti għal kull rwol fil-web u fl-app.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Minbarra d-drittijiet bażiċi minn [Rwoli u Permessi](/hilfe/team-rollen/rollen-berechtigungen), ħarsa konkreta lejn oqsma individwali tgħinek tistabbilixxi l-aspettattivi korretti meta tintroduċi impjegati ġodda.",
            },
            { type: "h2", text: "Kalendarju u Prenotazzjonijiet" },
            {
              type: "p",
              text: "L-Admin, il-Ko-Admin u l-Impjegat jaraw il-pjan tal-okkupazzjoni sħiħ bid-dettalji tal-mistieden u l-kompiti. It-Tindif jara biss l-appuntamenti assenjati lilu flimkien mal-indirizz tal-proprjetà u l-lista ta' kontroll, imma mhux ismijiet ta' mistiedna jew prezzijiet. Is-Sidien jaraw il-kalendarju tal-okkupazzjoni esklussivament għall-proprjetajiet tagħhom stess, biss għall-qari.",
            },
            { type: "h2", text: "Finanzi u Distribuzzjoni" },
            {
              type: "ul",
              items: [
                "Dħul, kummissjonijiet u fatturi: biss Admin u Ko-Admin.",
                "Portali (konnessjoni OTA) u viżibbiltà tal-pjattaforma: biss Admin u Ko-Admin.",
                "Impjegat u Tindif: ebda aċċess għal oqsma finanzjarji jew ta' distribuzzjoni, lanqas għal paġni ta' dettall.",
              ],
            },
            { type: "h2", text: "Tim u Issettjar" },
            {
              type: "p",
              text: "Il-ġestjoni tal-impjegati, ir-rwoli u l-issettjar tal-kont tibqa' riżervata għall-Admin u l-Ko-Admin. Is-sidien u r-rwoli operattivi lanqas biss jaraw din it-taqsima fl-app ta' myNextDays u fid-dashboard tal-web.",
            },
            {
              type: "note",
              variant: "info",
              text: "Din id-diviżjoni tapplika b'mod identiku fid-dashboard tal-web u fl-app ta' myNextDays, peress li ż-żewġ front-ends jitolbu l-istess rwol mill-kont tiegħek.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Ittestja rwoli ġodda flimkien mal-impjegat wara l-istedina biex tevita nuqqas ta' qbil dwar l-oqsma viżibbli.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Neħħi l-Aċċess",
          excerpt: "Neħħi l-aċċess tal-impjegat minnufih u kompletament.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Jekk impjegat jitlaq min-negozju tiegħek jew il-kollaborazzjoni tinbidel, neħħi l-aċċess direttament fil-Kont. It-tneħħija tapplika fuq in-naħa tas-server u minnufih — mhux biss wara li tiskadi sessjoni eżistenti.",
            },
            { type: "h2", text: "Neħħi l-aċċess" },
            {
              type: "steps",
              items: [
                "Iftaħ “Kont” → “Tim”.",
                "Agħżel l-impjegat ikkonċernat.",
                "Ikklikkja “Neħħi l-Aċċess”.",
                "Ikkonferma l-proċess.",
              ],
            },
            { type: "h2", text: "Effett fuq sessjonijiet kurrenti" },
            {
              type: "p",
              text: "Wara t-tneħħija, il-persuna ma tistax terġa' tidħol la fid-dashboard tal-web u lanqas fl-app ta' myNextDays. Kompiti jew appuntamenti ta' tindif diġà assenjati għandhom jiġu assenjati lil impjegat ieħor qabel, sabiex xejn ma jibqa' mhux ipproċessat.",
            },
            {
              type: "ul",
              items: [
                "Erġa' assenja l-kompiti miftuħa qabel it-tneħħija.",
                "L-aċċess jista' jerġa' jiġi rrestawrat aktar tard permezz ta' stedina.",
                "It-tneħħija taffettwa biss dan in-negozju, mhux kontijiet oħra tal-persuna.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Neħħi l-aċċess malajr kemm jista' jkun ladarba tispiċċa kollaborazzjoni — inkella kontijiet ta' impjegati miftuħa jibqgħu riskju ta' sigurtà bla bżonn.",
            },
          ],
        },
      ],
    },
  ],
};
