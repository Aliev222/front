(function initSpiritTasksEventsDomain(global) {
    function createTasksEventsDomain({ t, VIDEO_TASKS, DEBUG }) {
        function renderEventImmediatePlaceholder() {
            const list = document.getElementById('event-leaderboard-list');
            const resultsList = document.getElementById('event-results-list');
            const loadingText = t('common.loading');
            if (list) list.innerHTML = `<div class="loading">${loadingText}</div>`;
            if (resultsList) resultsList.innerHTML = `<div class="loading">${loadingText}</div>`;
        }

        function applyVideoTaskStatus(response) {
            const taskMap = new Map((response?.tasks || []).map((task) => [task.task_id, task]));
            VIDEO_TASKS.forEach((task) => {
                const serverTask = taskMap.get(task.id);
                task.available = serverTask ? !!serverTask.available : true;
                task.remainingSeconds = serverTask ? Number(serverTask.remaining_seconds || 0) : 0;
            });
        }

        function resetVideoTaskStatus() {
            VIDEO_TASKS.forEach((task) => {
                task.available = true;
                task.remainingSeconds = 0;
            });
        }

        function buildVideoTaskViewModel(task, { I18N, UI_LANG, tFn }) {
            const available = task.available;
            const timeLeft = Math.ceil((task.remainingSeconds || 0) / 60);
            const taskCopy = I18N[UI_LANG]?.tasksList?.[task.id] || I18N.en.tasksList[task.id] || {};
            const rewardValue = taskCopy.reward || task.reward;
            const rewardLabel = typeof rewardValue === 'number'
                ? `+${rewardValue.toLocaleString(UI_LANG === 'ru' ? 'ru-RU' : 'en-US')} ${tFn('tasks.coinsSuffix')}`
                : rewardValue;
            const actionLabel = available ? tFn('tasks.watch') : tFn('tasks.locked');
            const stateText = available
                ? `${taskCopy.description || task.description} • ${rewardLabel}`
                : `${tFn('tasks.refreshIn', { time: timeLeft })} • ${rewardLabel}`;

            return {
                available,
                timeLeft,
                title: taskCopy.title || task.title,
                rewardLabel,
                actionLabel,
                stateText
            };
        }

        async function loadTournamentPrizePoolData({ silent = false, fetchTournamentOverview, renderPrizePoolDrawer }) {
            try {
                const overview = await fetchTournamentOverview();
                if (!overview) {
                    renderPrizePoolDrawer(null);
                    return null;
                }
                renderPrizePoolDrawer(overview);
                return overview;
            } catch (err) {
                if (!silent) console.error('Prize pool drawer error:', err);
                renderPrizePoolDrawer(null);
                return null;
            }
        }

        async function loadTournamentData({
            fetchTournamentOverview,
            renderPendingTonWalletNotice,
            renderEventOverview,
            updateOnlineCounterVisibility,
            eventSelectedLeague,
            deriveEventLeague,
            State,
            selectEventLeague,
            startTournamentTimer
        }) {
            try {
                renderEventImmediatePlaceholder();
                const overview = await fetchTournamentOverview();
                if (!overview) return;

                renderPendingTonWalletNotice(overview?.pending_ton_notice || null);
                renderEventOverview(overview);
                updateOnlineCounterVisibility();
                const preferredLeague = eventSelectedLeague() || overview?.player?.league || deriveEventLeague(State.game.level || 1);
                await selectEventLeague(preferredLeague);
                startTournamentTimer(overview.time_left_seconds || 0);
            } catch (err) {
                console.error('Event error:', err);
                const list = document.getElementById('event-leaderboard-list');
                if (list) list.innerHTML = '<div class="loading">Failed to load event data.</div>';
            }
        }

        return {
            renderEventImmediatePlaceholder,
            applyVideoTaskStatus,
            resetVideoTaskStatus,
            buildVideoTaskViewModel,
            loadTournamentPrizePoolData,
            loadTournamentData
        };
    }

    global.SpiritTasksEventsDomain = {
        createTasksEventsDomain
    };
})(window);