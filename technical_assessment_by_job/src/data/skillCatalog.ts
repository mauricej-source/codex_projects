import type { TechnologyCategory } from '../types';

type KeywordDictionary = Record<string, string[]>;

export const CATEGORY_ORDER: TechnologyCategory[] = [
  'Programming Languages',
  'Frontend',
  'Backend',
  'Databases',
  'Cloud',
  'DevOps',
  'Testing',
  'Data Engineering / Analytics',
  'Security',
  'Architecture / Design',
  'Agile / Process',
  'Other',
];

// Source dictionary adapted from the provided extractor and kept centralized for extension.
export const TECH_DICTIONARY: KeywordDictionary = {
  'Programming Languages': [
    'java',
    'python',
    'javascript',
    'typescript',
    'c#',
    'go',
    'ruby',
  ],
  'Frameworks & Libraries': [
    'spring boot',
    'react',
    'angular',
    'vue',
    'node.js',
    'express',
  ],
  'Build Tools': ['maven', 'gradle'],
  Cloud: ['aws', 'azure', 'gcp'],
  'Infrastructure & IaC': [
    'terraform',
    'cloudformation',
    'infrastructure as a service',
    'iaas',
  ],
  'Containers & Orchestration': [
    'docker',
    'kubernetes',
    'containerization',
    'containers',
  ],
  'CI/CD & DevOps': [
    'ci/cd',
    'jenkins',
    'github actions',
    'bamboo',
    'deployment automation',
  ],
  Databases: ['sql', 'nosql', 'database', 'database systems', 'performance optimization'],
  'Architecture & Design': [
    'api-first',
    'microservices',
    'system design',
    'software design patterns',
    'distributed systems',
    'scalable systems',
  ],
  Methodologies: ['agile', 'scrum'],
};

export const DISPLAY_LABELS: Record<string, string> = {
  java: 'Java',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  'c#': 'C#',
  go: 'Go',
  ruby: 'Ruby',
  'spring boot': 'Spring Boot',
  react: 'React',
  angular: 'Angular',
  vue: 'Vue',
  'node.js': 'Node.js',
  express: 'Express',
  maven: 'Maven',
  gradle: 'Gradle',
  aws: 'AWS',
  azure: 'Azure',
  gcp: 'GCP',
  terraform: 'Terraform',
  cloudformation: 'CloudFormation',
  'infrastructure as a service': 'Infrastructure as a Service',
  iaas: 'IaaS',
  docker: 'Docker',
  kubernetes: 'Kubernetes',
  containerization: 'Containerization',
  containers: 'Containers',
  'ci/cd': 'CI/CD',
  jenkins: 'Jenkins',
  'github actions': 'GitHub Actions',
  bamboo: 'Bamboo',
  'deployment automation': 'Deployment Automation',
  sql: 'SQL',
  nosql: 'NoSQL',
  database: 'Database',
  'database systems': 'Database Systems',
  'performance optimization': 'Performance Optimization',
  'api-first': 'API-First',
  microservices: 'Microservices',
  'system design': 'System Design',
  'software design patterns': 'Software Design Patterns',
  'distributed systems': 'Distributed Systems',
  'scalable systems': 'Scalable Systems',
  agile: 'Agile',
  scrum: 'Scrum',
};

const UI_CATEGORY_MAPPING: Record<string, TechnologyCategory> = {
  'Programming Languages': 'Programming Languages',
  'Frameworks & Libraries': 'Frontend',
  'Build Tools': 'Backend',
  Cloud: 'Cloud',
  'Infrastructure & IaC': 'DevOps',
  'Containers & Orchestration': 'DevOps',
  'CI/CD & DevOps': 'DevOps',
  Databases: 'Databases',
  'Architecture & Design': 'Architecture / Design',
  Methodologies: 'Agile / Process',
};

const OVERRIDE_CATEGORY_MAPPING: Record<string, TechnologyCategory> = {
  'spring boot': 'Backend',
  'node.js': 'Backend',
  express: 'Backend',
  react: 'Frontend',
  angular: 'Frontend',
  vue: 'Frontend',
};

export const normalizeText = (text: string) => text.toLowerCase();

export const getKeywordDisplayLabel = (keyword: string) =>
  DISPLAY_LABELS[keyword] ?? keyword.replace(/\b\w/g, (match) => match.toUpperCase());

export const mapSourceCategoryToUiCategory = (
  sourceCategory: string,
  keyword: string,
): TechnologyCategory =>
  OVERRIDE_CATEGORY_MAPPING[keyword] ??
  UI_CATEGORY_MAPPING[sourceCategory] ??
  'Other';

export const getDefaultSelectedTechnologies = (keywords: string[]) =>
  keywords
    .map((keyword) => getKeywordDisplayLabel(keyword))
    .filter((keyword, index, items) => items.indexOf(keyword) === index)
    .slice(0, 5);

export const getTechnologyCategory = (technology: string): TechnologyCategory => {
  const normalizedTechnology = technology.toLowerCase();

  for (const [sourceCategory, keywords] of Object.entries(TECH_DICTIONARY)) {
    const matchedKeyword = keywords.find(
      (keyword) => getKeywordDisplayLabel(keyword).toLowerCase() === normalizedTechnology,
    );

    if (matchedKeyword) {
      return mapSourceCategoryToUiCategory(sourceCategory, matchedKeyword);
    }
  }

  return 'Other';
};
