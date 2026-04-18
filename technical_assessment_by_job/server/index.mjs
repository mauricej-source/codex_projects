import express from 'express';
import { WorkbookAssessmentQuestionService } from './workbookAssessmentQuestionService.mjs';

const PORT = Number(process.env.QUESTION_API_PORT || 4176);

const app = express();
const workbookQuestionService = new WorkbookAssessmentQuestionService();

app.use(express.json({ limit: '1mb' }));

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  next();
});

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    providerMode: 'workbook',
    workbookConfigured: workbookQuestionService.isConfigured(),
  });
});

app.post('/api/generate-questions', async (request, response) => {
  const {
    jobDescription,
    selectedTechnologies,
    questionCount,
    difficultyFilter,
    generationCount,
    usedQuestionKeys,
  } = request.body ?? {};

  if (!jobDescription || typeof jobDescription !== 'string') {
    response.status(400).json({ error: 'A job description is required.' });
    return;
  }

  if (!Array.isArray(selectedTechnologies) || selectedTechnologies.length === 0) {
    response.status(400).json({ error: 'Select at least one technology.' });
    return;
  }

  if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 30) {
    response.status(400).json({ error: 'Question count must be between 1 and 30.' });
    return;
  }

  if (!['all', 'easy', 'medium', 'hard'].includes(difficultyFilter)) {
    response.status(400).json({ error: 'Difficulty filter is invalid.' });
    return;
  }

  if (!workbookQuestionService.isConfigured()) {
    response.status(503).json({
      error: 'The workbook-backed question source is not available.',
    });
    return;
  }

  try {
    const questions = workbookQuestionService.generateQuestions({
      selectedTechnologies,
      questionCount,
      difficultyFilter,
      generationCount: Number(generationCount) || 0,
      usedQuestionKeys: Array.isArray(usedQuestionKeys) ? usedQuestionKeys : [],
    });

    response.json({
      source: 'workbook',
      questions,
    });
  } catch (error) {
    response.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : 'The workbook question service failed to generate questions.',
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `Question API listening on http://localhost:${PORT} (mode=workbook, workbookConfigured=${workbookQuestionService.isConfigured()})`,
  );
});
