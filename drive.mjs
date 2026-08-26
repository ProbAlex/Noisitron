import { chromium } from 'playwright-core'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let browser
  for (let i = 0; i < 20; i++) {
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222')
      break
    } catch {
      await sleep(500)
    }
  }
  if (!browser) throw new Error('could not connect to CDP')

  const contexts = browser.contexts()
  const pages = contexts.flatMap((c) => c.pages())
  console.log('pages found:', pages.map((p) => p.url()))
  const page = pages.find((p) => !p.url().startsWith('devtools://'))
  if (!page) throw new Error('no app page found')

  await page.waitForSelector('text=Virtual mic ready', { timeout: 10000 }).catch(() => console.log('status badge not "ready" within timeout'))

  console.log('--- initial state ---')
  console.log(await page.evaluate(() => document.body.innerText))

  await page.screenshot({ path: '/tmp/claude-1000/-home-alex-VScodeProjects-Soundboard/4667e823-f520-4c25-a2aa-2c572715d40b/scratchpad/01-initial.png' })

  // Click the seeded sound tile's play button
  const clicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const tileBtn = btns.find((b) => b.textContent?.includes('Test Beep'))
    if (!tileBtn) return 'NOT_FOUND'
    tileBtn.click()
    return 'clicked'
  })
  console.log('play click ->', clicked)

  await sleep(300)
  await page.screenshot({ path: '/tmp/claude-1000/-home-alex-VScodeProjects-Soundboard/4667e823-f520-4c25-a2aa-2c572715d40b/scratchpad/02-playing.png' })

  console.log('--- state while (hopefully) playing ---')
  console.log(await page.evaluate(() => document.body.innerText))

  // open settings
  const settingsClicked = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find((el) => el.textContent?.includes('Settings'))
    if (!b) return 'NOT_FOUND'
    b.click()
    return 'clicked'
  })
  console.log('settings click ->', settingsClicked)
  await sleep(300)
  await page.screenshot({ path: '/tmp/claude-1000/-home-alex-VScodeProjects-Soundboard/4667e823-f520-4c25-a2aa-2c572715d40b/scratchpad/03-settings.png' })

  await browser.close()
}

main().catch((e) => {
  console.error('DRIVER ERROR', e)
  process.exit(1)
})
