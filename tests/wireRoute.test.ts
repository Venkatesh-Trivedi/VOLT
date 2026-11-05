import assert from "node:assert/strict";
import test from "node:test";
import { createPart } from "../src/model/catalog.ts";
import { wirePort, wireRoute } from "../src/model/wireRoute.ts";

const points = (path: string) =>
  path.split(" ").map((segment) => segment.slice(1).split(",").map(Number));

test("wires from the same breadboard row approach opposite LED pins separately", () => {
  const led = createPart("led", 250, 30);
  const board = createPart("breadboard", 0, 180);
  const left = points(wireRoute(wirePort(board, "tp2"), wirePort(led, "a")));
  const right = points(wireRoute(wirePort(board, "tp3"), wirePort(led, "b")));

  assert.deepEqual(left.at(-1), [250, 65]);
  assert.deepEqual(right.at(-1), [350, 65]);
  assert.ok(left.at(-2)![0] < 250);
  assert.ok(right.at(-2)![0] > 350);
  assert.notEqual(left.at(-3)![1], right.at(-3)![1]);
});

test("the pin approach rotates with the component", () => {
  const led = { ...createPart("led", 250, 30), rotation: 90 };
  const port = wirePort(led, "a");
  const path = points(wireRoute(port, { x: 50, y: 220 }));
  assert.deepEqual(path[0], [port.x, port.y]);
  assert.equal(path[1][0], port.x);
  assert.ok(path[1][1] < port.y);
});
