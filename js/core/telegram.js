/* ============================================================
   TELEGRAM WEBAPP INTEGRATION
   Theme sync, safe-area, haptic feedback, viewport
   ============================================================ */

(function () {
  'use strict';

  var tg = window.Telegram && window.Telegram.WebApp;
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();

    /* ── Apply Telegram theme params ─────────────────── */
    var params = tg.themeParams;
    if (params) {
      var root = document.documentElement.style;
      if (params.bg_color)            root.setProperty('--tg-theme-bg-color', params.bg_color);
      if (params.secondary_bg_color)  root.setProperty('--tg-theme-secondary-bg-color', params.secondary_bg_color);
      if (params.text_color)          root.setProperty('--tg-theme-text-color', params.text_color);
      if (params.hint_color)          root.setProperty('--tg-theme-hint-color', params.hint_color);
      if (params.button_color)        root.setProperty('--tg-theme-button-color', params.button_color);
      if (params.button_text_color)   root.setProperty('--tg-theme-button-text-color', params.button_text_color);
      if (params.section_bg_color)    root.setProperty('--tg-theme-section-bg-color', params.section_bg_color);
      if (params.section_header_text_color) root.setProperty('--tg-theme-section-header-text-color', params.section_header_text_color);
      if (params.section_separator_color) root.setProperty('--tg-theme-section-separator-color', params.section_separator_color);
      if (params.subtitle_text_color) root.setProperty('--tg-theme-subtitle-text-color', params.subtitle_text_color);
      if (params.destructive_text_color) root.setProperty('--tg-theme-destructive-text-color', params.destructive_text_color);
      if (params.link_color)          root.setProperty('--tg-theme-link-color', params.link_color);

      document.body.classList.add('telegram-theme');
    }

    /* ── Sync theme on change ────────────────────────── */
    tg.onEvent('themeChanged', function () {
      var p = tg.themeParams;
      var root = document.documentElement.style;
      if (p.bg_color)            root.setProperty('--tg-theme-bg-color', p.bg_color);
      if (p.secondary_bg_color)  root.setProperty('--tg-theme-secondary-bg-color', p.secondary_bg_color);
      if (p.text_color)          root.setProperty('--tg-theme-text-color', p.text_color);
      if (p.hint_color)          root.setProperty('--tg-theme-hint-color', p.hint_color);
      if (p.button_color)        root.setProperty('--tg-theme-button-color', p.button_color);
      if (p.button_text_color)   root.setProperty('--tg-theme-button-text-color', p.button_text_color);
      if (p.section_bg_color)    root.setProperty('--tg-theme-section-bg-color', p.section_bg_color);
      if (p.section_header_text_color) root.setProperty('--tg-theme-section-header-text-color', p.section_header_text_color);
      if (p.section_separator_color) root.setProperty('--tg-theme-section-separator-color', p.section_separator_color);
      if (p.subtitle_text_color) root.setProperty('--tg-theme-subtitle-text-color', p.subtitle_text_color);
      if (p.destructive_text_color) root.setProperty('--tg-theme-destructive-text-color', p.destructive_text_color);
      if (p.link_color)          root.setProperty('--tg-theme-link-color', p.link_color);
    });

    /* ── Safe area from Telegram ─────────────────────── */
    var safeArea = tg.safeAreaInset;
    if (safeArea) {
      var rs = document.documentElement.style;
      if (safeArea.top)    rs.setProperty('--tg-safe-top', safeArea.top + 'px');
      if (safeArea.bottom) rs.setProperty('--tg-safe-bottom', safeArea.bottom + 'px');
      if (safeArea.left)   rs.setProperty('--tg-safe-left', safeArea.left + 'px');
      if (safeArea.right)  rs.setProperty('--tg-safe-right', safeArea.right + 'px');
    }

    /* ── Header color ────────────────────────────────── */
    tg.setHeaderColor('secondary_bg_color');
    tg.setBackgroundColor('secondary_bg_color');

  } catch (e) {
    console.warn('Telegram WebApp init failed:', e);
  }

  /* ── Haptic Feedback Helper ─────────────────────────── */
  window.haptic = function (type) {
    try {
      if (tg && tg.HapticFeedback) {
        switch (type) {
          case 'light':   tg.HapticFeedback.impactOccurred('light'); break;
          case 'medium':  tg.HapticFeedback.impactOccurred('medium'); break;
          case 'heavy':   tg.HapticFeedback.impactOccurred('heavy'); break;
          case 'success': tg.HapticFeedback.notificationOccurred('success'); break;
          case 'error':   tg.HapticFeedback.notificationOccurred('error'); break;
          case 'warning': tg.HapticFeedback.notificationOccurred('warning'); break;
          default:        tg.HapticFeedback.impactOccurred('light');
        }
      }
    } catch (e) { /* silent */ }
  };

})();
