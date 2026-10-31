import { chromium } from 'playwright-core'

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const pages = browser.contexts().flatMap((context) => context.pages())
const page = pages.find((candidate) => candidate.url().includes('index.html'))
if (!page) throw new Error('main window not found')
const result = await page.evaluate(async () => {
  const state = await window.hush.getState()
  const removed = state.history
    .filter((entry) => entry.text.trim() === 'Hush paste test 123')
    .map((entry) => entry.id)
  for (const id of removed) await window.hush.deleteHistory(id)
  const after = await window.hush.getState()
  return { removed, remaining: after.history.map((entry) => entry.text) }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
