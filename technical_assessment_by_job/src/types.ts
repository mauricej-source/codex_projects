export type TechnologyCategory =
  | 'Programming Languages'
  | 'Frontend'
  | 'Backend'
  | 'Databases'
  | 'Cloud'
  | 'DevOps'
  | 'Testing'
  | 'Data Engineering / Analytics'
  | 'Security'
  | 'Architecture / Design'
  | 'Agile / Process'
  | 'Other';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface KeywordMatch {
  keyword: string;
  category: TechnologyCategory;
}

export interface Question {
  id: string;
  sourceId: string;
  dedupeKey: string;
  technology: string;
  category: TechnologyCategory;
  difficulty: Difficulty;
  prompt: string;
  choices: string[];
  correctAnswer: string;
  explanation: string;
}

export interface AssessmentResult {
  correctCount: number;
  total: number;
  percentage: number;
  passed: boolean;
  categoryBreakdown: Array<{
    label: string;
    correct: number;
    total: number;
  }>;
  recommendedFocusAreas: string[];
}

export interface PersistedState {
  jobDescription: string;
  extractedKeywords: KeywordMatch[];
  selectedTechnologies: string[];
  questionCount: number;
  difficultyFilter: Difficulty | 'all';
  generatedQuestions: Question[];
  answers: Record<string, string>;
  results: AssessmentResult | null;
  currentQuestionIndex: number;
  generationCount: number;
  usedQuestionIds: string[];
  usedQuestionKeys: string[];
  completedAssessmentCount: number;
  cumulativeAssessmentScore: number;
}
