import { OwlError } from "../common/owl_error";

export interface ValidationIssue {
  message: string;
  path?: PropertyKey[];
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

export function assertType(
  value: any,
  validation: any,
  errorMessage = "Value does not match the type"
): void {
  const issues = validateType(value, validation);
  if (issues.length) {
    const issueStrings = JSON.stringify(
      issues,
      (key, value) => {
        if (typeof value === "function") {
          return value.name;
        }
        return value;
      },
      2
    );
    throw new OwlError(`${errorMessage}\n${issueStrings}`);
  }
}

function createContext(
  issues: ValidationIssue[],
  value: any,
  path: PropertyKey[],
  parent?: ValidationContext
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
        path: this.path,
        ...issue,
      });
    },
    mergeIssues(newIssues) {
      issues.push(...newIssues);
    },
    validate(type: any) {
      type(this);
      if (!this.isValid && parent) {
        parent.issueDepth = this.issueDepth + 1;
      }
    },
    withIssues(issues) {
      return createContext(issues, this.value, this.path, this);
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
