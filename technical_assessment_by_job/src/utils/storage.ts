import type { PersistedState } from '../types';
import { ensureQuestionIdentity } from './questionIdentity';

const STORAGE_KEY = 'technical-assessment-by-job-state';

const normalizePersistedState = (state: PersistedState): PersistedState => ({
  ...state,
  generatedQuestions: (state.generatedQuestions ?? []).map(ensureQuestionIdentity),
  usedQuestionIds: state.usedQuestionIds ?? [],
  usedQuestionKeys: state.usedQuestionKeys ?? [],
  completedAssessmentCount: state.completedAssessmentCount ?? 0,
  cumulativeAssessmentScore: state.cumulativeAssessmentScore ?? 0,
});

export const loadPersistedState = (): PersistedState | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizePersistedState(JSON.parse(raw) as PersistedState);
  } catch {
    return null;
  }
};

export const savePersistedState = (state: PersistedState) => {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizePersistedState(state)));
};

export const clearPersistedState = () => {
  window.localStorage.removeItem(STORAGE_KEY);
};
