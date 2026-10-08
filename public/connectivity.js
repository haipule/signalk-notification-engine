'use strict'

;(function exposeConnectivity(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.NotificationConnectivity = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const DEFAULT_FETCH_TIMEOUT_MS = 12000
  const DEFAULT_STALE_AFTER_MS = 15000

  /**
   * Fetch and decode one JSON response with a bounded deadline.
   *
   * The deadline is a local presentation safeguard only. It never changes a
   * Signal K notification; it prevents a frozen client from looking current
   * while the server is unreachable.
   *
   * @param {string} url API URL.
   * @param {{fetchFn?: Function, timeoutMs?: number, AbortControllerClass?: typeof AbortController, setTimer?: Function, clearTimer?: Function}} options Dependencies and deadline.
   * @returns {Promise<unknown>} Parsed JSON response.
   */
  async function fetchJsonWithTimeout(url, options = {}) {
    const fetchFn = options.fetchFn || fetch
    const timeoutMs = options.timeoutMs || DEFAULT_FETCH_TIMEOUT_MS
    const AbortControllerClass = options.AbortControllerClass || AbortController
    const setTimer = options.setTimer || setTimeout
    const clearTimer = options.clearTimer || clearTimeout
    const controller = new AbortControllerClass()
    const timer = setTimer(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchFn(url, { signal: controller.signal })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.json()
    } finally {
      clearTimer(timer)
    }
  }

  /**
   * Serialize refreshes while retaining one requested follow-up refresh.
   *
   * A reconnect event can arrive while a poll is still settling. Coalescing
   * calls prevents overlapping snapshots but guarantees one immediate retry
   * after the current request finishes.
   *
   * @param {() => Promise<void>} refresh Refresh operation.
   * @returns {() => Promise<void>} Safe refresh scheduler.
   */
  function createRefreshScheduler(refresh) {
    let running = null
    let pending = false
    const schedule = async () => {
      if (running) {
        pending = true
        return running
      }
      running = (async () => {
        do {
          pending = false
          await refresh()
        } while (pending)
      })()
      try {
        await running
      } finally {
        running = null
      }
    }
    return schedule
  }

  /**
   * Decide whether the client view has exceeded its freshness deadline.
   *
   * This is strictly presentation state: becoming stale disables local action
   * controls but never mutates the authoritative Signal K notification state.
   *
   * @param {number|null} lastSuccessMs Last successful snapshot time.
   * @param {number} nowMs Current time.
   * @param {number} startedMs Time at which this page started polling.
   * @param {number} staleAfterMs Maximum acceptable snapshot age.
   * @param {boolean} refreshInProgress Whether a bounded refresh is running.
   * @returns {boolean} Whether the displayed snapshot must be treated as stale.
   */
  function isRefreshStale(lastSuccessMs, nowMs, startedMs, staleAfterMs = DEFAULT_STALE_AFTER_MS, refreshInProgress = false) {
    if (refreshInProgress) return false
    const reference = Number.isFinite(lastSuccessMs) ? lastSuccessMs : startedMs
    return nowMs - reference >= staleAfterMs
  }

  /**
   * Decide whether a failed poll has exhausted the freshness allowance.
   *
   * Browser navigation and pull-to-refresh can abort an individual request.
   * That transport event is not proof that the last rendered snapshot became
   * stale; only its age determines when actions must be locked.
   *
   * @param {number|null} lastSuccessMs Last successful snapshot time.
   * @param {number} nowMs Current time.
   * @param {number} startedMs Time at which this page started polling.
   * @param {number} staleAfterMs Maximum acceptable snapshot age.
   * @returns {boolean} Whether the failed request must mark the view stale.
   */
  function shouldDisconnectAfterPollFailure(lastSuccessMs, nowMs, startedMs, staleAfterMs = DEFAULT_STALE_AFTER_MS) {
    return isRefreshStale(lastSuccessMs, nowMs, startedMs, staleAfterMs, false)
  }

  /**
   * Prevent a page that is already being replaced from painting a stale state.
   *
   * @param {boolean} isUnloading Whether page replacement has started.
   * @param {boolean} isStale Whether the normal connectivity deadline expired.
   * @returns {boolean} True only when the current live page should disconnect.
   */
  function shouldApplyDisconnect(isUnloading, isStale) {
    return isUnloading !== true && isStale === true
  }

  /**
   * Debounce native browser offline events that may flicker during navigation.
   *
   * A sustained offline state still locks actions promptly, while an `online`
   * event or restored `navigator.onLine` state cancels the provisional signal.
   *
   * @param {() => void} disconnect Apply the stale/offline presentation lock.
   * @param {{delayMs?: number, isOnline?: () => boolean, setTimer?: Function, clearTimer?: Function}} options Runtime dependencies.
   * @returns {{offline: () => void, online: () => void}} Event handlers.
   */
  function createOfflineDebouncer(disconnect, options = {}) {
    const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : 2000
    const isOnline = options.isOnline || (() => navigator.onLine)
    const setTimer = options.setTimer || setTimeout
    const clearTimer = options.clearTimer || clearTimeout
    let timer = null
    return {
      offline() {
        if (timer !== null) clearTimer(timer)
        timer = setTimer(() => {
          timer = null
          if (!isOnline()) disconnect()
        }, delayMs)
      },
      online() {
        if (timer !== null) clearTimer(timer)
        timer = null
      }
    }
  }

  return { DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_STALE_AFTER_MS, createRefreshScheduler, createOfflineDebouncer, fetchJsonWithTimeout, isRefreshStale, shouldApplyDisconnect, shouldDisconnectAfterPollFailure }
})
