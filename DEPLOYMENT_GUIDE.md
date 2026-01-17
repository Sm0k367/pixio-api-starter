# Epic Tech AI - Deployment Guide

## 🚀 Quick Start Deployment

This guide walks you through deploying Epic Tech AI to production using Vercel, Supabase, and Stripe.

## Prerequisites

Before deploying, ensure you have:
- GitHub account with the epic-tech-ai repository
- Vercel account (free tier available)
- Supabase project set up
- Stripe account configured
- Pixio API account with deployments
- All environment variables ready

## Step 1: Prepare Your Repository

### 1.1 Push to GitHub
```bash
cd epic-tech-ai
git remote add origin https://github.com/epictechai/epic-tech-ai.git
git branch -M main
git push -u origin main
```

### 1.2 Verify Repository Structure
Ensure your repository contains:
- `src/` - Application source code
- `public/` - Static assets (including new Epic Tech AI images)
- `package.json` - Updated with Epic Tech AI metadata
- `README.md` - Updated with new branding
- `REBRAND_SUMMARY.md` - Rebrand documentation
- `.env.example` - Environment variables template

## Step 2: Deploy to Vercel

### 2.1 Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select "Import Git Repository"
4. Search for and select `epic-tech-ai`
5. Click "Import"

### 2.2 Configure Environment Variables
In the Vercel project settings, add all environment variables:

```
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
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

### 2.3 Deploy
1. Click "Deploy"
2. Wait for build to complete (usually 2-5 minutes)
3. Your site will be live at `https://epic-tech-ai.vercel.app`

## Step 3: Configure Supabase for Production

### 3.1 Update Authentication URLs
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Update **Site URL**: `https://your-domain.com`
3. Add **Redirect URLs**:
   - `https://your-domain.com/auth/callback`
   - `https://your-domain.com/login`
   - `https://your-domain.com/signup`

### 3.2 Configure Storage
1. Ensure `generated-media` bucket exists
2. Set bucket to **Public** for public access
3. Configure CORS if needed

### 3.3 Deploy Edge Functions
Deploy the three Supabase Edge Functions:

1. **generate-media-handler**
   - Initiates media generation
   - Requires: `COMFY_DEPLOY_API_KEY` secret

2. **poll-status-handler**
   - Monitors generation progress
   - Requires: `SUPABASE_SERVICE_ROLE_KEY`, `COMFY_DEPLOY_API_KEY` secrets

3. **process-result-handler**
   - Processes completed media
   - Requires: `SUPABASE_SERVICE_ROLE_KEY` secret

## Step 4: Configure Stripe for Production

### 4.1 Update Webhook Endpoint
1. Go to Stripe Dashboard → Developers → Webhooks
2. Update webhook URL to: `https://your-domain.com/api/webhooks/stripe`
3. Update webhook signing secret in Vercel environment variables

### 4.2 Verify Products & Prices
1. Ensure all subscription products are created
2. Verify all price IDs match environment variables
3. Test subscription flow in production mode

### 4.3 Enable Live Mode
1. Switch Stripe to **Live Mode**
2. Update `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` to live keys
3. Redeploy to Vercel

## Step 5: Custom Domain Setup

### 5.1 Add Custom Domain to Vercel
1. Go to Vercel Project Settings → Domains
2. Add your custom domain (e.g., `epic-tech-ai.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (usually 24-48 hours)

### 5.2 Update Environment Variables
1. Update `NEXT_PUBLIC_SITE_URL` to your custom domain
2. Redeploy to Vercel

### 5.3 Enable HTTPS
- Vercel automatically provides SSL/TLS certificates
- HTTPS is enabled by default

## Step 6: Post-Deployment Verification

### 6.1 Test Authentication
- [ ] Sign up with new account
- [ ] Verify email confirmation
- [ ] Login with credentials
- [ ] Check user profile creation

### 6.2 Test Payments
- [ ] Test subscription checkout (use Stripe test card: 4242 4242 4242 4242)
- [ ] Verify subscription creation in Stripe
- [ ] Check credits are added to user account
- [ ] Test credit purchase flow

### 6.3 Test Media Generation
- [ ] Generate test image
- [ ] Verify credits are deducted
- [ ] Check media appears in dashboard
- [ ] Verify media is stored in Supabase

### 6.4 Test Webhooks
- [ ] Trigger test webhook from Stripe
- [ ] Verify webhook is received
- [ ] Check database is updated correctly

## Step 7: Monitoring & Maintenance

### 7.1 Set Up Monitoring
- Enable Vercel Analytics
- Set up Supabase monitoring
- Configure Stripe alerts
- Monitor error logs

### 7.2 Regular Maintenance
- Monitor API usage and costs
- Review error logs weekly
- Update dependencies monthly
- Backup database regularly

### 7.3 Performance Optimization
- Monitor Core Web Vitals
- Optimize images and assets
- Enable caching strategies
- Monitor database performance

## Troubleshooting

### Build Fails
- Check Node.js version compatibility
- Verify all dependencies are installed
- Check for TypeScript errors
- Review build logs in Vercel

### Authentication Issues
- Verify Supabase URL and keys
- Check redirect URLs in Supabase
- Clear browser cookies and cache
- Test in incognito mode

### Payment Issues
- Verify Stripe keys are correct
- Check webhook endpoint is accessible
- Review Stripe logs for errors
- Test with Stripe test cards

### Media Generation Issues
- Verify Pixio API key is correct
- Check deployment IDs are valid
- Review Supabase function logs
- Test with simple prompts first

## Security Checklist

- [ ] All environment variables are set
- [ ] Stripe webhook is verified
- [ ] Supabase RLS policies are enabled
- [ ] Database backups are configured
- [ ] HTTPS is enabled
- [ ] API keys are rotated regularly
- [ ] Error logs don't expose sensitive data
- [ ] Rate limiting is configured

## Performance Optimization

### Database
- Enable query caching
- Create indexes on frequently queried columns
- Monitor slow queries
- Optimize RLS policies

### Storage
- Enable CDN caching
- Compress images
- Use appropriate file formats
- Monitor storage usage

### API
- Implement rate limiting
- Cache API responses
- Monitor API usage
- Optimize database queries

## Scaling Considerations

### When to Scale
- User count exceeds 1,000
- API requests exceed 10,000/day
- Storage exceeds 100GB
- Database queries slow down

### Scaling Options
- Upgrade Supabase plan
- Increase Vercel resources
- Implement caching layer
- Optimize database queries
- Use CDN for static assets

## Support & Resources

### Documentation
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.io/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Next.js Docs](https://nextjs.org/docs)

### Support Channels
- Email: epictechai@gmail.com
- Twitter: @EpicTechAI
- GitHub: github.com/epictechai

## Deployment Checklist

- [ ] Repository pushed to GitHub
- [ ] Vercel project created
- [ ] Environment variables configured
- [ ] Supabase URLs updated
- [ ] Stripe webhook configured
- [ ] Edge functions deployed
- [ ] Custom domain configured
- [ ] HTTPS enabled
- [ ] Authentication tested
- [ ] Payments tested
- [ ] Media generation tested
- [ ] Monitoring configured
- [ ] Backups configured
- [ ] Security checklist completed

---

**Congratulations!** Your Epic Tech AI platform is now live and ready for users.

For support, contact: **epictechai@gmail.com**
