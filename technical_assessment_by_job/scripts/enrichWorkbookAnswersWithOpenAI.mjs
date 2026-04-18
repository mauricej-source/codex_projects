import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const QUESTION_DIRECTORIES = [
  path.join(PROJECT_ROOT, 'Questions'),
  path.join(PROJECT_ROOT, 'questions'),
];
const DEFAULT_WORKBOOK_NAME = 'java_questions.xlsx';
const MODEL = process.env.GEMINI_QUESTION_MODEL || 'gemini-2.5-flash';
const BATCH_SIZE = 12;

const getWorkbookPath = () => {
  for (const directory of QUESTION_DIRECTORIES) {
    if (!fs.existsSync(directory)) {
      continue;
    }

    const explicitPath = path.join(directory, DEFAULT_WORKBOOK_NAME);
    if (fs.existsSync(explicitPath)) {
      return explicitPath;
    }

    const matchedFile = fs
      .readdirSync(directory)
      .find((name) => name.toLowerCase().startsWith('java_') && name.toLowerCase().endsWith('.xlsx'));

    if (matchedFile) {
      return path.join(directory, matchedFile);
    }
  }

  throw new Error(
    `Unable to find a Java workbook in ${QUESTION_DIRECTORIES.join(' or ')}.`,
  );
};

const buildSchema = (batch) => ({
  type: 'object',
  properties: {
    answers: {
      type: 'array',
      minItems: batch.length,
      maxItems: batch.length,
      items: {
        type: 'object',
        properties: {
          rowNumber: {
            type: 'integer',
            enum: batch.map((item) => item.rowNumber),
          },
          answer: {
            type: 'string',
          },
        },
        required: ['rowNumber', 'answer'],
        additionalProperties: false,
      },
    },
  },
  required: ['answers'],
  additionalProperties: false,
});

const buildMessages = (batch) => {
  const system = [
    'You write accurate Java interview answers for a vetted workbook.',
    'Return concise but specific answers.',
    'Do not use filler phrases such as "This question is best answered by".',
    'Each answer must be technically correct and directly answer the question.',
    'For conceptual questions, answer in 3 to 6 sentences.',
    'For programming questions, describe the approach, important data structures, and key complexity points without dumping a full code listing.',
    'If a question references missing code or output snippets, answer with the most likely interview explanation and state the reasoning clearly.',
  ].join(' ');

  const user = [
    'Generate one answer for each workbook row below.',
    'Use the section name as context.',
    'Return JSON only.',
    '',
    ...batch.map(
      (item) =>
        `rowNumber=${item.rowNumber}\nsection=${item.section}\nquestion=${item.question}`,
    ),
  ].join('\n\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const main = async () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const workbookPath = getWorkbookPath();
  const workbook = XLSX.readFile(workbookPath);
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const candidateRows = rows
    .map((row, index) => ({
      rowIndex: index,
      rowNumber: index + 2,
      question: `${row['Question Title'] ?? ''}`.trim(),
      section: `${row.Section ?? ''}`.trim(),
    }))
    .filter((row) => row.question);

  const client = new GoogleGenAI({ apiKey });
  const answerMap = new Map();

  for (const batch of chunk(candidateRows, BATCH_SIZE)) {
    const response = await client.models.generateContent({
      model: MODEL,
      contents: buildMessages(batch)
        .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
        .join('\n\n'),
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseJsonSchema: buildSchema(batch),
      },
    });

    const content = response.text;
    if (!content) {
      throw new Error(
        `The Gemini response for workbook rows ${batch[0].rowNumber}-${batch[batch.length - 1].rowNumber} was empty.`,
      );
    }

    const parsed = JSON.parse(content);
    for (const item of parsed.answers ?? []) {
      answerMap.set(item.rowNumber, `${item.answer ?? ''}`.trim());
    }
  }

  for (const row of rows) {
    const rowNumber = Number(row['Question #']) + 1;
    const generatedAnswer = answerMap.get(rowNumber);
    if (!generatedAnswer) {
      continue;
    }

    row['Generated Answer'] = generatedAnswer;
    row['Answer Type'] = 'Gemini-generated answer';
  }

  const refreshedWorksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Question #',
      'Section',
      'Question Title',
      'Generated Answer',
      'Answer Type',
      'Source',
      'Source URL',
      'Capture Note',
    ],
  });

  workbook.Sheets[firstSheetName] = refreshedWorksheet;
  XLSX.writeFile(workbook, workbookPath);

  console.log(
    JSON.stringify(
      {
        workbookPath,
        updatedRows: answerMap.size,
        model: MODEL,
        provider: 'gemini',
      },
      null,
      2,
    ),
  );
};

await main();
