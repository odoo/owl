import { Model } from "./model";

export const Models: Record<string, typeof Model> = {};

export function clearModelRegistry() {
  for (const key of Object.keys(Models)) {
    delete Models[key];
  }
}
