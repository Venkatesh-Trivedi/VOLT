import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { catalog, createPart, dimensions, pins } from "../src/model/catalog.ts";
import { parseCircuit } from "../src/model/persistence.ts";
import { simulate } from "../src/model/solver.ts";
import { wireColors } from "../src/model/types.ts";

const parts = catalog.filter((part) => part.supported);
const object = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const string = { type: "string" };
const number = { type: "number" };
const endpoint = object({ part: string, pin: string });
const color = { type: "string", enum: wireColors };
const circuit = object({
  version: { type: "integer", enum: [1] },
  name: string,
  parts: {
    type: "array",
    items: object({
      id: string,
      kind: { type: "string", enum: parts.map((part) => part.kind) },
      label: string,
      x: number,
      y: number,
      rotation: { type: "integer", enum: [0, 90, 180, 270] },
      value: number,
      closed: { type: "boolean" },
      color,
      wiper: number,
      meterMode: { type: "string", enum: ["voltage", "current", "resistance"] },
    }),
  },
  wires: {
    type: "array",
    items: object({ id: string, from: endpoint, to: endpoint, color }),
  },
});
const schema = object({
  message: string,
  circuit: { anyOf: [circuit, { type: "null" }] },
});

const instructions = `Design an editable VOLTAGE circuit for the user's description. Return a short message explaining how to try it. If the request cannot be built from the supported DC parts, return null for circuit and explain what is missing. Never invent a component or pin.
Use at most 20 parts and 80 wires. Give parts and wires distinct alphanumeric IDs, labels such as R1, and nonoverlapping x/y positions. Use a series resistor with LEDs and observe polarity. Current meters are wired in series, voltage meters across nodes, and resistance meters only across unpowered passive networks. Wires connect only at their endpoints. Include a complete return path when the requested circuit should conduct. For unused properties set rotation 0, closed false, wiper 0.5, and meterMode voltage. Colors: ${wireColors.join(", ")}.
Supported parts (kind, default value/unit, size, pin IDs):
${parts
  .map((item) => {
    const part = createPart(item.kind, 0, 0);
    const { w, h } = dimensions(item.kind);
    const contacts =
      item.kind === "breadboard"
        ? "a1–j25 (a–e and f–j each connected per column); tp1–tp25, tn1–tn25, bp1–bp25, bn1–bn25 are four independent continuous rails"
        : pins(part)
            .map((pin) => `${pin.id}=${pin.label}`)
            .join(", ");
    return `${item.kind}: ${item.value} ${item.unit}, ${w}×${h}, ${contacts}`;
  })
  .join("\n")}`;

export async function generateCircuit(
  prompt: string,
  apiKey: string,
  signal = AbortSignal.timeout(90000),
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.4-mini",
      instructions,
      input: prompt,
      store: false,
      max_output_tokens: 6500,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "voltage_circuit",
          strict: true,
          schema,
        },
      },
    }),
    signal,
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error("OpenAI rejected the server API key or model access.");
    if (response.status === 429)
      throw new Error(
        "OpenAI rate limit or quota reached. Check your API account and try again.",
      );
    throw new Error("OpenAI could not generate the circuit. Try again.");
  }
  const result = await response.json();
  const output = result.output?.flatMap(
    (item: { content?: { type: string; text?: string }[] }) =>
      item.content ?? [],
  );
  const answer = output?.find(
    (item: { type: string }) => item.type === "output_text",
  )?.text;
  if (result.status !== "completed" || !answer)
    throw new Error(
      "The model did not return a complete circuit. Try a smaller or more specific request.",
    );
  let draft;
  try {
    draft = JSON.parse(answer);
    if (typeof draft.message !== "string") throw new Error();
    if (draft.circuit === null)
      return { message: draft.message, circuit: null };
    const design = parseCircuit(JSON.stringify(draft.circuit));
    if (
      !design.parts.length ||
      design.parts.length > 20 ||
      design.wires.length > 80 ||
      design.parts.some((p) => !parts.some((item) => item.kind === p.kind))
    )
      throw new Error();
    const simulation = simulate(design);
    if (!simulation.valid) throw new Error();
    return { message: draft.message, circuit: design };
  } catch {
    throw new Error(
      "The model returned an invalid or unsolvable circuit. Try rephrasing the request.",
    );
  }
}

export function circuitAi(apiKey?: string): Plugin {
  let busy = false;
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, data: object) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    // Keep the paid API endpoint local even if Vite is exposed on the LAN.
    const host = req.headers.host ?? "";
    if (
      !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) ||
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        req.socket.remoteAddress ?? "",
      ) ||
      (req.headers.origin && req.headers.origin !== `http://${host}`)
    ) {
      return send(403, {
        error: "Open VOLTAGE on localhost to use the AI builder.",
      });
    }
    if (req.method !== "POST")
      return send(405, { error: "Use POST to generate a circuit." });
    if (!req.headers["content-type"]?.startsWith("application/json"))
      return send(415, { error: "Expected a JSON request." });
    if (!apiKey)
      return send(503, {
        error:
          "Set OPENAI_API_KEY in .env.local and restart VOLTAGE to enable generation.",
      });
    let prompt: string;
    try {
      let body = "";
      req.setEncoding("utf8");
      for await (const chunk of req) {
        body += chunk.toString();
        if (body.length > 8192)
          return send(413, { error: "The request is too long." });
      }
      const data = JSON.parse(body);
      if (typeof data?.prompt !== "string") throw new Error();
      prompt = data.prompt.trim();
      if (!prompt || prompt.length > 1500) throw new Error();
    } catch {
      return send(400, {
        error: "Enter a circuit description up to 1,500 characters.",
      });
    }
    if (busy)
      return send(429, {
        error: "A circuit is already generating. Try again when it finishes.",
      });
    busy = true;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    res.once("close", cancel);
    try {
      const draft = await generateCircuit(
        prompt,
        apiKey,
        AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]),
      );
      if (!res.destroyed) send(200, draft);
    } catch (error) {
      if (!res.destroyed)
        send(502, {
          error:
            error instanceof Error && error.name === "Error"
              ? error.message
              : "Generation timed out or could not reach OpenAI. Try again.",
        });
    } finally {
      res.off("close", cancel);
      busy = false;
    }
  };
  return {
    name: "voltage-circuit-ai",
    configureServer(server) {
      server.middlewares.use("/api/generate-circuit", handle);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/generate-circuit", handle);
    },
  };
}
