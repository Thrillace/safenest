# SafeNest Go-Live Notes

## Run locally

```bash
node server.js
```

If port 8080 is busy:

```bash
PORT=8090 node server.js
```

Open:

- Website: http://127.0.0.1:8080/
- Admin dashboard: http://127.0.0.1:8080/admin.html
- Orders: http://127.0.0.1:8080/admin-orders.html
- Assets: http://127.0.0.1:8080/admin-assets.html
- Messages: http://127.0.0.1:8080/admin-messages.html
- Live Chat: http://127.0.0.1:8080/admin-chat.html

If you use port 8090, replace `8080` with `8090`.

## Admin login

Default test admin details:

```text
Username: admin
Password: safenest-admin
```

Change this before going live.

## Change admin password

Option 1: from the admin page after logging in, click **Change Password** and confirm the current username and password.

Option 2: from Terminal:

```bash
node set-admin-password.js "your-new-password"
```

Use at least 8 characters. The password is stored as a hash in `safenest-data/admin-password.json`, not in the browser JavaScript. The default username is `admin`; on hosting, you can set a different username with the `ADMIN_USERNAME` environment variable.

## Data files

The server stores data in:

- `safenest-data/orders.json`
- `safenest-data/contacts.json`
- `safenest-data/chats.json`
- `safenest-data/admin-password.json`

Do not upload `safenest-data` publicly as static files. Use `node server.js` or a Node hosting provider so admin data stays server-side.

## Contact form email

Contact messages are always saved in `safenest-data/contacts.json`. To also receive them by email, set SMTP environment variables before starting the server:

```bash
SMTP_HOST="smtp.your-email-provider.com" \
SMTP_PORT="587" \
SMTP_USER="your-smtp-username" \
SMTP_PASS="your-smtp-password" \
CONTACT_EMAIL_TO="safenestshipping@consultant.com" \
CONTACT_EMAIL_FROM="safenestshipping@consultant.com" \
PORT=8090 node server.js
```

Use `SMTP_SECURE=true` for port `465`. For Gmail, Outlook, or most hosted mailboxes, use an app password or SMTP password from the email provider, not the normal account password.

## Client tracking credentials

For package tracking, give the client the package tracking number from the admin order record.

For asset tracking, create an asset record in the admin page. The client needs all three values from that record:

- Asset Tracking Number
- Client ID
- Access Code

These can be given on the vault intake receipt, confirmation email, signed custody certificate, or private client message after identity verification. Do not publish access codes publicly.

Sample asset tracking credentials for testing:

```text
Asset Tracking Number: AST-GLD-350KG
Client ID: CL-SAFE-1001
Access Code: GOLD-350-VAULT
```

## Live chat

The website live chat uses the Node server. The chat button only appears after a visitor successfully tracks an asset with a valid tracking number, client ID, and access code. Each public chat session lasts 5 minutes; after that, the visitor must track the asset again to start a new chat. The admin replies from the **Live Chat Inbox** on `admin.html`. Messages are stored in `safenest-data/chats.json`.
