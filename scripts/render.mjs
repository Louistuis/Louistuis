// Renders the GitHub profile images from the live lou15.com page, so the profile and the site
// stay one design: assets/header.png (the intro), assets/<slug>.png (one print per project),
// assets/footer.png (the footer). Headless; run through the shared Chromium queue:
//   lockf -t 900 /tmp/ls-chromium.lock nice -n 15 node scripts/render.mjs
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs"
import path from "node:path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const out = (n) => path.join(root, "assets", n + ".png")

// Each shot is its own cream tile with rounded corners on a transparent page, so it sits well
// on GitHub's light and dark themes alike.
const TILE = `
  html, body { background: transparent !important; }
  .top, .rule, .skip { display: none !important; }
  .js [data-reveal], .card { opacity: 1 !important; transform: none !important; transition: none !important; }
  .card-go { display: none !important; }
  [data-shoot] { background: #f1ece4 !important; border-radius: 28px !important; }
  .intro[data-shoot] { padding: 64px 40px 56px !important; width: 1000px !important; }
  .card[data-shoot] { padding: 34px 26px 28px !important; margin-top: 0 !important; box-sizing: border-box !important; height: 492px !important; }
  .ssf[data-shoot] { border-radius: 28px !important; }
`

const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] })
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 })
const p = await ctx.newPage()
await p.goto("https://lou15.com/", { waitUntil: "load" })
await p.evaluate(() => document.fonts.ready)
await p.addStyleTag({ content: TILE })
await p.waitForTimeout(800)

const shoot = async (el, name) => {
  await el.evaluate((n) => n.dataset.shoot = "")
  await el.scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)
  const bg = await el.evaluate((n) => getComputedStyle(n).backgroundColor)
  if (bg !== "rgb(241, 236, 228)") throw new Error(`${name}: tile background is ${bg}`)
  await el.screenshot({ path: out(name), omitBackground: true })
  await el.evaluate((n) => delete n.dataset.shoot)
  console.log("wrote", name)
}

await shoot(p.locator(".intro"), "header")
const slugs = await p.$$eval(".card", (cs) => cs.map((c) => c.style.getPropertyValue("--vt").trim().replace("card-", "")))
for (let i = 0; i < slugs.length; i++) await shoot(p.locator(".card").nth(i), slugs[i])

// The footer plays a storyboard when it scrolls in; wait for the wordmark to finish writing.
await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
await p.waitForTimeout(5200)
await p.locator(".ssf").evaluate((n) => { n.dataset.shoot = ""; n.style.minHeight = "640px" })
await p.waitForTimeout(400)
await p.locator(".ssf").screenshot({ path: out("footer"), omitBackground: true })
console.log("wrote footer")
await b.close()
