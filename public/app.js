'use strict'

const pluginApi = '/plugins/signalk-notification-engine'
const notificationContainer = document.querySelector('#notifications')
const historyContainer = document.querySelector('#history')
const historyCount = document.querySelector('#history-count')
const summary = document.querySelector('#summary')
const template = document.querySelector('#notification-template')
const actionBar = document.querySelector('#actions')
const detailSheet = document.querySelector('#detail-sheet')
const visualAlerts = document.querySelector('#visual-alerts')
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
let activeRules = []

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
document.querySelector('#delete-history').addEventListener('click', deleteLocalHistory)
detailSheet.addEventListener('pointerdown', () => { detailSheet.style.zIndex = '12' })
document.querySelector('#history-sheet').addEventListener('pointerdown', event => { event.currentTarget.style.zIndex = '12'; detailSheet.style.zIndex = '11' })
document.querySelector('#history-more').addEventListener('click', () => { historyDisplayLimit += 20; renderSelectedHistory() })
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (detailSheet.getAttribute('aria-hidden') === 'false') closeDetails()
    if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false') closeHistory()
    if (document.querySelector('#rules-sheet').getAttribute('aria-hidden') === 'false') closeRules()
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
  if (event.target.closest('.notification-row, #detail-sheet, #history-sheet, #rules-sheet, #actions, #visual-alerts')) return
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

/** Render Signal K state only; actions are intentionally introduced later. */
function renderNotifications(notifications) {
  notificationContainer.replaceChildren()
  const ignoredCount = notifications.filter(notification => notification.policy?.visible === false).length
  const ignoredElement = document.querySelector('#ignored-count')
  if (ignoredElement) {
    ignoredElement.hidden = ignoredCount === 0
    ignoredElement.textContent = ignoredCount === 1 ? '· 1 ignored' : `· ${ignoredCount} ignored`
  }
  const visible = notifications
    .filter(notification => notification.policy?.visible !== false)
    .filter(notification => isVisibleInTable(notification))
    .sort(bySeverity)
  const stateCounts = Object.fromEntries(['emergency', 'alarm', 'warn', 'alert'].map(state => [state, 0]))
  let normalCount = 0
  for (const notification of visible) {
    if (stateCounts[notification.state] !== undefined) stateCounts[notification.state] += 1
    else if (['normal', 'nominal'].includes(notification.state)) normalCount += 1
  }
  activeNotifications = visible
  renderVisualAlerts(visible)
  if (selectedId && !visible.some(notification => notification.id === selectedId)) closeDetails()
  summary.textContent = `${stateCounts.emergency} emergency · ${stateCounts.alarm} alarm · ${stateCounts.warn} warn · ${stateCounts.alert} alert · ${normalCount} normal`
  if (ignoredElement) {
    summary.append(' ')
    summary.append(ignoredElement)
  }

  if (visible.length === 0) {
    notificationContainer.innerHTML = '<p class="empty">No active notifications.</p>'
    updateActions(null)
    return
  }
  const table = document.createElement('table')
  table.innerHTML = '<thead><tr><th>Status</th><th>Notification</th><th>Category</th><th>Source</th><th>State</th></tr></thead><tbody></tbody>'
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
    stateLabel.classList.add(`state-label-${notification.state}`)
    stateLabel.classList.toggle('state-acknowledged', false)
    stateLabel.style.removeProperty('color')
    stateLabel.classList.toggle('state-attention', ['warn', 'alert', 'alarm', 'emergency'].includes(notification.state))
    setText(card, '.state', formatState(notification.state))
    setText(card, '.category', formatCategory(notification.category))
    setText(card, '.message', notification.message || 'No message supplied')
    setText(card, '.source', notification.source?.label || 'Unknown source')
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
    alert.textContent = `${formatState(notification.state)}: ${notification.message || 'No message supplied'}${rule.acknowledgeRequired ? ' · Acknowledgement required' : ''}`
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
  const actionLabels = { silence: 'Silence', acknowledge: 'Acknowledge', clear: 'Clear' }
  for (const button of document.querySelectorAll('#detail-actions [data-action]')) {
    const action = button.dataset.action
    const allowed = Boolean(notification) && actionAllowed(notification, action)
    button.disabled = !allowed
    button.title = allowed ? button.getAttribute('aria-label') : `${actionLabels[action]} is not permitted by Signal K`
    button.onclick = () => runAction(notification.id, action)
  }
}

function renderHistory(events) {
  historyContainer.replaceChildren()
  historyCount.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`
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
    const label = operator ? `OPERATOR · ${String(event.action).toUpperCase()}` : event.type === 'raised' ? 'DETECTED' : event.type === 'cleared' ? 'RESOLVED' : 'STATE CHANGE'
    const repetition = entry.count > 1 ? ` · ${entry.count}×` : ''
    const duration = event.type === 'cleared' ? formatDuration(notification.firstSeenAt, event.at) : ''
    const durationLabel = duration ? ` · duration ${duration}` : ''
    const day = new Date(event.at).toLocaleDateString()
    const datePrefix = day !== lastDay ? `<time class="history-day">${day}</time>` : '<span class="history-day history-day-empty" aria-hidden="true"></span>'
    const time = new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    const message = notification.message ? ` · ${escapeHtml(notification.message)}` : ''
    item.innerHTML = `${datePrefix}<time class="history-time">${time}</time><span class="history-summary"><strong>${label}</strong> <span class="history-state state-label-${notification.state || 'unknown'}">${state}</span>${message}${repetition}${durationLabel}</span>`
    if (historyMode === 'critical') {
      item.classList.add('history-selectable')
      item.tabIndex = 0
      item.setAttribute('role', 'button')
      item.setAttribute('aria-label', `${state}: ${notification.message || 'No message supplied'}`)
      const openHistoricalDetails = () => {
        const historical = { ...notification, historyOnly: true, status: null, policy: null }
        historyFocusNotification = historical
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
  document.querySelector('#history-title').textContent = 'Emergency & alarm history'
  document.querySelector('#history-key').textContent = 'Showing emergency and alarm events from the last 24 hours. Select an entry for details.'
  document.querySelector('#delete-history').hidden = true
}

async function deleteLocalHistory() {
  const selected = activeNotifications.find(item => item.id === historyFocusId)
  if (!selected?.occurrenceId) {
    historyCount.textContent = 'This history has no occurrence ID and cannot be deleted here.'
    return
  }
  if (!window.confirm('Delete this notification history? Signal K notifications will not be changed.')) return
  try {
    const response = await fetch(`${pluginApi}/history?occurrenceId=${encodeURIComponent(selected.occurrenceId)}`, { method: 'DELETE' })
    if (!response.ok) throw new Error(`Could not delete history (${response.status})`)
    renderHistory([])
    await refresh()
  } catch (error) {
    historyCount.textContent = error.message
  }
}

function formatDateTime(value) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'medium' }).format(date)
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
  document.querySelector('#history-title').textContent = 'Notification history'
  document.querySelector('#delete-history').hidden = selected.historyOnly === true
  renderSelectedHistory()
  document.querySelector('#history-key').textContent = `First seen: ${formatDateTime(selected.firstSeenAt || historyForNotification(selected)[0]?.notification?.firstSeenAt)}`
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
  if (!status) return 'Managed by source'
  return [status.silenced && 'silenced', status.acknowledged && 'acknowledged'].filter(Boolean).join(', ') || 'active'
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
  setText(document, '#detail-message', notification.message || 'No message supplied')
  setText(document, '#detail-category', notification.category)
  setText(document, '#detail-source', notification.source?.label || 'Unknown source')
  setText(document, '#detail-path', notification.path)
  setText(document, '#detail-id', notification.id)
  setText(document, '#detail-occurrence-id', notification.occurrenceId || 'Not available')
  setText(document, '#detail-status', formatStatus(notification.status))
  setText(document, '#detail-method', formatMethod(notification.method))
  setText(document, '#detail-policy', formatPolicy(notification.policy))
  updateActions(notification)
  const unavailable = ['silence', 'acknowledge', 'clear'].filter(action => !actionAllowed(notification, action))
  const notes = []
  if (notification.historyOnly) notes.push('This is a historical event; actions are unavailable.')
  if (visualRules[notification.state]?.acknowledgeRequired && !notification.status?.acknowledged) notes.push('Acknowledgement required.')
  if (notification.state === 'emergency' && !actionAllowed(notification, 'silence')) notes.push('Silence is not permitted for emergency in Signal K.')
  if (unavailable.includes('clear')) notes.push('Clear is not permitted by the notification source.')
  setText(document, '#detail-action-note', notes.join(' ') || 'Available actions are shown above.')
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
    : 'No matching deployed rule. This notification is shown because emergency and alarm states are always visible.'
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
  if (rule.match?.category && rule.match.category !== notification.category) return false
  if (!rule.match?.path) return true
  if (!notification.path) return false
  const pattern = String(rule.match.path)
    .split('*')
    .map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${pattern}$`).test(notification.path)
}

function formatState(state) { return String(state || 'unknown').toUpperCase() }
function formatCategory(category) { return String(category || 'OTHER').toUpperCase() }
function formatMethod(method) {
  if (!Array.isArray(method) || method.length === 0) return 'Not specified'
  return method.map(value => value === 'sound' ? 'Audio' : value === 'visual' ? 'Visual' : String(value)).join(' + ')
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
  if (notification?.historyOnly) return false
  const status = notification.status
  if (!status) return false
  if (action === 'silence') return notification.state !== 'emergency' && status.canSilence === true && status.silenced !== true
  if (action === 'acknowledge') return status.canAcknowledge === true && status.acknowledged !== true
  return !['normal', 'nominal'].includes(notification.state) && status.canClear === true
}

async function runAction(id, action, refreshAfter = true) {
  try {
    const response = await fetch(`${pluginApi}/notifications/${encodeURIComponent(id)}/${action}`, { method: 'POST' })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Please sign in to Signal K with permission to change notifications.')
      }
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || response.statusText)
    }
    if (refreshAfter) await refresh()
  } catch (error) {
    summary.textContent = `Action failed: ${error.message}`
  }
}

async function runGlobalAction(action) {
  try {
    const response = await fetch(`${pluginApi}/notifications/action-all/${action}`, { method: 'POST' })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || response.statusText)
    }
    await refresh()
  } catch (error) {
    summary.textContent = `Action failed: ${error.message}`
  }
}

async function refresh() {
  try {
    const [notifications, history] = await Promise.all([
      fetch(`${pluginApi}/notifications`).then(response => response.json()),
      fetch(`${pluginApi}/history`).then(response => response.json())
    ])
    configuredStateOrder = Array.isArray(notifications.stateOrder) ? notifications.stateOrder : configuredStateOrder
    stateColors = notifications.stateColors || stateColors
    visualRules = notifications.visualRules || visualRules
    activeRules = Array.isArray(notifications.rules) ? notifications.rules : activeRules
    for (const [state, color] of Object.entries(stateColors)) document.documentElement.style.setProperty(`--state-${state}`, color)
    infoAutoCloseSeconds = Number.isInteger(notifications.infoAutoCloseSeconds) ? notifications.infoAutoCloseSeconds : 0
    shortcutInfo = typeof notifications.shortcutInfo === 'string' ? notifications.shortcutInfo : shortcutInfo
    shortcutHistory = typeof notifications.shortcutHistory === 'string' ? notifications.shortcutHistory : shortcutHistory
    renderNotifications(notifications.notifications)
    window.notificationHistory = history.events || []
    if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false' && historyMode === 'critical') {
      renderCriticalHistory()
    } else if (document.querySelector('#history-sheet').getAttribute('aria-hidden') === 'false' && historyPath) {
      const selected = activeNotifications.find(item => item.id === historyFocusId)
      renderSelectedHistory()
    } else {
      renderHistory([])
    }
  } catch (error) {
    summary.textContent = `Could not load notifications: ${error.message}`
  }
}

refresh()
setInterval(refresh, 5000)
