(function initSpiritClickDomain(global) {
    function createClickDomain({ store, state }) {
        return {
            setCoins(next) {
                store.set('game.coins', next);
            },
            addCoins(delta) {
                store.set('game.coins', state.game.coins + delta);
            }
        };
    }

    global.SpiritClickDomain = {
        createClickDomain
    };
})(window);