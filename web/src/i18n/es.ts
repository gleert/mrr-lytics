export default {
  // Meta
  meta: {
    title: 'MRRlytics - Analytics para WHMCS',
    description: 'Plataforma de analytics para datos de facturación de WHMCS. Rastrea MRR, churn, tendencias de ingresos y más.',
  },

  // Header
  header: {
    features: 'Características',
    pricing: 'Precios',
    faq: 'FAQ',
    signIn: 'Iniciar sesión',
    getStarted: 'Comenzar',
  },

  // Hero
  hero: {
    badge: 'Diseñado para WHMCS',
    title: 'Convierte datos en',
    titleHighlight: 'insights',
    subtitle: 'Analytics en tiempo real de MRR, churn y tendencias de ingresos para tu hosting.',
    ctaPrimary: 'Prueba Gratis',
    ctaSecondary: 'Ver Características',
    socialProof: 'Prueba gratuita de 14 días • Sin tarjeta de crédito • Cancela cuando quieras',
    // Dashboard mock
    mrr: 'MRR',
    activeClients: 'Clientes Activos',
    churnRate: 'Tasa de Churn',
    arpu: 'ARPU',
  },

  // Features
  features: {
    title: 'Todo lo que necesitas para entender tu negocio',
    subtitle: 'Herramientas de analytics potentes diseñadas específicamente para empresas de hosting que usan WHMCS.',
    items: {
      mrrTracking: {
        title: 'Seguimiento de MRR en Tiempo Real',
        description: 'Monitorea tu Ingreso Mensual Recurrente en tiempo real. Ve tendencias, tasas de crecimiento y proyecciones de un vistazo.',
      },
      churnAnalysis: {
        title: 'Análisis de Churn',
        description: 'Identifica clientes en riesgo antes de que se vayan. Recibe alertas sobre patrones de cancelación y actúa temprano.',
      },
      revenueBreakdown: {
        title: 'Desglose de Ingresos',
        description: 'Entiende tus ingresos por producto, categoría o ciclo de facturación. Sabe exactamente de dónde viene tu dinero.',
      },
      clientInsights: {
        title: 'Insights de Clientes',
        description: 'Profundiza en el valor de vida del cliente, costos de adquisición y métricas de retención para decisiones más inteligentes.',
      },
      forecasting: {
        title: 'Pronósticos',
        description: 'Predicciones impulsadas por IA para ingresos futuros basadas en datos históricos y tendencias actuales.',
      },
      instantSync: {
        title: 'Sincronización Instantánea',
        description: 'Conecta tu WHMCS en minutos. Los datos se sincronizan automáticamente para que siempre tengas la información más reciente.',
      },
    },
  },

  // Pricing
  pricing: {
    title: 'Precios simples y transparentes',
    subtitle: 'Empieza gratis y escala a medida que creces. Sin costos ocultos, cancela cuando quieras.',
    mostPopular: 'Más Popular',
    perMonth: '/mes',
    plans: {
      free: {
        name: 'Gratis',
        description: 'Perfecto para empezar',
        features: [
          '1 instancia de WHMCS',
          'Seguimiento básico de MRR',
          'Últimos 30 días de datos',
          '1 webhook',
          'Soporte de comunidad',
        ],
        cta: 'Comenzar',
      },
      starter: {
        name: 'Starter',
        description: 'Para negocios de hosting en crecimiento',
        features: [
          '2 instancias de WHMCS',
          'Analytics completo de MRR y churn',
          '1 año de datos históricos',
          '3 webhooks',
          'Pronóstico de ingresos',
          'Soporte por email',
        ],
        cta: 'Prueba Gratis',
      },
      pro: {
        name: 'Pro',
        description: 'Para empresas establecidas',
        features: [
          '5 instancias de WHMCS',
          'Analytics e informes avanzados',
          'Datos históricos ilimitados',
          '10 webhooks',
          'Categorías personalizadas',
          'Acceso a API',
          'Soporte prioritario',
        ],
        cta: 'Prueba Gratis',
      },
      business: {
        name: 'Business',
        description: 'Para grandes organizaciones',
        features: [
          'Instancias de WHMCS ilimitadas',
          'Informes white-label',
          'Integraciones personalizadas',
          '100 webhooks',
          'Account manager dedicado',
          'Garantía de SLA',
          'Asistencia de onboarding',
        ],
        cta: 'Contactar Ventas',
      },
    },
  },

  // FAQ
  faq: {
    title: 'Preguntas frecuentes',
    subtitle: '¿No encuentras lo que buscas?',
    contactTeam: 'Contacta a nuestro equipo',
    items: [
      {
        question: '¿Cómo se conecta MRRlytics a mi WHMCS?',
        answer: 'MRRlytics utiliza la API oficial de WHMCS para sincronizar tus datos de facturación de forma segura. Simplemente proporcionas tu URL de WHMCS y credenciales de API, y nosotros nos encargamos del resto. Tus datos están encriptados en tránsito y en reposo.',
      },
      {
        question: '¿Con qué frecuencia se sincronizan mis datos?',
        answer: 'Los datos se sincronizan automáticamente cada 24 horas. Los planes Pro y Business pueden configurar sincronizaciones más frecuentes o activar sincronizaciones manuales cuando lo necesiten.',
      },
      {
        question: '¿Puedo conectar múltiples instalaciones de WHMCS?',
        answer: '¡Sí! El número de instancias de WHMCS que puedes conectar depende de tu plan. Gratis permite 1 instancia, Starter permite 2, Pro permite 5, y Business tiene instancias ilimitadas.',
      },
      {
        question: '¿Están seguros mis datos?',
        answer: 'Absolutamente. Utilizamos encriptación estándar de la industria (AES-256) para datos en reposo y TLS 1.3 para datos en tránsito. Nunca almacenamos tus contraseñas de administrador de WHMCS, solo credenciales de API con acceso de solo lectura.',
      },
      {
        question: '¿Qué pasa si cancelo mi suscripción?',
        answer: 'Puedes cancelar en cualquier momento. Tus datos se conservarán durante 30 días después de la cancelación, dándote tiempo para exportar lo que necesites. Después de eso, todos los datos se eliminan permanentemente.',
      },
      {
        question: '¿Ofrecen reembolsos?',
        answer: 'Sí, ofrecemos una garantía de devolución de dinero de 14 días en todos los planes de pago. Si no estás satisfecho, contáctanos dentro de los 14 días de tu compra para un reembolso completo.',
      },
    ],
  },

  // About
  about: {
    meta: {
      title: 'Sobre MRRlytics - Nuestra Historia',
      description: 'Conoce al equipo detrás de MRRlytics y nuestra misión de ayudar a las empresas de hosting a crecer con insights basados en datos.',
    },
    hero: {
      title: 'Creado por profesionales del hosting,',
      titleHighlight: 'para profesionales del hosting',
      subtitle: 'Entendemos los desafíos de dirigir un negocio de hosting porque hemos estado ahí. MRRlytics nació de nuestra propia necesidad de mejores analytics.',
    },
    mission: {
      title: 'Nuestra Misión',
      description: 'Empoderar a las empresas de hosting con los insights que necesitan para tomar decisiones más inteligentes, reducir el churn y crecer de manera sostenible.',
    },
    story: {
      title: 'Nuestra Historia',
      paragraphs: [
        'MRRlytics comenzó en 2023 cuando nuestros fundadores, dirigiendo su propia empresa de hosting, se dieron cuenta de que pasaban horas cada semana calculando manualmente el MRR, analizando el churn y construyendo informes en hojas de cálculo.',
        'Sabían que tenía que haber una mejor manera. Después de buscar una solución y no encontrar nada que realmente entendiera la industria del hosting, decidieron construirla ellos mismos.',
        'Hoy, MRRlytics ayuda a cientos de empresas de hosting en todo el mundo a entender mejor su negocio, identificar oportunidades de crecimiento y reducir la pérdida de clientes.',
      ],
    },
    values: {
      title: 'Nuestros Valores',
      items: [
        {
          title: 'Transparencia',
          description: 'Creemos en la comunicación clara y honesta. Sin tarifas ocultas, sin cargos sorpresa, sin métricas confusas.',
        },
        {
          title: 'Privacidad Primero',
          description: 'Tus datos te pertenecen. Nunca vendemos ni compartimos tu información con terceros.',
        },
        {
          title: 'Enfoque en el Cliente',
          description: 'Cada función que construimos comienza con una necesidad real del cliente. Tu feedback da forma a nuestra hoja de ruta.',
        },
        {
          title: 'Mejora Continua',
          description: 'Siempre estamos aprendiendo, iterando y mejorando. La mejor versión de MRRlytics siempre es la próxima.',
        },
      ],
    },
    team: {
      title: 'Conoce al Equipo',
      subtitle: 'Un equipo pequeño y apasionado dedicado a ayudarte a tener éxito.',
    },
    cta: {
      title: '¿Listo para empezar?',
      subtitle: 'Únete a cientos de empresas de hosting que ya usan MRRlytics.',
      button: 'Prueba Gratis',
    },
  },

  // Contact
  contact: {
    meta: {
      title: 'Contacto MRRlytics - Contáctanos',
      description: '¿Tienes preguntas sobre MRRlytics? Contacta a nuestro equipo para consultas de ventas, soporte u oportunidades de colaboración.',
    },
    hero: {
      title: 'Contáctanos',
      subtitle: '¿Tienes alguna pregunta o quieres saber más? Nos encantaría saber de ti.',
    },
    form: {
      name: 'Nombre',
      namePlaceholder: 'Tu nombre',
      email: 'Email',
      emailPlaceholder: 'tu@empresa.com',
      subject: 'Asunto',
      subjectPlaceholder: '¿Cómo podemos ayudarte?',
      message: 'Mensaje',
      messagePlaceholder: 'Cuéntanos más sobre tus necesidades...',
      submit: 'Enviar Mensaje',
      sending: 'Enviando...',
      successMessage: 'Tu mensaje ha sido enviado. Te responderemos en menos de 24 horas.',
      errorMessage: 'Algo salió mal. Por favor, inténtalo de nuevo.',
    },
    info: {
      title: 'Otras formas de contactarnos',
      email: {
        label: 'Email',
        value: 'hello@mrrlytics.com',
        description: 'Para consultas generales',
      },
      sales: {
        label: 'Ventas',
        value: 'sales@mrrlytics.com',
        description: 'Para precios y planes enterprise',
      },
      support: {
        label: 'Soporte',
        value: 'support@mrrlytics.com',
        description: 'Para clientes existentes',
      },
    },
    faq: {
      title: 'Preguntas comunes',
      items: [
        {
          question: '¿Cuál es el tiempo de respuesta típico?',
          answer: 'Normalmente respondemos en 24 horas en días laborables.',
        },
        {
          question: '¿Ofrecen demos?',
          answer: '¡Sí! Estaremos encantados de mostrarte MRRlytics. Solo menciónalo en tu mensaje.',
        },
        {
          question: '¿Hay soporte telefónico?',
          answer: 'El soporte telefónico está disponible para clientes del plan Business. De lo contrario, el email es la mejor forma de contactarnos.',
        },
      ],
    },
  },

  // Privacy
  privacy: {
    meta: {
      title: 'Política de Privacidad - MRRlytics',
      description: 'Conoce cómo MRRlytics recopila, usa y protege tu información personal.',
    },
    title: 'Política de Privacidad',
    lastUpdated: 'Última actualización: Febrero 2024',
    sections: [
      {
        title: 'Introducción',
        content: 'En MRRlytics, nos tomamos tu privacidad en serio. Esta Política de Privacidad explica cómo recopilamos, usamos, divulgamos y protegemos tu información cuando usas nuestro servicio. Por favor, lee esta política detenidamente.',
      },
      {
        title: 'Información que Recopilamos',
        content: 'Recopilamos información que nos proporcionas directamente, como cuando creas una cuenta, conectas tu instalación de WHMCS o nos contactas para soporte. Esto incluye:\n\n• Información de cuenta (nombre, email, contraseña)\n• Credenciales de API de WHMCS (almacenadas encriptadas)\n• Datos de facturación sincronizados de tu instalación de WHMCS\n• Datos de uso y analytics\n• Comunicaciones con nuestro equipo de soporte',
      },
      {
        title: 'Cómo Usamos tu Información',
        content: 'Usamos la información que recopilamos para:\n\n• Proporcionar, mantener y mejorar nuestros servicios\n• Procesar transacciones y enviar información relacionada\n• Enviar avisos técnicos, actualizaciones y mensajes de soporte\n• Responder a tus comentarios y preguntas\n• Analizar patrones de uso para mejorar la experiencia\n• Detectar, investigar y prevenir transacciones fraudulentas',
      },
      {
        title: 'Seguridad de Datos',
        content: 'Implementamos medidas de seguridad estándar de la industria para proteger tus datos. Todos los datos están encriptados en tránsito usando TLS 1.3 y en reposo usando encriptación AES-256. Las credenciales de API se almacenan usando encriptación unidireccional y nunca son visibles para nuestro personal.',
      },
      {
        title: 'Retención de Datos',
        content: 'Retenemos tu información personal mientras tu cuenta esté activa o según sea necesario para proporcionarte servicios. Si eliminas tu cuenta, eliminaremos tus datos en 30 días, excepto donde estemos obligados a retenerlos por motivos legales.',
      },
      {
        title: 'Servicios de Terceros',
        content: 'Podemos compartir tu información con proveedores de servicios terceros que realizan servicios en nuestro nombre, como procesamiento de pagos, análisis de datos y envío de emails. Estos proveedores están obligados contractualmente a mantener tu información confidencial.',
      },
      {
        title: 'Tus Derechos',
        content: 'Tienes derecho a:\n\n• Acceder a tus datos personales\n• Corregir datos inexactos\n• Solicitar la eliminación de tus datos\n• Exportar tus datos en un formato portable\n• Darte de baja de comunicaciones de marketing\n\nPara ejercer estos derechos, contáctanos en privacy@mrrlytics.com.',
      },
      {
        title: 'Cookies',
        content: 'Usamos cookies esenciales para mantener tu sesión y preferencias. No usamos cookies de seguimiento de terceros. Puedes desactivar las cookies en la configuración de tu navegador, pero algunas funciones pueden no funcionar correctamente.',
      },
      {
        title: 'Cambios a Esta Política',
        content: 'Podemos actualizar esta Política de Privacidad de vez en cuando. Te notificaremos de cualquier cambio publicando la nueva política en esta página y actualizando la fecha de "Última actualización".',
      },
      {
        title: 'Contáctanos',
        content: 'Si tienes preguntas sobre esta Política de Privacidad, contáctanos en privacy@mrrlytics.com.',
      },
    ],
  },

  // Terms of Service
  terms: {
    meta: {
      title: 'Términos de Servicio - MRRlytics',
      description: 'Lee los términos y condiciones de uso de la plataforma de analytics MRRlytics.',
    },
    title: 'Términos de Servicio',
    lastUpdated: 'Última actualización: Febrero 2024',
    sections: [
      {
        title: '1. Aceptación de Términos',
        content: 'Al acceder o usar MRRlytics ("Servicio"), aceptas estar sujeto a estos Términos de Servicio ("Términos"). Si no estás de acuerdo con estos Términos, no puedes usar el Servicio. Nos reservamos el derecho de modificar estos Términos en cualquier momento, y dichas modificaciones serán efectivas inmediatamente después de su publicación.',
      },
      {
        title: '2. Descripción del Servicio',
        content: 'MRRlytics es una plataforma de analytics diseñada para ayudar a empresas de hosting a rastrear y analizar sus datos de facturación de WHMCS. El Servicio incluye funciones como seguimiento de MRR, análisis de churn, previsión de ingresos y herramientas de informes. Nos reservamos el derecho de modificar, suspender o discontinuar cualquier aspecto del Servicio en cualquier momento.',
      },
      {
        title: '3. Registro de Cuenta',
        content: 'Para usar el Servicio, debes crear una cuenta y proporcionar información precisa y completa. Eres responsable de:\n\n• Mantener la confidencialidad de tus credenciales de cuenta\n• Todas las actividades que ocurran bajo tu cuenta\n• Notificarnos inmediatamente de cualquier uso no autorizado\n• Asegurar que tu información de contacto permanezca actualizada',
      },
      {
        title: '4. Suscripción y Facturación',
        content: 'Las suscripciones de pago se facturan por adelantado de forma mensual o anual. Al suscribirte a un plan de pago, nos autorizas a cargar tu método de pago. Las suscripciones se renuevan automáticamente a menos que se cancelen antes de la fecha de renovación. Los precios pueden cambiar con 30 días de aviso. No se proporcionan reembolsos por períodos de facturación parciales, excepto según lo exija la ley o según lo establecido en nuestra política de reembolsos.',
      },
      {
        title: '5. Uso Aceptable',
        content: 'Aceptas no:\n\n• Usar el Servicio para cualquier propósito ilegal\n• Intentar obtener acceso no autorizado a nuestros sistemas\n• Interferir con o interrumpir el Servicio\n• Realizar ingeniería inversa o descompilar el Servicio\n• Compartir tus credenciales de cuenta con terceros\n• Usar el Servicio para competir directamente con MRRlytics\n• Exceder los límites de velocidad o abusar del acceso a la API',
      },
      {
        title: '6. Datos y Privacidad',
        content: 'Tu uso del Servicio también está regido por nuestra Política de Privacidad. Al usar el Servicio, consientes la recopilación y uso de tus datos como se describe en la Política de Privacidad. Conservas la propiedad de tus datos, y nos otorgas una licencia limitada para usarlos únicamente para proporcionar el Servicio.',
      },
      {
        title: '7. Integración con WHMCS',
        content: 'El Servicio se conecta a tu instalación de WHMCS a través de API. Eres responsable de asegurarte de que tienes derecho a compartir tus datos de WHMCS con nosotros. Solo accedemos a los datos necesarios para proporcionar nuestras funciones de analytics. Recomendamos usar credenciales de API con acceso de solo lectura para mayor seguridad.',
      },
      {
        title: '8. Propiedad Intelectual',
        content: 'El Servicio y su contenido original, características y funcionalidad son propiedad de MRRlytics y están protegidos por leyes internacionales de derechos de autor, marcas comerciales y otras leyes de propiedad intelectual. Nuestras marcas comerciales no pueden usarse sin consentimiento previo por escrito.',
      },
      {
        title: '9. Descargo de Garantías',
        content: 'EL SERVICIO SE PROPORCIONA "TAL CUAL" SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS. NO GARANTIZAMOS QUE EL SERVICIO SERÁ ININTERRUMPIDO, LIBRE DE ERRORES O SEGURO. RENUNCIAMOS A TODAS LAS GARANTÍAS INCLUYENDO COMERCIABILIDAD, IDONEIDAD PARA UN PROPÓSITO PARTICULAR Y NO INFRACCIÓN.',
      },
      {
        title: '10. Limitación de Responsabilidad',
        content: 'EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, MRRLYTICS NO SERÁ RESPONSABLE DE NINGÚN DAÑO INDIRECTO, INCIDENTAL, ESPECIAL, CONSECUENTE O PUNITIVO, INCLUYENDO PÉRDIDA DE BENEFICIOS, DATOS U OPORTUNIDADES DE NEGOCIO. NUESTRA RESPONSABILIDAD TOTAL NO EXCEDERÁ LA CANTIDAD PAGADA POR TI EN LOS DOCE MESES ANTERIORES A LA RECLAMACIÓN.',
      },
      {
        title: '11. Indemnización',
        content: 'Aceptas indemnizar y mantener indemne a MRRlytics y sus oficiales, directores, empleados y agentes de cualquier reclamación, daño, pérdida o gasto que surja de tu uso del Servicio o violación de estos Términos.',
      },
      {
        title: '12. Terminación',
        content: 'Podemos terminar o suspender tu cuenta en cualquier momento por violaciones de estos Términos. Tras la terminación, tu derecho a usar el Servicio cesa inmediatamente. Las disposiciones que por su naturaleza deben sobrevivir a la terminación sobrevivirán, incluyendo derechos de propiedad intelectual, descargos y limitaciones de responsabilidad.',
      },
      {
        title: '13. Ley Aplicable',
        content: 'Estos Términos se regirán e interpretarán de acuerdo con las leyes de la jurisdicción en la que opera MRRlytics, sin tener en cuenta los principios de conflicto de leyes. Cualquier disputa se resolverá en los tribunales de esa jurisdicción.',
      },
      {
        title: '14. Contacto',
        content: 'Si tienes preguntas sobre estos Términos, contáctanos en legal@mrrlytics.com.',
      },
    ],
  },

  // Docs
  docs: {
    meta: {
      title: 'Documentaci\u00f3n - MRRlytics',
      description: 'Aprende a configurar MRRlytics, conectar tu instalaci\u00f3n WHMCS y sacar el m\u00e1ximo partido a tus analytics.',
    },
    hero: {
      title: 'Documentaci\u00f3n',
      subtitle: 'Todo lo que necesitas para configurar y aprovechar al m\u00e1ximo MRRlytics.',
    },
    nav: {
      gettingStarted: 'Primeros Pasos',
      connectWhmcs: 'Conectar WHMCS',
      whmcsModule: 'M\u00f3dulo WHMCS',
    },
    gettingStarted: {
      meta: {
        title: 'Primeros Pasos - Docs MRRlytics',
        description: 'Empieza con MRRlytics en minutos. Crea tu cuenta, configura tu organizaci\u00f3n y conecta tu WHMCS.',
      },
      title: 'Primeros Pasos',
      subtitle: 'Configura MRRlytics en menos de 5 minutos y empieza a monitorizar las m\u00e9tricas de tu negocio de hosting.',
      steps: [
        {
          title: '1. Crea tu cuenta',
          content: 'Ve a app.mrrlytics.com y reg\u00edstrate con tu cuenta de Google o direcci\u00f3n de email. Tu cuenta es gratuita e incluye un plan free con analytics b\u00e1sicos.',
        },
        {
          title: '2. Configura tu organizaci\u00f3n',
          content: 'Despu\u00e9s de iniciar sesi\u00f3n por primera vez, MRRlytics crear\u00e1 autom\u00e1ticamente tu organizaci\u00f3n (tenant). Este es tu espacio de trabajo donde viven todas tus instancias WHMCS, miembros del equipo y datos. Puedes renombrarlo desde Ajustes > General.',
        },
        {
          title: '3. A\u00f1ade tu primera instancia WHMCS',
          content: 'Navega a Ajustes > Instancias y haz clic en "A\u00f1adir Instancia". Necesitar\u00e1s:\n\n- Un nombre para esta instancia (ej. "WHMCS Producci\u00f3n")\n- La URL de tu WHMCS (ej. https://billing.tudominio.com)\n- Credenciales API de WHMCS (Identificador y Secreto)\n\nPara crear credenciales API en WHMCS, ve a Configuraci\u00f3n > Gesti\u00f3n de Personal > Credenciales API y crea una nueva credencial. Recomendamos usar permisos de solo lectura.',
        },
        {
          title: '4. Ejecuta tu primera sincronizaci\u00f3n',
          content: 'Una vez configurada la instancia, haz clic en "Sincronizar Ahora" para iniciar la importaci\u00f3n de datos. Esto puede tardar unos minutos dependiendo del tama\u00f1o de tu base de datos WHMCS. Cuando termine, tu dashboard mostrar\u00e1 tu MRR, tasa de churn y otras m\u00e9tricas clave.',
        },
        {
          title: '5. Explora tu dashboard',
          content: 'Tu dashboard ahora muestra m\u00e9tricas en tiempo real incluyendo:\n\n- Ingresos Recurrentes Mensuales (MRR) con tendencia\n- Clientes activos y tasa de churn\n- Desglose de ingresos por producto y categor\u00eda\n- Insights de clientes y productos principales\n\nLos datos se sincronizan autom\u00e1ticamente cada 15 minutos, as\u00ed que tus m\u00e9tricas est\u00e1n siempre actualizadas.',
        },
      ],
      nextSteps: {
        title: 'Pr\u00f3ximos pasos',
        items: [
          'Configura categor\u00edas para agrupar tus productos y mejorar el an\u00e1lisis de ingresos',
          'Configura webhooks para recibir notificaciones en tiempo real',
          'Invita a miembros del equipo para colaborar en tus analytics',
          'Instala el m\u00f3dulo WHMCS para una recolecci\u00f3n de datos mejorada',
        ],
      },
    },
    connectWhmcs: {
      meta: {
        title: 'Conectar WHMCS - Docs MRRlytics',
        description: 'Aprende a conectar tu instalaci\u00f3n WHMCS a MRRlytics usando credenciales API.',
      },
      title: 'Conectar WHMCS',
      subtitle: 'Gu\u00eda paso a paso para conectar tu instalaci\u00f3n WHMCS a MRRlytics v\u00eda API.',
      sections: [
        {
          title: 'Requisitos previos',
          content: 'Antes de conectar tu WHMCS, aseg\u00farate de tener:\n\n- Acceso de administrador a tu instalaci\u00f3n WHMCS\n- WHMCS versi\u00f3n 8.0 o superior\n- Acceso API habilitado en WHMCS (Configuraci\u00f3n > Ajustes Generales > Seguridad > Permitir Acceso API)\n- Una cuenta de MRRlytics con una organizaci\u00f3n configurada',
        },
        {
          title: 'Paso 1: Crear credenciales API en WHMCS',
          content: 'En tu panel de administraci\u00f3n de WHMCS:\n\n1. Ve a Configuraci\u00f3n > Gesti\u00f3n de Personal > Credenciales API\n2. Haz clic en "Generar Nueva Credencial API"\n3. A\u00f1ade una descripci\u00f3n como "Integraci\u00f3n MRRlytics"\n4. Configura los permisos de acceso. MRRlytics necesita acceso de lectura a:\n   - Clientes\n   - Productos/Servicios\n   - Facturas\n   - Dominios\n   - Solicitudes de Cancelaci\u00f3n\n5. Copia el Identificador API y el Secreto API',
        },
        {
          title: 'Paso 2: A\u00f1adir la instancia en MRRlytics',
          content: 'En tu dashboard de MRRlytics:\n\n1. Navega a Ajustes > Instancias\n2. Haz clic en "A\u00f1adir Instancia"\n3. Rellena el formulario:\n   - Nombre: Un nombre descriptivo para esta instalaci\u00f3n WHMCS\n   - URL WHMCS: La URL completa de tu admin WHMCS (ej. https://billing.ejemplo.com)\n   - Identificador API: Pega desde WHMCS\n   - Secreto API: Pega desde WHMCS\n4. Haz clic en "Guardar"\n\nMRRlytics validar\u00e1 la conexi\u00f3n y confirmar\u00e1 que funciona.',
        },
        {
          title: 'Paso 3: Sincronizaci\u00f3n inicial',
          content: 'Despu\u00e9s de a\u00f1adir la instancia, inicia tu primera sincronizaci\u00f3n haciendo clic en "Sincronizar Ahora". La sincronizaci\u00f3n inicial importa:\n\n- Todos los clientes activos y sus servicios\n- Cat\u00e1logo de productos y grupos de productos\n- Historial de facturas\n- Registros de dominios\n- Solicitudes de cancelaci\u00f3n\n\nEsto puede tardar entre 2 y 10 minutos dependiendo del tama\u00f1o de tu base de datos.',
        },
        {
          title: 'Frecuencia de sincronizaci\u00f3n',
          content: 'MRRlytics sincroniza tus datos autom\u00e1ticamente:\n\n- Sincronizaci\u00f3n incremental: Cada 15 minutos (recoge nuevos cambios)\n- Sincronizaci\u00f3n completa: Una vez al d\u00eda a medianoche UTC (recalcula todas las m\u00e9tricas)\n\nTambi\u00e9n puedes ejecutar una sincronizaci\u00f3n manual en cualquier momento desde la p\u00e1gina de Ajustes.',
        },
        {
          title: 'Seguridad',
          content: 'Tus credenciales API de WHMCS se cifran con AES-256 antes de almacenarse. Nunca son visibles en el dashboard despu\u00e9s de guardarlas. Solo accedemos a tus datos WHMCS a trav\u00e9s de la API oficial con los permisos que otorgaste. Toda la comunicaci\u00f3n usa cifrado TLS 1.3.',
        },
        {
          title: 'Soluci\u00f3n de problemas',
          content: 'Problemas comunes:\n\n- "Conexi\u00f3n fallida": Verifica que tu URL WHMCS es correcta y accesible desde internet. Aseg\u00farate de que el acceso API est\u00e1 habilitado en la configuraci\u00f3n de WHMCS.\n- "Error de autenticaci\u00f3n": Comprueba tu Identificador API y Secreto. Son sensibles a may\u00fasculas y min\u00fasculas.\n- "Tiempo de espera agotado": Si tu WHMCS tarda en responder, la sincronizaci\u00f3n puede expirar. Int\u00e9ntalo de nuevo o revisa el rendimiento de tu servidor WHMCS.\n- "Sin datos despu\u00e9s de sincronizar": Aseg\u00farate de que tus credenciales API tienen los permisos correctos de lectura para clientes, productos y facturas.',
        },
      ],
    },
    whmcsModule: {
      meta: {
        title: 'M\u00f3dulo WHMCS - Docs MRRlytics',
        description: 'Instala el m\u00f3dulo MRRlytics para WHMCS para una recolecci\u00f3n de datos mejorada y seguimiento de eventos en tiempo real.',
      },
      title: 'M\u00f3dulo WHMCS',
      subtitle: 'M\u00f3dulo opcional para una recolecci\u00f3n de datos mejorada y notificaciones de eventos en tiempo real.',
      sections: [
        {
          title: 'Descripci\u00f3n general',
          content: 'El m\u00f3dulo MRRlytics para WHMCS es un addon opcional que mejora tus analytics enviando eventos en tiempo real desde WHMCS a MRRlytics. Mientras que la sincronizaci\u00f3n basada en API se encarga de la importaci\u00f3n de datos principal, el m\u00f3dulo proporciona:\n\n- Notificaciones de eventos en tiempo real (nuevos pedidos, cancelaciones, upgrades)\n- Actualizaciones de datos m\u00e1s r\u00e1pidas sin esperar al siguiente ciclo de sincronizaci\u00f3n\n- Hooks personalizados para integraciones avanzadas',
        },
        {
          title: 'Instalaci\u00f3n',
          content: '1. Descarga el m\u00f3dulo desde tu dashboard de MRRlytics (Ajustes > Instancias > Descargar M\u00f3dulo)\n2. Extrae el archivo en tu instalaci\u00f3n WHMCS:\n   - Copia la carpeta "mrrlytics" a /modules/addons/\n3. En el admin de WHMCS, ve a Configuraci\u00f3n > M\u00f3dulos Addon\n4. Busca "MRRlytics" y haz clic en "Activar"\n5. Configura el m\u00f3dulo:\n   - URL API: https://api.mrrlytics.com\n   - Clave API: Tu clave API de MRRlytics (disponible en Ajustes > Claves API)\n6. Haz clic en "Guardar Cambios"',
        },
        {
          title: 'Configuraci\u00f3n',
          content: 'Despu\u00e9s de activar el m\u00f3dulo, puedes configurar qu\u00e9 eventos se env\u00edan a MRRlytics:\n\n- Registro de nuevos clientes\n- Pedidos de servicios/productos\n- Cancelaciones de servicios\n- Creaci\u00f3n y pago de facturas\n- Registros y transferencias de dominios\n- Acciones de upgrade/downgrade\n\nTodos los eventos est\u00e1n habilitados por defecto. Puedes desactivar eventos espec\u00edficos desde la p\u00e1gina de configuraci\u00f3n del m\u00f3dulo.',
        },
        {
          title: 'Configuraci\u00f3n de la clave API',
          content: 'El m\u00f3dulo WHMCS se autentica usando una clave API:\n\n1. En MRRlytics, ve a Ajustes > Claves API\n2. Haz clic en "Generar Nueva Clave"\n3. Copia la clave (solo se mostrar\u00e1 una vez)\n4. P\u00e9gala en la configuraci\u00f3n del m\u00f3dulo WHMCS\n\nMant\u00e9n tu clave API en secreto. Si se ve comprometida, rev\u00f3cala y genera una nueva desde el dashboard de MRRlytics.',
        },
        {
          title: 'Verificar la instalaci\u00f3n',
          content: 'Para verificar que el m\u00f3dulo funciona correctamente:\n\n1. En WHMCS, ve a Addons > MRRlytics\n2. Haz clic en "Probar Conexi\u00f3n"\n3. Deber\u00edas ver un mensaje de \u00e9xito confirmando la conexi\u00f3n\n\nTambi\u00e9n puedes revisar los logs del m\u00f3dulo en Utilidades > Logs > Log de M\u00f3dulos en WHMCS.',
        },
        {
          title: 'Actualizar el m\u00f3dulo',
          content: 'Para actualizar el m\u00f3dulo:\n\n1. Descarga la \u00faltima versi\u00f3n desde tu dashboard de MRRlytics\n2. Reemplaza los archivos en /modules/addons/mrrlytics/\n3. En WHMCS, ve a Configuraci\u00f3n > M\u00f3dulos Addon > MRRlytics\n4. Haz clic en "Guardar" para aplicar actualizaciones de base de datos\n\nLas actualizaciones son retrocompatibles y tu configuraci\u00f3n se mantendr\u00e1.',
        },
        {
          title: 'Desinstalaci\u00f3n',
          content: 'Para eliminar el m\u00f3dulo:\n\n1. En el admin de WHMCS, ve a Configuraci\u00f3n > M\u00f3dulos Addon\n2. Busca "MRRlytics" y haz clic en "Desactivar"\n3. Elimina la carpeta /modules/addons/mrrlytics/\n\nDesinstalar el m\u00f3dulo no afecta a tu cuenta o datos de MRRlytics. La sincronizaci\u00f3n basada en API seguir\u00e1 funcionando normalmente.',
        },
      ],
    },
  },

  // Footer
  footer: {
    tagline: 'Plataforma de analytics para WHMCS. Rastrea MRR, churn y haz crecer tu negocio de hosting.',
    product: 'Producto',
    company: 'Empresa',
    legal: 'Legal',
    links: {
      features: 'Características',
      pricing: 'Precios',
      faq: 'FAQ',
      changelog: 'Changelog',
      about: 'Nosotros',
      careers: 'Empleo',
      contact: 'Contacto',
      privacy: 'Política de Privacidad',
      terms: 'Términos de Servicio',
      cookies: 'Política de Cookies',
    },
    copyright: 'Todos los derechos reservados.',
  },
} as const;
