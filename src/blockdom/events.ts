import { config } from "./config";

type EventHandlerSetter = (this: HTMLElement, data: any) => void;

interface EventHandlerCreator {
  setup: EventHandlerSetter;
  update: EventHandlerSetter;
}

export function createEventHandler(rawEvent: string): EventHandlerCreator {
  const eventName = rawEvent.split(".")[0];
  const capture = rawEvent.includes(".capture");
  if (rawEvent.includes(".synthetic")) {
    return createSyntheticHandler(eventName, capture);
  } else {
    return createElementHandler(eventName, capture);
  }
}

// Native listener
function createElementHandler(evName: string, capture: boolean = false): EventHandlerCreator {
  let eventKey = `__event__${evName}`;
  if (capture) {
    eventKey = `${eventKey}_capture`;
  }

  function listener(ev: Event) {
    const currentTarget = ev.currentTarget;
    if (!currentTarget || !document.contains(currentTarget as HTMLElement)) return;
    const data = (currentTarget as any)[eventKey];
    if (!data) return;
    config.mainEventHandler(data, ev, currentTarget);
  }

  function setup(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
    this.addEventListener(evName, listener, { capture });
  }

  function update(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
  }

  return { setup, update };
}

// Synthetic handler: a form of event delegation that allows placing only one
// listener per event type.
function createSyntheticHandler(evName: string, capture: boolean = false): EventHandlerCreator {
  let eventKey = `__event__synthetic_${evName}`;
  if (capture) {
    eventKey = `${eventKey}_capture`;
  }
  setupSyntheticEvent(evName, eventKey, capture);
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
      const stopped = config.mainEventHandler(data, event, dom);
      if (stopped) return;
    }
    dom = (dom as any).parentNode;
  }
}

const CONFIGURED_SYNTHETIC_EVENTS: { [event: string]: boolean } = {};

function setupSyntheticEvent(evName: string, eventKey: string, capture: boolean = false) {
  if (CONFIGURED_SYNTHETIC_EVENTS[eventKey]) {
    return;
  }
  document.addEventListener(evName, (event) => nativeToSyntheticEvent(eventKey, event), {
    capture,
  });
  CONFIGURED_SYNTHETIC_EVENTS[eventKey] = true;
}
