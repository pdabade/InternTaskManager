import { genAI } from "./appwrite";

export interface EvaluationResult {
  score?: number;
  feedback?: string;
  issues?: string[];
  strengths?: string[];
  error?: string;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

export async function evaluateSubmission(task: string, code: string): Promise<EvaluationResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0,
    },
  });

  const prompt = `You are a strict code evaluator.

Task:
${task}

Code:
${code}

Evaluate ONLY based on code.

Criteria:
- correctness
- completeness
- code quality
- edge cases

Ignore documentation or external links.

Return ONLY JSON:
{
  "score": number (0-10),
  "feedback": string,
  "issues": string[],
  "strengths": string[]
}`;

  let retries = 1;
  while (retries >= 0) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = (jsonMatch?.[0] ?? text)
        .replace(/```json\n?|\n?```/g, "")
        .trim();
      const parsed = JSON.parse(jsonStr);
      
      return {
        score: typeof parsed.score === "number" ? parsed.score : undefined,
        feedback:
          typeof parsed.feedback === "string" ? parsed.feedback.trim() : undefined,
        issues: Array.isArray(parsed.issues) ? parsed.issues : [],
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths : []
      };
    } catch (error: unknown) {
      if (retries === 0) {
        return { error: `Failed to parse AI evaluation: ${getErrorMessage(error)}` };
      }
      retries--;
    }
  }
  
  return { error: "Unknown evaluation failure" };
}
