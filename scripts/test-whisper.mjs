import { chromium } from 'playwright-core'

const endpoint = 'http://127.0.0.1:9222'
let browser
for (let attempt = 0; attempt < 15; attempt++) {
  try {
    browser = await chromium.connectOverCDP(endpoint)
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
if (!browser) throw new Error('Could not connect to Electron')

const pages = browser.contexts().flatMap((context) => context.pages())
console.log('pages:', pages.map((page) => page.url()))
const page = pages.find((candidate) => candidate.url().includes('index.html'))
if (!page) throw new Error('main window not found')

const result = await page.evaluate(async () => {
  const response = await fetch('/test-16k.wav')
  const bytes = await response.arrayBuffer()
  const context = new AudioContext({ sampleRate: 16000 })
  const audio = await context.decodeAudioData(bytes)
  const samples = audio.getChannelData(0).slice()
  const started = performance.now()
  const transcription = await window.hush.transcribe(samples, {
    language: 'en',
    keywords: ['Hush', 'Cactus Compute'],
    durationInSeconds: audio.duration,
  })
  return {
    bridge: typeof window.hush,
    duration: audio.duration,
    wallMs: Math.round(performance.now() - started),
    transcription,
  }
})

console.log(JSON.stringify(result, null, 2))
await browser.close()
