type Callback = (...args: any[]) => void;

interface Subscription {
  owner: any;
  callback: Callback;
}

export class Bus {
  private subscriptions: { [eventType: string]: Subscription[] } = {};

  on(eventType: string, owner: any, callback: Callback) {
    if (!this.subscriptions[eventType]) {
      this.subscriptions[eventType] = [];
    }
    this.subscriptions[eventType].push({
      owner,
      callback
    });
  }
  off(eventType: string, owner: any) {
    const subs = this.subscriptions[eventType];
    if (subs) {
      this.subscriptions[eventType] = subs.filter(s => s.owner !== owner);
    }
  }
  trigger(eventType: string, ...args: any[]) {
    const subs = this.subscriptions[eventType] || [];
    for (let sub of subs) {
      sub.callback(...args);
    }
  }
}
