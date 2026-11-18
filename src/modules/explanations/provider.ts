import type { Explanation, ExplanationContext } from "./schema";

export interface ExplanationProvider {
  readonly provider: string;
  readonly model: string;
  generate(context: ExplanationContext): Promise<unknown>;
}

export class ExplanationProviderError extends Error {
  readonly kind: "unavailable" | "timeout" | "invalid_response";

  constructor(kind: ExplanationProviderError["kind"], message: string) {
    super(message);
    this.name = "ExplanationProviderError";
    this.kind = kind;
  }
}

export interface ExplanationGenerator extends ExplanationProvider {
  generate(context: ExplanationContext): Promise<Explanation>;
}
