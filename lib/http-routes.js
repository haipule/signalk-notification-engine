'use strict'

/**
 * Register the WebApp API at Signal K's readonly/readwrite boundaries.
 * Domain dependencies are injected so HTTP transport cannot become the owner
 * of notification state, policy, audio, or persistence.
 */
function registerHttpRoutes(router, api) {
  const readOnly = router.access('readonly')
  readOnly.get('/notifications', async (_request, response) => response.json(await api.notifications()))
  readOnly.get('/rules', (_request, response) => {
    const rules = api.rules()
    if (rules === null) return response.status(404).type('text/plain').send('No deployed rules documentation available.')
    response.type('text/plain').send(rules)
  })
  readOnly.get('/history', (_request, response) => response.json({ events: api.history() }))
  readOnly.get('/translations', (_request, response) => response.json(api.translations()))
  readOnly.get('/translations/:locale', (request, response) => response.json(api.translation(request.params.locale)))
  readOnly.get('/diagnostics', (_request, response) => response.json(api.diagnostics()))

  const readWrite = router.access('readwrite')
  readWrite.get('/runtime-tests', (_request, response) => response.json({ tests: api.runtimeTests.list() }))
  readWrite.post('/runtime-tests/:slot', (request, response) => {
    const unavailable = api.processingUnavailable()
    if (unavailable) return response.status(503).json({ state: 'REJECTED', message: unavailable })
    try {
      response.status(201).json(api.runtimeTests.raise(request.params.slot, request.body || {}))
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.patch('/runtime-tests/:slot', (request, response) => {
    const configurationError = api.configurationError()
    if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
    try {
      response.json(api.runtimeTests.update(request.params.slot, request.body || {}))
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.delete('/runtime-tests/:slot', async (request, response) => {
    try {
      const cleared = await api.runtimeTests.clear(request.params.slot)
      response.status(cleared ? 204 : 404).end()
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.post('/audio-test/start', (request, response) => {
    const unavailable = api.audioUnavailable()
    if (unavailable) return response.status(503).json({ state: 'REJECTED', message: unavailable })
    try {
      response.status(202).json(api.audioTest.start(request))
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.post('/audio-test/not-heard', (request, response) => {
    try {
      response.status(202).json(api.audioTest.notHeard(request))
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.post('/audio-test/heard', (request, response) => {
    try {
      response.status(202).json(api.audioTest.heard(request))
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.delete('/history', async (request, response) => {
    const available = await api.clearHistory(request.query || {})
    if (!available) return response.status(503).json({ state: 'REJECTED', message: 'History is not available' })
    response.status(204).end()
  })
  // Keep the literal action-all route above the parameterized id route.
  readWrite.post('/notifications/action-all/:action', async (request, response) => {
    const configurationError = api.configurationError()
    if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
    try {
      const count = await api.actionAll(request.params.action)
      response.status(202).json({ state: 'ACCEPTED', count })
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
  readWrite.post('/notifications/:id/:action', async (request, response) => {
    const configurationError = api.configurationError()
    if (configurationError) return response.status(503).json({ state: 'REJECTED', message: `Notification processing is disabled: ${configurationError.message}` })
    try {
      await api.action(request.params.id, request.params.action)
      response.status(202).json({ state: 'ACCEPTED' })
    } catch (error) {
      response.status(409).json({ state: 'REJECTED', message: error.message })
    }
  })
}

module.exports = registerHttpRoutes
