import { chromium } from 'playwright-core'

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
const pages = browser.contexts().flatMap((context) => context.pages())
console.log('pages:', pages.map((page) => page.url()))
const overlay = pages.find((page) => page.url().includes('overlay.html'))
if (!overlay) throw new Error('overlay page not found')
const result = await overlay.evaluate(async () => {
  return await window.hush.reportFinal({
    text: 'Hush paste test 123',
    raw: 'Hush paste test 123',
    durationMs: 1200,
    language: 'en',
  })
})
console.log(result)
await browser.close()
