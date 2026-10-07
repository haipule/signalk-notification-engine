'use strict'

const pluginApi = '/plugins/signalk-notification-engine'
const { DEFAULT_STALE_AFTER_MS, createRefreshScheduler, fetchJsonWithTimeout, isRefreshStale } = window.NotificationConnectivity
const { compareNotificationPaths } = window.NotificationTableSort
const i18n = window.NotificationI18n
const t = (key, parameters) => i18n.t(key, parameters)
const notificationContainer = document.querySelector('#notifications')
const historyContainer = document.querySelector('#history')
const historyCount = document.querySelector('#history-count')
const summary = document.querySelector('#summary')
const template = document.querySelector('#notification-template')
const actionBar = document.querySelector('#actions')
const detailSheet = document.querySelector('#detail-sheet')
const visualAlerts = document.querySelector('#visual-alerts')
const healthBanner = document.querySelector('#health-banner')
const audioTestStart = document.querySelector('#start-audio-test')
const audioTestHeard = document.querySelector('#audio-test-heard')
const audioTestNotHeard = document.querySelector('#audio-test-not-heard')
const audioTestStatus = document.querySelector('#audio-test-status')
const audioTestSheet = document.querySelector('#audio-test-sheet')
const audioTestDueButton = document.querySelector('#show-audio-test')
const audioTestDays = document.querySelector('#audio-test-days')
let isConnected = false
let configurationReady = true
let currentConfigurationStatus = null
let lastSuccessfulRefreshAt = null
const pollingStartedAt = Date.now()
let refreshInProgress = false
const clientPollDiagnostics = { lastStartedAt: null, lastCompletedAt: null, durationMs: null, lastError: null }
let selectedId = null
let activeNotifications = []
let configuredStateOrder = ['warn', 'alert', 'nominal', 'normal']
let stateColors = {}
let visualRules = {}
let infoAutoCloseSeconds = 0
let infoCloseTimer = null
let shortcutInfo = 'i'
let shortcutHistory = 'h'
let historyFocusId = null
let historyFocusNotification = null
let historyPath = ''
let historyOccurrenceId = ''
let historyDisplayLimit = 20
let historyMode = 'selected'
const deletedHistoryOccurrenceIds = new Set()
let activeRules = []
let currentAudioTest = { state: 'idle', statement: 'No alarm sound test has been run yet.' }
const sortStorageKey = 'notification-engine.table-sort'
let tableSort = loadTableSort()

document.querySelector('#refresh').addEventListener('click', refresh)
for (const button of actionBar.querySelectorAll('[data-global-action]')) {
  button.addEventListener('click', () => runGlobalAction(button.dataset.globalAction))
}
document.querySelector('#close-detail').addEventListener('click', closeDetails)
document.querySelector('#show-history').addEventListener('click', () => showSelectedHistory())
document.querySelector('#show-alarm-history').addEventListener('click', showAlarmHistory)
document.querySelector('#show-rules').addEventListener('click', () => showSelectedRules())
document.querySelector('#close-history').addEventListener('click', closeHistory)
document.querySelector('#close-rules').addEventListener('click', closeRules)
document.querySelector('#show-diagnostics').addEventListener('click', showDiagnostics)
document.querySelector('#close-diagnostics').addEventListener('click', closeDiagnostics)
audioTestDueButton.addEventListener('click', showAudioTest)
document.querySelector('#close-audio-test').addEventListener('click', closeAudioTest)
document.querySelector('#delete-history').addEventListener('click', deleteLocalHistory)
audioTestStart.addEventListener('click', startAudioTest)
audioTestHeard.addEventListener('click', reportAudioTestHeard)
audioTestNotHeard.addEventListener('click', reportAudioTestNotHeard)
detailSheet.addEventListener('pointerdown', () => { detailSheet.style.zIndex = '12' })
document.querySelector('#history-sheet').addEventListener('pointerdown', event => { event.currentTarget.style.zIndex = '12'; detailSheet.style.zIndex = '11' })
document.querySelector('#history-more').addEventListener('click', () => { historyDisplayLimit += 20; renderSelectedHistory() })
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (detailSheet.getAttribute('aria-hidden') === 'false') closeDetails()
    if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false') closeHistory()
    if (document.querySelector('#rules-sheet').getAttribute('aria-hidden') === 'false') closeRules()
    if (document.querySelector('#diagnostics-sheet').getAttribute('aria-hidden') === 'false') closeDiagnostics()
    if (audioTestSheet.getAttribute('aria-hidden') === 'false') closeAudioTest()
    return
  }
  if (event.target.matches('input, textarea, select')) return
  if (shortcutInfo && event.key.toLowerCase() === shortcutInfo) {
    const notification = activeNotifications.find(item => item.id === selectedId) || activeNotifications[0]
    if (notification) {
      selectedId = notification.id
      renderDetails(notification)
      detailSheet.style.zIndex = '12'
      document.querySelector('#history-sheet').style.zIndex = '11'
      detailSheet.focus()
    }
  }
  if (shortcutHistory && event.key.toLowerCase() === shortcutHistory) {
    const notification = activeNotifications.find(item => item.id === selectedId) || activeNotifications[0]
    if (notification) {
      selectedId = notification.id
      showSelectedHistory(notification)
      document.querySelector('#history-sheet').style.zIndex = '12'
      detailSheet.style.zIndex = '11'
      document.querySelector('#history-sheet').focus()
    }
  }
})
document.addEventListener('click', event => {
  if (!selectedId) return
  if (event.target.closest('.notification-row, #detail-sheet, #history-sheet, #rules-sheet, #audio-test-sheet, #actions, #visual-alerts, #show-audio-test')) return
  selectedId = null
  renderNotifications(activeNotifications)
})
detailSheet.addEventListener('pointerdown', event => { detailSheet.dataset.pointerY = event.clientY })
detailSheet.addEventListener('pointerup', event => {
  if (event.clientY - Number(detailSheet.dataset.pointerY) > 70) closeDetails()
})
function enableDragging(sheet, dragButton) {
  let drag = null
  dragButton.addEventListener('pointerdown', event => {
  if (window.matchMedia('(max-width: 720px)').matches) return
  const rect = sheet.getBoundingClientRect()
  drag = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
  dragButton.setPointerCapture(event.pointerId)
  })
  dragButton.addEventListener('pointermove', event => {
  if (!drag) return
  sheet.style.left = `${Math.max(0, drag.left + event.clientX - drag.x)}px`
  sheet.style.top = `${Math.max(0, drag.top + event.clientY - drag.y)}px`
  sheet.style.right = 'auto'
  })
  dragButton.addEventListener('pointerup', () => { drag = null })
  dragButton.addEventListener('pointercancel', () => { drag = null })
}
enableDragging(detailSheet, document.querySelector('#drag-detail'))
enableDragging(document.querySelector('#history-sheet'), document.querySelector('#drag-history'))
enableDragging(document.querySelector('#rules-sheet'), document.querySelector('#drag-rules'))
enableDragging(document.querySelector('#diagnostics-sheet'), document.querySelector('#drag-diagnostics'))
enableDragging(audioTestSheet, document.querySelector('#drag-audio-test'))

/** Render Signal K state only; actions are intentionally introduced later. */
function renderNotifications(notifications) {
  notificationContainer.replaceChildren()
  const ignoredCount = notifications.filter(notification => notification.policy?.visible === false).length
  const ignoredElement = document.querySelector('#ignored-count')
  if (ignoredElement) {
    ignoredElement.hidden = ignoredCount === 0
    ignoredElement.textContent = t('app.ignored', { count: ignoredCount })
  }
  const visible = notifications
    .filter(notification => notification.policy?.visible !== false)
    .filter(notification => isVisibleInTable(notification))
  sortNotifications(visible)
  const stateCounts = Object.fromEntries(['emergency', 'alarm', 'warn', 'alert'].map(state => [state, 0]))
  let normalCount = 0
  for (const notification of visible) {
    if (stateCounts[notification.state] !== undefined) stateCounts[notification.state] += 1
    else if (['normal', 'nominal'].includes(notification.state)) normalCount += 1
  }
  activeNotifications = visible
  renderVisualAlerts(visible)
  if (selectedId && !visible.some(notification => notification.id === selectedId)) closeDetails()
  summary.textContent = t('app.summary', { ...stateCounts, normal: normalCount })
  if (ignoredElement) {
    summary.append(' ')
    summary.append(ignoredElement)
  }

  if (visible.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = t('app.noActiveNotifications')
    notificationContainer.append(empty)
    updateActions(null)
    return
  }
  const table = document.createElement('table')
  table.innerHTML = `<thead><tr>
    <th>${escapeHtml(t('table.status'))}</th>
    ${sortableHeader('notification', t('table.notification'))}
    ${sortableHeader('category', t('table.category'))}
    ${sortableHeader('source', t('table.source'))}
    <th>${escapeHtml(t('table.state'))}</th>
  </tr></thead><tbody></tbody>`
  for (const header of table.querySelectorAll('[data-sort-column]')) {
    header.addEventListener('click', () => selectTableSort(header.dataset.sortColumn))
    header.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectTableSort(header.dataset.sortColumn)
      }
    })
  }
  const rows = table.querySelector('tbody')

  for (const notification of visible) {
    const card = template.content.cloneNode(true)
    const element = card.querySelector('.notification-row')
    element.dataset.notificationId = notification.id
    element.classList.add(`state-${notification.state}`)
    element.classList.toggle('selected', notification.id === selectedId)
    element.addEventListener('click', () => selectNotification(notification.id))
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectNotification(notification.id)
      }
    })
    const stateLabel = card.querySelector('.state')
    stateLabel.setAttribute('aria-label', t('notification.state'))
    stateLabel.classList.add(`state-label-${notification.state}`)
    stateLabel.classList.toggle('state-acknowledged', false)
    stateLabel.style.removeProperty('color')
    stateLabel.classList.toggle('state-attention', ['warn', 'alert', 'alarm', 'emergency'].includes(notification.state))
    setText(card, '.state', formatState(notification.state))
    setText(card, '.category', formatCategory(notification.category))
    setText(card, '.message', notification.message || t('notification.noMessage'))
    setText(card, '.source', notification.source?.label || t('notification.unknownSource'))
    setText(card, '.status-badges', formatStatus(notification.status))
    rows.append(card)
  }
  notificationContainer.append(table)
  const selected = visible.find(item => item.id === selectedId) || null
  updateActions(selected)
  if (document.querySelector('#rules-sheet').getAttribute('aria-hidden') === 'false') {
    if (selected) showSelectedRules(selected)
    else closeRules()
  }
}

function renderVisualAlerts(notifications) {
  visualAlerts.replaceChildren()
  const candidates = notifications.filter(item => ['emergency', 'alarm', 'warn', 'alert'].includes(item.state) && item.method?.includes('visual') && !isAcknowledged(item.status))
  for (const notification of candidates) {
    const tableRule = activeRules.some(rule => ruleMatchesNotification(rule, notification) && rule.actions?.visibleInTable === true)
    const rule = visualRules[notification.state] || { display: 'table' }
    if (rule.display === 'table' || (tableRule && !['emergency', 'alarm'].includes(notification.state))) continue
    const alert = document.createElement('div')
    alert.className = `visual-alert visual-${rule.display}${rule.flash ? ' visual-flash' : ''}`
    alert.style.setProperty('--visual-alert-color', rule.color || stateColors[notification.state] || '#d32f2f')
    alert.textContent = `${formatState(notification.state)}: ${notification.message || t('notification.noMessage')}${rule.acknowledgeRequired ? ` · ${t('visual.acknowledgementRequired')}` : ''}`
    alert.addEventListener('click', () => {
      selectedId = notification.id
      renderDetails(notification)
      detailSheet.style.zIndex = '12'
    })
    visualAlerts.append(alert)
  }
}

function isVisibleInTable(notification) {
  if (['emergency', 'alarm'].includes(notification.state)) return true
  return activeRules.some(rule => ruleMatchesNotification(rule, notification) && rule.actions?.visibleInTable === true)
}

function isAcknowledged(status) {
  return status?.acknowledged === true || status?.acknowledged === 'true' || Boolean(status?.acknowledgedAt)
}

function isResolvedState(state) {
  return state === 'normal' || state === 'nominal'
}

function updateActions(notification) {
  const actionLabels = { silence: t('actions.silence'), acknowledge: t('actions.acknowledge'), clear: t('actions.clear') }
  for (const button of document.querySelectorAll('#detail-actions [data-action]')) {
    const action = button.dataset.action
    const allowed = isConnected && configurationReady && Boolean(notification) && actionAllowed(notification, action)
    button.disabled = !allowed
    button.title = allowed
      ? button.getAttribute('aria-label')
      : !isConnected || !configurationReady
          ? t('actions.unavailable')
          : t('actions.notPermitted', { action: actionLabels[action] })
    button.onclick = () => runAction(notification.id, action)
  }
}

function renderHistory(events) {
  historyContainer.replaceChildren()
  historyCount.textContent = t('history.events', { count: events.length })
  const grouped = []
  for (const event of events) {
    const previous = grouped[grouped.length - 1]
    const signature = `${event.type}|${event.action || ''}|${event.notification?.state || ''}|${event.notification?.message || ''}`
    if (previous && previous.signature === signature) {
      previous.count += 1
      previous.latest = event
    } else {
      grouped.push({ signature, event, latest: event, count: 1 })
    }
  }
  let lastDay = null
  for (const entry of grouped.slice(0, historyDisplayLimit)) {
    const event = entry.latest
    const item = document.createElement('li')
    const operator = Boolean(event.action)
    item.className = operator ? 'history-event history-operator' : 'history-event'
    const notification = event.notification || {}
    const state = String(notification.state || 'unknown').toUpperCase()
    const label = operator ? t('history.operator', { action: String(event.action).toUpperCase() }) : event.type === 'raised' ? t('history.detected') : event.type === 'cleared' ? t('history.resolved') : t('history.stateChange')
    const repetition = entry.count > 1 ? ` · ${entry.count}×` : ''
    const duration = event.type === 'cleared' ? formatDuration(notification.firstSeenAt, event.at) : ''
    const durationLabel = duration ? ` · ${t('history.duration', { duration })}` : ''
    const day = i18n.date(event.at)
    const datePrefix = day !== lastDay ? `<time class="history-day">${day}</time>` : '<span class="history-day history-day-empty" aria-hidden="true"></span>'
    const time = i18n.time(event.at)
    const message = notification.message ? ` · ${escapeHtml(notification.message)}` : ''
    item.innerHTML = `${datePrefix}<time class="history-time">${escapeHtml(time)}</time><span class="history-summary"><strong>${escapeHtml(label)}</strong> <span class="history-state state-label-${notification.state || 'unknown'}">${escapeHtml(state)}</span>${message}${repetition}${escapeHtml(durationLabel)}</span>`
    if (historyMode === 'critical') {
      item.classList.add('history-selectable')
      item.tabIndex = 0
      item.setAttribute('role', 'button')
      item.setAttribute('aria-label', `${state}: ${notification.message || t('notification.noMessage')}`)
      const openHistoricalDetails = () => {
        const historical = { ...notification, historyOnly: true, status: null, policy: null }
        historyFocusNotification = historical
        historyFocusId = null
        historyPath = historical.path || ''
        historyOccurrenceId = historical.occurrenceId || ''
        document.querySelector('#delete-history').hidden = !historyOccurrenceId
        selectedId = null
        renderDetails(historical)
      }
      item.addEventListener('click', openHistoricalDetails)
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openHistoricalDetails()
        }
      })
    }
    lastDay = day
    historyContainer.append(item)
  }
  document.querySelector('#history-more').hidden = grouped.length <= historyDisplayLimit
}

function renderSelectedHistory() {
  const selected = activeNotifications.find(item => item.id === historyFocusId) || historyFocusNotification
  if (!selected) return
  renderHistory(historyForNotification(selected))
}

function renderCriticalHistory() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  const events = (window.notificationHistory || []).filter(event => {
    const at = Date.parse(event.at)
    return Number.isFinite(at) && at >= cutoff && ['emergency', 'alarm'].includes(event.notification?.state)
  })
  renderHistory(events)
  document.querySelector('#history-title').textContent = t('history.criticalTitle')
  document.querySelector('#history-key').textContent = t('history.criticalDescription')
  document.querySelector('#delete-history').hidden = true
}

async function deleteLocalHistory() {
  const selected = activeNotifications.find(item => item.id === historyFocusId) || historyFocusNotification
  const occurrenceId = selected?.occurrenceId || historyOccurrenceId
  if (!occurrenceId) {
    historyCount.textContent = t('history.noOccurrence')
    return
  }
  if (!window.confirm(t('history.deleteConfirm'))) return
  try {
    const response = await fetch(`${pluginApi}/history?occurrenceId=${encodeURIComponent(occurrenceId)}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(t('history.deleteFailed', { status: response.status }))
    deletedHistoryOccurrenceIds.add(occurrenceId)
    renderHistory([])
    await refresh()
    document.querySelector('#delete-history').hidden = true
    historyCount.textContent = t('history.deleted')
  } catch (error) {
    historyCount.textContent = error.message
  }
}

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? t('time.unknown') : i18n.dateTime(date)
}

function formatDuration(start, end) {
  const milliseconds = new Date(end).valueOf() - new Date(start).valueOf()
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ''
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]))
}

function showSelectedHistory(selected = activeNotifications.find(item => item.id === selectedId) || historyFocusNotification) {
  selected ||= activeNotifications[0]
  if (!selected) return
  historyMode = 'selected'
  historyFocusNotification = selected
  historyFocusId = selected.id
  const path = selected.path || ''
  historyPath = path
  historyOccurrenceId = selected.occurrenceId || ''
  historyDisplayLimit = 20
  document.querySelector('#history-title').textContent = t('history.title')
  document.querySelector('#delete-history').hidden = !historyOccurrenceId || deletedHistoryOccurrenceIds.has(historyOccurrenceId)
  renderSelectedHistory()
  document.querySelector('#history-key').textContent = t('history.firstSeen', { time: formatDateTime(selected.firstSeenAt || historyForNotification(selected)[0]?.notification?.firstSeenAt) })
  document.querySelector('#history-sheet').setAttribute('aria-hidden', 'false')
  document.querySelector('#history-sheet').style.zIndex = '12'
}

function showAlarmHistory() {
  historyMode = 'critical'
  historyFocusId = null
  historyFocusNotification = null
  historyPath = ''
  historyOccurrenceId = ''
  historyDisplayLimit = 20
  renderCriticalHistory()
  const sheet = document.querySelector('#history-sheet')
  sheet.setAttribute('aria-hidden', 'false')
  sheet.style.zIndex = '12'
  sheet.focus()
}

function historyForNotification(notification) {
  const events = window.notificationHistory || []
  if (notification.occurrenceId) {
    const occurrenceEvents = events.filter(event => event.notification?.occurrenceId === notification.occurrenceId)
    if (occurrenceEvents.length > 0) return occurrenceEvents
  }
  return events.filter(event => event.notification?.path === notification.path)
}

function closeHistory() {
  document.querySelector('#history-sheet').setAttribute('aria-hidden', 'true')
  document.querySelector('#history-sheet').style.zIndex = '11'
  const card = notificationContainer.querySelector(`[data-notification-id="${CSS.escape(historyFocusId || selectedId || '')}"]`)
  if (card) {
    selectedId = historyFocusId || selectedId
    card.classList.add('selected')
    requestAnimationFrame(() => card.focus())
  }
}

function setText(parent, selector, text) { parent.querySelector(selector).textContent = text }
function formatStatus(status) {
  if (!status) return t('status.managedBySource')
  return [status.silenced && t('status.silenced'), status.acknowledged && t('status.acknowledged')].filter(Boolean).join(', ') || t('status.active')
}

function loadTableSort() {
  try {
    const stored = JSON.parse(localStorage.getItem(sortStorageKey) || 'null')
    if (stored?.column && ['notification', 'category', 'source', 'updated'].includes(stored.column) && ['asc', 'desc'].includes(stored.direction)) return stored
  } catch {}
  return { column: 'updated', direction: 'desc' }
}

function saveTableSort() {
  try { localStorage.setItem(sortStorageKey, JSON.stringify(tableSort)) } catch {}
}

function selectTableSort(column) {
  tableSort = tableSort.column === column
    ? { column, direction: tableSort.direction === 'asc' ? 'desc' : 'asc' }
    : { column, direction: 'asc' }
  saveTableSort()
  renderNotifications(activeNotifications)
}

function sortableHeader(column, label) {
  const active = tableSort.column === column
  const indicator = active ? (tableSort.direction === 'asc' ? ' ↑' : ' ↓') : ''
  const direction = active && tableSort.direction === 'asc' ? t('sort.descending') : t('sort.ascending')
  return `<th aria-sort="${active ? (tableSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="sort-header" data-sort-column="${column}" aria-label="${escapeHtml(t('table.sort', { label, direction }))}">${escapeHtml(label)}${indicator}</button></th>`
}

function sortNotifications(notifications) {
  const direction = tableSort.direction === 'asc' ? 1 : -1
  notifications.sort((left, right) => {
    // "Newest" is a global ordering. Applying the severity hierarchy first
    // makes the control appear inert because newer lower-severity items remain
    // below older alarms.
    if (tableSort.column === 'updated') return direction * compareNewest(left, right)
    const hierarchyDifference = compareHierarchy(left, right)
    if (hierarchyDifference !== 0) return hierarchyDifference
    const difference = tableSort.column === 'notification'
      ? compareNotificationPaths(left.path, right.path)
      : String(sortValue(left, tableSort.column)).localeCompare(String(sortValue(right, tableSort.column)), undefined, { numeric: true, sensitivity: 'base' })
    if (difference !== 0) return direction * difference
    return compareNewest(left, right)
  })
}

function sortValue(notification, column) {
  if (column === 'category') return formatCategory(notification.category)
  if (column === 'source') return notification.source?.label || t('notification.unknownSource')
  return ''
}

function compareHierarchy(left, right) {
  const order = ['emergency', 'alarm', ...configuredStateOrder, 'info']
  const leftState = String(left.state || '').toLowerCase()
  const rightState = String(right.state || '').toLowerCase()
  const leftRank = order.indexOf(leftState)
  const rightRank = order.indexOf(rightState)
  return (leftRank < 0 ? order.length : leftRank) - (rightRank < 0 ? order.length : rightRank)
}

function notificationTime(notification) {
  return Date.parse(notification.lastUpdatedAt || notification.updatedAt || notification.firstSeenAt || notification.createdAt || '') || 0
}

function compareNewest(left, right) {
  const difference = notificationTime(right) - notificationTime(left)
  return difference || String(right.id || '').localeCompare(String(left.id || ''))
}
function formatPolicy(policy) {
  return policy?.matchedPolicy ? `${policy.priority} · ${policy.matchedPolicy}` : `${policy?.priority || 'normal'} · default`
}

function selectNotification(id) {
  selectedId = id
  const notification = activeNotifications.find(item => item.id === id)
  if (notification) renderDetails(notification)
  renderNotifications(activeNotifications)
  if (notification && document.querySelector('#rules-sheet').getAttribute('aria-hidden') === 'false') showSelectedRules(notification)
  if (notification && document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false') showSelectedHistory(notification)
}

function renderDetails(notification) {
  if (infoCloseTimer !== null) clearTimeout(infoCloseTimer)
  detailSheet.setAttribute('aria-hidden', 'false')
  detailSheet.style.zIndex = '12'
  document.querySelector('#history-sheet').style.zIndex = '11'
  setText(document, '#detail-state', `${formatState(notification.state)} · ${formatCategory(notification.category)}`)
  setText(document, '#detail-message', notification.message || t('notification.noMessage'))
  setText(document, '#detail-category', notification.category)
  setText(document, '#detail-source', notification.source?.label || t('notification.unknownSource'))
  setText(document, '#detail-path', notification.path)
  setText(document, '#detail-id', notification.id)
  setText(document, '#detail-occurrence-id', notification.occurrenceId || t('detail.notAvailable'))
  setText(document, '#detail-status', formatStatus(notification.status))
  setText(document, '#detail-method', formatMethod(notification.method))
  setText(document, '#detail-policy', formatPolicy(notification.policy))
  updateActions(notification)
  const unavailable = ['silence', 'acknowledge', 'clear'].filter(action => !actionAllowed(notification, action))
  const notes = []
  if (notification.historyOnly) notes.push(t('detail.historical'))
  if (visualRules[notification.state]?.acknowledgeRequired && !notification.status?.acknowledged) notes.push(t('detail.acknowledgementRequired'))
  if (notification.state === 'emergency' && !actionAllowed(notification, 'silence')) notes.push(t('detail.emergencyNoSilence'))
  if (unavailable.includes('clear')) notes.push(t('detail.clearNotPermitted'))
  setText(document, '#detail-action-note', notes.join(' ') || t('detail.availableActions'))
  if (infoAutoCloseSeconds > 0) {
    infoCloseTimer = setTimeout(closeDetails, infoAutoCloseSeconds * 1000)
  }
}

function showSelectedRules(notification = activeNotifications.find(item => item.id === selectedId)) {
  if (!notification) return
  const matches = activeRules.filter(rule => ruleMatchesNotification(rule, notification))
  const element = document.querySelector('#detail-rules')
  element.hidden = false
  element.textContent = matches.length
    ? JSON.stringify({ notification: { state: notification.state, category: notification.category, path: notification.path }, matchingRules: matches }, null, 2)
    : t('rules.noMatch')
  const sheet = document.querySelector('#rules-sheet')
  sheet.setAttribute('aria-hidden', 'false')
  sheet.style.zIndex = '13'
  sheet.focus()
}

function closeRules() {
  document.querySelector('#rules-sheet').setAttribute('aria-hidden', 'true')
}

function ruleMatchesNotification(rule, notification) {
  if (rule.match?.state !== notification.state) return false
  if (!rule.match?.path) return true
  if (!notification.path) return false
  const pattern = String(rule.match.path)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${pattern}$`).test(notification.path)
}

function formatState(state) {
  const value = String(state || 'unknown').toLowerCase()
  return ['emergency', 'alarm', 'warn', 'alert', 'info', 'nominal', 'normal', 'unknown'].includes(value) ? t(`state.${value}`) : value.toUpperCase()
}
function formatCategory(category) {
  const value = String(category || 'OTHER').toLowerCase()
  return ['navigation', 'weather', 'electrical', 'propulsion', 'system', 'security', 'anchor', 'collision', 'other'].includes(value) ? t(`category.${value}`) : value.toUpperCase()
}
function formatMethod(method) {
  if (!Array.isArray(method) || method.length === 0) return t('presentation.notSpecified')
  return method.map(value => value === 'sound' ? t('presentation.audio') : value === 'visual' ? t('presentation.visual') : String(value)).join(' + ')
}

function closeDetails() {
  if (infoCloseTimer !== null) {
    clearTimeout(infoCloseTimer)
    infoCloseTimer = null
  }
  selectedId = null
  detailSheet.setAttribute('aria-hidden', 'true')
  detailSheet.style.zIndex = '10'
  renderNotifications(activeNotifications)
}
function bySeverity(left, right) {
  const order = ['emergency', 'alarm', ...configuredStateOrder]
  const leftRank = order.indexOf(left.state)
  const rightRank = order.indexOf(right.state)
  const rankDifference = (leftRank < 0 ? order.length : leftRank) - (rightRank < 0 ? order.length : rightRank)
  if (rankDifference !== 0) return rankDifference
  return String(right.lastUpdatedAt || '').localeCompare(String(left.lastUpdatedAt || ''))
}

function actionAllowed(notification, action) {
  if (!isConnected || !configurationReady) return false
  if (notification?.historyOnly) return false
  const status = notification.status
  if (!status) return false
  if (action === 'silence') return notification.state !== 'emergency' && status.canSilence === true && status.silenced !== true
  if (action === 'acknowledge') return status.canAcknowledge === true && status.acknowledged !== true
  return !['normal', 'nominal'].includes(notification.state) && status.canClear === true
}

async function runAction(id, action, refreshAfter = true) {
  if (action === 'clear' && !window.confirm(t('actions.clearConfirm'))) return
  try {
    if (!isConnected || !configurationReady) throw new Error(t('actions.unavailable'))
    const response = await fetch(`${pluginApi}/notifications/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error(t('actions.signIn'))
      }
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || response.statusText)
    }
    if (refreshAfter) await refresh()
  } catch (error) {
    summary.textContent = t('actions.failed', { message: error.message })
  }
}

async function runGlobalAction(action) {
  try {
    if (!isConnected || !configurationReady) throw new Error(t('actions.unavailable'))
    const response = await fetch(`${pluginApi}/notifications/action-all/${action}`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || response.statusText)
    }
    await refresh()
  } catch (error) {
    summary.textContent = t('actions.failed', { message: error.message })
  }
}

async function refresh() {
  refreshInProgress = true
  const pollStartedMs = Date.now()
  clientPollDiagnostics.lastStartedAt = new Date(pollStartedMs).toISOString()
  try {
    const historyPromise = fetchJsonWithTimeout(`${pluginApi}/history`).catch(() => null)
    const notifications = await fetchJsonWithTimeout(`${pluginApi}/notifications`)
    isConnected = true
    clientPollDiagnostics.lastError = null
    lastSuccessfulRefreshAt = new Date()
    currentConfigurationStatus = notifications.configurationStatus || null
    configurationReady = currentConfigurationStatus?.state !== 'error'
    updateHealthBanner(currentConfigurationStatus)
    configuredStateOrder = Array.isArray(notifications.stateOrder) ? notifications.stateOrder : configuredStateOrder
    stateColors = notifications.stateColors || stateColors
    visualRules = notifications.visualRules || visualRules
    activeRules = Array.isArray(notifications.rules) ? notifications.rules : activeRules
    renderAudioTest(notifications.audioTest)
    for (const [state, color] of Object.entries(stateColors)) document.documentElement.style.setProperty(`--state-${state}`, color)
    infoAutoCloseSeconds = Number.isInteger(notifications.infoAutoCloseSeconds) ? notifications.infoAutoCloseSeconds : 0
    shortcutInfo = typeof notifications.shortcutInfo === 'string' ? notifications.shortcutInfo : shortcutInfo
    shortcutHistory = typeof notifications.shortcutHistory === 'string' ? notifications.shortcutHistory : shortcutHistory
    renderNotifications(notifications.notifications)
    updateGlobalActions()
    const history = await historyPromise
    if (history) {
      window.notificationHistory = history.events || []
      if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false' && historyMode === 'critical') {
        renderCriticalHistory()
      } else if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false' && historyPath) {
        renderSelectedHistory()
      } else {
        renderHistory([])
      }
    }
  } catch (error) {
    clientPollDiagnostics.lastError = { message: error.message, at: new Date().toISOString() }
    isConnected = false
    configurationReady = false
    updateHealthBanner()
    updateActions(activeNotifications.find(item => item.id === selectedId) || null)
    updateGlobalActions()
  } finally {
    const completedMs = Date.now()
    clientPollDiagnostics.lastCompletedAt = new Date(completedMs).toISOString()
    clientPollDiagnostics.durationMs = completedMs - pollStartedMs
    refreshInProgress = false
  }
}

/** Show operational timings without changing any Signal K notification. */
async function showDiagnostics() {
  const sheet = document.querySelector('#diagnostics-sheet')
  const content = document.querySelector('#diagnostics-content')
  sheet.setAttribute('aria-hidden', 'false')
  sheet.style.zIndex = '14'
  content.textContent = t('diagnostics.loading')
  try {
    const server = await fetchJsonWithTimeout(`${pluginApi}/diagnostics`)
    content.textContent = JSON.stringify({ clientPoll: clientPollDiagnostics, server }, null, 2)
  } catch (error) {
    content.textContent = JSON.stringify({ clientPoll: clientPollDiagnostics, diagnosticsError: error.message }, null, 2)
  }
  sheet.focus()
}

function closeDiagnostics() {
  document.querySelector('#diagnostics-sheet').setAttribute('aria-hidden', 'true')
}

function showAudioTest() {
  if (currentAudioTest.enabled === false) return
  audioTestSheet.setAttribute('aria-hidden', 'false')
  audioTestSheet.style.zIndex = '15'
  audioTestSheet.focus()
}

function closeAudioTest() {
  audioTestSheet.setAttribute('aria-hidden', 'true')
}

function updateHealthBanner(configurationStatus = null) {
  if (!isConnected) {
    const lastUpdate = lastSuccessfulRefreshAt ? i18n.time(lastSuccessfulRefreshAt) : t('connection.never')
    healthBanner.textContent = t('connection.offline', { time: lastUpdate })
    healthBanner.hidden = false
    document.documentElement.classList.add('connection-stale')
    return
  }
  document.documentElement.classList.remove('connection-stale')
  if (configurationStatus?.state === 'error') {
    healthBanner.textContent = t('configuration.invalid', { message: configurationStatus.message })
    healthBanner.hidden = false
    return
  }
  healthBanner.hidden = true
  healthBanner.textContent = ''
}

/** Mark cached notification data stale without changing Signal K state. */
function markDisconnected() {
  if (!isConnected && healthBanner.hidden === false) return
  isConnected = false
  configurationReady = false
  updateHealthBanner()
  updateActions(activeNotifications.find(item => item.id === selectedId) || null)
  updateGlobalActions()
}

function updateGlobalActions() {
  for (const button of actionBar.querySelectorAll('[data-global-action]')) {
    button.disabled = !isConnected || !configurationReady
    button.title = button.disabled ? t('actions.unavailable') : button.getAttribute('aria-label')
  }
  const running = ['playing', 'awaiting_feedback'].includes(currentAudioTest.state)
  audioTestStart.disabled = !isConnected || !configurationReady || running
  audioTestStart.title = audioTestStart.disabled ? t('audioTest.unavailable') : t('audioTest.playTitle')
  audioTestNotHeard.hidden = currentAudioTest.state !== 'awaiting_feedback'
  audioTestNotHeard.disabled = !isConnected || !configurationReady || currentAudioTest.state !== 'awaiting_feedback'
  audioTestHeard.hidden = currentAudioTest.state !== 'awaiting_feedback'
  audioTestHeard.disabled = !isConnected || !configurationReady || currentAudioTest.state !== 'awaiting_feedback'
}

function renderAudioTest(value) {
  currentAudioTest = value || { state: 'idle', statement: 'No alarm sound test has been run yet.', intervalDays: 7, enabled: true }
  const intervalDays = Number.isInteger(currentAudioTest.intervalDays) ? currentAudioTest.intervalDays : 7
  const enabled = currentAudioTest.enabled !== false && intervalDays > 0
  audioTestDueButton.hidden = !enabled
  audioTestSheet.hidden = !enabled
  if (!enabled) closeAudioTest()
  const feedbackSeconds = currentAudioTest.state === 'awaiting_feedback'
    ? Math.max(0, Math.ceil((Date.parse(currentAudioTest.feedbackDeadlineAt) - Date.now()) / 1000))
    : null
  const audioTestStateKeys = {
    idle: 'audioTest.idle',
    playing: 'audioTest.playing',
    technical_failure: 'audioTest.technicalFailure',
    not_heard: 'audioTest.notHeardStatus',
    passed_heard: 'audioTest.heardStatus',
    passed_no_counter_report: 'audioTest.passed'
  }
  audioTestStatus.textContent = feedbackSeconds === null
    ? (audioTestStateKeys[currentAudioTest.state] ? t(audioTestStateKeys[currentAudioTest.state]) : currentAudioTest.statement || currentAudioTest.state)
    : t('audioTest.awaitingFeedback', { count: feedbackSeconds })
  const passedAt = ['passed_heard', 'passed_no_counter_report'].includes(currentAudioTest.state) ? Date.parse(currentAudioTest.passedAt || currentAudioTest.completedAt) : NaN
  const remainingDays = Number.isFinite(passedAt) ? Math.max(0, Math.ceil((passedAt + (intervalDays * 86400000) - Date.now()) / 86400000)) : 0
  const running = ['playing', 'awaiting_feedback'].includes(currentAudioTest.state)
  audioTestDays.textContent = running ? '…' : String(remainingDays)
  audioTestDueButton.classList.toggle('is-due', !running && remainingDays === 0)
  audioTestDueButton.classList.toggle('is-running', running)
  audioTestDueButton.title = running ? t('audioTest.running') : remainingDays === 0 ? t('audioTest.due') : t('audioTest.daysRemaining', { count: remainingDays })
  document.querySelector('#audio-test-actor').textContent = currentAudioTest.actor || '–'
  document.querySelector('#audio-test-device').textContent = currentAudioTest.device || '–'
  document.querySelector('#audio-test-file').textContent = currentAudioTest.file || '–'
  document.querySelector('#audio-test-player').textContent = currentAudioTest.player ? `${currentAudioTest.player.ok ? 'Exit 0' : `Exit ${currentAudioTest.player.code ?? '?'}`}${currentAudioTest.player.signal ? ` / ${currentAudioTest.player.signal}` : ''}` : '–'
  document.querySelector('#audio-test-completed').textContent = currentAudioTest.completedAt ? i18n.dateTime(currentAudioTest.completedAt) : '–'
  updateGlobalActions()
}

async function startAudioTest() {
  showAudioTest()
  await runAudioTestRequest('/audio-test/start')
}

async function reportAudioTestNotHeard() {
  await runAudioTestRequest('/audio-test/not-heard')
}

async function reportAudioTestHeard() {
  await runAudioTestRequest('/audio-test/heard')
}

async function runAudioTestRequest(route) {
  try {
    if (!isConnected || !configurationReady) throw new Error(t('audioTest.requestUnavailable'))
    const response = await fetch(`${pluginApi}${route}`, { method: 'POST' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.message || response.statusText)
    renderAudioTest(body)
    setTimeout(scheduleRefresh, 500)
  } catch (error) {
    audioTestStatus.textContent = t('audioTest.failed', { message: error.message })
  }
}

const scheduleRefresh = createRefreshScheduler(refresh)
window.addEventListener('offline', markDisconnected)
window.addEventListener('online', scheduleRefresh)
window.addEventListener('notification-language-changed', () => {
  renderNotifications(activeNotifications)
  renderAudioTest(currentAudioTest)
  updateHealthBanner(currentConfigurationStatus)
  if (detailSheet.getAttribute('aria-hidden') === 'false') {
    const notification = activeNotifications.find(item => item.id === selectedId) || historyFocusNotification
    if (notification) renderDetails(notification)
  }
  if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false') {
    if (historyMode === 'critical') renderCriticalHistory()
    else renderSelectedHistory()
  }
})

void i18n.initialize().then(() => {
  scheduleRefresh()
  updateGlobalActions()
  setInterval(scheduleRefresh, 5000)
  setInterval(() => {
    const lastSuccessMs = lastSuccessfulRefreshAt?.getTime() ?? null
    if (isRefreshStale(lastSuccessMs, Date.now(), pollingStartedAt, DEFAULT_STALE_AFTER_MS, refreshInProgress)) markDisconnected()
  }, 1000)
  setInterval(() => renderAudioTest(currentAudioTest), 1000)
})
