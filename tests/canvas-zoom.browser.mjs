// Run against npm run dev; requires puppeteer-core and a local Chrome installation.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(process.env.VOLTAGE_BROWSER_RUNTIME || resolve("package.json"));
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(process.env.VOLTAGE_URL || "http://127.0.0.1:5173/", { waitUntil: "networkidle0" });
  const shell = () => page.evaluate(() => ({
    header: document.querySelector(".app-header").getBoundingClientRect().height,
    pixelRatio: devicePixelRatio,
    viewport: visualViewport.scale,
  }));
  const before = await shell();
  for (const ctrlKey of [false, true]) {
    const zoom = await page.$eval(".zoom-controls span", el => el.textContent);
    const canceled = await page.$eval(".circuit-canvas", (canvas, ctrlKey) => {
      const rect = canvas.getBoundingClientRect();
      return !canvas.dispatchEvent(new WheelEvent("wheel", {
        bubbles: true, cancelable: true, deltaY: -100, ctrlKey,
        clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      }));
    }, ctrlKey);
    assert.equal(canceled, true, "Canvas must cancel browser scrolling/zooming");
    await page.waitForFunction(previous => document.querySelector(".zoom-controls span").textContent !== previous, {}, zoom);
    assert.deepEqual(await shell(), before, "Application chrome must retain its scale");
  }
  assert.equal(await page.$eval(".app-header", header => header.dispatchEvent(new WheelEvent("wheel", {
    bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100,
  }))), true, "Browser zoom outside the canvas must remain available");
  console.log("Canvas wheel and Ctrl/pinch-wheel zoom regression passed.");
} finally {
  await browser.close();
}
