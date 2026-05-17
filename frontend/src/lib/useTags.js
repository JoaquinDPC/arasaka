import { useState, useEffect } from 'react'
import { api } from '../api/client'

let cache = null         // { recognized: string[], usedTags: string[], personal: string[], personalEntries: {tag,icon?}[] }
let fetchPromise = null

// Mirrors backend toTagFormat: split camelCase with "-", first letter uppercase, rest lowercase.
// e.g. "supermercado" → "Supermercado", "comidaMascota" → "Comida-mascota"
function toTagFormat(s) {
  if (!s) return s
  const split = s.replace(/([a-z])([A-Z])/g, '$1-$2')
  const words = split.split(/[\s\-_]+/).filter(Boolean)
  if (!words.length) return s
  const joined = words.join('-').toLowerCase()
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

// Clears the module-level cache so the next useTags mount re-fetches from the API.
// Call this after saving budgets to ensure new categories appear in TagPicker.
export function clearTagsCache() {
  cache = null
  fetchPromise = null
}

// Returns { recognized, usedTags, personal, personalEntries, loaded }.
// recognized      = budget categories (from /api/tags), normalized to display format.
// usedTags        = top 15 tags by frequency for the current user (from /api/tags/used).
// personal        = user's curated personal tag names as string[] (derived from personalEntries).
// personalEntries = user's curated personal tags with optional icon overrides.
// loaded          becomes true once the fetch completes, whether successful or not.
export function useTags() {
  const [state, setState] = useState(cache ?? { recognized: [], usedTags: [], personal: [], personalEntries: [] })
  const [loaded, setLoaded] = useState(cache !== null)

  useEffect(() => {
    if (cache !== null) {
      setState(cache)
      setLoaded(true)
      return
    }
    if (!fetchPromise) {
      fetchPromise = Promise.all([api.tags(), api.usedTags(15), api.personalTags()])
        .then(([recognized, usedTags, personal]) => {
          // personal is UserTagEntry[] { tag, icon?, color? } — handle both old string[] and new shape
          const entries = Array.isArray(personal)
            ? personal.map(p => typeof p === 'string' ? { tag: toTagFormat(p) } : { tag: toTagFormat(p.tag), icon: p.icon ?? null, color: p.color ?? null })
            : []
          cache = {
            recognized:      Array.isArray(recognized) ? recognized.map(toTagFormat) : [],
            usedTags:        Array.isArray(usedTags)   ? usedTags.map(toTagFormat)   : [],
            personal:        entries.map(e => e.tag),
            personalEntries: entries,
          }
        })
        .catch(() => { cache = { recognized: [], usedTags: [], personal: [], personalEntries: [] } })
    }
    fetchPromise.then(() => {
      setState(cache)
      setLoaded(true)
    })
  }, [])

  return { recognized: state.recognized, usedTags: state.usedTags, personal: state.personal, personalEntries: state.personalEntries, loaded }
}
