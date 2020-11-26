import { config } from "./config";

export function createEventHandler(event: string) {
  setupSyntheticEvent(event);
  const key = `__event__${event}`;
  return function setupHandler(this: HTMLElement, data: any) {
    (this as any)[key] = data;
  };
}

function nativeToSyntheticEvent(event: Event, name: string) {
  const eventKey = `__event__${name}`;
  let dom = event.target;
  while (dom !== null) {
    const data = (dom as any)[eventKey];
    if (data) {
      config.mainEventHandler(data, event);
      return;
    }
    dom = (dom as any).parentNode;
  }
}

const CONFIGURED_SYNTHETIC_EVENTS: { [event: string]: boolean } = {};

function setupSyntheticEvent(name: string) {
  if (CONFIGURED_SYNTHETIC_EVENTS[name]) {
    return;
  }
  document.addEventListener(name, (event) => nativeToSyntheticEvent(event, name));
  CONFIGURED_SYNTHETIC_EVENTS[name] = true;
}
