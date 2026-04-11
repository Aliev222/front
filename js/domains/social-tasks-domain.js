(function initSpiritSocialTasksDomain(global) {
    function createSocialTasksDomain(deps) {
        function getAllTaskIds() {
            const socialIds = (deps.SOCIAL_TASKS || []).map((task) => task.id);
            const cpaIds = (deps.CPA_TASKS || []).map((task) => task.id);
            return new Set([...socialIds, ...cpaIds]);
        }

        function applyServerTaskState(task) {
            if (!task?.id) return;
            const completed = !!task.completed || task.status === 'confirmed' || task.state === 'confirmed';
            const pending = !!task.pending || task.status === 'pending' || task.state === 'pending';
            const rejected = !!task.rejected || task.status === 'rejected' || task.state === 'rejected';
            deps.StateActions.patchSocialTask(task.id, {
                started: pending,
                completed,
                pending,
                rejected
            });
        }

        async function loadSocialTasksStatus() {
            deps.StateActions.setSocialTasks({});

            (deps.SOCIAL_TASKS || []).forEach((task) => {
                deps.StateActions.patchSocialTask(task.id, {
                    started: false,
                    completed: false,
                    pending: false,
                    rejected: false
                });
            });

            (deps.CPA_TASKS || []).forEach((task) => {
                deps.StateActions.patchSocialTask(task.id, {
                    started: false,
                    completed: false,
                    pending: false,
                    rejected: false
                });
            });

            if (!deps.userId()) return;

            try {
                const allTaskIds = getAllTaskIds();
                const applyTasks = (tasks) => {
                    (Array.isArray(tasks) ? tasks : [])
                        .filter((task) => allTaskIds.has(task.id))
                        .forEach(applyServerTaskState);
                    const hasCompleted = [...allTaskIds].some((taskId) => deps.State.tasks.social?.[taskId]?.completed);
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

            try {
                if (!deps.API?.get) return;
                const cpaStatus = await deps.API.get(`/api/cpa/tasks/${deps.userId()}`);
                const cpaTasks = Array.isArray(cpaStatus) ? cpaStatus : (Array.isArray(cpaStatus?.tasks) ? cpaStatus.tasks : []);
                cpaTasks.forEach(applyServerTaskState);
                deps.persistSocialTasksState();
            } catch (err) {
                if (deps.DEBUG) console.warn('CPA tasks sync skipped', err);
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
            const cpaMarkup = (deps.CPA_TASKS || []).length ? renderCpaTasksMarkup() : '';
            return `${cpaMarkup}${activeTasks.join('')}${completedMarkup}`;
        }

        function buildCpaRewardLabel(task) {
            if (task.rewardLabel) return task.rewardLabel;
            const raw = Number(task.reward || 0);
            if (!raw) return '+0 coins';
            return `+${raw.toLocaleString('en-US')} coins`;
        }

        function renderCpaTasksMarkup() {
            const cpaCards = (deps.CPA_TASKS || []).map((task) => {
                const state = deps.State.tasks.social?.[task.id] || {
                    started: false,
                    completed: false,
                    pending: false,
                    rejected: false
                };
                const isCompleted = !!state.completed;
                const isPending = !isCompleted && !!state.pending;
                const isRejected = !isCompleted && !!state.rejected;
                const actionLabel = isCompleted
                    ? 'Approved'
                    : (isPending ? 'Pending' : 'Open Partner');
                const actionHandler = isCompleted || isPending
                    ? ''
                    : `onclick="startCpaTask('${task.id}')"`;
                const statusCopy = isCompleted
                    ? 'Registration confirmed. Reward credited.'
                    : (isPending
                        ? 'Registration submitted. Waiting for partner confirmation.'
                        : (isRejected
                            ? 'Registration rejected by partner. You can retry.'
                            : 'Open partner offer, complete registration, then wait for automatic verification.'));
                const cardClass = [
                    'task-card',
                    'task-card-simple',
                    'social-task-card',
                    'social-cpa',
                    isCompleted ? 'is-claimed is-inactive' : '',
                    isPending ? 'is-pending' : '',
                    isRejected ? 'is-rejected' : ''
                ].join(' ').trim();

                return `
                    <div class="${cardClass}">
                        <div class="social-task-head">
                            <div class="social-task-brand">
                                <span class="social-task-icon">${task.icon || 'ID'}</span>
                                <span class="social-task-dot ${isCompleted ? 'is-off' : ''}"></span>
                                <span class="social-task-name">${task.name || 'CPA Partner'}</span>
                            </div>
                            <span class="task-reward-pill task-reward-pill-simple">${isCompleted ? 'Done' : buildCpaRewardLabel(task)}</span>
                        </div>
                        <div class="task-copy-simple">
                            <div class="task-title">${task.title || `Register in ${task.name || 'partner offer'}`}</div>
                            <div class="task-desc">${statusCopy}</div>
                        </div>
                        <div class="task-actions-simple">
                            <div class="social-task-preview">
                                <img src="${task.image || 'imgg/coin.png'}" alt="${task.name || 'CPA'}" onerror="this.src='imgg/coin.png'">
                            </div>
                            <button class="task-action task-action-simple social-action social-cpa ${isPending ? 'is-pending' : ''}" ${actionHandler} ${isCompleted || isPending ? 'disabled' : ''}>
                                ${actionLabel}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="tasks-cpa-block">
                    <div class="tasks-cpa-title">CPA Registration</div>
                    <div class="tasks-cpa-subtitle">Rewards are credited only after partner confirmation.</div>
                    <div class="tasks-cpa-list">${cpaCards}</div>
                </div>
            `;
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

        async function startCpaTask(taskId) {
            const task = (deps.CPA_TASKS || []).find((item) => item.id === taskId);
            if (!task) return;

            const link = task.link;
            if (deps.tg?.openLink) {
                deps.tg.openLink(link);
            } else {
                window.open(link, '_blank', 'noopener,noreferrer');
            }

            deps.StateActions.patchSocialTask(taskId, {
                started: true,
                completed: false,
                pending: true,
                rejected: false
            });
            deps.persistSocialTasksState();
            deps.renderVideoTasks();

            if (!deps.userId() || !deps.API?.post) return;
            try {
                const response = await deps.API.post('/api/cpa/tasks/start', {
                    user_id: deps.userId(),
                    task_id: taskId
                });
                if (response && typeof response === 'object') {
                    applyServerTaskState({ id: taskId, ...response });
                    deps.persistSocialTasksState();
                    deps.renderVideoTasks();
                }
            } catch (err) {
                if (deps.DEBUG) console.warn('CPA task start request skipped', err);
            }
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
            startCpaTask,
            claimSocialTask
        };
    }

    global.SpiritSocialTasksDomain = {
        createSocialTasksDomain
    };
})(window);
