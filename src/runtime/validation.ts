import { OwlError } from "../common/owl_error";

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

export function validateType(value: any, validation: any): any[] {
  return (validation as any)(value);
}
