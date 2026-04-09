(function initSpiritSocialTasksDomain(global) {
    function createSocialTasksDomain(deps) {
        async function loadSocialTasksStatus() {
            deps.StateActions.setSocialTasks({});

            deps.SOCIAL_TASKS.forEach((task) => {
                deps.StateActions.patchSocialTask(task.id, {
                    started: false,
                    completed: false
                });
            });

            if (!deps.userId()) return;

            try {
                const applyTasks = (tasks) => {
                    (Array.isArray(tasks) ? tasks : [])
                        .filter((task) => deps.SOCIAL_TASKS.some((socialTask) => socialTask.id === task.id))
                        .forEach((task) => {
                            deps.StateActions.patchSocialTask(task.id, {
                                started: false,
                                completed: !!task.completed
                            });
                        });
                    const hasCompleted = deps.SOCIAL_TASKS.some((task) => deps.State.tasks.social?.[task.id]?.completed);
                    if (hasCompleted && typeof deps.setCompletedSocialTasksCollapsed === 'function') {
                        deps.setCompletedSocialTasksCollapsed(true);
                    }
                    deps.persistSocialTasksState();
                };

                const endpoint = `/api/tasks/${deps.userId()}`;
                const tasks = deps.API.cachedGet
                    ? await deps.API.cachedGet(endpoint, {
                        ttlMs: 45_000,
                        onFresh: (freshTasks) => {
                            applyTasks(freshTasks);
                            deps.renderVideoTasks();
                        }
                    })
                    : await deps.API.get(endpoint);

                applyTasks(tasks);
            } catch (err) {
                if (deps.DEBUG) console.warn('Social tasks sync failed', err);
            }
        }

        function renderSocialTasksMarkup() {
            const activeTasks = [];
            const completedTasks = [];

            deps.SOCIAL_TASKS.forEach((task) => {
                const state = deps.State.tasks.social[task.id] || { started: false, completed: false };
                const isCompleted = state.completed;
                const verificationUnavailable = task.verifyMode === 'unavailable';
                const canClaim = state.started && !state.completed && !verificationUnavailable;
                const requiresVerify = task.verifyMode === 'telegram';
                const actionLabel = isCompleted
                    ? 'Claimed'
                    : canClaim
                        ? (requiresVerify ? 'Verify' : 'Claim')
                        : (verificationUnavailable ? 'Open' : 'Subscribe');
                const actionHandler = isCompleted
                    ? ''
                    : canClaim
                        ? `onclick="claimSocialTask('${task.id}')"`
                        : `onclick="startSocialTask('${task.id}')"`;
                const statusCopy = isCompleted
                    ? 'Reward received'
                    : canClaim
                        ? (requiresVerify ? 'Join the channel and tap verify' : 'Open the page, then claim the reward')
                        : (verificationUnavailable
                            ? 'Open the page. Reward is disabled until server-side verification is added.'
                            : '20,000 coins and an exclusive skin reward');

                const cardMarkup = `
                    <div class="task-card task-card-simple social-task-card social-${task.colorClass} ${isCompleted ? 'is-claimed is-inactive' : ''}">
                        <div class="social-task-head">
                            <div class="social-task-brand">
                                <span class="social-task-icon">${task.icon}</span>
                                <span class="social-task-dot ${isCompleted ? 'is-off' : ''}"></span>
                                <span class="social-task-name">${task.name}</span>
                            </div>
                            <span class="task-reward-pill task-reward-pill-simple">${isCompleted ? 'Done' : '+20K + Skin'}</span>
                        </div>
                        <div class="task-copy-simple">
                            <div class="task-title">${`Follow ${task.name}`}</div>
                            <div class="task-desc">${statusCopy}</div>
                        </div>
                        <div class="task-actions-simple">
                            <div class="social-task-preview">
                                <img src="${task.image}" alt="${task.name}" onerror="this.src='imgg/skins/default.png'">
                            </div>
                            <button class="task-action task-action-simple social-action social-${task.colorClass}" ${actionHandler} ${isCompleted ? 'disabled' : ''}>
                                ${actionLabel}
                            </button>
                        </div>
                    </div>
                `;

                if (isCompleted) completedTasks.push(cardMarkup);
                else activeTasks.push(cardMarkup);
            });

            const completedCollapsed = deps.isCompletedSocialTasksCollapsed();
            const completedMarkup = completedTasks.length
                ? `
                    <div class="social-completed-block ${completedCollapsed ? 'is-collapsed' : ''}">
                        <button class="social-completed-title" type="button" onclick="toggleCompletedSocialTasks()">
                            <span>Completed</span>
                            <span class="social-completed-arrow">${completedCollapsed ? '?' : '?'}</span>
                        </button>
                        <div class="social-completed-list" ${completedCollapsed ? 'hidden' : ''}>
                            ${completedTasks.join('')}
                        </div>
                    </div>
                `
                : '';

            return `${activeTasks.join('')}${completedMarkup}`;
        }

        function startSocialTask(taskId) {
            const task = deps.SOCIAL_TASKS.find((item) => item.id === taskId);
            if (!task) return;

            const link = task.link;
            if (taskId === 'telegram_sub' && deps.tg?.openTelegramLink) {
                deps.tg.openTelegramLink(link);
            } else if (deps.tg?.openLink) {
                deps.tg.openLink(link);
            } else {
                window.open(link, '_blank', 'noopener,noreferrer');
            }

            deps.StateActions.patchSocialTask(taskId, {
                started: task.verifyMode !== 'unavailable',
                completed: false
            });
            deps.persistSocialTasksState();
            deps.renderVideoTasks();
        }

        async function claimSocialTask(taskId) {
            if (!deps.userId()) {
                deps.showToast(deps.tr('toasts.authRequired'), true);
                return;
            }

            try {
                const response = await deps.API.post('/api/complete-task', {
                    user_id: deps.userId(),
                    task_id: taskId
                });
                if (deps.API?.invalidateCached) {
                    deps.API.invalidateCached(`/api/tasks/${deps.userId()}`);
                }

                deps.StateActions.patchSocialTask(taskId, {
                    started: false,
                    completed: true
                });
                if (typeof deps.setCompletedSocialTasksCollapsed === 'function') {
                    deps.setCompletedSocialTasksCollapsed(true);
                }
                deps.persistSocialTasksState();

                if (typeof response.coins === 'number') {
                    deps.applyNonClickCoinsSnapshot('claimSocialTask', response);
                }

                if (response.skin_id) {
                    deps.StateActions.setOwnedSkins(deps.normalizeOwnedSkinIds([...(deps.State.skins.owned || []), response.skin_id]));
                    await deps.loadSkinsList();
                    deps.renderSkins();
                    deps.updateCollectionProgress();
                }

                deps.updateUI();
                deps.renderVideoTasks();
                deps.showToast(response.message || '? Reward claimed!', false, {
                    title: taskId === 'telegram_sub' ? 'Verified reward' : 'Reward claimed',
                    variant: 'reward',
                    side: taskId === 'telegram_sub' ? 'right' : 'left'
                });
            } catch (err) {
                if (String(err?.detail || '').includes('Task verification is not available yet')) {
                    deps.StateActions.patchSocialTask(taskId, {
                        started: false,
                        completed: false
                    });
                    deps.persistSocialTasksState();
                    deps.renderVideoTasks();
                }
                deps.showToast(err?.detail || deps.tr('toasts.serverError'), true);
            }
        }

        return {
            loadSocialTasksStatus,
            renderSocialTasksMarkup,
            startSocialTask,
            claimSocialTask
        };
    }

    global.SpiritSocialTasksDomain = {
        createSocialTasksDomain
    };
})(window);
