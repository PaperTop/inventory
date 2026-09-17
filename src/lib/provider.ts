import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogle } from "@langchain/google";
import {
  createReadOnlyAnswerGraph,
  inventoryToolDefinitions,
  type ReadOnlyChatModel,
} from "./answer-graph";
import type { AnswerProvider } from "./ask";

const MODEL_LIMITS = {
  maxRetries: 0,
  maxTokens: 1_200,
  timeout: 20_000,
} as const;

export type ModelConfiguration =
  | ({
      provider: "google";
      model: string;
      apiKey: string;
    } & typeof MODEL_LIMITS)
  | ({
      provider: "openai-compatible";
      model: string;
      baseURL: string;
      apiKey?: string;
    } & typeof MODEL_LIMITS)
  | ({
      provider: "claude";
      model: string;
      apiKey: string;
    } & typeof MODEL_LIMITS);

export type ModelFactory = (
  configuration: ModelConfiguration,
) => ReadOnlyChatModel;

const createLangChainModel: ModelFactory = (configuration) => {
  if (configuration.provider === "google") {
    const model = new ChatGoogle({
      model: configuration.model,
      apiKey: configuration.apiKey,
      platformType: "gai",
      maxRetries: configuration.maxRetries,
      maxOutputTokens: configuration.maxTokens,
    }).bindTools(inventoryToolDefinitions);
    return { invoke: (messages, options) => model.invoke(messages, options) };
  }
  if (configuration.provider === "openai-compatible") {
    const model = new ChatOpenAI({
      model: configuration.model,
      apiKey: configuration.apiKey || "local-inference",
      temperature: 0,
      maxRetries: configuration.maxRetries,
      maxTokens: configuration.maxTokens,
      timeout: configuration.timeout,
      configuration: { baseURL: configuration.baseURL },
    });
    return {
      invoke: (messages, options) =>
        model.bindTools(inventoryToolDefinitions).invoke(messages, options),
    };
  }

  const model = new ChatAnthropic({
    model: configuration.model,
    apiKey: configuration.apiKey,
    temperature: 0,
    maxRetries: configuration.maxRetries,
    maxTokens: configuration.maxTokens,
    clientOptions: { timeout: configuration.timeout },
  });
  return {
    invoke: (messages, options) =>
      model.bindTools(inventoryToolDefinitions).invoke(messages, options),
  };
};

export function configuredProvider(
  modelFactory: ModelFactory = createLangChainModel,
): AnswerProvider | undefined {
  const choice = process.env.AI_PROVIDER;

  if (choice === "google") {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL;
    if (!apiKey || !model) return undefined;
    return createReadOnlyAnswerGraph(
      modelFactory({ provider: "google", model, apiKey, ...MODEL_LIMITS }),
    );
  }

  if (choice === "openai-compatible") {
    const baseURL = process.env.AI_BASE_URL;
    const model = process.env.AI_MODEL;
    if (!baseURL || !model) return undefined;

    return createReadOnlyAnswerGraph(
      modelFactory({
        provider: "openai-compatible",
        model,
        baseURL,
        apiKey: process.env.AI_API_KEY || undefined,
        ...MODEL_LIMITS,
      }),
    );
  }

  if (choice === "claude") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL;
    if (!apiKey || !model) return undefined;

    return createReadOnlyAnswerGraph(
      modelFactory({
        provider: "claude",
        model,
        apiKey,
        ...MODEL_LIMITS,
      }),
    );
  }

  return undefined;
}
