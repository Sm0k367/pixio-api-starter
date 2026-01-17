# Epic Tech AI - Advanced AI Generation SaaS Platform

![Epic Tech AI Logo](./public/epic-tech-ai-logo.png)

**Epic Tech AI** is a cutting-edge SaaS platform that empowers creators, developers, and businesses to harness the power of artificial intelligence for generating stunning images, videos, and multimedia content. Built with modern technologies and designed for scalability, Epic Tech AI combines the best of Next.js, Supabase, Stripe, and Pixio API to deliver a seamless AI generation experience.

![Hero Image](./public/hero-image.png)

## 🚀 Features

### Core Capabilities
- **AI-Powered Media Generation**: Generate high-quality images and videos using advanced AI models
- **Flexible Credit System**: Subscription-based credits + purchasable credit packs for maximum flexibility
- **Professional Dashboard**: Intuitive interface for managing generations, credits, and account settings
- **Real-time Processing**: Asynchronous job processing with real-time status updates
- **Secure Authentication**: Enterprise-grade authentication with Supabase

### Subscription Tiers
- **Free Tier**: 500 monthly credits + community support
- **Pro Tier**: 3,000 monthly credits + priority support + advanced features
- **Business Tier**: 6,000 monthly credits + dedicated support + custom integrations

### Advanced Features
- 🎨 **Multiple Generation Modes**: Image generation, video creation, and more
- 💳 **Integrated Payments**: Seamless Stripe integration for subscriptions and credit purchases
- 📊 **Analytics Dashboard**: Track usage, credits, and generation history
- 🔐 **Role-Based Access**: Subscription tier-based feature access
- 🌙 **Dark Mode Support**: Beautiful glassmorphic UI with dark theme
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- ⚡ **Performance Optimized**: Fast load times and smooth interactions

## 🛠️ Tech Stack

### Frontend
- **Next.js 14+** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Shadcn UI** - High-quality component library
- **Framer Motion** - Smooth animations

### Backend & Services
- **Supabase** - PostgreSQL database + authentication + storage + edge functions
- **Stripe** - Payment processing and subscription management
- **Pixio API** - AI model deployment and inference
- **ComfyUI** - Workflow-based AI generation

### Infrastructure
- **Vercel** - Deployment and hosting
- **Supabase Edge Functions** - Serverless backend processing
- **Supabase Storage** - Media file storage

## 📋 Prerequisites

Before you begin, ensure you have:
- Node.js 18+ and npm/yarn installed
- A Supabase account ([supabase.com](https://supabase.com))
- A Stripe account ([stripe.com](https://stripe.com))
- A Pixio API account ([api.myapps.ai](https://api.myapps.ai))
- Git installed

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/epictechai/epic-tech-ai.git
cd epic-tech-ai
npm install
```

### 2. Set Up Supabase

1. Create a new project at [Supabase Dashboard](https://app.supabase.com/)
2. Note your project URL and API keys
3. Run the database schema SQL from `schema.sql` in the Supabase SQL Editor
4. Create a storage bucket named `generated-media`
5. Set up authentication redirect URLs:
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

### 3. Set Up Stripe

1. Create products and prices in [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create subscription tiers (Pro, Business) with monthly and yearly pricing
3. Create one-time credit pack products (1000, 2500, 5000 credits)
4. Configure webhook endpoint: `/api/webhooks/stripe`
5. Note your webhook signing secret

### 4. Set Up Pixio API

1. Create an account at [Pixio API](https://api.myapps.ai)
2. Deploy your ComfyUI workflows (image generation, video generation, etc.)
3. Note the deployment IDs for each workflow
4. Get your API key from account settings

### 5. Configure Environment Variables

Create a `.env.local` file in the root directory:

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Stripe Price IDs
NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_MONTHLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_BUSINESS_YEARLY=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_1000=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_2500=price_xxx
NEXT_PUBLIC_STRIPE_PRICE_CREDIT_PACK_5000=price_xxx

# Pixio API
COMFY_DEPLOY_API_KEY=your_pixio_api_key

# Application
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 6. Set Up Supabase Edge Functions

Deploy three edge functions for media generation:

1. **generate-media-handler** - Initiates generation jobs
2. **poll-status-handler** - Monitors job progress
3. **process-result-handler** - Processes completed media

See the detailed setup instructions in the [Supabase Functions Documentation](#supabase-edge-functions).

### 7. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📚 Project Structure

```
epic-tech-ai/
├── src/
│   ├── app/
│   │   ├── (marketing)/          # Public marketing pages
│   │   ├── (auth)/               # Authentication pages
│   │   ├── (app)/                # Protected application pages
│   │   ├── api/                  # API routes
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   ├── ui/                   # Shadcn UI components
│   │   ├── shared/               # Shared components
│   │   ├── dashboard/            # Dashboard components
│   │   ├── account/              # Account components
│   │   └── pricing/              # Pricing components
│   ├── lib/
│   │   ├── supabase/             # Supabase clients
│   │   ├── stripe/               # Stripe utilities
│   │   ├── actions/              # Server actions
│   │   ├── services/             # Business logic
│   │   ├── config/               # Configuration
│   │   └── constants/            # Constants
│   └── types/                    # TypeScript types
├── supabase-functions/           # Edge functions
├── public/                       # Static assets
└── package.json
```

## 🎨 Customization

### Branding
- Update logo in `public/epic-tech-ai-logo.png`
- Modify colors in `tailwind.config.ts`
- Update theme in `src/app/globals.css`

### Pricing
- Edit pricing tiers in `src/lib/config/pricing.ts`
- Update Stripe price IDs in environment variables
- Customize pricing page in `src/app/(marketing)/pricing/page.tsx`

### Features
- Add new generation modes in `src/lib/constants/media.ts`
- Create new Pixio API deployments
- Update credit costs as needed

## 💳 Payment Integration

### Stripe Webhook Events
The application listens for:
- `checkout.session.completed` - Process subscription and credit purchases
- `customer.subscription.updated` - Update subscription status
- `customer.subscription.deleted` - Handle cancellations
- `invoice.paid` - Process renewals and credit resets

### Credit System
- **Subscription Credits**: Reset monthly based on tier
- **Purchased Credits**: Never expire, accumulate over time
- **Usage Tracking**: All credit usage is logged for analytics

## 🔐 Security

- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Row-level security (RLS) on database tables
- **API Keys**: Stored securely in environment variables
- **Webhook Verification**: Stripe webhook signature validation
- **Rate Limiting**: Built-in protection against abuse

## 📊 Analytics & Monitoring

- Track user signups and conversions
- Monitor credit usage and generation statistics
- Analyze subscription tier distribution
- Review payment success rates
- Monitor API performance and errors

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy with one click

### Post-Deployment
1. Update Supabase Auth redirect URLs
2. Update Stripe webhook endpoint URL
3. Update `NEXT_PUBLIC_SITE_URL` environment variable
4. Test payment flow in production

## 📞 Contact & Support

**Epic Tech AI**
- 📧 Email: [epictechai@gmail.com](mailto:epictechai@gmail.com)
- 🐦 Twitter/X: [@EpicTechAI](https://x.com/EpicTechAI)
- 💻 GitHub: [github.com/epictechai](https://github.com/epictechai)
- 💳 Purchase: [buy.stripe.com/dR6dRZ5yc5yPaVq9AE](https://buy.stripe.com/dR6dRZ5yc5yPaVq9AE)

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.io/) - Backend infrastructure
- [Stripe](https://stripe.com/) - Payment processing
- [Shadcn UI](https://ui.shadcn.com/) - Component library
- [Pixio API](https://api.myapps.ai/) - AI model deployment
- [ComfyUI](https://comfyui.com/) - Workflow engine
- [Tailwind CSS](https://tailwindcss.com/) - Styling

---

**Built with ❤️ by Epic Tech AI**

Transform your creative vision into reality with AI-powered generation. Start creating today!
