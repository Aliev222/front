(function initSpiritSkinsDomain(global) {
    function createSkinsDomain(deps) {
        async function selectSkinInternal(id, { closeDetail = false } = {}) {
            if (!deps.userId()) return false;
            if (deps.State.skins.selectInFlight || deps.State.skins.selected === id) return false;
            deps.State.skins.selectInFlight = true;
            const prevSelected = deps.State.skins.selected;
            deps.State.skins.selected = id;
            deps.applySavedSkin();
            deps.renderSkins();
            if (closeDetail) deps.closeSkinDetail();
            try {
                await deps.API.post('/api/select-skin', { user_id: deps.userId(), skin_id: id });
                deps.showToast(deps.tr('toasts.skinSelected'));
                return true;
            } catch (err) {
                deps.State.skins.selected = prevSelected;
                deps.applySavedSkin();
                deps.renderSkins();
                deps.showToast(deps.tr('toasts.skinSelectError'), true);
                return false;
            } finally {
                deps.State.skins.selectInFlight = false;
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
                deps.State.skins.owned.push(skinId);
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

        return {
            selectSkinInternal,
            unlockSkinInternal
        };
    }

    global.SpiritSkinsDomain = {
        createSkinsDomain
    };
})(window);