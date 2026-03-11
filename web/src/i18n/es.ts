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
