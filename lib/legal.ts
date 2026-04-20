export type LegalKind = 'terms' | 'privacy'

type Section = {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

type LegalDoc = {
  title: string
  company: string
  lastUpdated: string
  sections: Section[]
}

// Mirrors https://mandybubbletea.com/privacy — keep this in sync when the
// web copy changes. Split into two kinds so the footer links can open the
// right anchor.

export const LEGAL_CONTENT: Record<LegalKind, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    company: "MANDY'S BEVERAGE CO PTY LTD",
    lastUpdated: 'Last Updated: April 2026',
    sections: [
      {
        heading: '1. Introduction',
        paragraphs: [
          "MANDY'S BEVERAGE CO PTY LTD (\"Mandy's\", \"we\", \"us\", \"our\") is committed to protecting your privacy. This policy outlines how we collect, use, and safeguard your personal information when you access our website or use our online ordering services, in accordance with the Australian Privacy Act 1988.",
        ],
      },
      {
        heading: '2. Information We Collect',
        paragraphs: ['We may collect the following categories of information:'],
        bullets: [
          'Personal information: name, phone number, email address, delivery address, and payment details processed via third-party providers.',
          'Order information: items purchased, preferences, transaction amounts, and promotion usage.',
          'Technical information: IP address, browser type, device information, cookies and usage data.',
        ],
      },
      {
        heading: '3. How We Use Your Information',
        paragraphs: [
          'Information is used to process orders, provide delivery services, manage customer support, operate loyalty programs, send opted-in marketing communications, and improve our services.',
        ],
      },
      {
        heading: '4. Marketing Communications',
        paragraphs: [
          'By registering or placing an order, you may receive promotional messages. You can opt out anytime through unsubscribe instructions or by contacting us directly.',
        ],
      },
      {
        heading: '5. Sharing of Information',
        paragraphs: [
          "We do not sell your personal information. Information may be shared with payment providers, delivery partners, and IT service providers — all required to comply with privacy obligations.",
        ],
      },
      {
        heading: '6. Data Security',
        paragraphs: ['We take reasonable steps to protect your information, including:'],
        bullets: [
          'Secure encryption (SSL).',
          'Trusted payment gateways.',
          'Restricted internal access.',
        ],
      },
      {
        heading: '7. Cookies',
        paragraphs: [
          'Cookies enhance user experience, remember preferences, and analyse traffic. You may disable cookies via your browser settings.',
        ],
      },
      {
        heading: '8. Access and Correction',
        paragraphs: [
          'You have the right to request access to your personal information and corrections to inaccurate data by contacting us.',
        ],
      },
      {
        heading: '9. Contact Us',
        paragraphs: [
          "MANDY'S BEVERAGE CO PTY LTD",
          'Address: 34 Davenport St, Southport QLD 4215',
          'Phone: 0404 978 238',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    company: "MANDY'S BEVERAGE CO PTY LTD",
    lastUpdated: 'Last Updated: April 2026',
    sections: [
      {
        heading: '1. Acceptance of Terms',
        paragraphs: [
          'By accessing our website or using our online ordering services, you agree to be bound by these Terms of Service.',
        ],
      },
      {
        heading: '2. Orders & Payments',
        paragraphs: [
          'Orders require online or in-store payment. Once confirmed, orders cannot be modified or cancelled. We reserve the right to cancel orders due to system errors, pricing issues, or product unavailability, with a full refund provided.',
        ],
      },
      {
        heading: '3. Pricing & Promotions',
        paragraphs: [
          'First Order 30% Off — limited to first-time registered users, one use per account. Cannot combine with other promotions. Mandy\'s reserves the right to cancel orders or accounts suspected of abusing this promotion.',
          'Loyalty Program (Buy 9 Get 1 Free) — each purchased drink counts toward your loyalty progress. After purchasing 9 drinks, you are eligible to redeem 1 free drink. The free drink is of equal or lesser value than the purchased items. Non-transferable, non-redeemable for cash, and cannot combine with other promotions. Refunded or cancelled orders do not count toward progress.',
        ],
      },
      {
        heading: '4. Account Responsibility',
        paragraphs: [
          'Users are responsible for maintaining account confidentiality. We reserve the right to suspend or terminate accounts in case of suspicious or fraudulent activity.',
        ],
      },
      {
        heading: '5. Product Availability',
        paragraphs: [
          'Products are subject to availability. Menu images are for illustrative purposes only. Actual products may vary slightly.',
        ],
      },
      {
        heading: '6. Refunds & Complaints',
        paragraphs: [
          'Orders that have already been prepared are generally non-refundable. Issues should be reported promptly; we may offer remakes, store credit, or compensation at our discretion.',
        ],
      },
      {
        heading: '7. Limitation of Liability',
        paragraphs: ['To the maximum extent permitted by law, Mandy\'s shall not be liable for:'],
        bullets: [
          'Indirect or consequential losses.',
          'Delivery delays.',
          'Issues caused by third-party services.',
        ],
      },
      {
        heading: '8. Changes to Terms',
        paragraphs: [
          'We reserve the right to update these Terms of Service at any time. Changes will be posted on our website.',
        ],
      },
      {
        heading: '9. Governing Law',
        paragraphs: [
          'These Terms are governed by the laws of Australia.',
        ],
      },
      {
        heading: '10. Contact Us',
        paragraphs: [
          "MANDY'S BEVERAGE CO PTY LTD",
          'Address: 34 Davenport St, Southport QLD 4215',
          'Phone: 0404 978 238',
        ],
      },
    ],
  },
}
