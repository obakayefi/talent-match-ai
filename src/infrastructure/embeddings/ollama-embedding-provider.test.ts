import { afterEach, describe, expect, it, vi } from "vitest";
import { EmbeddingProviderError } from "@/modules/embeddings/provider";
import { OllamaEmbeddingProvider } from "./ollama-embedding-provider";

const provider = new OllamaEmbeddingProvider({
  baseUrl: "http://localhost:11434/",
  model: "test-embed",
  dimensions: 3,
  timeoutMs: 50,
});

afterEach(() => vi.unstubAllGlobals());

describe("OllamaEmbeddingProvider", () => {
  it("returns a correctly sized embedding from Ollama", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ embeddings: [[0.1, 0.2, 0.3]] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(provider.embed("hello")).resolves.toEqual([0.1, 0.2, 0.3]);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:11434/api/embed", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ model: "test-embed", input: "hello" }),
    }));
  });

  it("rejects unexpected dimensions and provider errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ embeddings: [[0.1, 0.2]] })));
    await expect(provider.embed("hello")).rejects.toThrow(/configured size is 3/);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(provider.embed("hello")).rejects.toBeInstanceOf(EmbeddingProviderError);
  });

  it("reports timeout failures without exposing provider internals", async () => {
    const timeout = new DOMException("request aborted", "TimeoutError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(provider.embed("hello")).rejects.toThrow(/timed out after 50ms/);
  });

  it("verifies the configured model and returns its Ollama digest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ models: [{ name: "test-embed:latest", digest: "sha256:test-digest" }] })));
    await expect(provider.getModelVersion()).resolves.toBe("sha256:test-digest");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ models: [] })));
    await expect(provider.getModelVersion()).rejects.toThrow(/ollama pull test-embed/);
  });
});
