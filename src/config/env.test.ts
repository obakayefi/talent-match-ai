import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { parseEnvironment } from "./env";

describe("environment configuration", () => {
  it("validates required configuration and supplies embedding defaults", () => {
    expect(parseEnvironment({ DATABASE_URL: "postgresql://user:pass@localhost:5432/app" })).toMatchObject({
      DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      NODE_ENV: "development",
      OLLAMA_BASE_URL: "http://localhost:11434",
      EMBEDDING_MODEL: "nomic-embed-text",
      EMBEDDING_DIMENSIONS: 768,
    });
  });

  it("rejects invalid connection URLs and embedding dimensions", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "not-a-url" })).toThrow(ZodError);
    expect(() => parseEnvironment({ DATABASE_URL: "postgresql://localhost/app", EMBEDDING_DIMENSIONS: "0" }))
      .toThrow(ZodError);
  });

  it("allows the optional explanation model to remain unset", () => {
    expect(parseEnvironment({ DATABASE_URL: "postgresql://user:pass@localhost:5432/app", EXPLANATION_MODEL: " " }).EXPLANATION_MODEL).toBeUndefined();
    expect(parseEnvironment({ DATABASE_URL: "postgresql://user:pass@localhost:5432/app", EXPLANATION_MODEL: "local-model:tag" }).EXPLANATION_MODEL).toBe("local-model:tag");
  });
});
