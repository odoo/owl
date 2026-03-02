/**
 * This module instruments OWL to track and report property accesses on `this`
 * in templates and component getters, distinguishing whether each access went
 * through the context object (`ctx`) or the component instance directly.
 *
 * Usage:
 *   import { enableThisTracking, disableThisTracking, getThisTrackingReport } from "@odoo/owl";
 *   enableThisTracking();
 *   // ... mount / render components ...
 *   const report = getThisTrackingReport();
 *   disableThisTracking();
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateAccess {
  /** The property name that was accessed */
  property: string;
  /** Whether the property was found on ctx (own) or inherited from the component */
  source: "ctx" | "component";
  /** Reconstructed expression string (or full original expression when tracking enabled at compile time) */
  expression: string;
  /** The template name where the access occurred */
  templateName: string;
  /** 1-based line number in the template source (if expression tracking enabled at compile time) */
  line?: number;
  /** 0-based column start in the line */
  col?: number;
  /** 0-based column end (exclusive) in the line */
  endCol?: number;
  /** Source file URL (set via t-source-file attribute during template inheritance) */
  file?: string;
}

interface InternalGetterAccess {
  property: string;
  getterName: string;
  source: "ctx" | "component";
  templateName: string;
  file?: string;
}

export interface AggregatedAccess {
  filename: string;
  templateName: string;
  property: string;
  line: number;
  col: number;
  endCol: number;
  expression: string;
  source: "ctx" | "component" | "both";
}

export interface AggregatedGetterAccess {
  filename: string;
  templateName: string;
  getterName: string;
  property: string;
  source: "ctx" | "component" | "both";
}

export interface ThisTrackingReport {
  accesses: Record<string, AggregatedAccess>;
  getterAccesses: Record<string, AggregatedGetterAccess>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _tracking = false;
const _templateAccesses: TemplateAccess[] = [];
const _getterAccesses: InternalGetterAccess[] = [];
const _getterStack: string[] = [];

// Tracks whether the current access originates from the component proxy
// (i.e. via ctx['this'].prop)
let _inComponentProxy = false;

// Template name stack: tracks the currently-executing template for proper
// attribution in t-call, t-slot, and t-name scenarios
const _templateNameStack: string[] = [];

// Current expression location info, set by __setExprLoc in generated code
// right before each compiled expression is evaluated.
interface ExprLocationInfo {
  originalExpr: string;
  line: number;
  col: number;
  endCol: number;
  file?: string;
}
let _currentExprInfo: ExprLocationInfo | null = null;

// Template name aliases: maps auto-generated template keys (e.g. "__template__95")
// to human-readable names like "@web/views/button:MyComponent"
const _templateNameAliases = new Map<string, string>();

// Fallback file paths for inline templates (keyed by aliased template name)
const _templateFallbackFiles = new Map<string, string>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function enableThisTracking(): void {
  _tracking = true;
}

export function disableThisTracking(): void {
  _tracking = false;
}

export function clearThisTracking(): void {
  _templateAccesses.length = 0;
  _getterAccesses.length = 0;
  _getterStack.length = 0;
  _templateNameStack.length = 0;
  _inComponentProxy = false;
  _currentExprInfo = null;
  _templateNameAliases.clear();
  _templateFallbackFiles.clear();
}

/**
 * Called from generated template code (via comma operator) to set the
 * current expression's source location before the expression is evaluated.
 * The proxy reads this info when recording accesses.
 */
export function setExprLocation(
  expr: string,
  line: number,
  col: number,
  endCol: number,
  file?: string
): void {
  _currentExprInfo = { originalExpr: expr, line, col, endCol };
  if (file) {
    _currentExprInfo.file = file;
  }
}

export function isThisTrackingEnabled(): boolean {
  return _tracking;
}

export function setTemplateTrackingAlias(templateKey: string, readableName: string): void {
  _templateNameAliases.set(templateKey, readableName);
}

export function setTemplateFallbackFile(templateName: string, filename: string): void {
  _templateFallbackFiles.set(templateName, filename);
}

export function getTemplateNameAlias(templateKey: string): string | undefined {
  return _templateNameAliases.get(templateKey);
}

export function getTemplateFallbackFile(templateName: string): string | undefined {
  return _templateFallbackFiles.get(templateName);
}

export function getThisTrackingReport(): ThisTrackingReport {
  const accesses: Record<string, AggregatedAccess> = {};
  for (const access of _templateAccesses) {
    if (access.line == null) continue; // skip accesses without location info
    const filename = access.file || "";
    const key = access.line === 0
      ? `${filename}:${access.templateName}:${access.property}:${access.expression}`
      : `${filename}:${access.templateName}:${access.property}:${access.line}:${access.col}:${access.endCol}`;
    const existing = accesses[key];
    if (existing) {
      if (existing.source !== access.source) {
        existing.source = "both";
      }
    } else {
      accesses[key] = {
        filename,
        templateName: access.templateName,
        property: access.property,
        line: access.line!,
        col: access.col!,
        endCol: access.endCol!,
        expression: access.expression,
        source: access.source,
      };
    }
  }
  const getterAccesses: Record<string, AggregatedGetterAccess> = {};
  for (const ga of _getterAccesses) {
    const filename = ga.file || "";
    const key = `${filename}:${ga.templateName}:${ga.getterName}:${ga.property}`;
    const existing = getterAccesses[key];
    if (existing) {
      if (existing.source !== ga.source) {
        existing.source = "both";
      }
    } else {
      getterAccesses[key] = {
        filename,
        templateName: ga.templateName,
        getterName: ga.getterName,
        property: ga.property,
        source: ga.source,
      };
    }
  }
  return { accesses, getterAccesses };
}

// ---------------------------------------------------------------------------
// Template name stack — used by template_set and template_helpers
// ---------------------------------------------------------------------------

export function pushTrackingTemplate(name: string): void {
  _templateNameStack.push(_templateNameAliases.get(name) || name);
}

export function popTrackingTemplate(): void {
  _templateNameStack.pop();
}

/**
 * Returns the currently active template name from the stack, or null if empty.
 */
function currentTrackingTemplate(): string | null {
  return _templateNameStack.length > 0
    ? _templateNameStack[_templateNameStack.length - 1]
    : null;
}

// ---------------------------------------------------------------------------
// Internals — property descriptor lookup
// ---------------------------------------------------------------------------

function getPropertyDescriptor(obj: any, prop: string | symbol): PropertyDescriptor | undefined {
  let current = obj;
  while (current) {
    const desc = Object.getOwnPropertyDescriptor(current, prop);
    if (desc) return desc;
    current = Object.getPrototypeOf(current);
  }
  return undefined;
}

// Properties that should never be tracked (internal / infrastructure)
const SKIP_PROPS = new Set<string | symbol>([
  "__owl__",
  "constructor",
  "hasOwnProperty",
  "toString",
  "valueOf",
  "toJSON",
]);

function shouldSkip(prop: string | symbol): boolean {
  return typeof prop === "symbol" || SKIP_PROPS.has(prop);
}

// ---------------------------------------------------------------------------
// Proxy factories
// ---------------------------------------------------------------------------

/**
 * Creates a tracked version of the template context object (`ctx`).
 * All property accesses are intercepted and recorded.
 *
 * @param ctx          The original context object
 * @param component    The component instance
 * @param templateName The default template name (overridden by stack if active)
 */
export function createTrackedCtx(ctx: any, component: any, templateName: string): any {
  templateName = _templateNameAliases.get(templateName) || templateName;
  const componentProxy = createComponentProxy(component, templateName);

  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (!_tracking || shouldSkip(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      // ctx['this'] → return proxied component
      if (prop === "this") {
        return componentProxy;
      }

      const effectiveName = currentTrackingTemplate() || templateName;
      const isOwn = Object.prototype.hasOwnProperty.call(target, prop);
      const source: "ctx" | "component" = isOwn ? "ctx" : "component";

      // Check if the property is a getter (on component prototype chain)
      const desc = getPropertyDescriptor(target, prop);
      const isGetter = !!(desc && desc.get);

      // Record the access
      if (_getterStack.length === 0) {
        // Top-level template access
        const access: TemplateAccess = {
          property: prop as string,
          source,
          expression: _currentExprInfo ? _currentExprInfo.originalExpr : (prop as string),
          templateName: effectiveName,
        };
        if (_currentExprInfo) {
          access.line = _currentExprInfo.line;
          access.col = _currentExprInfo.col;
          access.endCol = _currentExprInfo.endCol;
          if (_currentExprInfo.file) {
            access.file = _currentExprInfo.file;
          } else {
            const fallback = _templateFallbackFiles.get(effectiveName);
            if (fallback) {
              access.file = fallback;
            }
          }
        }
        _templateAccesses.push(access);
      } else {
        // Inside a getter → record as getter-internal access
        const gAccess: InternalGetterAccess = {
          property: prop as string,
          getterName: _getterStack[_getterStack.length - 1],
          source: _inComponentProxy ? "component" : "ctx",
          templateName: effectiveName,
        };
        if (_currentExprInfo?.file) {
          gAccess.file = _currentExprInfo.file;
        } else {
          const fallback = _templateFallbackFiles.get(effectiveName);
          if (fallback) {
            gAccess.file = fallback;
          }
        }
        _getterAccesses.push(gAccess);
      }

      // If this is a getter, push onto stack so nested accesses are
      // attributed to the getter
      if (isGetter) {
        _getterStack.push(prop as string);
        const value = Reflect.get(target, prop, receiver);
        _getterStack.pop();
        return value;
      }

      return Reflect.get(target, prop, receiver);
    },

    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver);
    },

    has(target, prop) {
      return Reflect.has(target, prop);
    },

    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
  };

  return new Proxy(ctx, handler);
}

/**
 * Creates a proxy around the component instance, used when templates
 * access `this` explicitly (i.e. `ctx['this'].prop`).
 */
function createComponentProxy(component: any, templateName: string): any {
  if (!component || typeof component !== "object") {
    return component;
  }
  const handler: ProxyHandler<any> = {
    get(target, prop, receiver) {
      if (!_tracking || shouldSkip(prop)) {
        return Reflect.get(target, prop, receiver);
      }

      const effectiveName = currentTrackingTemplate() || templateName;
      const desc = getPropertyDescriptor(target, prop);
      const isGetter = !!(desc && desc.get);

      if (_getterStack.length === 0) {
        // Top-level template access via explicit `this`
        const access: TemplateAccess = {
          property: prop as string,
          source: "component",
          expression: _currentExprInfo ? _currentExprInfo.originalExpr : `this.${prop as string}`,
          templateName: effectiveName,
        };
        if (_currentExprInfo) {
          access.line = _currentExprInfo.line;
          access.col = _currentExprInfo.col;
          access.endCol = _currentExprInfo.endCol;
          if (_currentExprInfo.file) {
            access.file = _currentExprInfo.file;
          } else {
            const fallback = _templateFallbackFiles.get(effectiveName);
            if (fallback) {
              access.file = fallback;
            }
          }
        }
        _templateAccesses.push(access);
      } else {
        // Inside a getter, this is accessed via the component
        const gAccess: InternalGetterAccess = {
          property: prop as string,
          getterName: _getterStack[_getterStack.length - 1],
          source: "component",
          templateName: effectiveName,
        };
        if (_currentExprInfo?.file) {
          gAccess.file = _currentExprInfo.file;
        } else {
          const fallback = _templateFallbackFiles.get(effectiveName);
          if (fallback) {
            gAccess.file = fallback;
          }
        }
        _getterAccesses.push(gAccess);
      }

      if (isGetter) {
        _getterStack.push(prop as string);
        const prevInComponentProxy = _inComponentProxy;
        _inComponentProxy = true;
        const value = Reflect.get(target, prop, receiver);
        _inComponentProxy = prevInComponentProxy;
        _getterStack.pop();
        return value;
      }

      return Reflect.get(target, prop, receiver);
    },

    set(target, prop, value, receiver) {
      return Reflect.set(target, prop, value, receiver);
    },

    has(target, prop) {
      return Reflect.has(target, prop);
    },

    getPrototypeOf(target) {
      return Reflect.getPrototypeOf(target);
    },
  };

  return new Proxy(component, handler);
}
