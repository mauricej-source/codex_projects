import crypto from 'node:crypto';
import OpenAI from 'openai';

const TECHNOLOGY_CATEGORIES = {
  JavaScript: 'Programming Languages',
  TypeScript: 'Programming Languages',
  Python: 'Programming Languages',
  Java: 'Programming Languages',
  React: 'Frontend',
  'Node.js': 'Backend',
  SQL: 'Databases',
  AWS: 'Cloud',
  Docker: 'DevOps',
  Kubernetes: 'DevOps',
  Git: 'DevOps',
  'REST APIs': 'Architecture / Design',
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[`'"().,:/\\#+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');

const getQuestionSchema = (questionCount, selectedTechnologies) => ({
  name: 'technical_assessment_questions',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      questions: {
        type: 'array',
        minItems: questionCount,
        maxItems: questionCount + 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceId: { type: 'string' },
            dedupeKey: { type: 'string' },
            technology: {
              type: 'string',
              enum: selectedTechnologies,
            },
            difficulty: {
              type: 'string',
              enum: ['easy', 'medium', 'hard'],
            },
            prompt: { type: 'string' },
            choices: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: { type: 'string' },
            },
            correctAnswer: { type: 'string' },
            explanation: { type: 'string' },
          },
          required: [
            'sourceId',
            'dedupeKey',
            'technology',
            'difficulty',
            'prompt',
            'choices',
            'correctAnswer',
            'explanation',
          ],
        },
      },
    },
    required: ['questions'],
  },
});

const buildSystemPrompt = ({
  difficultyFilter,
  selectedTechnologies,
  questionCount,
  excludedDedupeKeys,
}) => {
  const difficultyInstruction =
    difficultyFilter === 'all'
      ? 'Return a practical mix of easy, medium, and hard questions.'
      : `Every question must have difficulty "${difficultyFilter}".`;

  return [
    'You generate polished multiple-choice technical interview questions.',
    `Generate ${questionCount} distinct questions covering only these technologies: ${selectedTechnologies.join(', ')}.`,
    difficultyInstruction,
    'Each question must have exactly 4 answer choices and exactly 1 correct answer.',
    'Do not use filler intros such as "In a technical interview" or "For a technical screening".',
    'Questions must be realistic, specific, and suitable for technical screening.',
    'Every dedupeKey must represent the underlying concept, not the wording of the prompt.',
    'Do not repeat or paraphrase the same concept within the response.',
    excludedDedupeKeys.length > 0
      ? `Do not generate any of these concepts again: ${excludedDedupeKeys.join(', ')}.`
      : 'No previously used concepts were supplied.',
  ].join(' ');
};

const buildUserPrompt = ({
  jobDescription,
  selectedTechnologies,
  questionCount,
  difficultyFilter,
}) => [
  `Job description context:\n${jobDescription.trim()}`,
  '',
  `Selected technologies: ${selectedTechnologies.join(', ')}`,
  `Requested question count: ${questionCount}`,
  `Difficulty filter: ${difficultyFilter}`,
  '',
  'Return only distinct technical questions grounded in the role context when relevant.',
].join('\n');

const normalizeQuestion = (question) => {
  const choices = Array.from(
    new Set((question.choices ?? []).map((choice) => choice.trim()).filter(Boolean)),
  );

  if (choices.length !== 4) {
    return null;
  }

  const correctAnswer = question.correctAnswer?.trim();
  if (!correctAnswer || !choices.includes(correctAnswer)) {
    return null;
  }

  const technology = question.technology?.trim();
  if (!technology) {
    return null;
  }

  const prompt = question.prompt?.trim();
  const explanation = question.explanation?.trim();
  if (!prompt || !explanation) {
    return null;
  }

  const dedupeKey = slugify(question.dedupeKey || `${technology}-${question.sourceId || prompt}`);
  const sourceId = slugify(question.sourceId || `${technology}-${dedupeKey}`);

  return {
    id: crypto.randomUUID(),
    sourceId,
    dedupeKey,
    technology,
    category: TECHNOLOGY_CATEGORIES[technology] ?? 'Other',
    difficulty: question.difficulty,
    prompt,
    choices,
    correctAnswer,
    explanation,
  };
};

export class OpenAiAssessmentQuestionService {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.OPENAI_QUESTION_MODEL || 'gpt-5-mini',
  } = {}) {
    this.model = model;
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async requestBatch({
    jobDescription,
    selectedTechnologies,
    questionCount,
    difficultyFilter,
    excludedDedupeKeys,
  }) {
    if (!this.client) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt({
            difficultyFilter,
            selectedTechnologies,
            questionCount,
            excludedDedupeKeys,
          }),
        },
        {
          role: 'user',
          content: buildUserPrompt({
            jobDescription,
            selectedTechnologies,
            questionCount,
            difficultyFilter,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: getQuestionSchema(questionCount, selectedTechnologies),
      },
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return [];
    }

    const parsed = JSON.parse(rawContent);
    return Array.isArray(parsed.questions)
      ? parsed.questions.map(normalizeQuestion).filter(Boolean)
      : [];
  }

  async generateQuestions(input) {
    const selectedQuestions = [];
    const excludedDedupeKeys = new Set(input.generationCount < 20 ? input.usedQuestionKeys : []);
    let attempts = 0;

    while (selectedQuestions.length < input.questionCount && attempts < 3) {
      const remaining = input.questionCount - selectedQuestions.length;
      const batch = await this.requestBatch({
        jobDescription: input.jobDescription,
        selectedTechnologies: input.selectedTechnologies,
        questionCount: Math.min(input.questionCount + 2, remaining + 2),
        difficultyFilter: input.difficultyFilter,
        excludedDedupeKeys: Array.from(excludedDedupeKeys),
      });

      for (const question of batch) {
        if (!question || excludedDedupeKeys.has(question.dedupeKey)) {
          continue;
        }

        excludedDedupeKeys.add(question.dedupeKey);
        selectedQuestions.push(question);

        if (selectedQuestions.length >= input.questionCount) {
          break;
        }
      }

      attempts += 1;
    }

    if (selectedQuestions.length < input.questionCount) {
      throw new Error(
        `The OpenAI question service returned only ${selectedQuestions.length} distinct questions for this request.`,
      );
    }

    return selectedQuestions.slice(0, input.questionCount);
  }
}
