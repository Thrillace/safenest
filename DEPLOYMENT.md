# SafeNest Deployment Guide

## Pre-Deployment Checklist

- [ ] Change admin password: `npm run set-password "strong-password-here"`
- [ ] Update `.env` with production values
- [ ] Backup `safenest-data/` directory
- [ ] Test all features locally with `npm start`
- [ ] Review security recommendations in README.md
- [ ] Set up HTTPS/SSL certificate
- [ ] Configure firewall rules
- [ ] Set up monitoring/logging

## Deployment Options

### 1. Heroku (Easiest for Beginners)

```bash
# Install Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Login to Heroku
heroku login

# Create a new Heroku app
heroku create your-app-name

# Add git remote
git remote add heroku https://git.heroku.com/your-app-name.git

# Set environment variables
heroku config:set ADMIN_PASSWORD="your-secure-password"
heroku config:set CONTACT_EMAIL_TO="your-email@example.com"
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

**Pros:** Easy setup, automatic scaling, free tier available
**Cons:** Limited resources on free tier, can be expensive at scale

---

### 2. DigitalOcean App Platform

```bash
# 1. Push code to GitHub
git push origin main

# 2. Connect GitHub to DigitalOcean App Platform
# - Visit https://cloud.digitalocean.com/apps
# - Click "Create App"
# - Select your GitHub repo
# - Set Port to 8080
# - Add environment variables in the dashboard

# 3. Deploy via the web interface
```

**Pros:** Affordable, straightforward, good documentation
**Cons:** Requires GitHub account

---

### 3. DigitalOcean Droplet (Most Control)

```bash
# 1. Create Droplet (Ubuntu 22.04)
# 2. SSH into server
ssh root@your_ip

# 3. Update system
apt update && apt upgrade -y

# 4. Install Node.js and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# 5. Clone repository
cd /var/www
git clone your-repo-url safenest
cd safenest

# 6. Install dependencies
npm install --production

# 7. Create .env file
nano .env
# Add your production values

# 8. Install PM2 (process manager)
npm install -g pm2

# 9. Start application with PM2
pm2 start server.js --name "safenest"
pm2 save
pm2 startup

# 10. Install and configure Nginx
apt install -y nginx

# Create Nginx config file
nano /etc/nginx/sites-available/safenest

# Add this config:
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/safenest /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx

# 11. Set up SSL with Let's Encrypt
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com

# 12. Setup automatic backups
# Add to crontab: crontab -e
# 0 2 * * * tar -czf /backups/safenest-$(date +\%Y\%m\%d).tar.gz /var/www/safenest/safenest-data/
```

**Pros:** Full control, affordable, scalable
**Cons:** Requires more technical knowledge

---

### 4. AWS EC2

```bash
# 1. Launch EC2 Instance
# - Choose Ubuntu 22.04 AMI
# - Instance type: t3.micro (eligible for free tier)
# - Configure security group: Allow ports 80, 443, 22

# 2. Connect via SSH
ssh -i your-key.pem ubuntu@your-instance-ip

# 3. Follow the same steps as DigitalOcean Droplet setup above
```

**Pros:** Highly scalable, enterprise-grade
**Cons:** More complex, requires AWS knowledge

---

### 5. Docker Deployment

```bash
# 1. Build Docker image
docker build -t safenest:latest .

# 2. Run locally to test
docker run -p 8080:8080 \
  -e ADMIN_PASSWORD="your-password" \
  -e CONTACT_EMAIL_TO="your-email@example.com" \
  -v safenest-data:/app/safenest-data \
  safenest:latest

# 3. Push to Docker Hub
docker login
docker tag safenest:latest yourname/safenest:latest
docker push yourname/safenest:latest

# 4. Deploy to any Docker-compatible platform
# - DigitalOcean Container Registry
# - AWS ECR
# - Azure Container Registry
# - Self-hosted Docker server
```

**Pros:** Consistent across environments, easy scaling
**Cons:** Requires Docker knowledge

---

## Monitoring & Maintenance

### View Logs
```bash
pm2 logs safenest
```

### Restart Application
```bash
pm2 restart safenest
```

### Monitor System Resources
```bash
pm2 monit
```

### Set Up Log Rotation
```bash
npm install pm2-logrotate -g
pm2 install pm2-logrotate
```

### Regular Backups
```bash
# Backup data directory daily
# Add to crontab: crontab -e
0 2 * * * tar -czf /backups/safenest-$(date +\%Y\%m\%d).tar.gz /var/www/safenest/safenest-data/
```

---

## Performance Optimization

1. **Enable Caching** - Add cache headers in server.js for static assets
2. **Use CDN** - CloudFlare, CloudFront for static content
3. **Database Optimization** - Consider moving to MongoDB/PostgreSQL for large scale
4. **Load Balancing** - Use Nginx or HAProxy for multiple servers

---

## Security Hardening

1. **Enable HTTPS** - Use Let's Encrypt (free SSL)
2. **Rate Limiting** - Implement in Nginx or app
3. **DDoS Protection** - CloudFlare, AWS Shield
4. **Database Backups** - Automate daily backups
5. **Monitoring** - Set up alerts for errors
6. **Update Node.js** - Keep security patches current

---

## Troubleshooting

**Application crashes:**
```bash
pm2 logs safenest
```

**Port already in use:**
```bash
lsof -i :8080
kill -9 <PID>
```

**Permission denied errors:**
```bash
chmod -R 755 safenest-data/
chown -R www-data:www-data safenest/
```

**HTTPS not working:**
```bash
certbot renew
systemctl restart nginx
```

---

## Recommended Deployment Stack

**For Small/Medium Projects:**
- Hosting: DigitalOcean App Platform or Heroku
- Database: JSON files (current) → Move to PostgreSQL if needed
- Monitoring: PM2 + native logs
- Backup: Daily tar.gz to S3/DigitalOcean Spaces

**For Large Projects:**
- Hosting: AWS EC2 + Load Balancer
- Database: PostgreSQL with RDS
- Cache: Redis
- Monitoring: New Relic, DataDog
- Backup: AWS Backup service

---

For more information, see README.md and GO_LIVE.md
