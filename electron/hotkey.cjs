const { UiohookKey, uIOhook } = require('uiohook-napi')

const KEY_CODES = {
  RightCtrl: UiohookKey.CtrlRight,
  RightAlt: UiohookKey.AltRight,
  F8: UiohookKey.F8,
  F9: UiohookKey.F9,
}

const ESCAPE = UiohookKey.Escape

class Hotkey {
  constructor({ onStart, onStop, onCancel, getKey }) {
    this.onStart = onStart
    this.onStop = onStop
    this.onCancel = onCancel
    this.getKey = getKey
    this.active = false
    this.started = false

    this.handleKeyDown = (event) => {
      if (event.keycode === ESCAPE && this.active) {
        this.active = false
        this.onCancel()
        return
      }
      if (event.keycode !== KEY_CODES[this.getKey()] || this.active) return
      this.active = true
      this.onStart()
    }

    this.handleKeyUp = (event) => {
      if (event.keycode !== KEY_CODES[this.getKey()] || !this.active) return
      this.active = false
      this.onStop()
    }
  }

  start() {
    if (this.started) return
    uIOhook.on('keydown', this.handleKeyDown)
    uIOhook.on('keyup', this.handleKeyUp)
    uIOhook.start()
    this.started = true
  }

  stop() {
    if (!this.started) return
    uIOhook.off('keydown', this.handleKeyDown)
    uIOhook.off('keyup', this.handleKeyUp)
    try {
      uIOhook.stop()
    } catch {
      // The hook may already be stopped during shutdown.
    }
    this.started = false
  }

  release() {
    this.active = false
  }
}

module.exports = { Hotkey, KEY_CODES }
