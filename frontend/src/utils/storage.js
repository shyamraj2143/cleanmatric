const memoryStorage = new Map()

const canUseLocalStorage = () => {
  try {
    const key = '__metricflow_storage_test__'
    localStorage.setItem(key, key)
    localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

const hasLocalStorage = canUseLocalStorage()

export const storage = {
  getItem(key) {
    try {
      return hasLocalStorage ? localStorage.getItem(key) : memoryStorage.get(key) || null
    } catch {
      return memoryStorage.get(key) || null
    }
  },
  setItem(key, value) {
    memoryStorage.set(key, value)
    try {
      if (hasLocalStorage) localStorage.setItem(key, value)
    } catch {
      // Keep the in-memory value for the current session.
    }
  },
  removeItem(key) {
    memoryStorage.delete(key)
    try {
      if (hasLocalStorage) localStorage.removeItem(key)
    } catch {
      // Nothing else to clear.
    }
  },
}
