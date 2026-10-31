import { mockApi } from './mock'
import type { HushBridge } from './types'

export const isDesktop = typeof window !== 'undefined' && Boolean(window.hush)
export const api: HushBridge = (typeof window !== 'undefined' && window.hush) || mockApi
