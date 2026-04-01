/**
 * API v2 Mapper — автоматически переводит старые endpoint'ы на /api/v2/
 * 
 * Включается в index.html ПЕРЕД game.js
 * 
 * Для переключения на v2:
 *   1. Поменяй API_URL на новый сервер (где работает v2)
 *   2. Раскомментируй window.API_V2_ENABLED = true;
 * 
 * Для возврата на старый API:
 *   1. Закомментируй window.API_V2_ENABLED = true;
 *   2. Верни API_URL на старый сервер
 */

// === НАСТРОЙКИ ===
window.API_V2_ENABLED = true;
window.API_URL = 'https://real-ears-sort.loca.lt'; // <-- поменяй на URL где работает v2

// === МАППИНГ СТАРЫХ ENDPOINT'ОВ НА V2 ===
const V2_ENDPOINT_MAP = {
    // Auth
    '/api/auth/session': '/api/v2/auth/session',
    
    // User
    '/api/register': '/api/v2/user',
    '/api/user/': '/api/v2/user',
    
    // Clicks & Energy
    '/api/clicks': '/api/v2/clicks',
    '/api/sync-energy': '/api/v2/energy/sync',
    '/api/update-energy': '/api/v2/energy/sync',
    
    // Economy
    '/api/upgrade': '/api/v2/upgrade',
    '/api/upgrade-all': '/api/v2/upgrade',
    '/api/upgrade-prices/': '/api/v2/upgrade-prices',
    '/api/passive-income': '/api/v2/upgrade',
    
    // Tournament
    '/api/weekly-tournament/results/': '/api/v2/tournament/weekly/league/',
    '/api/weekly-tournament/overview/': '/api/v2/tournament/weekly',
    '/api/weekly-tournament/leaderboard/': '/api/v2/tournament/weekly/league/',
    
    // Ads & Boosts
    '/api/ad-action/start': '/api/v2/ads/start',
    '/api/ads/adsgram/complete': '/api/v2/ads/complete',
    '/api/ads/increment': '/api/v2/ads/complete',
    '/api/activate-mega-boost': '/api/v2/boost/mega',
    '/api/activate-ghost-boost': '/api/v2/boost/ghost',
    '/api/mega-boost-status/': '/api/v2/boost/mega',
    '/api/ghost-boost-status/': '/api/v2/boost/ghost',
    '/api/autoclicker/activate': '/api/v2/boost/autoclicker',
    
    // Skins
    '/api/select-skin': '/api/v2/skins/select',
    '/api/unlock-skin': '/api/v2/skins/unlock-level',
    '/api/skins/stars-invoice': '/api/v2/skins/stars-invoice',
    
    // Tasks
    '/api/tasks/': '/api/v2/tasks',
    '/api/complete-task': '/api/v2/tasks/complete',
    '/api/daily-reward/status/': '/api/v2/daily-reward',
    '/api/daily-reward/claim': '/api/v2/daily-reward/claim',
    '/api/video-tasks/status/': '/api/v2/tasks',
    '/api/video-tasks/claim': '/api/v2/tasks/complete',
    
    // Referrals
    '/api/referral-data/': '/api/v2/referrals',
    
    // TON
    '/api/ton/wallet/': '/api/v2/ton/wallet',
    '/api/ton/wallet/proof-payload/': '/api/v2/ton/proof',
    '/api/ton/wallet/connect': '/api/v2/ton/connect',
    '/api/ton/wallet/disconnect': '/api/v2/ton/disconnect',
    
    // Online
    '/api/online/heartbeat': '/api/v2/online/heartbeat',
    '/api/online/count': '/api/v2/online/count',
    
    // Admin
    '/api/admin/': '/api/v2/admin/',
    
    // Мини-игры — УДАЛЕНЫ, возвращаем заглушку
    '/api/game/coinflip': null,
    '/api/game/slots': null,
    '/api/game/dice': null,
    '/api/game/roulette': null,
    '/api/game/luckybox': null,
    '/api/game/crash/': null,
};

function mapToV2(url) {
    if (!window.API_V2_ENABLED) return url;
    
    for (const [oldPath, newPath] of Object.entries(V2_ENDPOINT_MAP)) {
        if (newPath === null) {
            // Мини-игры удалены — возвращаем заглушку
            console.warn(`[API v2] Endpoint removed (mini-games): ${oldPath}`);
            return url; // Вернём как есть, сервер вернёт 404
        }
        
        if (url.includes(oldPath)) {
            // Если newPath содержит {userId} — нужно заменить на реальный ID
            let newUrl = url.replace(oldPath, newPath);
            
            // Убираем userId из пути если он есть (v2 берёт из токена)
            // /api/v2/user/123456 -> /api/v2/user
            newUrl = newUrl.replace(/\/api\/v2\/(\w+)\/\d+/, '/api/v2/$1');
            
            console.log(`[API v2] ${url} -> ${newUrl}`);
            return newUrl;
        }
    }
    
    return url;
}

// Перехватываем API вызовы
const _originalFetch = window.fetch;
window.fetch = function(input, init) {
    const url = typeof input === 'string' ? input : (input?.url || '');
    
    // Маппим только API запросы
    if (url.includes('/api/')) {
        const mappedUrl = mapToV2(url);
        if (mappedUrl !== url) {
            if (typeof input === 'string') {
                return _originalFetch(mappedUrl, init);
            } else {
                const newInput = new Request(mappedUrl, input);
                return _originalFetch(newInput, init);
            }
        }
    }
    
    return _originalFetch(input, init);
};

console.log('[API v2] Mapper loaded. V2 enabled:', window.API_V2_ENABLED);
