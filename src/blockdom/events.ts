import { config } from "./config";

type EventHandlerSetter = (this: HTMLElement, data: any) => void;

interface EventHandlerCreator {
  setup: EventHandlerSetter;
  update: EventHandlerSetter;
}

export function createEventHandler(rawEvent: string): EventHandlerCreator {
  const eventName = rawEvent.split(".")[0];
  if (rawEvent.includes(".synthetic")) {
    return createSyntheticHandler(eventName);
  } else {
    return createElementHandler(eventName);
  }
}

// Native listener
function createElementHandler(evName: string): EventHandlerCreator {
  let eventKey = `__event__${evName}`;
  function listener(ev: Event) {
    const currentTarget = ev.currentTarget;
    if (!currentTarget || !document.contains(currentTarget as HTMLElement)) return;
    const data = (currentTarget as any)[eventKey];
    if (!data) return;
    config.mainEventHandler(data, ev);
  }

  function setup(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
    this.addEventListener(evName, listener);
  }

  function update(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
  }

  return { setup, update };
}

// Synthetic handler: a form of event delegation that allows placing only one
// listener per event type.
function createSyntheticHandler(evName: string): EventHandlerCreator {
  let eventKey = `__event__synthetic_${evName}`;
  setupSyntheticEvent(evName, eventKey);
  function setup(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
  }
  return { setup, update: setup };
}

function nativeToSyntheticEvent(eventKey: string, event: Event) {
  let dom = event.target;
  while (dom !== null) {
    const data = (dom as any)[eventKey];
    if (data) {
      config.mainEventHandler(data, event);
    }
    dom = (dom as any).parentNode;
  }
}

const CONFIGURED_SYNTHETIC_EVENTS: { [event: string]: boolean } = {};

function setupSyntheticEvent(evName: string, eventKey: string) {
  if (CONFIGURED_SYNTHETIC_EVENTS[eventKey]) {
    return;
  }
  document.addEventListener(evName, (event) => nativeToSyntheticEvent(eventKey, event));
  CONFIGURED_SYNTHETIC_EVENTS[eventKey] = true;
}
