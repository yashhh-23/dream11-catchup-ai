import Groq from "groq-sdk";

export const GROQ_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
] as const;

// Module-level singleton instance to avoid cold-start instantiation per request
let groqSingleton: Groq | null = null;

function getGroqClient(apiKey: string): Groq {
  if (!groqSingleton) {
    groqSingleton = new Groq({ apiKey });
  }
  return groqSingleton;
}

export async function callGroqRecap(prompt: string, maxRetries = 2, timeoutMs = 3000): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY_MISSING");
  }

  const groq = getGroqClient(apiKey);
  let modelIndex = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const chosenModel = GROQ_MODELS[modelIndex];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

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
          max_tokens: 700,
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

      // Walk sequentially to the next model in the pool
      modelIndex = (modelIndex + 1) % GROQ_MODELS.length;

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff delay (250ms, 500ms)
      const delayMs = 250 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("GROQ_MAX_RETRIES_EXCEEDED");
}
