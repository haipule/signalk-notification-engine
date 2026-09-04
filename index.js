'use strict'

const fs = require('node:fs')
const path = require('node:path')
const NotificationStore = require('./lib/notification-store')
const classify = require('./lib/classifier')
const NotificationActions = require('./lib/actions')
const { PolicyResolver } = require('./lib/policies')
const HistoryRepository = require('./lib/history-repository')
const { loadLifecycleRules, endsLifecycle } = require('./lib/lifecycle-rules')
const { fromDataModel } = require('./lib/notification-snapshot')
const AudioPlayer = require('./lib/audio-player')
const { getNodeRed, readConfiguration, subscribeToDeploy } = require('./lib/node-red-runtime')
const { rulesMarkdown } = require('./lib/flow-rules')
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
  let historyStates = new Set(['emergency', 'alarm'])
  let lifecycleRules = []
  let clearHistoryOnStart = false
  let clearHistoryPath = ''
  let clearHistoryPathOnSave = false
  let clearHistoryOccurrenceId = ''
  let historyRetentionDays = 0
  let testNotificationId = null
  let testNotificationTimer = null
  let testNotificationEnabled = false
  const audioTimers = new Map()
  const audioSignatures = new Map()
  const silencedAudio = new Map()
  const store = new NotificationStore({
    classify: notification => configuredClassifier(notification),
    shouldRecord: notification => shouldRecordHistory(notification),
    lifecycleRules,
    endsLifecycle,
    onEvent: event => {
      historyRepository?.append(event)
    },
    onChange: event => {
      const policy = policyResolver.resolve(event.notification)
      const locallyEnabled = isLocallyEnabledState(event.notification.state)
      const audioEligible = audioReady && locallyEnabled && event.type !== 'action_requested'
      if (event.type === 'cleared') {
        silencedAudio.delete(event.notification.occurrenceId)
        stopNotificationAudio(event.notification.occurrenceId)
      }
      else if (['normal', 'nominal'].includes(event.notification.state)) {
        silencedAudio.delete(event.notification.occurrenceId)
        stopNotificationAudio(event.notification.occurrenceId)
      }
      else if (silencedAudio.get(event.notification.occurrenceId) === event.notification.state) stopNotificationAudio(event.notification.occurrenceId)
      else if (audioEligible && policy.audio !== 'off' && policy.soundConfig?.active !== false && policy.soundConfig?.file) {
        silencedAudio.delete(event.notification.occurrenceId)
        startNotificationAudio(event.notification.occurrenceId, policy.soundConfig)
      }
    }
  })
  const actions = new NotificationActions(app)
  let policyResolver = new PolicyResolver()
  let unsubscribes = []
  let lifecycle = 0
  let snapshotTimer = null
  let audioReady = false
  let nodeRedUnsubscribe = null
  let nodeRedConfigChecksum = null
  let activeRules = []
  const audioPlayer = new AudioPlayer({ onError: error => app.error?.(`Unable to play notification sound: ${error.message}`) })

  function applyRuntimeConfiguration(flowOptions) {
    colorPalette = loadPalette(flowOptions?.colorPaletteFile, visualColorPool)
    soundsByState = normalizeSoundsByState(flowOptions?.soundsByState, flowOptions?.soundPaletteFile)
    audioPlayer.player = String(flowOptions?.audioPlayer || 'aplay')
    audioPlayer.device = String(flowOptions?.audioDevice || 'default')
    policyResolver = new PolicyResolver([...normalizeFlowRules(flowOptions?.activeRules), ...normalizePolicies(flowOptions?.policies)], soundsByState)
    configuredClassifier = classify.withOverrides(normalizeClassificationRules(flowOptions?.classificationRules))
    configuredStateOrder = normalizeStateOrder(flowOptions?.stateOrder, flowOptions?.sortOrder, flowOptions?.visibleStates)
    stateColors = normalizeStateColors(flowOptions?.stateColors)
    visualRules = normalizeVisualRules(flowOptions?.visualRules, stateColors)
    infoAutoCloseSeconds = normalizeInfoTimeout(flowOptions?.infoAutoCloseSeconds)
    shortcutInfo = normalizeShortcut(flowOptions?.shortcutInfo, 'i')
    shortcutHistory = normalizeShortcut(flowOptions?.shortcutHistory, 'h')
    if (shortcutInfo && shortcutInfo === shortcutHistory) shortcutHistory = ''
    historyRules = normalizeHistoryRules(flowOptions?.historyRules)
    historyStates = normalizeHistoryStates(flowOptions?.historyStates)
    clearHistoryOnStart = flowOptions?.clearHistoryOnStart === true
    clearHistoryPath = normalizeClearPath(flowOptions?.clearHistoryPath)
    clearHistoryPathOnSave = flowOptions?.clearHistoryPathOnSave === true
    clearHistoryOccurrenceId = String(flowOptions?.clearHistoryOccurrenceId || '')
    testNotificationEnabled = flowOptions?.testNotif?.enabled === true
    historyRetentionDays = Number.isInteger(flowOptions?.historyRetentionDays) ? Math.max(0, Math.min(3650, flowOptions.historyRetentionDays)) : 0
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
          description: 'First matching policy controls only local presentation and future audio handling.',
          default: [],
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string', title: 'Name', default: '' },
              category: { type: 'string', title: 'Category', default: '', enum: ['', 'ANCHOR', 'NAVIGATION', 'COLLISION', 'WEATHER', 'ELECTRICAL', 'PROPULSION', 'SYSTEM', 'SECURITY', 'OTHER'] },
              pathPrefix: { type: 'string', title: 'Path Prefix', default: '' },
              source: { type: 'string', title: 'Source Label', default: '' },
              priority: { type: 'string', title: 'Display Priority', enum: ['low', 'normal', 'high', 'critical'], default: 'normal' },
              audio: { type: 'string', title: 'Audio Policy', enum: ['inherit', 'on', 'off'], default: 'inherit' },
              sound: { type: 'object', title: 'Specific Sound', additionalProperties: false, properties: {
                active: { type: 'boolean', title: 'Active', default: true },
                file: { type: 'string', title: 'Sound file', default: '' },
                mode: { type: 'string', title: 'Playback', enum: ['once', 'repeat', 'loop'], enumNames: ['Once', 'Repeat', 'Loop'], default: 'once' },
                repeatCount: { type: 'integer', title: 'Repeat count (repeat only)', minimum: 1, maximum: 100, default: 1 }
              } },
              visible: { type: 'boolean', title: 'Show in Alarm Centre', default: true }
            }
          }
        }
        ,
        classificationRules: {
          type: 'array', title: 'Classification Rules',
          description: 'Override automatic categories by notification path prefix.',
          default: [],
          items: {
            type: 'object', additionalProperties: false,
            properties: {
              pathPrefix: { type: 'string', title: 'Notification Path Prefix', default: '' },
              category: { type: 'string', title: 'Category', enum: ['ANCHOR', 'NAVIGATION', 'COLLISION', 'WEATHER', 'ELECTRICAL', 'PROPULSION', 'SYSTEM', 'SECURITY', 'OTHER'], default: 'OTHER' }
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
            active: true, file: path.join(__dirname, 'sounds', `${state === 'warn' ? 'warn' : state}.wav`), mode: 'once', repeatCount: 1
          }])), additionalProperties: false,
          properties: Object.fromEntries(['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification'].map(state => [state, {
            type: 'object', title: state, additionalProperties: false, properties: {
              active: { type: 'boolean', title: 'Active', default: true },
              file: { type: 'string', title: 'Sound file', default: path.join(__dirname, 'sounds', `${state === 'warn' ? 'warn' : state}.wav`) },
              mode: { type: 'string', title: 'Playback', enum: ['once', 'repeat', 'loop'], enumNames: ['Once', 'Repeat', 'Loop'], default: 'once' },
              repeatCount: { type: 'integer', minimum: 1, maximum: 100, title: 'Repeat count (repeat only)', default: 1 }
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
        historyStates: {
          type: 'array', title: 'Notification History For',
          description: 'Choose states recorded in local history. Emergency and alarm are always recorded.',
          default: ['emergency', 'alarm'],
          items: { type: 'string', enum: ['emergency', 'alarm', 'alert', 'warn', 'nominal', 'normal', 'info', 'notification'] }
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
        mode: { 'ui:widget': 'radio', 'ui:options': { inline: true } }
      }]))
    },

    async start(options) {
      stopSubscriptions()
      void stopTestNotification()
      const currentLifecycle = ++lifecycle
      const nodeRed = getNodeRed()
      const nodeRedConfig = await readConfiguration(nodeRed)
      nodeRedConfigChecksum = nodeRedConfig.checksum
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
      nodeRedUnsubscribe = subscribeToDeploy(nodeRed, async () => {
        const next = await readConfiguration(nodeRed)
        if (next.checksum === nodeRedConfigChecksum) return
        nodeRedConfigChecksum = next.checksum
        activeRules = next.rules
        writeRuleDescriptionFiles(activeRules, nodeRedConfigChecksum)
        applyRuntimeConfiguration({ ...options, ...next.config.notificationEngine, activeRules: next.rules })
        app.debug?.(`Notification Engine configuration updated from Node-RED`)
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
      audioSignatures.clear()
      silencedAudio.clear()
      audioPlayer.stop()
      stopSubscriptions()
      stopSnapshotSync()
      await stopTestNotification()
      nodeRedUnsubscribe?.()
      nodeRedUnsubscribe = null
      nodeRedConfigChecksum = null
      await historyRepository?.flush()
      historyRepository = null
      store.clear()
    },

    /**
     * Temporary internal access point for tests and future WebApp routes.
     * Returned records are copies, so callers cannot mutate the store.
     */
    getNotifications() {
      return store.list().map(notification => ({ ...notification, policy: policyResolver.resolve(notification) }))
    },

    getNotificationHistory() {
      return store.history()
    },

    registerWithRouter(router) {
      const readOnly = router.access('readonly')
      readOnly.get('/notifications', async (_request, response) => {
        // Refresh on request as well as on the background interval. This
        // keeps the WebApp useful even if a producer appears after startup.
        await syncSnapshot()
        response.json({ notifications: plugin.getNotifications(), rules: activeRules, ruleChecksum: nodeRedConfigChecksum, stateOrder: configuredStateOrder, stateColors, visualRules, infoAutoCloseSeconds, shortcutInfo, shortcutHistory, updatedAt: new Date().toISOString() })
      })
      readOnly.get('/history', (_request, response) => {
        response.json({ events: store.history() })
      })
      const readWrite = router.access('readwrite')
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
      readWrite.post('/notifications/:id/:action', (request, response) => {
        try {
          const record = store.get(request.params.id)
          if (request.params.action === 'silence') {
            silencedAudio.set(record.occurrenceId, record.state)
            stopNotificationAudio(record.occurrenceId)
          }
          actions.execute(record, request.params.action)
          store.recordOperatorAction(request.params.action, record)
          response.status(202).json({ state: 'ACCEPTED' })
        } catch (error) {
          response.status(409).json({ state: 'REJECTED', message: error.message })
        }
      })
    }
  }

  /** Read the authoritative current notification snapshot when available. */
  async function initialize(currentLifecycle, testNotificationConfiguration) {
    const events = await historyRepository.load()
    if (currentLifecycle !== lifecycle) return
    if (clearHistoryOnStart) {
      await historyRepository.clear()
      store.replaceHistory([])
    } else {
      store.replaceHistory(events)
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
    if (clearHistoryOnStart) {
      await historyRepository.clear()
      store.replaceHistory([])
    }
    subscribeToNotifications()
    audioReady = true
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
      const snapshot = { ...selfNotifications, ...fullModelNotifications, ...apiNotifications, ...managed }
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
    const snapshot = await readSnapshot()
    store.replaceSnapshot(snapshot)
  }

  /** Subscribe through Signal K's supported subscription manager API. */
  function subscribeToNotifications() {
    if (!app.subscriptionmanager?.subscribe) {
      app.error?.('Signal K subscription manager is unavailable; notification updates will not be observed')
      return
    }

    app.subscriptionmanager.subscribe(
      {
        context: '*',
        sourcePolicy: 'all',
        subscribe: [{ path: 'notifications.*' }]
      },
      unsubscribes,
      error => app.error?.(`Notification subscription error: ${error}`),
      delta => {
        logNotificationDelta(delta)
        store.applyDelta(delta)
      }
    )
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
    for (const unsubscribe of unsubscribes) {
      unsubscribe()
    }
    unsubscribes = []
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

  /** Convert the compact Plugin Config form to the policy module's model. */
  function normalizePolicies(configuredPolicies) {
    return Array.isArray(configuredPolicies)
      ? configuredPolicies.map(policy => ({
          ...policy,
          sound: typeof policy.sound === 'string'
            ? { active: true, file: policy.sound, mode: 'once', repeatCount: 1 }
            : policy.sound,
          match: {
            category: policy.category || undefined,
            pathPrefix: policy.pathPrefix || undefined,
            source: policy.source || undefined
          }
        }))
      : []
  }

  function normalizeFlowRules(rules) {
    const ordered = Array.isArray(rules) ? [...rules].sort((left, right) => ruleSpecificity(right) - ruleSpecificity(left)) : []
    return ordered.map(rule => {
      const hasSound = Boolean(rule.actions?.sound || rule.actions?.soundFile)
      return {
      name: rule.id,
      state: rule.match?.state,
      match: { state: rule.match?.state, path: rule.match?.path, category: rule.match?.category },
      audio: hasSound ? 'on' : 'inherit',
      sound: hasSound ? { active: true, file: rule.actions.sound?.file || rule.actions.soundFile, mode: rule.actions.sound?.mode || 'once', repeatCount: rule.actions.sound?.repeatCount || 1 } : null,
      visible: rule.actions?.visibleInTable !== false
      }
    })
  }

  function ruleSpecificity(rule) {
    const match = rule?.match || {}
    if (match.path && !match.path.includes('*')) return 400
    if (match.path) return 300
    if (match.category) return 200
    return 100
  }

  function normalizeClassificationRules(rules) {
    return Array.isArray(rules)
      ? rules.filter(rule => rule && typeof rule.pathPrefix === 'string' && rule.pathPrefix.length > 0)
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
    const defaults = Object.fromEntries(Object.entries(palette).map(([state, sound]) => [state, { active: true, file: sound || null, mode: 'once', repeatCount: 1 }]))
    for (const state of Object.keys(defaults)) {
      const configured = sounds?.[state]
      if (typeof configured === 'string' && configured.trim()) defaults[state].file = configured.trim()
      if (configured && typeof configured === 'object') {
        if (typeof configured.active === 'boolean') defaults[state].active = configured.active
        if (typeof configured.file === 'string' && configured.file.trim()) defaults[state].file = configured.file.trim()
        if (['once', 'repeat', 'loop'].includes(configured.mode)) defaults[state].mode = configured.mode
        if (Number.isInteger(configured.repeatCount)) defaults[state].repeatCount = Math.max(1, Math.min(100, configured.repeatCount))
      }
    }
    return defaults
  }

  function startNotificationAudio(key, soundConfig) {
    const config = soundConfig || {}
    const file = config.file
    if (!file) return
    const mode = ['once', 'repeat', 'loop'].includes(config.mode) ? config.mode : 'once'
    const repeatCount = Math.max(1, Number(config.repeatCount) || 1)
    const signature = `${file}|${mode}|${repeatCount}`
    if (audioSignatures.get(key) === signature) return
    stopNotificationAudio(key)
    audioSignatures.set(key, signature)
    let played = 0
    const play = () => {
      played += 1
      audioPlayer.play(path.resolve(__dirname, file), key, mode !== 'once' ? () => {
        if (audioSignatures.get(key) !== signature) return
        if (mode === 'loop' || played < repeatCount) play()
        else audioSignatures.delete(key)
      } : null)
    }
    play()
    if (mode === 'once' || mode === 'loop') return
  }

  function stopNotificationAudio(key) {
    const timer = audioTimers.get(key)
    if (timer) clearInterval(timer)
    audioTimers.delete(key)
    audioSignatures.delete(key)
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
    const rule = historyRules.find(candidate =>
      (!candidate.pathPrefix || String(notification.path || '').toLowerCase().startsWith(candidate.pathPrefix)) &&
      (!candidate.source || candidate.source === notification.source?.label)
    )
    if (rule) return rule.history
    return historyStates.has(notification.state)
  }

  function isLocallyEnabledState(state) {
    return state === 'emergency' || state === 'alarm' || configuredStateOrder.includes(state)
  }

  function normalizeHistoryStates(states) {
    const selected = new Set(Array.isArray(states) ? states.filter(state => typeof state === 'string') : [])
    selected.add('emergency')
    selected.add('alarm')
    return selected
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

  return plugin
}
