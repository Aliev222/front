(function initSpiritSkinsDomain(global) {
    function createSkinsDomain(deps) {
        async function selectSkinInternal(id, { closeDetail = false } = {}) {
            if (!deps.userId()) return false;
            if (deps.State.skins.selectInFlight || deps.State.skins.selected === id) return false;
            deps.store.set('skins.selectInFlight', true);
            const prevSelected = deps.State.skins.selected;
            deps.store.set('skins.selected', id);
            deps.applySavedSkin();
            deps.renderSkins();
            if (closeDetail) deps.closeSkinDetail();
            try {
                await deps.API.post('/api/select-skin', { user_id: deps.userId(), skin_id: id });
                deps.showToast(deps.tr('toasts.skinSelected'));
                return true;
            } catch (err) {
                deps.store.set('skins.selected', prevSelected);
                deps.applySavedSkin();
                deps.renderSkins();
                deps.showToast(deps.tr('toasts.skinSelectError'), true);
                return false;
            } finally {
                deps.store.set('skins.selectInFlight', false);
            }
        }

        async function unlockSkinInternal(skinId, {
            closeDetail = false,
            applyCharm = false,
            showAlreadyOwnedToast = false,
            errorToastKey = 'toasts.skinUnlockError'
        } = {}) {
            if (!deps.userId()) {
                deps.showToast(deps.tr('toasts.authRequired'), true);
                return false;
            }
            if (deps.State.skins.owned.includes(skinId)) {
                if (showAlreadyOwnedToast) deps.showToast(deps.tr('toasts.skinAlreadyOwned'));
                if (applyCharm) deps.setCharmImageFromSkin(skinId);
                if (closeDetail) deps.closeSkinDetail();
                return false;
            }

            try {
                const res = await deps.API.post('/api/unlock-skin', { user_id: deps.userId(), skin_id: skinId, method: 'free' });
                if (!res?.success) return false;
                deps.store.set('skins.owned', [...deps.State.skins.owned, skinId]);
                deps.showToast(deps.tr('toasts.skinNew'));
                if (applyCharm) deps.setCharmImageFromSkin(skinId);
                if (closeDetail) deps.closeSkinDetail();
                deps.renderSkins();
                deps.applySavedSkin();
                deps.updateCollectionProgress();
                return true;
            } catch (err) {
                deps.showToast(deps.tr(errorToastKey), true);
                return false;
            }
        }

        async function watchAdForSkin(skinId) {
            if (!deps.isAdsgramReady()) {
                deps.showToast(deps.tr('toasts.adUnavailable'), true);
                return;
            }

            const skin = deps.State.skins.data.find((s) => s.id === skinId);
            const cooldownKey = `skin:${skin?.requirement?.progressKey || skinId}`;
            const cooldownRemainingMs = deps.getAdCooldownRemainingMs(cooldownKey);
            if (cooldownRemainingMs > 0) {
                deps.showToast(`Skin cooldown ${deps.formatCooldownClock(cooldownRemainingMs / 1000)}`, true);
                if (document.getElementById('skin-detail-modal')?.classList.contains('active')) {
                    deps.openSkinDetail(skinId);
                }
                return;
            }

            deps.showToast(deps.tr('toasts.adLoading'));

            try {
                const adSessionId = await deps.openRewardedAdWithSession('ads_increment');
                await deps.confirmAdsgramAdSession(adSessionId);
                const adsSync = await deps.claimAdActionWithRetry(() => deps.API.post('/api/ads/increment', {
                    user_id: deps.userId(),
                    ad_session_id: adSessionId,
                    skin_id: skinId
                }));
                deps.debugLog('ads', 'reward applied in UI', { flow: 'ads_increment', skinId, currentCount: adsSync?.current_count });

                const key = deps.State.skins.data.find((s) => s.id === skinId)?.requirement?.progressKey || skinId;
                const nextVideoViews = { ...deps.State.skins.videoViews, [key]: Number(adsSync?.current_count || 0) };
                deps.store.set('skins.videoViews', nextVideoViews);
                localStorage.setItem('videoSkinViews', JSON.stringify(nextVideoViews));
                deps.store.set('skins.adsWatched', adsSync?.ads_watched || ((deps.State.skins.adsWatched || 0) + 1));
                deps.setAdCooldownFromIso(`skin:${key}`, adsSync?.next_allowed_at || null, Number(adsSync?.cooldown_minutes || 10));

                deps.trackAchievementProgress('adsWatched', 1);
                deps.checkAchievements();

                deps.showToast(deps.tr('toasts.skinAdProgress'));
                deps.renderSkins();

                if (document.getElementById('skin-detail-modal')?.classList.contains('active')) {
                    deps.openSkinDetail(skinId);
                }
            } catch (e) {
                deps.showToast(
                    deps.resolveRewardedAdErrorMessage(e, deps.tr('toasts.watchError')),
                    true
                );
            }
        }

        return {
            selectSkinInternal,
            unlockSkinInternal,
            watchAdForSkin
        };
    }

    global.SpiritSkinsDomain = {
        createSkinsDomain
    };
})(window);