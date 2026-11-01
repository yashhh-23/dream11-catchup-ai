import Groq from "groq-sdk";

export const GROQ_MODELS = [
  "llama-3.1-8b-instant",
  "llama-3.3-70b-versatile",
] as const;

// Module-level singleton instance to avoid cold-start instantiation per request
let groqSingleton: Groq | null = null;

function getGroqClient(apiKey: string): Groq {
  if (!groqSingleton) {
    groqSingleton = new Groq({ apiKey });
  }
  return groqSingleton;
}

export async function callGroqRecap(
  prompt: string,
  maxRetries = 2,
  attemptTimeoutMs = 2500,
  totalDeadlineMs = 5000
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY_MISSING");
  }

  const groq = getGroqClient(apiKey);
  let modelIndex = 0;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const elapsed = Date.now() - startTime;
    const remainingTime = totalDeadlineMs - elapsed;

    // If total deadline is nearly exhausted, stop immediately to allow offline fallback
    if (remainingTime < 800) {
      throw new Error("GROQ_TOTAL_DEADLINE_EXCEEDED");
    }

    const currentTimeout = Math.min(attemptTimeoutMs, remainingTime);
    const chosenModel = GROQ_MODELS[modelIndex];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), currentTimeout);

    try {
      const completion = await groq.chat.completions.create(
        {
          model: chosenModel,
          messages: [
            {
              role: "system",
              content: "You are Rhea AI, an expert, enthusiastic sports companion for Dream11. You always output valid, raw JSON with no markdown wrapping.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.5,
          max_tokens: 380,
          response_format: { type: "json_object" },
        },
        { signal: controller.signal }
      );

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("EMPTY_RESPONSE_FROM_GROQ");
      }

      return responseText.trim();
    } catch (error: any) {
      console.warn(`Groq API attempt ${attempt + 1} with model ${chosenModel} failed:`, error?.message || error);

      // Check for non-retryable errors (400, 401 Unauthorized, 403 Forbidden, 404)
      const status = error?.status || error?.statusCode;
      const isAuthOrClientError = status === 400 || status === 401 || status === 403 || status === 404;
      const isMissingKey = error?.message?.includes("API key") || error?.message?.includes("invalid_api_key");

      if (isAuthOrClientError || isMissingKey) {
        throw error; // Do not retry fatal non-retryable client/auth errors
      }

      // Walk sequentially to the next model in the pool
      modelIndex = (modelIndex + 1) % GROQ_MODELS.length;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff delay (150ms, 300ms) capped by remaining deadline
      const delayMs = Math.min(150 * Math.pow(2, attempt), Math.max(0, totalDeadlineMs - (Date.now() - startTime) - 500));
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("GROQ_MAX_RETRIES_EXCEEDED");
}
