import { config } from "./config";

type EventHandlerSetter = (this: HTMLElement, data: any) => void;

interface EventHandlerCreator {
  setup: EventHandlerSetter;
  update: EventHandlerSetter;
  remove: (this: HTMLElement) => void;
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
let nextNativeEventId = 1;
function createElementHandler(evName: string, capture: boolean = false): EventHandlerCreator {
  let eventKey = `__event__${evName}_${nextNativeEventId++}`;
  if (capture) {
    eventKey = `${eventKey}_capture`;
  }

  function listener(ev: Event) {
    const currentTarget = ev.currentTarget as HTMLElement;
    if (!currentTarget || !currentTarget.ownerDocument.contains(currentTarget)) return;
    const data = (currentTarget as any)[eventKey];
    if (!data) return;
    config.mainEventHandler(data, ev, currentTarget);
  }

  function setup(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
    this.addEventListener(evName, listener, { capture });
  }

  function remove(this: HTMLElement) {
    delete (this as any)[eventKey];
    this.removeEventListener(evName, listener, { capture });
  }
  function update(this: HTMLElement, data: any) {
    (this as any)[eventKey] = data;
  }

  return { setup, update, remove };
}

// Synthetic handler: a form of event delegation that allows placing only one
// listener per event type.
let nextSyntheticEventId = 1;
function createSyntheticHandler(evName: string, capture: boolean = false): EventHandlerCreator {
  let eventKey = `__event__synthetic_${evName}`;
  if (capture) {
    eventKey = `${eventKey}_capture`;
  }
  setupSyntheticEvent(evName, eventKey, capture);
  const currentId = nextSyntheticEventId++;
  function setup(this: HTMLElement, data: any) {
    const _data = (this as any)[eventKey] || {};
    _data[currentId] = data;
    (this as any)[eventKey] = _data;
  }

  function remove(this: HTMLElement) {
    delete (this as any)[eventKey];
  }

  return { setup, update: setup, remove };
}

function nativeToSyntheticEvent(eventKey: string, event: Event) {
  let dom = event.target;
  while (dom !== null) {
    const _data = (dom as any)[eventKey];
    if (_data) {
      for (const data of Object.values(_data)) {
        const stopped = config.mainEventHandler(data, event, dom);
        if (stopped) return;
      }
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
