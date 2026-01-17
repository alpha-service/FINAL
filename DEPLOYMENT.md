# ALPHA&CO POS System - Deployment Guide

## � Quick Start

### Option 1: Docker Deployment (VPS - Recommended for Production)

```bash
# 1. Clone and configure
git clone <your-repo-url>
cd "POS FINAL"
cp .env.example .env
# Edit .env with your settings (see below)

# 2. Build and start
docker-compose up -d --build

# 3. Access the application
# Frontend: http://your-server-ip
# Backend API: http://your-server-ip:8000
```

### Option 2: Windows Desktop Application (.exe)

```powershell
# 1. Navigate to frontend
cd frontend

# 2. Backup and switch to electron config
Copy-Item package.json package.web.json
Copy-Item package.electron.json package.json

# 3. Install dependencies and build
yarn install
yarn electron:build:win

# 4. Find installer in frontend/dist/
# - ALPHA&CO POS Setup X.X.X.exe (Installer)
# - ALPHA&CO POS X.X.X.exe (Portable)
```

### Option 3: Portable Version (No Installation)

```powershell
# After building, the portable exe is in:
frontend/dist/ALPHA&CO POS X.X.X.exe

# Just copy this file to USB or any folder and run directly!
# No installation required.
```

---

## �📦 Deployment Options

### Option 1: Docker Deployment (Recommended for VPS)

#### Prerequisites
- Docker & Docker Compose installed
- VPS with at least 2GB RAM
- Domain name (optional but recommended)

#### Quick Start
```bash
# 1. Clone the repository
git clone <your-repo-url>
cd "POS FINAL"

# 2. Copy and configure environment
cp .env.example .env
nano .env  # Edit with your settings

# 3. Build and start
docker-compose up -d --build

# 4. Check status
docker-compose ps
docker-compose logs -f
```

#### Production Configuration
Edit `.env` with production values:
```env
MONGO_ROOT_PASSWORD=your_very_secure_password
SECRET_KEY=your_randomly_generated_secret_key
REACT_APP_BACKEND_URL=https://api.yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

#### SSL with Nginx Reverse Proxy
Add this nginx configuration on your server:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Option 2: Desktop Application (Windows/Mac)

#### Prerequisites
- Node.js 18+ installed
- Yarn package manager

#### Build Desktop App

```bash
cd frontend

# Replace package.json with electron version
cp package.json package.web.json  # Backup web version
cp package.electron.json package.json

# Install dependencies
yarn install

# Development mode
yarn electron:dev

# Build for Windows
yarn electron:build:win

# Build for Mac
yarn electron:build:mac

# Build for all platforms
yarn electron:build:all
```

Output files will be in `frontend/dist/`:
- Windows: `.exe` installer and portable version
- Mac: `.dmg` installer
- Linux: `.AppImage` and `.deb`

---

### Option 3: Traditional VPS Deployment

#### Backend Setup
```bash
# 1. Install Python 3.11+
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# 2. Setup backend
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
nano .env

# 4. Run with Gunicorn (production)
pip install gunicorn
gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

# 5. Create systemd service
sudo nano /etc/systemd/system/pos-backend.service
```

Systemd service file:
```ini
[Unit]
Description=ALPHA&CO POS Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/path/to/backend
Environment="PATH=/path/to/backend/venv/bin"
ExecStart=/path/to/backend/venv/bin/gunicorn server:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable pos-backend
sudo systemctl start pos-backend
```

#### Frontend Setup
```bash
cd frontend
yarn install
yarn build

# Serve with nginx or copy to web root
sudo cp -r build/* /var/www/html/pos/
```

---

## 🔒 Security Checklist

- [ ] Change all default passwords
- [ ] Generate new SECRET_KEY
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall (allow only 80, 443, 22)
- [ ] Set up database backups
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up monitoring (optional)

---

## 🗄️ Database Backup

### Manual Backup
```bash
# Docker
docker exec pos_mongodb mongodump --out /dump
docker cp pos_mongodb:/dump ./backup

# Direct MongoDB
mongodump --uri="mongodb://user:password@localhost:27017/pos_db" --out=./backup
```

### Automated Backup Script
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mongodb"
mkdir -p $BACKUP_DIR

docker exec pos_mongodb mongodump --archive=/tmp/backup_$DATE.gz --gzip
docker cp pos_mongodb:/tmp/backup_$DATE.gz $BACKUP_DIR/

# Keep only last 7 days
find $BACKUP_DIR -mtime +7 -delete
```

---

## 📊 Monitoring

### Health Checks
- Backend: `GET /health`
- Frontend: Check nginx status

### Logs
```bash
# Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Traditional
journalctl -u pos-backend -f
tail -f /var/log/nginx/access.log
```

---

## 🔄 Updates

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart (Docker)
docker-compose down
docker-compose up -d --build

# Traditional
cd backend && pip install -r requirements.txt
sudo systemctl restart pos-backend
cd frontend && yarn install && yarn build
```

---

## 📞 Support

- Email: support@alpha-co.be
- Address: Ninoofsesteenweg 77-79, 1700 Dilbeek
- TVA: BE 1028.386.674
