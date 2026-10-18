'use strict'

;(function exposeDiagnosticsView(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.NotificationDiagnosticsView = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const severity = { healthy: 0, warning: 1, error: 2 }

  function worst(...states) {
    return states.reduce((current, state) => severity[state] > severity[current] ? state : current, 'healthy')
  }

  function present(value) {
    if (value === null || value === undefined || value === '') return '–'
    if (typeof value === 'object') return JSON.stringify(value)
    return value
  }

  function item(label, value, status = 'healthy') {
    return { label, value: present(value), status }
  }

  /** Build a presentation-only diagnostics model from unmodified runtime data. */
  function buildDiagnosticsModel({ clientPoll = {}, server = {}, webAppVersion = 'unknown', connected = false, error = null }) {
    const serverVersion = server.plugin?.version || 'unknown'
    const versionsMatch = serverVersion !== 'unknown' && webAppVersion !== 'unknown' && serverVersion === webAppVersion
    const configurationState = server.nodeRed?.configurationStatus?.state || 'unknown'
    const inputStates = (server.criticalInputs || []).map(input => input.state === 'fresh' ? 'healthy' : input.state === 'missing' ? 'error' : 'warning')
    const audioState = server.audio?.ready === true && server.audio?.watchdog?.state === 'ready' ? 'healthy' : 'error'
    const historyState = server.history?.available === true && !server.history?.lastError ? 'healthy' : 'error'
    const localizationState = (server.localization?.errors || []).length === 0 ? 'healthy' : 'warning'
    const overviewState = worst(
      error ? 'error' : 'healthy',
      connected ? 'healthy' : 'error',
      configurationState === 'ready' ? 'healthy' : 'error',
      versionsMatch ? 'healthy' : 'warning',
      server.snapshot?.lastError ? 'error' : 'healthy',
      audioState,
      historyState,
      localizationState,
      ...inputStates
    )

    return {
      overall: overviewState,
      reloadRequired: !versionsMatch,
      sections: [
        {
          key: 'overview', status: overviewState, items: [
            item('overall', overviewState, overviewState),
            item('serverVersion', serverVersion, serverVersion === 'unknown' ? 'warning' : 'healthy'),
            item('webAppVersion', webAppVersion, webAppVersion === 'unknown' ? 'warning' : 'healthy'),
            item('versionMatch', versionsMatch, versionsMatch ? 'healthy' : 'warning'),
            item('connection', connected ? 'connected' : 'disconnected', connected ? 'healthy' : 'error'),
            item('configuration', configurationState, configurationState === 'ready' ? 'healthy' : 'error')
          ]
        },
        {
          key: 'browser', status: connected && !clientPoll.lastError ? 'healthy' : 'warning', items: [
            item('pollStarted', clientPoll.lastStartedAt), item('pollCompleted', clientPoll.lastCompletedAt),
            item('pollDuration', clientPoll.durationMs), item('pollError', clientPoll.lastError, clientPoll.lastError ? 'warning' : 'healthy')
          ]
        },
        {
          key: 'server', status: configurationState === 'ready' && !server.snapshot?.lastError ? 'healthy' : 'error', items: [
            item('startedAt', server.startedAt), item('snapshotCompleted', server.snapshot?.lastCompletedAt),
            item('snapshotDuration', server.snapshot?.durationMs), item('snapshotError', server.snapshot?.lastError?.message, server.snapshot?.lastError ? 'error' : 'healthy'),
            item('snapshotActive', server.snapshot?.active), item('snapshotPending', server.snapshot?.pending),
            item('snapshotLastSuccess', server.snapshot?.lastSuccessfulAt), item('snapshotLastSuccessDuration', server.snapshot?.lastSuccessfulDurationMs),
            item('snapshotTimeouts', server.snapshot?.timeoutCount), item('snapshotCoalesced', server.snapshot?.coalescedCount),
            item('snapshotMaxConcurrency', server.snapshot?.maxConcurrency),
            item('deltaReceived', server.delta?.lastReceivedAt), item('deltaCount', server.delta?.count),
            item('nodeRedRevision', server.nodeRed?.revision), item('deployEvents', server.nodeRed?.runtimeDeployEventsAvailable)
          ]
        },
        {
          key: 'inputs', status: worst(...inputStates), items: (server.criticalInputs || []).flatMap(input => [
            item('input', input.name, input.state === 'fresh' ? 'healthy' : 'warning'), item('inputState', input.state, input.state === 'fresh' ? 'healthy' : 'warning'),
            item('inputSource', `${input.observedSource || '–'} / ${input.expectedSource || '–'}`), item('inputAge', input.ageMs)
          ])
        },
        {
          key: 'audio', status: audioState, items: [
            item('audioReady', server.audio?.ready, audioState), item('audioProcesses', server.audio?.activeProcesses),
            item('audioBackend', server.audio?.watchdog?.backend?.command), item('audioDevice', server.audio?.watchdog?.device?.name),
            item('audioWatchdog', server.audio?.watchdog?.state, audioState), item('audioSystem', server.audio?.systemNotification?.state)
          ]
        },
        {
          key: 'tasks', status: (server.externalTasks?.active || 0) > 0 ? 'warning' : 'healthy', items: [
            item('tasksConfigured', server.externalTasks?.configured), item('tasksEnabled', server.externalTasks?.enabled),
            item('tasksActive', server.externalTasks?.active), item('tasksAttempted', server.externalTasks?.attempted),
            item('tasksLastResult', server.externalTasks?.lastResult)
          ]
        },
        {
          key: 'history', status: historyState, items: [
            item('historyAvailable', server.history?.available, historyState), item('historyEntries', server.history?.eventCount),
            item('historyLastWrite', server.history?.lastWriteAt), item('historyError', server.history?.lastError, server.history?.lastError ? 'error' : 'healthy')
          ]
        },
        {
          key: 'localization', status: localizationState, items: [
            item('locales', (server.localization?.locales || []).map(locale => locale.locale || locale).join(', ')),
            item('fallbackLocale', server.localization?.fallbackLocale),
            item('localizationErrors', (server.localization?.errors || []).length, localizationState)
          ]
        }
      ],
      raw: { clientPoll, server, diagnosticsError: error?.message || null }
    }
  }

  return { buildDiagnosticsModel, worst }
})
