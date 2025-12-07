# MANTA-JARVIS Render Deployment Guide

## Overview

This guide walks you through deploying MANTA-JARVIS to Render.com, making it accessible worldwide with a public HTTPS URL. Once deployed, your calendar feeds will be usable with Google Calendar.

## Why Deploy?

- **localhost URLs don't work**: Google Calendar can't subscribe to `http://localhost:5000/calendar/...`
- **Public HTTPS needed**: Google Calendar requires publicly accessible HTTPS URLs
- **Free tier available**: Render.com offers a free tier sufficient for testing

## Prerequisites

- GitHub account (free)
- Render.com account (free)
- This codebase on GitHub

## Step 1: Push Code to GitHub

### 1.1 Create a GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `manta-jarvis`
3. Make it **Public** (required for free Render deployment)
4. Click "Create repository"

### 1.2 Clone & Push Your Code

```bash
# Initialize git in your project folder
cd /path/to/MANTA-JARVIS
git init
git add .
git commit -m "Initial MANTA-JARVIS deployment"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/manta-jarvis.git
git push -u origin main
```

**⚠️ Important**: Make sure your `.gitignore` includes:
```
calendar_data/
__pycache__/
*.pyc
.env
.DS_Store
```

## Step 2: Create Render Service

### 2.1 Log In to Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub (recommended) or email
3. Click **Dashboard**

### 2.2 Create a New Web Service

1. Click **New +**
2. Select **Web Service**
3. Choose **manta-jarvis** repository
4. Click **Connect**

### 2.3 Configure Deployment

Fill in the service settings:

| Field | Value |
|-------|-------|
| **Name** | `manta-jarvis` |
| **Environment** | `Python 3` |
| **Region** | Select closest to you (e.g., `us-east-1`) |
| **Branch** | `main` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn calendar_server:app` |

### 2.4 Environment Variables (Optional)

Add these in the "Environment" section if needed:

```
DEBUG=False
PORT=5000
DATA_DIR=/var/data/calendar_data
```

⚠️ **Note**: On Render, `PORT` will automatically be set by the platform. Keep `DEBUG=False` for production.

### 2.5 Deploy

1. Click **Create Web Service**
2. Wait for deployment (~2-3 minutes)
3. You'll see a URL like: `https://manta-jarvis-xxxxx.onrender.com`

## Step 3: Update Frontend Configuration

Once deployed, update your frontend to use the public URL:

### 3.1 Update `app.js`

The `getServerBaseURL()` function automatically detects the environment:

```javascript
async function getServerBaseURL() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  } else {
    // On deployed environment, use the same domain
    return `${window.location.protocol}//${window.location.host}`;
  }
}
```

✅ **Already handled** - no changes needed if you're serving `index.html` from Render too!

## Step 4: Test the Deployment

### 4.1 Check Server Health

Visit your Render URL:
```
https://manta-jarvis-xxxxx.onrender.com/health
```

You should see:
```json
{
  "status": "ok",
  "server": "MANTA-JARVIS Calendar Server v2.0",
  "users": 0,
  "port": 5000
}
```

### 4.2 Test Calendar Feed

1. Sign in to MANTA-JARVIS
2. Copy the calendar link from the sidebar
3. The link should look like:
   ```
   https://manta-jarvis-xxxxx.onrender.com/calendar/dXNlcm5hbWU=.ics
   ```

### 4.3 Add to Google Calendar

1. Open [Google Calendar](https://calendar.google.com)
2. Click **+ Other calendars** (left sidebar)
3. Select **From URL**
4. Paste your calendar link
5. Click **Add calendar**

✅ Done! Create events in MANTA-JARVIS and they'll appear in Google Calendar within seconds.

## Step 5: Serve Frontend from Render (Optional)

If you want to serve `index.html` directly from Render instead of locally:

### 5.1 Add Static File Serving

Update `calendar_server.py`:

```python
from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    if filename.endswith('.html') or filename.endswith('.css') or filename.endswith('.js'):
        return send_from_directory('.', filename)
    return jsonify({'error': 'Not found'}), 404
```

### 5.2 Redeploy

```bash
git add .
git commit -m "Add static file serving"
git push
```

Render will auto-redeploy.

## Step 6: Custom Domain (Optional)

Render free tier comes with a random domain (`manta-jarvis-xxxxx.onrender.com`). To use a custom domain:

1. In Render dashboard, go to your service
2. Click **Settings** → **Custom Domains**
3. Add your domain
4. Update your DNS records (Render will show instructions)
5. Wait 5-10 minutes for SSL certificate

⚠️ Note: Custom domains require a paid plan.

## Troubleshooting

### Issue: "Gunicorn not found"

**Solution**: Make sure `requirements.txt` includes `gunicorn==21.2.0`:

```
Flask==3.0.0
Flask-CORS==4.0.0
gunicorn==21.2.0
Werkzeug==3.0.1
```

### Issue: Calendar feed returns empty or 404

**Check**:
1. Events are being created (check MANTA-JARVIS interface)
2. Server is running (visit `/health`)
3. Calendar URL format is correct:
   ```
   https://manta-jarvis-xxxxx.onrender.com/calendar/BASE64_USERNAME.ics
   ```

**Debug**: Check Render logs
1. Go to your service in Render dashboard
2. Click **Logs** tab
3. Look for sync or calendar requests

### Issue: "Port already in use" locally

When running locally, the default port 5000 might be in use:

```bash
# Run on a different port
PORT=5001 python calendar_server.py
```

Or kill the process using port 5000:

```bash
# Windows PowerShell
Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess | Stop-Process -Force

# macOS/Linux
lsof -ti:5000 | xargs kill -9
```

### Issue: Events aren't syncing

**Check**:
1. Backend is receiving sync requests (look at logs)
2. `calendar_data` folder exists and is writable
3. Events have proper `start` and `end` times in ISO format

**From terminal**:
```bash
# Check if calendar_data folder exists
ls -la calendar_data/

# Check contents of a user's file
cat calendar_data/dXNlcm5hbWU=.json
```

## Production Checklist

Before going live:

- [ ] Code pushed to GitHub
- [ ] Render service deployed successfully
- [ ] Health endpoint returns `"status": "ok"`
- [ ] Can create events in MANTA-JARVIS
- [ ] Calendar feed returns valid .ics file
- [ ] Google Calendar subscription works
- [ ] Events appear in Google Calendar within seconds
- [ ] Tested on mobile (responsive design)
- [ ] DEBUG set to False in Render environment
- [ ] `.gitignore` configured properly

## Performance Notes

**Render Free Tier Specs**:
- **CPU**: 0.5x
- **Memory**: 512 MB
- **Sleep**: Auto-sleeps after 15 minutes of inactivity

For production, upgrade to paid plans for:
- Persistent uptime (no sleep)
- Better performance
- Custom domains

## Cost

| Plan | Price | Best For |
|------|-------|----------|
| **Free** | $0/month | Testing, learning |
| **Starter** | $7/month | Small personal use |
| **Pro** | $12+/month | Production |

## Next Steps

1. **Customize**: Edit the greeting responses in `app.js`
2. **Enhance**: Add NLP parsing (see `NLP_GUIDE.md`)
3. **Monitor**: Check Render logs regularly for errors
4. **Scale**: Upgrade to Starter plan if you hit rate limits

## Support

- Render docs: https://render.com/docs
- Flask docs: https://flask.palletsprojects.com
- Google Calendar API: https://developers.google.com/calendar

---

**Last Updated**: December 2025  
**Version**: calendar_server.py v2.0
