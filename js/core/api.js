(function initSpiritApiModule(global) {
    function createApiClient(deps) {
        const {
            baseUrl,
            fetchImpl,
            debugLog,
            debugError,
            ensureApiSession,
            hasTelegramInitData
        } = deps;

        return {
            async request(endpoint, options = {}, retries = 2, authRetry = true) {
                const startedAt = performance.now();
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 10000);
                const method = String(options.method || 'GET').toUpperCase();
                const label = `${method} ${endpoint}`;
                const isRetryableRequest = ['GET', 'HEAD', 'OPTIONS'].includes(method) || options.idempotent === true;
                try {
                    const res = await fetchImpl(baseUrl + endpoint, {
                        ...options,
                        headers: { 'Content-Type': 'application/json', ...options.headers },
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    if (!res.ok) {
                        if (res.status === 401 && authRetry && hasTelegramInitData) {
                            await ensureApiSession(true);
                            return this.request(endpoint, options, retries, false);
                        }
                        const err = new Error(`HTTP ${res.status}`);
                        err.status = res.status;
                        try {
                            const data = await res.json();
                            err.detail = data?.detail || '';
                        } catch (_) {}
                        throw err;
                    }
                    const data = await res.json();
                    debugLog('api', `${label} success ${Math.round(performance.now() - startedAt)}ms`);
                    return data;
                } catch (err) {
                    clearTimeout(timeout);
                    debugError('api', `${label} fail ${Math.round(performance.now() - startedAt)}ms`, err);
                    if (isRetryableRequest && retries > 0 && (err.name === 'AbortError' || err.status >= 500)) {
                        await new Promise((resolve) => setTimeout(resolve, 1000));
                        return this.request(endpoint, options, retries - 1);
                    }
                    throw err;
                }
            },
            get(endpoint) {
                return this.request(endpoint);
            },
            post(endpoint, data, options = {}) {
                return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });
            }
        };
    }

    global.SpiritApi = {
        createApiClient
    };
})(window);