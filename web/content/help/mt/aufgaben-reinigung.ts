import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Kompiti u Tindif",
  description: "Organizza l-pjani tat-tindif u l-kompiti tat-tim.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Negozju",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Oħloq Kompiti",
          excerpt: "Hekk toħloq kompitu ġdid għal proprjetà jew perjodu.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Il-kompiti jiġbru kollox li jrid isir madwar proprjetà — mit-tindif wara l-check-out sax-xogħol ta' manutenzjoni jew talbiet tal-mistiedna. Kull kompitu huwa marbut ma' proprjetà waħda u jista' jiġi assenjat lil membru tat-tim.",
            },
            { type: "h2", text: "Oħloq kompitu ġdid" },
            {
              type: "steps",
              items: [
                "Iftaħ it-taqsima “Kompiti” fil-menu prinċipali.",
                "Ikklikkja “Kompitu Ġdid”.",
                "Agħżel il-proprjetà affettwata.",
                "Agħti titlu u deskrizzjoni fakultattiva.",
                "Iddefinixxi d-data u l-ħin tal-iskadenza.",
                "Issejvja l-kompitu.",
              ],
            },
            { type: "h2", text: "Tipi ta' kompiti" },
            {
              type: "p",
              text: "Minbarra l-kompiti liberi, hemm kompiti ġġenerati mis-sistema, pereżempju tindif ippjanat awtomatikament wara check-out. Dawn ikunu diġà marbuta mal-proprjetà u l-perjodu ta' żmien xieraq, u jridu biss jiġu assenjati lil membru tat-tim.",
            },
            {
              type: "ul",
              items: [
                "Kompitu manwali: irreġistrat liberament, eż. manutenzjoni jew talba speċjali.",
                "Kompitu awtomatiku ta' tindif: derivat mid-data tal-check-out.",
                "Kompitu rikorrenti: għal kontrolli jew spezzjonijiet regolari.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Dettalji dwar l-ippjanar awtomatiku taż-żmien ssibhom taħt [Pjani tat-Tindif](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Agħti titli preċiżi — il-membri tat-tim spiss jaraw biss it-titlu u l-proprjetà f'daqqa waħda fil-veduta mobbli.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Pjani tat-Tindif",
          excerpt: "Ħalli t-tindif jiġi ppjanat awtomatikament wara l-check-out.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Pjan tat-tindif jiżgura li wara kull check-out jinħoloq awtomatikament kompitu ta' tindif għall-proprjetà affettwata — mingħajr ma jkollok bżonn issegwi kull prenotazzjoni individwalment. Dan inaqqas konsenji minsija u jiżgura proċess affidabbli bejn żewġ soġġorni.",
            },
            { type: "h2", text: "Attiva l-ippjanar awtomatiku" },
            {
              type: "steps",
              items: [
                "Iftaħ il-proprjetà u aqleb għat-tab “Tindif”.",
                "Attiva “Ippjana t-Tindif Awtomatikament wara Check-out”.",
                "Iddefinixxi kemm ħin wara l-check-out jiġi ppjanat għat-tindif.",
                "Iddetermina b'mod fakultattiv tim jew persunal tat-tindif default.",
                "Issejvja l-issettjar.",
              ],
            },
            { type: "h2", text: "Interazzjoni mal-kalendarju" },
            {
              type: "p",
              text: "Ladarba prenotazzjoni tiġi kkanċellata jew ittrasferita, il-kompitu ta' tindif korrispondenti jaġġusta ruħu awtomatikament għad-data l-ġdida tal-check-out. B'hekk il-pjan tat-tindif jibqa' dejjem sinkronizzat mal-istatus reali tal-okkupazzjoni.",
            },
            {
              type: "ul",
              items: [
                "It-tindif jinħoloq awtomatikament ma' kull check-out b'pjan attiv.",
                "Jekk il-prenotazzjoni tiġi ttrasferita, il-kompitu ta' tindif jiġi ttrasferit ukoll.",
                "Jekk il-mistiedna jikkanċellaw is-soġġorn, il-kompitu ta' tindif jitneħħa.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mingħajr pjan tat-tindif attivat, ma jinħolqu ebda kompiti awtomatiċi — f'dan il-każ oħloq it-tindif manwalment taħt [Oħloq Kompiti](/hilfe/aufgaben-reinigung/aufgaben-anlegen).",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Assenja Kompiti",
          excerpt: "Assenja kompiti b'mod immirat lil persunal tat-tindif jew membri tat-tim.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Sabiex kompitu jitwettaq, assenjah lil membru tat-tim speċifiku — pereżempju persunal tat-tindif jew impjegat responsabbli mill-manutenzjoni. Default, il-persuna assenjata biss tara l-kompitu fil-ħarsa ġenerali tagħha stess.",
            },
            { type: "h2", text: "Assenja kompitu manwalment" },
            {
              type: "steps",
              items: [
                "Iftaħ il-kompitu fil-lista “Kompiti”.",
                "Ikklikkja “Assenja”.",
                "Agħżel il-membru tat-tim responsabbli mil-lista.",
                "Ikkonferma l-assenjazzjoni.",
              ],
            },
            { type: "h2", text: "Assenjazzjoni skont il-proprjetà" },
            {
              type: "p",
              text: "Jekk proprjetà tkun diġà assenjata b'mod fiss lil persunal tat-tindif, tista' wkoll tħalli l-kompiti għal din il-proprjetà jiġu assenjati awtomatikament lil din il-persuna. Dan ifaddal klikkjar u jnaqqas il-mistoqsijiet fit-tindif rikorrenti.",
            },
            {
              type: "ul",
              items: [
                "Assenjazzjoni manwali: int stess tagħżel il-persuna għal kull kompitu.",
                "Assenjazzjoni fissa tal-proprjetà: kompiti ġodda għal din il-proprjetà jmorru awtomatikament lill-persuna reġistrata.",
                "Kompitu dejjem għandu eżattament persuna responsabbli waħda.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Il-persunal tat-tindif u l-impjegati jaraw esklussivament il-kompiti assenjati tagħhom stess, ebda dejta finanzjarja jew ta' distribuzzjoni tal-proprjetà.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Segwi l-Istatus tal-Kompiti",
          excerpt: "Żomm f'moħħok l-istat tal-ipproċessar tal-kompiti f'ħin reali.",
          updated: "Aġġornat: Lulju 2026",
          body: [
            {
              type: "p",
              text: "Kull kompitu jgħaddi minn status ċar — minn miftuħ, għaddej sa komplut. B'hekk tara fi kwalunkwe ħin jekk tindif jew manutenzjoni tkunx se tispiċċa fil-ħin qabel il-check-in li jmiss.",
            },
            { type: "h2", text: "Ħarsa ġenerali tal-istatus" },
            {
              type: "ul",
              items: [
                "Miftuħ: il-kompitu huwa maħluq, imma għadu ma bediex.",
                "Għaddej: il-persuna assenjata bdiet il-kompitu.",
                "Komplut: il-kompitu huwa mwettaq u kkonfermat.",
              ],
            },
            { type: "h2", text: "Aġġorna l-istatus" },
            {
              type: "steps",
              items: [
                "Iftaħ il-kompitu mil-lista “Kompiti”.",
                "Agħżel l-istatus xieraq, eż. “Għaddej” jew “Komplut”.",
                "Żid nota qasira jekk meħtieġ, pereżempju dwar xi ħaġa notevoli fil-proprjetà.",
                "Issejvja l-bidla.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Il-bidliet fl-istatus jidhru minnufih fil-lista kondiviża tal-kompiti — mhux meħtieġ terġa' tgħabbi manwalment.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Jekk tindif ikun għadu miftuħ ftit qabel il-check-in li jmiss, iċċekkja l-ewwel l-assenjazzjoni qabel tikkuntattja lill-mistieden.",
            },
          ],
        },
      ],
    },
  ],
};
