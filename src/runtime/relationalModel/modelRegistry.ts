import { Model } from "./model";

export const modelRegistry: Record<string, typeof Model> = {};

export function clearModelRegistry() {
  for (const key of Object.keys(modelRegistry)) {
    delete modelRegistry[key];
  }
}
