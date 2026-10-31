const koffi = require('koffi')

const user32 = koffi.load('user32.dll')
const GetForegroundWindow = user32.func('uintptr_t GetForegroundWindow()')
const SetForegroundWindow = user32.func('bool SetForegroundWindow(uintptr_t hWnd)')
const keybd_event = user32.func('void keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)')

const VK_CONTROL = 0x11
const VK_RETURN = 0x0d
const VK_TAB = 0x09
const KEYEVENTF_KEYUP = 0x0002
const KEYEVENTF_UNICODE = 0x0004

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

function foreground() {
  try {
    return Number(GetForegroundWindow())
  } catch {
    return 0
  }
}

function focus(handle) {
  if (!handle) return false
  try {
    return Boolean(SetForegroundWindow(handle))
  } catch {
    return false
  }
}

function paste() {
  keybd_event(VK_CONTROL, 0, 0, 0)
  sleepSync(8)
  keybd_event(0x56, 0, 0, 0)
  sleepSync(8)
  keybd_event(0x56, 0, KEYEVENTF_KEYUP, 0)
  sleepSync(8)
  keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
}

function typeText(text) {
  for (const character of text) {
    if (character === '\n') {
      keybd_event(VK_RETURN, 0, 0, 0)
      keybd_event(VK_RETURN, 0, KEYEVENTF_KEYUP, 0)
      continue
    }
    if (character === '\t') {
      keybd_event(VK_TAB, 0, 0, 0)
      keybd_event(VK_TAB, 0, KEYEVENTF_KEYUP, 0)
      continue
    }
    const units = []
    for (let index = 0; index < character.length; index++) {
      units.push(character.charCodeAt(index))
    }
    for (const unit of units) {
      keybd_event(0, unit, KEYEVENTF_UNICODE, 0)
      keybd_event(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP, 0)
    }
  }
}

module.exports = { foreground, focus, paste, typeText }
