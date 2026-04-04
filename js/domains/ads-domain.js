(function initSpiritAdsDomain(global) {
    function createAdsDomain({ sleep, debugLog, debugError, adNotConfirmedMessage }) {
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

        return {
            isAdConfirmationPendingError,
            resolveRewardedAdErrorMessage,
            claimAdActionWithRetry
        };
    }

    global.SpiritAdsDomain = {
        createAdsDomain
    };
})(window);