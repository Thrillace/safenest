# SafeNest
My project hosted on Github.
A comprehensive web application for managing shipments, assets, customer communications, and administrative functions.

## Features

- 📦 **Order Management** - Track and manage shipping orders
- 🏷️ **Asset Management** - Organize and catalog assets
- 💬 **Live Chat** - Real-time customer communication
- 📧 **Contact Management** - Handle customer inquiries
- 🔐 **Admin Dashboard** - Secure administrative interface
- 📊 **Analytics** - Track orders and assets

## Prerequisites

- Node.js >= 14.0.0
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd safenest
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Configure environment variables in `.env`:
   - `PORT` - Server port (default: 8080)
   - `ADMIN_USERNAME` - Admin username (default: admin)
   - `ADMIN_PASSWORD` - Admin password (must be changed before production)
   - `CONTACT_EMAIL_TO` - Email to receive contact form submissions
   - `CONTACT_EMAIL_FROM` - Email sender address

## Running Locally

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

The application will be available at `http://localhost:8080`

### Custom Port
```bash
PORT=8090 npm start
```

## Admin Dashboard

Access the admin panel at `http://localhost:8080/admin.html`

### Default Credentials
- **Username:** admin
- **Password:** safenest-admin

⚠️ **Change these credentials before going live!**

### Available Admin Pages
- Dashboard: `/admin.html`
- Orders: `/admin-orders.html`
- Assets: `/admin-assets.html`
- Messages: `/admin-messages.html`
- Live Chat: `/admin-chat.html`

## Changing Admin Password

### Option 1: Using Admin Dashboard
1. Log in to the admin panel
2. Click "Change Password"
3. Enter current username and password
4. Enter new password (minimum 8 characters)

### Option 2: Using Command Line
```bash
npm run set-password "your-new-password"
```

Use at least 8 characters for security.

## Data Storage

All application data is stored locally in the `safenest-data/` directory:

- `admin-password.json` - Hashed admin password
- `orders.json` - Order records
- `assets.json` - Asset records
- `contacts.json` - Contact submissions
- `chats.json` - Chat messages

⚠️ **Backup your `safenest-data/` directory regularly before production deployments.**

## Deployment

### Option 1: Heroku
1. Create a Heroku account and install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set environment variables:
   ```bash
   heroku config:set ADMIN_PASSWORD="your-secure-password"
   heroku config:set CONTACT_EMAIL_TO="your-email@example.com"
   ```
5. Deploy: `git push heroku main`

### Option 2: DigitalOcean/AWS/VPS
1. SSH into your server
2. Clone the repository
3. Install Node.js
4. Create `.env` file with production values
5. Use PM2 or similar process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "safenest"
   pm2 save
   pm2 startup
   ```

### Option 3: Docker
1. Build: `docker build -t safenest .`
2. Run: `docker run -p 8080:8080 -e ADMIN_PASSWORD="secure-pass" safenest`

## File Structure

```
safenest/
├── server.js              # Main server file
├── package.json           # Node.js dependencies
├── .env.example           # Environment variables template
├── .gitignore             # Git ignore rules
├── README.md              # This file
├── style.css              # Global styles
├── script.js              # Frontend JavaScript
├── index.html             # Home page
├── admin.html             # Admin dashboard
├── admin.js               # Admin panel logic
├── admin-orders.html      # Orders management page
├── admin-assets.html      # Assets management page
├── admin-messages.html    # Messages management page
├── admin-chat.html        # Live chat page
├── asset-result.html      # Asset lookup page
├── asset-result.js        # Asset lookup logic
├── set-admin-password.js  # Password change utility
├── GO_LIVE.md            # Quick deployment guide
└── safenest-data/         # Data storage (auto-created)
    ├── admin-password.json
    ├── orders.json
    ├── assets.json
    ├── contacts.json
    └── chats.json
```

## Security Recommendations

Before going live:

1. ✅ Change the default admin password
2. ✅ Set strong environment variables
3. ✅ Use HTTPS in production
4. ✅ Regularly backup `safenest-data/` directory
5. ✅ Implement rate limiting for forms
6. ✅ Validate and sanitize all user inputs
7. ✅ Use a reverse proxy (nginx) in production
8. ✅ Keep Node.js updated
9. ✅ Monitor server logs
10. ✅ Set up automated backups

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Server listening port |
| `NODE_ENV` | development | Environment mode |
| `ADMIN_USERNAME` | admin | Admin login username |
| `ADMIN_PASSWORD` | safenest-admin | Admin login password |
| `CONTACT_EMAIL_TO` | safenestshipping@consultant.com | Email for contact form |
| `CONTACT_EMAIL_FROM` | (from SMTP_USER) | Sender email address |
| `SMTP_USER` | - | SMTP email account |

## Troubleshooting

### Port 8080 is already in use
Use a different port:
```bash
PORT=3000 npm start
```

### Admin login fails
1. Verify credentials in `.env`
2. Check `safenest-data/admin-password.json` exists
3. Reset password using `npm run set-password`

### Data not persisting
1. Ensure `safenest-data/` directory exists and is writable
2. Check file permissions
3. Verify disk space

## Support

For issues or questions, refer to the `GO_LIVE.md` file or review the server logs.

## License

ISC

## Version

v1.0.0
