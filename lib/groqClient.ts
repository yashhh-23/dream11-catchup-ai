import Groq from "groq-sdk";

export async function callGroqRecap(prompt: string, maxRetries = 2): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY_MISSING");
  }

  const groq = new Groq({ apiKey });

  // Preferred fast production models on Groq
  const models = ["llama-3.1-70b-versatile", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  let chosenModel = models[0];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await groq.chat.completions.create({
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
        temperature: 0.6,
        max_tokens: 700,
        response_format: { type: "json_object" },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error("EMPTY_RESPONSE_FROM_GROQ");
      }

      return responseText.trim();
    } catch (error: any) {
      console.warn(`Groq API attempt ${attempt + 1} failed:`, error?.message || error);

      // If model not found or decommissioned, try fallback model
      if (error?.status === 404 || error?.message?.includes("model")) {
        chosenModel = models[2]; // try llama-3.1-8b-instant
      }

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff delay (400ms, 800ms)
      const delayMs = 400 * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error("GROQ_MAX_RETRIES_EXCEEDED");
}
