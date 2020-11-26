/**
 * We define here a simple event bus: it can
 * - emit events
 * - add/remove listeners.
 *
 * This is a useful pattern of communication in many cases.  For OWL, each
 * components and stores are event buses.
 */

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

export type Callback = (...args: any[]) => void;

export interface Subscription {
  owner: any;
  callback: Callback;
}

//------------------------------------------------------------------------------
// EventBus
//------------------------------------------------------------------------------

export class EventBus {
  subscriptions: { [eventType: string]: Subscription[] } = {};

  /**
   * Add a listener for the 'eventType' events.
   *
   * Note that the 'owner' of this event can be anything, but will more likely
   * be a component or a class. The idea is that the callback will be called with
   * the proper owner bound.
   *
   * Also, the owner should be kind of unique. This will be used to remove the
   * listener.
   */
  on(eventType: string, owner: any, callback: Callback) {
    if (!callback) {
      throw new Error("Missing callback");
    }
    if (!this.subscriptions[eventType]) {
      this.subscriptions[eventType] = [];
    }
    this.subscriptions[eventType].push({
      owner,
      callback,
    });
  }

  /**
   * Remove a listener
   */
  off(eventType: string, owner: any) {
    const subs = this.subscriptions[eventType];
    if (subs) {
      this.subscriptions[eventType] = subs.filter((s) => s.owner !== owner);
    }
  }

  /**
   * Emit an event of type 'eventType'.  Any extra arguments will be passed to
   * the listeners callback.
   */
  trigger(eventType: string, ...args: any[]) {
    const subs = this.subscriptions[eventType] || [];
    for (let i = 0, iLen = subs.length; i < iLen; i++) {
      const sub = subs[i];
      sub.callback.call(sub.owner, ...args);
    }
  }

  /**
   * Remove all subscriptions.
   */
  clear() {
    this.subscriptions = {};
  }
}
