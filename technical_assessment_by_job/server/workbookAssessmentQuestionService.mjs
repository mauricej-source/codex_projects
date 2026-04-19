import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const WORKBOOK_DIRECTORIES = [
  path.resolve(process.cwd(), 'Questions'),
  path.resolve(process.cwd(), 'questions'),
];

const TECHNOLOGY_CATEGORIES = {
  java: 'Programming Languages',
  python: 'Programming Languages',
  javascript: 'Programming Languages',
  typescript: 'Programming Languages',
  react: 'Frontend',
  'node-js': 'Backend',
  sql: 'Databases',
  aws: 'Cloud',
  docker: 'DevOps',
  kubernetes: 'DevOps',
  git: 'DevOps',
  'rest-apis': 'Architecture / Design',
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[`'"().,:/\\#+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');

const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const findQuestionsDirectory = () =>
  WORKBOOK_DIRECTORIES.find((directory) => fs.existsSync(directory)) ??
  WORKBOOK_DIRECTORIES[0];

const getWorkbookTechnologyKey = (fileName) =>
  slugify(
    fileName
      .replace(/\.xlsx$/i, '')
      .replace(/_questions$/i, '')
      .replace(/ questions$/i, ''),
  );

const findWorkbookPathForTechnology = (technology) => {
  const directory = findQuestionsDirectory();
  if (!fs.existsSync(directory)) {
    return null;
  }

  const technologyKey = slugify(technology);
  const matchedFile = fs
    .readdirSync(directory)
    .find(
      (name) =>
        name.toLowerCase().endsWith('.xlsx') &&
        getWorkbookTechnologyKey(name) === technologyKey,
    );

  return matchedFile ? path.join(directory, matchedFile) : null;
};

const inferDifficulty = (section) => {
  const normalized = section.toLowerCase();

  if (normalized.includes('freshers') || normalized.includes('fundamentals')) {
    return 'easy';
  }

  if (normalized.includes('intermediate') || normalized.includes('string')) {
    return 'medium';
  }

  if (
    normalized.includes('experienced') ||
    normalized.includes('mcq') ||
    normalized.includes('programming') ||
    normalized.includes('array')
  ) {
    return 'hard';
  }

  return 'medium';
};

const getCellValue = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (`${value ?? ''}`.trim()) {
      return `${value}`.trim();
    }
  }

  return '';
};

const normalizeWorkbookRow = ({ row, technology }) => {
  const prompt = getCellValue(row, [
    'Question from Your Document',
    'Question Title',
    'Question',
    'Prompt',
  ]);
  const answer = getCellValue(row, ['Answer', 'Generated Answer', 'Correct Answer']);
  const sourceLabel = getCellValue(row, ['Source']);
  const sourceUrl = getCellValue(row, ['Source URL']);
  const section = getCellValue(row, ['Section']) || `${technology} Workbook`;
  const rowIdentifier = getCellValue(row, ['#', 'Question #']) || prompt;

  if (!prompt || !answer) {
    return null;
  }

  const sourceId =
    slugify(`${technology}-${rowIdentifier}-${prompt}`) || crypto.randomUUID();
  const normalizedTechnology = slugify(technology);

  return {
    id: crypto.randomUUID(),
    sourceId,
    dedupeKey: sourceId,
    technology,
    category: TECHNOLOGY_CATEGORIES[normalizedTechnology] ?? 'Other',
    difficulty: inferDifficulty(section),
    prompt,
    explanation: answer,
    correctAnswer: answer,
    sourceLabel: sourceLabel || `${technology} workbook`,
    sourceUrl,
    section,
  };
};

export class WorkbookAssessmentQuestionService {
  constructor() {
    this.cache = new Map();
  }

  isConfigured(selectedTechnologies = []) {
    const directory = findQuestionsDirectory();
    if (!fs.existsSync(directory)) {
      return false;
    }

    if (selectedTechnologies.length === 0) {
      return fs.readdirSync(directory).some((name) => name.toLowerCase().endsWith('.xlsx'));
    }

    return selectedTechnologies.every((technology) => Boolean(findWorkbookPathForTechnology(technology)));
  }

  loadWorkbookRowsForTechnology(technology) {
    const workbookPath = findWorkbookPathForTechnology(technology);
    if (!workbookPath) {
      throw new Error('Unable to Generate Assessment, No Seed File');
    }

    const stats = fs.statSync(workbookPath);
    const cacheKey = `${technology.toLowerCase()}::${workbookPath}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.rows;
    }

    const workbook = XLSX.readFile(workbookPath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils
      .sheet_to_json(worksheet, { defval: '' })
      .map((row) => normalizeWorkbookRow({ row, technology }))
      .filter(Boolean);

    this.cache.set(cacheKey, { mtimeMs: stats.mtimeMs, rows });
    return rows;
  }

  getDistractorPool({ rows, currentQuestion }) {
    const sameSection = rows.filter(
      (row) =>
        row.sourceId !== currentQuestion.sourceId &&
        row.section === currentQuestion.section &&
        row.correctAnswer !== currentQuestion.correctAnswer,
    );

    const sameSource = rows.filter(
      (row) =>
        row.sourceId !== currentQuestion.sourceId &&
        row.sourceLabel === currentQuestion.sourceLabel &&
        row.correctAnswer !== currentQuestion.correctAnswer,
    );

    const anyRow = rows.filter(
      (row) =>
        row.sourceId !== currentQuestion.sourceId &&
        row.correctAnswer !== currentQuestion.correctAnswer,
    );

    return [...sameSection, ...sameSource, ...anyRow];
  }

  buildChoices({ rows, currentQuestion }) {
    const distractorPool = this.getDistractorPool({ rows, currentQuestion });
    const distractors = [];
    const seenAnswers = new Set([currentQuestion.correctAnswer]);

    for (const row of shuffle(distractorPool)) {
      if (seenAnswers.has(row.correctAnswer)) {
        continue;
      }

      distractors.push(row.correctAnswer);
      seenAnswers.add(row.correctAnswer);

      if (distractors.length === 3) {
        break;
      }
    }

    if (distractors.length < 3) {
      return null;
    }

    return shuffle([currentQuestion.correctAnswer, ...distractors]);
  }

  generateQuestions({
    selectedTechnologies,
    questionCount,
    difficultyFilter,
    generationCount,
    usedQuestionKeys,
  }) {
    const workbookRows = selectedTechnologies.flatMap((technology) =>
      this.loadWorkbookRowsForTechnology(technology),
    );

    let eligibleRows = workbookRows.filter((row) =>
      selectedTechnologies.includes(row.technology),
    );

    if (difficultyFilter !== 'all') {
      eligibleRows = eligibleRows.filter((row) => row.difficulty === difficultyFilter);
    }

    if (generationCount < 20) {
      eligibleRows = eligibleRows.filter((row) => !usedQuestionKeys.includes(row.dedupeKey));
    }

    const selectedRows = shuffle(eligibleRows).slice(0, questionCount);

    return selectedRows
      .map((row) => {
        const choices = this.buildChoices({ rows: workbookRows, currentQuestion: row });
        if (!choices) {
          return null;
        }

        return {
          ...row,
          choices,
        };
      })
      .filter(Boolean);
  }
}
