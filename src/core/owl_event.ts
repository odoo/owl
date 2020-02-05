import { Component } from "../component/component";

/**
 * We define here OwlEvent, a subclass of CustomEvent, with an additional
 * attribute:
 *  - originalComponent: the component that triggered the event
 */

export class OwlEvent<T> extends CustomEvent<T> {
  originalComponent: Component;
  constructor(component, eventType, options) {
    super(eventType, options);
    this.originalComponent = component;
  }
}
