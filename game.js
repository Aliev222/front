// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
window.API_URL = 'https://ryoho.onrender.com';
window.recoveryInterval = null;

'use strict';

console.log('🚀 game.js загружен', new Date().toLocaleTimeString());

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: window.API_URL,
    CLICK_BATCH_INTERVAL: 1000,
    ENERGY_RECHARGE_INTERVAL: 1000,
    PASSIVE_INCOME_INTERVAL: 3600000,
    CACHE_TTL: 30000
};

window.CONFIG = CONFIG;

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

// ==================== СОСТОЯНИЕ ====================
const State = {
    user: { id: userId, username, referrerId },
    achievements: {
        clicks: 0,
        upgrades: 0,
        games: 0,
        referrals: 0,
        adsWatched: 0,
        completed: []
    },
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
        lastClick: 0,
        tournamentScore: 0,
        energyBuffer: 0,
        animationTimer: null,
        syncTimer: null,
        fullSyncTimer: null,
        serverEnergy: 0,
        serverEnergySyncedAt: 0,
        energyVisualTimer: null
    },
    cache: new Map()
};

window.State = State;
window.state = State;

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
const formatNumber = (num) => {
    num = Math.floor(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

const showToast = (msg, isError = false) => {
    const oldToast = document.querySelector('.toast-message');
    if (oldToast) oldToast.remove();
    
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: ${isError ? '#e74c3c' : '#7F49B4'};
        color: white;
        padding: 12px 24px;
        border-radius: 40px;
        font-size: 14px;
        font-weight: 600;
        z-index: 20000;
        animation: toastFade 2s forwards;
        box-shadow: 0 4px 15px rgba(127, 73, 180, 0.5);
        white-space: nowrap;
        border: 1px solid rgba(255,255,255,0.3);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

// ==================== ДОСТИЖЕНИЯ ====================
const ACHIEVEMENTS = [
    {
        id: 'click_100',
        title: 'Начинающий кликер',
        description: 'Сделай 100 кликов',
        icon: '👆',
        condition: (stats) => stats.clicks >= 100,
        reward: 1000
    },
    {
        id: 'click_1000',
        title: 'Опытный кликер',
        description: 'Сделай 1000 кликов',
        icon: '👆',
        condition: (stats) => stats.clicks >= 1000,
        reward: 5000
    },
    {
        id: 'click_10000',
        title: 'Мастер кликов',
        description: 'Сделай 10000 кликов',
        icon: '👑',
        condition: (stats) => stats.clicks >= 10000,
        reward: 20000
    },
    {
        id: 'upgrade_10',
        title: 'Улучшатель',
        description: 'Купи 10 улучшений',
        icon: '⬆️',
        condition: (stats) => stats.upgrades >= 10,
        reward: 5000
    },
    {
        id: 'games_10',
        title: 'Игрок',
        description: 'Сыграй в мини-игры 10 раз',
        icon: '🎮',
        condition: (stats) => stats.games >= 10,
        reward: 3000
    },
    {
        id: 'referral_5',
        title: 'Популярный',
        description: 'Пригласи 5 друзей',
        icon: '👥',
        condition: (stats) => stats.referrals >= 5,
        reward: 10000
    }
];

function checkAchievements() {
    const stats = {
        clicks: State.achievements.clicks || 0,
        upgrades: State.achievements.upgrades || 0,
        games: State.achievements.games || 0,
        referrals: State.skins.friendsInvited || 0,
        adsWatched: State.skins.adsWatched || 0
    };
    
    ACHIEVEMENTS.forEach(achievement => {
        if (!State.achievements.completed.includes(achievement.id) && 
            achievement.condition(stats)) {
            State.achievements.completed.push(achievement.id);
            State.game.coins += achievement.reward;
            showAchievementNotification(achievement);
            updateUI();
        }
    });
}

function showAchievementNotification(achievement) {
    const toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML = `
        <div class="achievement-toast-icon">${achievement.icon}</div>
        <div class="achievement-toast-info">
            <div class="achievement-toast-title">🏆 Достижение!</div>
            <div class="achievement-toast-name">${achievement.title}</div>
            <div class="achievement-toast-reward">+${achievement.reward} 🪙</div>
        </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    createConfetti();
    playAchievementSound();
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function playAchievementSound() {
    if (!State.settings.sound) return;
    try {
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = window.audioCtx.createOscillator();
            const gain = window.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(window.audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    } catch (err) {}
}

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
        await checkBoostStatus();

        
        applySavedSkin();
        updateUI();
        startPerfectEnergySystem();
        
    } catch (err) {
        console.error('Failed to load user data:', err);
        showToast('⚠️ Ошибка загрузки данных', true);
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

// ==================== ЛОКАЛЬНЫЕ СКИНЫ ====================
function getLocalSkins() {
    return [
        { id: 'skin_lvl_1', name: 'Начинающий спирикс', image: 'imgg/skins/default_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.1 }, requirement: { type: 'level', value: 1 } },
        { id: 'skin_lvl_2', name: 'Опытный спирикс', image: 'imgg/skins/Coin_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'level', value: 10 } },
        { id: 'skin_lvl_3', name: 'Мастер спирикс', image: 'imgg/skins/Galaxy_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'level', value: 25 } },
        { id: 'skin_lvl_4', name: 'Элитный спирикс', image: 'imgg/skins/King_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.4 }, requirement: { type: 'level', value: 40 } },
        { id: 'skin_lvl_5', name: 'Легендарный спирикс', image: 'imgg/skins/Monster_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'level', value: 60 } },
        { id: 'skin_lvl_6', name: 'Мифический спирикс', image: 'imgg/skins/Ninja_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.6 }, requirement: { type: 'level', value: 80 } },
        { id: 'skin_lvl_7', name: 'Божественный спирикс', image: 'imgg/skins/Shadow_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'level', value: 100 } },
        { id: 'skin_video_1', name: 'Звездный спирикс', image: 'imgg/skins/Techno_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'ads', count: 5 } },
        { id: 'skin_video_2', name: 'Космический спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'ads', count: 10 } },
        { id: 'skin_video_3', name: 'Галактический спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.4 }, requirement: { type: 'ads', count: 20 } },
        { id: 'skin_video_4', name: 'Небесный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'ads', count: 25 } },
        { id: 'skin_video_5', name: 'Божественный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.75 }, requirement: { type: 'ads', count: 35 } },
        { id: 'skin_video_6', name: 'Всемогущий спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'ads', count: 50 } },
        { id: 'skin_friend_1', name: 'Дружный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.1 }, requirement: { type: 'friends', count: 1 } },
        { id: 'skin_friend_2', name: 'Популярный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'friends', count: 3 } },
        { id: 'skin_friend_3', name: 'Известный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'friends', count: 5 } },
        { id: 'skin_friend_4', name: 'Звездный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'friends', count: 10 } },
        { id: 'skin_friend_5', name: 'Легендарный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.75 }, requirement: { type: 'friends', count: 20 } },
        { id: 'skin_friend_6', name: 'Император спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'super', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'friends', count: 50 } },
        { id: 'skin_cpa_1', name: 'Тайный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'super', bonus: { type: 'multiplier', value: 2.5 }, requirement: { type: 'link', url: 'https://example.com' } }
    ];
}

async function loadSkinsList() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/skins/list`);
        if (res.ok) {
            const data = await res.json();
            State.skins.data = data.skins || [];
        } else {
            State.skins.data = getLocalSkins();
        }
    } catch (err) {
        State.skins.data = getLocalSkins();
    }
    
    State.skins.data.forEach(skin => {
        if (skin.requirement?.type === 'level') {
            skin.requirement.current = State.game.levels.multitap || 0;
        } else if (skin.requirement?.type === 'ads') {
            skin.requirement.current = State.skins.adsWatched || 0;
        } else if (skin.requirement?.type === 'friends') {
            skin.requirement.current = State.skins.friendsInvited || 0;
        }
    });
    
    renderSkins();
    updateCollectionProgress();
}

// ==================== UI ОБНОВЛЕНИЕ ====================
let pendingUI = false;

function updateUI() {
    if (pendingUI) return;
    pendingUI = true;
    
    requestAnimationFrame(() => {
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = formatNumber(State.game.coins);

        const hourEl = document.getElementById('profitPerHour');
        if (hourEl) hourEl.textContent = formatNumber(State.game.profitPerHour);
        
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = State.game.profitPerTap;

        const energyFill = document.getElementById('energyFill');
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        
        if (energyFill && energyText && maxEnergyEl) {
            const percent = (State.game.energy / State.game.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
            energyText.textContent = Math.floor(State.game.energy);
            maxEnergyEl.textContent = State.game.maxEnergy;
        }

        const globalLevelEl = document.getElementById('globalLevel');
        if (globalLevelEl) globalLevelEl.textContent = State.game.levels.multitap;

        const globalPriceEl = document.getElementById('globalPrice');
        if (globalPriceEl) {
            const total = State.game.prices.multitap + State.game.prices.profit + State.game.prices.energy;
            globalPriceEl.textContent = formatNumber(total);
        }
        
        pendingUI = false;
    });
}

// ==================== ЭНЕРГИЯ ====================
function startPerfectEnergySystem() {
    const ENERGY_REGEN_MS = 5000; // 1 энергия / 5 сек

    if (State.temp.syncTimer) {
        clearInterval(State.temp.syncTimer);
    }

    if (State.temp.energyVisualTimer) {
        clearInterval(State.temp.energyVisualTimer);
    }

    // Редкий sync с сервером
    State.temp.syncTimer = setInterval(() => {
        if (!userId) return;
        syncEnergyWithServer();
    }, 15000);

    // Плавное визуальное обновление
    State.temp.energyVisualTimer = setInterval(() => {
        if (!State.temp.serverEnergySyncedAt) return;

        const now = Date.now();
        const elapsed = now - State.temp.serverEnergySyncedAt;
        const gained = Math.floor(elapsed / ENERGY_REGEN_MS);

        const visualEnergy = Math.min(
            State.game.maxEnergy,
            (State.temp.serverEnergy ?? State.game.energy) + gained
        );

        if (visualEnergy !== State.game.energy) {
            State.game.energy = visualEnergy;
            updateUI();
        }
    }, 1000);
}

async function syncEnergyWithServer() {
    if (!userId) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/sync-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId
            })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (typeof data.energy === 'number') {
            State.temp.serverEnergy = data.energy;
            State.temp.serverEnergySyncedAt = Date.now();
            State.game.energy = data.energy;
        }

        if (typeof data.max_energy === 'number') {
            State.game.maxEnergy = data.max_energy;
        }

        updateUI();
    } catch (e) {
        console.error('Energy sync error:', e);
    }
}

async function fullSyncWithServer() {
    if (!userId) return;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/user/${userId}`);
        if (res.ok) {
            const data = await res.json();
            State.game.coins = data.coins;
            State.game.energy = data.energy;
            State.game.maxEnergy = data.max_energy;
            State.game.profitPerTap = data.profit_per_tap || State.game.profitPerTap;
            State.game.profitPerHour = data.profit_per_hour || State.game.profitPerHour;
            updateUI();
        }
    } catch (e) {
        console.error('Full sync error:', e);
    }
}

// ==================== КЛИКИ ====================
let lastBatchTime = 0;

async function sendClickBatch() {
    const clicks = State.temp.clickBuffer;

    if (clicks === 0 || !userId) return;

    State.temp.clickBuffer = 0;

    try {
        const res = await fetch(`${CONFIG.API_URL}/api/clicks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                clicks: clicks
            })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.success) {
            State.game.coins = data.coins;
            State.game.energy = data.energy;
            State.game.maxEnergy = data.max_energy ?? State.game.maxEnergy;
            State.game.profitPerTap = data.profit_per_tap ?? State.game.profitPerTap;
            State.game.profitPerHour = data.profit_per_hour ?? State.game.profitPerHour;
            updateUI();
        }
    } catch (err) {
        console.error('Click batch error:', err);
        State.temp.clickBuffer += clicks;
    }
}

function handleTap(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    if (e.target.closest(
        'button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
        '.modal-screen, .modal-content, .game-modal, .game-modal-content'
    )) return;

    let clientX, clientY;
    if (e.touches && e.touches[0]) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const megaBoostActive =
        document.getElementById('mega-boost-btn')?.classList.contains('active') || false;

    if (!megaBoostActive && State.game.energy < 1) {
        showEnergyRecoveryModal();
        return;
    }

    let previewGain = State.game.profitPerTap;

    const skin = State.skins.data.find(s => s.id === State.skins.selected);
    if (skin?.bonus?.type === 'multiplier') {
        previewGain *= skin.bonus.value;
    }

    if (megaBoostActive) {
        previewGain *= 2;
    }

    previewGain = Math.floor(previewGain) || 1;

    // Мгновенный визуальный отклик
    State.temp.clickBuffer += 1;

    // Локальный optimistic UI только для ощущения скорости
    State.game.coins += previewGain;
    if (!megaBoostActive) {
        State.game.energy = Math.max(0, State.game.energy - 1);
        State.temp.serverEnergy = State.game.energy;
        State.temp.serverEnergySyncedAt = Date.now();
    }

    State.achievements.clicks = (State.achievements.clicks || 0) + 1;
    checkAchievements();
    updateUI();

    const effect = document.createElement('div');
    effect.className = 'tap-effect-global';
    effect.style.cssText = `
        position: fixed;
        left: ${clientX}px;
        top: ${clientY}px;
        transform: translate(-50%, -50%);
        color: ${megaBoostActive ? '#FFD700' : '#7F49B4'};
        font-size: 28px;
        font-weight: bold;
        text-shadow: 0 0 10px ${megaBoostActive ? '#FFD700' : '#7F49B4'};
        pointer-events: none;
        z-index: 9999;
        white-space: nowrap;
        transition: all 0.6s ease-out;
    `;
    effect.textContent = megaBoostActive ? `+${previewGain} 🔥` : `+${previewGain}`;
    document.body.appendChild(effect);

    requestAnimationFrame(() => {
        effect.style.transform = 'translate(-50%, -150px)';
        effect.style.opacity = '0';
    });

    setTimeout(() => effect.remove(), 600);

    if (State.settings.sound) {
        try {
            if (!window.audioCtx) window.audioCtx = new AudioContext();
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

    if (State.settings.vibration) {
        try {
            if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
            else if (navigator.vibrate) navigator.vibrate(20);
        } catch (err) {}
    }
}

// ==================== СИНХРОНИЗАЦИЯ ====================
let syncTimer = null;
const SYNC_INTERVAL = 15000;

async function forceSync() {
    if (State.temp.clickBuffer > 0) {
        await sendClickBatch();
    }

    await fullSyncWithServer();
}

function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(forceSync, SYNC_INTERVAL);
}

// ==================== СКИНЫ ====================
let currentFilter = 'all';

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

function renderSkins() {
    const grid = document.getElementById('skins-grid');
    if (!grid) return;
    
    let filtered = State.skins.data;
    if (currentFilter && currentFilter !== 'all') {
        filtered = filtered.filter(s => s.rarity === currentFilter);
    }
    
    if (!filtered || filtered.length === 0) {
        grid.innerHTML = '<div class="loading">Нет скинов</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(skin => {
        const isOwned = State.skins.owned.includes(skin.id);
        const isSelected = State.skins.selected === skin.id;
        const isLocked = !isOwned;
        
        return `
            <div class="skin-card ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
                 data-id="${skin.id}" onclick="openSkinDetail('${skin.id}')">
                <div class="skin-image">
                    <img src="${skin.image}" alt="${skin.name}" 
                         onerror="this.src='imgg/clickimg.png'">
                </div>
                <div class="skin-name">${skin.name}</div>
                <div class="skin-rarity ${skin.rarity}">${skin.rarity}</div>
                ${isLocked ? '<div class="skin-lock">🔒</div>' : ''}
                ${isSelected ? '<div class="skin-selected-badge">✓</div>' : ''}
            </div>
        `;
    }).join('');
}

function filterSkins(category, event) {
    currentFilter = category;
    
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    else {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(category) || 
                (category === 'all' && btn.textContent === 'All')) {
                btn.classList.add('active');
            }
        });
    }
    
    renderSkins();
}

function selectSkin(id) {
    const skin = getSkinById(id);
    if (!skin) return;
    
    if (State.skins.owned.includes(id)) selectActiveSkin(id);
    else showToast(`❌ Скин "${skin.name}" еще не открыт!`, true);
}

async function selectActiveSkin(id) {
    if (!userId) return;
    try {
        await API.post('/api/select-skin', { user_id: userId, skin_id: id });
        State.skins.selected = id;
        applySavedSkin();
        renderSkins();
        showToast('✨ Скин выбран!');
    } catch (err) {
        showToast('❌ Ошибка выбора скина', true);
    }
}

async function unlockSkin(id) {
    if (!userId || State.skins.owned.includes(id)) return;
    try {
        const res = await API.post('/api/unlock-skin', { user_id: userId, skin_id: id, method: 'free' });
        if (res.success) {
            State.skins.owned.push(id);
            showToast('✅ Новый скин!');
            renderSkins();
            applySavedSkin();
        }
    } catch (err) {
        showToast('❌ Ошибка разблокировки', true);
    }
}

function openSkins() {
    renderSkins();
    openModal('skins-screen');
}

function getSkinEffect(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) return null;
    
    switch(skin.rarity) {
        case 'legendary': return { color: '#FFD700', particleColor: ['#FFD700', '#FFA500', '#FF4500'], particleCount: 15 };
        case 'super': return { color: '#FF6B6B', particleColor: ['#FF6B6B', '#FF8E8E', '#FFB6B6'], particleCount: 10 };
        case 'rare': return { color: '#4ECDC4', particleColor: ['#4ECDC4', '#6ED4CC', '#8EDBD4'], particleCount: 8 };
        default: return { color: '#7F49B4', particleColor: ['#7F49B4', '#9B6BDF', '#B88CE8'], particleCount: 5 };
    }
}

function openSkinDetail(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) return;
    
    const modal = document.getElementById('skin-detail-modal');
    if (!modal) return;
    
    const isOwned = State.skins.owned.includes(skin.id);
    const isSelected = State.skins.selected === skin.id;
    
    document.getElementById('skin-detail-img').src = skin.image || 'imgg/clickimg.png';
    document.getElementById('skin-detail-name').textContent = skin.name || 'Скин';
    
    const rarityEl = document.getElementById('skin-detail-rarity');
    rarityEl.textContent = skin.rarity || 'common';
    rarityEl.className = 'skin-rarity-badge ' + (skin.rarity || 'common');
    
    document.getElementById('skin-detail-description').textContent = skin.description || 'Нет описания';
    
    const bonusEl = document.getElementById('skin-detail-bonus');
    if (skin.bonus) {
        if (skin.bonus.type === 'multiplier') bonusEl.innerHTML = `⚡ x${skin.bonus.value} к доходу`;
        else bonusEl.innerHTML = `⚡ +${skin.bonus.value || 0}`;
    } else {
        bonusEl.innerHTML = '⚡ Бонус: нет';
    }
    
    const reqBlock = document.getElementById('skin-requirement-block');
    const reqText = document.getElementById('skin-requirement-text');
    const reqProgress = document.getElementById('skin-requirement-progress');
    const progressText = document.getElementById('requirement-progress-text');
    const progressFill = document.getElementById('requirement-progress-fill');
    const actionBtn = document.getElementById('skin-action-btn');
    
    if (isOwned) {
        reqBlock.style.display = 'none';
        actionBtn.textContent = isSelected ? '✓ ВЫБРАН' : 'ВЫБРАТЬ';
        actionBtn.onclick = isSelected ? closeSkinDetail : () => selectSkinFromDetail(skin.id);
    } else {
        reqBlock.style.display = 'block';
        
        if (skin.requirement?.type === 'level') {
            const current = State.game.levels.multitap || 0;
            const value = skin.requirement.value || 1;
            const percent = Math.min(100, (current / value) * 100);
            
            reqText.textContent = `🔓 Требуется уровень ${value}`;
            progressText.textContent = `${current}/${value}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';
            
            actionBtn.textContent = current >= value ? 'ПОЛУЧИТЬ' : 'ПРОКАЧАТЬ';
            actionBtn.onclick = current >= value ? () => unlockSkinFromDetail(skin.id) : () => {
                closeSkinDetail();
                switchTab('main');
            };
        } else if (skin.requirement?.type === 'ads') {
            const current = State.skins.adsWatched || 0;
            const count = skin.requirement.count || 1;
            const percent = Math.min(100, (current / count) * 100);
            
            reqText.textContent = `🔓 Посмотри ${count} видео`;
            progressText.textContent = `${current}/${count}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';
            
            actionBtn.textContent = current >= count ? 'ПОЛУЧИТЬ' : 'СМОТРЕТЬ ВИДЕО';
            actionBtn.onclick = current >= count ? () => unlockSkinFromDetail(skin.id) : () => watchAdForSkin(skin.id);
        } else {
            reqText.textContent = `🔓 Условие: особое`;
            reqProgress.style.display = 'none';
            actionBtn.textContent = 'НЕДОСТУПНО';
        }
    }
    
    modal.classList.add('active');
}

function closeSkinDetail() {
    document.getElementById('skin-detail-modal')?.classList.remove('active');
}

async function selectSkinFromDetail(skinId) {
    if (!userId) return showToast('❌ Авторизуйтесь', true);
    try {
        await API.post('/api/select-skin', { user_id: userId, skin_id: skinId });
        State.skins.selected = skinId;
        applySavedSkin();
        showToast('✨ Скин выбран!');
        closeSkinDetail();
        renderSkins();
    } catch (err) {
        showToast('❌ Ошибка выбора', true);
    }
}

async function unlockSkinFromDetail(skinId) {
    if (!userId) return showToast('❌ Авторизуйтесь', true);
    if (State.skins.owned.includes(skinId)) {
        showToast('✅ Скин уже есть');
        closeSkinDetail();
        return;
    }
    
    try {
        const res = await API.post('/api/unlock-skin', { user_id: userId, skin_id: skinId, method: 'free' });
        if (res.success) {
            State.skins.owned.push(skinId);
            showToast('✅ Новый скин!');
            closeSkinDetail();
            renderSkins();
            updateCollectionProgress();
        }
    } catch (err) {
        showToast('❌ Ошибка получения', true);
    }
}

function watchAdForSkin(skinId) {
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    window.show_10655027()
        .then(() => {
            State.skins.adsWatched++;
            showToast('✅ +1 просмотр!');
            renderSkins();
            if (document.getElementById('skin-detail-modal').classList.contains('active')) {
                openSkinDetail(skinId);
            }
        })
        .catch(() => showToast('❌ Ошибка', true));
}

function updateCollectionProgress() {
    const collected = State.skins.owned.length;
    const total = State.skins.data.length || 21;
    const percent = (collected / total) * 100;
    
    document.getElementById('skins-collected').textContent = collected;
    document.getElementById('skins-total').textContent = total;
    document.getElementById('skins-progress-fill').style.width = percent + '%';
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
            State.achievements.upgrades = (State.achievements.upgrades || 0) + 1;
            
            if (result.profit_per_tap) State.game.profitPerTap = result.profit_per_tap;
            if (result.profit_per_hour) State.game.profitPerHour = result.profit_per_hour;
            if (result.max_energy) {
                State.game.maxEnergy = result.max_energy;
                State.game.energy = result.max_energy;
            }
            
            showToast(`✅ ${type} +${result.new_level}!`);
            playUpgradeSound();
            updateUI();
            checkAchievements();
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

    let upgraded = 0;

    for (const type of ['multitap', 'profit', 'energy']) {
        try {
            await upgradeBoost(type);
            upgraded++;
        } catch (err) {
            console.error(`Upgrade failed for ${type}:`, err);
        }
    }

    if (upgraded > 0) {
        showToast('✅ Все улучшения куплены!');
        playUpgradeSound();
        checkAchievements();
        updateUI();
    }
}

function playUpgradeSound() {
    if (!State.settings.sound) return;
    try {
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        for (let i = 0; i < 3; i++) {
            const osc = window.audioCtx.createOscillator();
            const gain = window.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(window.audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400 + i * 200, now + i * 0.1);
            gain.gain.setValueAtTime(0.2, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        }
    } catch (err) {}
}

// ==================== ВИДЕО-ЗАДАНИЯ ====================
const VIDEO_TASKS = [
    {
        id: 'energy_full',
        title: '⚡ Полная энергия',
        description: 'Посмотри видео и восстанови всю энергию до максимума',
        reward: '⚡ MAX',
        icon: '🔋',
        type: 'energy_full',
        cooldown: 10, // 10 минут
        lastUsed: null,
        category: 'energy',
        completed: false,
        available: true
    },
    
    // ===== КОИНЫ (разные суммы) =====
    {
        id: 'coins_small',
        title: '💰 Мелочь в карман',
        description: 'Посмотри видео и получи 500 монет',
        reward: 500,
        icon: '🪙',
        type: 'coins',
        cooldown: 5, // 5 минут
        lastUsed: null,
        category: 'coins',
        completed: false,
        available: true
    },
    {
        id: 'coins_medium',
        title: '💎 Средний куш',
        description: 'Посмотри видео и получи 2000 монет',
        reward: 2000,
        icon: '💎',
        type: 'coins',
        cooldown: 15, // 15 минут
        lastUsed: null,
        category: 'coins',
        completed: false,
        available: true
    },
    {
        id: 'coins_large',
        title: '👑 Джекпот',
        description: 'Посмотри видео и получи 10000 монет',
        reward: 10000,
        icon: '👑',
        type: 'coins',
        cooldown: 60, // 60 минут (1 час)
        lastUsed: null,
        category: 'coins',
        completed: false,
        available: true
    },
    
    // ===== БУСТЫ =====
    {
        id: 'boost_double',
        title: '⚡ Удвоение',
        description: 'Посмотри видео и получи x2 к доходу на 5 минут',
        reward: 'x2 5мин',
        icon: '⚡',
        type: 'boost',
        boost_multiplier: 2,
        boost_minutes: 5,
        cooldown: 20, // 20 минут
        lastUsed: null,
        category: 'boost',
        completed: false,
        available: true
    },
    {
        id: 'boost_triple',
        title: '🔥 Утроение',
        description: 'Посмотри видео и получи x3 к доходу на 3 минуты',
        reward: 'x3 3мин',
        icon: '🔥',
        type: 'boost',
        boost_multiplier: 3,
        boost_minutes: 3,
        cooldown: 45, // 45 минут
        lastUsed: null,
        category: 'boost',
        completed: false,
        available: true
    },
    
    // ===== СЛУЧАЙНЫЙ БОНУС =====
    {
        id: 'random_box',
        title: '🎁 Загадочная коробка',
        description: 'Посмотри видео и получи случайный бонус',
        reward: '???',
        icon: '🎁',
        type: 'random',
        cooldown: 30, // 30 минут
        lastUsed: null,
        category: 'random',
        completed: false,
        available: true
    }
];


function checkTaskCooldown(task) {
    if (!task.lastUsed) return true; // Никогда не использовалось
    
    const now = Date.now();
    const cooldownMs = task.cooldown * 60 * 1000; // минуты в миллисекунды
    const timePassed = now - task.lastUsed;
    
    return timePassed >= cooldownMs;
}

function getTaskTimeLeft(task) {
    if (!task.lastUsed) return 0;
    
    const now = Date.now();
    const cooldownMs = task.cooldown * 60 * 1000;
    const timePassed = now - task.lastUsed;
    const timeLeft = Math.max(0, cooldownMs - timePassed);
    
    return Math.ceil(timeLeft / 1000 / 60); // минуты
}

function loadVideoTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    const now = new Date();
    const lastReset = localStorage.getItem('videoTasksReset');
    
    if (!lastReset || new Date(lastReset).getDate() !== now.getDate()) {
        VIDEO_TASKS.forEach(task => {
            task.completed = false;
            task.available = true;
        });
        localStorage.setItem('videoTasksReset', now.toISOString());
    }
    
    renderVideoTasks();
}

function renderVideoTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    // Обновляем доступность заданий по кулдауну
    VIDEO_TASKS.forEach(task => {
        if (task.lastUsed) {
            task.available = checkTaskCooldown(task);
        }
    });
    
    container.innerHTML = VIDEO_TASKS.map(task => {
        const completed = task.completed;
        const available = task.available;
        const timeLeft = task.lastUsed ? getTaskTimeLeft(task) : 0;
        
        // Определяем цвет иконки по типу
        let iconColor = '';
        switch(task.category) {
            case 'energy': iconColor = 'linear-gradient(135deg, #4CAF50, #2E7D32)'; break;
            case 'coins': iconColor = 'linear-gradient(135deg, #FFD700, #B8860B)'; break;
            case 'skins': iconColor = 'linear-gradient(135deg, #7F49B4, #4A2C6D)'; break;
            case 'boost': iconColor = 'linear-gradient(135deg, #FF6B6B, #C0392B)'; break;
            default: iconColor = 'linear-gradient(135deg, #3498DB, #1F618D)';
        }
        
        return `
            <div class="task-card ${!available ? 'cooldown' : ''}" data-category="${task.category}">
                <div class="task-icon" style="background: ${iconColor}">
                    ${task.icon}
                </div>
                
                <div class="task-info">
                    <div class="task-title">${task.title}</div>
                    <div class="task-desc">${task.description}</div>
                    
                    <div class="task-reward">
                        🎁 ${typeof task.reward === 'number' ? task.reward + ' 🪙' : task.reward}
                    </div>
                    
                    ${!available && timeLeft > 0 ? `
                        <div class="task-cooldown">
                            ⏳ Доступно через ${timeLeft} мин
                        </div>
                    ` : ''}
                </div>
                
                <button class="task-action ${task.category}" 
                        onclick="handleVideoTask('${task.id}')"
                        ${!available ? 'disabled' : ''}>
                    ${!available ? '⏳' : '📺 Смотреть'}
                </button>
            </div>
        `;
    }).join('');
}
async function handleVideoTask(taskId) {
    const task = VIDEO_TASKS.find(t => t.id === taskId);
    if (!task || !task.available) return;
    
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем видео...');
    
    try {
        await window.show_10655027();
        
        // Начисляем награду
        switch(task.type) {
            case 'energy_full':
                State.game.energy = State.game.maxEnergy;
                showToast('⚡ Энергия полностью восстановлена!');
                break;
                
            case 'coins':
                State.game.coins += task.reward;
                showToast(`💰 +${task.reward} монет!`);
                break;
                
            case 'skin':
                await unlockRandomSkin(task.skin_rarity);
                break;
                
            case 'boost':
                activateCustomBoost(task.boost_multiplier, task.boost_minutes);
                break;
                
            case 'random':
                giveRandomReward();
                break;
        }
        
        // Устанавливаем кулдаун
        task.lastUsed = Date.now();
        task.available = false;
        
        updateUI();
        renderVideoTasks();
        createConfetti();
        
    } catch (error) {
        console.error('Video error:', error);
        showToast('❌ Ошибка при просмотре видео', true);
    }
}

function giveRandomReward() {
    const rewards = [
        { type: 'coins', value: 1000 },
        { type: 'coins', value: 2000 },
        { type: 'coins', value: 5000 },
        { type: 'energy', value: 50 },
        { type: 'boost', multiplier: 2, minutes: 5 },
        { type: 'skin_chance', rarity: 'common' }
    ];
    
    const random = rewards[Math.floor(Math.random() * rewards.length)];
    
    switch(random.type) {
        case 'coins':
            State.game.coins += random.value;
            showToast(`🎁 +${random.value} монет!`);
            break;
        case 'energy':
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + random.value);
            showToast(`🎁 +${random.value} энергии!`);
            break;
        case 'boost':
            activateCustomBoost(random.multiplier, random.minutes);
            break;
        case 'skin_chance':
            unlockRandomSkin('common');
            break;
    }
}
function activateCustomBoost(multiplier, minutes) {
    // Сохраняем оригинальный доход
    if (!State.temp.originalProfit) {
        State.temp.originalProfit = State.game.profitPerTap;
    }
    
    // Увеличиваем доход
    State.game.profitPerTap *= multiplier;
    showToast(`🔥 x${multiplier} на ${minutes} минут!`);
    
    // Возвращаем обратно через N минут
    setTimeout(() => {
        State.game.profitPerTap = State.temp.originalProfit;
        State.temp.originalProfit = null;
        updateUI();
        showToast('⏰ Буст закончился');
    }, minutes * 60 * 1000);
    
    updateUI();
}

async function watchVideoForTask(taskId) {
    const task = VIDEO_TASKS.find(t => t.id === taskId);
    if (!task || task.completed || !task.available) return;
    
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама временно недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем видео...');
    
    try {
        await window.show_10655027();
        await claimVideoReward(task);
        
        task.completed = true;
        
        setTimeout(() => {
            task.available = true;
            task.completed = false;
            renderVideoTasks();
        }, 24 * 60 * 60 * 1000);
        
        renderVideoTasks();
        showToast('✅ Награда получена!');
        createConfetti();
        
    } catch (error) {
        console.error('Video error:', error);
        showToast('❌ Ошибка при просмотре видео', true);
    }
}

async function claimVideoReward(task) {
    switch(task.type) {
        case 'coins':
            State.game.coins += task.reward;
            break;
        case 'energy':
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 50);
            break;
        case 'boost':
            activateMegaBoost();
            break;
        case 'chest':
            const randomReward = Math.floor(Math.random() * 4500) + 500;
            State.game.coins += randomReward;
            showToast(`🎁 +${randomReward} монет!`);
            break;
        case 'refresh':
            VIDEO_TASKS.forEach(t => {
                t.completed = false;
                t.available = true;
            });
            break;
    }
    
    updateUI();
    
    if (userId) {
        await fetch(`${CONFIG.API_URL}/api/ad-watched`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, reward_type: task.type })
        }).catch(() => {});
    }
}

// ==================== РЕФЕРАЛЫ ====================
async function loadReferralData() {
    if (!userId) return;
    try {
        const link = `https://t.me/Ryoho_bot?start=ref_${userId}`;
        const linkEl = document.getElementById('referral-link');
        if (linkEl) linkEl.textContent = link;

        const data = await API.get(`/api/referral-data/${userId}`);
        
        document.getElementById('referral-count').textContent = data.count || 0;
        document.getElementById('referral-earnings').textContent = data.earnings || 0;
        
        State.skins.friendsInvited = data.count || 0;
    } catch (err) {
        console.error('Referral error:', err);
    }
}

function copyReferralLink() {
    const linkEl = document.getElementById('referral-link');
    if (!linkEl?.textContent || linkEl.textContent === 'loading...') {
        showToast('❌ Ссылка не загружена', true);
        return;
    }
    navigator.clipboard?.writeText(linkEl.textContent)
        .then(() => showToast('✅ Ссылка скопирована!'))
        .catch(() => showToast('❌ Ошибка копирования', true));
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
    if (State.settings.theme === 'night') document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
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
    if (tab === 'tournament') loadTournamentData();
    if (tab === 'tasks') loadVideoTasks();
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

// ==================== ТУРНИР ====================
let tournamentTimer = null;

async function loadTournamentData() {
    try {
        const leaderboardRes = await fetch(`${CONFIG.API_URL}/api/tournament/leaderboard`);
        const leaderboardData = await leaderboardRes.json();
        
        const rankRes = await fetch(`${CONFIG.API_URL}/api/tournament/player-rank/${userId}`);
        const rankData = await rankRes.json();
        
        if (leaderboardData.success) {
            renderLeaderboard({
                players: leaderboardData.players,
                playerRank: rankData.rank,
                playerScore: rankData.score,
                timeLeft: leaderboardData.time_left
            });
            startTournamentTimer(leaderboardData.time_left);
        }
    } catch (err) {
        console.error('Tournament error:', err);
    }
}

function renderLeaderboard(data) {
    const list = document.getElementById('leaderboard-list');
    const playerRankEl = document.getElementById('player-rank');
    const playerScoreEl = document.getElementById('player-score');
    
    if (list) {
        list.innerHTML = data.players.map(p => `
            <div class="leaderboard-item">
                <span class="player-rank">${p.rank}</span>
                <div class="player-avatar">
                    <img src="${p.avatar || '/imgg/default_avatar.png'}" 
                         alt="avatar"
                         onerror="this.src='/imgg/default_avatar.png'"
                         style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                </div>
                <span class="player-name">${p.name || 'Player'}</span>
                <span class="player-score">${formatNumber(p.score)}</span>
            </div>
        `).join('');
    }
    
    if (playerRankEl) playerRankEl.textContent = `#${data.playerRank || 0}`;
    if (playerScoreEl) playerScoreEl.textContent = formatNumber(data.playerScore || 0);
}

function startTournamentTimer(seconds) {
    if (tournamentTimer) clearInterval(tournamentTimer);
    
    const timerEl = document.getElementById('tournament-timer');
    if (!timerEl) return;
    
    let remaining = seconds;
    
    tournamentTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(tournamentTimer);
            timerEl.textContent = 'Турнир завершен';
            loadTournamentData();
            return;
        }
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const secs = remaining % 60;
        timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
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
            <p>Посмотри рекламу и получи +50 энергии</p>
            <button class="btn-primary" onclick="recoverEnergyWithAd()">
                📺 Смотреть рекламу
            </button>
            <button class="btn-secondary" onclick="this.closest('.energy-recovery-modal').remove()">
                ⏳ Подождать
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

async function recoverEnergyWithAd() {
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();

    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }

    showToast('📺 Загружаем рекламу...');

    try {
        await window.show_10655027();

        const res = await fetch(`${CONFIG.API_URL}/api/update-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (typeof data.energy === 'number') {
            State.game.energy = data.energy;
        }
        if (typeof data.max_energy === 'number') {
            State.game.maxEnergy = data.max_energy;
        }

        updateUI();
        showToast('⚡ Энергия восстановлена!');
    } catch (err) {
        console.error('Energy recover error:', err);
        showToast('❌ Ошибка восстановления энергии', true);
    }
}

// ==================== MEGA BOOST ====================
let boostEndTime = null;
let boostInterval = null;

function activateMegaBoost() {
    if (!userId) {
        showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    const boostBtn = document.getElementById('mega-boost-btn');
    if (boostBtn?.classList.contains('active')) {
        showToast('⚡ Буст уже активен!', true);
        return;
    }
    
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    window.show_10655027()
        .then(() => {
            const expiresAt = new Date(Date.now() + 3 * 60 * 1000);
            
            if (boostBtn) boostBtn.classList.add('active');
            
            const timerEl = document.getElementById('mega-boost-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = '3:00';
            }
            
            showBoostIndicator();
            
            const energyBar = document.querySelector('.energy-bar-bg');
            if (energyBar) energyBar.classList.add('boost-active');
            
            if (boostInterval) clearInterval(boostInterval);
            boostInterval = setInterval(() => {
                const now = new Date();
                const diff = expiresAt - now;
                
                if (diff <= 0) {
                    clearInterval(boostInterval);
                    if (boostBtn) boostBtn.classList.remove('active');
                    if (timerEl) timerEl.style.display = 'none';
                    document.querySelector('.mega-boost-indicator')?.remove();
                    if (energyBar) energyBar.classList.remove('boost-active');
                    showToast('⏰ Буст закончился');
                    return;
                }
                
                const mins = Math.floor(diff / 60000);
                const secs = Math.floor((diff % 60000) / 1000);
                if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            }, 1000);
            
            showToast('🔥 БУСТ АКТИВИРОВАН НА 3 МИНУТЫ!');
            
            fetch(`${CONFIG.API_URL}/api/activate-mega-boost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            }).catch(() => {});
        })
        .catch(() => showToast('❌ Ошибка при показе рекламы', true));
}

function showBoostIndicator() {
    const oldIndicator = document.querySelector('.mega-boost-indicator');
    if (oldIndicator) oldIndicator.remove();
    
    const energyContainer = document.querySelector('.energy-bar-container');
    if (energyContainer) {
        const indicator = document.createElement('div');
        indicator.className = 'mega-boost-indicator';
        indicator.innerHTML = '🔥 MEGA BOOST ACTIVE 🔥';
        energyContainer.appendChild(indicator);
    }
}

async function checkBoostStatus() {
    if (!userId) return;
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/mega-boost-status/${userId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.active) {
                boostEndTime = new Date(data.expires_at);
                const boostBtn = document.getElementById('mega-boost-btn');
                if (boostBtn) boostBtn.classList.add('active');
                
                const timerEl = document.getElementById('mega-boost-timer');
                if (timerEl) timerEl.style.display = 'block';
                
                showBoostIndicator();
                
                const energyBar = document.querySelector('.energy-bar-bg');
                if (energyBar) energyBar.classList.add('boost-active');
                
                if (boostInterval) clearInterval(boostInterval);
                boostInterval = setInterval(() => {
                    const now = new Date();
                    const diff = boostEndTime - now;
                    
                    if (diff <= 0) {
                        clearInterval(boostInterval);
                        if (boostBtn) boostBtn.classList.remove('active');
                        if (timerEl) timerEl.style.display = 'none';
                        document.querySelector('.mega-boost-indicator')?.remove();
                        if (energyBar) energyBar.classList.remove('boost-active');
                        return;
                    }
                    
                    const mins = Math.floor(diff / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
                }, 200);
            }
        }
    } catch (err) {
        console.error('Boost status error:', err);
    }
}

// ==================== МИНИ-ИГРЫ ====================
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

async function playCoinflip() {
    const betInput = document.getElementById('coin-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (bet > State.game.coins) return showToast('❌ Недостаточно монет', true);
    if (bet < 10) return showToast('❌ Минимальная ставка 10', true);

    const resultEl = document.getElementById('coin-result');
    const coin = document.getElementById('coin');
    
    resultEl.textContent = '🪙 Подбрасываем...';
    coin.classList.add('flipping');
    playSound('coinflip');
    
    setTimeout(async () => {
        if (userId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/game/coinflip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, bet })
                });
                
                const data = await res.json();
                coin.classList.remove('flipping');
                
                if (data.message.includes('won')) {
                    coin.classList.add('win');
                    setTimeout(() => coin.classList.remove('win'), 1000);
                    createConfetti();
                    playSound('win');
                } else playSound('lose');
                
                resultEl.textContent = data.message || '🎮 Сыграно!';
                State.game.coins = data.coins;
                State.achievements.games = (State.achievements.games || 0) + 1;
                checkAchievements();
                updateUI();
                
            } catch (err) {
                coin.classList.remove('flipping');
                resultEl.textContent = '❌ Ошибка сервера';
                showToast('❌ Ошибка', true);
            }
        } else {
            const win = Math.random() < 0.5;
            coin.classList.remove('flipping');
            if (win) {
                State.game.coins += bet;
                coin.classList.add('win');
                setTimeout(() => coin.classList.remove('win'), 1000);
                resultEl.textContent = '🦅 Вы выиграли! +' + bet;
                createConfetti();
                playSound('win');
            } else {
                State.game.coins -= bet;
                resultEl.textContent = '💀 Вы проиграли';
                playSound('lose');
            }
            updateUI();
        }
    }, 1500);
}

async function playSlots() {
    const betInput = document.getElementById('slots-bet');
    if (!betInput) return;
    
    const bet = parseInt(betInput.value);
    if (bet > State.game.coins) return showToast('❌ Недостаточно монет', true);
    if (bet < 10) return showToast('❌ Минимальная ставка 10', true);

    const resultEl = document.getElementById('slots-result');
    const slot1 = document.getElementById('slot1');
    const slot2 = document.getElementById('slot2');
    const slot3 = document.getElementById('slot3');
    
    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '⭐'];
    
    resultEl.textContent = '🎰 Крутим...';
    playSound('spin');
    
    let spins = 0;
    const maxSpins = 15;
    const spinInterval = setInterval(() => {
        slot1.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        slot2.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        slot3.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            if (userId) {
                fetch(`${CONFIG.API_URL}/api/game/slots`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, bet })
                })
                .then(res => res.json())
                .then(data => {
                    slot1.textContent = data.slots[0];
                    slot2.textContent = data.slots[1];
                    slot3.textContent = data.slots[2];
                    resultEl.textContent = data.message;
                    
                    if (data.message.includes('JACKPOT') || data.message.includes('won')) {
                        playSound('win');
                        createConfetti();
                    } else playSound('lose');
                    
                    State.game.coins = data.coins;
                    updateUI();
                })
                .catch(() => {
                    resultEl.textContent = '❌ Ошибка';
                    playSound('lose');
                });
            } else {
                const s1 = symbols[Math.floor(Math.random() * symbols.length)];
                const s2 = symbols[Math.floor(Math.random() * symbols.length)];
                const s3 = symbols[Math.floor(Math.random() * symbols.length)];
                
                slot1.textContent = s1;
                slot2.textContent = s2;
                slot3.textContent = s3;
                
                if (s1 === s2 && s2 === s3) {
                    const win = bet * 5;
                    State.game.coins += win;
                    State.achievements.games = (State.achievements.games || 0) + 1;
                    resultEl.textContent = '🎰 ДЖЕКПОТ! +' + win;
                    playSound('win');
                    createConfetti();
                    checkAchievements();
                } else {
                    State.game.coins -= bet;
                    resultEl.textContent = '🎰 Повезет в следующий раз';
                    playSound('lose');
                }
                updateUI();
            }
        }
    }, 100);
}

async function playDice() {
    const betInput = document.getElementById('dice-bet');
    const predSelect = document.getElementById('dice-prediction');
    
    if (!betInput || !predSelect) return;
    
    const bet = parseInt(betInput.value);
    const pred = predSelect.value;
    
    if (bet > State.game.coins) return showToast('❌ Недостаточно монет', true);
    if (bet < 10) return showToast('❌ Минимальная ставка 10', true);

    const resultEl = document.getElementById('dice-result');
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    
    const diceFaces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    
    resultEl.textContent = '🎲 Бросаем...';
    playSound('dice');
    
    let spins = 0;
    const maxSpins = 12;
    
    const spinInterval = setInterval(() => {
        dice1.textContent = diceFaces[Math.floor(Math.random() * 6)];
        dice2.textContent = diceFaces[Math.floor(Math.random() * 6)];
        spins++;
        
        if (spins >= maxSpins) {
            clearInterval(spinInterval);
            
            if (userId) {
                fetch(`${CONFIG.API_URL}/api/game/dice`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, bet, prediction: pred })
                })
                .then(res => res.json())
                .then(data => {
                    dice1.textContent = diceFaces[data.dice1 - 1];
                    dice2.textContent = diceFaces[data.dice2 - 1];
                    resultEl.textContent = data.message;
                    
                    if (data.message.includes('won')) {
                        createConfetti();
                        playSound('win');
                    } else playSound('lose');
                    
                    State.game.coins = data.coins;
                    updateUI();
                })
                .catch(() => {
                    resultEl.textContent = '❌ Ошибка';
                    playSound('lose');
                });
            } else {
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const sum = d1 + d2;
                
                dice1.textContent = diceFaces[d1 - 1];
                dice2.textContent = diceFaces[d2 - 1];
                
                let win = false;
                if (pred === '7' && sum === 7) win = true;
                if (pred === 'even' && sum % 2 === 0) win = true;
                if (pred === 'odd' && sum % 2 === 1) win = true;
                
                if (win) {
                    const multiplier = pred === '7' ? 5 : 2;
                    State.game.coins += bet * multiplier;
                    resultEl.textContent = `🎲 Вы выиграли! x${multiplier}`;
                    playSound('win');
                } else {
                    State.game.coins -= bet;
                    resultEl.textContent = '🎲 Вы проиграли';
                    playSound('lose');
                }
                updateUI();
            }
        }
    }, 70);
}

async function playWheel() {
    try {
        const betInput = document.getElementById('wheel-bet');
        if (!betInput) return showToast('❌ Элемент ставки не найден', true);
        
        const bet = parseInt(betInput.value);
        const betType = document.getElementById('wheel-color')?.value;
        const betNumber = document.getElementById('wheel-number')?.value;
        
        if (isNaN(bet) || bet < 10) return showToast('❌ Минимальная ставка 10', true);
        if (bet > State.game.coins) return showToast('❌ Недостаточно монет', true);

        const resultEl = document.getElementById('wheel-result');
        const wheel = document.getElementById('wheel');
        
        if (!resultEl || !wheel) return showToast('❌ Ошибка интерфейса', true);
        
        resultEl.textContent = '🎡 Крутим...';
        playSound('spin');
        
        let spins = 0;
        const maxSpins = 20;
        
        const spinInterval = setInterval(() => {
            wheel.textContent = Math.floor(Math.random() * 37);
            spins++;
            
            if (spins >= maxSpins) {
                clearInterval(spinInterval);
                
                if (userId) {
                    fetch(`${CONFIG.API_URL}/api/game/roulette`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: userId,
                            bet: bet,
                            bet_type: betType,
                            bet_value: betType === 'number' ? parseInt(betNumber) : null
                        })
                    })
                    .then(res => res.json())
                    .then(data => {
                        wheel.textContent = data.result_number;
                        
                        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                        if (data.result_number === 0) wheel.style.color = '#2ecc71';
                        else if (redNumbers.includes(data.result_number)) wheel.style.color = '#e74c3c';
                        else wheel.style.color = '#95a5a6';
                        
                        resultEl.textContent = data.message || '🎮 Сыграно!';
                        
                        if (data.message?.includes('won')) {
                            createConfetti();
                            playSound('win');
                        } else playSound('lose');
                        
                        State.game.coins = data.coins;
                        updateUI();
                    })
                    .catch(err => {
                        console.error('Roulette error:', err);
                        resultEl.textContent = '❌ Ошибка сервера';
                        playSound('lose');
                    });
                } else {
                    const result = Math.floor(Math.random() * 37);
                    wheel.textContent = result;
                    
                    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                    if (result === 0) wheel.style.color = '#2ecc71';
                    else if (redNumbers.includes(result)) wheel.style.color = '#e74c3c';
                    else wheel.style.color = '#95a5a6';
                    
                    let win = false;
                    if (betType === 'red' && redNumbers.includes(result)) win = true;
                    if (betType === 'black' && result !== 0 && !redNumbers.includes(result)) win = true;
                    if (betType === 'green' && result === 0) win = true;
                    if (betType === 'number' && result === parseInt(betNumber)) win = true;
                    
                    if (win) {
                        const multiplier = betType === 'number' || betType === 'green' ? 35 : 2;
                        State.game.coins += bet * multiplier;
                        resultEl.textContent = `🎡 Вы выиграли! x${multiplier}`;
                        playSound('win');
                    } else {
                        State.game.coins -= bet;
                        resultEl.textContent = '🎡 Вы проиграли';
                        playSound('lose');
                    }
                    updateUI();
                }
            }
        }, 100);
        
    } catch (err) {
        console.error('Roulette error:', err);
        showToast('❌ Ошибка', true);
    }
}

// ==================== КОНФЕТТИ ====================
function createConfetti(container = document.body) {
    const targetContainer = container || document.body;
    const rect = targetContainer.getBoundingClientRect();
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            const left = rect.left + Math.random() * rect.width;
            const top = rect.top - 10;
            
            confetti.style.cssText = `
                position: fixed;
                left: ${left}px;
                top: ${top}px;
                width: 8px;
                height: 8px;
                background: ${['#7F49B4', '#FFD700', '#FF6B6B', '#4ECDC4'][Math.floor(Math.random() * 4)]};
                border-radius: 50%;
                pointer-events: none;
                z-index: 20000;
                animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
                box-shadow: 0 0 10px currentColor;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
    }
}

const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
        }
    }
`;
document.head.appendChild(confettiStyle);

// ==================== ЗВУКИ ====================
function playSound(type) {
    if (!State.settings.sound) return;
    
    try {
        if (!window.audioCtx) window.audioCtx = new AudioContext();
        const now = window.audioCtx.currentTime;
        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(window.audioCtx.destination);
        
        switch(type) {
            case 'win':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                break;
            case 'lose':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                break;
            case 'spin':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.exponentialRampToValueAtTime(600, now + 0.5);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                break;
            case 'dice':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, now);
                for (let i = 0; i < 5; i++) {
                    osc.frequency.setValueAtTime(200 + i * 100, now + i * 0.1);
                }
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                break;
        }
        
        osc.start(now);
        osc.stop(now + 0.6);
    } catch (err) {}
}

// ==================== АЧИВКИ ====================
function openAchievements() {
    renderAchievements();
    openModal('achievements-screen');
}

function renderAchievements() {
    const list = document.getElementById('achievements-list');
    if (!list) return;
    
    const stats = {
        clicks: State.achievements.clicks || 0,
        upgrades: State.achievements.upgrades || 0,
        games: State.achievements.games || 0,
        referrals: State.skins.friendsInvited || 0,
        adsWatched: State.skins.adsWatched || 0
    };
    
    list.innerHTML = ACHIEVEMENTS.map(achievement => {
        const completed = State.achievements.completed.includes(achievement.id);
        
        let current = 0, total = 0, percent = 0;
        if (achievement.id.includes('click')) {
            current = stats.clicks;
            total = parseInt(achievement.id.split('_')[1]);
            percent = Math.min(100, (current / total) * 100);
        } else if (achievement.id === 'upgrade_10') {
            current = stats.upgrades;
            total = 10;
            percent = Math.min(100, (current / 10) * 100);
        } else if (achievement.id === 'games_10') {
            current = stats.games;
            total = 10;
            percent = Math.min(100, (current / 10) * 100);
        } else if (achievement.id === 'referral_5') {
            current = stats.referrals;
            total = 5;
            percent = Math.min(100, (current / 5) * 100);
        }
        
        return `
            <div class="achievement-item ${completed ? 'completed' : ''}">
                <div class="achievement-icon ${completed ? 'completed' : ''}">${achievement.icon}</div>
                <div class="achievement-info">
                    <h3>${achievement.title}</h3>
                    <p>${achievement.description}</p>
                    ${!completed ? `
                        <div class="achievement-progress-bar">
                            <div class="achievement-progress-fill" style="width: ${percent}%"></div>
                        </div>
                        <div class="achievement-progress-text">${current}/${total}</div>
                    ` : `<div class="achievement-reward">✅ +${achievement.reward}</div>`}
                </div>
                ${completed ? '<div class="achievement-check">✓</div>' : ''}
            </div>
        `;
    }).join('');
    
    updateAchievementsProgress();
}

function updateAchievementsProgress() {
    const completed = State.achievements.completed.length;
    const total = ACHIEVEMENTS.length;
    const percent = (completed / total) * 100;
    
    document.getElementById('achievements-completed').textContent = completed;
    document.getElementById('achievements-total').textContent = total;
    document.getElementById('achievements-progress-fill').style.width = percent + '%';
}

// ==================== ОБРАБОТЧИК КЛИКОВ ====================
function setupGlobalClickHandler() {
    document.removeEventListener('click', handleTap);
    document.removeEventListener('touchstart', handleTap);
    
    document.addEventListener('click', function(e) {
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content')) return;
        handleTap(e);
    });
    
    document.addEventListener('touchstart', function(e) {
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content')) return;
        handleTap(e);
    }, { passive: false });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spirit Clicker starting...');
    
    loadSettings();
    
    if (userId) {
        await loadUserData();
        startPerfectEnergySystem();
        await loadReferralData();
        setInterval(sendClickBatch, 14000);
    } else {
        const saved = localStorage.getItem('ryohoGame');
        if (saved) Object.assign(State.game, JSON.parse(saved));
        updateUI();
    }
    
    setupGlobalClickHandler();
    setInterval(() => localStorage.setItem('ryohoGame', JSON.stringify(State.game)), 10000);
    setInterval(checkOfflinePassiveIncome, CONFIG.PASSIVE_INCOME_INTERVAL);
    applySavedSkin();
    
    console.log('✅ Spirit Clicker ready');
});

// ==================== ПАССИВНЫЙ ДОХОД ====================
const checkOfflinePassiveIncome = async () => {
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
                showToast(data.message);
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    }
};


async function testReferral() {
    if (!userId) {
        console.log('❌ Нет userId');
        return;
    }
    
    const testReferrerId = 123456789; // Чужой тестовый ID
    console.log('🧪 Тест: отправляем регистрацию с referrer_id=', testReferrerId);
    
    try {
        const res = await API.post('/api/register', {
            user_id: userId,
            username: username + '_test',
            referrer_id: testReferrerId
        });
        console.log('✅ Результат теста:', res);
        
        // Проверяем, обновились ли данные реферера
        const referrerData = await API.get(`/api/user/${testReferrerId}`);
        console.log('📊 Данные тестового реферера:', referrerData);
        
    } catch (err) {
        console.error('❌ Ошибка теста:', err);
    }
}

// 👇 ВАЖНО: Делаем функцию глобальной
window.testReferral = testReferral;

// ==================== ЭКСПОРТ ====================
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
window.showToast = showToast;
window.playCoinflip = playCoinflip;
window.playSlots = playSlots;
window.playDice = playDice;
window.playWheel = playWheel;
window.State = State;
window.state = State;
window.startPerfectEnergySystem = startPerfectEnergySystem;
window.forceSync = forceSync;
window.sendClickBatch = sendClickBatch;
window.syncEnergyWithServer = syncEnergyWithServer;
window.fullSyncWithServer = fullSyncWithServer;
window.recoverEnergyWithAd = recoverEnergyWithAd;
window.openAchievements = openAchievements;
window.watchVideoForTask = watchVideoForTask;
window.recoverEnergyWithAd = recoverEnergyWithAd;
window.checkBoostStatus = checkBoostStatus;
window.closeSkinDetail = closeSkinDetail;
window.openSkinDetail = openSkinDetail;
window.unlockSkinFromDetail = unlockSkinFromDetail;
window.selectSkinFromDetail = selectSkinFromDetail;

console.log('✅ Все функции определены');