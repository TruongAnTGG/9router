import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/usageDb.js", () => ({
  appendRequestLog: vi.fn(() => Promise.resolve()),
  saveRequestUsage: vi.fn(() => Promise.resolve()),
  trackPendingRequest: vi.fn(),
}));

import { DefaultExecutor } from "../../open-sse/executors/default.js";
import { createPassthroughStreamWithLogger } from "../../open-sse/utils/stream.js";

async function readStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let output = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
  }

  output += decoder.decode();
  return output;
}

describe("OpenAI-compatible usage tracking", () => {
  it("requests streaming usage from OpenAI-compatible providers", () => {
    const executor = new DefaultExecutor("openai-compatible-test");
    const body = {
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    };

    const transformed = executor.transformRequest("test-model", body, true);

    expect(transformed.stream_options).toEqual({ include_usage: true });
  });

  it("preserves and records usage-only streaming chunks", async () => {
    let completedUsage = null;
    const transform = createPassthroughStreamWithLogger(
      "openai-compatible-test",
      null,
      "test-model",
      "conn_123456789",
      { messages: [{ role: "user", content: "hi" }] },
      (_content, usage) => {
        completedUsage = usage;
      },
      null
    );

    const outputPromise = readStream(transform.readable);
    const writer = transform.writable.getWriter();
    await writer.write(new TextEncoder().encode(
      'data: {"id":"chatcmpl-test","choices":[{"delta":{"content":"hello"},"index":0}]}\n\n'
    ));
    await writer.write(new TextEncoder().encode(
      'data: {"id":"chatcmpl-test","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}\n\n'
    ));
    await writer.write(new TextEncoder().encode("data: [DONE]\n\n"));
    await writer.close();

    const output = await outputPromise;

    expect(output).toContain('"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}');
    expect(completedUsage).toMatchObject({ prompt_tokens: 12, completion_tokens: 3 });
  });
});
