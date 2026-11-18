import { z } from "zod";
import { environment } from "@/config/env";
import { EmbeddingProviderError, type EmbeddingProvider } from "@/modules/embeddings/provider";

const OllamaResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())).min(1),
});

const OllamaTagsSchema = z.object({
  models: z.array(z.object({ name: z.string(), digest: z.string().min(1) })),
});

export interface OllamaEmbeddingConfiguration {
  baseUrl: string;
  model: string;
  dimensions: number;
  timeoutMs?: number;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly provider = "ollama";
  readonly model: string;
  readonly dimensions: number;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(configuration: OllamaEmbeddingConfiguration = {
    baseUrl: environment.OLLAMA_BASE_URL,
    model: environment.EMBEDDING_MODEL,
    dimensions: environment.EMBEDDING_DIMENSIONS,
  }) {
    this.baseUrl = configuration.baseUrl.replace(/\/+$/, "");
    this.model = configuration.model;
    this.dimensions = configuration.dimensions;
    this.timeoutMs = configuration.timeoutMs ?? 30_000;
  }

  async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedMany([text]);
    return embedding;
  }

  async embedMany(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/embed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, input: texts.length === 1 ? texts[0] : texts }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new EmbeddingProviderError(timedOut
        ? `Ollama embedding request timed out after ${this.timeoutMs}ms.`
        : "Could not reach the Ollama embedding service.");
    }

    if (!response.ok) {
      throw new EmbeddingProviderError(`Ollama returned HTTP ${response.status} for the embedding request.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EmbeddingProviderError("Ollama returned invalid JSON for the embedding request.");
    }

    const parsed = OllamaResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new EmbeddingProviderError("Ollama returned an invalid embedding response.");
    }

    if (parsed.data.embeddings.length !== texts.length) {
      throw new EmbeddingProviderError(`Ollama returned ${parsed.data.embeddings.length} vectors for ${texts.length} inputs.`);
    }
    for (const embedding of parsed.data.embeddings) {
      if (embedding.length !== this.dimensions) {
        throw new EmbeddingProviderError(
          `Ollama returned ${embedding.length} dimensions; the configured size is ${this.dimensions}.`,
        );
      }
      if (!embedding.every(Number.isFinite)) {
        throw new EmbeddingProviderError("Ollama returned non-finite embedding values.");
      }
    }

    return parsed.data.embeddings;
  }

  async getModelVersion(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      const timedOut = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
      throw new EmbeddingProviderError(timedOut
        ? `Ollama model check timed out after ${this.timeoutMs}ms.`
        : "Could not reach Ollama to verify the configured embedding model.");
    }

    if (!response.ok) {
      throw new EmbeddingProviderError(`Ollama returned HTTP ${response.status} while checking available models.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EmbeddingProviderError("Ollama returned invalid JSON while checking available models.");
    }

    const parsed = OllamaTagsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new EmbeddingProviderError("Ollama returned an invalid model-list response.");
    }

    const configuredModel = this.model.replace(/:latest$/, "");
    const model = parsed.data.models.find((entry) => entry.name.replace(/:latest$/, "") === configuredModel);
    if (!model) {
      throw new EmbeddingProviderError(`Configured Ollama model '${this.model}' is unavailable. Pull it with 'ollama pull ${this.model}'.`);
    }

    return model.digest;
  }
}
