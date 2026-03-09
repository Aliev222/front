// =======================
// Spirit Clicker - app.js
// =======================

// =======================
// Инициализация состояния
// =======================
const state = {
    coins: 0,
    energy: 1000,
    profitPerTap: 1,
};

const userSkins = {
    selected: 'default',
};

const clickBatch = {
    clicks: 0,
    totalGain: 0,
    megaBoost: false,
    timer: null,
};

const CLICK_BATCH_INTERVAL = 1000;
const settings = {
    sound: true,
    vibration: true,
};

// =======================
// Вспомогательные функции
// =======================
function getSkinById(id) {
    // Пример простой функции, замените на свою логику
    return { bonus: { type: 'multiplier', value: 2 } };
}

function updateUI() {
    document.getElementById('coinBalance').textContent = state.coins;
    document.getElementById('energyText').textContent = state.energy;
}

function showEnergyRecoveryModal() {
    alert('Недостаточно энергии!');
}

function vibrateClick() {
    if (settings.vibration && navigator.vibrate) navigator.vibrate(50);
}

function playClickSound(megaBoost) {
    // Простая заглушка, замените на свой звук
    if (settings.sound) console.log('Play click sound', megaBoost ? '🔥' : '');
}

function sendClickBatch() {
    console.log('Отправка батча кликов', clickBatch);
    clickBatch.clicks = 0;
    clickBatch.totalGain = 0;
    clickBatch.megaBoost = false;
    clickBatch.timer = null;
}

// =======================
// Функция обработки клика
// =======================
function handleGameClick(e) {
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    }

    const megaBoostActive = document.getElementById('mega-boost-btn')?.classList.contains('active');
    if (!megaBoostActive && state.energy < 1) {
        showEnergyRecoveryModal();
        return;
    }

    // Рассчет gain
    let gain = state.profitPerTap;
    const skin = getSkinById(userSkins.selected);
    if (skin?.bonus?.type === 'multiplier') gain *= skin.bonus.value;
    if (megaBoostActive) gain *= 2;
    gain = Math.floor(gain);

    // Обновляем состояние
    state.coins += gain;
    if (!megaBoostActive) state.energy = Math.max(0, state.energy - 1);
    updateUI();

    // Анимация клика
    try {
        const effect = document.createElement('div');
        effect.className = 'tap-effect-global';
        effect.style.left = clientX + 'px';
        effect.style.top = clientY + 'px';
        effect.innerHTML = megaBoostActive ? `+${gain} 🔥` : `+${gain}`;
        if (megaBoostActive) {
            effect.style.color = '#ffaa00';
            effect.style.fontWeight = 'bold';
            effect.style.textShadow = '0 0 10px #ff0';
        }
        document.body.appendChild(effect);
        setTimeout(() => effect.remove(), 300);
    } catch (err) {}

    vibrateClick();
    if (settings.sound) playClickSound(megaBoostActive);

    // Батчи кликов
    if (true) { // userId есть
        clickBatch.clicks++;
        clickBatch.totalGain += gain;
        clickBatch.megaBoost = megaBoostActive;
        if (!clickBatch.timer) {
            clickBatch.timer = setTimeout(sendClickBatch, CLICK_BATCH_INTERVAL);
        }
    }
}
const clickLayer = document.querySelector('.game-click-layer');
clickLayer.addEventListener('click', handleGameClick);
clickLayer.addEventListener('touchstart', handleGameClick);

// =======================
// Навешивание клика по всему экрану
// =======================
document.addEventListener('click', function(e) {
    const target = e.target;
    const uiSelectors = [
        '.nav-item',
        '.settings-btn',
        '.modal-close',
        '.mini-boost-button',
        '.skin-category',
        '.skin-card',
        '.task-button',
        '.btn-primary',
        '.btn-secondary',
        '.toggle-wrap',
        '.upgrade-panel',
        '.game-card'
    ];
    if (target.closest(uiSelectors.join(','))) return;
    handleGameClick(e);
});

document.addEventListener('touchstart', function(e) {
    const target = e.target;
    const uiSelectors = [
        '.nav-item',
        '.settings-btn',
        '.modal-close',
        '.mini-boost-button',
        '.skin-category',
        '.skin-card',
        '.task-button',
        '.btn-primary',
        '.btn-secondary',
        '.toggle-wrap',
        '.upgrade-panel',
        '.game-card'
    ];
    if (target.closest(uiSelectors.join(','))) return;
    handleGameClick(e);
});

// =======================
// Навигация и кнопки
// =======================
function switchTab(tab, element) {
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    element.classList.add('active');
    document.querySelectorAll('.modal-screen').forEach(m => m.style.display = 'none');

    switch(tab) {
        case 'main': break;
        case 'friends':
            document.getElementById('friends-screen').style.display = 'block';
            updateReferralStats(); // обновляем UI друзей
            break;
        case 'tasks':
            document.getElementById('tasks-screen').style.display = 'block';
            loadTasks(); // загружаем задачи
            break;
        case 'games':
            document.getElementById('games-screen').style.display = 'block';
            break;
        case 'skins':
            document.getElementById('skins-screen').style.display = 'block';
            updateSkinsUI(); // обновляем скины
            break;
    }
}

function openSettings() { document.getElementById('settings-screen').style.display = 'block'; }
function closeSettings() { document.getElementById('settings-screen').style.display = 'none'; }

function toggleTheme() { console.log('Theme toggled'); }
function toggleSound() { settings.sound = !settings.sound; console.log('Sound:', settings.sound); }
function toggleVibration() { settings.vibration = !settings.vibration; console.log('Vibration:', settings.vibration); }

function activateMegaBoost() {
    const btn = document.getElementById('mega-boost-btn');
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 10000);
    console.log('Mega Boost activated!');
}

// =======================
// Upgrades и скины
// =======================
function upgradeAll() { console.log('Upgraded all'); }
function filterSkins(category) { console.log('Filter skins:', category); }

// =======================
// Модалки
// =======================
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function copyReferralLink() { console.log('Referral link copied'); }
function shareReferral() { console.log('Referral shared'); }

// =======================
// Мини-игры
// =======================
function openGame(name) { console.log('Open game:', name); }
function closeGame(name) { console.log('Close game:', name); }
function playCoinflip() { console.log('Coinflip played'); }
function playSlots() { console.log('Slots played'); }
function playWheel() { console.log('Wheel spun'); }
function playDice() { console.log('Dice rolled'); }

// =======================
// Инициализация UI
// =======================
updateUI();
updateReferralStats();
updateEnergyUI();
updateCoinsUI();
updateSkinsUI();

console.log('✅ Ryoho Clicker fully initialized with fixed app.js');