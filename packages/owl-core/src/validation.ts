import { OwlError } from "./owl_error";

export interface ValidationIssue {
  message: string;
  path?: string;
  received?: any;
  [K: string]: any;
}

export interface ValidationContext {
  addIssue(issue: ValidationIssue): void;
  isValid: boolean;
  issueDepth: number;
  mergeIssues(issues: ValidationIssue[]): void;
  path: PropertyKey[];
  validate(type: any): void;
  value: any;
  withIssues(issues: ValidationIssue[]): ValidationContext;
  withKey(key: PropertyKey): ValidationContext;
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

function createContext(
  issues: ValidationIssue[],
  value: any,
  path: PropertyKey[],
  parent?: ValidationContext,
  // depth of this context's value relative to its parent: a `withKey` child is
  // one level below, a `withIssues` probe (union member) stays at the same
  // level. Union probe failures must not look like deep failures to an
  // enclosing union, or it would stop trying the remaining members.
  depthOffset = 1
): ValidationContext {
  return {
    issueDepth: 0,
    path,
    value,
    get isValid() {
      return !issues.length;
    },
    addIssue(issue) {
      issues.push({
        received: this.value,
        path: this.path.join(" > "),
        ...issue,
      });
    },
    mergeIssues(newIssues) {
      issues.push(...newIssues);
    },
    validate(type: any) {
      type(this);
      if (!this.isValid && parent) {
        parent.issueDepth = this.issueDepth + depthOffset;
      }
    },
    withIssues(issues) {
      return createContext(issues, this.value, this.path, this, 0);
    },
    withKey(key) {
      return createContext(issues, this.value[key], this.path.concat(key), this);
    },
  };
}

export function validateType(value: any, validation: any): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  validation(createContext(issues, value, []));
  return issues;
}
