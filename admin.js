const API_BASE_URL = '/api';
const DEFAULT_PACKAGE_IMAGE = 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85';
const DEFAULT_ASSET_IMAGE = DEFAULT_PACKAGE_IMAGE;

function setText(element, value) {
    if (element) element.textContent = value;
}

const elements = {
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    mainNav: document.getElementById('mainNav'),
    adminLogin: document.getElementById('adminLogin'),
    adminUnlocked: document.getElementById('adminUnlocked'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminUsername: document.getElementById('adminUsername'),
    adminPasscode: document.getElementById('adminPasscode'),
    loginStatus: document.getElementById('loginStatus'),
    lockAdminBtn: document.getElementById('lockAdminBtn'),
    openPasswordForm: document.getElementById('openPasswordForm'),
    closePasswordForm: document.getElementById('closePasswordForm'),
    passwordModal: document.getElementById('passwordModal'),
    passwordForm: document.getElementById('passwordForm'),
    currentUsername: document.getElementById('currentUsername'),
    currentPassword: document.getElementById('currentPassword'),
    newPassword: document.getElementById('newPassword'),
    passwordStatus: document.getElementById('passwordStatus'),
    orderForm: document.getElementById('orderForm'),
    orderFormTitle: document.getElementById('orderFormTitle'),
    ordersTableBody: document.getElementById('ordersTableBody'),
    orderSearch: document.getElementById('orderSearch'),
    statusFilter: document.getElementById('statusFilter'),
    seedOrdersBtn: document.getElementById('seedOrdersBtn'),
    resetOrderBtn: document.getElementById('resetOrderBtn'),
    orderStatusMessage: document.getElementById('orderStatusMessage'),
    totalOrders: document.getElementById('totalOrders'),
    inTransitOrders: document.getElementById('inTransitOrders'),
    deliveredOrders: document.getElementById('deliveredOrders'),
    priorityOrders: document.getElementById('priorityOrders'),
    totalAssets: document.getElementById('totalAssets'),
    totalContacts: document.getElementById('totalContacts'),
    refreshContactsBtn: document.getElementById('refreshContactsBtn'),
    deleteSelectedContactsBtn: document.getElementById('deleteSelectedContactsBtn'),
    adminContactList: document.getElementById('adminContactList'),
    seedAssetsBtn: document.getElementById('seedAssetsBtn'),
    assetSearch: document.getElementById('assetSearch'),
    assetStatusFilter: document.getElementById('assetStatusFilter'),
    assetsTableBody: document.getElementById('assetsTableBody'),
    assetForm: document.getElementById('assetForm'),
    assetFormTitle: document.getElementById('assetFormTitle'),
    resetAssetBtn: document.getElementById('resetAssetBtn'),
    assetStatusMessage: document.getElementById('assetStatusMessage'),
    unreadChats: document.getElementById('unreadChats'),
    refreshChatsBtn: document.getElementById('refreshChatsBtn'),
    adminChatList: document.getElementById('adminChatList'),
    activeChatTitle: document.getElementById('activeChatTitle'),
    activeChatMeta: document.getElementById('activeChatMeta'),
    adminChatThread: document.getElementById('adminChatThread'),
    adminChatForm: document.getElementById('adminChatForm'),
    adminChatReply: document.getElementById('adminChatReply'),
    adminChatStatus: document.getElementById('adminChatStatus')
};

let assets = [];
let chats = [];
let contacts = [];
let activeChatId = '';
let chatPoller = null;
let orders = [];
let unlocked = false;

async function api(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
}

function setUnlocked(nextUnlocked) {
    unlocked = nextUnlocked;
    document.body.classList.toggle('admin-locked', !unlocked);
    if (elements.adminLogin) elements.adminLogin.hidden = unlocked;
    if (elements.adminUnlocked) elements.adminUnlocked.hidden = !unlocked;
    document.querySelectorAll('.admin-private').forEach(element => { element.hidden = !unlocked; });
    elements.orderForm?.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = !unlocked; });
    elements.assetForm?.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = !unlocked; });
    document.querySelectorAll('[data-action]').forEach(button => { button.disabled = !unlocked; });
    if (elements.seedOrdersBtn) elements.seedOrdersBtn.disabled = !unlocked;
    if (elements.seedAssetsBtn) elements.seedAssetsBtn.disabled = !unlocked;
    if (elements.refreshChatsBtn) elements.refreshChatsBtn.disabled = !unlocked;
    if (elements.refreshContactsBtn) elements.refreshContactsBtn.disabled = !unlocked;
    if (elements.deleteSelectedContactsBtn) elements.deleteSelectedContactsBtn.disabled = !unlocked;
    if (elements.adminChatReply) elements.adminChatReply.disabled = !unlocked || !activeChatId;
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatDate(dateString) {
    if (!dateString) return 'Not set';
    return new Date(`${dateString}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getStatusClass(status) { return status.toLowerCase().replace(/\s+/g, '-'); }

function renderStats() {
    setText(elements.totalOrders, orders.length);
    setText(elements.inTransitOrders, orders.filter(order => order.status === 'In Transit').length);
    setText(elements.deliveredOrders, orders.filter(order => order.status === 'Delivered').length);
    setText(elements.priorityOrders, orders.filter(order => ['High', 'Critical'].includes(order.priority)).length);
    setText(elements.totalAssets, assets.length);
    setText(elements.totalContacts, contacts.length);
    setText(elements.unreadChats, chats.filter(chat => (chat.messages || []).some(message => message.from === 'customer' && !message.readByAdmin)).length);
}

function renderOrders() {
    if (!elements.ordersTableBody) {
        renderStats();
        return;
    }
    const searchTerm = (elements.orderSearch?.value || '').trim().toLowerCase();
    const status = elements.statusFilter?.value || 'all';
    const filtered = orders.filter(order => {
        const matchesStatus = status === 'all' || order.status === status;
        const haystack = `${order.trackingCode} ${order.clientName} ${order.destination} ${order.shippingMethod} ${order.itemName || ''}`.toLowerCase();
        return matchesStatus && haystack.includes(searchTerm);
    });

    renderStats();
    if (!filtered.length) {
        elements.ordersTableBody.innerHTML = '<tr><td colspan="7" class="admin-empty">No orders found. Create an order or load sample orders.</td></tr>';
        setUnlocked(unlocked);
        return;
    }

    elements.ordersTableBody.innerHTML = filtered.map(order => `
        <tr>
            <td><strong>${escapeHtml(order.trackingCode)}</strong><span>${escapeHtml(order.shippingMethod)}</span></td>
            <td><strong>${escapeHtml(order.clientName)}</strong><span>${escapeHtml(order.clientEmail) || 'No email'}</span></td>
            <td><div class="admin-package-cell"><img src="${escapeHtml(order.itemImage || DEFAULT_PACKAGE_IMAGE)}" alt="${escapeHtml(order.itemName || 'Package image')}"><span>${escapeHtml(order.itemName || 'Allocated Gold Bullion')}</span></div></td>
            <td><strong>${escapeHtml(order.origin)}</strong><span>to ${escapeHtml(order.destination)}</span></td>
            <td><span class="status-pill ${getStatusClass(order.status)}">${escapeHtml(order.status)}</span></td>
            <td>${formatDate(order.estimatedDelivery)}</td>
            <td class="admin-actions"><button type="button" title="Edit order" data-action="edit" data-id="${order.id}"><i class="fas fa-pen"></i></button><button type="button" title="Delete order" data-action="delete" data-id="${order.id}"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');
    setUnlocked(unlocked);
}

function formatChatTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderChatList() {
    renderStats();
    if (!elements.adminChatList) return;
    if (!chats.length) {
        elements.adminChatList.innerHTML = '<div class="admin-empty">No live chat conversations yet.</div>';
        return;
    }

    elements.adminChatList.innerHTML = chats.map(chat => {
        const lastMessage = (chat.messages || []).at(-1);
        const unread = (chat.messages || []).some(message => message.from === 'customer' && !message.readByAdmin);
        return `
            <button type="button" class="admin-chat-item ${chat.id === activeChatId ? 'active' : ''} ${unread ? 'unread' : ''}" data-chat-id="${chat.id}">
                <strong>${escapeHtml(chat.customerName)}</strong>
                <span>${escapeHtml(lastMessage?.text || 'New chat')}</span>
                <small>${formatChatTime(chat.updatedAt)}</small>
            </button>
        `;
    }).join('');
}

function renderActiveChat(chat) {
    if (!elements.activeChatTitle || !elements.adminChatThread || !elements.adminChatReply) return;
    if (!chat) {
        elements.activeChatTitle.textContent = 'Select a Chat';
        elements.activeChatMeta.textContent = 'Choose a customer conversation to reply.';
        elements.adminChatThread.innerHTML = '<div class="admin-empty">No conversation selected.</div>';
        elements.adminChatReply.disabled = true;
        return;
    }

    elements.activeChatTitle.textContent = chat.customerName;
    elements.activeChatMeta.textContent = `${chat.customerEmail || 'No email provided'} · ${chat.status}`;
    elements.adminChatThread.innerHTML = (chat.messages || []).map(message => `
        <div class="chat-message ${message.from === 'admin' ? 'from-admin' : 'from-customer'}">
            <span>${message.from === 'admin' ? 'Admin' : escapeHtml(chat.customerName)}</span>
            <p>${escapeHtml(message.text)}</p>
            <small>${formatChatTime(message.createdAt)}</small>
        </div>
    `).join('');
    elements.adminChatThread.scrollTop = elements.adminChatThread.scrollHeight;
    elements.adminChatReply.disabled = !unlocked;
}

async function loadChats({ keepSelection = true } = {}) {
    if (!unlocked) {
        chats = [];
        activeChatId = '';
        renderChatList();
        renderActiveChat(null);
        return;
    }

    const result = await api('/admin/chats');
    chats = result.data || [];
    if (!keepSelection || !chats.some(chat => chat.id === activeChatId)) {
        activeChatId = chats[0]?.id || '';
    }
    renderChatList();
    renderActiveChat(chats.find(chat => chat.id === activeChatId));
}

function startChatPolling() {
    stopChatPolling();
    chatPoller = setInterval(() => {
        if (unlocked) loadChats().catch(() => {});
    }, 4000);
}

function stopChatPolling() {
    if (chatPoller) clearInterval(chatPoller);
    chatPoller = null;
}

async function loadOrders() {
    if (!unlocked) {
        orders = [];
        assets = [];
        contacts = [];
        renderOrders();
        renderAssets();
        renderContacts();
        renderChatList();
        renderActiveChat(null);
        return;
    }
    const result = await api('/admin/orders');
    orders = result.data || [];
    renderOrders();
}

function formatContactService(value) {
    const labels = {
        metals: 'Precious Metals Storage',
        art: 'Art & Collectibles',
        digital: 'Digital Assets',
        shipping: 'Shipping Services',
        other: 'Other Inquiry'
    };
    return labels[value] || value || 'Not provided';
}

function buildReplySubject() {
    return 'SafeNest inquiry reply';
}

function buildReplyBody(contact) {
    return `Hello ${contact.name || ''},\n\n\n\n--- Original message ---\n${contact.message || ''}`;
}

function renderContacts() {
    renderStats();
    if (!elements.adminContactList) return;
    if (!contacts.length) {
        elements.adminContactList.innerHTML = '<div class="admin-empty">No contact form messages yet.</div>';
        return;
    }

    elements.adminContactList.innerHTML = contacts.map(contact => `
        <article class="admin-contact-card">
            <div class="admin-contact-card-header">
                <div class="admin-contact-select">
                    <input type="checkbox" class="contact-select-checkbox" value="${escapeHtml(contact.id)}" aria-label="Select message from ${escapeHtml(contact.name)}">
                    <div>
                        <strong>${escapeHtml(contact.name)}</strong>
                        <span>${formatChatTime(contact.createdAt)}</span>
                    </div>
                </div>
                <div class="admin-reply-links">
                    <a href="mailto:${encodeURIComponent(contact.email)}?subject=${encodeURIComponent(buildReplySubject())}&body=${encodeURIComponent(buildReplyBody(contact))}" target="_blank" rel="noopener">Mail App</a>
                    <a href="https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(contact.email)}&subject=${encodeURIComponent(buildReplySubject())}&body=${encodeURIComponent(buildReplyBody(contact))}" target="_blank" rel="noopener">Outlook</a>
                    <a href="https://www.mail.com/mail/" target="_blank" rel="noopener" data-mailcom-reply data-reply-to="${escapeHtml(contact.email)}" data-reply-subject="${escapeHtml(buildReplySubject())}" data-reply-body="${escapeHtml(buildReplyBody(contact))}">mail.com</a>
                </div>
            </div>
            <dl>
                <div><dt>Email</dt><dd><a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></dd></div>
                <div><dt>Phone</dt><dd>${escapeHtml(contact.phone || 'Not provided')}</dd></div>
                <div><dt>Service</dt><dd>${escapeHtml(formatContactService(contact.serviceInterest))}</dd></div>
            </dl>
            <p>${escapeHtml(contact.message)}</p>
        </article>
    `).join('');
}

async function loadContacts() {
    if (!unlocked) {
        contacts = [];
        renderContacts();
        return;
    }
    const result = await api('/admin/contacts');
    contacts = result.data || [];
    renderContacts();
}

function documentsToText(documents) {
    return (documents || []).map(doc => `${doc.name || ''} | ${doc.status || 'Saved'} | ${doc.reference || ''}`.trim()).join('\n');
}

function renderAssets() {
    if (!elements.assetsTableBody) {
        renderStats();
        return;
    }
    const searchTerm = (elements.assetSearch?.value || '').trim().toLowerCase();
    const status = elements.assetStatusFilter?.value || 'all';
    const filtered = assets.filter(asset => {
        const matchesStatus = status === 'all' || asset.status === status;
        const haystack = `${asset.trackingNumber} ${asset.clientId} ${asset.clientName} ${asset.assetName} ${asset.assetCategory}`.toLowerCase();
        return matchesStatus && haystack.includes(searchTerm);
    });

    renderStats();
    if (!filtered.length) {
        elements.assetsTableBody.innerHTML = '<tr><td colspan="6" class="admin-empty">No assets found. Create an asset record or load sample assets.</td></tr>';
        setUnlocked(unlocked);
        return;
    }

    elements.assetsTableBody.innerHTML = filtered.map(asset => `
        <tr>
            <td><strong>${escapeHtml(asset.trackingNumber)}</strong><span>${escapeHtml(asset.clientId)} / ${escapeHtml(asset.accessCode)}</span></td>
            <td><strong>${escapeHtml(asset.clientName)}</strong><span>${escapeHtml(asset.clientEmail) || 'No email'}</span></td>
            <td><div class="admin-package-cell"><img src="${escapeHtml(asset.imageUrl || DEFAULT_ASSET_IMAGE)}" alt="${escapeHtml(asset.assetName)}"><span>${escapeHtml(asset.assetName)}<br>${escapeHtml(asset.quantity || asset.assetCategory)}</span></div></td>
            <td><span class="status-pill secured-in-vault">${escapeHtml(asset.status)}</span><span>${escapeHtml(asset.storageLocation)}</span></td>
            <td><strong>${(asset.documents || []).length}</strong><span>${escapeHtml((asset.documents || [])[0]?.name || 'No documents')}</span></td>
            <td class="admin-actions"><button type="button" title="Edit asset" data-asset-action="edit" data-id="${asset.id}"><i class="fas fa-pen"></i></button><button type="button" title="Delete asset" data-asset-action="delete" data-id="${asset.id}"><i class="fas fa-trash"></i></button></td>
        </tr>`).join('');
    setUnlocked(unlocked);
}

async function loadAssets() {
    if (!unlocked) {
        assets = [];
        renderAssets();
        return;
    }
    const result = await api('/admin/assets');
    assets = result.data || [];
    renderAssets();
}

function resetAssetForm() {
    if (!elements.assetForm) return;
    elements.assetForm.reset();
    document.getElementById('assetId').value = '';
    document.getElementById('assetImageUrl').value = DEFAULT_ASSET_IMAGE;
    elements.assetFormTitle.textContent = 'Create Asset Record';
    elements.assetStatusMessage.textContent = '';
    elements.assetStatusMessage.className = 'admin-alert';
}

function readAssetForm() {
    return {
        trackingNumber: document.getElementById('assetTrackingNumber').value.trim(),
        clientId: document.getElementById('assetClientId').value.trim(),
        accessCode: document.getElementById('assetAccessCode').value.trim(),
        clientName: document.getElementById('assetClientName').value.trim(),
        clientEmail: document.getElementById('assetClientEmail').value.trim(),
        assetName: document.getElementById('assetName').value.trim(),
        assetCategory: document.getElementById('assetCategory').value.trim(),
        quantity: document.getElementById('assetQuantity').value.trim(),
        declaredValue: document.getElementById('assetValue').value.trim(),
        status: document.getElementById('assetStatus').value,
        storageLocation: document.getElementById('assetLocation').value.trim(),
        insurancePolicy: document.getElementById('assetInsurance').value.trim(),
        intakeDate: document.getElementById('assetIntakeDate').value,
        lastAuditDate: document.getElementById('assetAuditDate').value,
        imageUrl: document.getElementById('assetImageUrl').value.trim() || DEFAULT_ASSET_IMAGE,
        description: document.getElementById('assetDescription').value.trim(),
        documents: document.getElementById('assetDocuments').value,
        notes: document.getElementById('assetNotes').value.trim()
    };
}

function fillAssetForm(asset) {
    document.getElementById('assetId').value = asset.id;
    document.getElementById('assetTrackingNumber').value = asset.trackingNumber;
    document.getElementById('assetClientId').value = asset.clientId;
    document.getElementById('assetAccessCode').value = asset.accessCode;
    document.getElementById('assetClientName').value = asset.clientName;
    document.getElementById('assetClientEmail').value = asset.clientEmail;
    document.getElementById('assetName').value = asset.assetName;
    document.getElementById('assetCategory').value = asset.assetCategory;
    document.getElementById('assetQuantity').value = asset.quantity;
    document.getElementById('assetValue').value = asset.declaredValue;
    document.getElementById('assetStatus').value = asset.status;
    document.getElementById('assetLocation').value = asset.storageLocation;
    document.getElementById('assetInsurance').value = asset.insurancePolicy;
    document.getElementById('assetIntakeDate').value = asset.intakeDate;
    document.getElementById('assetAuditDate').value = asset.lastAuditDate;
    document.getElementById('assetImageUrl').value = asset.imageUrl || DEFAULT_ASSET_IMAGE;
    document.getElementById('assetDescription').value = asset.description;
    document.getElementById('assetDocuments').value = documentsToText(asset.documents);
    document.getElementById('assetNotes').value = asset.notes;
    elements.assetFormTitle.textContent = `Edit ${asset.trackingNumber}`;
    window.scrollTo({ top: elements.assetForm.offsetTop - 110, behavior: 'smooth' });
}

function resetForm() {
    if (!elements.orderForm) return;
    elements.orderForm.reset();
    document.getElementById('orderId').value = '';
    document.getElementById('itemImage').value = DEFAULT_PACKAGE_IMAGE;
    elements.orderFormTitle.textContent = 'Create Order';
    elements.orderStatusMessage.textContent = '';
    elements.orderStatusMessage.className = 'admin-alert';
}

function showMessage(element, message, type = 'success') {
    if (!element) return;
    element.textContent = message;
    element.className = `admin-alert ${type}`;
}

function readFormOrder() {
    return {
        trackingCode: document.getElementById('trackingCode').value.trim(),
        clientName: document.getElementById('clientName').value.trim(),
        clientEmail: document.getElementById('clientEmail').value.trim(),
        itemName: document.getElementById('itemName').value.trim(),
        itemImage: document.getElementById('itemImage').value.trim() || DEFAULT_PACKAGE_IMAGE,
        shippingMethod: document.getElementById('shippingMethod').value,
        origin: document.getElementById('origin').value.trim(),
        destination: document.getElementById('destination').value.trim(),
        status: document.getElementById('orderStatus').value,
        estimatedDelivery: document.getElementById('estimatedDelivery').value,
        priority: document.getElementById('priority').value,
        notes: document.getElementById('orderNotes').value.trim()
    };
}

function fillOrderForm(order) {
    document.getElementById('orderId').value = order.id;
    document.getElementById('trackingCode').value = order.trackingCode;
    document.getElementById('clientName').value = order.clientName;
    document.getElementById('clientEmail').value = order.clientEmail;
    document.getElementById('itemName').value = order.itemName || 'Allocated Gold Bullion';
    document.getElementById('itemImage').value = order.itemImage || DEFAULT_PACKAGE_IMAGE;
    document.getElementById('shippingMethod').value = order.shippingMethod;
    document.getElementById('origin').value = order.origin;
    document.getElementById('destination').value = order.destination;
    document.getElementById('orderStatus').value = order.status;
    document.getElementById('estimatedDelivery').value = order.estimatedDelivery;
    document.getElementById('priority').value = order.priority;
    document.getElementById('orderNotes').value = order.notes;
    elements.orderFormTitle.textContent = `Edit ${order.trackingCode}`;
    window.scrollTo({ top: elements.orderForm.offsetTop - 110, behavior: 'smooth' });
}

if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener('click', () => {
        elements.mainNav.classList.toggle('active');
        elements.mobileMenuBtn.innerHTML = elements.mainNav.classList.contains('active') ? '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
}

elements.adminLoginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
        await api('/admin/login', { method: 'POST', body: JSON.stringify({ username: elements.adminUsername.value, password: elements.adminPasscode.value }) });
        elements.adminPasscode.value = '';
        elements.loginStatus.className = 'admin-alert';
        setUnlocked(true);
        resetForm();
        resetAssetForm();
        await loadOrders();
        await loadAssets();
        await loadContacts();
        await loadChats({ keepSelection: false });
        startChatPolling();
    } catch (error) {
        showMessage(elements.loginStatus, error.message, 'error');
    }
});

elements.lockAdminBtn?.addEventListener('click', async () => {
    await api('/admin/logout', { method: 'POST', body: '{}' }).catch(() => {});
    setUnlocked(false);
    orders = [];
    assets = [];
    chats = [];
    contacts = [];
    activeChatId = '';
    stopChatPolling();
    resetForm();
    resetAssetForm();
    renderOrders();
    renderAssets();
    renderContacts();
    renderChatList();
    renderActiveChat(null);
});

elements.openPasswordForm?.addEventListener('click', () => {
    elements.passwordModal.hidden = false;
    elements.currentUsername.focus();
});

elements.closePasswordForm?.addEventListener('click', () => {
    elements.passwordModal.hidden = true;
    elements.passwordForm.reset();
    elements.passwordStatus.className = 'admin-alert';
    elements.passwordStatus.textContent = '';
});

elements.passwordModal?.addEventListener('click', event => {
    if (event.target === elements.passwordModal) elements.closePasswordForm.click();
});

elements.passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
        await api('/admin/password', {
            method: 'POST',
            body: JSON.stringify({ currentUsername: elements.currentUsername.value, currentPassword: elements.currentPassword.value, newPassword: elements.newPassword.value })
        });
        elements.passwordForm.reset();
        showMessage(elements.passwordStatus, 'Password changed. Please log in again.');
        setUnlocked(false);
        orders = [];
        chats = [];
        contacts = [];
        stopChatPolling();
        renderOrders();
        renderContacts();
        renderChatList();
    } catch (error) {
        showMessage(elements.passwordStatus, error.message, 'error');
    }
});

elements.refreshContactsBtn?.addEventListener('click', () => {
    if (!unlocked) return;
    loadContacts().catch(error => alert(error.message));
});

elements.deleteSelectedContactsBtn?.addEventListener('click', async () => {
    if (!unlocked) return;
    const selectedIds = Array.from(document.querySelectorAll('.contact-select-checkbox:checked')).map(input => input.value);
    if (!selectedIds.length) {
        alert('Select at least one message to delete.');
        return;
    }
    if (!confirm(`Delete ${selectedIds.length} selected message${selectedIds.length === 1 ? '' : 's'}?`)) return;
    try {
        for (const id of selectedIds) {
            await api(`/admin/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
        }
        contacts = contacts.filter(contact => !selectedIds.includes(contact.id));
        renderContacts();
    } catch (error) {
        alert(error.message);
    }
});

elements.adminContactList?.addEventListener('click', async event => {
    const link = event.target.closest('[data-mailcom-reply]');
    if (!link) return;
    event.preventDefault();

    const replyText = [
        `To: ${link.dataset.replyTo || ''}`,
        `Subject: ${link.dataset.replySubject || ''}`,
        '',
        link.dataset.replyBody || ''
    ].join('\n');

    try {
        await navigator.clipboard.writeText(replyText);
        alert('Reply details copied. mail.com will open now; click Compose Email and paste.');
    } catch (error) {
        alert(replyText);
    }

    window.open(link.href, '_blank', 'noopener');
});

elements.orderForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!unlocked) return;
    const orderId = document.getElementById('orderId').value;
    try {
        if (orderId) {
            await api(`/admin/orders/${encodeURIComponent(orderId)}`, { method: 'PUT', body: JSON.stringify(readFormOrder()) });
            showMessage(elements.orderStatusMessage, 'Order updated.');
        } else {
            await api('/admin/orders', { method: 'POST', body: JSON.stringify(readFormOrder()) });
            showMessage(elements.orderStatusMessage, 'Order created.');
        }
        resetForm();
        await loadOrders();
    } catch (error) {
        showMessage(elements.orderStatusMessage, error.message, 'error');
    }
});

elements.ordersTableBody?.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || !unlocked) return;
    const order = orders.find(item => item.id === button.dataset.id);
    if (!order) return;
    if (button.dataset.action === 'edit') fillOrderForm(order);
    if (button.dataset.action === 'delete' && confirm(`Delete order ${order.trackingCode}?`)) {
        await api(`/admin/orders/${encodeURIComponent(order.id)}`, { method: 'DELETE' });
        resetForm();
        await loadOrders();
    }
});

elements.seedOrdersBtn?.addEventListener('click', async () => {
    if (!unlocked) return;
    const originalText = elements.seedOrdersBtn.textContent;
    elements.seedOrdersBtn.disabled = true;
    elements.seedOrdersBtn.textContent = 'Loading Samples...';

    try {
        const result = await api('/admin/orders/seed', { method: 'POST', body: '{}' });
        orders = result.data || [];
        renderOrders();
        const message = result.addedCount > 0
            ? `${result.addedCount} sample orders loaded.`
            : `All ${result.totalSamples || orders.length} sample orders are already loaded.`;
        showMessage(elements.orderStatusMessage, message);
    } catch (error) {
        showMessage(elements.orderStatusMessage, error.message, 'error');
    } finally {
        elements.seedOrdersBtn.textContent = originalText;
        elements.seedOrdersBtn.disabled = !unlocked;
    }
});

elements.refreshChatsBtn?.addEventListener('click', () => {
    if (!unlocked) return;
    loadChats().catch(error => showMessage(elements.adminChatStatus, error.message, 'error'));
});

elements.adminChatList?.addEventListener('click', async event => {
    const button = event.target.closest('[data-chat-id]');
    if (!button || !unlocked) return;
    activeChatId = button.dataset.chatId;
    try {
        const result = await api(`/admin/chats/${encodeURIComponent(activeChatId)}`);
        chats = chats.map(chat => chat.id === activeChatId ? result.data : chat);
        renderChatList();
        renderActiveChat(result.data);
    } catch (error) {
        showMessage(elements.adminChatStatus, error.message, 'error');
    }
});

elements.adminChatForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!unlocked || !activeChatId) return;
    try {
        const result = await api(`/admin/chats/${encodeURIComponent(activeChatId)}`, {
            method: 'POST',
            body: JSON.stringify({ message: elements.adminChatReply.value })
        });
        elements.adminChatReply.value = '';
        chats = chats.map(chat => chat.id === activeChatId ? result.data : chat);
        renderChatList();
        renderActiveChat(result.data);
        showMessage(elements.adminChatStatus, 'Reply sent.');
    } catch (error) {
        showMessage(elements.adminChatStatus, error.message, 'error');
    }
});

elements.assetForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!unlocked) return;
    const assetId = document.getElementById('assetId').value;
    try {
        if (assetId) {
            await api(`/admin/assets/${encodeURIComponent(assetId)}`, { method: 'PUT', body: JSON.stringify(readAssetForm()) });
            showMessage(elements.assetStatusMessage, 'Asset record updated.');
        } else {
            await api('/admin/assets', { method: 'POST', body: JSON.stringify(readAssetForm()) });
            showMessage(elements.assetStatusMessage, 'Asset record created.');
        }
        resetAssetForm();
        await loadAssets();
    } catch (error) {
        showMessage(elements.assetStatusMessage, error.message, 'error');
    }
});

elements.assetsTableBody?.addEventListener('click', async event => {
    const button = event.target.closest('[data-asset-action]');
    if (!button || !unlocked) return;
    const asset = assets.find(item => item.id === button.dataset.id);
    if (!asset) return;
    if (button.dataset.assetAction === 'edit') fillAssetForm(asset);
    if (button.dataset.assetAction === 'delete' && confirm(`Delete asset ${asset.trackingNumber}?`)) {
        await api(`/admin/assets/${encodeURIComponent(asset.id)}`, { method: 'DELETE' });
        resetAssetForm();
        await loadAssets();
    }
});

elements.seedAssetsBtn?.addEventListener('click', async () => {
    if (!unlocked) return;
    const originalText = elements.seedAssetsBtn.textContent;
    elements.seedAssetsBtn.disabled = true;
    elements.seedAssetsBtn.textContent = 'Loading Assets...';

    try {
        const result = await api('/admin/assets/seed', { method: 'POST', body: '{}' });
        assets = result.data || [];
        renderAssets();
        const message = result.addedCount > 0
            ? `${result.addedCount} sample assets loaded.`
            : `All ${result.totalSamples || assets.length} sample assets are already loaded.`;
        showMessage(elements.assetStatusMessage, message);
    } catch (error) {
        showMessage(elements.assetStatusMessage, error.message, 'error');
    } finally {
        elements.seedAssetsBtn.textContent = originalText;
        elements.seedAssetsBtn.disabled = !unlocked;
    }
});

elements.resetOrderBtn?.addEventListener('click', resetForm);
elements.resetAssetBtn?.addEventListener('click', resetAssetForm);
elements.orderSearch?.addEventListener('input', renderOrders);
elements.statusFilter?.addEventListener('change', renderOrders);
elements.assetSearch?.addEventListener('input', renderAssets);
elements.assetStatusFilter?.addEventListener('change', renderAssets);

(async function init() {
    try {
        const session = await api('/admin/session');
        setUnlocked(Boolean(session.authenticated));
        resetForm();
        resetAssetForm();
        await loadOrders();
        await loadAssets();
        await loadContacts();
        await loadChats({ keepSelection: false });
        if (unlocked) startChatPolling();
    } catch (error) {
        setUnlocked(false);
        renderOrders();
        renderAssets();
        renderContacts();
        renderChatList();
        renderActiveChat(null);
    }
})();
