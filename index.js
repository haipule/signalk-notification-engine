'use strict'

const fs = require('node:fs')
const path = require('node:path')
const NotificationStore = require('./lib/notification-store')
const classify = require('./lib/classifier')
const NotificationActions = require('./lib/actions')
const { PolicyResolver } = require('./lib/policies')
const HistoryRepository = require('./lib/history-repository')
const { loadLifecycleRules, endsLifecycle } = require('./lib/lifecycle-rules')
const { fromDataModel, mergeSnapshots } = require('./lib/notification-snapshot')
const { normalizeSource } = require('./lib/notification-source')
const AudioPlayer = require('./lib/audio-player')
const AudioPlaybackRegistry = require('./lib/audio-playback-registry')
const AudioRepeatPlan = require('./lib/audio-repeat-plan')
const { AudioCircuitBreaker } = require('./lib/audio-circuit-breaker')
const AudioCircuitRepository = require('./lib/audio-circuit-repository')
const { AudioSystemNotification, AUDIO_SYSTEM_PATH } = require('./lib/audio-system-notification')
const AudioSystemRepository = require('./lib/audio-system-repository')
const { AudioSelfTest, AUDIO_SELF_TEST_ORIGIN_PATH } = require('./lib/audio-self-test')
const requestActor = require('./lib/request-actor')
const Diagnostics = require('./lib/diagnostics')
const { AudioWatchdog } = require('./lib/audio-watchdog')
const { RuntimeTestNotifications } = require('./lib/runtime-test-notifications')
const { getNodeRed, readConfiguration, subscribeToDeploy } = require('./lib/node-red-runtime')
const { normalizeFlowRules, rulesMarkdown } = require('./lib/flow-rules')
const { normalizeSoundConfig, resolveSoundPauseSeconds } = require('./lib/sound-config')
const visualColorPool = require('./lib/visual-colors')
const visualColorKeys = Object.keys(visualColorPool)
const visualColorNames = ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple']
const defaultColorPaletteFile = path.join(__dirname, 'examples', 'notification-colors.json')
const defaultSoundPaletteFile = path.join(__dirname, 'examples', 'notification-sounds.json')

const SNAPSHOT_INTERVAL_MS = 5000

/**
 * Create the Signal K notification manager plugin.
 *
 * The plugin deliberately observes every notification but does not become the
 * authority for any alarm. It will only add safe actions after the WebApp and
 * action adapter have been introduced in the next increment.
 *
 * @param {object} app Signal K server plugin API.
 * @returns {object} Signal K plugin descriptor.
 */
module.exports = function createPlugin(app) {
  let historyRepository = null
  let audioCircuitRepository = null
  let audioSystemRepository = null
  let configuredClassifier = classify
  let configuredStateOrder = ['warn', 'alert', 'nominal', 'normal']
  let stateColors = { emergency: visualColorPool.red, alarm: visualColorPool.darkRed, warn: visualColorPool.yellow, alert: visualColorPool.orange, nominal: visualColorPool.green, normal: visualColorPool.grey }
  let colorPalette = { ...visualColorPool }
  let visualRules = {}
  let soundsByState = {}
  let infoAutoCloseSeconds = 0
  let shortcutInfo = 'i'
  let shortcutHistory = 'h'
  let historyRules = []
  let lifecycleRules = []
  let clearHistoryOnStart = false
  let clearHistoryPath = ''
  let clearHistoryPathOnSave = false
  let clearHistoryOccurrenceId = ''
  let historyRetentionDays = 0
  let testNotificationId = null
  let testNotificationTimer = null
  let testNotificationEnabled = false
  let testTonePath = path.join(__dirname, 'sounds', 'test.wav')
  const audioTimers = new Map()
  const audioAttempts = new Map()
  const audioPlaybackRegistry = new AudioPlaybackRegistry()
  const silencedAudio = new Map()
  const store = new NotificationStore({
    classify: notification => configuredClassifier(notification),
    shouldRecord: notification => shouldRecordHistory(notification),
    lifecycleRules,
    endsLifecycle,
    onEvent: event => {
      historyRepository?.append(event)
    },
    onChange: event => applyNotificationAudio(event)
  })
  const audioCircuitBreaker = new AudioCircuitBreaker({
    onTransition: event => {
      store.recordLocalAuditEvent(event.type, event.notification, { circuit: event.circuit })
      app.debug?.(`Notification audio circuit transition ${event.type} for ${event.circuit.key}`)
    },
    onChange: snapshot => audioCircuitRepository?.save(snapshot)
  })
  const audioSystemNotification = new AudioSystemNotification({
    publish: notification => publishAudioSystemNotification(notification),
    onChange: snapshot => audioSystemRepository?.save(snapshot)
  })
  function applyNotificationAudio(event) {
    // This plugin-owned warning is visual-only by design. Keeping the guard
    // ahead of policy resolution prevents any Node-RED sound rule from turning
    // an audio failure report into a recursive playback failure.
    if (event.notification.path === AUDIO_SYSTEM_PATH) {
      stopNotificationAudio(event.notification.occurrenceId)
      return
    }
    const policy = policyResolver.resolve(event.notification)
    const locallyEnabled = isLocallyEnabledState(event.notification.state)
    const audioEligible = audioReady && locallyEnabled && event.type !== 'action_requested'
    const signalKSilenced = event.notification.status?.silenced === true
    if (event.type === 'cleared') {
      silencedAudio.delete(event.notification.occurrenceId)
      stopNotificationAudio(event.notification.occurrenceId)
      audioCircuitBreaker.endLifecycle(event.notification)
    } else if (['normal', 'nominal'].includes(event.notification.state)) {
      silencedAudio.delete(event.notification.occurrenceId)
      stopNotificationAudio(event.notification.occurrenceId)
      audioCircuitBreaker.endLifecycle(event.notification)
    } else if (signalKSilenced) {
      silencedAudio.set(event.notification.occurrenceId, event.notification.state)
      stopNotificationAudio(event.notification.occurrenceId)
    } else if (silencedAudio.get(event.notification.occurrenceId) === event.notification.state) stopNotificationAudio(event.notification.occurrenceId)
    else if (audioEligible && policy.audio !== 'off' && policy.soundConfig?.active !== false && policy.soundConfig?.file) {
      silencedAudio.delete(event.notification.occurrenceId)
      startNotificationAudio(event.notification, policy.soundConfig)
    } else if (policy.audio === 'off' || policy.visible === false) {
      stopNotificationAudio(event.notification.occurrenceId)
    }
  }

  const actions = new NotificationActions(app)
  const runtimeTests = new RuntimeTestNotifications(app)
  let policyResolver = new PolicyResolver([], {}, readSignalKValue)
  let unsubscribes = []
  let lifecycle = 0
  let snapshotTimer = null
  let audioReady = false
  let nodeRedUnsubscribe = null
  let nodeRedConfigChecksum = null
  let nodeRedRuntime = null
  let runtimeOptions = {}
  let configReloadPromise = null
  let configurationError = null
  let activeRules = []
  const conditionValues = new Map()
  const originalSources = new Map()
  const diagnostics = new Diagnostics()
  const audioWatchdog = new AudioWatchdog()
  let audioWatchdogTimer = null
  let conditionUnsubscribes = []
  const audioPlayer = new AudioPlayer({
    onError: error => app.error?.(`Unable to play notification sound: ${error.message}`),
    onResult: () => {}
  })
  const audioSelfTestRecord = {
    id: 'notification-engine-audio-self-test',
    occurrenceId: 'notification-engine-audio-self-test',
    // This is an internal failure-origin identity, not a published Signal K
    // notification. It must differ from AUDIO_SYSTEM_PATH so the recursion
    // guard does not suppress a genuine operator "not heard" report.
    path: AUDIO_SELF_TEST_ORIGIN_PATH,
    source: { label: 'Notification Engine' },
    state: 'alarm',
    message: 'Notification Engine audible operator test',
    historyKey: `${AUDIO_SYSTEM_PATH}|Notification Engine`
  }
  const audioSelfTest = new AudioSelfTest({
    play: (file, callback) => audioPlayer.play(file, '__audio_self_test__', callback),
    onEvent: event => store.recordLocalAuditEvent(event.type, audioSelfTestRecord, { audioTest: event.test }),
    onFailure: (test, result) => audioSystemNotification.recordFailure({ ...audioSelfTestRecord, message: test.statement }, result),
    onPassed: () => audioSystemNotification.recordSuccess(audioSelfTestRecord)
  })

  function readSignalKValue(pathName) {
    const cached = conditionValues.get(pathName)
    if (conditionValues.has(pathName)) return cached
    const direct = app.getSelfPath?.(pathName)
    if (direct !== undefined) return unwrapSignalKValue(direct)
    const full = app.getPath?.(`vessels.self.${pathName}`)
    return unwrapSignalKValue(full)
  }

  function unwrapSignalKValue(value) {
    return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value
  }

  function applyRuntimeConfiguration(flowOptions) {
    colorPalette = loadPalette(flowOptions?.colorPaletteFile, visualColorPool)
    soundsByState = normalizeSoundsByState(flowOptions?.soundsByState, flowOptions?.soundPaletteFile)
    audioPlayer.player = String(flowOptions?.audioPlayer || 'aplay')
    audioPlayer.device = String(flowOptions?.audioDevice || 'default')
    runAudioWatchdog()
    policyResolver = new PolicyResolver([...normalizeFlowRules(flowOptions?.activeRules), ...normalizePolicies(flowOptions?.policies)], soundsByState, readSignalKValue)
    configuredClassifier = classify
    configuredStateOrder = normalizeStateOrder(flowOptions?.stateOrder, flowOptions?.sortOrder, flowOptions?.visibleStates)
    stateColors = normalizeStateColors(flowOptions?.stateColors)
    visualRules = normalizeVisualRules(flowOptions?.visualRules, stateColors)
    infoAutoCloseSeconds = normalizeInfoTimeout(flowOptions?.infoAutoCloseSeconds)
    shortcutInfo = normalizeShortcut(flowOptions?.shortcutInfo, 'i')
    shortcutHistory = normalizeShortcut(flowOptions?.shortcutHistory, 'h')
    if (shortcutInfo && shortcutInfo === shortcutHistory) shortcutHistory = ''
    historyRules = normalizeHistoryRules(flowOptions?.historyRules)
    clearHistoryOnStart = flowOptions?.clearHistoryOnStart === true
    clearHistoryPath = normalizeClearPath(flowOptions?.clearHistoryPath)
    clearHistoryPathOnSave = flowOptions?.clearHistoryPathOnSave === true
    clearHistoryOccurrenceId = String(flowOptions?.clearHistoryOccurrenceId || '')
    testNotificationEnabled = flowOptions?.testNotif?.enabled === true
    testTonePath = path.resolve(String(flowOptions?.testTonePath || path.join(__dirname, 'sounds', 'test.wav')))
    historyRetentionDays = Number.isInteger(flowOptions?.historyRetentionDays) ? Math.max(0, Math.min(3650, flowOptions.historyRetentionDays)) : 0
    subscribeToConditions()
  }

  // Node-RED does not emit a deploy event on every supported Signal K build.
  // Re-read the flow on API access as a safety net so a deployed rule cannot
  // remain active in this plugin merely because the event was missed.
  async function refreshNodeRedConfiguration({ force = false } = {}) {
    // A failed configuration is latched. Polling the WebApp must not repeatedly
    // parse the same unsafe deploy or continue operating with stale rules; only
    // a new runtime deploy event is allowed to attempt recovery.
    if (configurationError && !force) return
    if (!nodeRedRuntime || configReloadPromise) return configReloadPromise
    configReloadPromise = (async () => {
      try {
        const next = await readConfiguration(nodeRedRuntime)
        if (next.checksum === nodeRedConfigChecksum && !configurationError) return
        const recovering = Boolean(configurationError)
        nodeRedConfigChecksum = next.checksum
        activeRules = next.rules
        writeRuleDescriptionFiles(activeRules, nodeRedConfigChecksum)
        applyRuntimeConfiguration({ ...runtimeOptions, ...next.config.notificationEngine, activeRules: next.rules })
        configurationError = null
        if (recovering) await resumeNotificationProcessing()
        app.debug?.(`Notification Engine configuration updated from Node-RED`)
      } catch (error) {
        configurationError = { message: error.message, failedAt: new Date().toISOString() }
        suspendNotificationProcessing()
        app.error?.(`Unable to refresh Node-RED notification rules: ${error.message}`)
      } finally {
        configReloadPromise = null
      }
    })()
    return configReloadPromise
  }

  const plugin = {
    id: 'signalk-notification-engine',
    name: 'Notification Engine',
    description: 'Flow-based Signal K notification automation engine',

    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        policies: {
          type: 'array',
          title: 'Presentation Policies',
          description: 'Matching policies are inherited from general to specific and control only local presentation and audio handling.',
          default: [],
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', title: 'Name', default: '' },
              pathPrefix: { type: 'string', title: 'Path Prefix', default: '' },
              source: { type: 'string', title: 'Source Label', default: '' },
              priority: { type: 'string', title: 'Display Priority', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
              audio: { type: 'string', title: 'Audio Policy', enum: ['inherit', 'on', 'off'], default: 'inherit' },
              sound: { type: 'object', title: 'Specific Sound', additionalProperties: false, properties: {
                active: { type: 'boolean', title: 'Active', default: true },
                file: { type: 'string', title: 'Sound file', default: '' },
                count: { type: 'integer', title: 'Playback count (0 = loop)', minimum: 0, maximum: 99, default: 1 }
              } },
              visible: { type: 'boolean', title: 'Show in Alarm Centre', default: true }
            }
          }
        }
        ,
        stateOrder: {
          type: 'array', title: 'Notification State Order and Visibility',
          description: 'Listed states are visible and sorted in this order. Emergency and alarm are always visible first.',
          default: ['warn', 'alert', 'nominal', 'normal'],
          items: { type: 'string', enum: ['warn', 'alert', 'nominal', 'normal'] }
        }
        ,
        stateColors: {
          type: 'object', title: 'Notification State Colors',
          description: 'Hex colors used for the state marker in the table.',
          default: { emergency: '#d32f2f', alarm: '#ef5350', warn: '#f9a825', alert: '#fbc02d', nominal: '#66bb6a', normal: '#9e9e9e' },
          properties: {
            emergency: { type: 'string', title: 'Emergency', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'red' }, alarm: { type: 'string', title: 'Alarm', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'darkRed' },
            warn: { type: 'string', title: 'Warn', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'yellow' }, alert: { type: 'string', title: 'Alert', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'orange' },
            nominal: { type: 'string', title: 'Nominal', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'green' }, normal: { type: 'string', title: 'Normal', enum: Object.keys(visualColorPool), enumNames: ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple'], default: 'grey' }
          }
        }
        ,
        colorPaletteFile: {
          type: 'string', title: 'Color Palette File',
          description: 'Optional JSON file with the eight editable color names and hex values. Enter the absolute path to the file.',
          default: defaultColorPaletteFile, pattern: '^(|/.*)$'
        }
        ,
        visualRules: {
          type: 'object', title: 'Visual Presentation by State', description: 'Controls the local visual presentation. This does not change Signal K notification state.',
          default: {}, additionalProperties: false,
          properties: Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal'].map(state => [state, {
            type: 'object', additionalProperties: false, properties: {
              display: { type: 'string', title: 'Display', enum: ['table', 'banner', 'overlay'], default: state === 'emergency' || state === 'alarm' ? 'overlay' : state === 'warn' || state === 'alert' ? 'banner' : 'table' },
              color: { type: 'string', title: 'Color', enum: visualColorKeys, enumNames: visualColorNames },
              flash: { type: 'boolean', title: 'Flash', default: state === 'emergency' || state === 'alarm' },
              acknowledgeRequired: { type: 'boolean', title: 'Acknowledgement required', default: state === 'emergency' || state === 'alarm' }
            }
          }]))
        }
        ,
        soundsByState: {
          type: 'object', title: 'Standard Sound by State',
          description: 'Sound file and playback. Only visible states are active. Specific presentation policies can override this.',
          default: Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification'].map(state => [state, {
            active: true, file: path.join(__dirname, 'sounds', `${state === 'warn' ? 'warn' : state}.wav`), count: 1
          }])), additionalProperties: false,
          properties: Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification'].map(state => [state, {
            type: 'object', title: state, additionalProperties: false, properties: {
              active: { type: 'boolean', title: 'Active', default: true },
              file: { type: 'string', title: 'Sound file', default: path.join(__dirname, 'sounds', `${state === 'warn' ? 'warn' : state}.wav`) },
              count: { type: 'integer', minimum: 0, maximum: 99, title: 'Playback count (0 = loop)', default: 1 }
            }
          }]))
        }
        ,
        soundPaletteFile: {
          type: 'string', title: 'Sound Palette File',
          description: 'Optional JSON file with the eight editable sound names or paths. Enter the absolute path to the file currently in use.',
          default: defaultSoundPaletteFile, pattern: '^(|/.*)$'
        }
        ,
        audioPlayer: { type: 'string', title: 'Audio Player', description: 'Command used to play WAV files. The default is aplay.', default: 'aplay' }
        ,
        audioDevice: { type: 'string', title: 'Audio Device', description: 'ALSA device for aplay, for example default or plughw:2,0.', default: 'default' }
        ,
        playTestTone: { type: 'boolean', title: 'Play Test Tone', description: 'Play test.wav once after saving, then reset this switch.', default: false }
        ,
        testTonePath: { type: 'string', title: 'Test Tone Path', description: 'WAV file used by Play Test Tone.', default: path.join(__dirname, 'sounds', 'test.wav') }
        ,
        infoAutoCloseSeconds: {
          type: 'integer', title: 'Info Auto-Close (seconds)',
          description: '0 keeps the info window open until the X button is pressed.',
          default: 0, minimum: 0, maximum: 3600
        }
        ,
        shortcutInfo: { type: 'string', title: 'Info Shortcut', default: 'i', minLength: 0, maxLength: 1 }
        ,
        shortcutHistory: { type: 'string', title: 'History Shortcut', default: 'h', minLength: 0, maxLength: 1 }
        ,
        historyRules: {
          type: 'array', title: 'History Rules',
          description: 'First matching rule controls local audit history recording.',
          default: [],
          items: { type: 'object', additionalProperties: false, properties: {
            pathPrefix: { type: 'string', title: 'Notification Path', default: '' },
            source: { type: 'string', title: 'Source Label', default: '' },
            history: { type: 'boolean', title: 'Record in History', default: true }
          } }
        }
        ,
        clearHistoryOnStart: {
          type: 'boolean', title: 'Clear History on Next Start',
          description: 'One-shot cleanup switch. Turn it off again after restarting the plugin.',
          default: false
        }
        ,
        clearHistoryPath: {
          type: 'string', title: 'Clear History Path', default: '',
          description: 'Path prefix to remove. A trailing * is optional and means all child paths.'
        }
        ,
        clearHistoryPathOnSave: {
          type: 'boolean', title: 'Clear History for Path on Save',
          description: 'One-shot cleanup when saving configuration. Alarm and emergency events are always retained.',
          default: false
        }
        ,
        clearHistoryOccurrenceId: {
          type: 'string', title: 'Clear History Occurrence ID',
          description: 'Optional local occurrence ID to remove when saving configuration.', default: ''
        }
        ,
        historyLimit: {
          type: 'integer', title: 'History Entries', description: 'Number of local audit events retained on disk.', default: 500, minimum: 50, maximum: 5000
        }
        ,
        historyRetentionDays: {
          type: 'integer', title: 'History Retention (days)',
          description: 'Delete local audit events older than this. 0 disables age-based cleanup.',
          default: 0, minimum: 0, maximum: 3650
        }
        ,
        testNotif: {
          type: 'object', title: 'TestNotif', description: 'Creates one clearly marked Signal K test notification and removes it automatically.', default: { enabled: false, state: 'warn', message: 'Notification Manager test', runtimeSeconds: 30 },
          additionalProperties: false,
          properties: {
            enabled: { type: 'boolean', title: 'Enable TestNotif', default: false },
            state: { type: 'string', title: 'Test State', enum: ['warn', 'alert', 'alarm', 'emergency'], default: 'warn' },
            message: { type: 'string', title: 'Test Message', default: 'Notification Manager test' },
            path: { type: 'string', title: 'Test Path', default: 'notifications.notification-manager-test' },
            runtimeSeconds: { type: 'integer', title: 'Runtime (seconds)', minimum: 1, maximum: 3600, default: 30 },
            includePosition: { type: 'boolean', title: 'Include Position', default: false },
            includeCreatedAt: { type: 'boolean', title: 'Include Created At', default: true }
          }
        }
      }
    },

    uiSchema: {
      soundsByState: Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification'].map(state => [state, {
        count: { 'ui:widget': 'updown' }
      }]))
    },

    async start(options) {
      stopSubscriptions()
      void stopTestNotification()
      const currentLifecycle = ++lifecycle
      const nodeRed = getNodeRed()
      nodeRedRuntime = nodeRed
      runtimeOptions = { ...options }
      const nodeRedConfig = await readConfiguration(nodeRed)
      nodeRedConfigChecksum = nodeRedConfig.checksum
      configurationError = null
      activeRules = nodeRedConfig.rules
      writeRuleDescriptionFiles(activeRules, nodeRedConfigChecksum)
      const flowOptions = {
        ...options,
        activeRules: nodeRedConfig.rules,
        stateOrder: nodeRedConfig.config.notificationEngine.stateOrder,
        visibleStates: nodeRedConfig.config.notificationEngine.visibleStates
      }
      applyRuntimeConfiguration(flowOptions)
      lifecycleRules = loadLifecycleRules(app.getDataDirPath?.(), message => app.error?.(message))
      store.lifecycleRules = lifecycleRules
      clearHistoryOnStart = flowOptions?.clearHistoryOnStart === true
      clearHistoryPath = normalizeClearPath(flowOptions?.clearHistoryPath)
      clearHistoryPathOnSave = flowOptions?.clearHistoryPathOnSave === true
      clearHistoryOccurrenceId = String(flowOptions?.clearHistoryOccurrenceId || '')
      testNotificationEnabled = flowOptions?.testNotif?.enabled === true
      historyRetentionDays = Number.isInteger(flowOptions?.historyRetentionDays) ? Math.max(0, Math.min(3650, flowOptions.historyRetentionDays)) : 0
      const historyLimit = Number.isInteger(flowOptions?.historyLimit) ? flowOptions.historyLimit : 500
      historyRepository = new HistoryRepository(app.getDataDirPath?.(), {
        limit: Math.max(50, Math.min(5000, historyLimit)),
        onError: message => app.error?.(message)
      })
      audioCircuitRepository = new AudioCircuitRepository(app.getDataDirPath?.(), {
        onError: message => app.error?.(message)
      })
      audioSystemRepository = new AudioSystemRepository(app.getDataDirPath?.(), {
        onError: message => app.error?.(message)
      })
      nodeRedUnsubscribe = subscribeToDeploy(nodeRed, async () => {
        await refreshNodeRedConfiguration({ force: true })
      })
      void initialize(currentLifecycle, flowOptions?.testNotif)
      if (options?.playTestTone === true && typeof app.savePluginOptions === 'function') {
        app.savePluginOptions({ ...options, playTestTone: false }, error => {
          if (error) app.error?.(`Unable to reset audio test configuration: ${error.message}`)
        })
      }
      if (options?.playTestTone === true) {
        void playTestTone(currentLifecycle, options?.testTonePath)
      }
      if (options?.testNotif?.enabled === true && typeof app.savePluginOptions === 'function') {
        app.savePluginOptions({ ...options, testNotif: { ...options.testNotif, enabled: false } }, error => {
          if (error) app.error?.(`Unable to reset TestNotif configuration: ${error.message}`)
        })
      }
    },

    async stop() {
      lifecycle += 1
      audioReady = false
      for (const timer of audioTimers.values()) clearInterval(timer)
      audioTimers.clear()
      audioAttempts.clear()
      audioPlaybackRegistry.clear()
      silencedAudio.clear()
      audioPlayer.stop()
      audioSelfTest.stop()
      stopAudioWatchdog()
      stopSubscriptions()
      stopSnapshotSync()
      await stopTestNotification()
      await runtimeTests.clearAll()
      nodeRedUnsubscribe?.()
      nodeRedUnsubscribe = null
      nodeRedConfigChecksum = null
      configurationError = null
      await audioCircuitRepository?.flush()
      audioCircuitRepository = null
      await audioSystemRepository?.flush()
      audioSystemRepository = null
      await historyRepository?.flush()
      historyRepository = null
      audioCircuitBreaker.restore({ version: 1, states: [] })
      store.clear()
    },

    /**
     * Temporary internal access point for tests and future WebApp routes.
     * Returned records are copies, so callers cannot mutate the store.
     */
    getNotifications() {
      return store.list().map(notification => ({
        ...notification,
        policy: notification.path === AUDIO_SYSTEM_PATH
          ? { ...policyResolver.resolve(notification), visible: true, audio: 'off', soundConfig: null }
          : policyResolver.resolve(notification)
      }))
    },

    getNotificationHistory() {
      return store.history()
    },

    registerWithRouter(router) {
      const readOnly = router.access('readonly')
      readOnly.get('/notifications', async (_request, response) => {
        // Refresh on request as well as on the deploy event. The embedded
        // runtime can miss a deploy notification, while the Alarm Centre
        // polls this endpoint regularly; re-reading here makes a deployed
        // Node-RED configuration converge without requiring a Signal K restart.
        await refreshNodeRedConfiguration()
        if (!configurationError) await syncSnapshot()
        response.json({ notifications: plugin.getNotifications(), rules: activeRules, ruleChecksum: nodeRedConfigChecksum, configurationStatus: configurationError ? { state: 'error', ...configurationError } : { state: 'ready' }, stateOrder: configuredStateOrder, stateColors, visualRules, infoAutoCloseSeconds, shortcutInfo, shortcutHistory, audioTest: audioSelfTest.toJSON(), updatedAt: new Date().toISOString() })
      })
      readOnly.get('/rules', (_request, response) => {
        const file = path.join(app.getDataDirPath?.() || path.join(__dirname, 'data'), 'deployed-rules', 'deployed-rules.md')
        if (!fs.existsSync(file)) return response.status(404).type('text/plain').send('No deployed rules documentation available.')
        response.type('text/plain').send(fs.readFileSync(file, 'utf8'))
      })
      readOnly.get('/history', (_request, response) => {
        response.json({ events: store.history() })
      })
      readOnly.get('/diagnostics', (_request, response) => {
        response.json(diagnostics.toJSON({
          nodeRed: {
            revision: nodeRedConfigChecksum,
            configurationStatus: configurationError ? { state: 'error', ...configurationError } : { state: 'ready' },
            runtimeDeployEventsAvailable: Boolean(nodeRedUnsubscribe)
          },
          audio: {
            ready: audioReady,
            player: audioPlayer.player,
            device: audioPlayer.device,
            activeProcesses: audioPlayer.activeProcessCount(),
            activeProcessDetails: audioPlayer.activeProcessDetails(),
            pendingRetries: audioTimers.size,
            lastResult: audioPlayer.lastResult ? { ...audioPlayer.lastResult, error: audioPlayer.lastResult.error?.message || null } : null,
            watchdog: audioWatchdog.lastCheck,
            circuitBreaker: {
              ...audioCircuitBreaker.toJSON(),
              persistence: audioCircuitRepository?.status() || { available: false, lastWriteAt: null, lastError: null }
            },
            systemNotification: {
              ...audioSystemNotification.toJSON(),
              persistence: audioSystemRepository?.status() || { available: false, lastWriteAt: null, lastError: null }
            },
            selfTest: audioSelfTest.toJSON()
          },
          history: historyRepository?.status() || { available: false, eventCount: 0, lastWriteAt: null, lastError: null }
        }))
      })
      const readWrite = router.access('readwrite')
      readWrite.get('/runtime-tests', (_request, response) => {
        response.json({ tests: runtimeTests.list() })
      })
      readWrite.post('/runtime-tests/:slot', (request, response) => {
        if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
        if (!audioReady) return response.status(503).json({ state: 'REJECTED', message: 'Notification processing is not ready' })
        try {
          response.status(201).json(runtimeTests.raise(request.params.slot, request.body || {}))
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      readWrite.patch('/runtime-tests/:slot', (request, response) => {
        if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
        try {
          response.json(runtimeTests.update(request.params.slot, request.body || {}))
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      readWrite.delete('/runtime-tests/:slot', async (request, response) => {
        try {
          const cleared = await runtimeTests.clear(request.params.slot)
          response.status(cleared ? 204 : 404).end()
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      readWrite.post('/audio-test/start', (request, response) => {
        if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
        if (!audioReady) return response.status(503).json({ state: 'REJECTED', message: 'Audio is not ready' })
        try {
          response.status(202).json(audioSelfTest.start({ actor: requestActor(request), device: audioPlayer.device, file: testTonePath }))
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      readWrite.post('/audio-test/not-heard', (request, response) => {
        try {
          response.status(202).json(audioSelfTest.reportNotHeard(requestActor(request)))
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      readWrite.delete('/history', async (request, response) => {
        const pathPrefix = normalizeClearPath(request.query.path)
        const occurrenceId = String(request.query.occurrenceId || '')
        if (!historyRepository) return response.status(503).json({ state: 'REJECTED', message: 'History is not available' })
        if (occurrenceId) {
          await historyRepository.prune(event => event.notification?.occurrenceId === occurrenceId)
        } else if (pathPrefix) {
          await historyRepository.prune(event => String(event.notification?.path || '').toLowerCase().startsWith(pathPrefix))
        } else {
          await historyRepository.clear()
        }
        store.replaceHistory(historyRepository.events)
        response.status(204).end()
      })
      readWrite.post('/notifications/action-all/:action', async (request, response) => {
        if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
        let silencedRecords = []
        try {
          const records = plugin.getNotifications()
          if (request.params.action === 'silence') {
            silencedRecords = records.filter(record => actions.allowed(record, 'silence'))
            for (const record of silencedRecords) {
              silencedAudio.set(record.occurrenceId, record.state)
              stopNotificationAudio(record.occurrenceId)
            }
          }
          const affected = await actions.executeAll(records, request.params.action)
          for (const record of affected) {
            store.recordOperatorAction(request.params.action, record)
          }
          response.status(202).json({ state: 'ACCEPTED', count: affected.length })
        } catch (error) {
          for (const record of silencedRecords) silencedAudio.delete(record.occurrenceId)
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
      // Keep the literal action-all route above this parameterized route.
      // Otherwise Express treats "action-all" as a notification id and the
      // global action never reaches executeAll().
      readWrite.post('/notifications/:id/:action', async (request, response) => {
        if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
        let silencedRecord = null
        try {
          const record = store.get(request.params.id)
          if (request.params.action === 'silence') {
            silencedRecord = record
            silencedAudio.set(record.occurrenceId, record.state)
            stopNotificationAudio(record.occurrenceId)
          }
          await actions.execute(record, request.params.action)
          store.recordOperatorAction(request.params.action, record)
          response.status(202).json({ state: 'ACCEPTED' })
        } catch (error) {
          if (silencedRecord) silencedAudio.delete(silencedRecord.occurrenceId)
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
    }
  }

  /** Read the authoritative current notification snapshot when available. */
  async function initialize(currentLifecycle, testNotificationConfiguration) {
    const [events, circuitSnapshot, audioSystemSnapshot] = await Promise.all([
      historyRepository.load(),
      audioCircuitRepository.load(),
      audioSystemRepository.load()
    ])
    audioCircuitBreaker.restore(circuitSnapshot)
    audioSystemNotification.restore(audioSystemSnapshot)
    if (currentLifecycle !== lifecycle) return
    await runtimeTests.clearStale()
    if (clearHistoryOnStart) {
      await historyRepository.clear()
      store.replaceHistory([])
    } else {
      store.replaceHistory(events)
      const lastAudioTest = store.history().find(event => event.audioTest)?.audioTest
      audioSelfTest.restore(lastAudioTest)
      if (!testNotificationEnabled) {
        await historyRepository.prune(event => event.notification?.data?.notificationManagerTest === true)
        store.replaceHistory(historyRepository.events)
      }
      if (historyRetentionDays > 0) {
        await historyRepository.pruneBefore(Date.now() - historyRetentionDays * 86400000)
        store.replaceHistory(historyRepository.events)
      }
      if (clearHistoryPathOnSave && clearHistoryPath) {
        await historyRepository.prune(event => {
          const notification = event.notification || {}
          return String(notification.path || '').toLowerCase().startsWith(clearHistoryPath) &&
            !['alarm', 'emergency'].includes(notification.state)
        })
        store.replaceHistory(historyRepository.events)
      }
      if (clearHistoryOccurrenceId) {
        await historyRepository.prune(event => event.notification?.occurrenceId === clearHistoryOccurrenceId)
        store.replaceHistory(historyRepository.events)
      }
    }
    await syncSnapshot()
    audioCircuitBreaker.reconcileActive(store.list())
    if (configurationError) return
    if (clearHistoryOnStart) {
      await historyRepository.clear()
      store.replaceHistory([])
    }
    subscribeToNotifications()
    audioSystemNotification.synchronize()
    audioReady = true
    for (const notification of store.list()) applyNotificationAudio({ type: 'startup', notification })
    void startTestNotification(testNotificationConfiguration)
    startSnapshotSync()
    app.debug?.(`Notification manager started with ${store.size} notification(s)`)
  }

  /** Create and later clear only the manager-owned, explicitly configured test alarm. */
  async function startTestNotification(configuration) {
    if (!configuration?.enabled || typeof app.notifications?.raise !== 'function') return
    try {
      const state = ['warn', 'alert', 'alarm', 'emergency'].includes(configuration.state) ? configuration.state : 'warn'
      const path = String(configuration.path || 'notifications.notification-manager-test')
      const data = { notificationManagerTest: true, source: 'Notification Manager Test' }
      testNotificationId = app.notifications.raise({
        state,
        message: String(configuration.message || 'Notification Manager test'),
        path,
        includePosition: configuration.includePosition === true,
        includeCreatedAt: configuration.includeCreatedAt !== false,
        data
      })
      const runtime = Number.isInteger(configuration.runtimeSeconds) ? Math.max(1, Math.min(3600, configuration.runtimeSeconds)) : 30
      testNotificationTimer = setTimeout(() => { void stopTestNotification() }, runtime * 1000)
      app.debug?.(`Notification Manager test raised id=${testNotificationId}, runtime=${runtime}s`)
    } catch (error) {
      app.error?.(`Unable to raise Notification Manager test: ${error.message}`)
    }
  }

  async function playTestTone(currentLifecycle, configuredPath) {
    while (currentLifecycle === lifecycle && !audioReady) await new Promise(resolve => setTimeout(resolve, 100))
    if (currentLifecycle === lifecycle) audioPlayer.play(path.resolve(String(configuredPath || path.join(__dirname, 'sounds', 'test.wav'))))
  }

  async function stopTestNotification() {
    if (testNotificationTimer !== null) {
      clearTimeout(testNotificationTimer)
      testNotificationTimer = null
    }
    if (!testNotificationId) return
    const id = testNotificationId
    testNotificationId = null
    try {
      if (typeof app.notifications?.clear !== 'function') throw new Error('Signal K notification clear API unavailable')
      app.notifications.clear(id)
      app.debug?.(`Notification Manager test cleared id=${id}`)
    } catch (error) {
      app.error?.(`Unable to clear Notification Manager test id=${id}: ${error.message}`)
    }
  }

  /** Publish the plugin-owned visual audio warning through the Signal K delta boundary. */
  function publishAudioSystemNotification(notification) {
    if (typeof app.handleMessage !== 'function') {
      app.error?.('Unable to publish audio system notification: Signal K handleMessage API unavailable')
      return
    }
    app.handleMessage(plugin.id, {
      context: 'vessels.self',
      updates: [{
        timestamp: new Date().toISOString(),
        values: [{
          path: notification.path,
          value: {
            id: notification.id,
            state: notification.state,
            message: notification.message,
            method: notification.method,
            temporarySilenceSupport: notification.temporarySilenceSupport,
            acknowledgeSupport: notification.acknowledgeSupport,
            data: notification.data
          }
        }]
      }]
    })
  }

  /**
   * Read the notification manager and both supported data-model views.
   *
   * The REST fallback matters when Signal K core notification management is
   * enabled: its registry contains managed alarms, while producers that write
   * directly to the notification data model remain visible through this API.
   */
  async function readSnapshot() {
    let apiNotifications = {}
    try {
      apiNotifications = await readNotificationsApi()
    } catch (error) {
      // The HTTP projection is a fallback, so retain any previously observed
      // state and still try the in-process APIs when it is temporarily down.
      app.error?.(`Unable to read Signal K notifications API: ${error.message}`)
    }

    try {
      const managed = typeof app.notifications?.list === 'function' ? app.notifications.list() : {}
      // Depending on server version and a provider's startup order, either
      // view of the full model can be populated first. Merge both instead of
      // making the WebApp depend on the notification registry alone.
      const selfNotifications = typeof app.getSelfPath === 'function'
        ? fromDataModel(app.getSelfPath('notifications'))
        : {}
      const fullModelNotifications = typeof app.getPath === 'function'
        ? fromDataModel(app.getPath('vessels.self.notifications'))
        : {}
      const snapshot = mergeSnapshots(selfNotifications, fullModelNotifications, apiNotifications, managed)
      enrichOriginalSources(snapshot)
      if (!testNotificationEnabled) {
        for (const [id, notification] of Object.entries(snapshot)) {
          if (notification.value?.data?.notificationManagerTest === true) delete snapshot[id]
        }
      }
      return snapshot
    } catch (error) {
      // Do not discard the independently obtained API snapshot because an
      // optional in-process view is unavailable on this server version.
      app.error?.(`Unable to read in-process notification snapshot: ${error.message}`)
      return apiNotifications
    }
  }

  /**
   * Notification producers often write a notification under the same path as
   * the condition they report, while the notification node itself is stamped
   * with the handler source. Recover the producer source from that underlying
   * Signal K path when available.
   */
  function enrichOriginalSources(snapshot) {
    for (const notification of Object.values(snapshot || {})) {
      const dataPath = String(notification.path || '').replace(/^notifications\./, '')
      const source = originalSources.get(dataPath) || readOriginalSource(notification.path)
      if (source) notification.source = source
    }
  }

  function readOriginalSource(notificationPath) {
    const dataPath = String(notificationPath || '').replace(/^notifications\./, '')
    if (!dataPath) return null
    const candidates = []
    if (typeof app.getSelfPath === 'function') candidates.push(app.getSelfPath(dataPath))
    if (typeof app.getPath === 'function') candidates.push(app.getPath(`vessels.self.${dataPath}`))
    for (const value of candidates) {
      const source = normalizeSource(value?.$source || value?.source || value?.value?.$source || value?.value?.source)
      if (source) return source
    }
    return null
  }

  /** Read the server's official, read-only notification projection locally. */
  async function readNotificationsApi() {
    if (typeof fetch !== 'function') return {}
    const port = app.config?.settings?.port || 3000
    const response = await fetch(`http://127.0.0.1:${port}/signalk/v1/api/vessels/self/notifications`)
    if (!response.ok) throw new Error(`notification API returned HTTP ${response.status}`)
    return fromDataModel(await response.json())
  }

  /** Update the store without allowing a failed local read to stop future polls. */
  async function syncSnapshot() {
    const finish = diagnostics.beginSnapshot()
    try {
      const snapshot = await readSnapshot()
      store.replaceSnapshot(snapshot)
      finish()
    } catch (error) {
      finish(error)
      throw error
    }
  }

  /** Subscribe through Signal K's supported subscription manager API. */
  function subscribeToNotifications() {
    if (!app.subscriptionmanager?.subscribe) {
      app.error?.('Signal K subscription manager is unavailable; notification updates will not be observed')
      return
    }

    const mirroredPaths = [...new Set(store.list()
      .map(notification => String(notification.path || '').replace(/^notifications\./, ''))
      .filter(Boolean))]
    app.subscriptionmanager.subscribe(
      {
        context: '*',
        sourcePolicy: 'all',
        subscribe: [{ path: 'notifications.*' }, ...mirroredPaths.map(path => ({ path }))]
      },
      unsubscribes,
      error => app.error?.(`Notification subscription error: ${error}`),
      delta => {
        diagnostics.recordDelta()
        logNotificationDelta(delta)
        for (const update of delta?.updates || []) {
          for (const item of update.values || []) {
            if (String(item.path || '').startsWith('notifications.')) continue
            const source = normalizeSource(update.source || update.$source || item.source || item.$source)
            if (!source) continue
            originalSources.set(item.path, source)
            store.setSourceForPath(item.path, source)
          }
        }
        store.applyDelta(delta, path => {
          const dataPath = String(path || '').replace(/^notifications\./, '')
          return originalSources.get(dataPath) || readOriginalSource(path)
        })
      }
    )
  }

  function subscribeToConditions() {
    stopConditionSubscriptions()
    const paths = [...new Set(activeRules.flatMap(rule => rule.match?.conditions?.map(condition => condition.path) || []))]
    for (const pathName of paths) {
      const direct = app.getSelfPath?.(pathName)
      const full = direct === undefined ? app.getPath?.(`vessels.self.${pathName}`) : direct
      conditionValues.set(pathName, unwrapSignalKValue(full))
    }
    if (paths.length === 0 || !app.subscriptionmanager?.subscribe) return
    app.subscriptionmanager.subscribe(
      { context: '*', sourcePolicy: 'all', subscribe: paths.map(path => ({ path })) },
      conditionUnsubscribes,
      error => app.error?.(`Signal K condition subscription error: ${error}`),
      delta => {
        let changed = false
        for (const update of delta?.updates || []) {
          for (const item of update.values || []) {
            if (!paths.includes(item.path)) continue
            conditionValues.set(item.path, unwrapSignalKValue(item.value))
            changed = true
          }
        }
        if (changed) refreshConditionEffects()
      }
    )
  }

  function stopConditionSubscriptions() {
    for (const unsubscribe of conditionUnsubscribes) unsubscribe()
    conditionUnsubscribes = []
    conditionValues.clear()
  }

  function refreshConditionEffects() {
    for (const notification of store.list()) applyNotificationAudio({ type: 'condition_updated', notification })
  }


  /** Log notification changes to correlate an active alarm by ID. */
  function logNotificationDelta(delta) {
    const changes = []
    for (const update of delta?.updates || []) {
      for (const item of update.values || []) {
        if (!String(item.path || '').startsWith('notifications.')) continue
        const value = item.value
        changes.push({
          path: item.path,
          source: update.source?.label || update.source?.type || '',
          id: value?.id || null,
          state: value?.state || null,
          acknowledged: value?.status?.acknowledged ?? null,
          value: value === null ? null : undefined
        })
      }
    }
    if (changes.length > 0) app.debug?.(`Notification delta: ${JSON.stringify(changes)}`)
  }

  function stopSubscriptions() {
    stopConditionSubscriptions()
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
    unsubscribes = []
  }

  /** Stop all rule-dependent processing while retaining the last observed view. */
  function suspendNotificationProcessing() {
    audioReady = false
    for (const timer of audioTimers.values()) clearTimeout(timer)
    audioTimers.clear()
    audioAttempts.clear()
    audioPlaybackRegistry.clear()
    audioPlayer.stop()
    stopSubscriptions()
    stopSnapshotSync()
  }

  /** Rebuild the authoritative view after a subsequent valid Node-RED deploy. */
  async function resumeNotificationProcessing() {
    stopSubscriptions()
    stopSnapshotSync()
    await syncSnapshot()
    subscribeToNotifications()
    audioReady = true
    for (const notification of store.list()) applyNotificationAudio({ type: 'configuration_recovered', notification })
    startSnapshotSync()
  }

  /**
   * Reconcile the current server snapshot periodically.
   *
   * Some notification producers raise their first value after plugins have
   * started. This closes that startup ordering gap while the store suppresses
   * unchanged values from the local audit history.
   */
  function startSnapshotSync() {
    stopSnapshotSync()
    snapshotTimer = setInterval(() => { void syncSnapshot() }, SNAPSHOT_INTERVAL_MS)
  }

  function stopSnapshotSync() {
    if (snapshotTimer !== null) {
      clearInterval(snapshotTimer)
      snapshotTimer = null
    }
  }

  /** Refresh passive audio health without opening the device or playing sound. */
  function runAudioWatchdog() {
    const check = () => {
      const previousState = audioWatchdog.lastCheck?.state || null
      const result = audioWatchdog.check(audioPlayer.player, audioPlayer.device)
      if (previousState === 'error' && result.state === 'ready') {
        const key = audioCircuitBreaker.watchdogRecovered()
        if (key) scheduleAudioAttempt(key, 0)
      }
    }
    check()
    if (audioWatchdogTimer === null) audioWatchdogTimer = setInterval(check, 60000)
  }

  function stopAudioWatchdog() {
    if (audioWatchdogTimer !== null) clearInterval(audioWatchdogTimer)
    audioWatchdogTimer = null
  }

  /** Convert the compact Plugin Config form to the policy module's model. */
  function normalizePolicies(configuredPolicies) {
    return Array.isArray(configuredPolicies)
      ? configuredPolicies.map(policy => ({
          ...policy,
          sound: typeof policy.sound === 'string'
            ? { active: true, file: policy.sound, count: 1 }
            : normalizeSoundConfig(policy.sound),
          match: {
            pathPrefix: policy.pathPrefix || undefined,
            source: policy.source || undefined
          }
        }))
      : []
  }

  function normalizeStateOrder(order, legacySortOrder, legacyVisibleStates) {
    const allowed = ['warn', 'alert', 'nominal', 'normal']
    const selected = Array.isArray(order)
      ? order.filter(state => allowed.includes(state))
      : Array.isArray(legacySortOrder)
        ? legacySortOrder.filter(state => allowed.includes(state))
        : Array.isArray(legacyVisibleStates)
          ? legacyVisibleStates.filter(state => allowed.includes(state))
          : []
    return [...new Set(selected)]
  }

  function loadPalette(fileName, fallback) {
    if (!fileName) return { ...fallback }
    try {
      const value = JSON.parse(fs.readFileSync(path.resolve(fileName), 'utf8'))
      return Object.fromEntries(Object.keys(fallback).map(name => [name, typeof value[name] === 'string' ? value[name] : fallback[name]]))
    } catch (error) {
      return { ...fallback }
    }
  }

  function normalizeStateColors(colors) {
    const defaults = { emergency: colorPalette.red, alarm: colorPalette.darkRed, warn: colorPalette.yellow, alert: colorPalette.orange, nominal: colorPalette.green, normal: colorPalette.grey }
    for (const state of Object.keys(defaults)) {
      if (typeof colors?.[state] === 'string') {
        if (colorPalette[colors[state]]) defaults[state] = colorPalette[colors[state]]
        else if (/^#[0-9a-f]{6}$/i.test(colors[state])) defaults[state] = colors[state]
      }
    }
    return defaults
  }

  function normalizeSoundsByState(sounds, fileName) {
    const palette = loadPalette(fileName, Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification'].map(state => [state, path.join(__dirname, 'sounds', `${state}.wav`)])))
    const defaults = Object.fromEntries(Object.entries(palette).map(([state, sound]) => [state, { active: true, file: sound || null, count: 1 }]))
    for (const state of Object.keys(defaults)) {
      const configured = sounds?.[state]
      if (typeof configured === 'string' && configured.trim()) defaults[state].file = configured.trim()
      if (configured && typeof configured === 'object') {
        if (typeof configured.active === 'boolean') defaults[state].active = configured.active
        if (typeof configured.file === 'string' && configured.file.trim()) defaults[state].file = configured.file.trim()
        defaults[state].count = normalizeSoundConfig(configured).count
      }
    }
    return defaults
  }

  function startNotificationAudio(notification, soundConfig) {
    const key = notification.occurrenceId
    const config = soundConfig || {}
    const file = config.file
    if (!file) return
    const count = Number.isInteger(config.count) && config.count >= 0 && config.count <= 99 ? config.count : 1
    const pauseSeconds = resolveSoundPauseSeconds(config)
    const signature = `${file}|${count}|${pauseSeconds}`
    if (audioPlaybackRegistry.current(key) === signature) return
    stopNotificationAudio(key)
    audioCircuitBreaker.adopt(notification)
    audioPlaybackRegistry.begin(key, signature)
    const repeatPlan = new AudioRepeatPlan(count, pauseSeconds)
    const play = () => {
      if (!audioPlaybackRegistry.isCurrent(key, signature)) return
      const permission = audioCircuitBreaker.beginAttempt(notification)
      if (!permission.allowed) {
        const delay = Math.max(0, Number(permission.retryAt || Date.now()) - Date.now())
        scheduleAudioAttempt(key, delay)
        return
      }
      repeatPlan.startAttempt()
      audioPlayer.play(path.resolve(__dirname, file), key, result => {
        if (!audioPlaybackRegistry.isCurrent(key, signature)) return
        if (result?.ok) {
          audioSystemNotification.recordSuccess(notification)
          audioCircuitBreaker.recordSuccess(notification)
          const nextDelayMs = repeatPlan.nextDelayMs()
          if (nextDelayMs !== null) {
            // Do not start a new ALSA process re-entrantly from the previous
            // ChildProcess close event. Let Node finish releasing the process
            // and its device handles before the next exact-count attempt.
            if (nextDelayMs > 0) scheduleAudioAttempt(key, nextDelayMs)
            else setImmediate(play)
          }
          else {
            // Keep the completed finite signature until this occurrence ends
            // or its sound configuration changes. Snapshot/condition refreshes
            // must not replay an unchanged once/repeat sound.
            audioPlaybackRegistry.complete(key, signature)
            audioAttempts.delete(key)
          }
          return
        }
        audioSystemNotification.recordFailure(notification, result)
        const circuit = audioCircuitBreaker.recordFailure(notification, result)
        const delay = circuit.state === 'open'
          ? Math.max(0, Number(circuit.nextProbeAt) - Date.now())
          : Math.min(60000, 1000 * (2 ** Math.min(circuit.failureCount - 1, 6)))
        app.error?.(circuit.state === 'open'
          ? `Notification audio circuit open after ${circuit.failureCount} failures; probe in ${delay}ms for ${key}`
          : `Notification audio retry ${circuit.failureCount} in ${delay}ms for ${key}`)
        scheduleAudioAttempt(key, delay)
      })
    }
    audioAttempts.set(key, play)
    play()
  }

  /** Schedule a single bounded retry/probe for one notification lifecycle. */
  function scheduleAudioAttempt(key, delay) {
    const existing = audioTimers.get(key)
    if (existing) clearTimeout(existing)
    const attempt = audioAttempts.get(key)
    if (!attempt) return
    const timer = setTimeout(() => {
      audioTimers.delete(key)
      attempt()
    }, Math.max(0, delay))
    audioTimers.set(key, timer)
  }

  function stopNotificationAudio(key) {
    const timer = audioTimers.get(key)
    if (timer) clearTimeout(timer)
    audioTimers.delete(key)
    audioAttempts.delete(key)
    audioPlaybackRegistry.end(key)
    audioPlayer.stopKey(key)
  }

  function normalizeVisualRules(rules, colors) {
    const defaults = {
      emergency: { display: 'overlay', color: colors.emergency, flash: true, acknowledgeRequired: true },
      alarm: { display: 'overlay', color: colors.alarm, flash: true, acknowledgeRequired: true },
      warn: { display: 'banner', color: colors.warn, flash: false, acknowledgeRequired: false },
      alert: { display: 'banner', color: colors.alert, flash: false, acknowledgeRequired: false },
      nominal: { display: 'table', color: colors.nominal, flash: false, acknowledgeRequired: false },
      normal: { display: 'table', color: colors.normal, flash: false, acknowledgeRequired: false }
    }
    for (const state of Object.keys(defaults)) {
      const candidate = rules?.[state]
      if (!candidate) continue
      if (['table', 'banner', 'overlay'].includes(candidate.display)) defaults[state].display = candidate.display
      if (typeof candidate.color === 'string') {
        if (colorPalette[candidate.color]) defaults[state].color = colorPalette[candidate.color]
        else if (/^#[0-9a-f]{6}$/i.test(candidate.color)) defaults[state].color = candidate.color
      }
      if (typeof candidate.flash === 'boolean') defaults[state].flash = candidate.flash
      if (typeof candidate.acknowledgeRequired === 'boolean') defaults[state].acknowledgeRequired = candidate.acknowledgeRequired
    }
    return defaults
  }

  function normalizeInfoTimeout(value) {
    return Number.isInteger(value) ? Math.max(0, Math.min(3600, value)) : 0
  }

  function normalizeShortcut(value, fallback) {
    return typeof value === 'string' && value.length <= 1 ? value.toLowerCase() : fallback
  }

  function normalizeHistoryRules(rules) {
    return Array.isArray(rules)
      ? rules.filter(rule => rule && (rule.pathPrefix || rule.source)).map(rule => ({
        pathPrefix: String(rule.pathPrefix || '').toLowerCase(),
        source: String(rule.source || ''),
        history: rule.history !== false
      }))
      : []
  }

  function shouldRecordHistory(notification) {
    const resolvedPolicy = policyResolver.resolve(notification)
    if (typeof resolvedPolicy.history === 'boolean') return resolvedPolicy.history
    const rule = historyRules.find(candidate =>
      (!candidate.pathPrefix || String(notification.path || '').toLowerCase().startsWith(candidate.pathPrefix)) &&
      (!candidate.source || candidate.source === notification.source?.label)
    )
    if (rule) return rule.history
    return false
  }

  function isLocallyEnabledState(state) {
    return state === 'emergency' || state === 'alarm' || activeRules.some(rule => rule.match?.state === state)
  }


  function writeRuleDescriptionFiles(rules, revision) {
    const directory = path.join(app.getDataDirPath?.() || path.join(__dirname, 'data'), 'deployed-rules')
    fs.mkdirSync(directory, { recursive: true })
    const json = JSON.stringify({ schemaVersion: 1, revision, deployedAt: new Date().toISOString(), rules }, null, 2)
    const files = [['deployed-rules.json', json], ['deployed-rules.md', rulesMarkdown(rules, revision)]]
    for (const [name, contents] of files) {
      const target = path.join(directory, name)
      const temporary = `${target}.tmp`
      fs.writeFileSync(temporary, contents)
      fs.renameSync(temporary, target)
    }
  }


  function normalizeClearPath(value) {
    return String(value || '').trim().toLowerCase().replace(/\*$/, '')
  }

  // Rule definitions come from the deployed Node-RED builder flow. Keep only
  // operational settings in the Signal K plugin configuration form.
  for (const field of ['policies', 'stateOrder', 'stateColors', 'colorPaletteFile', 'visualRules', 'soundsByState', 'soundPaletteFile', 'historyRules']) {
    delete plugin.schema.properties[field]
  }
  delete plugin.uiSchema.soundsByState

  return plugin
}
