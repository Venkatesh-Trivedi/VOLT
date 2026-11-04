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
  await page.click('[aria-label="Reset view"]');
  const transform = () => page.$eval('.circuit-canvas > g', el => el.getAttribute('transform'));
  const initialPan = await transform();
  const canvas = await (await page.$('.circuit-canvas')).boundingBox();
  await page.mouse.move(canvas.x + 20, canvas.y + 20);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 80, canvas.y + 60, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await transform(), initialPan, 'Dragging empty canvas must pan without the hand tool');
  const releasedPan = await transform();
  await page.mouse.move(canvas.x + 100, canvas.y + 70);
  assert.equal(await transform(), releasedPan, 'Panning must stop on release');

  const partSelector = 'g[aria-label="R1 Resistor; select to edit"]';
  const partTransform = () => page.$eval(partSelector, el => el.parentElement.getAttribute('transform'));
  const initialPart = await partTransform();
  const part = await (await page.$(partSelector)).boundingBox();
  await page.mouse.move(part.x + part.width / 2, part.y + part.height / 2);
  await page.mouse.down();
  await page.mouse.move(part.x + part.width / 2 + 35, part.y + part.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  assert.notEqual(await partTransform(), initialPart, 'Dragging a component must still move it');
  assert.equal(await transform(), releasedPan, 'Dragging a component must not pan the view');
  console.log('Background panning, release, and component dragging regression passed.');
} finally {
  await browser.close();
}
