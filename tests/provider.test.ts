import { AIMessage } from "@langchain/core/messages";
import { afterEach, expect, it, vi } from "vitest";
import {
  configuredProvider,
  type ModelConfiguration,
  type ModelFactory,
} from "../src/lib/provider";

afterEach(() => vi.unstubAllEnvs());

it("does not activate model inference by default", () => {
  vi.stubEnv("AI_PROVIDER", "search");
  vi.stubEnv("ANTHROPIC_API_KEY", "unused");
  expect(configuredProvider()).toBeUndefined();
});

it("configures an OpenAI-compatible LangChain model for Ollama", async () => {
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("AI_BASE_URL", "http://localhost:11434/v1");
  vi.stubEnv("AI_MODEL", "qwen3:8b");

  let configuration: ModelConfiguration | undefined;
  let calls = 0;
  const factory: ModelFactory = (input) => {
    configuration = input;
    return {
      async invoke() {
        calls += 1;
        return new AIMessage(
          JSON.stringify({
            answer: "You have a jacket.",
            itemIds: ["jacket-id"],
          }),
        );
      },
    };
  };

  const provider = configuredProvider(factory);
  const result = await provider!.answer({
    question: "What do I have?",
    items: [],
  });

  expect(result).toEqual({
    answer: "You have a jacket.",
    itemIds: ["jacket-id"],
  });
  expect(configuration).toEqual({
    provider: "openai-compatible",
    model: "qwen3:8b",
    baseURL: "http://localhost:11434/v1",
    apiKey: undefined,
    maxRetries: 0,
    maxTokens: 1200,
    timeout: 20_000,
  });
  expect(calls).toBe(1);
});

it("does not retry a failed model invocation", async () => {
  vi.stubEnv("AI_PROVIDER", "openai-compatible");
  vi.stubEnv("AI_BASE_URL", "https://inference.example/v1");
  vi.stubEnv("AI_MODEL", "test-model");

  let calls = 0;
  const factory: ModelFactory = () => ({
    async invoke() {
      calls += 1;
      throw new Error("provider unavailable");
    },
  });

  const provider = configuredProvider(factory);
  await expect(
    provider!.answer({ question: "jacket", items: [] }),
  ).rejects.toThrow("provider unavailable");
  expect(calls).toBe(1);
});

it("requires an explicit model and API key for Claude", () => {
  vi.stubEnv("AI_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  vi.stubEnv("ANTHROPIC_MODEL", "");
  expect(
    configuredProvider(() => {
      throw new Error("factory must not run");
    }),
  ).toBeUndefined();
});

it("supports the native Google adapter for signature-preserving Gemini tool calls", () => {
  vi.stubEnv("AI_PROVIDER", "google");
  vi.stubEnv("AI_API_KEY", "test-key");
  vi.stubEnv("AI_MODEL", "gemini-test-model");
  let configuration: ModelConfiguration | undefined;
  const provider = configuredProvider((input) => {
    configuration = input;
    return {
      async invoke() {
        return new AIMessage("{}");
      },
    };
  });
  expect(provider).toBeDefined();
  expect(configuration).toMatchObject({
    provider: "google",
    model: "gemini-test-model",
    apiKey: "test-key",
    maxRetries: 0,
  });
});
