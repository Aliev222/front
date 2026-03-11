// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
window.API_URL = 'https://ryoho.onrender.com';
window.recoveryInterval = null;

'use strict';

console.log('🚀 game.js загружен', new Date().toLocaleTimeString());

// ==================== КОНФИГУРАЦИЯ ====================
const CONFIG = {
    API_URL: window.API_URL,
    CLICK_BATCH_INTERVAL: 1000,
    ENERGY_RECHARGE_INTERVAL: window.ENERGY_RECOVERY_INTERVAL,
    PASSIVE_INCOME_INTERVAL: 3600000,
    CACHE_TTL: 30000
};

// Делаем CONFIG глобальным
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

const iframe = document.querySelector('iframe');
if (iframe) {
    // Достаем State из iframe
    const gameState = iframe.contentWindow.State;
    console.log('State из iframe:', gameState);
    console.log('State.game.energy:', gameState?.game?.energy);
    
    // Теперь можно работать с функциями игры
    console.log('recoverEnergy есть?', typeof iframe.contentWindow.recoverEnergy);
    console.log('handleTap есть?', typeof iframe.contentWindow.handleTap);
    
    // Вызываем функцию восстановления
    if (iframe.contentWindow.recoverEnergy) {
        console.log('Вызываем recoverEnergy()...');
        iframe.contentWindow.recoverEnergy();
    }
} else {
    console.log('Iframe не найден');
}

// ==================== СОСТОЯНИЕ (ОДНО!) ====================
const State = {
    user: { 
        id: userId, 
        username, 
        referrerId 
    },
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
    },     
    cache: new Map()

    
};


// Глобальный доступ
window.State = State;
window.state = State;
window.State = State;
console.log('✅ window.State создан:', window.State);


let currentFilter = 'all';

// ==================== ЛОКАЛЬНЫЕ СКИНЫ (ЗАГЛУШКА) ====================
function getLocalSkins() {
    return [
        // Обычные (7 шт) - за уровень
        { id: 'skin_lvl_1', name: 'Начинающий спирикс', image: 'imgg/skins/default_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.1 }, requirement: { type: 'level', value: 1 } },
        { id: 'skin_lvl_2', name: 'Опытный спирикс', image: 'imgg/skins/Coin_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'level', value: 10 } },
        { id: 'skin_lvl_3', name: 'Мастер спирикс', image: 'imgg/skins/Galaxy_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'level', value: 25 } },
        { id: 'skin_lvl_4', name: 'Элитный спирикс', image: 'imgg/skins/King_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.4 }, requirement: { type: 'level', value: 50 } },
        { id: 'skin_lvl_5', name: 'Легендарный спирикс', image: 'imgg/skins/Monster_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'level', value: 75 } },
        { id: 'skin_lvl_6', name: 'Мифический спирикс', image: 'imgg/skins/Ninja_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 1.6 }, requirement: { type: 'level', value: 100 } },
        { id: 'skin_lvl_7', name: 'Божественный спирикс', image: 'imgg/skins/Shadow_SP.png', rarity: 'common', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'level', value: 150 } },
        
        // За видео (6 шт)
        { id: 'skin_video_1', name: 'Звездный спирикс', image: 'imgg/skins/Techno_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'ads', count: 1 } },
        { id: 'skin_video_2', name: 'Космический спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'ads', count: 5 } },
        { id: 'skin_video_3', name: 'Галактический спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.4 }, requirement: { type: 'ads', count: 10 } },
        { id: 'skin_video_4', name: 'Небесный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'ads', count: 20 } },
        { id: 'skin_video_5', name: 'Божественный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.75 }, requirement: { type: 'ads', count: 50 } },
        { id: 'skin_video_6', name: 'Всемогущий спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'ads', count: 100 } },
        
        // За друзей (6 шт)
        { id: 'skin_friend_1', name: 'Дружный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.1 }, requirement: { type: 'friends', count: 1 } },
        { id: 'skin_friend_2', name: 'Популярный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.2 }, requirement: { type: 'friends', count: 3 } },
        { id: 'skin_friend_3', name: 'Известный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'rare', bonus: { type: 'multiplier', value: 1.3 }, requirement: { type: 'friends', count: 5 } },
        { id: 'skin_friend_4', name: 'Звездный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.5 }, requirement: { type: 'friends', count: 10 } },
        { id: 'skin_friend_5', name: 'Легендарный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'legendary', bonus: { type: 'multiplier', value: 1.75 }, requirement: { type: 'friends', count: 20 } },
        { id: 'skin_friend_6', name: 'Император спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'super', bonus: { type: 'multiplier', value: 2.0 }, requirement: { type: 'friends', count: 50 } },
        
        // За ссылку (1 шт)
        { id: 'skin_cpa_1', name: 'Тайный спирикс', image: 'imgg/skins/Water_SP.png', rarity: 'super', bonus: { type: 'multiplier', value: 2.5 }, requirement: { type: 'link', url: 'https://example.com' } }
    ];
}


// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
const formatNumber = (num) => {
    num = Math.floor(num);
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toString();
};

const showToast = (msg, isError = false) => {
    // Удаляем предыдущий тост если есть
    const oldToast = document.querySelector('.toast-message');
    if (oldToast) oldToast.remove();
    
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
        white-space: nowrap;
        pointer-events: none;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

// Стили для тостов (добавляем один раз)
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes toastFade {
            0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
            10% { opacity: 1; transform: translateX(-50%) translateY(0); }
            90% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
    `;
    document.head.appendChild(style);
}

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
            // Достижение выполнено!
            State.achievements.completed.push(achievement.id);
            State.game.coins += achievement.reward;
            showAchievementNotification(achievement);
            updateUI();
        }
    });
}

function showAchievementNotification(achievement) {
    const notif = document.createElement('div');
    notif.className = 'achievement-notification';
    notif.innerHTML = `
        <div class="achievement-icon">${achievement.icon}</div>
        <div class="achievement-info">
            <div class="achievement-title">🏆 Достижение!</div>
            <div class="achievement-name">${achievement.title}</div>
            <div class="achievement-reward">+${achievement.reward} монет</div>
        </div>
    `;
    document.body.appendChild(notif);
    
    setTimeout(() => notif.classList.add('show'), 100);
    setTimeout(() => notif.remove(), 5000);
    
    // Звук достижения
    playAchievementSound();
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
        await loadTasks();
        
        applySavedSkin();
        updateUI();
        
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

async function loadSkinsList() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/skins/list`);
        if (res.ok) {
            const data = await res.json();
            State.skins.data = data.skins || [];
            console.log('✅ Скины загружены с сервера:', State.skins.data);
        } else {
            console.warn('⚠️ Сервер не ответил, использую локальные скины');
            State.skins.data = getLocalSkins();  // ← ОДНА СТРОКА!
        }
    } catch (err) {
        console.error('❌ Ошибка загрузки скинов:', err);
        State.skins.data = getLocalSkins();  // ← ОДНА СТРОКА!
    }
    
    // Добавляем текущий прогресс
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


// ==================== ИДЕАЛЬНАЯ ЭНЕРГИЯ ====================
function startEnergyRecovery() {
    console.log('⚡ Запуск идеальной системы энергии');
    
    // Очищаем старые таймеры
    if (State.temp.animationTimer) clearInterval(State.temp.animationTimer);
    if (State.temp.syncTimer) clearInterval(State.temp.syncTimer);
    
    // Буфер для синхронизации
    State.temp.energyBuffer = 0;
    
    // === ТАЙМЕР 1: Плавная анимация (каждую секунду) ===
    State.temp.animationTimer = setInterval(() => {
        // Не восстанавливаем при Mega Boost
        if (document.getElementById('mega-boost-btn')?.classList.contains('active')) {
            return;
        }
        
        // Если энергия не полная - добавляем 1 (локально)
        if (State.game.energy < State.game.maxEnergy) {
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
            
            // Обновляем UI
            updateUI();
            
            // Копим для отправки на сервер
            State.temp.energyBuffer++;
            
            console.log(`⚡ Локально +1 → ${State.game.energy} (буфер: ${State.temp.energyBuffer})`);
        }
    }, 1000); // Каждую секунду!
    
    // === ТАЙМЕР 2: Синхронизация с сервером (раз в 15 секунд) ===
    State.temp.syncTimer = setInterval(() => {
        if (!userId) return; // Офлайн режим
        
        syncEnergyWithServer();
        
    }, 15000); // 15 секунд
}

// Новая функция синхронизации с сервером
async function syncEnergyWithServer() {
    if (!userId) return;
    
    console.log(`📤 Синхронизация энергии: буфер=${State.temp.energyBuffer}, текущая=${State.game.energy}`);
    
    try {
        const res = await fetch(`${API_URL}/api/sync-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                energy: State.game.energy,
                gained: State.temp.energyBuffer || 0
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            const oldEnergy = State.game.energy;
            State.game.energy = data.energy;
            
            console.log(`⚡ Синхронизация: ${oldEnergy} → ${State.game.energy}`);
            
            // Буфер сброшен (сервер учёл всё)
            State.temp.energyBuffer = 0;
            
            updateUI();
        } else {
            console.error('Ошибка синхронизации энергии');
        }
    } catch (e) {
        console.error('Energy sync error:', e);
        // Не сбрасываем буфер - попробуем в следующий раз
    }
}

// Полная синхронизация (раз в минуту для страховки)
async function fullSyncWithServer() {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/user/${userId}`);
        if (res.ok) {
            const data = await res.json();
            
            // Для энергии берём МАКСИМУМ
            const oldEnergy = State.game.energy;
            State.game.energy = Math.max(State.game.energy, data.energy);
            State.game.energy = Math.min(State.game.energy, data.max_energy);
            
            // Монеты берём с сервера (они точнее)
            State.game.coins = data.coins;
            
            if (oldEnergy !== State.game.energy) {
                console.log(`🔄 Полная синхронизация: энергия скорректирована ${oldEnergy} → ${State.game.energy}`);
            }
            
            updateUI();
        }
    } catch (e) {
        console.error('Full sync error:', e);
    }
}

// Новая функция для запроса восстановления
async function requestEnergyRecovery() {
    if (!userId) {
        // Офлайн режим - восстанавливаем сами
        State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 3);
        updateUI();
        return;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/recover-energy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (res.ok) {
            const data = await res.json();
            const oldEnergy = State.game.energy;
            State.game.energy = data.energy;
            console.log(`⚡ Восстановление: ${oldEnergy} → ${State.game.energy} (+3 за 15 сек)`);
            updateUI();
        } else {
            console.error('Ошибка сервера при восстановлении энергии');
            // Если сервер не отвечает - восстанавливаем локально
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 3);
            updateUI();
        }
    } catch (e) {
        console.error('Energy recovery error:', e);
        // При ошибке - восстанавливаем локально
        State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 3);
        updateUI();
    }
}



// ==================== КЛИКИ ====================
let lastBatchTime = 0;

async function sendClickBatch() {
    const clicks = State.temp.clickBuffer;
    const gain = State.temp.gainBuffer;
    const megaBoost = document.getElementById('mega-boost-btn')?.classList.contains('active') || false;
    
    if (clicks === 0) return;
    
    console.log(`📤 Отправка кликов: ${clicks} кликов, +${gain} монет`);
    
    // Сбрасываем буфер ДО отправки (чтобы новые клики не попали в этот батч)
    State.temp.clickBuffer = 0;
    State.temp.gainBuffer = 0;
    
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/clicks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                clicks: clicks,
                gain: gain,
                mega_boost: megaBoost
            })
        });
        
        if (!res.ok) throw new Error('Server error');
        
        console.log('✅ Клики отправлены успешно');
        
    } catch (err) {
        console.log('❌ Ошибка отправки кликов, вернём в буфер');
        // Возвращаем в буфер
        State.temp.clickBuffer += clicks;
        State.temp.gainBuffer += gain;
    }
}

function handleTap(e) {
    // Предотвращаем стандартное поведение
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    // Игнорируем клики по кнопкам
    if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
        '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
        '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
        '.modal-screen, .modal-content, .game-modal, .game-modal-content')) {
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
    
    // Обновление достижений
    State.achievements.clicks = (State.achievements.clicks || 0) + 1;
    checkAchievements();
    
    // ОБНОВЛЕНИЕ ТУРНИРНОГО СЧЕТА
    State.temp.tournamentScore = State.game.coins;

    updateUI();

    // ========== АНИМАЦИЯ ==========
    
    const skinEffect = getSkinEffect(State.skins.selected);
    if (skinEffect && skinEffect.particleCount > 5) {
        // Дополнительные частицы для редких скинов
        for (let i = 0; i < skinEffect.particleCount; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                const angle = (i / skinEffect.particleCount) * Math.PI * 2;
                const distance = 30 + Math.random() * 30;
                
                particle.style.cssText = `
                    position: fixed;
                    left: ${clientX}px;
                    top: ${clientY}px;
                    width: 6px;
                    height: 6px;
                    background: ${skinEffect.particleColor[i % skinEffect.particleColor.length]};
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 9998;
                    box-shadow: 0 0 10px currentColor;
                    animation: skinParticle 1s ease-out forwards;
                `;
                
                // Устанавливаем переменные для анимации
                particle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
                particle.style.setProperty('--ty', Math.sin(angle) * distance - 20 + 'px');
                
                document.body.appendChild(particle);
                setTimeout(() => particle.remove(), 1000);
            }, i * 30);
        }
    }

    // Добавь стили для частиц
    const particleStyle = document.createElement('style');
    particleStyle.textContent = `
        @keyframes skinParticle {
            0% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }
            100% {
                opacity: 0;
                transform: translate(-50%, -50%) translate(var(--tx), var(--ty)) scale(0);
            }
        }
    `;
    document.head.appendChild(particleStyle);
    
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

    if (megaBoostActive) {
        // Добавляем дополнительные искры
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const spark = document.createElement('div');
                spark.style.cssText = `
                    position: fixed;
                    left: ${clientX + (Math.random() - 0.5) * 50}px;
                    top: ${clientY + (Math.random() - 0.5) * 50}px;
                    width: 4px;
                    height: 4px;
                    background: ${['#ffaa00', '#ff5500', '#ffff00'][Math.floor(Math.random() * 3)]};
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 9998;
                    animation: sparkFade 0.5s ease-out forwards;
                `;
                document.body.appendChild(spark);
                setTimeout(() => spark.remove(), 500);
            }, i * 50);
        }
    }

    // Добавь стиль для искр
    const sparkStyle = document.createElement('style');
    sparkStyle.textContent = `
        @keyframes sparkFade {
            0% { opacity: 1; transform: scale(1); }
            100% { opacity: 0; transform: scale(2) translateY(-20px); }
        }
    `;
    document.head.appendChild(sparkStyle);

    // ========== ЗВУК ==========
    if (State.settings.sound) {
        try {
            if (!window.audioCtx) {
                window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (window.audioCtx.state === 'suspended') {
                window.audioCtx.resume().catch(() => {});
            }
            
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

// ==================== СИНХРОНИЗАЦИЯ ====================
let syncTimer = null;
const SYNC_INTERVAL = 15000; // 15 секунд

async function forceSync() {
    console.log(`🔄 Синхронизация... кликов в буфере: ${State.temp.clickBuffer}`);
    
    // 1. Отправляем накопленные клики
    if (State.temp.clickBuffer > 0) {
        await sendClickBatch();
    }
    
    // 2. Запрашиваем актуальные данные с сервера
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/api/user/${userId}`);
            if (res.ok) {
                const data = await res.json();
                
                // ✅ Сохраняем старые значения
                const oldEnergy = State.game.energy;
                const oldCoins = State.game.coins;
                
                // ✅ Обновляем монеты (всегда берем с сервера)
                State.game.coins = data.coins;
                
                // ✅ ДЛЯ ЭНЕРГИИ: берем МАКСИМАЛЬНОЕ значение
                // (локальное восстановление + серверное)
                State.game.energy = Math.max(State.game.energy, data.energy);
                
                // ✅ Ограничиваем максимумом
                State.game.energy = Math.min(State.game.energy, data.max_energy);
                
                console.log(`⚡ Синхронизация: локальная=${oldEnergy}, сервер=${data.energy}, берем=${State.game.energy}`);
                
                updateUI();
            }
        } catch (e) {
            console.error('Sync error:', e);
        }
    }
}

function startSync() {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(forceSync, SYNC_INTERVAL);
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

function renderSkins() {
    const grid = document.getElementById('skins-grid');
    if (!grid) {
        console.error('❌ skins-grid не найден');
        return;
    }
    
    console.log('🎨 Рендерим скины:', State.skins.data);
    
    let filtered = State.skins.data;
    
    // Фильтрация по редкости
    if (currentFilter && currentFilter !== 'all') {
        filtered = filtered.filter(s => s.rarity === currentFilter);
    }
    
    if (!filtered || filtered.length === 0) {
        grid.innerHTML = '<div class="loading">Нет скинов</div>';
        return;
    }
    
    grid.innerHTML = filtered.map(skin => {
        
        // Проверяем, есть ли скин в owned

        const isOwned = State.skins.owned && State.skins.owned.includes(skin.id);
        const isSelected = State.skins.selected === skin.id;
        const isLocked = !isOwned;
        
        console.log(`🖼️ Скин ${skin.id}: owned=${isOwned}, selected=${isSelected}`);
        
        return `
            <div class="skin-card ${isLocked ? 'locked' : ''} ${isSelected ? 'selected' : ''}" 
                 data-id="${skin.id}">
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

    // Добавляем обработчики кликов на карточки
    document.querySelectorAll('.skin-card').forEach(card => {
        card.addEventListener('click', function(e) {
            const skinId = this.dataset.id;
            console.log('👆 Клик по скину:', skinId);
            openSkinDetail(skinId);
        });
    });
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
        showToast('❌ Ошибка выбора скина', true);
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
        showToast('❌ Ошибка разблокировки', true);
    }
}


function openSkins() {
    renderSkins();
    openModal('skins-screen');
}

function filterSkins(category, event) {
    console.log('🔍 Фильтр:', category);
    currentFilter = category;
    
    // Обновляем активную кнопку
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Добавляем active нажатую кнопку
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // Если event нет, ищем кнопку по тексту
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.textContent.toLowerCase().includes(category) || 
                (category === 'all' && btn.textContent === 'Все')) {
                btn.classList.add('active');
            }
        });
    }
    
    renderSkins();
}

function getSkinEffect(skinId) {
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) return null;
    
    // Эффекты в зависимости от редкости
    switch(skin.rarity) {
        case 'legendary':
            return {
                color: '#ffaa00',
                particleColor: ['#ffaa00', '#ff5500', '#ffff00'],
                particleCount: 15,
                sound: 'legendary'
            };
        case 'super':
            return {
                color: '#ff6b6b',
                particleColor: ['#ff6b6b', '#ff8e8e', '#ffb6b6'],
                particleCount: 10,
                sound: 'super'
            };
        case 'rare':
            return {
                color: '#4ecdc4',
                particleColor: ['#4ecdc4', '#6ed4cc', '#8edbd4'],
                particleCount: 8,
                sound: 'rare'
            };
        default:
            return {
                color: '#7F49B4',
                particleColor: ['#7F49B4', '#9b6bdf', '#b88ce8'],
                particleCount: 5,
                sound: 'common'
            };
    }
}

function playSkinSound(rarity) {
    if (!State.settings.sound) return;
    
    try {
        if (!window.audioCtx) {
            window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        const now = window.audioCtx.currentTime;
        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(window.audioCtx.destination);
        
        switch(rarity) {
            case 'legendary':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.setValueAtTime(1200, now + 0.05);
                osc.frequency.setValueAtTime(1600, now + 0.1);
                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                break;
            case 'super':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.setValueAtTime(900, now + 0.05);
                osc.frequency.setValueAtTime(1200, now + 0.1);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                break;
            case 'rare':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(400, now);
                osc.frequency.setValueAtTime(600, now + 0.05);
                osc.frequency.setValueAtTime(800, now + 0.1);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                break;
        }
        
        osc.start(now);
        osc.stop(now + 0.3);
    } catch (err) {}
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

    upgradeInProgress = true;
    
    for (const type of ['multitap', 'profit', 'energy']) {
        try {
            const result = await API.post('/api/upgrade', { user_id: userId, boost_type: type });
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
            }
        } catch (err) {}
    }
    
    upgradeInProgress = false;
    showToast('✅ Все улучшения куплены!');
    playUpgradeSound();
    checkAchievements();
    updateUI();
}

function renderTasks(tasks) {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    if (!tasks || tasks.length === 0) {
        container.innerHTML = `
            <div class="tasks-empty">
                <div class="tasks-empty-icon">📋</div>
                <div class="tasks-empty-text">Нет доступных заданий</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tasks.map(task => `
        <div class="task-card ${task.completed ? 'completed' : ''}">
            <div class="task-icon">${task.icon || '📋'}</div>
            <div class="task-info">
                <div class="task-title">${task.title || 'Задание'}</div>
                <div class="task-desc">${task.description || ''}</div>
                <div class="task-reward">🎁 ${task.reward || '0'}</div>
                ${task.progress !== undefined ? `
                    <div class="task-progress">
                        <div class="task-progress-bar">
                            <div class="task-progress-fill" style="width: ${(task.progress / task.total) * 100}%"></div>
                        </div>
                        <span class="task-progress-text">${task.progress}/${task.total}</span>
                    </div>
                ` : ''}
            </div>
            ${!task.completed ? `
                <button class="task-button" onclick="completeTask('${task.id}')">
                    Выполнить
                </button>
            ` : `
                <button class="task-button completed" disabled>✅ Выполнено</button>
            `}
        </div>
    `).join('');
}

function completeTask(taskId) {
    showToast(`✅ Задание выполнено!`);
    // Здесь можно добавить логику начисления награды
    loadTasks(); // Перезагружаем список задач
}

// Добавь функцию для загрузки задач (если ее нет)
async function loadTasks() {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    if (!userId) {
        container.innerHTML = '<div class="loading">Авторизуйтесь</div>';
        return;
    }
    
    try {
        // Пытаемся загрузить с сервера
        const data = await API.get(`/api/tasks/${userId}`).catch(() => null);
        
        if (data && data.length > 0) {
            renderTasks(data);
        } else {
            // Если сервер не отвечает - показываем заглушку
            const mockTasks = [
                {
                    id: 'daily_bonus',
                    title: '📅 Ежедневный бонус',
                    description: 'Заходи каждый день',
                    reward: '10000 монет',
                    icon: '📅',
                    completed: false
                },
                {
                    id: 'invite_friend',
                    title: '👥 Пригласи друга',
                    description: 'Пригласи 1 друга в игру',
                    reward: '5000 монет',
                    icon: '👥',
                    completed: false
                },
                {
                    id: 'watch_ad',
                    title: '📺 Посмотри рекламу',
                    description: 'Посмотри 3 рекламы',
                    reward: '15000 монет',
                    icon: '📺',
                    completed: false,
                    progress: 0,
                    total: 3
                }
            ];
            renderTasks(mockTasks);
        }
    } catch (err) {
        console.error('Tasks error:', err);
        container.innerHTML = '<div class="loading">Ошибка загрузки</div>';
    }
}

// Заглушка для выполнения задачи
function completeTask(taskId) {
    showToast(`✅ Задание "${taskId}" выполнено!`);
    loadTasks(); // Перезагружаем задачи
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
        
        State.skins.friendsInvited = data.count || 0;  // ✅ ЭТО ВАЖНО!
        
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
    if (State.settings.sound) {
        // Тестовый звук при включении
        try {
            const audio = new Audio();
            audio.volume = 0;
            audio.play().catch(() => {});
        } catch (e) {}
    }
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

function recoverEnergyWithAd() {
    // Закрываем модалку
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();
    
    // Проверяем рекламу
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    // Показываем рекламу
    window.show_10655027()
        .then(() => {
            // Начисляем энергию (+50)
            const oldEnergy = State.game.energy;
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 50);
            updateUI();
            
            // ✅ Отправляем на сервер
            if (userId) {
                fetch(`${API_URL}/api/update-energy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        user_id: userId, 
                        energy: State.game.energy 
                    })
                }).catch(() => {});
            }
            
            showToast(`⚡ +50 энергии! (${oldEnergy} → ${State.game.energy})`);
            
            // Эффект вспышки
            const energyBar = document.querySelector('.energy-bar-fill');
            if (energyBar) {
                energyBar.style.transition = 'all 0.3s ease';
                energyBar.style.filter = 'brightness(1.5)';
                setTimeout(() => energyBar.style.filter = 'none', 500);
            }
        })
        .catch((error) => {
            console.error('Ad error:', error);
            showToast('❌ Ошибка при показе рекламы', true);
        });
}

let tournamentTimer = null;

async function loadTournamentData() {
    try {
        // Загружаем таблицу лидеров
        const leaderboardRes = await fetch(`${CONFIG.API_URL}/api/tournament/leaderboard`);
        const leaderboardData = await leaderboardRes.json();
        
        // Загружаем ранг игрока
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
        showToast('❌ Ошибка загрузки турнира', true);
        
        // Заглушка на случай ошибки
        const mockData = {
            players: [
                { rank: 1, name: 'CryptoKing', score: 157890 },
                { rank: 2, name: 'SpiritMaster', score: 143200 },
                { rank: 3, name: 'ClickerPro', score: 128450 },
                { rank: 4, name: 'CoinHunter', score: 112300 },
                { rank: 5, name: 'TapLegend', score: 98700 }
            ],
            playerRank: 42,
            playerScore: State.game.coins,
            timeLeft: 86399
        };
        renderLeaderboard(mockData);
        startTournamentTimer(mockData.timeLeft);
    }
}

// Функция для обновления счета в турнире (вызывать при кликах)
async function updateTournamentScore(score) {
    if (!userId) return;
    
    try {
        // Отправляем обновленный счет на сервер
        await fetch(`${CONFIG.API_URL}/api/tournament/update-score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                user_id: userId, 
                score: score 
            })
        }).catch(() => {}); // Игнорируем ошибки, не критично
        
    } catch (err) {
        console.error('Tournament score update error:', err);
    }
}

function renderLeaderboard(data) {
    const list = document.getElementById('leaderboard-list');
    const playerRank = document.getElementById('player-rank');
    const playerScore = document.getElementById('player-score');
    
    if (list) {
        list.innerHTML = data.players.map(p => `
            <div class="leaderboard-item ${p.isMe ? 'current-player' : ''}">
                <span class="player-rank">${p.rank}</span>
                <span class="player-name">${p.name}</span>
                <span class="player-score">${formatNumber(p.score)}</span>
            </div>
        `).join('');
    }
    
    if (playerRank) playerRank.textContent = `#${data.playerRank}`;
    if (playerScore) playerScore.textContent = formatNumber(data.playerScore);
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
            loadTournamentData(); // Загружаем новый турнир
            return;
        }
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const secs = remaining % 60;
        
        timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
}

// ==================== ПАССИВНЫЙ ДОХОД ====================
// Пассивный доход - проверяем при загрузке и каждые 30 минут
const checkOfflinePassiveIncome = async () => {
    if (!userId) return;
    
    try {
        const res = await fetch(`${API_URL}/api/passive-income`, {
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
                // Анимация монеток
                playBonusAnimation();
            }
        }
    } catch (e) {
        console.error('Passive income error:', e);
    }
};

// Запускаем проверку при загрузке и каждые 30 минут
if (userId) {
    setTimeout(() => checkOfflinePassiveIncome(), 2000);
    setInterval(checkOfflinePassiveIncome, 30 * 60 * 1000);
}


function playUpgradeSound() {
    if (!State.settings.sound) return;
    
    try {
        if (!window.audioCtx) {
            window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.audioCtx.state === 'suspended') {
            window.audioCtx.resume();
        }
        
        const now = window.audioCtx.currentTime;
        
        // Фанфары апгрейда
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
    if (bet > State.game.coins) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    if (bet < 10) {
        showToast('❌ Минимальная ставка 10', true);
        return;
    }

    const resultEl = document.getElementById('coin-result');
    const coin = document.getElementById('coin');
    
    // Анимация подбрасывания
    resultEl.textContent = '🪙 Подбрасываем...';
    coin.classList.add('flipping');
    
    // Звук подбрасывания
    playSound('coinflip');
    
    setTimeout(async () => {
        if (userId) {
            try {
                const res = await fetch(`${CONFIG.API_URL}/api/game/coinflip`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, bet })
                });
                
                if (!res.ok) throw new Error('Server error');
                
                const data = await res.json();
                coin.classList.remove('flipping');
                
                // Анимация результата
                if (data.message.includes('won')) {
                    coin.classList.add('win');
                    setTimeout(() => coin.classList.remove('win'), 1000);
                    createConfetti();
                    playSound('win');
                } else {
                    playSound('lose');
                }
                
                resultEl.textContent = data.message || '🎮 Сыграно!';
                State.game.coins = data.coins;
                State.achievements.games = (State.achievements.games || 0) + 1;
                checkAchievements();
                updateUI();
                
            } catch (err) {
                console.error('Coinflip error:', err);
                coin.classList.remove('flipping');
                resultEl.textContent = '❌ Ошибка сервера';
                showToast('❌ Ошибка', true);
            }
        } else {
            // Локальная игра (без сервера)
            const win = Math.random() < 0.5;
            coin.classList.remove('flipping');
            
            if (win) {
                State.game.coins += bet;
                coin.classList.add('win');
                setTimeout(() => coin.classList.remove('win'), 1000);
                resultEl.textContent = '🦅 Вы выиграли! +' + bet;
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
    if (bet > State.game.coins) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    if (bet < 10) {
        showToast('❌ Минимальная ставка 10', true);
        return;
    }

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
                    
                    if (data.message.includes('JACKPOT')) {
                        playSound('win');
                        // Эффект конфетти
                        createConfetti();
                    } else if (data.message.includes('won')) {
                        playSound('win');
                    } else {
                        playSound('lose');
                    }
                    
                    State.game.coins = data.coins;
                    updateUI();
                })
                .catch(() => {
                    resultEl.textContent = '❌ Ошибка';
                    playSound('lose');
                });
            } else {
                // Локальная игра
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
    
    if (bet > State.game.coins) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    if (bet < 10) {
        showToast('❌ Минимальная ставка 10', true);
        return;
    }

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
                        playSound('win');
                        createConfetti();
                    } else {
                        playSound('lose');
                    }
                    
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

// Roulette
// Roulette
async function playWheel() {
    try {
        const betInput = document.getElementById('wheel-bet');
        if (!betInput) {
            showToast('❌ Элемент ставки не найден', true);
            return;
        }
        
        const bet = parseInt(betInput.value);
        const betType = document.getElementById('wheel-color')?.value;
        const betNumber = document.getElementById('wheel-number')?.value;
        
        if (isNaN(bet) || bet < 10) {
            showToast('❌ Минимальная ставка 10', true);
            return;
        }
        
        if (bet > State.game.coins) {
            showToast('❌ Недостаточно монет', true);
            return;
        }

        const resultEl = document.getElementById('wheel-result');
        const wheel = document.getElementById('wheel');
        
        if (!resultEl || !wheel) {
            showToast('❌ Ошибка интерфейса', true);
            return;
        }
        
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
                    .then(res => {
                        if (!res.ok) throw new Error('Server error');
                        return res.json();
                    })
                    .then(data => {
                        wheel.textContent = data.result_number;
                        
                        // Цвет результата
                        const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                        if (data.result_number === 0) {
                            wheel.style.color = '#2ecc71'; // зеленый
                        } else if (redNumbers.includes(data.result_number)) {
                            wheel.style.color = '#e74c3c'; // красный
                        } else {
                            wheel.style.color = '#95a5a6'; // серый
                        }
                        
                        resultEl.textContent = data.message || '🎮 Сыграно!';
                        
                        if (data.message?.includes('won')) {
                            playSound('win');
                            createConfetti();
                        } else {
                            playSound('lose');
                        }
                        
                        State.game.coins = data.coins;
                        updateUI();
                    })
                    .catch(err => {
                        console.error('Roulette error:', err);
                        resultEl.textContent = '❌ Ошибка сервера';
                        playSound('lose');
                    });
                } else {
                    // Локальная игра (без сервера)
                    const result = Math.floor(Math.random() * 37);
                    wheel.textContent = result;
                    
                    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
                    
                    if (result === 0) {
                        wheel.style.color = '#2ecc71';
                    } else if (redNumbers.includes(result)) {
                        wheel.style.color = '#e74c3c';
                    } else {
                        wheel.style.color = '#95a5a6';
                    }
                    
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

// Конфетти для джекпота
function createConfetti() {
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: fixed;
                left: ${Math.random() * 100}vw;
                top: -10px;
                width: 8px;
                height: 8px;
                background: hsl(${Math.random() * 360}, 100%, 50%);
                border-radius: 50%;
                pointer-events: none;
                z-index: 9999;
                animation: confettiFall ${Math.random() * 2 + 2}s linear forwards;
            `;
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 3000);
        }, i * 50);
    }
}

// Добавить стили для конфетти
const confettiStyle = document.createElement('style');
confettiStyle.textContent = `
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
        }
    }
`;
document.head.appendChild(confettiStyle);

// Универсальная функция звука для игр
function playSound(type) {
    if (!State.settings.sound) return;
    
    try {
        if (!window.audioCtx) {
            window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (window.audioCtx.state === 'suspended') {
            window.audioCtx.resume().catch(() => {});
        }
        
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
    
    // Проверяем рекламу
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    // Показываем рекламу
    window.show_10655027()
        .then(() => {
            showToast('✅ Реклама просмотрена! Активируем буст...');
            
            // Активируем буст ЛОКАЛЬНО (без сервера!)
            const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // +3 минуты
            
            // Визуальная активация
            if (boostBtn) boostBtn.classList.add('active');
            
            // Показываем таймер
            const timerEl = document.getElementById('mega-boost-timer');
            if (timerEl) {
                timerEl.style.display = 'block';
                timerEl.textContent = '3:00';
            }
            
            // Добавляем индикатор
            showBoostIndicator();
            
            // Добавляем эффект на energy bar
            const energyBar = document.querySelector('.energy-bar-bg');
            if (energyBar) {
                energyBar.classList.add('boost-active');
            }
            
            // Запускаем таймер
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
            
            // ОПЦИОНАЛЬНО: отправляем на сервер в фоне (не ждем ответа)
            fetch(`${CONFIG.API_URL}/api/activate-mega-boost`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            }).catch(() => {});
        })
        .catch((error) => {
            console.error('Ad error:', error);
            showToast('❌ Ошибка при показе рекламы', true);
        });
}


async function activateBoostOnServer() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/activate-mega-boost`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        
        if (!res.ok) throw new Error('Server error');
        
        const data = await res.json();
        
        if (data.already_active) {
            showToast(data.message, true);
            return;
        }
        
        // Активируем буст локально на 3 минуты
        const expiresAt = new Date(data.expires_at);
        startLocalBoost(expiresAt);
        showToast('🔥 MEGA BOOST АКТИВИРОВАН НА 3 МИНУТЫ!');
        
    } catch (err) {
        console.error('Boost error:', err);
        showToast('❌ Ошибка активации буста', true);
    }
}

function startLocalBoost(expiresAt) {
    const boostBtn = document.getElementById('mega-boost-btn');
    if (!boostBtn) return;
    
    boostEndTime = expiresAt;
    boostBtn.classList.add('active');
    
    // Показываем таймер
    const timerEl = document.getElementById('mega-boost-timer');
    if (timerEl) {
        timerEl.style.display = 'block';
    }
    
    // Добавляем индикатор
    showBoostIndicator();
    
    // Добавляем эффект на energy bar
    const energyBar = document.querySelector('.energy-bar-bg');
    if (energyBar) {
        energyBar.classList.add('boost-active');
    }
    
    // Запускаем обновление таймера
    if (boostInterval) clearInterval(boostInterval);
    boostInterval = setInterval(updateBoostTimer, 200);
    
    // Добавляем стили для эффектов
    addBoostStyles();
}

function updateBoostTimer() {
    if (!boostEndTime) return;
    
    const now = new Date();
    const diff = boostEndTime - now;
    const timerEl = document.getElementById('mega-boost-timer');
    
    if (diff <= 0) {
        // Буст закончился
        clearInterval(boostInterval);
        boostInterval = null;
        boostEndTime = null;
        
        const boostBtn = document.getElementById('mega-boost-btn');
        if (boostBtn) {
            boostBtn.classList.remove('active');
        }
        
        if (timerEl) {
            timerEl.style.display = 'none';
            timerEl.textContent = '3:00';
        }
        
        // Убираем индикатор
        const indicator = document.querySelector('.mega-boost-indicator');
        if (indicator) indicator.remove();
        
        // Убираем эффект с energy bar
        const energyBar = document.querySelector('.energy-bar-bg');
        if (energyBar) {
            energyBar.classList.remove('boost-active');
        }
        
        showToast('⏰ Буст закончился');
        return;
    }
    
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    if (timerEl) {
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Эффект мигания когда мало времени
        if (totalSeconds < 10) {
            timerEl.classList.add('urgent');
        } else {
            timerEl.classList.remove('urgent');
        }
    }
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

function addBoostStyles() {
    // Стили уже должны быть в CSS, но добавим для надежности
    const style = document.getElementById('boost-styles');
    if (style) return;
    
    const newStyle = document.createElement('style');
    newStyle.id = 'boost-styles';
    newStyle.textContent = `
        .energy-bar-bg.boost-active {
            box-shadow: 0 0 20px #ffaa00, 0 0 40px #ff5500;
            animation: boostPulse 1s infinite;
        }
        
        @keyframes boostPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
        
        .mega-boost-indicator {
            position: absolute;
            top: -30px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(45deg, #ffaa00, #ff5500);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 12px;
            white-space: nowrap;
            animation: indicatorGlow 1s infinite;
            box-shadow: 0 0 20px #ffaa00;
            z-index: 100;
        }
        
        @keyframes indicatorGlow {
            0%, 100% { opacity: 0.8; transform: translateX(-50%) scale(1); }
            50% { opacity: 1; transform: translateX(-50%) scale(1.05); }
        }
        
        .mini-boost-timer.urgent {
            animation: urgentBlink 0.5s infinite;
            background: #ff0000;
        }
        
        @keyframes urgentBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `;
    document.head.appendChild(newStyle);
}

// Функция для проверки статуса буста при загрузке
async function checkBoostStatus() {
    if (!userId) return;
    
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/mega-boost-status/${userId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.active) {
                startLocalBoost(new Date(data.expires_at));
            }
        }
    } catch (err) {
        console.error('Boost status error:', err);
    }
}

// ==================== УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК КЛИКОВ ====================
function setupGlobalClickHandler() {
    // Удаляем старые обработчики
    document.removeEventListener('click', handleTap);
    document.removeEventListener('touchstart', handleTap);
    
    // Добавляем новые на весь документ
    document.addEventListener('click', function(e) {
        // Проверяем, не кликнули ли по интерактивному элементу
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content')) {
            return;
        }
        handleTap(e);
    });
    
    document.addEventListener('touchstart', function(e) {
        if (e.target.closest('button, a, .nav-item, .settings-btn, .modal-close, ' +
            '.mini-boost-button, .skin-category, .skin-card, .task-button, ' +
            '.btn-primary, .btn-secondary, .toggle-wrap, .upgrade-panel, .game-card, ' +
            '.modal-screen, .modal-content, .game-modal, .game-modal-content')) {
            return;
        }
        handleTap(e);
    }, { passive: false });
    
    console.log('✅ Глобальный обработчик кликов привязан');
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Spirit Clicker starting...');
    
    loadSettings();
    
    if (userId) {
        await loadUserData();
        startPerfectEnergySystem();
        await loadReferralData();
        
        // Таймер для отправки кликов (раз в 14 секунд)
        setInterval(sendClickBatch, 14000);
    } else {
        const saved = localStorage.getItem('ryohoGame');
        if (saved) {
            try { Object.assign(State.game, JSON.parse(saved)); } catch(e) {}
        }
        updateUI();
    }
    
    // Привязываем глобальный обработчик
    setupGlobalClickHandler();
    
    // Автосохранение
    setInterval(() => {
        localStorage.setItem('ryohoGame', JSON.stringify(State.game));
    }, 10000);
    
    setInterval(checkOfflinePassiveIncome, CONFIG.PASSIVE_INCOME_INTERVAL);
    
    applySavedSkin();
    
    console.log('✅ Spirit Clicker ready');
});

// ==================== ЗАПУСК ИДЕАЛЬНОЙ СИСТЕМЫ ====================
function startPerfectEnergySystem() {
    console.log('⚡ Запуск идеальной системы энергии');
    
    // Очищаем старые таймеры
    if (State.temp.animationTimer) clearInterval(State.temp.animationTimer);
    if (State.temp.syncTimer) clearInterval(State.temp.syncTimer);
    if (State.temp.fullSyncTimer) clearInterval(State.temp.fullSyncTimer);
    
    // Буфер для синхронизации
    State.temp.energyBuffer = 0;
    
    // === ТАЙМЕР 1: Плавная анимация (каждую секунду) ===
    State.temp.animationTimer = setInterval(() => {
        // Не восстанавливаем при Mega Boost
        if (document.getElementById('mega-boost-btn')?.classList.contains('active')) {
            return;
        }
        
        // Если энергия не полная - добавляем 1 (локально)
        if (State.game.energy < State.game.maxEnergy) {
            const oldEnergy = State.game.energy;
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 1);
            
            // Обновляем UI
            updateUI();
            
            // Копим для отправки на сервер
            State.temp.energyBuffer++;
            
            console.log(`⚡ Локально +1: ${oldEnergy} → ${State.game.energy} (буфер: ${State.temp.energyBuffer})`);
        }
    }, 1000); // Каждую секунду!
    
    // === ТАЙМЕР 2: Синхронизация с сервером (раз в 15 секунд) ===
    State.temp.syncTimer = setInterval(() => {
        if (!userId) return; // Офлайн режим
        
        syncEnergyWithServer();
        
    }, 15000); // 15 секунд
    
    // === ТАЙМЕР 3: Полная синхронизация (раз в минуту для страховки) ===
    State.temp.fullSyncTimer = setInterval(() => {
        if (!userId) return;
        
        fullSyncWithServer();
        
    }, 60000); // 1 минута
}

// ==================== НОВЫЕ ФУНКЦИИ ДЛЯ ЭНЕРГИИ ====================

// Функция восстановления после рекламы (обновленная)
function recoverEnergyWithAd() {
    const modal = document.querySelector('.energy-recovery-modal');
    if (modal) modal.remove();
    
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    window.show_10655027()
        .then(() => {
            const oldEnergy = State.game.energy;
            State.game.energy = Math.min(State.game.maxEnergy, State.game.energy + 50);
            updateUI();
            
            // Отправляем на сервер
            if (userId) {
                fetch(`${API_URL}/api/update-energy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        user_id: userId, 
                        energy: State.game.energy 
                    })
                }).catch(() => {});
            }
            
            showToast(`⚡ +50 энергии! (${oldEnergy} → ${State.game.energy})`);
            
            // Эффект вспышки
            const energyBar = document.querySelector('.energy-bar-fill');
            if (energyBar) {
                energyBar.style.transition = 'all 0.3s ease';
                energyBar.style.filter = 'brightness(1.5)';
                setTimeout(() => energyBar.style.filter = 'none', 500);
            }
        })
        .catch((error) => {
            console.error('Ad error:', error);
            showToast('❌ Ошибка при показе рекламы', true);
        });
}

// ==================== ДЕТАЛИ СКИНОВ ====================

// Открыть детали скина
function openSkinDetail(skinId) {
    console.log('🔍 Открываем детали скина:', skinId);
    
    const skin = State.skins.data.find(s => s.id === skinId);
    if (!skin) {
        console.error('❌ Скин не найден:', skinId);
        return;
    }
    
    const modal = document.getElementById('skin-detail-modal');
    if (!modal) {
        console.error('❌ Модалка skin-detail-modal не найдена');
        return;
    }
    
    const isOwned = State.skins.owned.includes(skin.id);
    const isSelected = State.skins.selected === skin.id;
    
    // Заполняем данные
    document.getElementById('skin-detail-img').src = skin.image || 'imgg/clickimg.png';
    document.getElementById('skin-detail-name').textContent = skin.name || 'Скин';
    
    const rarityEl = document.getElementById('skin-detail-rarity');
    rarityEl.textContent = skin.rarity || 'common';
    rarityEl.className = 'skin-rarity-badge ' + (skin.rarity || 'common');
    
    document.getElementById('skin-detail-description').textContent = 
        skin.description || 'Нет описания';
    
    // Бонус
    const bonusEl = document.getElementById('skin-detail-bonus');
    if (skin.bonus) {
        if (skin.bonus.type === 'multiplier') {
            bonusEl.innerHTML = `⚡ Бонус: x${skin.bonus.value} к доходу`;
        } else if (skin.bonus.type === 'interval') {
            bonusEl.innerHTML = `⚡ Бонус: +${skin.bonus.value} энергии/сек`;
        } else {
            bonusEl.innerHTML = `⚡ Бонус: +${skin.bonus.value || 0}`;
        }
    } else {
        bonusEl.innerHTML = '⚡ Бонус: нет';
    }
    
    // Блок требования
    const reqBlock = document.getElementById('skin-requirement-block');
    const reqText = document.getElementById('skin-requirement-text');
    const reqProgress = document.getElementById('skin-requirement-progress');
    const progressText = document.getElementById('requirement-progress-text');
    const progressFill = document.getElementById('requirement-progress-fill');
    const actionBtn = document.getElementById('skin-action-btn');
    
    if (isOwned) {
        // Скин уже есть
        reqBlock.style.display = 'none';
        
        if (isSelected) {
            actionBtn.textContent = '✓ ВЫБРАН';
            actionBtn.setAttribute('data-type', 'selected');
            actionBtn.onclick = closeSkinDetail;
        } else {
            actionBtn.textContent = 'ВЫБРАТЬ';
            actionBtn.setAttribute('data-type', 'owned');
            actionBtn.onclick = () => selectSkinFromDetail(skin.id);
        }
    } else {
        // Скин не получен
        reqBlock.style.display = 'block';
        
        if (skin.requirement?.type === 'level') {
            const current = State.game.levels.multitap || 0;
            const value = skin.requirement.value || 1;
            const percent = Math.min(100, (current / value) * 100);
            
            reqText.textContent = `🔓 Требуется уровень ${value}`;
            progressText.textContent = `${current}/${value}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';
            
            if (current >= value) {
                actionBtn.textContent = 'ПОЛУЧИТЬ';
                actionBtn.setAttribute('data-type', 'level');
                actionBtn.onclick = () => unlockSkinFromDetail(skin.id);
            } else {
                actionBtn.textContent = 'ПРОКАЧАТЬ УРОВЕНЬ';
                actionBtn.setAttribute('data-type', 'level');
                actionBtn.onclick = () => {
                    closeSkinDetail();
                    switchTab('main');
                    showToast('📊 Кликай, чтобы повысить уровень!');
                };
            }
            
        } else if (skin.requirement?.type === 'ads' || skin.requirement?.type === 'video') {
            const count = skin.requirement.count || skin.requirement.value || 1;
            const current = State.skins.adsWatched || 0;
            const percent = Math.min(100, (current / count) * 100);
            
            reqText.textContent = `🔓 Посмотри ${count} видео`;
            progressText.textContent = `${current}/${count}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';
            
            if (current >= count) {
                actionBtn.textContent = 'ПОЛУЧИТЬ';
                actionBtn.setAttribute('data-type', 'video');
                actionBtn.onclick = () => unlockSkinFromDetail(skin.id);
            } else {
                actionBtn.textContent = 'СМОТРЕТЬ ВИДЕО';
                actionBtn.setAttribute('data-type', 'video');
                actionBtn.onclick = () => watchAdForSkin(skin.id);
            }
            
        } else if (skin.requirement?.type === 'friends') {
            const count = skin.requirement.count || skin.requirement.value || 1;
            const current = State.skins.friendsInvited || 0;
            const percent = Math.min(100, (current / count) * 100);
            
            reqText.textContent = `🔓 Пригласи ${count} друзей`;
            progressText.textContent = `${current}/${count}`;
            progressFill.style.width = percent + '%';
            reqProgress.style.display = 'flex';
            
            if (current >= count) {
                actionBtn.textContent = 'ПОЛУЧИТЬ';
                actionBtn.setAttribute('data-type', 'friends');
                actionBtn.onclick = () => unlockSkinFromDetail(skin.id);
            } else {
                actionBtn.textContent = 'ПРИГЛАСИТЬ ДРУЗЕЙ';
                actionBtn.setAttribute('data-type', 'friends');
                actionBtn.onclick = () => {
                    closeSkinDetail();
                    switchTab('friends');
                };
            }
            
        } else if (skin.requirement?.type === 'cpa' || skin.requirement?.type === 'link') {
            const url = skin.requirement.url || skin.requirement.value || '#';
            
            reqText.textContent = `🔓 Перейди по ссылке`;
            reqProgress.style.display = 'none';
            
            actionBtn.textContent = 'ПЕРЕЙТИ';
            actionBtn.setAttribute('data-type', 'link');
            actionBtn.onclick = () => window.open(url, '_blank');
            
        } else if (skin.requirement?.type === 'free') {
            reqText.textContent = `✨ Бесплатный скин`;
            reqProgress.style.display = 'none';
            
            actionBtn.textContent = 'ПОЛУЧИТЬ';
            actionBtn.setAttribute('data-type', 'free');
            actionBtn.onclick = () => unlockSkinFromDetail(skin.id);
            
        } else {
            reqText.textContent = `🔓 Условие: особое`;
            reqProgress.style.display = 'none';
            actionBtn.textContent = 'НЕДОСТУПНО';
        }
    }
    
    // Показываем модалку
    modal.classList.add('active');
}

// Закрыть детали скина
function closeSkinDetail() {
    const modal = document.getElementById('skin-detail-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Выбрать скин из деталей
async function selectSkinFromDetail(skinId) {
    if (!userId) {
        showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    try {
        await API.post('/api/select-skin', { 
            user_id: userId, 
            skin_id: skinId 
        });
        
        State.skins.selected = skinId;
        applySavedSkin();
        showToast('✨ Скин выбран!');
        closeSkinDetail();
        renderSkins();
        
    } catch (err) {
        console.error('Select skin error:', err);
        showToast('❌ Ошибка выбора скина', true);
    }
}

// Получить скин из деталей
async function unlockSkinFromDetail(skinId) {
    if (!userId) {
        showToast('❌ Авторизуйтесь', true);
        return;
    }
    
    if (State.skins.owned.includes(skinId)) {
        showToast('✅ Скин уже есть');
        closeSkinDetail();
        return;
    }
    
    try {
        const res = await API.post('/api/unlock-skin', { 
            user_id: userId, 
            skin_id: skinId,
            method: 'free'
        });
        
        if (res.success) {
            State.skins.owned.push(skinId);
            showToast('✅ Новый скин!');
            
            // Если это первый скин, выбираем его
            if (State.skins.owned.length === 1) {
                State.skins.selected = skinId;
                applySavedSkin();
            }
            
            closeSkinDetail();
            renderSkins();
            updateCollectionProgress();
        }
        
    } catch (err) {
        console.error('Unlock skin error:', err);
        showToast('❌ Ошибка получения скина', true);
    }
}

// Смотреть рекламу для скина
function watchAdForSkin(skinId) {
    if (typeof window.show_10655027 !== 'function') {
        showToast('❌ Реклама недоступна', true);
        return;
    }
    
    showToast('📺 Загружаем рекламу...');
    
    window.show_10655027()
        .then(() => {
            State.skins.adsWatched = (State.skins.adsWatched || 0) + 1;
            showToast('✅ +1 просмотр!');
            
            // Обновляем прогресс во всех скинах
            State.skins.data.forEach(skin => {
                if (skin.requirement?.type === 'ads' || skin.requirement?.type === 'video') {
                    skin.requirement.current = State.skins.adsWatched;
                }
            });
            
            renderSkins();
            
            // Если модалка открыта - обновляем её
            if (document.getElementById('skin-detail-modal').classList.contains('active')) {
                openSkinDetail(skinId);
            }
        })
        .catch((error) => {
            console.error('Ad error:', error);
            showToast('❌ Ошибка при показе рекламы', true);
        });
}

// Обновить прогресс коллекции
function updateCollectionProgress() {
    const collected = State.skins.owned.length;
    const total = State.skins.data.length || 21;
    const percent = (collected / total) * 100;
    
    const collectedSpan = document.getElementById('skins-collected');
    const totalSpan = document.getElementById('skins-total');
    const progressFill = document.getElementById('skins-progress-fill');
    
    if (collectedSpan) collectedSpan.textContent = collected;
    if (totalSpan) totalSpan.textContent = total;
    if (progressFill) progressFill.style.width = percent + '%';
}

// Убедитесь, что функция доступна глобально
window.recoverEnergyWithAd = recoverEnergyWithAd;

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
window.playCoinflip = playCoinflip;
window.playSlots = playSlots;
window.playDice = playDice;
window.playWheel = playWheel;
window.State = State;
window.state = State;
window.recoverEnergy = recoverEnergy;
window.startEnergyRecovery = startEnergyRecovery;
window.forceSync = forceSync;
window.sendClickBatch = sendClickBatch;
window.syncEnergyWithServer = syncEnergyWithServer;
window.fullSyncWithServer = fullSyncWithServer;
window.startPerfectEnergySystem = startPerfectEnergySystem;
window.recoverEnergyWithAd = recoverEnergyWithAd;
// Проверка
console.log('✅ handleTap определена:', typeof handleTap !== 'undefined');
console.log('✅ upgradeBoost определена:', typeof upgradeBoost !== 'undefined');
console.log('✅ openModal определена:', typeof openModal !== 'undefined');