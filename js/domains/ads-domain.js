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
            console.log(`AD_TRACE_CLAIM_START attempts=${attempts} delayMs=${delayMs}`);
            let lastError = null;
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                try {
                    console.log(`AD_TRACE_CLAIM_ATTEMPT attempt=${attempt + 1}/${attempts}`);
                    debugLog('ads', 'activate endpoint start', { attempt: attempt + 1 });
                    const result = await claimFn();
                    console.log(`AD_TRACE_CLAIM_SUCCESS attempt=${attempt + 1} result=${JSON.stringify(result)}`);
                    debugLog('ads', 'activate endpoint end', { attempt: attempt + 1, success: true });
                    return result;
                } catch (err) {
                    lastError = err;
                    console.log(`AD_TRACE_CLAIM_ERROR attempt=${attempt + 1} error=${err?.detail || err?.message}`);
                    debugError('ads', 'activate endpoint error', {
                        attempt: attempt + 1,
                        error: err?.detail || err?.message || String(err)
                    });
                    if (!isAdConfirmationPendingError(err) || attempt === attempts - 1) {
                        console.log(`AD_TRACE_CLAIM_THROW attempt=${attempt + 1} error=${err?.message}`);
                        throw err;
                    }
                    console.log(`AD_TRACE_CLAIM_RETRY attempt=${attempt + 1} delayMs=${delayMs}`);
                    await sleep(delayMs);
                }
            }
            console.log(`AD_TRACE_CLAIM_FINAL_ERROR error=${lastError?.message}`);
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
            console.log(`AD_TRACE_PREWARM_START action=${action}`);
            if (!userId() || !action) {
                console.log(`AD_TRACE_PREWARM_SKIP action=${action} userId=${!!userId()}`);
                return;
            }
            const now = Date.now();
            const existing = adSessionPrefetch.get(action);
            if (existing && (now - existing.createdAt) < AD_SESSION_PREFETCH_MAX_AGE_MS) {
                console.log(`AD_TRACE_PREWARM_SKIP action=${action} already_cached`);
                return;
            }

            const promise = requestAdActionSession(action, { logClick: false, source: 'prefetch' })
                .then((adSessionId) => {
                    const current = adSessionPrefetch.get(action);
                    if (current && current.promise === promise) {
                        current.adSessionId = adSessionId;
                    }
                    console.log(`AD_TRACE_PREWARM_SUCCESS action=${action} sessionId=${adSessionId}`);
                    return adSessionId;
                })
                .catch((err) => {
                    const current = adSessionPrefetch.get(action);
                    if (current && current.promise === promise) {
                        adSessionPrefetch.delete(action);
                    }
                    console.log(`AD_TRACE_PREWARM_ERROR action=${action} error=${err?.message}`);
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
            console.log(`AD_TRACE_PREWARM_END action=${action}`);
        }

        async function consumeAdActionSession(action) {
            console.log(`AD_TRACE_CONSUME_START action=${action}`);
            const now = Date.now();
            const existing = adSessionPrefetch.get(action);
            if (existing && (now - existing.createdAt) < AD_SESSION_PREFETCH_MAX_AGE_MS) {
                console.log(`AD_TRACE_CONSUME_PREFETCH_HIT action=${action}`);
                adSessionPrefetch.delete(action);
                const sessionId = await existing.promise;
                console.log(`AD_TRACE_CONSUME_END action=${action} sessionId=${sessionId} source=prefetch`);
                return sessionId;
            }
            console.log(`AD_TRACE_CONSUME_FRESH action=${action}`);
            const sessionId = await startAdActionSession(action);
            console.log(`AD_TRACE_CONSUME_END action=${action} sessionId=${sessionId} source=fresh`);
            return sessionId;
        }

        async function showRewardedAd(adSessionId = null, adUnavailableMessage) {
            console.log(`AD_TRACE_SHOW_START adSessionId=${adSessionId}`);
            debugLog('ads', 'controller init start', { adSessionId });
            let controller;
            try {
                console.log(`AD_TRACE_SDK_INIT_START`);
                controller = await initAdsgramController();
                console.log(`AD_TRACE_SDK_INIT_SUCCESS controller=${!!controller}`);
            } catch (err) {
                console.log(`AD_TRACE_SDK_INIT_ERROR error=${err?.message} stack=${err?.stack}`);
                debugError('ads', 'controller init error', err);
                throw err;
            }
            debugLog('ads', 'controller init ready=true', { adSessionId });

            try {
                setAdInputBlocked(true);
                console.log(`AD_TRACE_SHOW_CALL_START adSessionId=${adSessionId}`);
                const result = await controller.show();
                console.log(`AD_TRACE_SHOW_RESULT adSessionId=${adSessionId} result=${JSON.stringify(result)}`);
                debugLog('ads', 'controller.show result', result || null);
                if (result?.done !== true) {
                    console.log(`AD_TRACE_SHOW_NOT_DONE adSessionId=${adSessionId} done=${result?.done} description=${result?.description}`);
                    throw new Error(result?.description || 'Ad was not completed');
                }
                console.log(`AD_TRACE_SHOW_SUCCESS adSessionId=${adSessionId}`);
                return result;
            } catch (err) {
                console.log(`AD_TRACE_SHOW_ERROR adSessionId=${adSessionId} error=${err?.message} stack=${err?.stack}`);
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
            console.log(`AD_TRACE_OPEN_START action=${action}`);
            try {
                const adSessionId = await consumeAdActionSession(action);
                console.log(`AD_TRACE_OPEN_SESSION_OK action=${action} sessionId=${adSessionId}`);
                prewarmAdActionSession(action);
                console.log(`AD_TRACE_OPEN_SHOW_START action=${action} sessionId=${adSessionId}`);
                await showRewardedAd(adSessionId, adUnavailableMessage);
                console.log(`AD_TRACE_OPEN_SUCCESS action=${action} sessionId=${adSessionId}`);
                return adSessionId;
            } catch (err) {
                console.log(`AD_TRACE_OPEN_ERROR action=${action} error=${err?.message} stack=${err?.stack}`);
                throw err;
            }
        }

        async function confirmAdsgramAdSession(adSessionId, { attempts = 6, delayMs = 1500 } = {}) {
            console.log(`AD_TRACE_CONFIRM_START adSessionId=${adSessionId} attempts=${attempts}`);
            if (!userId() || !adSessionId) {
                console.log(`AD_TRACE_CONFIRM_INVALID userId=${!!userId()} sessionId=${!!adSessionId}`);
                throw new Error('Ad session was not created');
            }

            let lastError = null;
            for (let attempt = 0; attempt < attempts; attempt += 1) {
                try {
                    console.log(`AD_TRACE_CONFIRM_ATTEMPT adSessionId=${adSessionId} attempt=${attempt + 1}/${attempts}`);
                    const result = await API.post('/api/ads/adsgram/complete', {
                        user_id: userId(),
                        ad_session_id: adSessionId
                    });
                    console.log(`AD_TRACE_CONFIRM_SUCCESS adSessionId=${adSessionId} attempt=${attempt + 1} result=${JSON.stringify(result)}`);
                    return result;
                } catch (err) {
                    lastError = err;
                    console.log(`AD_TRACE_CONFIRM_ERROR adSessionId=${adSessionId} attempt=${attempt + 1} error=${err?.detail || err?.message}`);
                    debugError('ads', '/api/ads/adsgram/complete error', {
                        adSessionId,
                        attempt: attempt + 1,
                        error: err?.detail || err?.message || String(err)
                    });
                    if (!isAdConfirmationPendingError(err) || attempt === attempts - 1) {
                        console.log(`AD_TRACE_CONFIRM_THROW adSessionId=${adSessionId} attempt=${attempt + 1} error=${err?.message}`);
                        throw err;
                    }
                    console.log(`AD_TRACE_CONFIRM_RETRY adSessionId=${adSessionId} attempt=${attempt + 1} delayMs=${delayMs}`);
                    await sleep(delayMs);
                }
            }

            console.log(`AD_TRACE_CONFIRM_FINAL_ERROR adSessionId=${adSessionId} error=${lastError?.message}`);
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