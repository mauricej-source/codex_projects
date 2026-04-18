import type { Question } from '../types';

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[`'"().,:/\\#+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-');

export const buildQuestionDedupeKey = (input: {
  technology: string;
  sourceId?: string;
  dedupeKey?: string;
  prompt: string;
}) => {
  if (input.dedupeKey?.trim()) {
    return slugify(`${input.technology}-${input.dedupeKey}`);
  }

  if (input.sourceId?.trim()) {
    return slugify(`${input.technology}-${input.sourceId}`);
  }

  return slugify(`${input.technology}-${input.prompt}`);
};

export const ensureQuestionIdentity = (question: Question): Question => ({
  ...question,
  dedupeKey: buildQuestionDedupeKey({
    technology: question.technology,
    sourceId: question.sourceId,
    dedupeKey: question.dedupeKey,
    prompt: question.prompt,
  }),
});
