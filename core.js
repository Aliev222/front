/* ===============================
   RYOHO CLICKER OPTIMIZED CORE
================================ */

'use strict'

/* ===============================
   CONFIG
================================ */

const CONFIG = {
    API_URL: "https://ryoho.onrender.com",
    CLICK_BATCH_INTERVAL: 1000,
    PASSIVE_INTERVAL: 3600000,
    CACHE_TTL: 30000,
    ENERGY_RECHARGE_TIME: 600000
}

/* ===============================
   STATE
================================ */

const State = {

    user: {
        id: null,
        username: null
    },

    coins: 0,
    energy: 0,
    maxEnergy: 100,

    profitPerTap: 1,

    clickBuffer: 0,
    clickGain: 0,

    cache: new Map(),

    timers: {},

}

/* ===============================
   TELEGRAM INIT
================================ */

const TelegramApp = (() => {

    const tg = window.Telegram?.WebApp

    function init() {

        if (!tg) return

        tg.expand()
        tg.enableClosingConfirmation?.()

        const user = tg.initDataUnsafe?.user

        if (user) {

            State.user.id = user.id
            State.user.username = user.username || `user_${user.id}`

        }

    }

    return { init }

})()

/* ===============================
   API MANAGER
================================ */

const API = (() => {

    async function request(path, options = {}) {

        const controller = new AbortController()

        const timeout = setTimeout(() => controller.abort(), 8000)

        try {

            const res = await fetch(CONFIG.API_URL + path, {
                ...options,
                headers: {
                    "Content-Type": "application/json"
                },
                signal: controller.signal
            })

            clearTimeout(timeout)

            if (!res.ok) throw new Error(res.status)

            return await res.json()

        } catch (err) {

            console.error("API error:", err)

            throw err
        }

    }

    return { request }

})()

/* ===============================
   CACHE
================================ */

const Cache = {

    get(key) {

        const item = State.cache.get(key)

        if (!item) return null

        if (Date.now() - item.time > CONFIG.CACHE_TTL) {

            State.cache.delete(key)
            return null

        }

        return item.data

    },

    set(key, data) {

        State.cache.set(key, {
            data,
            time: Date.now()
        })

    }

}

/* ===============================
   CLICK ENGINE
================================ */

const ClickEngine = (() => {

    let lastClick = 0

    function tap(gain = 1) {

        const now = Date.now()

        if (now - lastClick < 40) return
        lastClick = now

        if (State.energy <= 0) return

        State.coins += gain
        State.energy--

        State.clickBuffer++
        State.clickGain += gain

        UI.update()

        if (!State.timers.clickBatch) {

            State.timers.clickBatch =
                setTimeout(sendBatch, CONFIG.CLICK_BATCH_INTERVAL)

        }

    }

    async function sendBatch() {

        const clicks = State.clickBuffer
        const gain = State.clickGain

        State.clickBuffer = 0
        State.clickGain = 0
        State.timers.clickBatch = null

        if (!State.user.id || clicks === 0) return

        try {

            await API.request("/api/click", {
                method: "POST",
                body: JSON.stringify({
                    user_id: State.user.id,
                    clicks,
                    gain
                })
            })

        } catch (e) {

            console.log("retry clicks")

            State.clickBuffer += clicks
            State.clickGain += gain

        }

    }

    return { tap }

})()

/* ===============================
   PASSIVE INCOME
================================ */

const PassiveIncome = {

    async check() {

        if (!State.user.id) return

        try {

            const data = await API.request("/api/passive-income", {
                method: "POST",
                body: JSON.stringify({
                    user_id: State.user.id
                })
            })

            if (data.income > 0) {

                State.coins = data.coins

                UI.toast(`💰 +${data.income} coins`)

                UI.update()

            }

        } catch (e) {

            console.log("Passive error", e)

        }

    },

    start() {

        setInterval(() => {
            this.check()
        }, CONFIG.PASSIVE_INTERVAL)

    }

}

/* ===============================
   ADS
================================ */

const Ads = (() => {

    let controller = null

    async function init() {

        if (controller) return controller

        if (typeof TelegramAdsController === "undefined") {

            console.warn("Ads SDK not loaded")
            return null

        }

        controller = new TelegramAdsController()

        controller.initialize({
            pubId: "792361",
            appId: "1396",
            debug: false
        })

        return controller

    }

    async function rewarded(callback) {

        const ads = await init()

        if (!ads) return false

        try {

            await ads.triggerNativeNotification()

            await callback()

            UI.toast("🎁 Reward received")

            return true

        } catch (e) {

            console.log("Ad error", e)
            return false

        }

    }

    return { rewarded }

})()

/* ===============================
   UI
================================ */

const UI = {

    update() {

        const coins = document.getElementById("coins")
        const energy = document.getElementById("energy")

        if (coins) coins.innerText = State.coins
        if (energy) energy.innerText = State.energy

    },

    toast(text) {

        const el = document.createElement("div")

        el.className = "toast"
        el.innerText = text

        document.body.appendChild(el)

        setTimeout(() => el.remove(), 2500)

    }

}

/* ===============================
   INIT
================================ */

async function initApp() {

    TelegramApp.init()

    PassiveIncome.start()

    console.log("🚀 Optimized Clicker Loaded")

}

initApp()

/* ===============================
   GLOBAL EXPORT
================================ */

window.tap = ClickEngine.tap
window.showRewardedAd = Ads.rewarded
window.state = State