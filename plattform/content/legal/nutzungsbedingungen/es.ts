import { ANBIETER } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Condiciones de uso para huéspedes",
  stand: "Actualizado: 18 de agosto de 2026",
  intro: [
    "Estas condiciones de uso regulan la utilización del portal de reservas myBestDays (en adelante, «la plataforma») por parte de viajeros y personas que reservan (en adelante, «el huésped» o «usted»).",
    `La plataforma está gestionada por ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, Dinamarca, CVR n.º ${ANBIETER.cvr} (en adelante, «myBestDays» o «nosotros»). myBestDays es una marca de esta sociedad y no una persona jurídica independiente. Los datos completos del prestador figuran en el [Aviso legal](https://mybestdays.dk/rechtliches/impressum).`,
    "Al utilizar la plataforma acepta estas condiciones. Le rogamos que las lea atentamente.",
  ],
  summary: {
    heading: "Resumen de estas condiciones",
    paragraphs: [
      "myBestDays es un mercado. Ponemos a disposición la plataforma en la que los proveedores ofrecen su alojamiento — el alojamiento en sí no lo prestamos nosotros. El contrato de alojamiento se celebra entre usted y el proveedor, no con nosotros.",
      "Lo que ve en un anuncio procede del proveedor: descripción, fotos, equipamiento, precio, condiciones de cancelación y normas de la casa. Revisamos los anuncios, pero no podemos responder de cada indicación de un proveedor.",
      "El precio que ve al finalizar la reserva es el precio total de los servicios reservados. Los importes que solo se abonan en destino (por ejemplo, tasa turística o fianza) se indican por separado con antelación.",
      "Si algo sale mal, diríjase primero a nosotros. La sección A15 describe cómo presentar una reclamación y qué vías quedan abiertas después.",
      "Este resumen explica las condiciones pero no las sustituye. Prevalece el texto completo.",
    ],
  },
  sections: [
    {
      id: "a",
      heading: "A. Todas las reservas a través de myBestDays",
      subsections: [
        {
          id: "a1-definitionen",
          heading: "A1. Definiciones",
          paragraphs: [
            "Los términos empleados en estas condiciones se explican en el glosario que figura al final de este documento. Los principales son:",
          ],
          list: [
            "«Plataforma»: el sitio web, las aplicaciones móviles y todos los demás accesos a través de los cuales myBestDays muestra alojamientos e intermedia reservas.",
            "«Proveedor»: la persona física o jurídica que ofrece alojamiento a través de la plataforma (anfitrión, arrendador, agencia, establecimiento hotelero o de alojamiento).",
            "«Alojamiento»: el servicio de alojamiento ofrecido por el proveedor, es decir, un inmueble vacacional o una unidad de un tipo de habitación o de inmueble.",
            "«Reserva»: la reserva de un alojamiento para un periodo determinado, celebrada a través de la plataforma.",
            "«Precio total»: el importe mostrado al finalizar la reserva, incluidos todos los impuestos, tasas y suplementos liquidados a través de la plataforma.",
            "«Costes en destino»: importes que no se liquidan a través de la plataforma sino que se abonan al proveedor (por ejemplo, tasa turística, fianza, limpieza final según elija el proveedor).",
          ],
        },
        {
          id: "a2-ueber-diese-bedingungen",
          heading: "A2. Sobre estas condiciones",
          paragraphs: [
            "Estas condiciones se aplican a cualquier uso de la plataforma, con independencia de que cree una cuenta y de que llegue a celebrarse una reserva.",
            "La sección A se aplica a todas las reservas. La sección B contiene las reglas complementarias para alojamientos. En caso de contradicción, prevalece la sección B.",
            "Al servicio de alojamiento en sí se aplican además las condiciones del proveedor correspondiente (en particular, normas de la casa y condiciones de cancelación) indicadas en el anuncio. Dichas condiciones del proveedor se añaden a las nuestras; no pueden dejar sin efecto nuestras condiciones en lo relativo a su relación con nosotros.",
            "Estas condiciones están disponibles en las 24 lenguas oficiales de la Unión Europea. En caso de divergencia entre las versiones lingüísticas prevalece la versión alemana, salvo que el Derecho imperativo de su Estado de residencia disponga otra cosa.",
            "Los derechos imperativos de los consumidores conforme al Derecho de su Estado de residencia no se ven afectados por estas condiciones.",
          ],
        },
        {
          id: "a3-ueber-mybestdays",
          heading: "A3. Sobre myBestDays",
          paragraphs: [
            "myBestDays es un mercado en línea de alojamientos vacacionales y establecimientos de alojamiento. Gestionamos la plataforma en la que los proveedores presentan su alojamiento y los huéspedes pueden reservarlo.",
            "Somos intermediarios, no hospedadores. No poseemos, explotamos, gestionamos ni controlamos ninguno de los alojamientos ofrecidos en la plataforma y no somos parte del contrato de alojamiento.",
            "myBestDays es un servicio intermediario en el sentido del Reglamento (UE) 2022/2065 relativo a los servicios digitales. Nuestras indicaciones y procedimientos con arreglo a dicho Reglamento figuran en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa).",
            "myBestDays no es organizador de viajes. No organizamos viajes combinados en el sentido de la Directiva (UE) 2015/2302; sobre servicios de viaje vinculados, véase A20.",
          ],
        },
        {
          id: "a4-unsere-plattform",
          heading: "A4. Nuestra plataforma",
          paragraphs: [
            "El contenido de un anuncio — descripción, fotos, equipamiento, límites de ocupación, precios, disponibilidad, condiciones de cancelación y normas de la casa — procede del proveedor correspondiente. Este es responsable de su exactitud e integridad.",
            "Revisamos los anuncios antes de su publicación y de forma continuada en cuanto a infracciones manifiestas de nuestras [Normas sobre contenidos adecuados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien). No existe obligación de supervisión general de todos los contenidos y, con arreglo al artículo 8 del Reglamento (UE) 2022/2065, tampoco sería admisible.",
            "Cómo ordenamos los resultados de búsqueda y qué factores determinan ese orden se explica en [Precios, clasificación y recomendaciones](https://mybestdays.dk/rechtliches/preisangaben).",
            "Nos esforzamos por mantener una plataforma disponible de forma continua, pero no debemos una disponibilidad ininterrumpida. Son posibles labores de mantenimiento, incidencias y adaptaciones.",
            "Las traducciones de los contenidos de los proveedores pueden ser automáticas. Prevalece la versión original introducida por el proveedor.",
          ],
        },
        {
          id: "a5-unsere-werte",
          heading: "A5. Nuestros valores",
          paragraphs: [
            "Esperamos de huéspedes y proveedores un trato respetuoso. La discriminación por razón de origen, color de piel, religión, convicciones, sexo, identidad de género, orientación sexual, discapacidad, edad o características comparables no se tolera en la plataforma — véase [Política de no discriminación](https://mybestdays.dk/rechtliches/antidiskriminierung).",
            "Al comportamiento durante la estancia se aplican las [Reglas básicas para huéspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste) y, a los proveedores, el [Código de conducta para proveedores](https://mybestdays.dk/rechtliches/verhaltenskodex-anbieter).",
          ],
        },
        {
          id: "a6-konto-und-nutzung",
          heading: "A6. Su cuenta y su uso de la plataforma",
          paragraphs: [
            "Para reservar puede crear una cuenta. Usted es responsable de la confidencialidad de sus credenciales y nos avisará sin demora si sospecha un uso no autorizado.",
            "Solo puede utilizar la plataforma si tiene capacidad de obrar y puede celebrar contratos válidamente.",
            "Sus datos en el registro y en la reserva deben ser exactos y completos — en particular, nombre, datos de contacto y número de viajeros. El proveedor necesita esta información para prestar el alojamiento y cumplir sus obligaciones de registro.",
            "No está permitido, en particular:",
          ],
          list: [
            "las reservas simuladas, los pagos fraudulentos o el uso de medios de pago ajenos sin autorización;",
            "la extracción automatizada de la plataforma (scraping, rastreadores) más allá de lo que permite nuestro robots.txt;",
            "las actuaciones que perturben o sobrecarguen la plataforma o su infraestructura subyacente o eludan sus medidas de seguridad;",
            "la publicación de contenidos ilícitos, injuriosos o engañosos en valoraciones, mensajes o datos de perfil;",
            "el intento de tramitar la reserva al margen de la plataforma una vez establecido el contacto a través de ella — véase [Cargos fuera de la plataforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "a7-preise",
          heading: "A7. Precios",
          paragraphs: [
            "Todos los precios se muestran como precio total, incluidos impuestos y todas las tasas liquidadas a través de la plataforma, en cuanto se conocen los datos del viaje (periodo y número de viajeros). Si un componente solo se devenga en destino, lo indicamos por separado antes de finalizar la reserva.",
            "Los precios se muestran en la moneda del anuncio. Si además se muestra un importe en otra moneda, se trata de una conversión orientativa sin carácter vinculante; la liquidación se efectúa en la moneda del anuncio, salvo indicación distinta en el proceso de pago.",
            "Los precios pueden variar hasta la finalización de la reserva, por ejemplo porque el proveedor los ajuste o cambie la disponibilidad. Prevalece el precio que se le muestre inmediatamente antes de la reserva vinculante y que figure en la confirmación de reserva.",
            "Los errores de precio manifiestos (por ejemplo, un importe equivocado en un orden de magnitud) no vinculan ni a nosotros ni al proveedor. Si detectamos tal error, se lo comunicaremos sin demora; podrá entonces cancelar la reserva sin coste.",
            "La composición de las comisiones de servicio figura en [Comisiones de servicio](https://mybestdays.dk/rechtliches/servicegebuehren). Sobre impuestos y tasas, véase la [Política fiscal](https://mybestdays.dk/rechtliches/steuern).",
          ],
        },
        {
          id: "a8-zahlung",
          heading: "A8. Pago",
          paragraphs: [
            "Los pagos a través de la plataforma se tramitan mediante el proveedor de servicios de pago Stripe. Los datos de pago (por ejemplo, datos de tarjeta) son recogidos y tratados directamente por Stripe; myBestDays no almacena datos completos de tarjeta.",
            "Cuándo vence cada importe — anticipo, resto o pago en destino — depende del anuncio y se muestra antes de finalizar la reserva. Los detalles se regulan en las [Condiciones de pago](https://mybestdays.dk/rechtliches/zahlungsbedingungen).",
            "Si el anuncio indica una fianza, esta podrá preautorizarse o cobrarse y retenerse total o parcialmente en caso de daños; prevalecen las indicaciones del anuncio.",
            "Si un pago falla o se retrocede, la reserva puede cancelarse. El proveedor podrá seguir reclamando los importes derivados de sus condiciones de cancelación.",
          ],
        },
        {
          id: "a9-richtlinien",
          heading: "A9. Políticas",
          paragraphs: [
            "Además de estas condiciones se aplican las siguientes políticas, que forman parte del contrato entre usted y nosotros:",
          ],
          list: [
            "[Normas sobre contenidos adecuados](https://mybestdays.dk/rechtliches/inhaltsrichtlinien)",
            "[Política de valoraciones](https://mybestdays.dk/rechtliches/bewertungsrichtlinien)",
            "[Política de no discriminación](https://mybestdays.dk/rechtliches/antidiskriminierung)",
            "[Reglas básicas para huéspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste)",
            "[Condiciones de cancelación](https://mybestdays.dk/rechtliches/stornierungsbedingungen)",
            "[Política de recolocación y reembolso](https://mybestdays.dk/rechtliches/rueckerstattung)",
            "[Política ante perturbaciones graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen)",
            "[Política de derechos de autor](https://mybestdays.dk/rechtliches/urheberrecht)",
          ],
        },
        {
          id: "a10-datenschutz-und-cookies",
          heading: "A10. Protección de datos y cookies",
          paragraphs: [
            "Cómo tratamos los datos personales figura en la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz). Qué cookies y tecnologías similares utilizamos figura en la [Política de cookies](https://mybestdays.dk/rechtliches/cookies).",
            "Para una reserva transmitimos al proveedor los datos que necesita para prestar el servicio de alojamiento. El proveedor es responsable del tratamiento de forma autónoma; le son aplicables las [Normas de protección de datos para anfitriones](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
          ],
        },
        {
          id: "a11-barrierefreiheit",
          heading: "A11. Accesibilidad",
          paragraphs: [
            "El estado de la accesibilidad de la plataforma y la vía para comunicar barreras se describen en la [Declaración de accesibilidad](https://mybestdays.dk/rechtliches/barrierefreiheit).",
            "Los datos sobre la accesibilidad de un alojamiento proceden del proveedor. Si depende de determinadas características, aclárelas con el proveedor a través de la mensajería antes de reservar.",
          ],
        },
        {
          id: "a12-bewertungen-und-inhalte",
          heading: "A12. Valoraciones y contenidos generados por los usuarios",
          paragraphs: [
            "Tras la estancia puede dejar una valoración. Solo puede valorar quien haya reservado a través de la plataforma y haya iniciado la estancia o hubiera podido iniciarla — así garantizamos que las valoraciones publicadas proceden de huéspedes reales.",
            "No pagamos por valoraciones, no modificamos su contenido y no suprimimos una valoración por el mero hecho de ser negativa. Los detalles y los motivos por los que retiramos una valoración figuran en la [Política de valoraciones](https://mybestdays.dk/rechtliches/bewertungsrichtlinien).",
            "Usted sigue siendo responsable de los contenidos que publique — valoraciones, fotos, mensajes, datos de perfil. Nos concede un derecho no exclusivo, sin limitación territorial ni temporal y gratuito, para reproducir, adaptar (por ejemplo, recortar, traducir) y comunicar públicamente dichos contenidos en el marco de la explotación y promoción de la plataforma. Puede eliminar sus contenidos; los usos ya realizados en recopilaciones ya publicadas no se ven afectados.",
          ],
        },
        {
          id: "a13-kommunikation",
          heading: "A13. Mensajes y comunicación con el proveedor",
          paragraphs: [
            "Los mensajes entre usted y el proveedor discurren por la plataforma. Ponemos a disposición la función de mensajería, pero no somos ni remitente ni destinatario de los contenidos.",
            "Podemos revisar los mensajes de forma automatizada en cuanto a infracciones de estas condiciones (por ejemplo, datos de contacto para eludir la plataforma, patrones de fraude, contenidos ilícitos) y retener o eliminar los mensajes afectados. Le informaremos de toda eliminación con una motivación conforme a A17.",
            "Le enviamos mensajes sobre su reserva (confirmación, modificaciones, información de llegada) a la dirección de correo electrónico indicada. Estos mensajes son comunicación contractual y no pueden darse de baja mientras exista la reserva. Solo recibirá mensajes publicitarios en la medida en que haya prestado su consentimiento o el Derecho lo permita sin él; puede oponerse en cualquier momento.",
          ],
        },
        {
          id: "a14-geistiges-eigentum",
          heading: "A14. Derechos de propiedad intelectual",
          paragraphs: [
            "La plataforma, su diseño, software, bases de datos, textos y marcas están protegidos. Usted obtiene un derecho no exclusivo e intransferible de utilizar la plataforma para buscar y reservar alojamientos — nada más.",
            "El uso de nuestras marcas y logotipos se rige por las [Normas sobre marcas](https://mybestdays.dk/rechtliches/markenzeichen).",
            "Si considera que un contenido de la plataforma vulnera sus derechos de autor, siga la [Política de derechos de autor](https://mybestdays.dk/rechtliches/urheberrecht).",
          ],
        },
        {
          id: "a15-wenn-etwas-schiefgeht",
          heading: "A15. Qué hacer si algo sale mal",
          paragraphs: [
            "Si el problema afecta al alojamiento en sí, diríjase primero al proveedor — a través de la mensajería o en destino. Muchos problemas se resuelven así con mayor rapidez.",
            "Si no avanza con el proveedor, o si el problema afecta a la plataforma, al pago o a la tramitación de la reserva, diríjase a nosotros. Cómo contactarnos y cómo tramitamos las reclamaciones figura en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
            "Tenga a mano: su número de reserva, la dirección de correo electrónico de la reserva, una breve descripción del problema con su petición sobre cómo debemos ayudar y los justificantes correspondientes (fotos, mensajes, recibos).",
            "Si el alojamiento no está disponible a la llegada o difiere sustancialmente del anuncio, se aplica la [Política de recolocación y reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "La plataforma de resolución de litigios en línea de la Comisión Europea (plataforma RLL) fue derogada por el Reglamento (UE) 2024/3228 y ha cesado su actividad; ya no está disponible como vía. Los organismos que la sustituyen figuran en [Reclamaciones y resolución de litigios](https://mybestdays.dk/rechtliches/beschwerden).",
            "Si hemos adoptado una medida contra sus contenidos o su cuenta, además de nuestro procedimiento interno de reclamación puede acudir a un órgano de resolución extrajudicial de litigios certificado conforme al artículo 21 del Reglamento (UE) 2022/2065. Sus decisiones no nos vinculan.",
          ],
        },
        {
          id: "a16-unangemessenes-verhalten",
          heading: "A16. Medidas frente a conductas inadecuadas",
          paragraphs: [
            "Si infringe estas condiciones o alguna de las políticas mencionadas en A9, podemos — de forma gradual según la gravedad, la frecuencia y los efectos de la infracción — retirar contenidos o restringir su visibilidad, bloquear funciones, cancelar reservas o suspender su cuenta temporal o definitivamente.",
            "Antes de adoptar una medida examinamos el caso concreto. Ante contenidos manifiestamente ilícitos, peligro para personas o fraude podemos actuar de inmediato.",
            "Motivamos toda medida frente a usted y le indicamos la vía de reclamación — véase A17.",
          ],
        },
        {
          id: "a17-meldung-rechtswidriger-inhalte",
          heading: "A17. Notificación de contenidos ilícitos y motivación de las medidas",
          paragraphs: [
            "Cualquier persona puede notificarnos contenidos que considere ilícitos. El procedimiento de notificación conforme al artículo 16 del Reglamento (UE) 2022/2065, nuestros puntos de contacto y el tratamiento de las notificaciones se describen en [Reglamento de Servicios Digitales](https://mybestdays.dk/rechtliches/dsa).",
            "Si adoptamos una medida contra contenidos publicados por usted o contra su cuenta, recibirá una motivación con indicación del motivo, la base fáctica, el fundamento jurídico o la cláusula contractual infringida y las posibilidades de reclamación.",
            "Puede reclamar gratuitamente contra cualquier medida en el plazo de seis meses. Las reclamaciones son tramitadas por personas, no exclusivamente de forma automatizada.",
          ],
        },
        {
          id: "a18-haftung",
          heading: "A18. Limitación de responsabilidad",
          paragraphs: [
            "Respondemos sin limitación por dolo y culpa grave, por daños derivados de lesión a la vida, la integridad física o la salud, así como en la medida de una garantía asumida por nosotros. Las acciones derivadas de la responsabilidad por productos defectuosos no se ven afectadas.",
            "Por lo demás, nuestra responsabilidad se limita al daño previsible que se derive típicamente del incumplimiento de las obligaciones en cuya observancia usted puede confiar — y únicamente en la medida en que el Derecho aplicable admita tal limitación.",
            "No respondemos de la prestación del servicio de alojamiento en sí ni del comportamiento de proveedores u otros huéspedes. La contraparte del servicio de alojamiento es el proveedor.",
            "No respondemos de la exactitud de las indicaciones publicadas por los proveedores, en la medida en que no las conociéramos ni debiéramos conocerlas. En cuanto tengamos conocimiento de una indicación ilícita, actuaremos sin demora.",
            "Queda excluida cualquier responsabilidad ulterior. Los derechos legales imperativos, en particular los derechos de los consumidores, no se ven afectados.",
          ],
        },
        {
          id: "a19-recht-und-gerichtsstand",
          heading: "A19. Derecho aplicable y jurisdicción",
          paragraphs: [
            "Se aplica el Derecho danés — el operador está establecido en Dinamarca — con exclusión de la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías. Las disposiciones imperativas de protección de los consumidores del Estado en el que tenga su residencia habitual no se ven afectadas, conforme al artículo 6 del Reglamento (CE) n.º 593/2008 (Roma I).",
            "Como consumidor puede demandarnos ante el tribunal de su domicilio o ante el de nuestro domicilio social en Dinamarca; nosotros solo podemos demandarle ante el tribunal de su domicilio (artículos 17 a 19 del Reglamento (UE) n.º 1215/2012).",
            "Al contrato de alojamiento se aplica por regla general el Derecho del Estado en el que se encuentre el alojamiento; para las acciones en materia de arrendamiento de bienes inmuebles son exclusivamente competentes los tribunales de dicho Estado.",
          ],
        },
        {
          id: "a20-verbundene-reiseleistungen",
          heading: "A20. Servicios de viaje vinculados",
          paragraphs: [
            "myBestDays intermedia exclusivamente servicios de alojamiento. No ofrecemos vuelos, alquiler de vehículos, servicios de transporte, excursiones ni atracciones, y no organizamos viajes combinados en el sentido de la Directiva (UE) 2015/2302.",
            "Si en el futuro intermediáramos otros servicios de viaje, le informaríamos antes de la reserva mediante el formulario normalizado legalmente previsto sobre si se origina un viaje combinado o un servicio de viaje vinculado y qué derechos le corresponden.",
          ],
        },
        {
          id: "a21-laufzeit-und-kuendigung",
          heading: "A21. Duración, suspensión y resolución",
          paragraphs: [
            "El contrato de uso de la plataforma se celebra por tiempo indefinido. Puede eliminar su cuenta en cualquier momento sin necesidad de motivo; las reservas existentes no se ven afectadas y se tramitan conforme a las condiciones del proveedor correspondiente.",
            "Podemos resolver el contrato de uso con un preaviso de 14 días. En caso de infracción grave de estas condiciones podemos resolver sin preaviso y bloquear la cuenta.",
            "Tras la terminación eliminamos sus datos, salvo que se oponga una obligación legal de conservación o un interés legítimo en su conservación; los detalles se regulan en la [Política de privacidad](https://mybestdays.dk/rechtliches/datenschutz).",
          ],
        },
        {
          id: "a22-aenderungen",
          heading: "A22. Cláusula de modificación",
          paragraphs: [
            "Podemos modificar estas condiciones cuando exista un motivo objetivo — por ejemplo, un cambio normativo, jurisprudencia de los tribunales superiores, funcionalidades nuevas o suprimidas de la plataforma o la colmatación de lagunas.",
            "Anunciamos las modificaciones al menos 30 días antes de su entrada en vigor en forma de texto. Si no se opone antes de la entrada en vigor, las condiciones modificadas se considerarán aceptadas; sobre este efecto le advertimos expresamente en el anuncio. Si se opone, podemos resolver el contrato de uso con efectos desde la fecha de entrada en vigor.",
            "A las reservas ya celebradas se aplican las condiciones en la versión vigente en el momento de la reserva.",
          ],
        },
      ],
    },
    {
      id: "b",
      heading: "B. Alojamientos",
      subsections: [
        {
          id: "b1-umfang",
          heading: "B1. Ámbito de esta sección",
          paragraphs: [
            "Esta sección se aplica a la reserva de alojamientos a través de la plataforma — tanto inmuebles vacacionales como habitaciones y unidades de establecimientos de alojamiento.",
            "Complementa la sección A. En caso de contradicción, prevalece esta sección B.",
          ],
        },
        {
          id: "b2-vertragsverhaeltnis",
          heading: "B2. Relación contractual",
          paragraphs: [
            "El contrato de alojamiento se celebra exclusivamente entre usted y el proveedor. myBestDays no es parte del contrato.",
            "La presentación de un alojamiento en la plataforma constituye una invitación a que usted formule una oferta de reserva. Al pulsar el botón de reserva con obligación de pago, formula una oferta vinculante.",
            "El contrato se perfecciona cuando la reserva es confirmada. Enviamos la confirmación de reserva a la dirección de correo electrónico que haya indicado; en ella figuran el proveedor, el servicio reservado, el periodo, el precio total y las condiciones de cancelación.",
            "En alojamientos con reserva bajo solicitud, el contrato se perfecciona solo con la aceptación del proveedor. Hasta entonces su medio de pago puede preautorizarse pero no cargarse.",
          ],
        },
        {
          id: "b3-was-wir-tun",
          heading: "B3. Qué hacemos nosotros",
          paragraphs: [
            "Ponemos a disposición la plataforma, mostramos los anuncios de los proveedores, recibimos su reserva, la transmitimos al proveedor y le remitimos la confirmación de reserva.",
            "Tramitamos el pago en la medida en que el anuncio prevea el pago a través de la plataforma y ponemos a disposición la mensajería entre usted y el proveedor.",
            "No ponemos a disposición el alojamiento, no lo explotamos y no garantizamos su estado. No somos su organizador de viajes.",
          ],
        },
        {
          id: "b4-was-sie-tun-muessen",
          heading: "B4. Qué debe hacer usted",
          paragraphs: [
            "Antes de reservar, revise el anuncio en su totalidad: equipamiento, límite de ocupación, horarios de llegada y salida, normas de la casa, condiciones de cancelación y los costes que solo se devengan en destino.",
            "Respete la ocupación máxima indicada en el anuncio. Si llegan más personas de las reservadas, el proveedor podrá denegar el acceso o exigir un suplemento.",
            "Observe las normas de la casa del proveedor y las [Reglas básicas para huéspedes](https://mybestdays.dk/rechtliches/grundregeln-gaeste). Usted tratará el alojamiento con cuidado y responderá de los daños que usted o sus acompañantes causen.",
            "Si el proveedor o una autoridad necesita datos para el registro (por ejemplo, parte de entrada, datos de identidad, declaración de tasa turística), facilítelos con tiempo suficiente.",
          ],
        },
        {
          id: "b5-preise-und-zahlung",
          heading: "B5. Precios y pago",
          paragraphs: [
            "El precio total comprende el precio del alojamiento para el periodo reservado y los suplementos y tasas indicados en el anuncio que se liquidan a través de la plataforma.",
            "En destino pueden devengarse importes adicionales — en particular, tasa turística o tributos locales, una fianza y servicios adicionales que reserve solo en destino. Los indicamos como costes en destino antes de finalizar la reserva, en la medida en que el proveedor los haya consignado.",
            "Si el anuncio prevé un anticipo, el importe restante vence en el momento indicado en el anuncio. Si no se abona, el proveedor podrá desistir del contrato conforme a sus condiciones de cancelación.",
            "No aceptamos ni podemos rastrear los pagos al proveedor realizados al margen de la plataforma; no están comprendidos en nuestra tramitación de pagos — véase [Cargos fuera de la plataforma](https://mybestdays.dk/rechtliches/gebuehren-ausserhalb).",
          ],
        },
        {
          id: "b6-aenderungen-stornierungen",
          heading: "B6. Modificaciones, cancelaciones y reembolsos",
          paragraphs: [
            "Si una reserva puede cancelarse o modificarse sin coste y en qué condiciones depende de las condiciones de cancelación del proveedor indicadas en el anuncio. Las condiciones que ofrecemos a los proveedores se describen en [Condiciones de cancelación](https://mybestdays.dk/rechtliches/stornierungsbedingungen).",
            "En los servicios de alojamiento reservados para un periodo determinado no existe, por regla general, derecho legal de desistimiento conforme al artículo 16, letra l), de la Directiva 2011/83/UE o a las disposiciones nacionales correspondientes. Los derechos legales imperativos no se ven afectados.",
            "Si cancela el proveedor, reembolsamos íntegramente el importe abonado a través de la plataforma. Además se aplica la [Política de recolocación y reembolso](https://mybestdays.dk/rechtliches/rueckerstattung).",
            "Si un acontecimiento ajeno al control de ambas partes impide el viaje o la estancia, se aplica la [Política ante perturbaciones graves](https://mybestdays.dk/rechtliches/schwerwiegende-beeintraechtigungen).",
            "Los reembolsos se efectúan al medio de pago utilizado, salvo pacto en contrario.",
          ],
        },
        {
          id: "b7-was-sie-ausserdem-wissen-muessen",
          heading: "B7. Qué más debe saber",
          paragraphs: [
            "Los proveedores pueden ser anfitriones particulares o empresarios. Indicamos en el anuncio si un proveedor actúa como empresario. Si no se trata de un empresario, las disposiciones de protección de los consumidores de la Unión no se aplican al contrato de alojamiento — se lo advertimos en el anuncio.",
            "Los datos sobre ubicación, entorno, distancias y valoraciones de terceros tienen carácter orientativo. Son vinculantes los datos relativos al servicio reservado en sí.",
            "En zonas con obligación de registro para el alquiler de corta duración indicamos en el anuncio el número de registro facilitado por el proveedor; véase [Alquiler de corta duración](https://mybestdays.dk/rechtliches/kurzzeitvermietung).",
            "Cuando existan varias unidades idénticas de un tipo de inmueble o habitación, usted reserva una unidad de ese tipo. Qué unidad concreta recibe lo determina el proveedor.",
          ],
        },
      ],
    },
    {
      id: "lexikon",
      heading: "Glosario",
      paragraphs: [
        "Los siguientes términos tienen en estas condiciones el significado que aquí se indica.",
      ],
      definitions: [
        {
          term: "Proveedor",
          description:
            "La persona física o jurídica que ofrece alojamiento a través de la plataforma y pasa a ser contraparte del contrato de alojamiento.",
        },
        {
          term: "Reserva bajo solicitud",
          description:
            "Una reserva que se perfecciona solo tras la aceptación expresa del proveedor, a diferencia de la reserva inmediata.",
        },
        {
          term: "Confirmación de reserva",
          description:
            "El mensaje con el que le confirmamos la celebración del contrato de alojamiento; contiene proveedor, servicio, periodo, precio total y condiciones de cancelación.",
        },
        {
          term: "Unidad",
          description:
            "El objeto concreto reservable dentro de un tipo de inmueble o habitación. Se vende la unidad; el tipo se describe y se tarifica.",
        },
        {
          term: "Precio total",
          description:
            "El importe mostrado al finalizar la reserva, incluidos todos los impuestos y todas las tasas liquidadas a través de la plataforma.",
        },
        {
          term: "Ocupación máxima",
          description:
            "El número máximo de personas autorizadas a pernoctar en el alojamiento, según se indica en el anuncio.",
        },
        {
          term: "Fianza",
          description:
            "Un importe exigido por el proveedor como garantía frente a daños, que se preautoriza o cobra y se libera o compensa tras la estancia.",
        },
        {
          term: "Tasa turística",
          description:
            "Un tributo local sobre las pernoctaciones que, según el municipio, se recauda en destino o a través del proveedor; no es un servicio de myBestDays.",
        },
        {
          term: "Plataforma",
          description:
            "El sitio web, las aplicaciones móviles y todos los demás accesos a través de los cuales myBestDays muestra alojamientos e intermedia reservas.",
        },
        {
          term: "Comisión de servicio",
          description:
            "La retribución del servicio de intermediación de myBestDays. Quién la soporta y cómo se indica figura en Comisiones de servicio.",
        },
        {
          term: "Condiciones de cancelación",
          description:
            "Las reglas elegidas por el proveedor sobre hasta cuándo y a qué coste puede cancelarse o modificarse una reserva.",
        },
        {
          term: "Alojamiento",
          description:
            "El servicio de alojamiento ofrecido por el proveedor — un inmueble vacacional o una unidad de un tipo de habitación o de inmueble.",
        },
        {
          term: "Costes en destino",
          description:
            "Importes que no se liquidan a través de la plataforma sino que se abonan al proveedor, como la tasa turística, la fianza o servicios adicionales reservados en destino.",
        },
      ],
    },
  ],
};
