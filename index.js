'use strict'

const fs = require('node:fs')
const path = require('node:path')
const NotificationStore = require('./lib/notification-store')
const classify = require('./lib/classifier')
const NotificationActions = require('./lib/actions')
const { PolicyResolver } = require('./lib/policies')
const HistoryService = require('./lib/history-service')
const { loadLifecycleRules, endsLifecycle } = require('./lib/lifecycle-rules')
const SnapshotService = require('./lib/snapshot-service')
const PluginRuntime = require('./lib/plugin-runtime')
const AudioPlayer = require('./lib/audio-player')
const AudioController = require('./lib/audio-controller')
const { AudioCircuitBreaker } = require('./lib/audio-circuit-breaker')
const AudioCircuitRepository = require('./lib/audio-circuit-repository')
const { AudioSystemNotification, AUDIO_SYSTEM_PATH } = require('./lib/audio-system-notification')
const AudioSystemRepository = require('./lib/audio-system-repository')
const { AudioSelfTest, AUDIO_SELF_TEST_ORIGIN_PATH } = require('./lib/audio-self-test')
const requestActor = require('./lib/request-actor')
const Diagnostics = require('./lib/diagnostics')
const { inspectInputSources, normalizeInputSources } = require('./lib/input-source-diagnostics')
const { RuntimeTestNotifications } = require('./lib/runtime-test-notifications')
const { TranslationCatalog, normalizeLocale } = require('./lib/translation-catalog')
const { getNodeRed, readConfiguration, subscribeToDeploy } = require('./lib/node-red-runtime')
const { normalizeFlowRules, rulesMarkdown } = require('./lib/flow-rules')
const { ConfigurationService, normalizeAlarmTestInterval, normalizeHistoryRules, normalizeInfoTimeout, normalizeShortcut } = require('./lib/configuration-service')
const registerHttpRoutes = require('./lib/http-routes')
const visualColorPool = require('./lib/visual-colors')
const visualColorKeys = Object.keys(visualColorPool)
const visualColorNames = ['🔴 Red', '🔴 Dark Red', '🟡 Yellow', '🟠 Orange', '🟢 Green', '⚪ Grey', '🔵 Blue', '🟣 Purple']
const defaultColorPaletteFile = path.join(__dirname, 'examples', 'notification-colors.json')
const defaultSoundPaletteFile = path.join(__dirname, 'examples', 'notification-sounds.json')

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
  const translationCatalog = new TranslationCatalog({
    builtInDirectory: path.join(__dirname, 'public', 'translations'),
    customDirectory: path.join(app.getDataDirPath?.() || path.join(__dirname, 'data'), 'translations')
  })
  let audioCircuitRepository = null
  let audioSystemRepository = null
  let configuredClassifier = classify
  let configuredStateOrder = ['warn', 'alert', 'nominal', 'normal']
  let stateColors = { emergency: visualColorPool.red, alarm: visualColorPool.darkRed, warn: visualColorPool.yellow, alert: visualColorPool.orange, nominal: visualColorPool.green, normal: visualColorPool.grey }
  const configurationService = new ConfigurationService({ baseDirectory: __dirname, visualColorPool })
  let visualRules = {}
  let soundsByState = {}
  let infoAutoCloseSeconds = 0
  let shortcutInfo = 'i'
  let shortcutHistory = 'h'
  let lifecycleRules = []
  let criticalInputs = []
  let testNotificationId = null
  let testNotificationTimer = null
  let testNotificationEnabled = false
  let testTonePath = path.join(__dirname, 'sounds', 'test.wav')
  let audioTestIntervalDays = 7
  const diagnostics = new Diagnostics()
  let policyResolver = new PolicyResolver([], {}, readSignalKValue)
  let historyService = null
  let audioController = null
  const store = new NotificationStore({
    classify: notification => configuredClassifier(notification),
    shouldRecord: notification => historyService?.shouldRecord(notification) === true,
    lifecycleRules,
    endsLifecycle,
    onEvent: event => {
      historyService?.append(event)
    },
    onChange: event => audioController?.apply(event)
  })
  historyService = new HistoryService({
    // Signal K may not expose the plugin data directory until start().
    directory: () => app.getDataDirPath?.(),
    store,
    resolvePolicy: notification => policyResolver.resolve(notification),
    onError: message => app.error?.(message)
  })
  const snapshotService = new SnapshotService({
    app,
    store,
    diagnostics,
    includeTestNotifications: () => testNotificationEnabled
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
  const actions = new NotificationActions(app)
  const runtimeTests = new RuntimeTestNotifications(app)
  let activeRules = []
  const conditionValues = new Map()
  let conditionUnsubscribes = []
  const audioPlayer = new AudioPlayer({
    onError: error => app.error?.(`Unable to play notification sound: ${error.message}`),
    onResult: () => {}
  })
  audioController = new AudioController({
    player: audioPlayer,
    circuitBreaker: audioCircuitBreaker,
    systemNotification: audioSystemNotification,
    resolvePolicy: notification => policyResolver.resolve(notification),
    isEnabledState: state => isLocallyEnabledState(state),
    baseDirectory: __dirname,
    logError: message => app.error?.(message)
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
  const runtime = new PluginRuntime({
    getNodeRed,
    readConfiguration,
    subscribeToDeploy,
    applyConfiguration: applyRuntimeConfiguration,
    writeRules: writeRuleDescriptionFiles,
    suspend: suspendNotificationProcessing,
    resume: resumeNotificationProcessing,
    debug: message => app.debug?.(message),
    error: message => app.error?.(message)
  })

  function readSignalKValue(pathName) {
    const cached = conditionValues.get(pathName)
    if (conditionValues.has(pathName)) return cached
    const direct = app.getSelfPath?.(pathName)
    if (direct !== undefined) return unwrapSignalKValue(direct)
    const full = app.getPath?.(`vessels.self.${pathName}`)
    return unwrapSignalKValue(full)
  }

  /** Return one unmodified local Signal K leaf for read-only diagnostics. */
  function readSignalKLeaf(pathName) {
    const direct = app.getSelfPath?.(pathName)
    if (direct !== undefined) return direct
    return app.getPath?.(`vessels.self.${pathName}`)
  }

  function unwrapSignalKValue(value) {
    return value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value
  }

  function applyRuntimeConfiguration(flowOptions) {
    activeRules = flowOptions?.activeRules || []
    configurationService.loadColorPalette(flowOptions?.colorPaletteFile)
    soundsByState = configurationService.normalizeSoundsByState(flowOptions?.soundsByState, flowOptions?.soundPaletteFile)
    audioController.configure(flowOptions?.audioPlayer, flowOptions?.audioDevice)
    policyResolver = new PolicyResolver([...normalizeFlowRules(flowOptions?.activeRules), ...configurationService.normalizePolicies(flowOptions?.policies)], soundsByState, readSignalKValue)
    configuredClassifier = classify
    configuredStateOrder = configurationService.normalizeStateOrder(flowOptions?.stateOrder, flowOptions?.sortOrder, flowOptions?.visibleStates)
    stateColors = configurationService.normalizeStateColors(flowOptions?.stateColors)
    visualRules = configurationService.normalizeVisualRules(flowOptions?.visualRules, stateColors)
    infoAutoCloseSeconds = normalizeInfoTimeout(flowOptions?.infoAutoCloseSeconds)
    shortcutInfo = normalizeShortcut(flowOptions?.shortcutInfo, 'i')
    shortcutHistory = normalizeShortcut(flowOptions?.shortcutHistory, 'h')
    if (shortcutInfo && shortcutInfo === shortcutHistory) shortcutHistory = ''
    historyService.setRules(normalizeHistoryRules(flowOptions?.historyRules))
    testNotificationEnabled = flowOptions?.testNotif?.enabled === true
    testTonePath = path.resolve(String(flowOptions?.testTonePath || path.join(__dirname, 'sounds', 'test.wav')))
    audioTestIntervalDays = normalizeAlarmTestInterval(flowOptions?.alarmSoundTest?.intervalDays)
    criticalInputs = normalizeInputSources(flowOptions?.criticalInputs || [{
      name: 'Android GPS', path: 'navigation.position', source: 'android_udp.gps', staleAfterSeconds: 15
    }])
    subscribeToConditions()
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
        alarmSoundTest: {
          type: 'object', title: 'Alarm Sound Test',
          description: 'Scheduled audible safety check in the Alarm Centre with explicit operator feedback.',
          default: { intervalDays: 7 }, additionalProperties: false,
          properties: {
            intervalDays: { type: 'integer', title: 'Test interval (days)', description: 'Days between confirmed alarm sound tests. Set to 0 to disable the test in the Alarm Centre.', minimum: 0, maximum: 30, default: 7 }
          }
        }
        ,
        playTestTone: { type: 'boolean', title: 'Sound Test', description: 'Play the configured sound once after saving to check the audio connection. This does not complete the scheduled Alarm Sound Test.', default: false }
        ,
        testTonePath: { type: 'string', title: 'Sound Test File', description: 'WAV file used by Sound Test and Alarm Sound Test.', default: path.join(__dirname, 'sounds', 'test.wav') }
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
        criticalInputs: {
          type: 'array', title: 'Critical Input Diagnostics',
          description: 'Read-only freshness checks. These do not create notifications or change alarm processing.',
          default: [{ name: 'Android GPS', path: 'navigation.position', source: 'android_udp.gps', staleAfterSeconds: 15 }],
          items: {
            type: 'object', additionalProperties: false, required: ['name', 'path', 'source', 'staleAfterSeconds'],
            properties: {
              name: { type: 'string', title: 'Display name', minLength: 1 },
              path: { type: 'string', title: 'Signal K path', minLength: 1 },
              source: { type: 'string', title: 'Expected source label', minLength: 1 },
              staleAfterSeconds: { type: 'integer', title: 'Stale after (seconds)', minimum: 1, maximum: 3600, default: 15 }
            }
          }
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
      const { token, flowOptions } = await runtime.start(options)
      applyRuntimeConfiguration(flowOptions)
      lifecycleRules = loadLifecycleRules(app.getDataDirPath?.(), message => app.error?.(message))
      store.lifecycleRules = lifecycleRules
      testNotificationEnabled = flowOptions?.testNotif?.enabled === true
      historyService.configure({
        ...flowOptions,
        historyRules: normalizeHistoryRules(flowOptions?.historyRules),
        testNotificationEnabled
      })
      audioCircuitRepository = new AudioCircuitRepository(app.getDataDirPath?.(), {
        onError: message => app.error?.(message)
      })
      audioSystemRepository = new AudioSystemRepository(app.getDataDirPath?.(), {
        onError: message => app.error?.(message)
      })
      runtime.subscribe()
      void initialize(token, flowOptions?.testNotif)
      if (options?.playTestTone === true && typeof app.savePluginOptions === 'function') {
        app.savePluginOptions({ ...options, playTestTone: false }, error => {
          if (error) app.error?.(`Unable to reset audio test configuration: ${error.message}`)
        })
      }
      if (options?.playTestTone === true) {
        void playTestTone(token, options?.testTonePath)
      }
      if (options?.testNotif?.enabled === true && typeof app.savePluginOptions === 'function') {
        app.savePluginOptions({ ...options, testNotif: { ...options.testNotif, enabled: false } }, error => {
          if (error) app.error?.(`Unable to reset TestNotif configuration: ${error.message}`)
        })
      }
    },

    async stop() {
      runtime.stop()
      audioController.shutdown()
      audioSelfTest.stop()
      stopSubscriptions()
      snapshotService.stopPolling()
      await stopTestNotification()
      await runtimeTests.clearAll()
      await audioCircuitRepository?.flush()
      audioCircuitRepository = null
      await audioSystemRepository?.flush()
      audioSystemRepository = null
      await historyService.stop()
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
      registerHttpRoutes(router, createHttpApi())
    }
  }

  /** Bind transport-neutral domain operations to the isolated HTTP adapter. */
  function createHttpApi() {
    const configurationStatus = () => runtime.status()
    return {
      async notifications() {
        // Polling is also the compatibility fallback when this Signal K build
        // does not emit an embedded Node-RED runtime-deploy event.
        await runtime.refresh()
        if (!runtime.configurationError) await snapshotService.sync()
        return { notifications: plugin.getNotifications(), rules: activeRules, ruleChecksum: runtime.checksum, configurationStatus: configurationStatus(), stateOrder: configuredStateOrder, stateColors, visualRules, infoAutoCloseSeconds, shortcutInfo, shortcutHistory, audioTest: { ...audioSelfTest.toJSON(), intervalDays: audioTestIntervalDays, enabled: audioTestIntervalDays > 0 }, updatedAt: new Date().toISOString() }
      },
      rules() {
        const file = path.join(app.getDataDirPath?.() || path.join(__dirname, 'data'), 'deployed-rules', 'deployed-rules.md')
        return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
      },
      history: () => store.history(),
      translations: () => ({ locales: translationCatalog.list(), fallbackLocale: 'en', errors: translationCatalog.errors }),
      translation(locale) {
        return { ...translationCatalog.get(normalizeLocale(locale)), errors: translationCatalog.errors }
      },
      diagnostics() {
        const locales = translationCatalog.list()
        return diagnostics.toJSON({
          nodeRed: { revision: runtime.checksum, configurationStatus: configurationStatus(), runtimeDeployEventsAvailable: runtime.eventsAvailable() },
          criticalInputs: inspectInputSources(criticalInputs, readSignalKLeaf),
          audio: {
            ...audioController.diagnostics(),
            circuitBreaker: { ...audioCircuitBreaker.toJSON(), persistence: audioCircuitRepository?.status() || { available: false, lastWriteAt: null, lastError: null } },
            systemNotification: { ...audioSystemNotification.toJSON(), persistence: audioSystemRepository?.status() || { available: false, lastWriteAt: null, lastError: null } },
            selfTest: audioSelfTest.toJSON()
          },
          history: historyService.status(),
          localization: { locales, fallbackLocale: 'en', errors: translationCatalog.errors }
        })
      },
      configurationError: () => runtime.configurationError,
      processingUnavailable: () => runtime.configurationError
        ? `Notification processing is disabled: ${runtime.configurationError.message}`
        : !audioController.ready ? 'Notification processing is not ready' : null,
      audioUnavailable: () => runtime.configurationError
        ? `Notification processing is disabled: ${runtime.configurationError.message}`
        : !audioController.ready ? 'Audio is not ready' : null,
      runtimeTests,
      audioTest: {
        enabled: () => audioTestIntervalDays > 0,
        start: request => audioSelfTest.start({ actor: requestActor(request), device: audioPlayer.device, file: testTonePath }),
        notHeard: request => audioSelfTest.reportNotHeard(requestActor(request)),
        heard: request => audioSelfTest.reportHeard(requestActor(request))
      },
      clearHistory: query => historyService.clear(query),
      async actionAll(action) {
        const records = plugin.getNotifications()
        const silencedRecords = action === 'silence' ? records.filter(record => actions.allowed(record, 'silence')) : []
        for (const record of silencedRecords) {
          audioController.silence(record)
        }
        try {
          const affected = await actions.executeAll(records, action)
          for (const record of affected) store.recordOperatorAction(action, record)
          return affected.length
        } catch (error) {
          for (const record of silencedRecords) audioController.rollbackSilence(record)
          throw error
        }
      },
      async action(id, action) {
        const record = store.get(id)
        let silenced = false
        if (action === 'silence') {
          silenced = true
          audioController.silence(record)
        }
        try {
          await actions.execute(record, action)
          store.recordOperatorAction(action, record)
        } catch (error) {
          if (silenced) audioController.rollbackSilence(record)
          throw error
        }
      }
    }
  }

  /** Read the authoritative current notification snapshot when available. */
  async function initialize(currentLifecycle, testNotificationConfiguration) {
    const [historyState, circuitSnapshot, audioSystemSnapshot] = await Promise.all([
      historyService.initialize(),
      audioCircuitRepository.load(),
      audioSystemRepository.load()
    ])
    audioCircuitBreaker.restore(circuitSnapshot)
    audioSystemNotification.restore(audioSystemSnapshot)
    if (!runtime.isCurrent(currentLifecycle)) return
    await runtimeTests.clearStale()
    audioSelfTest.restore(historyState.lastAudioTest)
    await snapshotService.sync()
    audioCircuitBreaker.reconcileActive(store.list())
    if (runtime.configurationError) return
    await historyService.clearAfterSnapshot()
    snapshotService.subscribe()
    audioSystemNotification.synchronize()
    audioController.enable(store.list())
    void startTestNotification(testNotificationConfiguration)
    snapshotService.startPolling()
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
    while (runtime.isCurrent(currentLifecycle) && !audioController.ready) await new Promise(resolve => setTimeout(resolve, 100))
    if (runtime.isCurrent(currentLifecycle)) audioPlayer.play(path.resolve(String(configuredPath || path.join(__dirname, 'sounds', 'test.wav'))))
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
    for (const notification of store.list()) audioController.apply({ type: 'condition_updated', notification })
  }

  function stopSubscriptions() {
    stopConditionSubscriptions()
    snapshotService.stopSubscription()
  }

  /** Stop all rule-dependent processing while retaining the last observed view. */
  function suspendNotificationProcessing() {
    audioController.suspend()
    stopSubscriptions()
    snapshotService.stopPolling()
  }

  /** Rebuild the authoritative view after a subsequent valid Node-RED deploy. */
  async function resumeNotificationProcessing() {
    stopSubscriptions()
    snapshotService.stopPolling()
    await snapshotService.sync()
    snapshotService.subscribe()
    audioController.enable(store.list(), 'configuration_recovered')
    snapshotService.startPolling()
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


  // Rule definitions come from the deployed Node-RED builder flow. Keep only
  // operational settings in the Signal K plugin configuration form.
  for (const field of ['policies', 'stateOrder', 'stateColors', 'colorPaletteFile', 'visualRules', 'soundsByState', 'soundPaletteFile', 'historyRules']) {
    delete plugin.schema.properties[field]
  }
  delete plugin.uiSchema.soundsByState

  return plugin
}
