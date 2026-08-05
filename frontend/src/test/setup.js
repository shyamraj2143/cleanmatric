import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { Blob as NodeBlob } from 'node:buffer'
import { afterEach } from 'vitest'

afterEach(() => cleanup())

class ResizeObserverMock {
  constructor(callback) { this.callback = callback }
  observe(target) { this.callback([{ target, contentRect: { width: 800, height: 300 } }]) }
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock
// Node's fetch Response expects the Node Blob implementation in CI. jsdom's Blob
// has a different stream contract, so keep the test environment internally consistent.
globalThis.Blob = NodeBlob
globalThis.URL.createObjectURL = globalThis.URL.createObjectURL || (() => 'blob:test')
globalThis.URL.revokeObjectURL = globalThis.URL.revokeObjectURL || (() => {})
