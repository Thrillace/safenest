const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const password = process.argv[2];
if (!password || password.length < 8) {
    console.error('Usage: node set-admin-password.js "your-new-password"');
    console.error('Password must be at least 8 characters.');
    process.exit(1);
}

const dataDir = path.join(__dirname, 'safenest-data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
fs.writeFileSync(path.join(dataDir, 'admin-password.json'), JSON.stringify({ salt, hash, updatedAt: new Date().toISOString() }, null, 2));
console.log('Admin password updated. Restart the server if it is running.');
