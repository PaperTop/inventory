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
  ).rejects.toMatchObject({ reason: "provider_error" });
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

it("uses Claude credentials and model instead of compatible-provider settings", async () => {
  vi.stubEnv("AI_PROVIDER", "claude");
  vi.stubEnv("ANTHROPIC_API_KEY", "test-anthropic-key");
  vi.stubEnv("ANTHROPIC_MODEL", "claude-haiku-5-5");
  vi.stubEnv("AI_API_KEY", "unused-compatible-key");
  vi.stubEnv("AI_MODEL", "unused-compatible-model");
  const factory = vi.fn<ModelFactory>(() => ({
    async invoke() {
      return new AIMessage(JSON.stringify({ answer: "Ready.", itemIds: [] }));
    },
  }));
  const provider = configuredProvider(factory);
  await expect(
    provider!.answer({ question: "Find a jacket", items: [] }),
  ).resolves.toEqual({ answer: "Ready.", itemIds: [] });
  expect(factory).toHaveBeenCalledExactlyOnceWith({
    provider: "claude",
    model: "claude-haiku-5-5",
    apiKey: "test-anthropic-key",
    maxRetries: 0,
    maxTokens: 2400,
    timeout: 20_000,
  });
});

it("does not initialize a model for an unsupported provider", () => {
  vi.stubEnv("AI_PROVIDER", "unsupported");
  const factory = vi.fn<ModelFactory>();
  expect(configuredProvider(factory)).toBeUndefined();
  expect(factory).not.toHaveBeenCalled();
});
