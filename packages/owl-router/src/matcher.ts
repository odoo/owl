// -----------------------------------------------------------------------------
// createMatcher
// -----------------------------------------------------------------------------
//
// Pattern-matching codec helper. Compiles route patterns like
//
//     "/pos/{configId:int}/orders/{orderId:int}"
//
// into a `RouterCodec<MatchedRoute>` whose state is `{ name, params }`. Each
// param spec uses `{name:type}` syntax with two built-in types:
//
//   - `int`    — non-negative integer (decoded as number)
//   - `string` — arbitrary URL segment (decoded as string)
//
// Encoding picks the registered pattern named `state.name` and substitutes
// params; decoding tries patterns in registration order and returns the
// first match. If nothing matches, `decode` returns `{ name: defaultName,
// params: {} }` (default name is the first registered route, or '' if no
// routes).
//
// This replaces the home-grown matchers in pos_router_service.js and
// self_order_router_service.js.
// -----------------------------------------------------------------------------

import type { RouterCodec } from "./codec";

type ParamType = "int" | "string";

interface ParamSpec {
  name: string;
  type: ParamType;
}

interface CompiledRoute {
  name: string;
  pattern: string;
  paramSpecs: ParamSpec[];
  regex: RegExp;
}

export interface MatchedRoute<TName extends string = string> {
  name: TName;
  params: Record<string, string | number>;
}

export interface MatcherOptions {
  /**
   * If decode finds no match, return this route name. Defaults to the first
   * registered name. Set to a known unmatched name (e.g. "NotFound") for
   * apps that want a dedicated fallback screen.
   */
  defaultName?: string;
  /**
   * Optional prefix matcher applied before the main pattern. Used by
   * pos_self_order's locale prefix `/{lang}/...`. The matcher captures the
   * group and exposes it as a param under the same key when present.
   *
   * Example: `prefix: { regex: /^(?:\/([a-z]{2}(?:_[a-z]{2})?))?/, name:
   * "lang" }` — the language code (if present) ends up as `params.lang`.
   */
  prefix?: { regex: RegExp; name: string };
}

const PARAM_RE = /\{(\w+):(\w+)\}/g;

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compile(name: string, pattern: string, prefix: RegExp | null): CompiledRoute {
  const paramSpecs: ParamSpec[] = [];
  for (const match of pattern.matchAll(PARAM_RE)) {
    paramSpecs.push({ name: match[1], type: match[2] as ParamType });
  }
  // Validate types eagerly so misconfiguration surfaces at build, not at
  // decode time.
  for (const spec of paramSpecs) {
    if (spec.type !== "int" && spec.type !== "string") {
      throw new Error(`Unknown param type "${spec.type}" in route "${pattern}"`);
    }
  }
  const segments = pattern.split(PARAM_RE);
  // After splitting on /\{(\w+):(\w+)\}/, segments alternate
  // [literal, paramName, paramType, literal, paramName, paramType, ...].
  let body = "";
  for (let i = 0; i < segments.length; i++) {
    if (i % 3 === 0) {
      body += escapeRegExp(segments[i]);
    } else if (i % 3 === 1) {
      const type = segments[i + 1] as ParamType;
      body += type === "int" ? "(\\d+)" : "([^/]+)";
    }
    // i % 3 === 2 is the type, already consumed above.
  }
  const prefixSrc = prefix ? prefix.source : "";
  return {
    name,
    pattern,
    paramSpecs,
    regex: new RegExp(`^${prefixSrc}${body}$`),
  };
}

function castParam(value: string, type: ParamType): string | number {
  return type === "int" ? Number(value) : value;
}

export function createMatcher<TName extends string = string>(
  routes: Record<TName, string>,
  options: MatcherOptions = {}
): RouterCodec<MatchedRoute<TName>> & {
  /** Inspect compiled routes — useful for tests and debugging. */
  readonly routes: ReadonlyArray<{ name: TName; pattern: string }>;
} {
  const compiled: CompiledRoute[] = [];
  const byName = new Map<string, CompiledRoute>();
  for (const [name, pattern] of Object.entries(routes) as [TName, string][]) {
    const route = compile(name, pattern, options.prefix?.regex ?? null);
    compiled.push(route);
    byName.set(name, route);
  }

  const defaultName = (options.defaultName ?? compiled[0]?.name ?? "") as TName;
  const prefixName = options.prefix?.name;

  const codec: RouterCodec<MatchedRoute<TName>> = {
    encode(state) {
      const route = byName.get(state.name);
      if (!route) {
        throw new Error(`Unknown route "${state.name}"`);
      }
      return route.pattern.replace(PARAM_RE, (_, name) => {
        const value = state.params[name];
        if (value === undefined || value === null) {
          throw new Error(`Missing param "${name}" for route "${route.name}"`);
        }
        return String(value);
      });
    },
    decode(url) {
      const path = url.pathname;
      for (const route of compiled) {
        const m = path.match(route.regex);
        if (!m) continue;
        const params: Record<string, string | number> = {};
        let captureIndex = 1;
        if (prefixName !== undefined) {
          const prefixCapture = m[captureIndex++];
          if (prefixCapture !== undefined) {
            params[prefixName] = prefixCapture;
          }
        }
        for (const spec of route.paramSpecs) {
          params[spec.name] = castParam(m[captureIndex++], spec.type);
        }
        return { name: route.name as TName, params };
      }
      return { name: defaultName, params: {} };
    },
  };

  return Object.assign(codec, {
    routes: compiled.map((r) => ({ name: r.name as TName, pattern: r.pattern })),
  });
}
