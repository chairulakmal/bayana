// An in-memory stand-in for the Prisma client, for the `src/lib` characterization tests.
//
// **What it is for.** The tests in `src/lib` pin what the domain layer does today so the Nuxt
// port can be diffed against it (TODO.md). Most of that behaviour — queue ordering, the
// due/new split, level scoping, the review→undo cycle — only exists in relation to stored
// rows, so the tests need data. This supplies it without a database.
//
// **Why a fake rather than a throwaway Postgres.** Author's call, logged in DECISIONS.md. A
// real database would additionally test the SQL, which is the honest argument for it; against
// that, it makes `npm test` depend on Docker, and it pins queries that the migration is
// explicitly free to redesign (the data model is in scope for the port). What must survive the
// port is the *composition* — the ordering, the caps, the scoping — and that is what runs
// above the query layer, so that is what this fake exercises.
//
// **The property that makes it trustworthy: it fails loudly.** A fake that quietly ignores an
// argument it does not understand is worse than no test at all, because it turns a passing
// suite into evidence of nothing. Every operator, ordering and option below is implemented
// explicitly, and anything outside that set throws `unsupported(...)`. So if production code
// grows a query shape this does not model, the tests break and say exactly which one — they
// do not drift into asserting on made-up results.
//
// **The one cast.** Prisma's delegates are deeply generic, so this object cannot structurally
// satisfy `PrismaClient`. `makeFakeDb` therefore casts its return value once, at the boundary,
// and everything inside stays typed against the seed row types below. See `lib/deps.ts` for
// why the seam keeps Prisma's own types on the production side of that line.

import type { Deps } from "@/lib/deps";
import type { Prisma } from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------
//
// Deliberately loose (`Row = Record<string, unknown>`) rather than mirroring the generated
// Prisma model types. A test seeds only the columns the function under test reads, and
// requiring all ~14 FSRS columns on every `ReviewState` fixture would bury the two fields a
// given test is actually about. `makeRow` helpers in the test files supply realistic defaults.

export type Row = Record<string, unknown>;

/** The tables this fake knows about. Keys are the Prisma delegate names. */
export type Seed = Partial<Record<ModelName, Row[]>>;

export type ModelName =
  | "word"
  | "exampleSentence"
  | "reviewState"
  | "reviewLog"
  | "grammarPoint"
  | "grammarProgress"
  | "grammarReviewLog"
  | "userProfile";

const MODEL_NAMES: ModelName[] = [
  "word",
  "exampleSentence",
  "reviewState",
  "reviewLog",
  "grammarPoint",
  "grammarProgress",
  "grammarReviewLog",
  "userProfile",
];

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
//
// The schema knowledge this fake needs, and no more. `include: { word: … }` and
// `where: { reviews: { none: … } }` are both relation traversals, and without a map like this
// there is no way to resolve either. Each entry reads: on model M, the property `name` reaches
// rows of `model` where `their[foreignKey] === mine[localKey]`.

type Relation = {
  model: ModelName;
  /** "one" resolves to a row or null; "many" resolves to an array. */
  kind: "one" | "many";
  /** Field on *this* row holding the join value. */
  localKey: string;
  /** Field on the *related* row holding the join value. */
  foreignKey: string;
};

const RELATIONS: Partial<Record<ModelName, Record<string, Relation>>> = {
  word: {
    sentences: { model: "exampleSentence", kind: "many", localKey: "id", foreignKey: "wordId" },
    reviews: { model: "reviewState", kind: "many", localKey: "id", foreignKey: "wordId" },
  },
  reviewState: {
    word: { model: "word", kind: "one", localKey: "wordId", foreignKey: "id" },
  },
  reviewLog: {
    word: { model: "word", kind: "one", localKey: "wordId", foreignKey: "id" },
  },
  grammarPoint: {
    progress: {
      model: "grammarProgress",
      kind: "many",
      localKey: "id",
      foreignKey: "grammarPointId",
    },
  },
  grammarProgress: {
    grammarPoint: { model: "grammarPoint", kind: "one", localKey: "grammarPointId", foreignKey: "id" },
  },
  grammarReviewLog: {
    grammarPoint: { model: "grammarPoint", kind: "one", localKey: "grammarPointId", foreignKey: "id" },
  },
};

/**
 * Compound unique keys, as Prisma names them in a `where`. `findUnique({ where: {
 * userId_wordId: { userId, wordId } } })` has to expand to a two-field match, and the mapping
 * from the composite name to its parts is schema knowledge that cannot be derived.
 */
const COMPOUND_KEYS: Record<string, string[]> = {
  userId_wordId: ["userId", "wordId"],
  userId_grammarPointId: ["userId", "grammarPointId"],
};

// ---------------------------------------------------------------------------
// The failure mode this fake is built around
// ---------------------------------------------------------------------------

/** Thrown when production code uses a query feature this fake does not model. */
class UnsupportedQuery extends Error {
  constructor(what: string) {
    super(
      `fake-db: unsupported query feature: ${what}. ` +
        `The fake deliberately refuses to guess — implement it in src/lib/__fixtures__/fake-db.ts ` +
        `so the test keeps testing the real behaviour.`,
    );
    this.name = "UnsupportedQuery";
  }
}

function unsupported(what: string): never {
  throw new UnsupportedQuery(what);
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

const OPERATORS = new Set(["equals", "not", "in", "notIn", "lt", "lte", "gt", "gte"]);
const RELATION_OPERATORS = new Set(["some", "none", "every"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** Comparable primitive for `<`/`>`: Dates compare by epoch, everything else as-is. */
function cmpValue(v: unknown): number | string {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number" || typeof v === "string") return v;
  return unsupported(`comparison against ${typeof v}`);
}

function equalValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Apply one `{ lte: … }`-style operator object to a row's field value. */
function matchOperators(actual: unknown, spec: Record<string, unknown>): boolean {
  for (const [op, expected] of Object.entries(spec)) {
    switch (op) {
      case "equals":
        if (!equalValue(actual, expected)) return false;
        break;
      case "not":
        if (equalValue(actual, expected)) return false;
        break;
      case "in":
        if (!(expected as unknown[]).some((e) => equalValue(actual, e))) return false;
        break;
      case "notIn":
        if ((expected as unknown[]).some((e) => equalValue(actual, e))) return false;
        break;
      case "lt":
        if (!(cmpValue(actual) < cmpValue(expected))) return false;
        break;
      case "lte":
        if (!(cmpValue(actual) <= cmpValue(expected))) return false;
        break;
      case "gt":
        if (!(cmpValue(actual) > cmpValue(expected))) return false;
        break;
      case "gte":
        if (!(cmpValue(actual) >= cmpValue(expected))) return false;
        break;
      default:
        unsupported(`where operator "${op}"`);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

class Store {
  readonly tables: Record<ModelName, Row[]>;
  private counter = 0;

  constructor(seed: Seed) {
    this.tables = Object.fromEntries(
      // Copy each seeded row, so a test's fixture array is never mutated by a write.
      MODEL_NAMES.map((m) => [m, (seed[m] ?? []).map((r) => ({ ...r }))]),
    ) as Record<ModelName, Row[]>;
  }

  /** Deterministic ids for created rows, so an assertion can name one. */
  nextId(model: ModelName): string {
    this.counter += 1;
    return `${model}-${this.counter}`;
  }

  rows(model: ModelName): Row[] {
    return this.tables[model];
  }

  /** Does `row` of `model` satisfy `where`? Handles fields, operators and relation filters. */
  matches(model: ModelName, row: Row, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true;

    for (const [key, spec] of Object.entries(where)) {
      if (key === "AND" || key === "OR" || key === "NOT") unsupported(`where "${key}"`);

      // Compound unique key: expand to an AND over its parts.
      const parts = COMPOUND_KEYS[key];
      if (parts && isPlainObject(spec)) {
        for (const field of parts) {
          if (!equalValue(row[field], spec[field])) return false;
        }
        continue;
      }

      const relation = RELATIONS[model]?.[key];
      if (relation) {
        if (!isPlainObject(spec)) unsupported(`relation filter on "${key}" that is not an object`);
        const relOp = Object.keys(spec).find((k) => RELATION_OPERATORS.has(k));
        const related = this.related(model, row, relation);

        if (relOp) {
          const inner = spec[relOp] as Record<string, unknown>;
          const hits = related.filter((r) => this.matches(relation.model, r, inner));
          if (relOp === "none" && hits.length > 0) return false;
          if (relOp === "some" && hits.length === 0) return false;
          if (relOp === "every" && hits.length !== related.length) return false;
          continue;
        }

        // No operator: a to-one relation filter, e.g. `word: { level }`.
        if (relation.kind !== "one") unsupported(`to-many relation filter without some/none/every on "${key}"`);
        const one = related[0];
        if (!one || !this.matches(relation.model, one, spec)) return false;
        continue;
      }

      // Plain field.
      if (isPlainObject(spec)) {
        const keys = Object.keys(spec);
        if (!keys.every((k) => OPERATORS.has(k))) {
          unsupported(`where clause "${key}": ${JSON.stringify(keys)}`);
        }
        if (!matchOperators(row[key], spec)) return false;
        continue;
      }

      if (!equalValue(row[key], spec)) return false;
    }

    return true;
  }

  /** All rows on the far side of `relation` from `row`. */
  related(model: ModelName, row: Row, relation: Relation): Row[] {
    void model;
    const localValue = row[relation.localKey];
    return this.rows(relation.model).filter((r) => equalValue(r[relation.foreignKey], localValue));
  }

  /** Build the returned object for one row, honouring `select` / `include`. */
  project(model: ModelName, row: Row, args: Record<string, unknown>): Row {
    const select = args.select as Record<string, unknown> | undefined;
    const include = args.include as Record<string, unknown> | undefined;
    if (select && include) unsupported("select and include together");

    if (select) {
      const out: Row = {};
      for (const [field, wanted] of Object.entries(select)) {
        if (wanted !== true) unsupported(`nested select on "${field}"`);
        out[field] = row[field];
      }
      return out;
    }

    const out: Row = { ...row };
    if (include) {
      for (const [name, spec] of Object.entries(include)) {
        const relation = RELATIONS[model]?.[name];
        if (!relation) unsupported(`include of unknown relation "${name}" on ${model}`);
        let related = this.related(model, row, relation);
        if (isPlainObject(spec)) {
          if (typeof spec.take === "number") related = related.slice(0, spec.take);
          // A nested include (word → sentences) recurses through project().
          const nested = spec.include as Record<string, unknown> | undefined;
          if (nested) {
            related = related.map((r) => this.project(relation.model, r, { include: nested }));
          }
          const unknownKeys = Object.keys(spec).filter((k) => k !== "take" && k !== "include");
          if (unknownKeys.length) unsupported(`include options ${JSON.stringify(unknownKeys)}`);
        } else if (spec !== true) {
          unsupported(`include spec for "${name}"`);
        }
        out[name] = relation.kind === "one" ? (related[0] ?? null) : related;
      }
    }
    return out;
  }
}

/** Apply `orderBy` (a single spec or an array of them, evaluated in order). */
function applyOrderBy(rows: Row[], orderBy: unknown): Row[] {
  if (orderBy === undefined) return rows;
  const specs = (Array.isArray(orderBy) ? orderBy : [orderBy]) as Record<string, unknown>[];
  const terms: { field: string; dir: 1 | -1 }[] = [];
  for (const spec of specs) {
    for (const [field, dir] of Object.entries(spec)) {
      if (dir !== "asc" && dir !== "desc") unsupported(`orderBy direction "${String(dir)}"`);
      terms.push({ field, dir: dir === "asc" ? 1 : -1 });
    }
  }
  // Stable by construction: Array.prototype.sort is stable in every engine we target, so
  // equal rows keep insertion order — which is what Postgres does NOT guarantee. Tests that
  // care about ties must seed distinguishable values rather than rely on this.
  return [...rows].sort((a, b) => {
    for (const { field, dir } of terms) {
      const av = cmpValue(a[field]);
      const bv = cmpValue(b[field]);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
    }
    return 0;
  });
}

/** Keep the first row for each distinct combination of `fields`. */
function applyDistinct(rows: Row[], fields: string[]): Row[] {
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    const key = JSON.stringify(fields.map((f) => row[f]));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

const KNOWN_FIND_ARGS = new Set(["where", "orderBy", "take", "skip", "select", "include", "distinct"]);

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

export type FakeDb = {
  /** The live tables, for asserting on what a write actually persisted. */
  tables: Record<ModelName, Row[]>;
  /** Deps to hand to any seamed function in `src/lib`. */
  deps: Deps;
};

/**
 * Build an in-memory database from `seed` plus the `Deps` object that points `src/lib` at it.
 *
 * The returned `tables` are live: a test can rate a card through `reviewWord(…, fake.deps)`
 * and then assert on `fake.tables.reviewState`, which is the only way to check that a write
 * persisted the fields it claims to.
 *
 * `deps.serializableTxn` runs its callback immediately against this same store, with no
 * isolation and no retry. That is a real limitation and a deliberate one: this fake cannot
 * test the lost-update race the SERIALIZABLE level exists to prevent (that needs a real
 * database), only that the read-compute-write sequence inside the transaction is correct.
 */
export function makeFakeDb(seed: Seed = {}): FakeDb {
  const store = new Store(seed);

  function delegate(model: ModelName) {
    const rowsMatching = (args: Record<string, unknown>): Row[] => {
      const unknownArgs = Object.keys(args).filter((k) => !KNOWN_FIND_ARGS.has(k));
      if (unknownArgs.length) unsupported(`query args ${JSON.stringify(unknownArgs)}`);

      let rows = store.rows(model).filter((r) => store.matches(model, r, args.where as Record<string, unknown>));
      rows = applyOrderBy(rows, args.orderBy);
      if (args.distinct) rows = applyDistinct(rows, args.distinct as string[]);
      if (typeof args.skip === "number") rows = rows.slice(args.skip);
      if (typeof args.take === "number") rows = rows.slice(0, args.take);
      return rows;
    };

    return {
      findMany: async (args: Record<string, unknown> = {}) =>
        rowsMatching(args).map((r) => store.project(model, r, args)),

      findFirst: async (args: Record<string, unknown> = {}) => {
        const [row] = rowsMatching(args);
        return row ? store.project(model, row, args) : null;
      },

      findUnique: async (args: Record<string, unknown> = {}) => {
        const rows = rowsMatching(args);
        if (rows.length > 1) throw new Error(`fake-db: findUnique on ${model} matched ${rows.length} rows`);
        return rows[0] ? store.project(model, rows[0], args) : null;
      },

      count: async (args: Record<string, unknown> = {}) => rowsMatching(args).length,

      groupBy: async (args: Record<string, unknown> = {}) => {
        const by = args.by as string[] | undefined;
        if (!by) unsupported("groupBy without `by`");
        const extra = Object.keys(args).filter((k) => k !== "by" && k !== "where");
        if (extra.length) unsupported(`groupBy options ${JSON.stringify(extra)}`);
        const rows = store.rows(model).filter((r) => store.matches(model, r, args.where as Record<string, unknown>));
        return applyDistinct(rows, by).map((r) => Object.fromEntries(by.map((f) => [f, r[f]])));
      },

      create: async (args: { data: Row }) => {
        const row = { id: store.nextId(model), ...args.data };
        store.rows(model).push(row);
        return { ...row };
      },

      update: async (args: { where: Record<string, unknown>; data: Row }) => {
        const row = store.rows(model).find((r) => store.matches(model, r, args.where));
        if (!row) throw notFound(model);
        Object.assign(row, args.data);
        return { ...row };
      },

      upsert: async (args: { where: Record<string, unknown>; create: Row; update: Row }) => {
        const row = store.rows(model).find((r) => store.matches(model, r, args.where));
        if (row) {
          Object.assign(row, args.update);
          return { ...row };
        }
        const created = { id: store.nextId(model), ...args.create };
        store.rows(model).push(created);
        return { ...created };
      },

      delete: async (args: { where: Record<string, unknown> }) => {
        const table = store.rows(model);
        const index = table.findIndex((r) => store.matches(model, r, args.where));
        if (index === -1) throw notFound(model);
        const [removed] = table.splice(index, 1);
        return { ...removed };
      },

      deleteMany: async (args: { where?: Record<string, unknown> } = {}) => {
        const table = store.rows(model);
        const keep = table.filter((r) => !store.matches(model, r, args.where));
        const count = table.length - keep.length;
        table.length = 0;
        table.push(...keep);
        return { count };
      },
    };
  }

  const client = Object.fromEntries(MODEL_NAMES.map((m) => [m, delegate(m)]));

  const deps: Deps = {
    // The one cast, explained in the file header: Prisma's generic delegates cannot be
    // satisfied structurally by a hand-written object.
    db: client as unknown as Deps["db"],
    // No isolation, no retry — just run it, handed the same store the non-transactional
    // delegates use. See the note on `makeFakeDb` for what that cannot test.
    serializableTxn: async (fn) => fn(client as unknown as Prisma.TransactionClient),
  };

  return { tables: store.tables, deps };
}

/**
 * Stands in for Prisma's P2025. `undoLastReview` catches that code specifically and maps it to
 * "nothing to undo", so the fake has to produce something recognisable — but deliberately not
 * a real `PrismaClientKnownRequestError`, since a test asserting on that path should be
 * explicit about simulating it rather than getting it by accident from a missing fixture.
 */
function notFound(model: ModelName): Error {
  const err = new Error(`fake-db: no ${model} row matched`);
  err.name = "FakeDbRecordNotFound";
  return err;
}
