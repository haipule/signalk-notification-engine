'use strict'

window.NotificationI18n = (() => {
  const api = '/plugins/signalk-notification-engine'
  const storageKey = 'notification-engine.locale'
  let locale = 'en'
  let localeName = 'English'
  let locales = [{ locale: 'en', name: 'English', builtIn: true }]
  let messages = {}

  function interpolate(template, parameters = {}) {
    return String(template).replace(/\{([a-zA-Z0-9]+)\}/g, (match, key) => Object.prototype.hasOwnProperty.call(parameters, key) ? String(parameters[key]) : match)
  }

  function keyForPlural(key, parameters) {
    if (!Object.prototype.hasOwnProperty.call(parameters, 'count')) return key
    const form = new Intl.PluralRules(locale).select(Number(parameters.count))
    return messages[`${key}.${form}`] ? `${key}.${form}` : messages[`${key}.other`] ? `${key}.other` : key
  }

  function t(key, parameters = {}) {
    const resolvedKey = keyForPlural(key, parameters)
    return interpolate(messages[resolvedKey] || messages[key] || key, parameters)
  }

  function applyDocument() {
    document.documentElement.lang = locale
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n) })
    for (const attribute of ['title', 'aria-label']) {
      const datasetKey = attribute === 'title' ? 'i18nTitle' : 'i18nAriaLabel'
      document.querySelectorAll(`[data-${datasetKey.replace(/[A-Z]/g, character => `-${character.toLowerCase()}`)}]`).forEach(element => {
        element.setAttribute(attribute, t(element.dataset[datasetKey]))
      })
    }
    updateLanguageButton()
  }

  function updateLanguageButton() {
    const button = document.querySelector('#language-button')
    if (!button) return
    button.textContent = locale.toUpperCase()
    button.title = t('language.next', { name: localeName })
    button.setAttribute('aria-label', button.title)
  }

  async function loadCatalog(nextLocale) {
    const response = await fetch(`${api}/translations/${encodeURIComponent(nextLocale)}`)
    if (!response.ok) throw new Error(`Translation request failed (${response.status})`)
    return response.json()
  }

  function preferredLocale() {
    let stored = null
    try { stored = localStorage.getItem(storageKey) } catch {}
    const requested = [stored, ...(navigator.languages || [navigator.language])].filter(Boolean)
    for (const candidate of requested) {
      const normalized = String(candidate).replace('_', '-').toLowerCase()
      const exact = locales.find(item => item.locale.toLowerCase() === normalized)
      if (exact) return exact.locale
      const base = locales.find(item => item.locale.toLowerCase().split('-')[0] === normalized.split('-')[0])
      if (base) return base.locale
    }
    return 'en'
  }

  async function setLocale(nextLocale, { persist = true } = {}) {
    let catalog
    try {
      catalog = await loadCatalog(nextLocale)
    } catch {
      const response = await fetch('translations/en.json')
      catalog = await response.json()
    }
    locale = catalog.locale || 'en'
    localeName = catalog.name || locale
    messages = catalog.messages || {}
    if (persist) {
      try { localStorage.setItem(storageKey, locale) } catch {}
    }
    applyDocument()
    window.dispatchEvent(new CustomEvent('notification-language-changed', { detail: { locale } }))
  }

  async function initialize() {
    try {
      const response = await fetch(`${api}/translations`)
      if (response.ok) {
        const body = await response.json()
        if (Array.isArray(body.locales) && body.locales.length > 0) locales = body.locales
      }
    } catch {}
    await setLocale(preferredLocale(), { persist: false })
    document.querySelector('#language-button')?.addEventListener('click', async () => {
      const index = Math.max(0, locales.findIndex(item => item.locale === locale))
      const next = locales[(index + 1) % locales.length]
      await setLocale(next.locale)
    })
  }

  function dateTime(value) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf()) ? t('time.unknown') : new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(date)
  }

  function date(value) { return new Intl.DateTimeFormat(locale).format(new Date(value)) }
  function time(value, options = {}) { return new Intl.DateTimeFormat(locale, { timeStyle: 'medium', ...options }).format(new Date(value)) }

  return { initialize, setLocale, t, applyDocument, dateTime, date, time, getLocale: () => locale }
})()
