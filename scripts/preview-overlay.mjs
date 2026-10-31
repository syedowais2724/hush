import { chromium } from 'playwright-core'

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await chromium.launch({ executablePath: edge, headless: true })
const page = await browser.newPage({
  viewport: { width: 460, height: 110 },
  deviceScaleFactor: 2,
})
await page.goto('http://127.0.0.1:5173/overlay.html?demo=1')
await page.addStyleTag({
  content: 'html,body { background: #2b2a26; }',
})
await page.waitForTimeout(900)
await page.screenshot({ path: 'shots/overlay-compact-listening.png' })
await page.waitForTimeout(3800)
await page.screenshot({ path: 'shots/overlay-compact-done.png' })
await browser.close()
console.log('overlay previews written')
