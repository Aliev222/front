(function initSpiritAdsDomain(global) {
    function createAdsDomain({ sleep, debugLog, debugError, adNotConfirmedMessage, userId, API, State, store, syncModalOpenState, initAdsgramController }) {
        const AD_SESSION_PREFETCH_MAX_AGE_MS = 120000;
        const adSessionPrefetch = new Map();

        function isAdConfirmationPendingError(err) {
            const detail = String(err?.detail || err?.message || '').toLowerCase();
            return detail.includes('ad completion was not confirmed yet') || detail.includes('ad watch is not completed yet');
        }

        function resolveRewardedAdErrorMessage(err, fallbackMessage) {
            if (isAdConfirmationPendingError(err)) {
                return adNotConfirmedMessage();
            }
            const detail = String(err?.detail || err?.message || '').trim();
            if (detail) {
                return detail;
            }
            return fallbackMessage;
        }

        async function claimAdActionWithRetry(claimFn, { attempts = 15, delayMs = 1500 } = {}) {
            let lastError = null;
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                try {
                    debugLog('ads', 'activate endpoint start', { attempt: attempt + 1 });
                    const result = await claimFn();
                    debugLog('ads', 'activate endpoint end', { attempt: attempt + 1, success: true });
                    return result;
                } catch (err) {
                    lastError = err;
                    debugError('ads', 'activate endpoint error', {
                        attempt: attempt + 1,
                        error: err?.detail || err?.message || String(err)
                    });
                    if (!isAdConfirmationPendingError(err) || attempt === attempts - 1) {
                        throw err;
                    }
                    await sleep(delayMs);
                }
            }
            throw lastError || new Error('Ad claim failed');
        }

        function setAdInputBlocked(blocked) {
            store.set('temp.adInputBlocked', !!blocked);
            let overlay = State.temp.adBlockerEl;
            if (blocked) {
                if (!overlay) {
                    overlay = document.createElement('div');
                    overlay.className = 'ad-input-blocker';
                    overlay.style.position = 'fixed';
                    overlay.style.inset = '0';
                    overlay.style.zIndex = '2147483647';
                    overlay.style.pointerEvents = 'all';
                    overlay.style.background = 'transparent';
                    overlay.style.touchAction = 'none';
                    document.body.appendChild(overlay);
                    store.set('temp.adBlockerEl', overlay);
                }
            } else if (overlay) {
                overlay.remove();
                store.set('temp.adBlockerEl', null);
            }
            syncModalOpenState();
        }

        async function requestAdActionSession(action, { logClick = true, source = 'interactive' } = {}) {
            if (logClick) {
                debugLog('ads', 'ad click', { action });
            }
            if (!userId()) {
                throw new Error('Authentication required');
            }

            const response = await API.post('/api/ad-action/start', {
                user_id: userId(),
                action
            });

            if (!response?.ad_session_id) {
                throw new Error('Ad session was not created');
            }

            return response.ad_session_id;
        }

        async function startAdActionSession(action) {
            return requestAdActionSession(action, { logClick: true, source: 'interactive' });
        }

        function prewarmAdActionSession(action) {
            if (!userId() || !action) return;
            const now = Date.now();
            const existing = adSessionPrefetch.get(action);
            if (existing && (now - existing.createdAt) < AD_SESSION_PREFETCH_MAX_AGE_MS) {
                return;
            }

            const promise = requestAdActionSession(action, { logClick: false, source: 'prefetch' })
                .then((adSessionId) => {
                    const current = adSessionPrefetch.get(action);
                    if (current && current.promise === promise) {
                        current.adSessionId = adSessionId;
                    }
                    return adSessionId;
                })
                .catch((err) => {
                    const current = adSessionPrefetch.get(action);
                    if (current && current.promise === promise) {
                        adSessionPrefetch.delete(action);
                    }
                    debugLog('ads', 'prefetch skipped', {
                        action,
                        error: err?.detail || err?.message || String(err)
                    });
                    return null;
                });

            adSessionPrefetch.set(action, {
                createdAt: now,
                promise,
                adSessionId: null
            });
        }

        async function consumeAdActionSession(action) {
            const now = Date.now();
            const existing = adSessionPrefetch.get(action);
            if (existing && (now - existing.createdAt) < AD_SESSION_PREFETCH_MAX_AGE_MS) {
                adSessionPrefetch.delete(action);
                return await existing.promise;
            }
            return await startAdActionSession(action);
        }

        async function showRewardedAd(adSessionId = null, adUnavailableMessage) {
            debugLog('ads', 'controller init start', { adSessionId });
            const controller = await initAdsgramController();
            if (!controller) {
                debugLog('ads', 'controller init ready=false', { adSessionId });
                throw new Error(adUnavailableMessage || 'Ad unavailable');
            }
            debugLog('ads', 'controller init ready=true', { adSessionId });

            try {
                setAdInputBlocked(true);
                const result = await controller.show();
                debugLog('ads', 'controller.show result', result || null);
                if (result?.done !== true) {
                    throw new Error(result?.description || 'Ad was not completed');
                }
                return result;
            } catch (err) {
                debugError('ads', 'controller.show error', err);
                const detail = String(err?.description || err?.message || '').trim();
                if (detail) {
                    throw new Error(detail);
                }
                throw err;
            } finally {
                setAdInputBlocked(false);
            }
        }

        async function openRewardedAdWithSession(action, adUnavailableMessage) {
            const adSessionId = await consumeAdActionSession(action);
            prewarmAdActionSession(action);
            await showRewardedAd(adSessionId, adUnavailableMessage);
            return adSessionId;
        }

        async function confirmAdsgramAdSession(adSessionId, { attempts = 6, delayMs = 1500 } = {}) {
            if (!userId() || !adSessionId) {
                throw new Error('Ad session was not created');
            }

            let lastError = null;
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                try {
                    return await API.post('/api/ads/adsgram/complete', {
                        user_id: userId(),
                        ad_session_id: adSessionId
                    });
                } catch (err) {
                    lastError = err;
                    debugError('ads', '/api/ads/adsgram/complete error', {
                        adSessionId,
                        attempt: attempt + 1,
                        error: err?.detail || err?.message || String(err)
                    });
                    if (!isAdConfirmationPendingError(err) || attempt === attempts - 1) {
                        throw err;
                    }
                    await sleep(delayMs);
                }
            }

            throw lastError || new Error('Ad completion was not confirmed yet');
        }

        return {
            isAdConfirmationPendingError,
            resolveRewardedAdErrorMessage,
            claimAdActionWithRetry,
            setAdInputBlocked,
            requestAdActionSession,
            startAdActionSession,
            prewarmAdActionSession,
            consumeAdActionSession,
            showRewardedAd,
            openRewardedAdWithSession,
            confirmAdsgramAdSession
        };
    }

    global.SpiritAdsDomain = {
        createAdsDomain
    };
})(window);