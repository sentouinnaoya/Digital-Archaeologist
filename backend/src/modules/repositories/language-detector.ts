const LANGUAGE_EXTENSIONS: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  java: 'Java',
  kt: 'Kotlin',
  py: 'Python',
  go: 'Go',
  rs: 'Rust',
  rb: 'Ruby',
  php: 'PHP',
  cs: 'C#',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  hpp: 'C++',
  swift: 'Swift',
  scala: 'Scala',
  sh: 'Shell',
  sql: 'SQL',
  json: 'JSON',
  yml: 'YAML',
  yaml: 'YAML',
  md: 'Markdown',
  html: 'HTML',
  css: 'CSS',
};

export function languageForPath(path: string): string | null {
  const file = path.split(/[\\/]/).pop() ?? '';
  const extension = file.includes('.') ? file.split('.').pop()?.toLowerCase() ?? '' : '';
  return LANGUAGE_EXTENSIONS[extension] ?? null;
}

export function detectLanguagesFromPaths(paths: string[]): string[] {
  const counts = new Map<string, number>();
  for (const path of paths) {
    const language = languageForPath(path);
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([language]) => language);
}
