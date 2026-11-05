import assert from "node:assert/strict";
import test from "node:test";
import { generateCircuit } from "../server/circuitAi.ts";
import { starterCircuit } from "../src/model/catalog.ts";

function modelReply(draft: unknown) {
  return Response.json({
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(draft) }],
      },
    ],
  });
}

test("AI request asks for structured output and returns a validated circuit", async (t) => {
  const design = starterCircuit();
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      const body = JSON.parse(String(options.body));
      assert.equal(body.input, "Build a switched LED circuit");
      assert.equal(body.model, "gpt-5.4-mini");
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      return modelReply({
        circuit: design,
        message: "Run the simulation and toggle the switch.",
      });
    },
  );
  const draft = await generateCircuit(
    "Build a switched LED circuit",
    "test-key",
  );
  assert.deepEqual(draft.circuit, design);
});

test("AI rejects a missing pin and a shorted voltage source", async (t) => {
  const design = starterCircuit();
  const from = design.wires[0].from;
  const to = design.wires[0].to;
  t.mock.method(globalThis, "fetch", async () =>
    modelReply({ circuit: design, message: "Draft" }),
  );
  design.wires[0].to = { ...to, pin: "missing" };
  await assert.rejects(
    generateCircuit("Build a circuit", "test-key"),
    /invalid or unsolvable/,
  );
  design.wires[0].to = { part: from.part, pin: "n" };
  await assert.rejects(
    generateCircuit("Build a circuit", "test-key"),
    /invalid or unsolvable/,
  );
});

test("AI returns an explanation without inventing unsupported parts", async (t) => {
  const draft = {
    circuit: null,
    message: "Arduino firmware simulation is unavailable.",
  };
  t.mock.method(globalThis, "fetch", async () => modelReply(draft));
  assert.deepEqual(
    await generateCircuit("Make an Arduino sketch", "test-key"),
    draft,
  );
});
