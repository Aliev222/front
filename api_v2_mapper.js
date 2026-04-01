/**
 * API v2 — ТОЛЬКО задаёт базовый URL
 * Все path-rewrite делает бэкенд middleware (main_v2.py)
 * 
 * Для переключения: поменяй API_URL
 * Для возврата: верни старый URL
 */
window.API_URL = 'https://ryoho.onrender.com';

console.log('[API v2] URL:', window.API_URL);
