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

        const API_CACHE_PREFIX = 'spirit_api_cache:v1:';

        function buildCacheKey(endpoint) {
            return `${API_CACHE_PREFIX}${endpoint}`;
        }

        function readCached(endpoint, maxStaleMs = 24 * 60 * 60 * 1000) {
            try {
                const raw = localStorage.getItem(buildCacheKey(endpoint));
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const ts = Number(parsed?.ts || 0);
                if (!ts) return null;
                if (Date.now() - ts > maxStaleMs) return null;
                return { ts, data: parsed?.data };
            } catch (_) {
                return null;
            }
        }

        function writeCached(endpoint, data) {
            try {
                localStorage.setItem(
                    buildCacheKey(endpoint),
                    JSON.stringify({ ts: Date.now(), data })
                );
            } catch (_) {}
        }

        function removeCached(endpoint) {
            try {
                localStorage.removeItem(buildCacheKey(endpoint));
            } catch (_) {}
        }

        function removeCachedByPrefix(endpointPrefix) {
            try {
                const fullPrefix = buildCacheKey(endpointPrefix);
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(fullPrefix)) {
                        localStorage.removeItem(key);
                    }
                }
            } catch (_) {}
        }

        const apiClient = {
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
            async cachedGet(endpoint, options = {}) {
                const {
                    ttlMs = 30_000,
                    maxStaleMs = 24 * 60 * 60 * 1000,
                    forceRefresh = false,
                    onFresh = null
                } = options || {};

                const cached = readCached(endpoint, maxStaleMs);
                const hasCached = !!cached;
                const isFresh = hasCached && (Date.now() - cached.ts <= Number(ttlMs || 0));

                const fetchFresh = async () => {
                    const fresh = await this.request(endpoint);
                    writeCached(endpoint, fresh);
                    return fresh;
                };

                if (hasCached && !forceRefresh) {
                    if (!isFresh) {
                        fetchFresh()
                            .then((fresh) => {
                                if (typeof onFresh === 'function') {
                                    onFresh(fresh, { fromCache: false });
                                }
                            })
                            .catch((err) => {
                                debugError('api', `cached refresh fail GET ${endpoint}`, err);
                            });
                    }
                    return cached.data;
                }

                const fresh = await fetchFresh();
                if (typeof onFresh === 'function') {
                    onFresh(fresh, { fromCache: false });
                }
                return fresh;
            },
            setCached(endpoint, data) {
                writeCached(endpoint, data);
            },
            invalidateCached(endpoint) {
                removeCached(endpoint);
            },
            invalidateCachedPrefix(endpointPrefix) {
                removeCachedByPrefix(endpointPrefix);
            },
            post(endpoint, data, options = {}) {
                return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) });
            }
        };

        return apiClient;
    }

    global.SpiritApi = {
        createApiClient
    };
})(window);
