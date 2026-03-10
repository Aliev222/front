// ==================== SPIRIT CLICKER - ОПТИМИЗИРОВАННЫЙ ====================

// ==================== TELEGRAM INIT ====================
const tg = window.Telegram?.WebApp;
let userId = null;
let username = null;

if (tg) {
    tg.expand();
    if (tg.enableClosingConfirmation) tg.enableClosingConfirmation();
    if (tg.initDataUnsafe?.user) {
        userId = tg.initDataUnsafe.user.id;
        username = tg.initDataUnsafe.user.username || `user_${userId}`;
    }
}

// ==================== CONSTANTS ====================
const API_URL = 'https://ryoho.onrender.com';
const PASSIVE_INCOME_INTERVAL = 3600000; // 1 час
const CLICK_BATCH_INTERVAL = 1000; // Отправка кликов раз в секунду
const ENERGY_RECOVERY_INTERVAL = 5000; // +1 энергия каждые 2 секунды
const MAX_CACHE_AGE = 30000; // 30 секунд

// ==================== STATE ====================
const state = {
    coins: 0,
    energy: 500,
    maxEnergy: 500,
    profitPerTap: 1,
    profitPerHour: 100,
    globalLevel: 0,
    prices: { multitap: 50, profit: 40, energy: 30 },
    levels: { multitap: 0, profit: 0, energy: 0 }
};

window.state = state;

const settings = {
    theme: localStorage.getItem('ryohoSettings') ? 
        JSON.parse(localStorage.getItem('ryohoSettings')).theme || 'day' : 'day',
    sound: localStorage.getItem('ryohoSettings') ? 
        JSON.parse(localStorage.getItem('ryohoSettings')).sound !== undefined ? 
        JSON.parse(localStorage.getItem('ryohoSettings')).sound : true : true,
    vibration: localStorage.getItem('ryohoSettings') ? 
        JSON.parse(localStorage.getItem('ryohoSettings')).vibration !== undefined ? 
        JSON.parse(localStorage.getItem('ryohoSettings')).vibration : true : true
};

let referrerId = null;
let upgradeInProgress = false;
let recoveryInterval = null;
let megaBoostTimer = null;

// ==================== СКИНЫ ====================
let userSkins = {
    owned: ['default_SP'],
    selected: 'default_SP',
    adsWatched: 0,
    friendsInvited: 0
};

let skinsData = [];

// ==================== REFERRAL DETECTION ====================
const startParam = tg?.initDataUnsafe?.start_param || '';
if (startParam?.startsWith('ref_')) {
    referrerId = parseInt(startParam.replace('ref_', '')) || null;
    if (referrerId) localStorage.setItem('ryohoReferrer', referrerId);
} else {
    const saved = localStorage.getItem('ryohoReferrer');
    if (saved) referrerId = parseInt(saved) || null;
}

// ==================== UTILITIES ====================
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
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: ${isError ? 'rgba(244,67,54,0.9)' : 'rgba(76,175,80,0.9)'};
        color: white; padding: 10px 20px; border-radius: 30px; font-size: 14px;
        z-index: 10001; animation: toastFade 2s forwards; border: 1px solid #7F49B4;
        backdrop-filter: blur(5px);
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
};

// ==================== API CALLS ====================
const fetchWithCache = async (url, options = {}, cacheTime = 0) => {
    const cacheKey = `cache_${url}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cacheTime > 0 && cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheTime) return data;
    }
    
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    
    if (cacheTime > 0) {
        localStorage.setItem(cacheKey, JSON.stringify({ data, timestamp: Date.now() }));
    }
    return data;
};

// ==================== UI UPDATE ====================
let pendingUI = false;
const updateUI = () => {
    if (pendingUI) return;
    pendingUI = true;
    
    requestAnimationFrame(() => {
        const coinEl = document.getElementById('coinBalance');
        if (coinEl) coinEl.textContent = formatNumber(state.coins);

        const hourEl = document.getElementById('profitPerHour');
        if (hourEl) hourEl.textContent = formatNumber(state.profitPerHour);
        
        const tapEl = document.getElementById('profitPerTap');
        if (tapEl) tapEl.textContent = state.profitPerTap;

        const energyFill = document.getElementById('energyFill');
        const energyText = document.getElementById('energyText');
        const maxEnergyEl = document.getElementById('maxEnergyText');
        
        if (energyFill && energyText && maxEnergyEl) {
            const percent = (state.energy / state.maxEnergy) * 100;
            energyFill.style.width = percent + '%';
            energyText.textContent = Math.floor(state.energy);
            maxEnergyEl.textContent = state.maxEnergy;
        }

        const missing = state.maxEnergy - state.energy;
        const regenEl = document.getElementById('energyRegenInfo');
        if (regenEl) {
            if (missing > 0) {
                const seconds = Math.ceil(missing * 2);
                regenEl.textContent = `⚡ +1/2сек (${seconds}сек до полной)`;
            } else {
                regenEl.textContent = '⚡ Energy full!';
            }
        }

        const levelEl = document.getElementById('globalLevel');
        if (levelEl) levelEl.textContent = state.levels.multitap;

        const priceEl = document.getElementById('globalPrice');
        if (priceEl) {
            const total = (state.prices.multitap || 0) + (state.prices.profit || 0) + (state.prices.energy || 0);
            priceEl.textContent = formatNumber(total);
        }
        
        pendingUI = false;
    });
};

// ==================== ENERGY RECOVERY ====================
const startEnergyRecovery = () => {
    if (recoveryInterval) clearInterval(recoveryInterval);
    recoveryInterval = setInterval(recoverEnergy, ENERGY_RECOVERY_INTERVAL);
};

const recoverEnergy = async () => {
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    if (megaBoostActive || state.energy >= state.maxEnergy) return;
    
    if (!userId) {
        state.energy = Math.min(state.maxEnergy, state.energy + 1);
        return updateUI();
    }
    
    try {
        const res = await fetch(`${API_URL}/api/recover-energy`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            const data = await res.json();
            state.energy = data.energy;
            updateUI();
        }
    } catch (e) {
        state.energy = Math.min(state.maxEnergy, state.energy + 1);
        updateUI();
    }
};

// ==================== AUDIO SYSTEM ====================
let audioCtx = null;
let isAudioInitialized = false;

// Инициализация аудио при первом взаимодействии
function initAudio() {
    if (isAudioInitialized) return;
    
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        isAudioInitialized = true;
        console.log('✅ Audio initialized');
    } catch (e) {
        console.log('❌ Audio init failed:', e);
    }
}

// Упрощенная функция звука
function playClickSound(megaBoostActive = false) {
    if (!settings.sound) return;
    
    // Инициализируем при первом клике
    if (!isAudioInitialized) {
        initAudio();
        // Если не удалось инициализировать, выходим
        if (!isAudioInitialized) return;
    }
    
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(() => {
                playSoundInternal(megaBoostActive);
            });
        } else {
            playSoundInternal(megaBoostActive);
        }
    } catch (e) {
        console.log('Sound error:', e);
    }
}
// ==================== ВИБРАЦИЯ ====================
function vibrateClick() {
    if (!settings.vibration) return;
    
    try {
        // Telegram Haptic Feedback (работает в нативных приложениях Telegram)
        if (tg?.HapticFeedback) {
            tg.HapticFeedback.impactOccurred('light');
        }
        // Web Vibration API (работает в браузере)
        else if (navigator.vibrate) {
            navigator.vibrate(20);
        }
    } catch (e) {
        console.log('Vibration error:', e);
    }
}
function playSoundInternal(megaBoostActive) {
    const now = audioCtx.currentTime;
    
    if (megaBoostActive) {
        // Звук для буста
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        
        osc.start();
        osc.stop(now + 0.2);
    } else {
        // Обычный звук клика
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(650, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        
        osc.start();
        osc.stop(now + 0.15);
    }
}


// ==================== CLICK BATCH ====================
const clickBatch = { clicks: 0, totalGain: 0, timer: null, megaBoost: false };

const sendClickBatch = async () => {
    if (clickBatch.clicks === 0 || !userId) {
        clickBatch.timer = null;
        return;
    }
    
    try {
        await fetch(`${API_URL}/api/click`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                clicks: clickBatch.clicks,
                gain: clickBatch.totalGain,
                mega_boost: clickBatch.megaBoost
            })
        });
    } catch (e) {
        console.log('Click batch error:', e);
    }
    
    clickBatch.clicks = 0;
    clickBatch.totalGain = 0;
    clickBatch.timer = null;
};

// ==================== CLICK HANDLER ====================
function handleTap(e) {
    
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

    // ПОЛУЧАЕМ КООРДИНАТЫ КЛИКА
    let clientX, clientY;
    
    if (e.touches) {
        // Для сенсорных устройств
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        // Для мыши
        clientX = e.clientX;
        clientY = e.clientY;
    }

    // Проверка буста
    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    
    if (!megaBoostActive && state.energy < 1) {
        showEnergyRecoveryModal();
        return;
    }

    // Расчет дохода
    let gain = state.profitPerTap;
    const skin = skinsData.find(s => s.id === userSkins.selected);
    if (skin?.bonus?.type === 'multiplier') gain *= skin.bonus.value;
    if (megaBoostActive) gain *= 2;
    gain = Math.floor(gain);

    // Обновление состояния
    state.coins += gain;
    if (!megaBoostActive) {
        state.energy = Math.max(0, state.energy - 1);
    }
    updateUI();

    // ========== ИСПРАВЛЕННАЯ АНИМАЦИЯ ==========
    try {
        const effect = document.createElement('div');
        effect.className = 'tap-effect-global';
        
        // ВАЖНО: используем clientX/clientY напрямую
        effect.style.left = clientX + 'px';
        effect.style.top = clientY + 'px';
        effect.style.transform = 'translate(-50%, -50%)';
        effect.style.position = 'fixed'; // fixed относительно окна, не документа
        effect.style.color = megaBoostActive ? '#ffaa00' : 'white';
        effect.style.fontSize = '28px';
        effect.style.fontWeight = 'bold';
        effect.style.textShadow = megaBoostActive ? '0 0 10px #ffaa00' : '0 0 10px #7F49B4';
        effect.style.pointerEvents = 'none';
        effect.style.zIndex = '9999';
        effect.style.whiteSpace = 'nowrap';
        effect.style.transition = 'all 0.6s ease-out';
        effect.textContent = megaBoostActive ? `+${gain} 🔥` : `+${gain}`;
        
        document.body.appendChild(effect);
        
        // Анимация
        requestAnimationFrame(() => {
            effect.style.transform = 'translate(-50%, -150px)';
            effect.style.opacity = '0';
        });
        
        setTimeout(() => effect.remove(), 600);
        
    } catch (err) {
        console.log('Animation error:', err);
    }

    // Вибрация
    if (settings.vibration) {
        try {
            if (tg?.HapticFeedback) {
                tg.HapticFeedback.impactOccurred('light');
            } else if (navigator.vibrate) {
                navigator.vibrate(20);
            }
        } catch (err) {}
    }

    // Звук
    if (settings.sound) {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = megaBoostActive ? 'sawtooth' : 'sine';
            oscillator.frequency.setValueAtTime(megaBoostActive ? 800 : 650, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(
                megaBoostActive ? 400 : 450, 
                audioCtx.currentTime + (megaBoostActive ? 0.1 : 0.08)
            );
            
            gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.15);
        } catch (err) {}
    }

    // Отправка на сервер
    if (userId) {
        clickBatch.clicks++;
        clickBatch.totalGain += gain;
        clickBatch.megaBoost = megaBoostActive;
        if (!clickBatch.timer) {
            clickBatch.timer = setTimeout(sendClickBatch, CLICK_BATCH_INTERVAL);
        }
    }
}

// ==================== МОДАЛКА ЭНЕРГИИ ====================
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

// ==================== UPGRADES ====================
const upgradeBoost = async (type) => {
    if (upgradeInProgress || !userId) return;
    
    const price = state.prices[type];
    if (!price || state.coins < price) {
        showToast(`❌ Нужно ${formatNumber(price)} монет`, true);
        return;
    }

    upgradeInProgress = true;
    
    try {
        const res = await fetch(`${API_URL}/api/upgrade`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, boost_type: type })
        });
        
        if (res.ok) {
            const result = await res.json();
            state.coins = result.coins;
            state.levels[type] = result.new_level;
            state.prices[type] = result.next_cost || 0;
            
            if (result.profit_per_tap) state.profitPerTap = result.profit_per_tap;
            if (result.profit_per_hour) state.profitPerHour = result.profit_per_hour;
            if (result.max_energy) {
                state.maxEnergy = result.max_energy;
                state.energy = result.max_energy;
            }
            
            showToast(`✅ ${type} +${result.new_level}!`);
            updateUI();
        }
    } catch (e) {
        showToast('❌ Ошибка сервера', true);
    } finally {
        upgradeInProgress = false;
    }
};

const upgradeAll = async () => {
    if (upgradeInProgress || !userId) return;

    const total = (state.prices.multitap || 0) + (state.prices.profit || 0) + (state.prices.energy || 0);
    if (state.coins < total) {
        showToast(`❌ Нужно ${formatNumber(total)} монет`, true);
        return;
    }

    upgradeInProgress = true;
    for (const type of ['multitap', 'profit', 'energy']) {
        try {
            const res = await fetch(`${API_URL}/api/upgrade`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, boost_type: type })
            });
            if (res.ok) {
                const result = await res.json();
                state.coins = result.coins;
                state.levels[type] = result.new_level;
                state.prices[type] = result.next_cost || 0;
                if (result.profit_per_tap) state.profitPerTap = result.profit_per_tap;
                if (result.profit_per_hour) state.profitPerHour = result.profit_per_hour;
                if (result.max_energy) {
                    state.maxEnergy = result.max_energy;
                    state.energy = result.max_energy;
                }
            }
        } catch (e) {}
    }
    upgradeInProgress = false;
    showToast('✅ Все улучшения куплены!');
    updateUI();
};

// ==================== СКИНЫ ====================
async function loadSkinsList() {
    try {
        const res = await fetch(`${API_URL}/api/skins/list`);
        if (res.ok) {
            skinsData = (await res.json()).skins || [];
            renderSkins();
        }
    } catch (e) {
        console.error('Error loading skins:', e);
    }
}

function getSkinById(id) {
    return skinsData.find(s => s.id === id);
}

function renderSkins(filter = 'all') {
    const grid = document.getElementById('skins-grid');
    if (!grid || !skinsData.length) return;
    
    const filtered = filter === 'all' ? skinsData : skinsData.filter(s => s.rarity === filter);
    
    grid.innerHTML = filtered.map(skin => {
        const unlocked = userSkins.owned.includes(skin.id) || skin.requirement?.type === 'free';
        const owned = userSkins.owned.includes(skin.id);
        const selected = userSkins.selected === skin.id;
        
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
    const skin = skinsData.find(s => s.id === id);
    if (!skin) return;
    
    if (userSkins.owned.includes(id)) {
        selectActiveSkin(id);
    } else if (skin.requirement?.type === 'free') {
        unlockSkin(id, 'free');
    } else {
        showToast(`❌ Скин "${skin.name}" еще не открыт!`, true);
    }
}

async function selectActiveSkin(id) {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/select-skin`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, skin_id: id })
        });
        if (res.ok) {
            userSkins.selected = id;
            applySavedSkin();
            renderSkins();
            showToast(`✨ Скин выбран!`);
        }
    } catch (e) {}
}

async function unlockSkin(id) {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/unlock-skin`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, skin_id: id, method: 'free' })
        });
        if (res.ok) {
            userSkins.owned.push(id);
            showToast('✅ Новый скин разблокирован!');
            renderSkins();
            applySavedSkin();
        }
    } catch (e) {}
}

function applySavedSkin() {
    const img = document.querySelector('.click-image');
    if (!img) return;
    const skin = skinsData.find(s => s.id === userSkins.selected);
    img.src = (skin?.image || 'imgg/skins/default_SP.png') + '?t=' + Date.now();
    img.onerror = () => img.src = 'imgg/clickimg.png';
}

function openSkins() {
    loadSkinsList().then(() => {
        renderSkins();
        openModal('skins-screen');
    });
}

function filterSkins(category, e) {
    document.querySelectorAll('.skin-category').forEach(btn => btn.classList.remove('active'));
    if (e) e.target.classList.add('active');
    renderSkins(category);
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
    if (tab === 'tasks') loadTasks();
    if (tab === 'skins') openSkins();
}

// ==================== НАСТРОЙКИ ====================
function loadSettings() {
    applyTheme();
    updateSettingsUI();
}

function applyTheme() {
    if (settings.theme === 'night') document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
}

function saveSettings() {
    localStorage.setItem('ryohoSettings', JSON.stringify(settings));
}

function toggleTheme() {
    settings.theme = settings.theme === 'day' ? 'night' : 'day';
    saveSettings();
    applyTheme();
    updateSettingsUI();
}

function toggleSound() {
    settings.sound = !settings.sound;
    saveSettings();
    updateSettingsUI();
}

function toggleVibration() {
    settings.vibration = !settings.vibration;
    saveSettings();
    updateSettingsUI();
    if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
}

function openSettings() {
    document.getElementById('settings-screen')?.classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-screen')?.classList.remove('active');
}

function closeSettingsOutside(e) {
    const box = document.getElementById('settings-modal-box');
    if (box && !box.contains(e.target)) closeSettings();
}

function updateSettingsUI() {
    const isNight = settings.theme === 'night';
    const soundOn = settings.sound;
    const vibOn = settings.vibration;
    
    const setToggle = (id, active) => {
        const el = document.getElementById(id);
        if (el) active ? el.classList.add('active') : el.classList.remove('active');
    };
    const setEl = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    setToggle('themeTrack', isNight);
    setEl('themeIcon', isNight ? '🌙' : '☀️');
    setEl('themeLabel', isNight ? 'Night' : 'Day');
    
    setToggle('soundTrack', soundOn);
    setEl('soundIcon', soundOn ? '🔊' : '🔇');
    setEl('soundLabel', soundOn ? 'On' : 'Off');
    
    setToggle('vibTrack', vibOn);
    setEl('vibIcon', vibOn ? '📳' : '📴');
    setEl('vibLabel', vibOn ? 'On' : 'Off');
}

// ==================== РЕФЕРАЛЫ ====================
async function loadReferralData() {
    if (!userId) return;
    try {
        const link = `https://t.me/Ryoho_bot?start=ref_${userId}`;
        const linkEl = document.getElementById('referral-link');
        if (linkEl) linkEl.textContent = link;

        const data = await fetchWithCache(`${API_URL}/api/referral-data/${userId}`, {}, 30000);
        
        const countEl = document.getElementById('referral-count');
        const earnEl = document.getElementById('referral-earnings');
        if (countEl) countEl.textContent = data.count || 0;
        if (earnEl) earnEl.textContent = formatNumber(data.earnings || 0);
        
        userSkins.friendsInvited = data.count || 0;
    } catch (e) {}
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

// ==================== ЗАДАЧИ ====================
async function loadTasks() {
    if (!userId) return;
    try {
        const tasks = await fetchWithCache(`${API_URL}/api/tasks/${userId}`, {}, 10000);
        renderTasks(tasks);
    } catch (e) {
        renderTasks([]);
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('tasks-list');
    if (!container) return;
    
    if (!tasks?.length) {
        container.innerHTML = '<div class="loading">Задачи появятся позже</div>';
        return;
    }
    
    container.innerHTML = tasks.map(t => `
        <div class="task-card ${t.completed ? 'completed' : ''}">
            <div class="task-icon">${t.icon || '📋'}</div>
            <div class="task-info">
                <div class="task-title">${t.title || 'Задача'}</div>
                <div class="task-desc">${t.description || ''}</div>
                <div class="task-reward">🎁 ${t.reward || '0'}</div>
            </div>
            ${t.completed ? '<button class="task-button completed" disabled>✅ Выполнено</button>' 
                : `<button class="task-button" onclick="completeTask('${t.id}')">Выполнить</button>`}
        </div>
    `).join('');
}

async function completeTask(taskId) {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/complete-task`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, task_id: taskId })
        });
        if (res.ok) {
            const data = await res.json();
            showToast(data.message || '✅ Задание выполнено!');
            if (data.coins) state.coins = data.coins;
            updateUI();
            loadTasks();
        }
    } catch (e) {}
}

// ==================== ПАССИВНЫЙ ДОХОД ====================
async function checkOfflinePassiveIncome() {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/passive-income`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                state.coins = data.coins;
                updateUI();
                showToast(`💰 +${data.income} монет (офлайн)!`);
            }
        }
    } catch (e) {}
}

setInterval(async () => {
    if (!userId) return;
    try {
        const res = await fetch(`${API_URL}/api/passive-income`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.income > 0) {
                state.coins = data.coins;
                updateUI();
                showToast(data.message || `💰 +${data.income} монет!`);
            }
        }
    } catch (e) {}
}, PASSIVE_INCOME_INTERVAL);

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

// Упрощенные мини-игры
async function playCoinflip() {
    const bet = parseInt(document.getElementById('coin-bet')?.value || 0);
    if (bet > state.coins || bet < 10) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    
    const coin = document.getElementById('coin');
    coin.classList.add('flipping');
    
    setTimeout(async () => {
        if (userId) {
            try {
                const res = await fetch(`${API_URL}/api/game/coinflip`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: userId, bet })
                });
                const data = await res.json();
                coin.classList.remove('flipping');
                document.getElementById('coin-result').textContent = data.message || '🎮 Сыграно!';
                if (data.coins) state.coins = data.coins;
                updateUI();
            } catch {
                coin.classList.remove('flipping');
                document.getElementById('coin-result').textContent = '❌ Ошибка';
            }
        }
    }, 1500);
}

async function playSlots() {
    const bet = parseInt(document.getElementById('slots-bet')?.value || 0);
    if (bet > state.coins || bet < 10) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/api/game/slots`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, bet })
            });
            const data = await res.json();
            document.getElementById('slot1').textContent = data.slots?.[0] || '🍒';
            document.getElementById('slot2').textContent = data.slots?.[1] || '🍒';
            document.getElementById('slot3').textContent = data.slots?.[2] || '🍒';
            document.getElementById('slots-result').textContent = data.message || '🎮 Сыграно!';
            if (data.coins) state.coins = data.coins;
            updateUI();
        } catch {
            document.getElementById('slots-result').textContent = '❌ Ошибка';
        }
    }
}

async function playDice() {
    const bet = parseInt(document.getElementById('dice-bet')?.value || 0);
    const pred = document.getElementById('dice-prediction')?.value;
    if (bet > state.coins || bet < 10) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/api/game/dice`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, bet, prediction: pred })
            });
            const data = await res.json();
            const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
            document.getElementById('dice1').textContent = faces[(data.dice1 || 1) - 1];
            document.getElementById('dice2').textContent = faces[(data.dice2 || 1) - 1];
            document.getElementById('dice-result').textContent = data.message || '🎮 Сыграно!';
            if (data.coins) state.coins = data.coins;
            updateUI();
        } catch {
            document.getElementById('dice-result').textContent = '❌ Ошибка';
        }
    }
}

async function playWheel() {
    const bet = parseInt(document.getElementById('wheel-bet')?.value || 0);
    const betType = document.getElementById('wheel-color')?.value;
    const betNumber = parseInt(document.getElementById('wheel-number')?.value);
    if (bet > state.coins || bet < 10) {
        showToast('❌ Недостаточно монет', true);
        return;
    }
    
    if (userId) {
        try {
            const res = await fetch(`${API_URL}/api/game/roulette`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    bet,
                    bet_type: betType,
                    bet_value: betType === 'number' ? betNumber : null
                })
            });
            const data = await res.json();
            document.getElementById('wheel').textContent = data.result_number || '0';
            document.getElementById('wheel-result').textContent = data.message || '🎮 Сыграно!';
            if (data.coins) state.coins = data.coins;
            updateUI();
        } catch {
            document.getElementById('wheel-result').textContent = '❌ Ошибка';
        }
    }
}

// ==================== MEGA BOOST ====================
const activateMegaBoost = () => showToast('🔥 Буст будет позже');

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
async function loadUserData() {
    if (!userId) return;
    
    try {
        await fetch(`${API_URL}/api/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, username, referrer_id: referrerId })
        });

        const data = await fetchWithCache(`${API_URL}/api/user/${userId}`, {}, MAX_CACHE_AGE);
        
        state.coins = data.coins || 0;
        state.energy = data.energy || 500;
        state.maxEnergy = data.max_energy || 500;
        state.profitPerTap = data.profit_per_tap || 1;
        state.profitPerHour = data.profit_per_hour || 100;
        state.levels.multitap = data.multitap_level || 0;
        state.levels.profit = data.profit_level || 0;
        state.levels.energy = data.energy_level || 0;
        
        userSkins.owned = data.owned_skins || ['default_SP'];
        userSkins.selected = data.selected_skin || 'default_SP';
        userSkins.adsWatched = data.ads_watched || 0;

        const prices = await fetchWithCache(`${API_URL}/api/upgrade-prices/${userId}`, {}, 10000);
        state.prices = { ...state.prices, ...prices };

        applySavedSkin();
        updateUI();
        
        loadSkinsList();
        loadReferralData();
        checkOfflinePassiveIncome();
        
    } catch (e) {
        console.error('Error loading user data:', e);
    }
}

// Запуск
if (userId) {
    loadUserData();
    startEnergyRecovery();
} else {
    const saved = localStorage.getItem('ryohoGame');
    if (saved) Object.assign(state, JSON.parse(saved));
    updateUI();
}

window.addEventListener('beforeunload', () => {
    localStorage.setItem('ryohoLastVisit', Date.now().toString());
    if (!userId) localStorage.setItem('ryohoGame', JSON.stringify(state));
});

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    applySavedSkin();

    const clickLayer = document.querySelector('.game-click-layer');
    if (clickLayer) {
        clickLayer.addEventListener('click', handleTap);
        clickLayer.addEventListener('touchstart', handleTap, { passive: false });
    }
});

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================
window.state = state;
window.handleTap = handleTap;
window.upgradeBoost = upgradeBoost;
window.upgradeAll = upgradeAll;
window.openGame = openGame;
window.closeGame = closeGame;
window.playCoinflip = playCoinflip;
window.playSlots = playSlots;
window.playDice = playDice;
window.playWheel = playWheel;
window.toggleNumberInput = toggleNumberInput;
window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.copyReferralLink = copyReferralLink;
window.shareReferral = shareReferral;
window.completeTask = completeTask;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.closeSettingsOutside = closeSettingsOutside;
window.toggleTheme = toggleTheme;
window.toggleSound = toggleSound;
window.toggleVibration = toggleVibration;
window.activateMegaBoost = activateMegaBoost;
window.selectActiveSkin = selectActiveSkin;
window.filterSkins = filterSkins;
window.selectSkin = selectSkin;
window.getSkinById = getSkinById;
window.openSkins = openSkins;
window.recoverEnergy = recoverEnergy;
window.startEnergyRecovery = startEnergyRecovery;
window.showToast = showToast;

document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.querySelector('.game-container');
    if (gameContainer) {
        // Удаляем старые обработчики если есть
        gameContainer.removeEventListener('click', handleTap);
        gameContainer.removeEventListener('touchstart', handleTap);
        
        // Добавляем новые
        gameContainer.addEventListener('click', handleTap);
        gameContainer.addEventListener('touchstart', handleTap, { passive: false });
        
        console.log('✅ Обработчики кликов привязаны');
    }
});


console.log('✅ Spirit Clicker оптимизирован');