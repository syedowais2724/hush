import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  engine: 'whisper',
  hotkey: 'RightCtrl',
  language: 'en',
  cleanup: true,
  spokenPunctuation: true,
  autoCapitalize: true,
  insertion: 'paste',
  launchAtLogin: false,
}

export const HOTKEY_LABELS: Record<Settings['hotkey'], string> = {
  RightCtrl: 'Right Ctrl',
  RightAlt: 'Right Alt',
  F8: 'F8',
  F9: 'F9',
}

export const LANGUAGE_LABELS: Record<Settings['language'], string> = {
  auto: 'Detect automatically',
  en: 'English',
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  pl: 'Polish',
}
