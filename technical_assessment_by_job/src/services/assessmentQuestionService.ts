import type { Difficulty, Question } from '../types';
import { ensureQuestionIdentity } from '../utils/questionIdentity';

export const QUESTION_SOURCE_LABEL =
  'Workbook Question Service (questions/java_questions.xlsx)';
export const QUESTION_SOURCE_PATH =
  'questions/java_questions.xlsx -> server/workbookAssessmentQuestionService.mjs -> http://localhost:4176/api/generate-questions';

const DEFAULT_API_BASE_URL = 'http://localhost:4176';
const QUESTION_API_BASE_URL =
  (
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_QUESTION_API_URL ?? ''
  ).trim() || DEFAULT_API_BASE_URL;

interface GenerateQuestionsInput {
  jobDescription: string;
  selectedTechnologies: string[];
  questionCount: number;
  difficultyFilter: Difficulty | 'all';
  generationCount: number;
  usedQuestionKeys: string[];
}

interface AssessmentQuestionService {
  generateQuestions(input: GenerateQuestionsInput): Promise<Question[]>;
}

class HybridAssessmentQuestionService implements AssessmentQuestionService {
  async generateQuestions(input: GenerateQuestionsInput) {
    const response = await fetch(`${QUESTION_API_BASE_URL}/api/generate-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(
        errorPayload?.error ?? 'Unable to reach the assessment question API.',
      );
    }

    const payload = (await response.json()) as { questions?: Question[] };
    return (payload.questions ?? []).map(ensureQuestionIdentity);
  }
}

export const assessmentQuestionService: AssessmentQuestionService =
  new HybridAssessmentQuestionService();
