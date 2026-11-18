import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("matching API validation", () => {
  it("rejects malformed JSON and invalid matching payloads", async () => {
    const malformed = await POST(new Request("http://localhost/api/matching", { method: "POST", body: "{" }));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "INVALID_JSON" } });

    const invalid = await POST(new Request("http://localhost/api/matching", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId: "", strategy: "unsupported", topK: 100 }),
    }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ error: { code: "INVALID_REQUEST" } });
  });

  it("validates saved matching run IDs before querying storage", async () => {
    const response = await GET(new Request("http://localhost/api/matching?runId=%20"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "INVALID_RUN_ID" } });
  });
});
