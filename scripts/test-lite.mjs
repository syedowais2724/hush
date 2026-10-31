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
if (!browser) throw new Error('Could not connect to lite app')
const pages = browser.contexts().flatMap((context) => context.pages())
console.log('pages:', pages.map((page) => page.url()))
const page = pages.find((candidate) => candidate.url().includes('index.html'))
if (!page) throw new Error('main window not found')

const result = await page.evaluate(async () => {
  const before = await window.hush.getModels()
  const events = []
  const off = window.hush.onModelDownload((event) => {
    events.push(event)
    if (events.length > 500) events.shift()
  })
  const started = performance.now()
  await window.hush.downloadModel('whisper')
  off()
  const after = await window.hush.getModels()
  return {
    before,
    after,
    wallMs: Math.round(performance.now() - started),
    count: events.length,
    last: events.slice(-2),
  }
})
console.log(JSON.stringify(result, null, 2))
await page.evaluate(() => window.hush.quit()).catch(() => {})
await browser.close()
