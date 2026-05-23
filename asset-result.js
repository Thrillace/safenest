const ASSET_RESULT_KEY = 'safenestAssetTrackingResult';
const LIVE_CHAT_KEY = 'safenestLiveChatId';
const API_BASE_URL = '/api';
let assetRecord = null;
let liveChatPoller = null;
let liveChatTimer = null;

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function renderAssetResult(asset) {
    const docs = (asset.documents || []).map(doc => `
        <li>
            <span>${escapeHtml(doc.name)}</span>
            <strong>${escapeHtml(doc.status || 'Saved')}</strong>
            ${doc.reference ? `<small>${escapeHtml(doc.reference)}</small>` : ''}
        </li>
    `).join('');

    return `
        <div class="asset-result-card standalone-asset-card">
            <div class="asset-result-media">
                <img src="${escapeHtml(asset.imageUrl)}" alt="${escapeHtml(asset.assetName)}">
            </div>
            <div class="asset-result-body">
                <strong>Asset Verified</strong>
                <h3>${escapeHtml(asset.assetName)}</h3>
                <p>${escapeHtml(asset.description || 'Secure asset held under SafeNest custody.')}</p>
                <div class="asset-detail-grid">
                    <div><span>Status</span><b>${escapeHtml(asset.status)}</b></div>
                    <div><span>Quantity</span><b>${escapeHtml(asset.quantity || 'Recorded')}</b></div>
                    <div><span>Category</span><b>${escapeHtml(asset.assetCategory)}</b></div>
                    <div><span>Declared Value</span><b>${escapeHtml(asset.declaredValue || 'Confidential')}</b></div>
                    <div><span>Storage Location</span><b>${escapeHtml(asset.storageLocation)}</b></div>
                    <div><span>Insurance</span><b>${escapeHtml(asset.insurancePolicy || 'On file')}</b></div>
                    <div><span>Intake Date</span><b>${escapeHtml(asset.intakeDate || 'On file')}</b></div>
                    <div><span>Last Audit</span><b>${escapeHtml(asset.lastAuditDate || 'Pending')}</b></div>
                </div>
                <div class="asset-documents">
                    <h4>Saved Documents</h4>
                    <ul>${docs || '<li><span>No public document records listed</span><strong>On file</strong></li>'}</ul>
                </div>
            </div>
        </div>
    `;
}

const target = document.getElementById('assetResultContent');
const stored = sessionStorage.getItem(ASSET_RESULT_KEY);

if (!stored) {
    target.innerHTML = `
        <div class="asset-result-empty">
            <h2>No asset result is available</h2>
            <p>Please return to the tracking form and enter your asset tracking credentials again.</p>
        </div>
    `;
} else {
    try {
        assetRecord = JSON.parse(stored);
        target.innerHTML = renderAssetResult(assetRecord);
        initializeAssetChat();
    } catch (error) {
        target.innerHTML = `
            <div class="asset-result-empty">
                <h2>Unable to load asset details</h2>
                <p>Please return to the tracking form and try again.</p>
            </div>
        `;
    }
}

function assetChatIsActive() {
    return assetRecord?.assetSessionToken && assetRecord?.chatExpiresAt && new Date(assetRecord.chatExpiresAt).getTime() > Date.now();
}

function remainingChatTime() {
    if (!assetRecord?.chatExpiresAt) return '00:00';
    const remainingMs = Math.max(0, new Date(assetRecord.chatExpiresAt).getTime() - Date.now());
    const minutes = String(Math.floor(remainingMs / 60000)).padStart(2, '0');
    const seconds = String(Math.floor((remainingMs % 60000) / 1000)).padStart(2, '0');
    return `${minutes}:${seconds}`;
}

function updateChatAccess() {
    const button = document.getElementById('liveChatBtn');
    const countdown = document.getElementById('liveChatCountdown');
    if (countdown) countdown.textContent = remainingChatTime();
    if (!button) return;

    if (assetChatIsActive()) {
        button.hidden = false;
        return;
    }

    button.hidden = true;
    localStorage.removeItem(LIVE_CHAT_KEY);
    stopLiveChatPolling();
    const panel = document.getElementById('liveChatPanel');
    if (panel) {
        panel.classList.remove('active');
        const status = document.getElementById('liveChatStatus') || document.getElementById('liveChatReplyStatus');
        if (status) status.textContent = 'Chat session expired. Track your asset again to start another chat.';
    }
}

function initializeAssetChat() {
    const liveChatBtn = document.getElementById('liveChatBtn');
    if (!liveChatBtn || !assetChatIsActive()) {
        updateChatAccess();
        return;
    }

    liveChatBtn.hidden = false;
    liveChatBtn.addEventListener('click', () => {
        if (!assetChatIsActive()) {
            updateChatAccess();
            return;
        }
        const panel = ensureLiveChatPanel();
        panel.classList.toggle('active');
        if (panel.classList.contains('active')) {
            loadLiveChat().catch(() => {});
            if (localStorage.getItem(LIVE_CHAT_KEY)) startLiveChatPolling();
        } else {
            stopLiveChatPolling();
        }
    });

    updateChatAccess();
    liveChatTimer = setInterval(updateChatAccess, 1000);
}

function ensureLiveChatPanel() {
    let panel = document.getElementById('liveChatPanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'liveChatPanel';
    panel.className = 'live-chat-panel';
    panel.innerHTML = `
        <div class="live-chat-header">
            <div>
                <strong>SafeNest Asset Chat</strong>
                <span>Session ends in <b id="liveChatCountdown">${remainingChatTime()}</b></span>
            </div>
            <button type="button" id="closeLiveChat" aria-label="Close live chat">&times;</button>
        </div>
        <div class="live-chat-thread" id="liveChatThread"></div>
        <form class="live-chat-start" id="liveChatStartForm">
            <div class="form-group">
                <label for="liveChatName">Name</label>
                <input type="text" id="liveChatName" value="${escapeHtml(assetRecord.clientName || '')}" placeholder="Your name" required>
            </div>
            <div class="form-group">
                <label for="liveChatEmail">Email</label>
                <input type="email" id="liveChatEmail" placeholder="your@email.com">
            </div>
            <div class="form-group">
                <label for="liveChatInitialMessage">Message</label>
                <textarea id="liveChatInitialMessage" placeholder="How can we help with this asset?" required></textarea>
            </div>
            <button type="submit" class="btn">Start Chat</button>
            <div class="live-chat-status" id="liveChatStatus"></div>
        </form>
        <form class="live-chat-reply" id="liveChatReplyForm" hidden>
            <textarea id="liveChatMessage" placeholder="Type your message" required></textarea>
            <button type="submit" class="btn">Send</button>
            <div class="live-chat-status" id="liveChatReplyStatus"></div>
        </form>
    `;
    document.body.appendChild(panel);

    document.getElementById('closeLiveChat').addEventListener('click', () => {
        panel.classList.remove('active');
        stopLiveChatPolling();
    });
    document.getElementById('liveChatStartForm').addEventListener('submit', startLiveChat);
    document.getElementById('liveChatReplyForm').addEventListener('submit', sendLiveChatMessage);
    return panel;
}

function formatLiveChatTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function renderLiveChat(chat) {
    const thread = document.getElementById('liveChatThread');
    const startForm = document.getElementById('liveChatStartForm');
    const replyForm = document.getElementById('liveChatReplyForm');
    if (!thread || !chat) return;

    startForm.hidden = true;
    replyForm.hidden = false;
    thread.innerHTML = (chat.messages || []).map(message => `
        <div class="live-chat-message ${message.from === 'admin' ? 'from-admin' : 'from-customer'}">
            <span>${message.from === 'admin' ? 'Admin' : 'You'}</span>
            <p>${escapeHtml(message.text)}</p>
            <small>${formatLiveChatTime(message.createdAt)}</small>
        </div>
    `).join('');
    thread.scrollTop = thread.scrollHeight;
}

async function startLiveChat(event) {
    event.preventDefault();
    const status = document.getElementById('liveChatStatus');
    if (!assetChatIsActive()) {
        updateChatAccess();
        return;
    }
    status.textContent = 'Starting chat...';
    try {
        const response = await fetch(`${API_BASE_URL}/chat/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customerName: document.getElementById('liveChatName').value,
                customerEmail: document.getElementById('liveChatEmail').value,
                message: document.getElementById('liveChatInitialMessage').value,
                assetSessionToken: assetRecord.assetSessionToken
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not start chat.');
        localStorage.setItem(LIVE_CHAT_KEY, data.data.id);
        renderLiveChat(data.data);
        startLiveChatPolling();
        status.textContent = '';
    } catch (error) {
        status.textContent = error.message;
    }
}

async function loadLiveChat() {
    const chatId = localStorage.getItem(LIVE_CHAT_KEY);
    if (!chatId || !assetChatIsActive()) return;
    const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(chatId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not load chat.');
    renderLiveChat(data.data);
}

async function sendLiveChatMessage(event) {
    event.preventDefault();
    const chatId = localStorage.getItem(LIVE_CHAT_KEY);
    const status = document.getElementById('liveChatReplyStatus');
    if (!chatId || !assetChatIsActive()) {
        updateChatAccess();
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(chatId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: document.getElementById('liveChatMessage').value })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not send message.');
        document.getElementById('liveChatMessage').value = '';
        renderLiveChat(data.data);
        status.textContent = '';
    } catch (error) {
        status.textContent = error.message;
    }
}

function startLiveChatPolling() {
    stopLiveChatPolling();
    liveChatPoller = setInterval(() => loadLiveChat().catch(() => updateChatAccess()), 3000);
}

function stopLiveChatPolling() {
    if (liveChatPoller) clearInterval(liveChatPoller);
    liveChatPoller = null;
}
