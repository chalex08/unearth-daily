// Daily puzzle file format (content/puzzles/*.json) and its validator. SPEC §2, §5.1.

export type Commonness = 'common' | 'uncommon' | 'rare';

export type AnswerEntry = {
  canonical: string;
  aliases: string[];
  commonness: Commonness;
};

export type Layer = {
  clue: string;
  /** Every answer valid for clues 1..N. */
  pool: AnswerEntry[];
};

export type Puzzle = {
  number: number;
  /** UTC day key, YYYY-MM-DD. */
  date: string;
  layers: Layer[];
};

export const LAYER_COUNT = 10;

const COMMONNESS: readonly unknown[] = ['common', 'uncommon', 'rare'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '';

/** Returns every problem found; an empty list means `data` is a valid Puzzle. */
export function validatePuzzle(data: unknown): string[] {
  if (!isObject(data)) return ['puzzle must be an object'];
  const errors: string[] = [];
  if (!Number.isInteger(data.number) || (data.number as number) < 1)
    errors.push('number must be a positive integer');
  if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date))
    errors.push('date must be YYYY-MM-DD');
  if (!Array.isArray(data.layers) || data.layers.length !== LAYER_COUNT)
    return [...errors, `layers must be an array of ${LAYER_COUNT}`];

  let previous: Set<string> | null = null;
  data.layers.forEach((layer: unknown, i) => {
    const at = `layer ${i + 1}`;
    if (!isObject(layer)) return errors.push(`${at} must be an object`);
    if (!isText(layer.clue)) errors.push(`${at} clue is required`);
    if (!Array.isArray(layer.pool) || layer.pool.length === 0)
      return errors.push(`${at} pool must be a non-empty array`);

    const canonicals = new Set<string>();
    const keys = new Set<string>(); // canonicals and aliases, normalised: each must map to one entry
    layer.pool.forEach((entry: unknown, j) => {
      const where = `${at} pool[${j}]`;
      if (!isObject(entry)) return errors.push(`${where} must be an object`);
      if (!isText(entry.canonical))
        return errors.push(`${where} canonical is required`);
      if (!Array.isArray(entry.aliases) || !entry.aliases.every(isText))
        errors.push(`${where} aliases must be an array of strings`);
      if (!COMMONNESS.includes(entry.commonness))
        errors.push(`${where} commonness must be common, uncommon or rare`);

      const canonical = normalise(entry.canonical);
      if (canonicals.has(canonical))
        return errors.push(`${at} duplicate canonical "${entry.canonical}"`);
      canonicals.add(canonical);
      const aliases: unknown[] = Array.isArray(entry.aliases)
        ? entry.aliases
        : [];
      for (const key of new Set(
        [entry.canonical, ...aliases.filter(isText)].map(normalise)
      )) {
        if (keys.has(key))
          errors.push(`${at} "${key}" matches more than one answer`);
        keys.add(key);
      }
    });

    if (previous) {
      for (const c of canonicals)
        if (!previous.has(c))
          errors.push(`${at} "${c}" is missing from layer ${i}`);
    }
    if (i === LAYER_COUNT - 1 && layer.pool.length !== 1)
      errors.push(`${at} must have exactly one answer`);
    previous = canonicals;
  });
  return errors;
}

/** SPEC §4 step 1: lowercase, strip punctuation, collapse whitespace, trim. */
export function normalise(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** SPEC §4 step 4: the pool entry whose canonical or alias matches the normalised answer. */
export function matchAnswer(
  pool: AnswerEntry[],
  answer: string
): AnswerEntry | null {
  return (
    pool.find((e) =>
      [e.canonical, ...e.aliases].some((k) => normalise(k) === answer)
    ) ?? null
  );
}
