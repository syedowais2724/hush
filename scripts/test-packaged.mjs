import { chromium } from 'playwright-core'

let browser
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
    break
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}
if (!browser) throw new Error('Could not connect to packaged app')
const pages = browser.contexts().flatMap((context) => context.pages())
console.log('pages:', pages.map((page) => page.url()))
const page = pages.find((candidate) => candidate.url().includes('index.html'))
if (!page) throw new Error('main window not found')

const result = await page.evaluate(async () => {
  const models = await window.hush.getModels()
  const samples = new Float32Array(16000)
  for (let index = 0; index < samples.length; index++) {
    samples[index] = Math.sin((2 * Math.PI * 220 * index) / 16000) * 0.08
  }
  const started = performance.now()
  let transcription = null
  let error = null
  try {
    transcription = await window.hush.transcribe(samples, {
      language: 'en',
      keywords: [],
      durationInSeconds: 1,
    })
  } catch (cause) {
    error = String(cause)
  }
  return {
    url: location.href,
    title: document.title,
    models,
    wallMs: Math.round(performance.now() - started),
    transcription,
    error,
  }
})
console.log(JSON.stringify(result, null, 2))
await page.evaluate(() => window.hush.quit()).catch(() => {})
await browser.close()
