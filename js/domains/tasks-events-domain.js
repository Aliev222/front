(function initSpiritTasksEventsDomain(global) {
    function createTasksEventsDomain({ t }) {
        function renderEventImmediatePlaceholder() {
            const list = document.getElementById('event-leaderboard-list');
            const resultsList = document.getElementById('event-results-list');
            const loadingText = t('common.loading');
            if (list) list.innerHTML = `<div class="loading">${loadingText}</div>`;
            if (resultsList) resultsList.innerHTML = `<div class="loading">${loadingText}</div>`;
        }

        return {
            renderEventImmediatePlaceholder
        };
    }

    global.SpiritTasksEventsDomain = {
        createTasksEventsDomain
    };
})(window);