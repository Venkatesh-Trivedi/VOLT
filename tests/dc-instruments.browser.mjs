// Same optional Chrome/Puppeteer runtime setup as canvas-zoom.browser.mjs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createPart } from "../src/model/catalog.ts";

const require = createRequire(
  process.env.VOLTAGE_BROWSER_RUNTIME || resolve("package.json"),
);
const puppeteer = require("puppeteer-core");
const browser = await puppeteer.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const battery = {
  ...createPart("battery", 70, 290),
  id: "B",
  label: "B1",
  value: 10,
};
const pot = {
  ...createPart("potentiometer", 320, 100),
  id: "P",
  label: "RV1",
  value: 10000,
  wiper: 0.5,
};
const meter = { ...createPart("multimeter", 570, 100), id: "VM", label: "VM1" };
const wire = (a, ap, b, bp) => ({
  id: crypto.randomUUID(),
  from: { part: a, pin: ap },
  to: { part: b, pin: bp },
  color: "coral",
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(process.env.VOLTAGE_URL || "http://127.0.0.1:5173/", {
    waitUntil: "networkidle0",
  });
  const load = async (circuit) => {
    await page.evaluate(
      (c) => localStorage.setItem("voltage.circuit.v1", JSON.stringify(c)),
      circuit,
    );
    await page.reload({ waitUntil: "networkidle0" });
  };
  await load({
    version: 1,
    name: "Divider",
    parts: [battery, pot, meter],
    wires: [
      wire("B", "p", "P", "a"),
      wire("B", "n", "P", "b"),
      wire("VM", "a", "P", "w"),
      wire("VM", "b", "P", "b"),
    ],
  });
  await page.click(".run-button");
  await page.waitForFunction(
    () =>
      document.querySelector(".circuit-canvas .meter-value").textContent ===
      "5.00 V",
  );
  await page.click('g[aria-label="RV1 Potentiometer; select to edit"]');
  await page.$eval('[aria-label="Wiper position"]', (el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "75");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(
    () =>
      document.querySelector(".circuit-canvas .meter-value").textContent ===
      "2.50 V",
  );
  await page.click(".save-button");
  await page.reload({ waitUntil: "networkidle0" });
  await page.click('g[aria-label="RV1 Potentiometer; select to edit"]');
  assert.equal(
    await page.$eval('[aria-label="Wiper position"]', (el) => el.value),
    "75",
  );

  const resistor = {
    ...createPart("resistor", 320, 100),
    id: "R",
    label: "R1",
    value: 1000,
  };
  await load({
    version: 1,
    name: "Series current",
    parts: [battery, resistor, meter],
    wires: [
      wire("B", "p", "VM", "a"),
      wire("VM", "b", "R", "a"),
      wire("R", "b", "B", "n"),
    ],
  });
  await page.click('g[aria-label="VM1 Multimeter; select to edit"]');
  await page.select('[aria-label="Measurement mode"]', "current");
  await page.click(".run-button");
  await page.waitForFunction(
    () =>
      document.querySelector(".circuit-canvas .meter-value").textContent ===
      "10.00 mA",
  );
  await page.click(".save-button");
  await page.reload({ waitUntil: "networkidle0" });
  await page.click('g[aria-label="VM1 Multimeter; select to edit"]');
  assert.equal(
    await page.$eval('[aria-label="Measurement mode"]', (el) => el.value),
    "current",
  );
  await load({
    version: 1,
    name: "Resistance",
    parts: [resistor, meter],
    wires: [wire("VM", "a", "R", "a"), wire("VM", "b", "R", "b")],
  });
  await page.click('g[aria-label="VM1 Multimeter; select to edit"]');
  await page.select('[aria-label="Measurement mode"]', "resistance");
  await page.click(".run-button");
  await page.waitForFunction(
    () =>
      document.querySelector(".circuit-canvas .meter-value").textContent ===
      "1.00 kΩ",
  );
  assert.match(
    await page.$eval(".reading-list", (el) => el.textContent),
    /Resistance1\.00 kΩ/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Live wiper, voltage, current, resistance, and saved settings browser checks passed.",
  );
} finally {
  await browser.close();
}
