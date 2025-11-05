# Deployment Guide

This guide walks you through deploying InstaHelp to GitHub and Netlify.

## 📋 Pre-Deployment Checklist

Before uploading to GitHub, ensure:

- [ ] All `.env` files are in `.gitignore` (✅ Already done)
- [ ] RSA keys are in `.gitignore` (✅ Already done)
- [ ] No secrets or API keys are hardcoded in the code
- [ ] You have a Supabase project set up
- [ ] You have generated all required secrets (JWT, HMAC, etc.)
- [ ] Database migrations have been run in Supabase

## 🚀 Step 1: Upload to GitHub

### 1.1 Initialize Git (if not already done)

```bash
cd InstaCure
git init
```

### 1.2 Add All Files

```bash
git add .
```

### 1.3 Verify What Will Be Committed

```bash
# Check that .env files are NOT included
git status
```

You should NOT see:
- `.env` files
- `keys/` directory
- `*.pem` files

### 1.4 Create Initial Commit

```bash
git commit -m "Initial commit: InstaHelp emergency medical data system"
```

### 1.5 Create GitHub Repository

1. Go to [GitHub.com](https://github.com)
2. Click "New repository"
3. Name it (e.g., `instahelp` or `InstaCure`)
4. **DO NOT** initialize with README, .gitignore, or license (we already have these)
5. Click "Create repository"

### 1.6 Push to GitHub

```bash
# Add remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## 🌐 Step 2: Deploy Frontend to Netlify

### 2.1 Connect Repository to Netlify

1. Go to [Netlify](https://www.netlify.com)
2. Sign up/Login (free account works)
3. Click "Add new site" → "Import an existing project"
4. Connect to GitHub
5. Select your repository
6. Netlify will auto-detect the settings

### 2.2 Configure Build Settings

**Build command:**
```bash
cd frontend && npm install && npm run build
```

**Publish directory:**
```
frontend/dist
```

**Base directory:**
```
frontend
```

### 2.3 Set Environment Variables

In Netlify dashboard → Site settings → Environment variables:

Add:
```
VITE_API_URL=https://your-backend-url.com
```

**Important:** Replace `your-backend-url.com` with your actual backend URL (see Step 3).

### 2.4 Deploy

Click "Deploy site". Netlify will:
1. Install dependencies
2. Build the frontend
3. Deploy to a URL like `instahelp-xyz.netlify.app`

### 2.5 Update netlify.toml (Optional)

Edit `netlify.toml` and replace `your-backend-url.com` with your actual backend URL:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-actual-backend-url.com/api/:splat"
  status = 200
  force = true
```

## 🔧 Step 3: Deploy Backend

You have several options for backend deployment:

### Option A: Render (Recommended - Free Tier)

1. Go to [Render.com](https://render.com)
2. Sign up/Login
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Name:** `instahelp-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
6. Add all environment variables from `backend/.env.example`
7. Deploy

### Option B: Heroku

```bash
# Install Heroku CLI
heroku login
cd backend
heroku create instahelp-backend
heroku config:set SUPABASE_URL=...
heroku config:set JWT_SECRET=...
# ... add all env vars
git push heroku main
```

### Option C: Railway

1. Go to [Railway.app](https://railway.app)
2. Connect GitHub repository
3. Select backend directory
4. Add environment variables
5. Deploy

### Option D: Docker (Any Host)

```bash
cd backend
docker build -t instahelp-backend .
docker run -p 3000:3000 --env-file .env instahelp-backend
```

## 🔐 Step 4: Configure Environment Variables

### Backend Environment Variables (Production)

Set these in your backend hosting platform:

**Required:**
- `NODE_ENV=production`
- `PORT=3000` (or your platform's port)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key
- `SUPABASE_ANON_KEY` - Anon key
- `JWT_SECRET` - Your JWT secret (32+ chars)
- `JWT_REFRESH_SECRET` - Refresh token secret (32+ chars)
- `DEVICE_HMAC_SECRET` - Device HMAC secret
- `AES_MASTER_KEY` - 32-byte hex key

**RSA Keys:**
Upload `keys/private_key.pem` and `keys/public_key.pem` to your hosting platform:
- Render: Use "Secret Files" feature
- Heroku: Use config vars or addons
- Or set `RSA_PRIVATE_KEY_PATH` and `RSA_PUBLIC_KEY_PATH` to point to uploaded files

**Email (Production):**
- `EMAIL_HOST` - SendGrid or SMTP host
- `EMAIL_PORT` - Usually 587
- `EMAIL_USER` - Your email username
- `EMAIL_PASS` - Your email password/API key
- `EMAIL_FROM` - Sender email address

### Frontend Environment Variables (Netlify)

- `VITE_API_URL` - Your backend URL (e.g., `https://instahelp-backend.onrender.com`)

## 🔄 Step 5: Update Netlify Redirects

After deploying backend, update `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/r/*"
  to = "https://your-backend-url.com/r/:splat"
  status = 200
  force = true
```

Then redeploy on Netlify.

## ✅ Step 6: Verify Deployment

1. **Frontend:** Visit your Netlify URL
2. **Backend:** Test health endpoint: `https://your-backend-url.com/health`
3. **API:** Test an endpoint: `https://your-backend-url.com/api/auth/request-otp`

## 🔒 Security Checklist

Before going live:

- [ ] All secrets are in environment variables (not in code)
- [ ] `.env` files are NOT in repository
- [ ] RSA keys are NOT in repository
- [ ] CORS is configured correctly (only your Netlify domain)
- [ ] Rate limiting is enabled
- [ ] HTTPS is enabled (Netlify provides this automatically)
- [ ] Supabase RLS policies are configured (if using anon key)
- [ ] Database migrations are run
- [ ] Test email sending works
- [ ] Test OTP flow works
- [ ] Test emergency QR access works

## 📝 Post-Deployment

### Update README

Update your README with:
- Production URLs
- Deployment status
- Any custom configuration

### Monitor

- Set up error monitoring (Sentry, LogRocket, etc.)
- Monitor Supabase usage
- Check Netlify/Render analytics
- Review audit logs regularly

## 🐛 Troubleshooting

### Frontend can't connect to backend

- Check `VITE_API_URL` in Netlify environment variables
- Verify backend is running and accessible
- Check CORS settings in backend
- Check browser console for errors

### Backend errors

- Check environment variables are set correctly
- Verify Supabase connection
- Check logs in hosting platform
- Verify RSA keys are accessible
- Test database connection

### Build failures

- Check Node.js version (should be 20+)
- Verify all dependencies are in package.json
- Check build logs for specific errors

## 📚 Additional Resources

- [Netlify Docs](https://docs.netlify.com/)
- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Remember:** Never commit secrets or `.env` files to GitHub!

