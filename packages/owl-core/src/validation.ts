import { OwlError } from "./owl_error";

export interface ValidationIssue {
  message: string;
  path?: string;
  received?: any;
  [K: string]: any;
}

/**
 * A validator inspects `context.value` and records any problems it finds with
 * `context.addIssue`. Validators are produced by the factories in `types.ts`,
 * where each one is also typed as the value it accepts (see the `validator`
 * helper there).
 */
export type Validator = (context: ValidationContext) => void;

/**
 * Threaded through a whole validation run. It holds the value currently under
 * inspection, the path to it from the root, and the issues collected so far.
 *
 * Composite validators don't allocate child contexts: `validateKey` descends
 * into a property and restores afterwards, and `runIsolated` runs a validator
 * against a throwaway issue list (used by unions to try alternatives).
 */
export class ValidationContext {
  value: any;
  path: PropertyKey[] = [];
  issues: ValidationIssue[] = [];

  constructor(value: any) {
    this.value = value;
  }

  addIssue(issue: ValidationIssue): void {
    this.issues.push({ received: this.value, path: this.path.join(" > "), ...issue });
  }

  validate(type: Validator): void {
    type(this);
  }

  validateKey(key: PropertyKey, type: Validator): void {
    const value = this.value;
    this.path.push(key);
    this.value = value[key];
    type(this);
    this.value = value;
    this.path.pop();
  }

  runIsolated(type: Validator): ValidationIssue[] {
    const issues = this.issues;
    const collected: ValidationIssue[] = (this.issues = []);
    type(this);
    this.issues = issues;
    return collected;
  }
}

function safeReplacer(knownObjects: any[], _key: string, value: any): any {
  if (typeof value === "function") {
    return value.name || "[Function]";
  }
  if (value && typeof value === "object") {
    const ctor = value.constructor;
    if (ctor && ctor !== Object && ctor !== Array) {
      return `[Instance of ${ctor.name || "anonymous"}]`;
    }

    if (knownObjects.includes(value)) {
      return `[Known object]`;
    }
    knownObjects.push(value);
  }
  return value;
}

export function assertType(
  value: any,
  validation: any,
  errorMessage = "Value does not match the type"
): void {
  const issues = validateType(value, validation);
  if (issues.length) {
    const knownObjects: any[] = [];
    const issueStrings = JSON.stringify(issues, safeReplacer.bind(null, knownObjects), 2);
    throw new OwlError(`${errorMessage}\n${issueStrings}`);
  }
}

export function validateType(value: any, validation: any): ValidationIssue[] {
  const context = new ValidationContext(value);
  validation(context);
  return context.issues;
}
