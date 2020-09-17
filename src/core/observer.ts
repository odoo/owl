/**
 * Owl Observer
 *
 * This code contains the logic that allows Owl to observe and react to state
 * changes.
 *
 * This is a Observer class that can observe any JS values.  The way it works
 * can be summarized thusly:
 * - primitive values are not observed at all
 * - Objects and arrays are observed by replacing them with a Proxy
 * - each object/array metadata are tracked in a weakmap, and keep a revision
 *   number
 *
 * Note that this code is loosely inspired by Vue.
 */

//------------------------------------------------------------------------------
// Observer
//------------------------------------------------------------------------------
export class Observer {
  rev: number = 1;
  allowMutations: boolean = true;
  weakMap: WeakMap<any, any> = new WeakMap();

  notifyCB() {}

  observe<T>(value: T, parent?: any): T {
    if (
      value === null ||
      typeof value !== "object" ||
      value instanceof Date ||
      value instanceof Promise
    ) {
      // fun fact: typeof null === 'object'
      return value;
    }
    let metadata = this.weakMap.get(value) || this._observe(value, parent);
    return metadata.proxy;
  }

  revNumber(value): number {
    const metadata = this.weakMap.get(value);
    return metadata ? metadata.rev : 0;
  }

  _observe(value, parent) {
    var self = this;

    const proxy = new Proxy(value, {
      get(target, k) {
        const targetValue = target[k];
        return self.observe(targetValue, value);
      },
      set(target, key: string, newVal): boolean {
        const value = target[key];
        if (newVal !== value) {
          if (!self.allowMutations) {
            throw new Error(
              `Observed state cannot be changed here! (key: "${key}", val: "${newVal}")`
            );
          }
          self._updateRevNumber(target);
          target[key] = newVal;
          self.notifyCB();
        }
        return true;
      },
      deleteProperty(target, key) {
        if (key in target) {
          delete target[key];
          self._updateRevNumber(target);
          self.notifyCB();
        }
        return true;
      },
    });

    const metadata = {
      value,
      proxy,
      rev: this.rev,
      parent,
    };

    this.weakMap.set(value, metadata);
    this.weakMap.set(metadata.proxy, metadata);
    return metadata;
  }

  _updateRevNumber(target: any) {
    this.rev++;
    let metadata = this.weakMap.get(target);
    let parent = target;
    do {
      metadata = this.weakMap.get(parent);
      metadata.rev++;
    } while ((parent = metadata.parent) && parent !== target);
  }
}
