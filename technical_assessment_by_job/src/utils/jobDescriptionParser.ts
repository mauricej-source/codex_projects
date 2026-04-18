import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import {
  CATEGORY_ORDER,
  TECH_DICTIONARY,
  getKeywordDisplayLabel,
  mapSourceCategoryToUiCategory,
  normalizeText,
} from '../data/skillCatalog';
import type { KeywordMatch, TechnologyCategory } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'that',
  'this',
  'from',
  'will',
  'have',
  'your',
  'about',
  'years',
  'experience',
  'strong',
  'ability',
  'team',
  'teams',
  'work',
  'role',
  'responsibilities',
  'preferred',
  'excellent',
  'skills',
  'business',
  'stakeholders',
  'communication',
  'requirements',
  'collaboration',
]);

const cleanText = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/[^\w+#./ -]/g, ' ')
    .trim();

export const parseUploadedFile = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return cleanText(await file.text());
  }

  if (extension === 'pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const page = await pdf.getPage(index + 1);
        const text = await page.getTextContent();
        return text.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ');
      }),
    );

    return cleanText(pages.join('\n'));
  }

  if (extension === 'docx') {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return cleanText(result.value);
  }

  throw new Error('Unsupported file type. Please upload a TXT, PDF, or DOCX file.');
};

export const extractTechnicalKeywords = (jobDescription: string): KeywordMatch[] => {
  const normalizedDescription = normalizeText(jobDescription);
  const found = new Map<string, KeywordMatch>();

  for (const [sourceCategory, keywords] of Object.entries(TECH_DICTIONARY)) {
    for (const keyword of keywords) {
      if (STOP_WORDS.has(keyword)) {
        continue;
      }

      const pattern = createKeywordPattern(keyword);
      if (pattern.test(normalizedDescription)) {
        const displayKeyword = getKeywordDisplayLabel(keyword);
        found.set(displayKeyword, {
          keyword: displayKeyword,
          category: mapSourceCategoryToUiCategory(sourceCategory, keyword),
        });
      }
    }
  }

  return Array.from(found.values()).sort((left, right) => {
    const categoryOrder =
      CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category);
    return categoryOrder !== 0
      ? categoryOrder
      : left.keyword.localeCompare(right.keyword);
  });
};

export const groupKeywordsByCategory = (keywords: KeywordMatch[]) => {
  const grouped = CATEGORY_ORDER.reduce<Record<TechnologyCategory, string[]>>((acc, category) => {
    acc[category] = keywords
      .filter((keyword) => keyword.category === category)
      .map((keyword) => keyword.keyword);
    return acc;
  }, {} as Record<TechnologyCategory, string[]>);

  if (grouped.Databases.length > 0 && !grouped.Databases.includes('SQL')) {
    grouped.Databases = [...grouped.Databases, 'SQL'];
  }

  if (grouped.DevOps.length > 0 && !grouped.DevOps.includes('Git')) {
    grouped.DevOps = [...grouped.DevOps, 'Git'];
  }

  return grouped;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createKeywordPattern(keyword: string) {
  return new RegExp(`(^|[^\\w+#])${escapeRegExp(keyword)}(?=[^\\w+#]|$)`, 'i');
}
