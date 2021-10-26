import { filterOutModifiersFromData } from "../blockdom/config";

export function mainEventHandler(data: any, ev: Event) {
  if (typeof data === "function") {
    data(ev);
  } else {
    data = filterOutModifiersFromData(data).data;
    const ctx = data[0];
    const method = data[1];
    const args = data[2] || [];
    ctx.__owl__.component[method](...args, ev);
  }
}
