export class EventBus extends EventTarget {
  trigger(name: string, payload?: any) {
    this.dispatchEvent(new CustomEvent(name, { detail: payload }));
  }
}
