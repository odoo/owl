// Compile-time checks for plugin types. This file is only typechecked
// (npm run test:types); it is not executed.
import { Plugin, usePlugin } from "../src";

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
declare function assertEq<A, B>(...args: Eq<A, B> extends true ? [] : [never]): void;

// without a `scoped` factory, consumers get the plugin itself, minus `setup`
class Counter extends Plugin {
  value = 0;
}
const counter = usePlugin(Counter);
assertEq<typeof counter, Omit<Counter, "setup">>();
// @ts-expect-error `setup` is not exposed to consumers
counter.setup();

// a typed `scoped` factory decides the consumer's view, even another object
class Store {
  records: string[] = [];
}
class StorePlugin extends Plugin {
  static scoped(self: StorePlugin): Store {
    return self.store;
  }
  store = new Store();
}
const store = usePlugin(StorePlugin);
assertEq<typeof store, Store>();
// @ts-expect-error the view is the store, not the plugin
store.store.records;

// a `scoped` factory returning `any` (as an untyped `Object.create(self)` in
// plain JS does) keeps the plugin's own type, rather than `any`
class ORM extends Plugin {
  static scoped(self: ORM) {
    return Object.create(self);
  }
  read(): string[] {
    return [];
  }
}
const orm = usePlugin(ORM);
assertEq<typeof orm, Omit<ORM, "setup">>();
// @ts-expect-error unknown member, so the view is not `any`
orm.write();
