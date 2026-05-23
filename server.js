const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const tls = require('tls');

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'safenest-data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const ASSETS_FILE = path.join(DATA_DIR, 'assets.json');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const PASSWORD_FILE = path.join(DATA_DIR, 'admin-password.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const ASSET_CHAT_TTL_MS = 1000 * 60 * 5;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const CONTACT_EMAIL_TO = process.env.CONTACT_EMAIL_TO || 'safenestshipping@consultant.com';
const CONTACT_EMAIL_FROM = process.env.CONTACT_EMAIL_FROM || process.env.SMTP_USER || CONTACT_EMAIL_TO;
const DEFAULT_PACKAGE_IMAGE = 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85';
const sessions = new Map();
const assetChatSessions = new Map();

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function ensureDataFiles() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]\n');
    if (!fs.existsSync(ASSETS_FILE)) fs.writeFileSync(ASSETS_FILE, '[]\n');
    if (!fs.existsSync(CONTACTS_FILE)) fs.writeFileSync(CONTACTS_FILE, '[]\n');
    if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, '[]\n');
    if (!fs.existsSync(PASSWORD_FILE)) {
        const initialPassword = process.env.ADMIN_PASSWORD || 'safenest-admin';
        fs.writeFileSync(PASSWORD_FILE, JSON.stringify(hashPassword(initialPassword), null, 2));
        console.log('Admin password initialized. Default is safenest-admin unless ADMIN_PASSWORD was set. Change it before going live.');
    }
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { salt, hash, updatedAt: new Date().toISOString() };
}

function verifyPassword(password) {
    const record = readJson(PASSWORD_FILE, null);
    if (!record || !record.salt || !record.hash) return false;
    const attempted = crypto.scryptSync(password, record.salt, 64);
    const stored = Buffer.from(record.hash, 'hex');
    return stored.length === attempted.length && crypto.timingSafeEqual(stored, attempted);
}

function updatePassword(password) {
    fs.writeFileSync(PASSWORD_FILE, JSON.stringify(hashPassword(password), null, 2));
}

function readJson(file, fallback) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        return fallback;
    }
}

function writeJson(file, value) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...securityHeaders(),
        ...extraHeaders
    });
    res.end(JSON.stringify(payload));
}

function smtpConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpEscape(value) {
    return String(value || '').replace(/\r?\n/g, '\r\n');
}

function encodeHeader(value) {
    const clean = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    return /[^\x20-\x7e]/.test(clean) ? `=?UTF-8?B?${Buffer.from(clean).toString('base64')}?=` : clean;
}

function smtpCommand(socket, command, expectedCodes) {
    return new Promise((resolve, reject) => {
        let response = '';
        const onData = chunk => {
            response += chunk.toString('utf8');
            const lines = response.split(/\r?\n/).filter(Boolean);
            const last = lines[lines.length - 1] || '';
            if (!/^\d{3} /.test(last)) return;
            socket.off('data', onData);
            const code = Number(last.slice(0, 3));
            if (!expectedCodes.includes(code)) {
                reject(new Error(`SMTP command failed: ${last}`));
                return;
            }
            resolve(response);
        };
        socket.on('data', onData);
        if (command) socket.write(`${command}\r\n`);
    });
}

async function sendContactEmail(contact) {
    if (!smtpConfigured()) {
        return { sent: false, reason: 'SMTP is not configured.' };
    }

    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
    let socket = secure
        ? tls.connect({ host, port, servername: host })
        : net.connect({ host, port });

    await new Promise((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('connect', () => { if (!secure) resolve(); });
        socket.once('error', reject);
    });

    try {
        await smtpCommand(socket, null, [220]);
        await smtpCommand(socket, `EHLO ${process.env.SMTP_HELO || 'safenest.local'}`, [250]);

        if (!secure && String(process.env.SMTP_STARTTLS || 'true').toLowerCase() !== 'false') {
            await smtpCommand(socket, 'STARTTLS', [220]);
            socket = tls.connect({ socket, servername: host });
            await new Promise((resolve, reject) => {
                socket.once('secureConnect', resolve);
                socket.once('error', reject);
            });
            await smtpCommand(socket, `EHLO ${process.env.SMTP_HELO || 'safenest.local'}`, [250]);
        }

        await smtpCommand(socket, 'AUTH LOGIN', [334]);
        await smtpCommand(socket, Buffer.from(process.env.SMTP_USER).toString('base64'), [334]);
        await smtpCommand(socket, Buffer.from(process.env.SMTP_PASS).toString('base64'), [235]);
        await smtpCommand(socket, `MAIL FROM:<${CONTACT_EMAIL_FROM}>`, [250]);
        await smtpCommand(socket, `RCPT TO:<${CONTACT_EMAIL_TO}>`, [250, 251]);
        await smtpCommand(socket, 'DATA', [354]);

        const subject = `SafeNest contact message from ${contact.name || 'website visitor'}`;
        const body = [
            `New contact form message`,
            ``,
            `Name: ${contact.name || 'Not provided'}`,
            `Email: ${contact.email || 'Not provided'}`,
            `Phone: ${contact.phone || 'Not provided'}`,
            `Service Interest: ${contact.serviceInterest || 'Not provided'}`,
            `Submitted: ${contact.createdAt}`,
            ``,
            `Message:`,
            contact.message || 'Not provided'
        ].join('\r\n');
        const rawMessage = [
            `From: ${encodeHeader('SafeNest Website')} <${CONTACT_EMAIL_FROM}>`,
            `To: <${CONTACT_EMAIL_TO}>`,
            `Reply-To: ${contact.email || CONTACT_EMAIL_FROM}`,
            `Subject: ${encodeHeader(subject)}`,
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=utf-8',
            '',
            smtpEscape(body),
            '.'
        ].join('\r\n');

        await smtpCommand(socket, rawMessage, [250]);
        await smtpCommand(socket, 'QUIT', [221]);
        return { sent: true };
    } finally {
        socket.end();
    }
}

function securityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    };
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 1_000_000) {
                reject(new Error('Request body too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
    });
}

function getCookie(req, name) {
    const cookie = req.headers.cookie || '';
    return cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${name}=`))?.split('=').slice(1).join('=');
}

function createSession() {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return token;
}

function createAssetChatSession(asset) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + ASSET_CHAT_TTL_MS;
    assetChatSessions.set(token, {
        expiresAt,
        assetTrackingNumber: asset.trackingNumber,
        clientId: asset.clientId,
        clientName: asset.clientName
    });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
}

function getAssetChatSession(token) {
    const session = assetChatSessions.get(token);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
        assetChatSessions.delete(token);
        return null;
    }
    return session;
}

function isAuthenticated(req) {
    const token = getCookie(req, 'safenest_admin');
    if (!token) return false;
    const expiresAt = sessions.get(token);
    if (!expiresAt || expiresAt < Date.now()) {
        sessions.delete(token);
        return false;
    }
    sessions.set(token, Date.now() + SESSION_TTL_MS);
    return true;
}

function clearSession(req) {
    const token = getCookie(req, 'safenest_admin');
    if (token) sessions.delete(token);
}

function publicChat(chat) {
    return {
        id: chat.id,
        customerName: chat.customerName,
        customerEmail: chat.customerEmail,
        status: chat.status,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        expiresAt: chat.expiresAt,
        assetTrackingNumber: chat.assetTrackingNumber,
        messages: chat.messages || []
    };
}

function assertChatActive(chat) {
    if (!chat) throw new Error('Chat not found.');
    if (chat.expiresAt && new Date(chat.expiresAt).getTime() < Date.now()) {
        throw new Error('This chat session has expired. Please track your asset again to start a new 5-minute chat.');
    }
}

function createChat({ customerName, customerEmail, message, assetSessionToken }) {
    const assetSession = getAssetChatSession(String(assetSessionToken || ''));
    if (!assetSession) throw new Error('Asset chat access expired. Please track your asset again.');
    const name = String(customerName || '').trim() || 'Website visitor';
    const email = String(customerEmail || '').trim();
    const body = String(message || '').trim();
    if (!body) throw new Error('Please enter a message.');

    const chats = readJson(CHATS_FILE, []);
    const now = new Date().toISOString();
    const chat = {
        id: crypto.randomUUID(),
        customerName: name,
        customerEmail: email,
        status: 'Open',
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(assetSession.expiresAt).toISOString(),
        assetTrackingNumber: assetSession.assetTrackingNumber,
        clientId: assetSession.clientId,
        clientName: assetSession.clientName,
        messages: [{ id: crypto.randomUUID(), from: 'customer', text: body, createdAt: now, readByAdmin: false }]
    };
    chats.unshift(chat);
    writeJson(CHATS_FILE, chats);
    return chat;
}

function addChatMessage(chatId, from, text) {
    const chats = readJson(CHATS_FILE, []);
    const chat = chats.find(item => item.id === chatId);
    if (from !== 'admin') assertChatActive(chat);
    if (!chat) throw new Error('Chat not found.');
    const body = String(text || '').trim();
    if (!body) throw new Error('Please enter a message.');

    const now = new Date().toISOString();
    chat.status = from === 'admin' ? 'Replied' : 'Open';
    chat.updatedAt = now;
    chat.messages.push({
        id: crypto.randomUUID(),
        from,
        text: body,
        createdAt: now,
        readByAdmin: from === 'admin'
    });
    writeJson(CHATS_FILE, chats);
    return chat;
}

function getChat(chatId) {
    const chat = readJson(CHATS_FILE, []).find(item => item.id === chatId);
    assertChatActive(chat);
    return chat;
}

function markChatRead(chatId) {
    const chats = readJson(CHATS_FILE, []);
    const chat = chats.find(item => item.id === chatId);
    if (!chat) return null;
    chat.messages = (chat.messages || []).map(message => ({ ...message, readByAdmin: true }));
    writeJson(CHATS_FILE, chats);
    return chat;
}

function unreadChatCount(chats) {
    return chats.filter(chat => (chat.messages || []).some(message => message.from === 'customer' && !message.readByAdmin)).length;
}

function normalizeOrder(input, existing = {}) {
    const trackingCode = String(input.trackingCode || '').trim();
    const clientName = String(input.clientName || '').trim();
    const origin = String(input.origin || '').trim();
    const destination = String(input.destination || '').trim();
    const status = String(input.status || 'Processing').trim();
    const shippingMethod = String(input.shippingMethod || 'Swift Cargo').trim();

    if (!trackingCode || !clientName || !origin || !destination) {
        throw new Error('Tracking number, client name, origin, and destination are required.');
    }

    return {
        id: existing.id || crypto.randomUUID(),
        trackingCode,
        clientName,
        clientEmail: String(input.clientEmail || '').trim(),
        itemName: String(input.itemName || existing.itemName || 'Allocated Gold Bullion').trim(),
        itemImage: String(input.itemImage || existing.itemImage || DEFAULT_PACKAGE_IMAGE).trim(),
        shippingMethod,
        origin,
        destination,
        status,
        estimatedDelivery: String(input.estimatedDelivery || '').trim(),
        priority: String(input.priority || 'Standard').trim(),
        notes: String(input.notes || '').trim(),
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function publicOrder(order) {
    return {
        trackingCode: order.trackingCode,
        status: order.status,
        shippingMethod: order.shippingMethod,
        itemName: order.itemName || 'Allocated Gold Bullion',
        itemImage: order.itemImage || DEFAULT_PACKAGE_IMAGE,
        origin: order.origin,
        destination: order.destination,
        estimatedDelivery: order.estimatedDelivery,
        updatedAt: order.updatedAt
    };
}

function parseDocuments(input) {
    if (Array.isArray(input)) {
        return input.map(doc => ({
            name: String(doc.name || '').trim(),
            status: String(doc.status || 'Saved').trim(),
            reference: String(doc.reference || '').trim()
        })).filter(doc => doc.name);
    }

    return String(input || '')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => {
            const [name = '', status = 'Saved', reference = ''] = line.split('|').map(part => part.trim());
            return { name, status, reference };
        })
        .filter(doc => doc.name);
}

function normalizeAsset(input, existing = {}) {
    const trackingNumber = String(input.trackingNumber || '').trim();
    const clientId = String(input.clientId || '').trim();
    const accessCode = String(input.accessCode || existing.accessCode || '').trim();
    const clientName = String(input.clientName || '').trim();
    const assetName = String(input.assetName || '').trim();

    if (!trackingNumber || !clientId || !accessCode || !clientName || !assetName) {
        throw new Error('Tracking number, client ID, access code, client name, and asset name are required.');
    }

    return {
        id: existing.id || crypto.randomUUID(),
        trackingNumber,
        clientId,
        accessCode,
        clientName,
        clientEmail: String(input.clientEmail || '').trim(),
        assetName,
        assetCategory: String(input.assetCategory || 'Precious Metals').trim(),
        quantity: String(input.quantity || '').trim(),
        declaredValue: String(input.declaredValue || '').trim(),
        status: String(input.status || 'Secured in Vault').trim(),
        storageLocation: String(input.storageLocation || 'London Vault - Allocated Storage').trim(),
        insurancePolicy: String(input.insurancePolicy || '').trim(),
        intakeDate: String(input.intakeDate || '').trim(),
        lastAuditDate: String(input.lastAuditDate || '').trim(),
        imageUrl: String(input.imageUrl || DEFAULT_PACKAGE_IMAGE).trim(),
        description: String(input.description || '').trim(),
        documents: parseDocuments(input.documents),
        notes: String(input.notes || '').trim(),
        createdAt: existing.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function publicAsset(asset) {
    return {
        trackingNumber: asset.trackingNumber,
        clientId: asset.clientId,
        clientName: asset.clientName,
        assetName: asset.assetName,
        assetCategory: asset.assetCategory,
        quantity: asset.quantity,
        declaredValue: asset.declaredValue,
        status: asset.status,
        storageLocation: asset.storageLocation,
        insurancePolicy: asset.insurancePolicy,
        intakeDate: asset.intakeDate,
        lastAuditDate: asset.lastAuditDate,
        imageUrl: asset.imageUrl || DEFAULT_PACKAGE_IMAGE,
        description: asset.description,
        documents: asset.documents || [],
        updatedAt: asset.updatedAt
    };
}

function seedAssets() {
    const assets = readJson(ASSETS_FILE, []);
    const existingCodes = new Set(assets.map(asset => asset.trackingNumber));
    const samples = [
        {
            trackingNumber: 'AST-GLD-350KG',
            clientId: 'CL-SAFE-1001',
            accessCode: 'GOLD-350-VAULT',
            clientName: 'Michael Stone',
            clientEmail: 'michael@example.com',
            assetName: '350kg Allocated Gold Bars',
            assetCategory: 'Precious Metals',
            quantity: '350kg of LBMA gold bars',
            declaredValue: '$26,400,000',
            status: 'Secured in Vault',
            storageLocation: 'London Vault - Chamber A / Bay 14',
            insurancePolicy: 'Lloyds Cover SNV-GLD-350',
            intakeDate: '2026-05-10',
            lastAuditDate: '2026-05-21',
            imageUrl: DEFAULT_PACKAGE_IMAGE,
            description: 'Allocated gold bars sealed, weighed, photographed, and held under insured segregated custody.',
            documents: [
                { name: 'Gold Bar Assay Certificate', status: 'Verified', reference: 'DOC-ASSAY-350' },
                { name: 'Insurance Certificate', status: 'Saved', reference: 'DOC-INS-350' },
                { name: 'Vault Intake Receipt', status: 'Signed', reference: 'DOC-REC-350' }
            ],
            notes: 'Client receives tracking number, client ID, and access code after intake verification.'
        },
        {
            trackingNumber: 'AST-HSE-4482',
            clientId: 'CL-SAFE-1002',
            accessCode: 'HOUSE-DOC-4482',
            clientName: 'Amara Wells',
            clientEmail: 'amara@example.com',
            assetName: 'House Ownership Documents',
            assetCategory: 'Legal Documents',
            quantity: '1 sealed document portfolio',
            declaredValue: 'Confidential',
            status: 'Document Vault Secured',
            storageLocation: 'London Vault - Document Safe D3',
            insurancePolicy: 'Document custody cover',
            intakeDate: '2026-05-12',
            lastAuditDate: '2026-05-20',
            imageUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=85',
            description: 'Original property deed, purchase contract, land registry copy, and notarized supporting papers.',
            documents: [
                { name: 'Property Deed', status: 'Original Saved', reference: 'DOC-DEED-4482' },
                { name: 'Land Registry Copy', status: 'Verified', reference: 'DOC-LAND-4482' },
                { name: 'Notary Certificate', status: 'Saved', reference: 'DOC-NOTARY-4482' }
            ],
            notes: 'Release requires client identity confirmation and document request approval.'
        },
        {
            trackingNumber: 'AST-JWL-2209',
            clientId: 'CL-SAFE-1003',
            accessCode: 'JEWEL-2209',
            clientName: 'Priya Shah',
            clientEmail: 'priya@example.com',
            assetName: 'Diamond Jewelry Collection',
            assetCategory: 'Jewelry',
            quantity: '12 inventoried jewelry pieces',
            declaredValue: '$840,000',
            status: 'Climate Controlled Storage',
            storageLocation: 'London Vault - Jewelry Cabinet J7',
            insurancePolicy: 'Fine Jewelry Cover SNV-JWL-2209',
            intakeDate: '2026-05-15',
            lastAuditDate: '2026-05-22',
            imageUrl: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?auto=format&fit=crop&w=1200&q=85',
            description: 'Diamond necklace, bracelets, rings, and matching earrings cataloged with photo inventory.',
            documents: [
                { name: 'Gemological Appraisal', status: 'Verified', reference: 'DOC-GEM-2209' },
                { name: 'Photo Inventory', status: 'Saved', reference: 'DOC-PHOTO-2209' },
                { name: 'Insurance Schedule', status: 'Saved', reference: 'DOC-INS-2209' }
            ],
            notes: 'Annual valuation review recommended.'
        }
    ];

    const existingByCode = new Map(assets.map(asset => [asset.trackingNumber, asset]));
    const refreshed = assets.map(asset => {
        const sample = samples.find(item => item.trackingNumber === asset.trackingNumber);
        if (!sample) return asset;
        return { ...asset, documents: asset.documents?.length ? asset.documents : sample.documents, imageUrl: asset.imageUrl || sample.imageUrl };
    });
    const newSamples = samples.filter(asset => !existingCodes.has(asset.trackingNumber)).map(asset => normalizeAsset(asset));
    const next = [...newSamples, ...refreshed];
    writeJson(ASSETS_FILE, next);
    return { assets: next, addedCount: newSamples.length, totalSamples: samples.length };
}

function seedOrders() {
    const orders = readJson(ORDERS_FILE, []);
    const existingCodes = new Set(orders.map(order => order.trackingCode));
    const samples = [
        { trackingCode: 'SNV-2026-001', clientName: 'Michael Stone', clientEmail: 'michael@example.com', shippingMethod: 'Aero Freight', origin: 'London Vault', destination: 'New York, USA', status: 'In Transit', estimatedDelivery: '2026-05-28', priority: 'High', itemName: 'Allocated Gold Bullion', itemImage: DEFAULT_PACKAGE_IMAGE, notes: 'Insured precious metals transfer. Confirm recipient ID before handoff.' },
        { trackingCode: 'SNV-2026-002', clientName: 'Amara Wells', clientEmail: 'amara@example.com', shippingMethod: 'Swift Cargo', origin: 'London Vault', destination: 'Paris, France', status: 'Customs Review', estimatedDelivery: '2026-05-24', priority: 'Standard', itemName: 'Fine Art Collection', itemImage: 'https://images.unsplash.com/photo-1578926288207-a90a5366759d?auto=format&fit=crop&w=1200&q=85', notes: 'Artwork shipment awaiting customs confirmation.' },
        { trackingCode: 'SNV-2026-003', clientName: 'Daniel Pierce', clientEmail: 'daniel@example.com', shippingMethod: 'Cargo Xpress', origin: 'Manchester, UK', destination: 'London Vault', status: 'Delivered', estimatedDelivery: '2026-05-20', priority: 'Critical', itemName: 'Sealed Silver Bars', itemImage: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85', notes: 'Delivered to vault intake. Storage compartment assigned.' },
        { trackingCode: 'SNV-2026-004', clientName: 'Sophia Grant', clientEmail: 'sophia@example.com', shippingMethod: 'Vault Transfer', origin: 'Zurich, Switzerland', destination: 'London Vault', status: 'Packed', estimatedDelivery: '2026-05-26', priority: 'High', itemName: 'Gold Bullion Deposit', itemImage: DEFAULT_PACKAGE_IMAGE, notes: 'Bullion intake. Prepare receiving bay and inventory witness.' },
        { trackingCode: 'SNV-2026-005', clientName: 'Noah Bennett', clientEmail: 'noah@example.com', shippingMethod: 'Aero Freight', origin: 'London Vault', destination: 'Dubai, UAE', status: 'Out for Delivery', estimatedDelivery: '2026-05-22', priority: 'Critical', itemName: 'Gold Vault Shipment', itemImage: DEFAULT_PACKAGE_IMAGE, notes: 'Final-mile armored delivery. Client requested phone confirmation.' },
        { trackingCode: 'SNV-2026-006', clientName: 'Lina Kovac', clientEmail: 'lina@example.com', shippingMethod: 'Swift Cargo', origin: 'London Vault', destination: 'Berlin, Germany', status: 'Processing', estimatedDelivery: '2026-05-30', priority: 'Standard', itemName: 'Rare Collectibles Case', itemImage: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?auto=format&fit=crop&w=1200&q=85', notes: 'Collectibles shipment. Add fragile handling labels.' },
        { trackingCode: 'SNV-2026-007', clientName: 'Omar Hughes', clientEmail: 'omar@example.com', shippingMethod: 'Cargo Xpress', origin: 'Madrid, Spain', destination: 'London Vault', status: 'On Hold', estimatedDelivery: '2026-06-02', priority: 'High', itemName: 'Insured Asset Case', itemImage: DEFAULT_PACKAGE_IMAGE, notes: 'Hold pending insurance document update.' },
        { trackingCode: 'SNV-2026-008', clientName: 'Priya Shah', clientEmail: 'priya@example.com', shippingMethod: 'Aero Freight', origin: 'London Vault', destination: 'Toronto, Canada', status: 'In Transit', estimatedDelivery: '2026-05-29', priority: 'Standard', itemName: 'Gold Security Pouch', itemImage: DEFAULT_PACKAGE_IMAGE, notes: 'Secure pouch manifest attached to order record.' }
    ];
    const sampleByCode = new Map(samples.map(order => [order.trackingCode, order]));
    const refreshedOrders = orders.map(order => {
        const sample = sampleByCode.get(order.trackingCode);
        if (!sample) return order;
        return {
            ...order,
            itemName: order.itemName || sample.itemName,
            itemImage: order.itemImage || sample.itemImage,
            updatedAt: order.updatedAt || new Date().toISOString()
        };
    });
    const newSamples = samples.filter(order => !existingCodes.has(order.trackingCode)).map(order => normalizeOrder(order));
    const next = [...newSamples, ...refreshedOrders];
    writeJson(ORDERS_FILE, next);
    return { orders: next, addedCount: newSamples.length, totalSamples: samples.length };
}

async function handleApi(req, res, pathname) {
    try {
        if (req.method === 'GET' && pathname === '/api/admin/session') {
            return sendJson(res, 200, { authenticated: isAuthenticated(req) });
        }

        if (req.method === 'POST' && pathname === '/api/admin/login') {
            const body = await readBody(req);
            if (String(body.username || '').trim() !== ADMIN_USERNAME || !verifyPassword(String(body.password || ''))) {
                return sendJson(res, 401, { error: 'Incorrect admin username or password.' });
            }
            const token = createSession();
            return sendJson(res, 200, { authenticated: true, username: ADMIN_USERNAME }, {
                'Set-Cookie': `safenest_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`
            });
        }

        if (req.method === 'POST' && pathname === '/api/admin/logout') {
            clearSession(req);
            return sendJson(res, 200, { authenticated: false }, {
                'Set-Cookie': 'safenest_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
            });
        }

        if (pathname.startsWith('/api/admin/') && !isAuthenticated(req)) {
            return sendJson(res, 401, { error: 'Admin login required.' });
        }

        if (req.method === 'GET' && pathname === '/api/admin/orders') {
            return sendJson(res, 200, { data: readJson(ORDERS_FILE, []) });
        }

        if (req.method === 'POST' && pathname === '/api/admin/orders') {
            const body = await readBody(req);
            const orders = readJson(ORDERS_FILE, []);
            const order = normalizeOrder(body);
            if (orders.some(item => item.trackingCode.toLowerCase() === order.trackingCode.toLowerCase())) {
                return sendJson(res, 409, { error: 'Tracking number already exists.' });
            }
            orders.unshift(order);
            writeJson(ORDERS_FILE, orders);
            return sendJson(res, 201, { data: order });
        }

        const orderMatch = pathname.match(/^\/api\/admin\/orders\/([^/]+)$/);
        if (orderMatch && req.method === 'PUT') {
            const body = await readBody(req);
            const orders = readJson(ORDERS_FILE, []);
            const index = orders.findIndex(order => order.id === orderMatch[1]);
            if (index === -1) return sendJson(res, 404, { error: 'Order not found.' });
            const order = normalizeOrder(body, orders[index]);
            if (orders.some(item => item.id !== order.id && item.trackingCode.toLowerCase() === order.trackingCode.toLowerCase())) {
                return sendJson(res, 409, { error: 'Tracking number already exists.' });
            }
            orders[index] = order;
            writeJson(ORDERS_FILE, orders);
            return sendJson(res, 200, { data: order });
        }

        if (orderMatch && req.method === 'DELETE') {
            const orders = readJson(ORDERS_FILE, []);
            const next = orders.filter(order => order.id !== orderMatch[1]);
            if (next.length === orders.length) return sendJson(res, 404, { error: 'Order not found.' });
            writeJson(ORDERS_FILE, next);
            return sendJson(res, 200, { deleted: true });
        }

        if (req.method === 'POST' && pathname === '/api/admin/orders/seed') {
            const seeded = seedOrders();
            return sendJson(res, 200, { data: seeded.orders, addedCount: seeded.addedCount, totalSamples: seeded.totalSamples });
        }

        if (req.method === 'GET' && pathname === '/api/admin/assets') {
            return sendJson(res, 200, { data: readJson(ASSETS_FILE, []) });
        }

        if (req.method === 'GET' && pathname === '/api/admin/contacts') {
            return sendJson(res, 200, { data: readJson(CONTACTS_FILE, []) });
        }

        const contactMatch = pathname.match(/^\/api\/admin\/contacts\/([^/]+)$/);
        if (contactMatch && req.method === 'DELETE') {
            const contacts = readJson(CONTACTS_FILE, []);
            const next = contacts.filter(contact => contact.id !== contactMatch[1]);
            if (next.length === contacts.length) return sendJson(res, 404, { error: 'Message not found.' });
            writeJson(CONTACTS_FILE, next);
            return sendJson(res, 200, { deleted: true, data: next });
        }

        if (req.method === 'POST' && pathname === '/api/admin/assets') {
            const body = await readBody(req);
            const assets = readJson(ASSETS_FILE, []);
            const asset = normalizeAsset(body);
            if (assets.some(item => item.trackingNumber.toLowerCase() === asset.trackingNumber.toLowerCase())) {
                return sendJson(res, 409, { error: 'Asset tracking number already exists.' });
            }
            assets.unshift(asset);
            writeJson(ASSETS_FILE, assets);
            return sendJson(res, 201, { data: asset });
        }

        const assetMatch = pathname.match(/^\/api\/admin\/assets\/([^/]+)$/);
        if (assetMatch && req.method === 'PUT') {
            const body = await readBody(req);
            const assets = readJson(ASSETS_FILE, []);
            const index = assets.findIndex(asset => asset.id === assetMatch[1]);
            if (index === -1) return sendJson(res, 404, { error: 'Asset not found.' });
            const asset = normalizeAsset(body, assets[index]);
            if (assets.some(item => item.id !== asset.id && item.trackingNumber.toLowerCase() === asset.trackingNumber.toLowerCase())) {
                return sendJson(res, 409, { error: 'Asset tracking number already exists.' });
            }
            assets[index] = asset;
            writeJson(ASSETS_FILE, assets);
            return sendJson(res, 200, { data: asset });
        }

        if (assetMatch && req.method === 'DELETE') {
            const assets = readJson(ASSETS_FILE, []);
            const next = assets.filter(asset => asset.id !== assetMatch[1]);
            if (next.length === assets.length) return sendJson(res, 404, { error: 'Asset not found.' });
            writeJson(ASSETS_FILE, next);
            return sendJson(res, 200, { deleted: true });
        }

        if (req.method === 'POST' && pathname === '/api/admin/assets/seed') {
            const seeded = seedAssets();
            return sendJson(res, 200, { data: seeded.assets, addedCount: seeded.addedCount, totalSamples: seeded.totalSamples });
        }

        if (req.method === 'POST' && pathname === '/api/admin/password') {
            const body = await readBody(req);
            const currentUsername = String(body.currentUsername || '').trim();
            const currentPassword = String(body.currentPassword || '');
            const newPassword = String(body.newPassword || '');
            if (currentUsername !== ADMIN_USERNAME) return sendJson(res, 401, { error: 'Current username is incorrect.' });
            if (!verifyPassword(currentPassword)) return sendJson(res, 401, { error: 'Current password is incorrect.' });
            if (newPassword.length < 8) return sendJson(res, 400, { error: 'New password must be at least 8 characters.' });
            updatePassword(newPassword);
            sessions.clear();
            return sendJson(res, 200, { changed: true }, {
                'Set-Cookie': 'safenest_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
            });
        }

        if (req.method === 'POST' && pathname === '/api/shipping/track') {
            const body = await readBody(req);
            const packageNumber = String(body.packageNumber || '').trim().toLowerCase();
            const order = readJson(ORDERS_FILE, []).find(item => item.trackingCode.toLowerCase() === packageNumber);
            if (!order) return sendJson(res, 404, { error: 'Package not found.' });
            return sendJson(res, 200, { data: publicOrder(order) });
        }

        if (req.method === 'POST' && pathname === '/api/assets/track') {
            const body = await readBody(req);
            const trackingNumber = String(body.trackingNumber || '').trim().toLowerCase();
            const clientId = String(body.clientId || '').trim().toLowerCase();
            const accessCode = String(body.accessCode || '').trim();
            const asset = readJson(ASSETS_FILE, []).find(item =>
                item.trackingNumber.toLowerCase() === trackingNumber &&
                item.clientId.toLowerCase() === clientId &&
                item.accessCode === accessCode
            );
            if (!asset) return sendJson(res, 404, { error: 'Asset not found or invalid tracking credentials.' });
            const chatSession = createAssetChatSession(asset);
            return sendJson(res, 200, {
                data: {
                    ...publicAsset(asset),
                    assetSessionToken: chatSession.token,
                    chatExpiresAt: chatSession.expiresAt
                }
            });
        }

        if (req.method === 'POST' && pathname === '/api/chat/start') {
            const body = await readBody(req);
            const chat = createChat(body);
            return sendJson(res, 201, { data: publicChat(chat) });
        }

        const publicChatMatch = pathname.match(/^\/api\/chat\/([^/]+)$/);
        if (publicChatMatch && req.method === 'GET') {
            const chat = getChat(publicChatMatch[1]);
            if (!chat) return sendJson(res, 404, { error: 'Chat not found.' });
            return sendJson(res, 200, { data: publicChat(chat) });
        }

        if (publicChatMatch && req.method === 'POST') {
            const body = await readBody(req);
            const chat = addChatMessage(publicChatMatch[1], 'customer', body.message);
            return sendJson(res, 201, { data: publicChat(chat) });
        }

        if (req.method === 'GET' && pathname === '/api/admin/chats') {
            const chats = readJson(CHATS_FILE, []);
            return sendJson(res, 200, { data: chats.map(publicChat), unreadCount: unreadChatCount(chats) });
        }

        const adminChatMatch = pathname.match(/^\/api\/admin\/chats\/([^/]+)$/);
        if (adminChatMatch && req.method === 'GET') {
            const chat = markChatRead(adminChatMatch[1]);
            if (!chat) return sendJson(res, 404, { error: 'Chat not found.' });
            return sendJson(res, 200, { data: publicChat(chat) });
        }

        if (adminChatMatch && req.method === 'POST') {
            const body = await readBody(req);
            const chat = addChatMessage(adminChatMatch[1], 'admin', body.message);
            return sendJson(res, 201, { data: publicChat(chat) });
        }

        if (req.method === 'POST' && pathname === '/api/contact') {
            const body = await readBody(req);
            const contacts = readJson(CONTACTS_FILE, []);
            const contact = {
                id: crypto.randomUUID(),
                name: String(body.name || '').trim(),
                email: String(body.email || '').trim(),
                phone: String(body.phone || '').trim(),
                serviceInterest: String(body.serviceInterest || '').trim(),
                message: String(body.message || '').trim(),
                createdAt: new Date().toISOString()
            };
            if (!contact.name || !contact.email || !contact.serviceInterest || !contact.message) {
                return sendJson(res, 400, { error: 'Name, email, service interest, and message are required.' });
            }
            contacts.unshift(contact);
            writeJson(CONTACTS_FILE, contacts);

            try {
                const email = await sendContactEmail(contact);
                return sendJson(res, 201, { ok: true, emailSent: email.sent, emailMessage: email.reason || '' });
            } catch (emailError) {
                console.error('Contact email failed:', emailError.message);
                return sendJson(res, 202, {
                    ok: true,
                    emailSent: false,
                    emailMessage: 'Message was saved, but email delivery failed. Check SMTP settings on the server.'
                });
            }
        }

        return sendJson(res, 404, { error: 'API route not found.' });
    } catch (error) {
        return sendJson(res, 400, { error: error.message || 'Request failed.' });
    }
}

function serveStatic(req, res, pathname) {
    let filePath = pathname === '/' ? path.join(ROOT, 'index.html') : path.join(ROOT, decodeURIComponent(pathname));
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(ROOT) || resolved.includes(`${path.sep}safenest-data${path.sep}`) || resolved.endsWith('server.js')) {
        res.writeHead(404, securityHeaders());
        return res.end('Not found');
    }

    fs.readFile(resolved, (error, data) => {
        if (error) {
            res.writeHead(404, securityHeaders());
            return res.end('Not found');
        }
        const ext = path.extname(resolved).toLowerCase();
        res.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'application/octet-stream',
            ...securityHeaders()
        });
        res.end(data);
    });
}

ensureDataFiles();

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
        handleApi(req, res, url.pathname);
        return;
    }
    serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
    console.log(`SafeNest site running at http://127.0.0.1:${PORT}/`);
    console.log(`Admin page: http://127.0.0.1:${PORT}/admin.html`);
});
