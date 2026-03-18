export default {
  // Meta
  meta: {
    title: 'MRRlytics - Analytics for WHMCS',
    description: 'Analytics platform for WHMCS billing data. Track MRR, churn, revenue trends and more.',
  },

  // Header
  header: {
    features: 'Features',
    pricing: 'Pricing',
    faq: 'FAQ',
    signIn: 'Sign in',
    getStarted: 'Get Started',
  },

  // Hero
  hero: {
    badge: 'Built for WHMCS',
    title: 'Turn billing data into',
    titleHighlight: 'insights',
    subtitle: 'Real-time analytics on MRR, churn, and revenue trends for your hosting business.',
    ctaPrimary: 'Start Free Trial',
    ctaSecondary: 'See Features',
    socialProof: 'Free 14-day trial • No credit card required • Cancel anytime',
    // Dashboard mock
    mrr: 'MRR',
    activeClients: 'Active Clients',
    churnRate: 'Churn Rate',
    arpu: 'ARPU',
  },

  // Features
  features: {
    title: 'Everything you need to understand your business',
    subtitle: 'Powerful analytics tools designed specifically for hosting companies using WHMCS.',
    items: {
      mrrTracking: {
        title: 'Real-time MRR Tracking',
        description: 'Monitor your Monthly Recurring Revenue in real-time. See trends, growth rates, and projections at a glance.',
      },
      churnAnalysis: {
        title: 'Churn Analysis',
        description: 'Identify at-risk customers before they leave. Get alerts on cancellation patterns and take action early.',
      },
      revenueBreakdown: {
        title: 'Revenue Breakdown',
        description: 'Understand your revenue by product, category, or billing cycle. Know exactly where your money comes from.',
      },
      clientInsights: {
        title: 'Client Insights',
        description: 'Deep dive into customer lifetime value, acquisition costs, and retention metrics for smarter decisions.',
      },
      forecasting: {
        title: 'Forecasting',
        description: 'AI-powered predictions for future revenue based on historical data and current trends.',
      },
      instantSync: {
        title: 'Instant Sync',
        description: 'Connect your WHMCS in minutes. Data syncs automatically so you always have the latest insights.',
      },
    },
  },

  // Pricing
  pricing: {
    title: 'Simple, transparent pricing',
    subtitle: 'Start free and scale as you grow. No hidden fees, cancel anytime.',
    mostPopular: 'Most Popular',
    perMonth: '/month',
    plans: {
      free: {
        name: 'Free',
        description: 'Perfect for getting started',
        features: [
          '1 WHMCS instance',
          'Basic MRR tracking',
          'Last 30 days of data',
          '1 webhook',
          'Community support',
        ],
        cta: 'Get Started',
      },
      starter: {
        name: 'Starter',
        description: 'For growing hosting businesses',
        features: [
          '2 WHMCS instances',
          'Full MRR & churn analytics',
          '1 year of historical data',
          '3 webhooks',
          'Revenue forecasting',
          'Email support',
        ],
        cta: 'Start Free Trial',
      },
      pro: {
        name: 'Pro',
        description: 'For established companies',
        features: [
          '5 WHMCS instances',
          'Advanced analytics & reports',
          'Unlimited historical data',
          '10 webhooks',
          'Custom categories',
          'API access',
          'Priority support',
        ],
        cta: 'Start Free Trial',
      },
      business: {
        name: 'Business',
        description: 'For large organizations',
        features: [
          'Unlimited WHMCS instances',
          'White-label reports',
          'Custom integrations',
          '100 webhooks',
          'Dedicated account manager',
          'SLA guarantee',
          'On-boarding assistance',
        ],
        cta: 'Contact Sales',
      },
    },
  },

  // FAQ
  faq: {
    title: 'Frequently asked questions',
    subtitle: "Can't find what you're looking for?",
    contactTeam: 'Contact our team',
    items: [
      {
        question: 'How does MRRlytics connect to my WHMCS?',
        answer: 'MRRlytics uses the official WHMCS API to securely sync your billing data. You simply provide your WHMCS URL and API credentials, and we handle the rest. Your data is encrypted in transit and at rest.',
      },
      {
        question: 'How often is my data synced?',
        answer: 'Data is synced automatically every 24 hours. Pro and Business plans can configure more frequent syncs or trigger manual syncs whenever needed.',
      },
      {
        question: 'Can I connect multiple WHMCS installations?',
        answer: 'Yes! The number of WHMCS instances you can connect depends on your plan. Free allows 1 instance, Starter allows 2, Pro allows 5, and Business has unlimited instances.',
      },
      {
        question: 'Is my data secure?',
        answer: 'Absolutely. We use industry-standard encryption (AES-256) for data at rest and TLS 1.3 for data in transit. We never store your WHMCS admin passwords, only API credentials with read-only access.',
      },
      {
        question: 'What happens if I cancel my subscription?',
        answer: 'You can cancel anytime. Your data will be retained for 30 days after cancellation, giving you time to export anything you need. After that, all data is permanently deleted.',
      },
      {
        question: 'Do you offer refunds?',
        answer: "Yes, we offer a 14-day money-back guarantee on all paid plans. If you're not satisfied, contact us within 14 days of your purchase for a full refund.",
      },
    ],
  },

  // About
  about: {
    meta: {
      title: 'About MRRlytics - Our Story',
      description: 'Learn about the team behind MRRlytics and our mission to help hosting companies grow with data-driven insights.',
    },
    hero: {
      title: 'Built by hosting professionals,',
      titleHighlight: 'for hosting professionals',
      subtitle: 'We understand the challenges of running a hosting business because we\'ve been there. MRRlytics was born from our own need for better analytics.',
    },
    mission: {
      title: 'Our Mission',
      description: 'To empower hosting companies with the insights they need to make smarter decisions, reduce churn, and grow sustainably.',
    },
    story: {
      title: 'Our Story',
      paragraphs: [
        'MRRlytics started in 2023 when our founders, running their own hosting company, realized they were spending hours every week manually calculating MRR, analyzing churn, and building reports in spreadsheets.',
        'They knew there had to be a better way. After searching for a solution and finding nothing that truly understood the hosting industry, they decided to build it themselves.',
        'Today, MRRlytics helps hundreds of hosting companies around the world understand their business better, identify growth opportunities, and reduce customer churn.',
      ],
    },
    values: {
      title: 'Our Values',
      items: [
        {
          title: 'Transparency',
          description: 'We believe in clear, honest communication. No hidden fees, no surprise charges, no confusing metrics.',
        },
        {
          title: 'Privacy First',
          description: 'Your data belongs to you. We never sell or share your information with third parties.',
        },
        {
          title: 'Customer Focus',
          description: 'Every feature we build starts with a real customer need. Your feedback shapes our roadmap.',
        },
        {
          title: 'Continuous Improvement',
          description: 'We\'re always learning, iterating, and improving. The best version of MRRlytics is always the next one.',
        },
      ],
    },
    team: {
      title: 'Meet the Team',
      subtitle: 'A small, passionate team dedicated to helping you succeed.',
    },
    cta: {
      title: 'Ready to get started?',
      subtitle: 'Join hundreds of hosting companies already using MRRlytics.',
      button: 'Start Free Trial',
    },
  },

  // Contact
  contact: {
    meta: {
      title: 'Contact MRRlytics - Get in Touch',
      description: 'Have questions about MRRlytics? Contact our team for sales inquiries, support, or partnership opportunities.',
    },
    hero: {
      title: 'Get in touch',
      subtitle: 'Have a question or want to learn more? We\'d love to hear from you.',
    },
    form: {
      name: 'Name',
      namePlaceholder: 'Your name',
      email: 'Email',
      emailPlaceholder: 'you@company.com',
      subject: 'Subject',
      subjectPlaceholder: 'How can we help?',
      message: 'Message',
      messagePlaceholder: 'Tell us more about your needs...',
      submit: 'Send Message',
      sending: 'Sending...',
    },
    info: {
      title: 'Other ways to reach us',
      email: {
        label: 'Email',
        value: 'hello@mrrlytics.com',
        description: 'For general inquiries',
      },
      sales: {
        label: 'Sales',
        value: 'sales@mrrlytics.com',
        description: 'For pricing and enterprise plans',
      },
      support: {
        label: 'Support',
        value: 'support@mrrlytics.com',
        description: 'For existing customers',
      },
    },
    faq: {
      title: 'Common questions',
      items: [
        {
          question: 'What\'s the typical response time?',
          answer: 'We typically respond within 24 hours on business days.',
        },
        {
          question: 'Do you offer demos?',
          answer: 'Yes! We\'d be happy to walk you through MRRlytics. Just mention it in your message.',
        },
        {
          question: 'Is there phone support?',
          answer: 'Phone support is available for Business plan customers. Otherwise, email is the best way to reach us.',
        },
      ],
    },
  },

  // Privacy
  privacy: {
    meta: {
      title: 'Privacy Policy - MRRlytics',
      description: 'Learn how MRRlytics collects, uses, and protects your personal information.',
    },
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: February 2024',
    sections: [
      {
        title: 'Introduction',
        content: 'At MRRlytics, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. Please read this policy carefully.',
      },
      {
        title: 'Information We Collect',
        content: 'We collect information you provide directly to us, such as when you create an account, connect your WHMCS installation, or contact us for support. This includes:\n\n• Account information (name, email, password)\n• WHMCS API credentials (stored encrypted)\n• Billing data synced from your WHMCS installation\n• Usage data and analytics\n• Communications with our support team',
      },
      {
        title: 'How We Use Your Information',
        content: 'We use the information we collect to:\n\n• Provide, maintain, and improve our services\n• Process transactions and send related information\n• Send technical notices, updates, and support messages\n• Respond to your comments and questions\n• Analyze usage patterns to improve user experience\n• Detect, investigate, and prevent fraudulent transactions',
      },
      {
        title: 'Data Security',
        content: 'We implement industry-standard security measures to protect your data. All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. API credentials are stored using one-way encryption and are never visible to our staff.',
      },
      {
        title: 'Data Retention',
        content: 'We retain your personal information for as long as your account is active or as needed to provide you services. If you delete your account, we will delete your data within 30 days, except where we are required to retain it for legal purposes.',
      },
      {
        title: 'Third-Party Services',
        content: 'We may share your information with third-party service providers who perform services on our behalf, such as payment processing, data analysis, and email delivery. These providers are bound by contractual obligations to keep your information confidential.',
      },
      {
        title: 'Your Rights',
        content: 'You have the right to:\n\n• Access your personal data\n• Correct inaccurate data\n• Request deletion of your data\n• Export your data in a portable format\n• Opt out of marketing communications\n\nTo exercise these rights, contact us at privacy@mrrlytics.com.',
      },
      {
        title: 'Cookies',
        content: 'We use essential cookies to maintain your session and preferences. We do not use third-party tracking cookies. You can disable cookies in your browser settings, but some features may not function properly.',
      },
      {
        title: 'Changes to This Policy',
        content: 'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.',
      },
      {
        title: 'Contact Us',
        content: 'If you have any questions about this Privacy Policy, please contact us at privacy@mrrlytics.com.',
      },
    ],
  },

  // Terms of Service
  terms: {
    meta: {
      title: 'Terms of Service - MRRlytics',
      description: 'Read the terms and conditions for using MRRlytics analytics platform.',
    },
    title: 'Terms of Service',
    lastUpdated: 'Last updated: February 2024',
    sections: [
      {
        title: '1. Acceptance of Terms',
        content: 'By accessing or using MRRlytics ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Service. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting.',
      },
      {
        title: '2. Description of Service',
        content: 'MRRlytics is an analytics platform designed to help hosting companies track and analyze their WHMCS billing data. The Service includes features such as MRR tracking, churn analysis, revenue forecasting, and reporting tools. We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time.',
      },
      {
        title: '3. Account Registration',
        content: 'To use the Service, you must create an account and provide accurate, complete information. You are responsible for:\n\n• Maintaining the confidentiality of your account credentials\n• All activities that occur under your account\n• Notifying us immediately of any unauthorized use\n• Ensuring your contact information remains current',
      },
      {
        title: '4. Subscription and Billing',
        content: 'Paid subscriptions are billed in advance on a monthly or annual basis. By subscribing to a paid plan, you authorize us to charge your payment method. Subscriptions automatically renew unless cancelled before the renewal date. Prices may change with 30 days notice. No refunds are provided for partial billing periods, except as required by law or as stated in our refund policy.',
      },
      {
        title: '5. Acceptable Use',
        content: 'You agree not to:\n\n• Use the Service for any unlawful purpose\n• Attempt to gain unauthorized access to our systems\n• Interfere with or disrupt the Service\n• Reverse engineer or decompile the Service\n• Share your account credentials with third parties\n• Use the Service to compete directly with MRRlytics\n• Exceed rate limits or abuse API access',
      },
      {
        title: '6. Data and Privacy',
        content: 'Your use of the Service is also governed by our Privacy Policy. By using the Service, you consent to the collection and use of your data as described in the Privacy Policy. You retain ownership of your data, and you grant us a limited license to use it solely to provide the Service.',
      },
      {
        title: '7. WHMCS Integration',
        content: 'The Service connects to your WHMCS installation via API. You are responsible for ensuring you have the right to share your WHMCS data with us. We access only the data necessary to provide our analytics features. We recommend using API credentials with read-only access for enhanced security.',
      },
      {
        title: '8. Intellectual Property',
        content: 'The Service and its original content, features, and functionality are owned by MRRlytics and are protected by international copyright, trademark, and other intellectual property laws. Our trademarks may not be used without prior written consent.',
      },
      {
        title: '9. Disclaimer of Warranties',
        content: 'THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE. WE DISCLAIM ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.',
      },
      {
        title: '10. Limitation of Liability',
        content: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, MRRLYTICS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU IN THE TWELVE MONTHS PRECEDING THE CLAIM.',
      },
      {
        title: '11. Indemnification',
        content: 'You agree to indemnify and hold harmless MRRlytics and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.',
      },
      {
        title: '12. Termination',
        content: 'We may terminate or suspend your account at any time for violations of these Terms. Upon termination, your right to use the Service ceases immediately. Provisions that by their nature should survive termination shall survive, including intellectual property rights, disclaimers, and limitations of liability.',
      },
      {
        title: '13. Governing Law',
        content: 'These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which MRRlytics operates, without regard to conflict of law principles. Any disputes shall be resolved in the courts of that jurisdiction.',
      },
      {
        title: '14. Contact',
        content: 'If you have any questions about these Terms, please contact us at legal@mrrlytics.com.',
      },
    ],
  },

  // Docs
  docs: {
    meta: {
      title: 'Documentation - MRRlytics',
      description: 'Learn how to set up MRRlytics, connect your WHMCS installation, and get the most out of your analytics.',
    },
    hero: {
      title: 'Documentation',
      subtitle: 'Everything you need to set up and get the most out of MRRlytics.',
    },
    nav: {
      gettingStarted: 'Getting Started',
      connectWhmcs: 'Connect WHMCS',
      whmcsModule: 'WHMCS Module',
    },
    gettingStarted: {
      meta: {
        title: 'Getting Started - MRRlytics Docs',
        description: 'Get started with MRRlytics in minutes. Create your account, set up your first tenant, and connect your WHMCS installation.',
      },
      title: 'Getting Started',
      subtitle: 'Set up MRRlytics in under 5 minutes and start tracking your hosting business metrics.',
      steps: [
        {
          title: '1. Create your account',
          content: 'Go to app.mrrlytics.com and sign up with your Google account or email address. Your account is free to create and includes a free tier with basic analytics.',
        },
        {
          title: '2. Set up your organization',
          content: 'After signing in for the first time, MRRlytics will automatically create your organization (tenant). This is your workspace where all your WHMCS instances, team members, and data live. You can rename it from Settings > General.',
        },
        {
          title: '3. Add your first WHMCS instance',
          content: 'Navigate to Settings > Instances and click "Add Instance". You\'ll need:\n\n- A name for this instance (e.g., "Production WHMCS")\n- Your WHMCS URL (e.g., https://billing.yourdomain.com)\n- WHMCS API credentials (Identifier and Secret)\n\nTo create API credentials in WHMCS, go to Setup > Staff Management > API Credentials and create a new credential. We recommend using read-only permissions.',
        },
        {
          title: '4. Run your first sync',
          content: 'Once your instance is configured, click "Sync Now" to trigger the initial data import. This may take a few minutes depending on the size of your WHMCS database. After the sync completes, your dashboard will show your MRR, churn rate, and other key metrics.',
        },
        {
          title: '5. Explore your dashboard',
          content: 'Your dashboard now shows real-time metrics including:\n\n- Monthly Recurring Revenue (MRR) with trend\n- Active clients and churn rate\n- Revenue breakdown by product and category\n- Client insights and top products\n\nData syncs automatically every 15 minutes, so your metrics are always up to date.',
        },
      ],
      nextSteps: {
        title: 'Next steps',
        items: [
          'Set up categories to group your products for better revenue analysis',
          'Configure webhooks to receive real-time notifications',
          'Invite team members to collaborate on your analytics',
          'Install the WHMCS module for enhanced data collection',
        ],
      },
    },
    connectWhmcs: {
      meta: {
        title: 'Connect WHMCS - MRRlytics Docs',
        description: 'Learn how to connect your WHMCS installation to MRRlytics using API credentials.',
      },
      title: 'Connect WHMCS',
      subtitle: 'Step-by-step guide to connecting your WHMCS installation to MRRlytics via API.',
      sections: [
        {
          title: 'Prerequisites',
          content: 'Before connecting your WHMCS, make sure you have:\n\n- Admin access to your WHMCS installation\n- WHMCS version 8.0 or later\n- API access enabled in WHMCS (Setup > General Settings > Security > Allow API Access)\n- A MRRlytics account with an organization set up',
        },
        {
          title: 'Step 1: Create API credentials in WHMCS',
          content: 'In your WHMCS admin panel:\n\n1. Go to Setup > Staff Management > API Credentials\n2. Click "Generate New API Credential"\n3. Give it a description like "MRRlytics Integration"\n4. Set the access permissions. MRRlytics needs read access to:\n   - Clients\n   - Products/Services\n   - Invoices\n   - Domains\n   - Cancellation Requests\n5. Copy the API Identifier and API Secret',
        },
        {
          title: 'Step 2: Add the instance in MRRlytics',
          content: 'In your MRRlytics dashboard:\n\n1. Navigate to Settings > Instances\n2. Click "Add Instance"\n3. Fill in the form:\n   - Name: A friendly name for this WHMCS installation\n   - WHMCS URL: The full URL to your WHMCS admin (e.g., https://billing.example.com)\n   - API Identifier: Paste from WHMCS\n   - API Secret: Paste from WHMCS\n4. Click "Save"\n\nMRRlytics will validate the connection and confirm it\'s working.',
        },
        {
          title: 'Step 3: Initial sync',
          content: 'After adding the instance, trigger your first sync by clicking "Sync Now". The initial sync imports:\n\n- All active clients and their services\n- Product catalog and product groups\n- Invoice history\n- Domain registrations\n- Cancellation requests\n\nThis may take 2-10 minutes depending on your database size.',
        },
        {
          title: 'Sync frequency',
          content: 'MRRlytics syncs your data automatically:\n\n- Incremental sync: Every 15 minutes (picks up new changes)\n- Full sync: Once daily at midnight UTC (recalculates all metrics)\n\nYou can also trigger a manual sync at any time from the Settings page.',
        },
        {
          title: 'Security',
          content: 'Your WHMCS API credentials are encrypted using AES-256 before being stored. They are never visible in the dashboard after saving. We only access your WHMCS data through the official API with the permissions you granted. All communication uses TLS 1.3 encryption.',
        },
        {
          title: 'Troubleshooting',
          content: 'Common issues:\n\n- "Connection failed": Verify your WHMCS URL is correct and accessible from the internet. Make sure API access is enabled in WHMCS settings.\n- "Authentication error": Double-check your API Identifier and Secret. They are case-sensitive.\n- "Timeout": If your WHMCS is slow to respond, the sync may time out. Try again or check your WHMCS server performance.\n- "No data after sync": Ensure your API credentials have the correct read permissions for clients, products, and invoices.',
        },
      ],
    },
    whmcsModule: {
      meta: {
        title: 'WHMCS Module - MRRlytics Docs',
        description: 'Install the MRRlytics WHMCS module for enhanced data collection and real-time event tracking.',
      },
      title: 'WHMCS Module',
      subtitle: 'Optional module for enhanced data collection and real-time event notifications.',
      sections: [
        {
          title: 'Overview',
          content: 'The MRRlytics WHMCS module is an optional addon that enhances your analytics by sending real-time events from WHMCS to MRRlytics. While the API-based sync handles the core data import, the module provides:\n\n- Real-time event notifications (new orders, cancellations, upgrades)\n- Faster data updates without waiting for the next sync cycle\n- Custom hooks for advanced integrations',
        },
        {
          title: 'Installation',
          content: '1. Download the module from your MRRlytics dashboard (Settings > Instances > Download Module)\n2. Extract the archive to your WHMCS installation:\n   - Copy the "mrrlytics" folder to /modules/addons/\n3. In WHMCS admin, go to Setup > Addon Modules\n4. Find "MRRlytics" and click "Activate"\n5. Configure the module:\n   - API URL: https://api.mrrlytics.com\n   - API Key: Your MRRlytics API key (found in Settings > API Keys)\n6. Click "Save Changes"',
        },
        {
          title: 'Configuration',
          content: 'After activating the module, you can configure which events are sent to MRRlytics:\n\n- New client registration\n- Service/product orders\n- Service cancellations\n- Invoice creation and payment\n- Domain registrations and transfers\n- Upgrade/downgrade actions\n\nAll events are enabled by default. You can disable specific events from the module configuration page.',
        },
        {
          title: 'API Key setup',
          content: 'The WHMCS module authenticates using an API key:\n\n1. In MRRlytics, go to Settings > API Keys\n2. Click "Generate New Key"\n3. Copy the key (it will only be shown once)\n4. Paste it in the WHMCS module configuration\n\nKeep your API key secret. If compromised, revoke it and generate a new one from the MRRlytics dashboard.',
        },
        {
          title: 'Verifying the installation',
          content: 'To verify the module is working correctly:\n\n1. In WHMCS, go to Addons > MRRlytics\n2. Click "Test Connection"\n3. You should see a success message confirming the connection\n\nYou can also check the module logs at Utilities > Logs > Module Log in WHMCS.',
        },
        {
          title: 'Updating the module',
          content: 'To update the module:\n\n1. Download the latest version from your MRRlytics dashboard\n2. Replace the files in /modules/addons/mrrlytics/\n3. In WHMCS, go to Setup > Addon Modules > MRRlytics\n4. Click "Save" to apply any database updates\n\nUpdates are backward compatible and your configuration will be preserved.',
        },
        {
          title: 'Uninstalling',
          content: 'To remove the module:\n\n1. In WHMCS admin, go to Setup > Addon Modules\n2. Find "MRRlytics" and click "Deactivate"\n3. Delete the /modules/addons/mrrlytics/ folder\n\nUninstalling the module does not affect your MRRlytics account or data. The API-based sync will continue to work normally.',
        },
      ],
    },
  },

  // Footer
  footer: {
    tagline: 'Analytics platform for WHMCS. Track MRR, churn, and grow your hosting business.',
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    links: {
      features: 'Features',
      pricing: 'Pricing',
      faq: 'FAQ',
      changelog: 'Changelog',
      about: 'About',
      careers: 'Careers',
      contact: 'Contact',
      privacy: 'Privacy Policy',
      terms: 'Terms of Service',
      cookies: 'Cookie Policy',
    },
    copyright: 'All rights reserved.',
  },
} as const;
