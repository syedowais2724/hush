import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const base = 'http://127.0.0.1:5173'
await mkdir('shots', { recursive: true })

const browser = await chromium.launch({ executablePath: edge, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(`${base}/index.html`)
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/flow-1440.png' })

await page.getByRole('button', { name: 'History' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/history-1440.png' })

await page.getByRole('button', { name: 'Dictionary' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/dictionary-1440.png' })

await page.getByRole('button', { name: 'Snippets' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/snippets-1440.png' })

await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/settings-1440.png' })

const overlay = await browser.newPage({ viewport: { width: 820, height: 270 }, deviceScaleFactor: 1 })
await overlay.goto(`${base}/overlay.html?demo=1`)
await overlay.addStyleTag({ content: 'html,body { background: #ded9cc; }' })
await overlay.waitForTimeout(5200)
await overlay.screenshot({ path: 'shots/overlay-listening.png' })
await overlay.waitForTimeout(1500)
await overlay.screenshot({ path: 'shots/overlay-thinking.png' })

await browser.close()
console.log('shots written')
