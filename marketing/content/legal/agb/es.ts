// KOPIE aus web/content/legal/agb/es.ts — bewusst dupliziert, weil die
// Apps isoliert gebaut werden (ADR-0016): der Docker-Kontext dieser App
// enthält web/ nicht. Inhaltliche Änderungen IMMER in beiden Dateien.
// Zusätzlich zur web-Fassung: slug/metaDescription/numbered/toc für den
// Renderer dieser App.
import type { LegalDoc } from "../types";

// Spanische Fassung. Quelle ist content/legal/agb/de.ts — Änderungen immer
// zuerst dort. § 5 Absatz 1–2 folgt Stripes offiziellem Empfehlungstext
// (recommended disclosure language) — Sinn und URLs nicht verändern.
export const agb: LegalDoc = {
  slug: "agb",
  metaDescription:
    "Condiciones generales de uso de la plataforma myNextDays para agencias y arrendadores.",
  numbered: false,
  toc: true,
  title:
    "Condiciones generales de contratación (CGC) para agencias y arrendadores",
  stand: "Última actualización: 13 de agosto de 2026",
  intro: [
    "Las presentes Condiciones generales de contratación (en adelante, las «Condiciones») regulan el uso de la plataforma de software myNextDays (en adelante, la «Plataforma») por parte de agencias, arrendadores, administradores de fincas y otros usuarios profesionales (en adelante, el «Usuario»).",
    "La Plataforma es operada por myNextDays ApS, sociedad de responsabilidad limitada (anpartsselskab) de derecho danés, Hirtshalsvej 21, 9881 Bindslev, Dinamarca, inscrita en el Registro Central de Empresas de Dinamarca (CVR) con el n.º CVR 46615182 (en adelante, «myNextDays» o «nosotros»).",
    "La Plataforma se dirige exclusivamente a empresarios en el sentido del artículo 14 del Código Civil alemán (BGB) o de las disposiciones correspondientes del respectivo Estado miembro de la UE. No se dirige a consumidores.",
  ],
  sections: [
    {
      heading: "§ 1 Ámbito de aplicación",
      paragraphs: [
        "Las presentes Condiciones se aplican a todos los contratos sobre el uso de la Plataforma celebrados entre myNextDays y el Usuario, así como a todos los servicios y módulos proporcionados a través de ella.",
        "Las condiciones generales del Usuario que difieran de las presentes, las contradigan o las complementen solo pasarán a formar parte del contrato si myNextDays ha consentido expresamente su validez en forma de texto.",
      ],
    },
    {
      heading: "§ 2 Objeto del contrato y servicios",
      paragraphs: [
        "myNextDays pone a disposición del Usuario un software en la nube para la gestión de alojamientos vacacionales y establecimientos de hospedaje. El alcance funcional se desprende de la descripción de servicios vigente en cada momento e incluye, en particular:",
      "Cada objeto creado por el usuario en la plataforma se lista simultáneamente en el mercado propio de la plataforma myBestDays (canal obligatorio). El usuario no puede deseleccionar este canal individualmente; sin embargo, puede retirar un objeto de la venta en todos los canales simultáneamente o eliminarlo en cualquier momento a través de la función “Pausar venta”. Un objeto se hará visible en myBestDays solo cuando el usuario lo haya publicado y myNextDays haya aprobado el anuncio; myNextDays puede denegar o revocar la aprobación por una razón objetiva. Para las reservas a través de myBestDays, se aplicará la tarifa según el § 7.",
      ],
      list: [
        "gestión de propiedades, calendarios de ocupación y reservas (sistema de gestión de propiedades),",
        "conexión con canales de reserva de terceros (p. ej., Booking.com, Airbnb) a través de un channel manager,",
        "Publicación de ofertas a través del mercado propio de la plataforma myBestDays (canal obligatorio, véase el párrafo 2),",
        "creación de sitios web propios mediante el editor de páginas integrado,",
        "funciones de contabilidad, liquidación y análisis, incluidas las liquidaciones a propietarios,",
        "comunicación con los huéspedes y aceptación de pagos a través del procesamiento de pagos integrado (§ 5).",
      ],
    },
    {
      heading: "§ 3 Registro, cuenta y datos del Usuario",
      paragraphs: [
        "El uso de la Plataforma requiere el registro de una cuenta. El Usuario está obligado a facilitar datos veraces, actuales y completos sobre su persona y su empresa en el momento del registro y durante toda la vigencia del contrato, así como a actualizarlos sin demora en caso de cambios.",
        "Las credenciales de acceso deben mantenerse en secreto y protegerse frente al acceso de terceros. El Usuario deberá informar a myNextDays sin demora si existen indicios de un uso indebido de su cuenta.",
        "La cuenta no es transferible. El Usuario garantiza que todas las personas que utilicen la cuenta en su nombre cumplen las presentes Condiciones.",
      ],
    },
    {
      heading: "§ 4 Papel de myNextDays en las reservas",
      paragraphs: [
        "Los contratos de hospedaje sobre los alojamientos ofrecidos en la Plataforma, a través de canales de terceros conectados o a través del sitio web propio del Usuario se celebran exclusivamente entre el Usuario (o el propietario representado por este) y el respectivo huésped. myNextDays no es parte del contrato de hospedaje.",
        "El Usuario es el único responsable de la exactitud y la legalidad de los contenidos de las ofertas (descripciones, fotos, precios, disponibilidades, impuestos y tasas).",
      ],
    },
    {
      heading: "§ 5 Procesamiento de pagos a través de Stripe",
      paragraphs: [
        "Los servicios de procesamiento de pagos para agencias y arrendadores en myNextDays son prestados por Stripe y están sujetos al [Stripe Connected Account Agreement](https://stripe.com/connect-account/legal/full), que incluye las condiciones de uso de Stripe (conjuntamente, el «Contrato marco de Stripe»). Al aceptar las presentes Condiciones o continuar operando como agencia o arrendador en myNextDays, el Usuario acepta quedar vinculado por el Contrato marco de Stripe, que Stripe puede modificar ocasionalmente.",
        "Como condición para que myNextDays habilite los servicios de procesamiento de pagos a través de Stripe, el Usuario se compromete a facilitar a myNextDays información veraz y completa sobre su persona y su empresa, y autoriza a myNextDays a transmitir a Stripe dicha información, así como los datos de transacciones relacionados con el uso de los servicios de procesamiento de pagos prestados por Stripe.",
        "La relación jurídica con Stripe se rige por el texto contractual en inglés enlazado, en su versión vigente en cada momento. La entidad contratante de Stripe para los usuarios del Espacio Económico Europeo es la sociedad de Stripe designada en el Contrato marco de Stripe (actualmente Stripe Payments Europe, Limited, Irlanda). Stripe trata los datos personales de conformidad con la [política de privacidad de Stripe](https://stripe.com/privacy).",
        "Para cumplir las obligaciones legales de identificación y verificación (entre otras, la prevención del blanqueo de capitales y los requisitos de «conozca a su cliente»), myNextDays y Stripe pueden exigir en cualquier momento información y justificantes adicionales, en particular documentos de identidad, información sobre los titulares reales y los datos bancarios. Si la información o los justificantes solicitados no se facilitan dentro del plazo fijado, la aceptación de pagos o los desembolsos podrán suspenderse total o parcialmente hasta que la información esté completa.",
      ],
    },
    {
      heading: "§ 6 Desembolsos, devoluciones de cargo y saldos negativos",
      paragraphs: [
        "El circuito de pago depende del canal de reserva. En las reservas realizadas a través del motor de reservas propio del Usuario y en las reservas a través de portales de distribución conectados, los pagos de los huéspedes se reciben directamente en la cuenta de pago del Usuario; en estos casos, el Usuario es, frente al huésped, el receptor del pago y la parte contratante del servicio de alojamiento (§ 4), y myNextDays no llega en ningún momento a ser titular de dichos fondos. myNextDays no cobra ninguna comisión porcentual de reserva sobre tales reservas; la comisión por reservas a través de portales de distribución conectados se indica por separado y se factura con posterioridad.",
        "En las reservas realizadas a través del portal de reservas de myNextDays, el pago se tramita a través de myNextDays. myNextDays retiene en tal caso la comisión de intermediación indicada en la lista de precios vigente en cada momento, incluidos los costes de la tramitación del pago, y transfiere el importe restante al Usuario conforme a los apartados siguientes. La remuneración por el uso del software (§ 7) no se ve afectada.",
        "Los desembolsos se efectúan en la cuenta bancaria registrada por el Usuario. myNextDays puede ajustar la frecuencia de los desembolsos por motivos de riesgo, en particular en el caso de cuentas nuevas, patrones de transacciones inusuales o verificaciones en curso.",
        "Las devoluciones a los huéspedes las soporta económicamente el Usuario. Las devoluciones de cargo y los gastos derivados las soporta el Usuario en las reservas realizadas a través de su propio motor de reservas y a través de portales de distribución conectados, ya que en esos casos el Usuario es el receptor del pago; en las reservas realizadas a través del portal de reservas de myNextDays, myNextDays soporta el riesgo de devolución de cargo, salvo que esta se deba a un incumplimiento del Usuario (en particular, la no prestación o una desviación sustancial del servicio de alojamiento). myNextDays está facultada para compensar los importes a cargo del Usuario con desembolsos futuros.",
        "Si se genera un saldo negativo en la cuenta de pagos del Usuario, este deberá regularizarlo sin demora. El Usuario autoriza a myNextDays y a Stripe a adeudar los saldos negativos en la cuenta bancaria registrada, en la medida en que ello sea legalmente admisible.",
      ],
    },
    {
      heading: "§ 7 Tarifas y facturación",
      paragraphs: [
        "Las tarifas por el uso de la Plataforma se desprenden de la lista de precios acordada en el momento de la celebración del contrato o de la oferta individual. Todos los precios se entienden sin incluir los impuestos legales aplicables en cada caso y se expresan en la moneda indicada en el contrato.",
        "Las tarifas vinculadas a transacciones (p. ej., comisiones de pago o de canal) podrán retenerse o compensarse directamente al procesarse la transacción correspondiente.",
        "Si el Usuario incurre en mora en los pagos, myNextDays podrá, previo aviso, bloquear el acceso a la Plataforma hasta que se hayan saldado los importes pendientes.",
      ],
    },
    {
      heading: "§ 8 Obligaciones del Usuario; textos legales propios",
      paragraphs: [
        "El Usuario garantiza que sus ofertas, contenidos y prácticas comerciales cumplen la legislación aplicable en cada caso, en particular la normativa en materia de hospedaje, registro de viajeros, fiscalidad y protección de los consumidores en el lugar del alojamiento. El Usuario mantiene bajo su propia responsabilidad las autorizaciones, los registros y las licencias necesarios.",
        "El Usuario es responsable de los sitios web que opere a través del editor de páginas, así como de sus ofertas en la Plataforma; esto incluye, en particular, sus propias condiciones generales para huéspedes, su propio aviso legal y su propia información de protección de datos.",
        "Queda prohibido, en particular: publicar ofertas inexactas o engañosas, tramitar operaciones ficticias o transacciones fraudulentas, eludir el procesamiento de pagos conforme al § 5 para las reservas celebradas a través de la Plataforma, así como cualquier uso que menoscabe la seguridad o la disponibilidad de la Plataforma.",
      ],
    },
    {
      heading: "§ 9 Canales de reserva de terceros",
      paragraphs: [
        "Al conectar canales de terceros (p. ej., Booking.com, Airbnb) se aplican adicionalmente las condiciones del respectivo operador del canal. El Usuario celebra por sí mismo con el operador del canal los contratos necesarios a tal efecto.",
        "myNextDays se encarga de la sincronización técnica de disponibilidades, precios y datos de reserva, pero no tiene influencia alguna sobre los contenidos, las comisiones o las decisiones de los operadores de los canales y no responde de su disponibilidad.",
      ],
    },
    {
      heading: "§ 10 Disponibilidad y desarrollo continuo",
      paragraphs: [
        "myNextDays presta los servicios con la diligencia de un ordenado comerciante y aspira a una alta disponibilidad de la Plataforma. Las ventanas de mantenimiento, los desarrollos y las circunstancias ajenas al control de myNextDays (p. ej., incidencias en proveedores terceros) pueden limitar temporalmente la disponibilidad.",
        "myNextDays podrá seguir desarrollando la Plataforma y modificar funciones, siempre que ello no ponga en peligro la finalidad del contrato y la modificación sea razonablemente exigible para el Usuario.",
      ],
    },
    {
      heading: "§ 11 Datos y protección de datos",
      paragraphs: [
        "En la medida en que myNextDays trate datos personales por cuenta del Usuario al prestar la Plataforma (en particular, datos de huéspedes), las partes celebrarán un acuerdo de encargo de tratamiento conforme al art. 28 del RGPD.",
        "El Usuario sigue siendo responsable de la licitud, en materia de protección de datos, de la recogida y el tratamiento de los datos que aporte. Los detalles del tratamiento de datos por parte de myNextDays se recogen en la información de protección de datos de la Plataforma; al tratamiento de datos por parte de Stripe se aplica el § 5.",
      ],
    },
    {
      heading: "§ 12 Uso de inteligencia artificial",
      paragraphs: [
        "myNextDays emplea sistemas de IA en determinadas funciones, en particular para recomendaciones de precios (dynamic pricing), para sugerencias de respuesta en la bandeja de entrada de mensajes y para la asistencia en el soporte. Estas funciones generan propuestas; la decisión sobre su utilización y la responsabilidad por ella corresponden al Usuario. Las recomendaciones de precios no sustituyen un examen comercial propio.",
        "Cuando los huéspedes interactúan directamente con un sistema de IA, se les informa de ello (artículo 50, apartado 1, del Reglamento (UE) 2024/1689 — «Reglamento de Inteligencia Artificial»). Los textos que un sistema de IA haya generado o modificado sustancialmente y que el Usuario transmita a los huéspedes deberán ser identificados como tales por el Usuario, en la medida en que le incumba una obligación legal al respecto.",
        "myNextDays no opera sistemas de IA que, conforme al anexo III del Reglamento de Inteligencia Artificial, se consideren sistemas de alto riesgo, ni prácticas prohibidas conforme al artículo 5 del Reglamento de Inteligencia Artificial. Las entradas del Usuario y los datos de sus huéspedes no se utilizan para el entrenamiento de modelos sin un encargo específico.",
        "El Usuario no podrá utilizar las funciones de IA para dar a los huéspedes la apariencia de una comunicación humana allí donde exista un deber de información, ni para emitir declaraciones jurídicamente vinculantes sin un examen propio.",
        "Si el Usuario conecta su cuenta, a través de la interfaz prevista a tal efecto, con un asistente de IA propio (por ejemplo, Claude de Anthropic), se aplicará lo siguiente: el Usuario celebra por sí mismo el contrato sobre ese servicio y es responsable de su utilización. La conexión constituye su instrucción a myNextDays de comunicar allí los datos habilitados — incluida una transferencia a un tercer país si el proveedor tiene su sede fuera de la Unión Europea. El Usuario se asegura de que dispone de una base jurídica para ello, de que su propia información de protección de datos identifica al destinatario y de que concurren las garantías exigidas para la transferencia.",
        "Para una conexión de este tipo, el Usuario empleará un acceso para el que el proveedor ofrezca un encargo de tratamiento y excluya la utilización de los datos para el entrenamiento de modelos — en el caso de Claude, se trata de los accesos para clientes empresariales (Team, Enterprise o API). Los accesos para uso privado no cumplen habitualmente este requisito; por ello no son adecuados para datos de huéspedes. myNextDays no puede reconocer qué acceso utiliza el Usuario y así lo advierte en el cuadro de diálogo de consentimiento.",
        "El Usuario tendrá en cuenta que los contenidos que copie manualmente desde la interfaz de usuario en un campo de entrada del asistente no quedan habitualmente cubiertos por las restricciones contractuales del proveedor — a diferencia de los datos consultados a través de la interfaz.",
        "Los datos procedentes de un portal de reservas los utilizará el Usuario, también a través de la interfaz, únicamente para la gestión y la atención de la respectiva reserva — no para la evaluación de personas, la elaboración de perfiles o la publicidad. Los portales establecen esta vinculación a la finalidad en sus propias condiciones.",
      ],
    },
    {
      heading: "§ 13 Reclamaciones y mediación",
      paragraphs: [
        "myNextDays mantiene para los usuarios profesionales un sistema interno de gestión de reclamaciones gratuito (artículo 11 del Reglamento (UE) 2019/1150 — «Reglamento P2B»). Las reclamaciones — en particular las relativas a supuestas infracciones de las presentes Condiciones, a problemas técnicos con repercusión considerable o a medidas de myNextDays frente al Usuario — pueden presentarse sin sujeción a forma alguna en info@mynextdays.dk o a través del soporte en la aplicación. Se confirmará su recepción; la tramitación se realizará con celeridad y en un plazo razonable, por regla general en un plazo de 14 días en los casos sencillos. El resultado se comunicará al Usuario en un lenguaje claro.",
        "Si en el procedimiento de reclamación no se alcanza un acuerdo, myNextDays está dispuesta a dirigirse junto con el Usuario, con carácter extrajudicial, a los siguientes mediadores (artículo 12 del Reglamento P2B): (1) WIPO Arbitration and Mediation Center, 34 chemin des Colombettes, 1211 Ginebra 20, Suiza — procedimientos también a distancia y multilingües; (2) Voldgiftsinstituttet — Danish Institute of Arbitration, Kronprinsessegade 28, 1306 Copenhague K, Dinamarca — Estado del domicilio social de la operadora.",
        "La designación no obliga al Usuario a llevar a cabo un procedimiento de mediación; el derecho a acudir a los tribunales permanece inalterado. myNextDays participa en los costes razonables de una mediación; el reparto se rige por el reglamento del respectivo mediador y por las circunstancias del caso concreto.",
        "myNextDays publica anualmente información sobre el número de reclamaciones, la duración de su tramitación y las medidas adoptadas.",
      ],
    },
    {
      heading: "§ 14 Propiedad intelectual",
      paragraphs: [
        "Todos los derechos sobre la Plataforma, su software y sus contenidos (a excepción de los contenidos publicados por el Usuario) corresponden a myNextDays o a sus licenciantes. Durante la vigencia del contrato, el Usuario recibe un derecho simple e intransferible a utilizar la Plataforma en el alcance acordado contractualmente.",
        "Sobre los contenidos que publique, el Usuario concede a myNextDays los derechos de uso simples necesarios para la explotación de la Plataforma (en particular, para su almacenamiento, reproducción, visualización y transmisión a los canales conectados).",
      ],
    },
    {
      heading: "§ 15 Responsabilidad",
      paragraphs: [
        "myNextDays responde de forma ilimitada en caso de dolo y negligencia grave, así como de los daños derivados de lesiones a la vida, la integridad física o la salud.",
        "En caso de negligencia leve, myNextDays solo responde por el incumplimiento de obligaciones contractuales esenciales (obligaciones cardinales), limitándose a los daños previsibles y típicos del contrato. La responsabilidad derivada de la legislación sobre responsabilidad por productos defectuosos, así como de las garantías asumidas, permanece inalterada.",
        "En caso de pérdida de datos, myNextDays solo responde en la medida en que el daño se hubiera producido igualmente si el Usuario hubiera realizado copias de seguridad correctas y periódicas de los datos, salvo que la copia de seguridad de los datos incumba contractualmente a myNextDays.",
      ],
    },
    {
      heading: "§ 16 Duración, resolución y bloqueo",
      paragraphs: [
        "La duración y los plazos de preaviso se desprenden del contrato correspondiente. El derecho a la resolución extraordinaria por causa justificada permanece inalterado.",
        "myNextDays podrá bloquear temporalmente el acceso a la Plataforma o a funciones concretas (incluidas la aceptación de pagos y los desembolsos) si existen indicios concretos de una infracción de las presentes Condiciones, de fraude o de un uso abusivo, o si myNextDays está obligada a ello por ley o por orden de un proveedor de servicios de pago. El Usuario será informado del bloqueo en la medida en que ello sea legalmente admisible.",
        "Tras la finalización del contrato, myNextDays pondrá a disposición del Usuario, previa solicitud, sus datos para su exportación en un formato habitual en un plazo de 30 días; después, los datos se eliminarán, salvo que existan obligaciones legales de conservación que lo impidan.",
      ],
    },
    {
      heading: "§ 17 Modificaciones de las presentes Condiciones",
      paragraphs: [
        "myNextDays podrá modificar las presentes Condiciones con efectos para el futuro, siempre que ello sea necesario por motivos justificados (en particular, cambios legislativos, cambios en la jurisprudencia o requisitos de los proveedores de servicios de pago) y el Usuario no resulte perjudicado de forma desproporcionada.",
        "Las modificaciones se anunciarán al Usuario en forma de texto al menos seis semanas antes de su entrada en vigor. Si el Usuario no se opone dentro del plazo de anuncio o continúa utilizando la Plataforma tras la entrada en vigor, las Condiciones modificadas se considerarán aceptadas; en el anuncio se advertirá expresamente de esta consecuencia.",
      ],
    },
    {
      heading: "§ 18 Disposiciones finales",
      paragraphs: [
        "Se aplicará el Derecho del Estado en el que la operadora tenga su domicilio social, con exclusión de la Convención de las Naciones Unidas sobre los Contratos de Compraventa Internacional de Mercaderías. Las disposiciones imperativas del Estado en el que el Usuario tenga su domicilio social permanecen inalteradas.",
        "El fuero exclusivo para todos los litigios derivados de este contrato o relacionados con él será — en la medida en que sea legalmente admisible — el del domicilio social de la operadora.",
        "Si alguna disposición de las presentes Condiciones fuera o deviniera ineficaz, ello no afectará a la validez de las restantes disposiciones.",
      ],
    },
  ],
};
