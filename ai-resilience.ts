type ModelResult = { text?: string; candidates?: Array<{ finishReason?: string }> };
export const aiRuntime = {
  successes: 0,
  fallbacks: 0,
  failures: 0,
  lastSuccessAt: null as string | null,
  lastModel: null as string | null,
};

// Retry generation only, never side effects such as a send, payment or publication.
export async function generateWithFallback<T extends ModelResult>(options: {
  models: string[];
  cooldowns: Map<string, number>;
  cooldownMs: number;
  generate: (model: string, timeout: number) => Promise<T>;
  clock?: () => number;
  budgetMs?: number;
  onFailure?: (model: string, code: string) => void;
}): Promise<T> {
  const clock = options.clock || Date.now;
  const deadline = clock() + (options.budgetMs ?? 35000);
  const models = [...new Set(options.models)]
    .filter((model) => (options.cooldowns.get(model) || 0) <= clock())
    .slice(0, 3);
  let attempts = 0;
  for (const model of models) {
    const remaining = deadline - clock();
    if (remaining < 1000) break;
    attempts++;
    try {
      const result = await options.generate(model, Math.min(12000, remaining));
      const finish = result.candidates?.[0]?.finishReason;
      if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT')
        throw Error('AI_RESPONSE_BLOCKED');
      if (!result.text?.trim() || finish === 'MAX_TOKENS') throw Error('AI_RESPONSE_INCOMPLETE');
      options.cooldowns.delete(model);
      aiRuntime.successes++;
      if (attempts > 1) aiRuntime.fallbacks++;
      aiRuntime.lastSuccessAt = new Date(clock()).toISOString();
      aiRuntime.lastModel = model;
      return result;
    } catch (error) {
      const status = Number((error as { status?: unknown })?.status);
      const blocked = error instanceof Error && error.message === 'AI_RESPONSE_BLOCKED';
      const invalid = [400, 401, 402, 403].includes(status);
      const code = blocked
        ? 'AI_RESPONSE_BLOCKED'
        : invalid
          ? 'AI_CONFIGURATION_OR_ACCESS_ERROR'
          : 'AI_PROVIDER_TEMPORARILY_UNAVAILABLE';
      options.onFailure?.(model, code);
      // Invalid credentials/requests and content restrictions are not solved by retries.
      if (blocked || invalid) {
        aiRuntime.failures++;
        // Provider errors can contain request URLs or credentials; do not attach them.
        // eslint-disable-next-line preserve-caught-error
        throw Error(code);
      }
      options.cooldowns.set(model, clock() + options.cooldownMs);
    }
  }
  aiRuntime.failures++;
  throw Error('AI_PROVIDER_TEMPORARILY_UNAVAILABLE');
}
