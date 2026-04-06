(function initSpiritTapFeedbackRenderer(global) {
    function createTapFeedbackRenderer(deps) {
        function render(payload) {
            const {
                clientX,
                clientY,
                isAutoTap,
                previewGain,
                ghostBoostActive,
                dailyInfiniteEnergyActive,
                megaBoostActive
            } = payload;

            requestAnimationFrame(() => {
                if (!deps.State.temp.tapPool) {
                    deps.store.set('temp.tapPool', Array.from({ length: deps.isLitePerformanceMode() ? 6 : 10 }, () => {
                        const el = document.createElement('div');
                        el.className = 'tap-effect-global';
                        el.style.position = 'fixed';
                        el.style.pointerEvents = 'none';
                        el.style.zIndex = '9999';
                        el.style.whiteSpace = 'nowrap';
                        document.body.appendChild(el);
                        return el;
                    }));
                    deps.store.set('temp.tapPoolIdx', 0);
                }

                const pool = deps.State.temp.tapPool;
                const idx = deps.State.temp.tapPoolIdx % pool.length;
                deps.store.set('temp.tapPoolIdx', deps.State.temp.tapPoolIdx + 1);
                const effect = pool[idx];
                const clickButton = document.getElementById('ryoho');
                const isNightMode = document.body.classList.contains('night-mode');
                const boostVisualActive = megaBoostActive || dailyInfiniteEnergyActive || ghostBoostActive;
                const tapColor = ghostBoostActive ? '#9CEBFF' : (boostVisualActive ? '#FFD700' : (isNightMode ? '#F7F4FF' : '#0090cc'));
                const tapGlow = ghostBoostActive ? 'rgba(156,235,255,0.95)' : (boostVisualActive ? '#FFD700' : (isNightMode ? 'rgba(247,244,255,0.92)' : 'rgba(0,144,204,0.45)'));

                effect.style.left = `${clientX}px`;
                effect.style.top = `${clientY}px`;
                effect.style.transform = 'translate(-50%, -50%)';
                effect.style.color = tapColor;
                effect.style.fontSize = isAutoTap ? '22px' : '28px';
                effect.style.fontWeight = isAutoTap ? '700' : 'bold';
                effect.style.textShadow = `0 0 10px ${tapGlow}`;
                effect.textContent = ghostBoostActive ? `+${previewGain} 🪽` : (boostVisualActive ? `+${previewGain} ⚡` : `+${previewGain}`);
                effect.style.animation = 'none';
                effect.style.opacity = '1';
                effect.offsetWidth;
                effect.style.animation = isAutoTap ? 'tapFloatAuto 0.42s ease-out forwards' : 'tapFloat 0.55s ease-out forwards';

                if (clickButton && !isAutoTap) {
                    clickButton.classList.remove('is-pressed');
                    clickButton.offsetWidth;
                    clickButton.classList.add('is-pressed');
                    clearTimeout(clickButton._pressFxTimer);
                    clickButton._pressFxTimer = setTimeout(() => clickButton.classList.remove('is-pressed'), 120);
                }

                const nowMs = Date.now();
                const allowAutoFeedback = !isAutoTap || (nowMs - deps.State.temp.lastAutoFeedbackAt >= deps.autoFeedbackIntervalMs);

                if (deps.State.settings.sound && allowAutoFeedback) {
                    try {
                        const audioCtx = deps.getAudioContextForSfx();
                        if (audioCtx) {
                            const now = audioCtx.currentTime;
                            const osc = audioCtx.createOscillator();
                            const gainNode = audioCtx.createGain();
                            osc.connect(gainNode);
                            gainNode.connect(audioCtx.destination);
                            osc.type = boostVisualActive ? 'sawtooth' : 'sine';
                            osc.frequency.setValueAtTime(ghostBoostActive ? 980 : (boostVisualActive ? 800 : (isAutoTap ? 560 : 650)), now);
                            osc.frequency.exponentialRampToValueAtTime(ghostBoostActive ? 540 : (boostVisualActive ? 400 : (isAutoTap ? 420 : 450)), now + (isAutoTap ? 0.08 : 0.1));
                            gainNode.gain.setValueAtTime(isAutoTap ? 0.12 : 0.2, now);
                            gainNode.gain.exponentialRampToValueAtTime(0.001, now + (isAutoTap ? 0.12 : 0.2));
                            osc.start(now);
                            osc.stop(now + (isAutoTap ? 0.12 : 0.2));
                        }
                    } catch (_) {}
                }

                if (deps.State.settings.vibration && allowAutoFeedback) {
                    try {
                        if (global.haptic) global.haptic(isAutoTap ? 'light' : 'medium');
                        else if (deps.tg?.HapticFeedback) deps.tg.HapticFeedback.impactOccurred(isAutoTap ? 'soft' : 'light');
                        else if (navigator.vibrate) navigator.vibrate(isAutoTap ? 12 : 20);
                    } catch (_) {}
                }

                if (isAutoTap && allowAutoFeedback) {
                    deps.store.set('temp.lastAutoFeedbackAt', nowMs);
                }
            });
        }

        return {
            render
        };
    }

    global.SpiritTapFeedbackRenderer = {
        createTapFeedbackRenderer
    };
})(window);
