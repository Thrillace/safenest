// Mobile Menu Toggle
        const mobileMenuBtn = document.getElementById('mobileMenuBtn');
        const mainNav = document.getElementById('mainNav');
        
        mobileMenuBtn.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            mobileMenuBtn.innerHTML = mainNav.classList.contains('active') ? 
                '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
        });
        
        // Smooth Scrolling for Anchor Links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                
                if (mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                    mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                }
                
                const targetId = this.getAttribute('href');
                if (!targetId || targetId === '#') {
                    return;
                }

                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - 80,
                        behavior: 'smooth'
                    });
                }
            });
        });
        
        // Tracking Tab Switching
        const trackingTabs = document.querySelectorAll('.tracking-tab');
        const assetTrackingForm = document.getElementById('assetTrackingForm');
        const packageTrackingForm = document.getElementById('packageTrackingForm');
        
        trackingTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                trackingTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (tab.dataset.tab === 'asset') {
                    assetTrackingForm.style.display = 'block';
                    packageTrackingForm.style.display = 'none';
                } else {
                    assetTrackingForm.style.display = 'none';
                    packageTrackingForm.style.display = 'block';
                }
            });
        });
        
        // Animation on Scroll
        const animateElements = document.querySelectorAll('.animate');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = 1;
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, {
            threshold: 0.1
        });
        
        animateElements.forEach(element => {
            element.style.opacity = 0;
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            observer.observe(element);
        });

        // Learn More Modal Functionality
        const learnMoreBtns = document.querySelectorAll('.learn-more-btn');
        const serviceModal = document.getElementById('serviceModal');
        const closeModal = document.getElementById('closeModal');
        const modalServiceTitle = document.getElementById('modalServiceTitle');
        const modalServiceContent = document.getElementById('modalServiceContent');

        // Service details data
        const serviceDetails = {
            'precious-metals': {
                title: 'Precious Metals Storage',
                content: `
                    <p>Our Precious Metals Storage service provides the highest level of security for your gold, silver, platinum, and other valuable metals. Each client's holdings are stored in individually allocated, segregated compartments within our Class III vault.</p>
                    
                    <div class="modal-features">
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-fingerprint"></i>
                            </div>
                            <div>
                                <h4>Biometric Access Control</h4>
                                <p>Three-factor authentication including fingerprint, retinal scan, and personal PIN code</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-temperature-low"></i>
                            </div>
                            <div>
                                <h4>Climate Controlled</h4>
                                <p>Maintained at optimal humidity and temperature to preserve metal quality</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <h4>Insurance Options</h4>
                                <p>Fully insured through Lloyd's of London with coverage up to €50 million per client</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-user-secret"></i>
                            </div>
                            <div>
                                <h4>Anonymous Storage</h4>
                                <p>Optional numbered account system for complete privacy</p>
                            </div>
                        </div>
                    </div>
                    
                    <p>Our vault is audited quarterly by independent security firms and all metals are assayed upon deposit. Clients can schedule private viewings of their holdings with 48 hours notice.</p>
                `
            },
            'art-collectibles': {
                title: 'Art & Collectibles Storage',
                content: `
                    <p>Our specialized Art & Collectibles storage provides museum-quality protection for your valuable artworks, antiques, and collectibles. Each storage unit is custom-configured to meet the specific requirements of your items.</p>
                    
                    <div class="modal-features">
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-palette"></i>
                            </div>
                            <div>
                                <h4>Climate Control</h4>
                                <p>Precision temperature (20°C ±1°) and humidity (50% ±5%) regulation</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-lightbulb"></i>
                            </div>
                            <div>
                                <h4>Lighting Protection</h4>
                                <p>UV-filtered lighting with motion-activated illumination</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-boxes"></i>
                            </div>
                            <div>
                                <h4>Custom Crating</h4>
                                <p>Acid-free archival materials and vibration-dampening mounts</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-camera"></i>
                            </div>
                            <div>
                                <h4>Condition Monitoring</h4>
                                <p>Monthly condition reports with high-resolution imaging</p>
                            </div>
                        </div>
                    </div>
                    
                    <p>We offer white-glove transportation services with armored vehicles and trained art handlers. Our facility includes private viewing rooms for clients and potential buyers, with discrete access arrangements available.</p>
                `
            },
            'digital-assets': {
                title: 'Digital Asset Security',
                content: `
                    <p>Our Digital Asset Security service provides military-grade protection for your cryptocurrencies, NFTs, and other digital valuables. We combine cutting-edge technology with physical security to create an impenetrable storage solution.</p>
                    
                    <div class="modal-features">
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-server"></i>
                            </div>
                            <div>
                                <h4>Air-Gapped Cold Storage</h4>
                                <p>Offline storage with no network connectivity at any time</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-lock"></i>
                            </div>
                            <div>
                                <h4>Multi-Signature Access</h4>
                                <p>Requires 3 of 5 authorized signatures for any transaction</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-shield-alt"></i>
                            </div>
                            <div>
                                <h4>Geographic Distribution</h4>
                                <p>Private keys split across multiple secure locations</p>
                            </div>
                        </div>
                        <div class="modal-feature-item">
                            <div class="modal-feature-icon">
                                <i class="fas fa-history"></i>
                            </div>
                            <div>
                                <h4>Transaction Monitoring</h4>
                                <p>24/7 blockchain monitoring with instant alerts</p>
                            </div>
                        </div>
                    </div>
                    
                    <p>All digital assets are stored in our underground data vault with electromagnetic pulse protection, biometric access controls, and 24/7 armed guards. We provide regular proof-of-reserve audits and can facilitate transactions through our secure signing rooms.</p>
                `
            }
        };

        // Open modal when Learn More is clicked
        learnMoreBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const serviceId = btn.getAttribute('data-service');
                const service = serviceDetails[serviceId];
                
                modalServiceTitle.textContent = service.title;
                modalServiceContent.innerHTML = service.content;
                
                serviceModal.style.display = 'block';
                document.body.style.overflow = 'hidden';
            });
        });

        // Close modal
        closeModal.addEventListener('click', () => {
            serviceModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === serviceModal) {
                serviceModal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });

        // API Base URL - Update this to your backend URL
        const API_BASE_URL = '/api';

        // Live Chat
        const liveChatBtn = document.getElementById('liveChatBtn');
        const LIVE_CHAT_KEY = 'safenestLiveChatId';
        let liveChatPoller = null;

        function ensureLiveChatPanel() {
            let panel = document.getElementById('liveChatPanel');
            if (panel) return panel;

            panel = document.createElement('div');
            panel.id = 'liveChatPanel';
            panel.className = 'live-chat-panel';
            panel.innerHTML = `
                <div class="live-chat-header">
                    <div>
                        <strong>SafeNest Live Chat</strong>
                        <span>Talk with an admin</span>
                    </div>
                    <button type="button" id="closeLiveChat" aria-label="Close live chat">&times;</button>
                </div>
                <div class="live-chat-thread" id="liveChatThread"></div>
                <form class="live-chat-start" id="liveChatStartForm">
                    <div class="form-group">
                        <label for="liveChatName">Name</label>
                        <input type="text" id="liveChatName" placeholder="Your name" required>
                    </div>
                    <div class="form-group">
                        <label for="liveChatEmail">Email</label>
                        <input type="email" id="liveChatEmail" placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label for="liveChatInitialMessage">Message</label>
                        <textarea id="liveChatInitialMessage" placeholder="How can we help?" required></textarea>
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
            status.textContent = 'Starting chat...';
            try {
                const response = await fetch(`${API_BASE_URL}/chat/start`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        customerName: document.getElementById('liveChatName').value,
                        customerEmail: document.getElementById('liveChatEmail').value,
                        message: document.getElementById('liveChatInitialMessage').value
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
            if (!chatId) return;
            const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(chatId)}`);
            const data = await response.json();
            if (!response.ok) return;
            renderLiveChat(data.data);
        }

        async function sendLiveChatMessage(event) {
            event.preventDefault();
            const chatId = localStorage.getItem(LIVE_CHAT_KEY);
            const status = document.getElementById('liveChatReplyStatus');
            if (!chatId) return;
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
            liveChatPoller = setInterval(() => loadLiveChat().catch(() => {}), 3000);
        }

        function stopLiveChatPolling() {
            if (liveChatPoller) clearInterval(liveChatPoller);
            liveChatPoller = null;
        }

        if (liveChatBtn) {
            liveChatBtn.addEventListener('click', () => {
                const panel = ensureLiveChatPanel();
                panel.classList.toggle('active');
                if (panel.classList.contains('active')) {
                    loadLiveChat().catch(() => {});
                    if (localStorage.getItem(LIVE_CHAT_KEY)) startLiveChatPolling();
                } else {
                    stopLiveChatPolling();
                }
            });
        }


        // Form Submission Handling with API Integration
        const trackingForm = document.getElementById('trackingForm');
        const packageForm = document.getElementById('packageForm');
        const contactForm = document.getElementById('contactForm');
        const assetTrackingStatus = document.getElementById('assetTrackingStatus');
        const packageTrackingStatus = document.getElementById('packageTrackingStatus');
        const contactStatus = document.getElementById('contactStatus');
        const assetSpinner = document.getElementById('assetSpinner');
        const packageSpinner = document.getElementById('packageSpinner');
        const contactSpinner = document.getElementById('contactSpinner');
        const ASSET_RESULT_KEY = 'safenestAssetTrackingResult';

        function clearTrackingForms({ clearMessages = false } = {}) {
            if (trackingForm) trackingForm.reset();
            if (packageForm) packageForm.reset();
            if (clearMessages) {
                if (assetTrackingStatus) {
                    assetTrackingStatus.className = 'form-status';
                    assetTrackingStatus.textContent = '';
                }
                if (packageTrackingStatus) {
                    packageTrackingStatus.className = 'form-status';
                    packageTrackingStatus.textContent = '';
                }
            }
        }

        window.addEventListener('pageshow', () => clearTrackingForms({ clearMessages: true }));
        window.addEventListener('pagehide', () => clearTrackingForms());
        document.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => clearTrackingForms());
        });


        // Asset Tracking Form
        if (trackingForm) {
            trackingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const trackingNumber = document.getElementById('trackingNumber').value;
                const clientId = document.getElementById('clientId').value;
                const accessCode = document.getElementById('accessCode').value;

                // Clear previous status
                assetTrackingStatus.className = 'form-status';
                assetTrackingStatus.textContent = '';
                assetSpinner.style.display = 'block';

                try {
                    const response = await fetch(`${API_BASE_URL}/assets/track`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            trackingNumber,
                            clientId,
                            accessCode
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        sessionStorage.setItem(ASSET_RESULT_KEY, JSON.stringify(data.data));
                        localStorage.removeItem('safenestLiveChatId');
                        clearTrackingForms();
                        window.location.href = 'asset-result.html';
                        return;
                    } else {
                        assetTrackingStatus.className = 'form-status error';
                        assetTrackingStatus.textContent = data.error || 'Asset not found or invalid credentials';
                    }
                } catch (err) {
                    assetTrackingStatus.className = 'form-status error';
                    assetTrackingStatus.textContent = 'Network error. Please try again later.';
                    console.error('Tracking error:', err);
                } finally {
                    assetSpinner.style.display = 'none';
                }
            });
        }
        

        function escapeHtml(value) {
            return String(value || '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
        }

        function renderPackageResult(order) {
            const itemName = order.itemName || 'Allocated Gold Bullion';
            const itemImage = order.itemImage || 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85';
            const estimatedDelivery = order.estimatedDelivery ? new Date(`${order.estimatedDelivery}T12:00:00`).toLocaleDateString() : 'Not set';
            return `
                <div class="tracking-result-card">
                    <img src="${escapeHtml(itemImage)}" alt="${escapeHtml(itemName)}" class="tracking-result-image">
                    <div class="tracking-result-details">
                        <strong>Package Found</strong>
                        <h3>${escapeHtml(itemName)}</h3>
                        <dl>
                            <div><dt>Status</dt><dd>${escapeHtml(order.status)}</dd></div>
                            <div><dt>Shipping Method</dt><dd>${escapeHtml(order.shippingMethod)}</dd></div>
                            <div><dt>Route</dt><dd>${escapeHtml(order.origin)} to ${escapeHtml(order.destination)}</dd></div>
                            <div><dt>Estimated Delivery</dt><dd>${estimatedDelivery}</dd></div>
                        </dl>
                    </div>
                </div>
            `;
        }

        // Package Tracking Form
        if (packageForm) {
            packageForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const packageNumber = document.getElementById('packageNumber').value;
                const savedOrders = JSON.parse(localStorage.getItem('safenestOrders') || '[]');
                const savedOrder = savedOrders.find(order => order.trackingCode.toLowerCase() === packageNumber.trim().toLowerCase());

                // Clear previous status
                packageTrackingStatus.className = 'form-status';
                packageTrackingStatus.textContent = '';
                packageSpinner.style.display = 'block';

                if (savedOrder) {
                    packageTrackingStatus.className = 'form-status success';
packageTrackingStatus.innerHTML = renderPackageResult(savedOrder);
                    packageForm.reset();
                    packageSpinner.style.display = 'none';
                    return;
                }

                try {
                    const response = await fetch(`${API_BASE_URL}/shipping/track`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            packageNumber
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        packageTrackingStatus.className = 'form-status success';
packageTrackingStatus.innerHTML = renderPackageResult(data.data);
                        packageForm.reset();
                    } else {
                        packageTrackingStatus.className = 'form-status error';
                        packageTrackingStatus.textContent = data.error || 'Package not found';
                    }
                } catch (err) {
                    packageTrackingStatus.className = 'form-status error';
                    packageTrackingStatus.textContent = 'Network error. Please try again later.';
                    console.error('Package tracking error:', err);
                } finally {
                    packageSpinner.style.display = 'none';
                }
            });
        }
        
        // Contact Form
        if (contactForm) {
            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const name = document.getElementById('name').value;
                const email = document.getElementById('email').value;
                const phone = document.getElementById('phone').value;
                const serviceInterest = document.getElementById('service').value;
                const message = document.getElementById('message').value;

                // Clear previous status
                contactStatus.className = 'form-status';
                contactStatus.textContent = '';
                contactSpinner.style.display = 'block';

                try {
                    const response = await fetch(`${API_BASE_URL}/contact`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            name,
                            email,
                            phone,
                            serviceInterest,
                            message
                        })
                    });

                    const data = await response.json();
                    
                    if (response.ok) {
                        contactStatus.className = 'form-status success';
                        if (data.emailSent === false) console.warn(data.emailMessage || 'Contact email delivery is not configured.');
                        contactStatus.textContent = 'Thank you for your message. Our team will contact you shortly.';
                        contactForm.reset();
                    } else {
                        contactStatus.className = 'form-status error';
                        contactStatus.textContent = data.error || 'There was an error submitting your message. Please try again.';
                    }
                } catch (err) {
                    contactStatus.className = 'form-status error';
                    contactStatus.textContent = 'Network error. Please try again later.';
                    console.error('Contact form error:', err);
                } finally {
                    contactSpinner.style.display = 'none';
                }
            });
        }
