/* ===============================
   SPIRIT CLICKER - ПОЛНАЯ ВЕРСИЯ
   ВСЁ В ОДНОМ ФАЙЛЕ
   ============================== */

'use strict';

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: 'https://ryoho.onrender.com',
    CLICK_BATCH_INTERVAL: 1000,
    ENERGY_RECHARGE_INTERVAL: 2000,
    PASSIVE_INCOME_INTERVAL: 3600000,
    CACHE_TTL: 30000
};

// ==================== TELEGRAM INIT ====================
const tg = window.Telegram?.WebApp;
let userId = null;
let username = null;
let referrerId = null;

if (tg) {
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    if (tg.initDataUnsafe?.user) {
        userId = tg.initDataUnsafe.user.id;
        username = tg.initDataUnsafe.user.username || `user_${userId}`;
    }
    
    const startParam = tg.initDataUnsafe?.start_param || '';
    if (startParam?.startsWith('ref_')) {
        referrerId = parseInt(startParam.replace('ref_', '')) || null;
    }
}

// ==================== СОСТОЯНИЕ (ОДНО!) ====================
const State = {
    user: { id: userId, username, referrerId },
    
    game: {
        coins: 0,
        energy: 500,
        maxEnergy: 500,
        profitPerTap: 1,
        profitPerHour: 100,
        level: 0,
        prices: { multitap: 50, profit: 40, energy: 30 },
        levels: { multitap: 0, profit: 0, energy: 0 }
    },
    
    skins: {
        owned: ['default_SP'],
        selected: 'default_SP',
        adsWatched: 0,
        friendsInvited: 0,
        data: []
    },
    
    settings: {
        theme: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).theme || 'day' : 'day',
        sound: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).sound !== undefined ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).sound : true : true,
        vibration: localStorage.getItem('ryohoSettings') ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).vibration !== undefined ? 
            JSON.parse(localStorage.getItem('ryohoSettings')).vibration : true : true
    },
    
    temp: {
        clickBuffer: 0,
        gainBuffer: 0,
        batchTimer: null,
        recoveryTimer: null,
        lastClick: 0
    },
    
    cache: new Map()
};

// Глобальный доступ
window.State = State;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
const formatNumber = (num) => {
    num = Math.floor(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

const showToast = (msg, isError = false) => {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? 'rgba(244,67,54,0.9)' : 'rgba(76,175,80,0.9)'};
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 10001;
        animation: toastFade 2s forwards;
        border: 1px solid #7F49B4;
        backdrop-filter: blur(5px);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

// ==================== API ====================
const API = {
    async request(endpoint, options = {}, retries = 2) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        try {
            const res = await fetch(CONFIG.API_URL + endpoint, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            clearTimeout(timeout);
            if (retries > 0 && (err.name === 'AbortError' || err.status >= 500)) {
                await new Promise(r => setTimeout(r, 1000));
                return this.request(endpoint, options, retries - 1);
            }
            throw err;
        }
    },
    get(endpoint) { return this.request(endpoint); },
    post(endpoint, data) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(data) }); }
};

// ==================== ЗАГРУЗКА ДАННЫХ ====================
async function loadUserData() {
    if (!userId) return;
    
    try {
        await API.post('/api/register', {
            user_id: userId,
            username,
            referrer_id: referrerId
        });
        
        const data = await API.get(`/api/user/${userId}`);
        
        State.game.coins = data.coins || 0;
        State.game.energy = data.energy || 500;
        State.game.maxEnergy = data.max_energy || 500;
        State.game.profitPerTap = data.profit_per_tap || 1;
        State.game.profitPerHour = data.profit_per_hour || 100;
        State.game.levels.multitap = data.multitap_level || 0;
        State.game.levels.profit = data.profit_level || 0;
        State.game.levels.energy = data.energy_level || 0;
        
        State.skins.owned = data.owned_skins || ['default_SP'];
        State.skins.selected = data.selected_skin || 'default_SP';
        State.skins.adsWatched = data.ads_watched || 0;
        
        await loadPrices();
        await loadSkinsList();
        await loadReferralData();
        
        applySavedSkin();
        updateUI();
        
    } catch (err) {
        console.error('Failed to load user data:', err);
    }
}

async function loadPrices() {
    if (!userId) return;
    try {
        const prices = await API.get(`/api/upgrade-prices/${userId}`);
        State.game.prices = { ...State.game.prices, ...prices };
    } catch (err) {
        console.error('Failed to load prices:', err);
    }
}

async function loadSkinsList() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/skins/list`);
        if (res.ok) {
            const data = await res.json();
            State.skins.data = data.skins || [];
        }
    } catch (err) {
        console.error('Failed to load skins:', err);
    }
}

// ==================== UI ОБНОВЛЕНИЕ ====================
let pendingUI = false;

function updateUI() {
    if (pendingUI) return;
    pendingUI = true;
    
    requestAnimationFrame(() => {
        // Баланс
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = formatNumber(State.game.coins);

        // Доход в час
        const hourEl = document.getElementById('profitPerHour');
        if (hourEl) hourEl.textContent = formatNumber(State.game.profitPerHour);
        
        // Доход за клик
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = State.game.profitPerTap;

        // Энергия
        const energyFill = document.getElementById('energyFill');
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        
        if (energyFill && energyText && maxEnergyEl) {
            const percent = (State.game.energy / State.game.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
            energyText.textContent = Math.floor(State.game.energy);
            maxEnergyEl.textContent = State.game.maxEnergy;
        }

        // Время восстановления
        const missing = State.game.maxEnergy - State.game.energy;
        const regenEl = document.getElementById('energyRegenInfo');
        if (regenEl) {
            if (missing > 0) {
                const seconds = Math.ceil(missing * 2);
                regenEl.textContent = `⚡ +1/2сек (${seconds}сек до полной)`;
            } else {
                regenEl.textContent = '⚡ Energy full!';
            }
        }

        // Уровень
        const globalLevelEl = document.getElementById('globalLevel');
        if (globalLevelEl) globalLevelEl.textContent = State.game.levels.multitap;

        // Цена глобального апгрейда
        const globalPriceEl = document.getElementById('globalPrice');
        if (globalPriceEl) {
            const total = State.game.prices.multitap + State.game.prices.profit + State.game.prices.energy;
            globalPriceEl.textContent = formatNumber(total);
        }
        
        pendingUI = false;
    });
}

// ==================== ЭНЕРГИЯ ====================
function startEnergyRecovery() {
    if (State.temp.recoveryTimer) clearInterval(State.temp.recoveryTimer);
    State.temp.recoveryTimer = setInterval(recoverEnergy, CONFIG.ENERGY_RECHARGE_INTERVAL);
}

async function recoverEnergy() {
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    if (megaBoostActive || State.game.energy >= State.game.maxEnergy) return;
    
    if (!userId) {
        State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
        updateUI();
        return;
    }
    
    try {
        const data = await API.post('/api/recover-energy', { user_id: userId });
        if (data?.energy !== undefined) {
            State.game.energy = data.energy;
            updateUI();
        }
    } catch (err) {
        State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
        updateUI();
    }
}

// ==================== КЛИКИ ====================
async function sendClickBatch() {
    const clicks = State.temp.clickBuffer;
    const gain = State.temp.gainBuffer;
    
    State.temp.clickBuffer = 0;
    State.temp.gainBuffer = 0;
    State.temp.batchTimer = null;
    
    if (!userId || clicks === 0) return;
    
    try {
        await API.post('/api/click', {
            user_id: userId,
            clicks,
            gain,
            mega_boost: document.getElementById('mega-boost-btn')?.classList.contains('active') || false
        });
    } catch (err) {
        console.log('Click batch failed, will retry');
        State.temp.clickBuffer += clicks;
        State.temp.gainBuffer += gain;
    }
}

function handleTap(e) {
    // Инициализация звука
    initAudio();
    
    // Предотвращаем стандартное поведение
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    // Игнорируем клики по кнопкам
    if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card')) {
        return;
    }

    // Координаты для анимации
    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Проверка буста
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    
    if (!megaBoostActive && State.game.energy < 1) {
        showEnergyRecoveryModal();
        return;
    }

    // Расчет дохода
    let gain = State.game.profitPerTap;
    
    const skin = State.skins.data.find(s => s.id === State.skins.selected);
    if (skin?.bonus?.type === 'multiplier') {
        gain *= skin.bonus.value;
    }
    
    if (megaBoostActive) gain *= 2;
    gain = Math.floor(gain);
    if (isNaN(gain) || gain < 1) gain = 1;

    // Обновление состояния
    State.game.coins += gain;
    if (!megaBoostActive) {
        State.game.energy = Math.max(0, State.game.energy - 1);
    }
    
    // Буферизация для отправки
    State.temp.clickBuffer++;
    State.temp.gainBuffer += gain;
    if (!State.temp.batchTimer) {
        State.temp.batchTimer = setTimeout(sendClickBatch, CONFIG.CLICK_BATCH_INTERVAL);
    }
    
    updateUI();

    // ========== АНИМАЦИЯ ==========
    try {
        const effect = document.createElement('div');
        effect.className = 'tap-effect-global';
        effect.style.cssText = `
            position: fixed;
            left: ${clientX}px;
            top: ${clientY}px;
            transform: translate(-50%, -50%);
            color: ${megaBoostActive ? '#ffaa00' : 'white'};
            font-size: 28px;
            font-weight: bold;
            text-shadow: 0 0 10px ${megaBoostActive ? '#ffaa00' : '#7F49B4'};
            pointer-events: none;
            z-index: 9999;
            white-space: nowrap;
            transition: all 0.6s ease-out;
        `;
        effect.textContent = megaBoostActive ? `+${gain} 🔥` : `+${gain}`;
        document.body.appendChild(effect);
        
        requestAnimationFrame(() => {
            effect.style.transform = 'translate(-50%, -150px)';
            effect.style.opacity = '0';
        });
        
        setTimeout(() => effect.remove(), 600);
    } catch (err) {}

    // ========== ЗВУК ==========
    if (State.settings.sound) {
        try {
            if (!window.audioCtx) {
                window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
            
            const now = window.audioCtx.currentTime;
            const osc = window.audioCtx.createOscillator();
            const gainNode = window.audioCtx.createGain();
            osc.connect(gainNode);
            gainNode.connect(window.audioCtx.destination);
            
            osc.type = megaBoostActive ? 'sawtooth' : 'sine';
            osc.frequency.setValueAtTime(megaBoostActive ? 800 : 650, now);
            osc.frequency.exponentialRampToValueAtTime(megaBoostActive ? 400 : 450, now + 0.1);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            
            osc.start(now);
            osc.stop(now + 0.2);
        } catch (err) {}
    }

    // ========== ВИБРАЦИЯ ==========
    if (State.settings.vibration) {
        try {
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            } else if (navigator.vibrate) {
                navigator.vibrate(20);
            }
        } catch (err) {}
    }
}

function initAudio() {
    if (!window.audioCtx) {
        try {
            window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {}
    }
}

// ==================== СКИНЫ ====================
function getSkinById(id) {
    return State.skins.data.find(s => s.id === id);
}

function applySavedSkin() {
    const img = document.querySelector('.click-image');
    if (!img) return;
    
    const skin = getSkinById(State.skins.selected);
    img.src = (skin?.image || 'imgg/skins/default_SP.png') + '?t=' + Date.now();
    img.onerror = () => img.src = 'imgg/clickimg.png';
}

function renderSkins(filter = 'all') {
    const grid = document.getElementById('skins-grid');
    if (!grid || !State.skins.data.length) return;
    
    const filtered = filter === 'all' ? State.skins.data : State.skins.data.filter(s => s.rarity === filter);
    
    grid.innerHTML = filtered.map(skin => {
        const unlocked = State.skins.owned.includes(skin.id) || skin.requirement?.type === 'free';
        const owned = State.skins.owned.includes(skin.id);
        const selected = State.skins.selected === skin.id;
        
        return `
            <div class="skin-card ${unlocked ? '' : 'locked'} ${selected ? 'selected' : ''}" 
                 data-id="${skin.id}" onclick="selectSkin('${skin.id}')">
                ${!unlocked ? '<div class="skin-lock">🔒</div>' : ''}
                ${owned && selected ? '<div class="skin-equipped">✓</div>' : ''}
                <div class="skin-image">
                    <img src="${skin.image}" alt="${skin.name}" loading="lazy"
                         onerror="this.src='imgg/clickimg.png'">
                </div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-rarity ${skin.rarity}">${skin.rarity}</div>
            </div>
        `;
    }).join('');
}

function selectSkin(id) {
    const skin = getSkinById(id);
    if (!skin) return;
    
    if (State.skins.owned.includes(id)) {
        selectActiveSkin(id);
    } else if (skin.requirement?.type === 'free') {
        unlockSkin(id);
    } else {
        showToast(`❌ Скин "${skin.name}" еще не открыт!`, true);
    }
}

async function selectActiveSkin(id) {
    if (!userId) return;
    try {
        await API.post('/api/select-skin', { user_id: userId, skin_id: id });
        State.skins.selected = id;
        applySavedSkin();
        renderSkins();
        showToast(`✨ Скин выбран!`);
    } catch (err) {
        console.error('Select skin error:', err);
    }
}

async function unlockSkin(id) {
    if (!userId || State.skins.owned.includes(id)) return;
    try {
        const res = await API.post('/api/unlock-skin', { user_id: userId, skin_id: id, method: 'free' });
        if (res.success) {
            State.skins.owned.push(id);
            showToast('✅ Новый скин разблокирован!');
            renderSkins();
            applySavedSkin();
        }
    } catch (err) {
        console.error('Unlock skin error:', err);
    }
}

function openSkins() {
    renderSkins();
    openModal('skins-screen');
}

function filterSkins(category, e) {
    document.querySelectorAll('.skin-category').forEach(btn => btn.classList.remove('active'));
    if (e) e.target.classList.add('active');
    renderSkins(category);
}

// ==================== УЛУЧШЕНИЯ ====================
let upgradeInProgress = false;

async function upgradeBoost(type) {
    if (upgradeInProgress || !userId) return;
    
    const price = State.game.prices[type];
    if (!price || State.game.coins < price) {
        showToast(`❌ Нужно ${price} монет`, true);
        return;
    }

    upgradeInProgress = true;
    
    try {
        const result = await API.post('/api/upgrade', {
            user_id: userId,
            boost_type: type
        });
        
        if (result) {
            State.game.coins = result.coins;
            State.game.levels[type] = result.new_level;
            State.game.prices[type] = result.next_cost || 0;
            
            if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
            if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
            if (result.max_energy) {
                State.game.maxEnergy = result.max_energy;
                State.game.energy = result.max_energy;
            }
            
            showToast(`✅ ${type} +${result.new_level}!`);
            updateUI();
        }
    } catch (err) {
        showToast('❌ Ошибка сервера', true);
    } finally {
        upgradeInProgress = false;
    }
}

async function upgradeAll() {
    if (upgradeInProgress || !userId) return;

    const total = State.game.prices.multitap + State.game.prices.profit + State.game.prices.energy;
    if (State.game.coins < total) {
        showToast(`❌ Нужно ${total} монет`, true);
        return;
    }

    upgradeInProgress = true;
    
    for (const type of ['multitap', 'profit', 'energy']) {
        try {
            const result = await API.post('/api/upgrade', { user_id: userId, boost_type: type });
            if (result) {
                State.game.coins = result.coins;
                State.game.levels[type] = result.new_level;
                State.game.prices[type] = result.next_cost || 0;
                if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
                if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
                if (result.max_energy) {
                    State.game.maxEnergy = result.max_energy;
                    State.game.energy = result.max_energy;
                }
            }
        } catch (err) {}
    }
    
    upgradeInProgress = false;
    showToast('✅ Все улучшения куплены!');
    updateUI();
}

// ==================== РЕФЕРАЛЫ ====================
async function loadReferralData() {
    if (!userId) return;
    try {
        const link = `https://t.me/Ryoho_bot?start=ref_${userId}`;
        const linkEl = document.getElementById('referral-link');
        if (linkEl) linkEl.textContent = link;

        const data = await API.get(`/api/referral-data/${userId}`);
        
        const countEl = document.getElementById('referral-count');
        const earnEl = document.getElementById('referral-earnings');
        if (countEl) countEl.textContent = data.count || 0;
        if (earnEl) earnEl.textContent = data.earnings || 0;
        
        State.skins.friendsInvited = data.count || 0;
    } catch (err) {}
}

function copyReferralLink() {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl?.textContent || linkEl.textContent === 'loading...') {
        showToast('❌ Ссылка не загружена', true);
        return;
    }
    navigator.clipboard?.writeText(linkEl.textContent).then(() => showToast('✅ Ссылка скопирована!'));
}

function shareReferral() {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl?.textContent || linkEl.textContent === 'loading...') {
        showToast('❌ Ссылка не загружена', true);
        return;
    }
    window.open(`https://t.me/share/url?url=${encodeURIComponent(linkEl.textContent)}&text=${encodeURIComponent('🎮 Присоединяйся к Spirit Clicker!')}`, '_blank');
}

// ==================== НАСТРОЙКИ ====================
function loadSettings() {
    applyTheme();
    updateSettingsUI();
}

function saveSettings() {
    localStorage.setItem('ryohoSettings', JSON.stringify(State.settings));
}

function applyTheme() {
    if (State.settings.theme === 'night') {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
}

function toggleTheme() {
    State.settings.theme = State.settings.theme === 'day' ? 'night' : 'day';
    saveSettings();
    applyTheme();
    updateSettingsUI();
}

function toggleSound() {
    State.settings.sound = !State.settings.sound;
    saveSettings();
    updateSettingsUI();
}

function toggleVibration() {
    State.settings.vibration = !State.settings.vibration;
    saveSettings();
    updateSettingsUI();
    if (State.settings.vibration && navigator.vibrate) navigator.vibrate(50);
}

function updateSettingsUI() {
    const isNight = State.settings.theme === 'night';
    const soundOn = State.settings.sound;
    const vibOn = State.settings.vibration;
    
    setToggle('themeTrack', isNight);
    setIcon('themeIcon', isNight ? '🌙' : '☀️');
    setLabel('themeLabel', isNight ? 'Night' : 'Day');
    
    setToggle('soundTrack', soundOn);
    setIcon('soundIcon', soundOn ? '🔊' : '🔇');
    setLabel('soundLabel', soundOn ? 'On' : 'Off');
    
    setToggle('vibTrack', vibOn);
    setIcon('vibIcon', vibOn ? '📳' : '📴');
    setLabel('vibLabel', vibOn ? 'On' : 'Off');
}

function setToggle(id, active) {
    const el = document.getElementById(id);
    if (el) active ? el.classList.add('active') : el.classList.remove('active');
}

function setIcon(id, icon) {
    const el = document.getElementById(id);
    if (el) el.textContent = icon;
}

function setLabel(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ==================== НАВИГАЦИЯ ====================
function openModal(id) {
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('modal-open');
    }
}

function switchTab(tab, el) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    if (el) el.classList.add('active');
    
    document.querySelectorAll('.modal-screen').forEach(m => m.classList.remove('active'));
    document.body.classList.remove('modal-open');
    
    if (tab === 'main') return;
    
    const modalId = `${tab}-screen`;
    openModal(modalId);
    
    if (tab === 'friends') loadReferralData();
    if (tab === 'skins') openSkins();
}

function openSettings() {
    openModal('settings-screen');
}

function closeSettings() {
    closeModal('settings-screen');
}

function closeSettingsOutside(e) {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) closeSettings();
}

// ==================== ЭНЕРГИЯ - МОДАЛКА ====================
function showEnergyRecoveryModal() {
    if (document.querySelector('.energy-recovery-modal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'energy-recovery-modal';
    modal.innerHTML = `
        <div class="modal-content glass">
            <button class="modal-close" onclick="this.closest('.energy-recovery-modal').remove()">✕</button>
            <h3>⚡ Энергия закончилась!</h3>
            <p>Подождите 2 секунды за 1 энергию</p>
            <button class="btn-primary" onclick="this.closest('.energy-recovery-modal').remove()">OK</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// ==================== ПАССИВНЫЙ ДОХОД ====================
async function checkOfflinePassiveIncome() {
    if (!userId) return;
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/passive-income`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                State.game.coins = data.coins;
                updateUI();
                showToast(`💰 +${data.income} монет (офлайн)!`);
            }
        }
    } catch (err) {}
}

// ==================== МИНИ-ИГРЫ (ЗАГЛУШКИ) ====================
function openGame(game) {
    document.querySelectorAll('.game-modal').forEach(m => m.classList.remove('active'));
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.add('active');
}

function closeGame(game) {
    const modal = document.getElementById(`game-${game}`);
    if (modal) modal.classList.remove('active');
}

function toggleNumberInput() {
    const betType = document.getElementById('wheel-color')?.value;
    const numberInput = document.getElementById('wheel-number');
    if (numberInput) numberInput.style.display = betType === 'number' ? 'block' : 'none';
}

// ==================== MEGA BOOST (ЗАГЛУШКА) ====================
function activateMegaBoost() {
    showToast('🔥 Буст будет позже');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spirit Clicker starting...');
    
    loadSettings();
    
    if (userId) {
        await loadUserData();
        startEnergyRecovery();
        await loadReferralData();
    } else {
        const saved = localStorage.getItem('ryohoGame');
        if (saved) {
            try { Object.assign(State.game, JSON.parse(saved)); } catch(e) {}
        }
        updateUI();
    }
    
    // Привязываем обработчик кликов
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        gameContainer.addEventListener('click', handleTap);
        gameContainer.addEventListener('touchstart', handleTap, { passive: false });
    }
    
    // Автосохранение
    setInterval(() => {
        localStorage.setItem('ryohoGame', JSON.stringify(State.game));
    }, 10000);
    
    setInterval(checkOfflinePassiveIncome, CONFIG.PASSIVE_INCOME_INTERVAL);
    
    applySavedSkin();
    
    console.log('✅ Spirit Clicker ready');
});

setTimeout(() => {
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        // Удаляем старые обработчики если есть
        gameContainer.removeEventListener('click', handleTap);
        gameContainer.removeEventListener('touchstart', handleTap);
        
        // Добавляем новые
        gameContainer.addEventListener('click', handleTap);
        gameContainer.addEventListener('touchstart', handleTap, { passive: false });
        
        console.log('✅ Обработчик кликов привязан');
    } else {
        console.log('❌ Контейнер не найден');
    }
}, 500); // Даем время на загрузку DOM

// ==================== ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ ====================
window.handleTap = handleTap;
window.upgradeBoost = upgradeBoost;
window.upgradeAll = upgradeAll;
window.openGame = openGame;
window.closeGame = closeGame;
window.toggleNumberInput = toggleNumberInput;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.copyReferralLink = copyReferralLink;
window.shareReferral = shareReferral;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsOutside = closeSettingsOutside;
window.toggleTheme = toggleTheme;
window.toggleSound = toggleSound;
window.toggleVibration = toggleVibration;
window.activateMegaBoost = activateMegaBoost;
window.selectSkin = selectSkin;
window.filterSkins = filterSkins;
window.openSkins = openSkins;
window.recoverEnergy = recoverEnergy;
window.showToast = showToast;

console.log('✅ Spirit Clicker fully loaded');