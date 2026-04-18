import { CATEGORY_ORDER, getTechnologyCategory } from '../data/skillCatalog';
import { assessmentQuestionService } from '../services/assessmentQuestionService';
import type { Difficulty, Question, TechnologyCategory } from '../types';
import { buildQuestionDedupeKey, ensureQuestionIdentity } from './questionIdentity';

const shuffle = <T,>(items: T[]) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const dedupeQuestions = (questions: Question[]) => {
  const seen = new Set<string>();

  return questions
    .map(ensureQuestionIdentity)
    .filter((question) => {
      const dedupeKey = buildQuestionDedupeKey({
        technology: question.technology,
        sourceId: question.sourceId,
        dedupeKey: question.dedupeKey,
        prompt: question.prompt,
      });

      if (seen.has(dedupeKey)) {
        return false;
      }

      seen.add(dedupeKey);
      return true;
    });
};

export const generateAssessmentQuestions = async ({
  jobDescription,
  selectedTechnologies,
  questionCount,
  difficultyFilter,
  generationCount,
  usedQuestionKeys,
}: {
  jobDescription: string;
  selectedTechnologies: string[];
  questionCount: number;
  difficultyFilter: Difficulty | 'all';
  generationCount: number;
  usedQuestionKeys: string[];
}) => {
  const workbookQuestions = await assessmentQuestionService.generateQuestions({
    jobDescription,
    selectedTechnologies,
    questionCount,
    difficultyFilter,
    generationCount,
    usedQuestionKeys,
  });
  const uniqueWorkbookQuestions = dedupeQuestions(workbookQuestions);

  if (uniqueWorkbookQuestions.length === 0) {
    throw new Error(
      'No workbook-backed questions were available for the selected technologies and difficulty. Adjust the filters and try again.',
    );
  }

  if (uniqueWorkbookQuestions.length < questionCount) {
    throw new Error(
      generationCount < 20
        ? `Only ${uniqueWorkbookQuestions.length} unique workbook questions remain for the selected technologies before repeats are allowed on assessment 21. Add more workbook questions, lower the count, or change the selected technologies.`
        : `Only ${uniqueWorkbookQuestions.length} workbook questions are available for the selected technologies and difficulty. Reduce the requested count or change the filters.`,
    );
  }

  return shuffle(uniqueWorkbookQuestions).slice(0, questionCount);
};

const getCategoryForTechnology = (technology: string): TechnologyCategory => {
  return getTechnologyCategory(technology);
};

export const calculateResults = ({
  questions,
  answers,
  passThreshold = 70,
}: {
  questions: Question[];
  answers: Record<string, string>;
  passThreshold?: number;
}) => {
  const correctCount = questions.filter(
    (question) => answers[question.id] === question.correctAnswer,
  ).length;
  const total = questions.length;
  const percentage = total === 0 ? 0 : Math.round((correctCount / total) * 100);

  const categoryBreakdown = CATEGORY_ORDER.map((category) => {
    const matchingQuestions = questions.filter((question) => question.category === category);
    if (matchingQuestions.length === 0) {
      return null;
    }

    return {
      label: category,
      total: matchingQuestions.length,
      correct: matchingQuestions.filter(
        (question) => answers[question.id] === question.correctAnswer,
      ).length,
    };
  }).filter(Boolean) as Array<{ label: string; total: number; correct: number }>;

  const recommendedFocusAreas = categoryBreakdown
    .filter((item) => item.correct / item.total < 0.7)
    .sort((left, right) => left.correct / left.total - right.correct / right.total)
    .map((item) => item.label);

  return {
    correctCount,
    total,
    percentage,
    passed: percentage >= passThreshold,
    categoryBreakdown,
    recommendedFocusAreas,
  };
};

export const getAssessmentMeta = (questions: Question[]) => {
  const technologySummary = new Map<string, number>();

  for (const question of questions) {
    technologySummary.set(
      question.technology,
      (technologySummary.get(question.technology) ?? 0) + 1,
    );
  }

  return Array.from(technologySummary.entries()).map(([technology, count]) => ({
    technology,
    count,
    category: getCategoryForTechnology(technology),
  }));
};
