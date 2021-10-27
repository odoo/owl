import { filterOutModifiersFromData } from "../blockdom/config";

export const mainEventHandler = (data: any, ev: Event, currentTarget?: EventTarget|null) => {
  const { data: _data, modifiers } = filterOutModifiersFromData(data);
  data = _data;
  let stopped = false;
  if (modifiers.length) {
    let selfMode = false;
    const isSelf = ev.target === currentTarget;
    for (const mod of modifiers) {
      switch (mod) {
        case "self": selfMode = true; if (isSelf) { continue; } else { return stopped; };
        case "prevent": if ((selfMode && isSelf) || (!selfMode)) ev.preventDefault(); continue;
        case "stop": if ((selfMode && isSelf) || (!selfMode)) ev.stopPropagation() ; stopped = true; continue;
      }
    }
  }
  if (typeof data[0] === "function") {
    data[0](ev);
  } else if (data[0].__owl__) {
    const method = data[1];
    const args = data[2] || [];
    data[0].__owl__.component[method](...args, ev);
  }
  return stopped;
}
