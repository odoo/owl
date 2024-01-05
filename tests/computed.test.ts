import { Component, mount, onRendered, reactive, useState, xml } from "../src";
import { batched } from "../src/runtime/utils";
import { makeTestFixture, nextMicroTick, nextTick } from "./helpers";

function effect(cb: any, deps: any) {
  const reactiveDeps = reactive(deps, function recompute() {
    cb(...reactiveDeps);
  });
  cb(...reactiveDeps);
}

function lazyComputed(obj: any, propName: string, compute: any) {
  const key = Symbol(propName);
  Object.defineProperty(obj, propName, {
    get() {
      return this[key]();
    },
    configurable: true,
  });

  effect(
    function recompute(obj: any) {
      const value: any[] = [];
      obj[key] = () => {
        if (!value.length) {
          value.push(compute(obj));
        }
        return value[0];
      };
    },
    [obj]
  );
}

describe("computed - with effect", () => {
  let orderComputeCounts = { itemTotal: 0, orderTotal: 0 };
  const resetOrderComputeCounts = () => {
    orderComputeCounts.itemTotal = 0;
    orderComputeCounts.orderTotal = 0;
  };

  const expectOrderComputeCounts = (expected: { itemTotal: number; orderTotal: number }) => {
    expect(orderComputeCounts).toEqual(expected);
    resetOrderComputeCounts();
  };

  beforeEach(() => {
    resetOrderComputeCounts();
  });

  type Product = { unitPrice: number };
  type OrderItem = { product: Product; quantity: number; itemTotal: number };
  type Order = { items: any[]; discount: number; orderTotal: number };

  const createProduct = (unitPrice: number): Product => {
    return reactive({ unitPrice });
  };

  const createOrderItem = (product: Product, quantity: number) => {
    const item = reactive({ product, quantity });
    lazyComputed(item, "itemTotal", (item: OrderItem) => {
      orderComputeCounts.itemTotal++;

      return item.product.unitPrice * item.quantity;
    });
    return item;
  };

  const createOrder = () => {
    const order = reactive({ items: [], discount: 0 });
    lazyComputed(order, "orderTotal", (order: Order) => {
      orderComputeCounts.orderTotal++;

      let result = 0;
      for (let item of order.items) {
        result += item.itemTotal;
      }
      return result * (1 - order.discount / 100);
    });
    return order as unknown as Order;
  };

  test("effect depends on getter", () => {
    let distanceComputeCount = 0;
    const expectDistanceComputeCount = (expected: number) => {
      expect(distanceComputeCount).toBe(expected);
      distanceComputeCount = 0;
    };

    // point <- computed distance <- computed deepComputedVal
    const point = reactive({ x: 0, y: 0 }) as any;
    lazyComputed(point, "distance", (p: typeof point) => {
      distanceComputeCount++;
      return Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
    });
    lazyComputed(point, "deepComputedVal", (p: typeof point) => {
      // absurd computation to test that the getter is not recomputed
      let result = 0;
      for (let i = 0; i < 5; i++) {
        // @ts-ignore
        result += p.distance;
      }
      return result;
    });

    let val = 0;
    effect(
      (p: any) => {
        // Notice that in this effect, only the `deepComputedVal` is directly used.
        // It is indirectly dependent on the `x` and `y` of `p`.
        // Nevertheless, mutating `x` or `y` should trigger this effect.
        val = p.deepComputedVal;
      },
      [point]
    );

    expect(val).toEqual(0);
    expectDistanceComputeCount(1);
    expect(point.distance).toEqual(0);
    // No recomputation even after the previous `distance` call.
    expectDistanceComputeCount(0);

    point.x = 3;
    expect(val).toEqual(15);
    expectDistanceComputeCount(1);
    expect(point.distance).toEqual(3);
    // No recomputation even after the previous `distance` call.
    expectDistanceComputeCount(0);

    point.y = 4;
    expect(val).toEqual(25);
    expectDistanceComputeCount(1);
    expect(point.distance).toEqual(5);
    // No recomputation even after the previous `distance` call.
    expectDistanceComputeCount(0);
  });

  test("can depend on network of objects", () => {
    const p1 = createProduct(10);
    const p2 = createProduct(20);
    const p3 = createProduct(30);
    const o = createOrder();
    o.items.push(createOrderItem(p1, 1));
    o.items.push(createOrderItem(p2, 2));
    o.items.push(createOrderItem(p3, 3));

    let orderTotal = 0;
    effect(
      (o: any) => {
        orderTotal = o.orderTotal;
      },
      [o]
    );

    expect(orderTotal).toEqual(140);

    p1.unitPrice = 11;
    expect(orderTotal).toEqual(141);

    o.items[1].quantity = 4;
    expect(orderTotal).toEqual(181);

    o.items.push(createOrderItem(createProduct(40), 1));
    expect(orderTotal).toEqual(221);
  });

  test("batched effect", async () => {
    const p1 = createProduct(10);
    const p2 = createProduct(20);
    const p3 = createProduct(30);
    const o = createOrder();
    o.items.push(createOrderItem(p1, 1));
    o.items.push(createOrderItem(p2, 2));
    o.items.push(createOrderItem(p3, 3));

    let orderTotal = 0;
    effect(
      batched((o) => {
        orderTotal = o.orderTotal;
      }),
      [o]
    );

    await nextMicroTick();

    expect(orderTotal).toEqual(140);
    expectOrderComputeCounts({ itemTotal: 3, orderTotal: 1 });

    p1.unitPrice = 11;
    await nextMicroTick();

    expect(orderTotal).toEqual(141);
    expectOrderComputeCounts({ itemTotal: 1, orderTotal: 1 });

    o.items[1].quantity = 4;
    p3.unitPrice = 31;
    await nextMicroTick();

    expect(orderTotal).toEqual(184);
    expectOrderComputeCounts({ itemTotal: 2, orderTotal: 1 });

    o.items.push(createOrderItem(createProduct(40), 1));
    o.items[0].quantity = 5;
    p2.unitPrice = 21;
    await nextMicroTick();

    expect(orderTotal).toEqual(272);
    expectOrderComputeCounts({ itemTotal: 3, orderTotal: 1 });
    expect(o.orderTotal).toEqual(272);
    // No recomputation even after the previous `getOrderTotal` call.
    expectOrderComputeCounts({ itemTotal: 0, orderTotal: 0 });

    o.discount = 10;
    await nextMicroTick();
    expect(orderTotal).toEqual(244.8);
    expectOrderComputeCounts({ itemTotal: 0, orderTotal: 1 });
  });

  test("computed sorted array", async () => {
    let sortingCount = 0;
    const expectSortingCount = (expected: number) => {
      expect(sortingCount).toBe(expected);
      sortingCount = 0;
    };

    const array = reactive([
      52, 26, 71, 63, 72, 57, 71, 11, 17, 30, 52, 90, 14, 33, 86, 13, 62, 34, 99, 61, 21, 92, 95,
      99, 0, 92, 6, 35, 95, 39, 87, 30, 50, 74, 21, 67, 34, 98, 99, 46, 85, 63, 41, 56, 18, 43, 23,
      59, 52, 12,
    ]);

    lazyComputed(array, "sortedArray", (a: typeof array) => {
      sortingCount++;
      const copy = [...a];
      return copy.sort((a, b) => a - b);
    });

    lazyComputed(array, "range", (a: typeof array) => {
      // @ts-ignore
      a = a.sortedArray;
      return a[a.length - 1] - a[0];
    });

    lazyComputed(array, "average", (a: typeof array) => {
      let sum = 0;
      for (let i = 0; i < a.length; i++) {
        sum += a[i];
      }
      return Math.trunc(sum / a.length);
    });

    lazyComputed(array, "min", (a: typeof array) => {
      // @ts-ignore
      a = a.sortedArray;
      return a[0];
    });

    lazyComputed(array, "max", (a: typeof array) => {
      // @ts-ignore
      a = a.sortedArray;
      return a[a.length - 1];
    });

    lazyComputed(array, "statTotal", (a: typeof array) => {
      // @ts-ignore
      return a.range + a.average + a.min + a.max;
    });

    let val = 0;
    effect(
      batched((a) => {
        val = a.statTotal + a.statTotal + a.statTotal;
      }),
      [array]
    );

    await nextMicroTick();

    expectSortingCount(1);
    expect(val).toEqual(250 * 3);

    array.push(99, 100);
    await nextMicroTick();

    expectSortingCount(1);
    expect(val).toEqual(254 * 3);

    array.push(-50);
    await nextMicroTick();

    expectSortingCount(1);
    expect(val).toEqual(252 * 3);

    // After some mutations, the original order is kept because the `sortedArray` getter makes a copy of the array before sorting.
    const arrayCopy = [...array];
    for (let i = 0; i < array.length; i++) {
      expect(array[i]).toEqual(arrayCopy[i]);
    }

    // Sort will perform so many mutations in the original array.
    // This will register several of recomputations.
    // But since the effect is batched, it will only be recomputed once.
    array.sort((a, b) => b - a);
    await nextMicroTick();

    expectSortingCount(1);
    expect(val).toEqual(252 * 3);
  });
});

describe("computed - with components", () => {
  type State = { a: number; b: number };

  let fixture: HTMLElement;
  let computeCounts = { c: 0, d: 0, e: 0, f: 0 };

  const expectComputeCounts = (expected: { c: number; d: number; e: number; f: number }) => {
    expect(computeCounts).toEqual(expected);
    computeCounts = { c: 0, d: 0, e: 0, f: 0 };
  };

  beforeEach(() => {
    fixture = makeTestFixture();
    computeCounts = { c: 0, d: 0, e: 0, f: 0 };
  });

  const updateA = (self: State, by: number) => {
    self.a += by;
  };
  const updateB = (self: State, by: number) => {
    self.b += by;
  };

  const createComponents = (state: State) => {
    lazyComputed(state, "c", (self: any) => {
      computeCounts.c++;
      return self.a + self.b;
    });
    lazyComputed(state, "d", (self: any) => {
      computeCounts.d++;
      return 2 * self.a;
    });
    lazyComputed(state, "e", (self: any) => {
      computeCounts.e++;
      let result = 0;
      for (let i = 0; i < 5; i++) {
        result += self.c + self.d;
      }
      return result;
    });
    lazyComputed(state, "f", (self: any) => {
      computeCounts.f++;
      let result = 0;
      for (let i = 0; i < 10; i++) {
        result += self.d;
      }
      return result;
    });
    let renderCounts = { App: 0, C: 0, D: 0, E: 0, F: 0 };
    const expectRenderCounts = (expected: {
      App: number;
      C: number;
      D: number;
      E: number;
      F: number;
    }) => {
      expect(renderCounts).toEqual(expected);
      renderCounts = { App: 0, C: 0, D: 0, E: 0, F: 0 };
    };

    class BaseComp extends Component {
      state = useState(state);
      setup() {
        onRendered(() => {
          const name = (this.constructor as any).name as keyof typeof renderCounts;
          renderCounts[name]++;
        });
      }
    }
    class C extends BaseComp {
      static components = {};
    }
    class D extends BaseComp {
      static components = {};
    }
    class E extends BaseComp {
      static components = {};
    }
    class F extends BaseComp {
      static components = {};
    }
    class App extends BaseComp {
      static components = {};
    }
    return { App, C, D, E, F, expectRenderCounts };
  };

  test("number of rerendering - sibling components", async () => {
    const state = reactive({ a: 1, b: 1 });
    const { App, C, D, E, F, expectRenderCounts } = createComponents(state);

    C.template = xml`<p t-out="state.c" />`;

    D.template = xml`<p t-out="state.d" />`;

    E.template = xml`<p t-out="state.e" />`;

    F.template = xml`<p t-out="state.f" />`;

    App.template = xml`<div><C /><D /><E /><F /></div>`;
    App.components = { C, D, E, F };

    await mount(App, fixture);
    expectRenderCounts({ App: 1, C: 1, D: 1, E: 1, F: 1 });

    updateA(state, 1);
    await nextTick();
    // App doesn't depend on the state, therefore it doesn't re-render
    expectRenderCounts({ App: 0, C: 1, D: 1, E: 1, F: 1 });

    updateB(state, 1);
    await nextTick();
    // changing b doesn't affect d
    expectRenderCounts({ App: 0, C: 1, D: 0, E: 1, F: 0 });

    // Multiple changes should only render once.
    for (let i = 0; i < 10; i++) {
      updateA(state, 1);
    }
    await nextTick();
    expectRenderCounts({ App: 0, C: 1, D: 1, E: 1, F: 1 });
  });

  test("number of rerenderings - nested components", async () => {
    const state = reactive({ a: 1, b: 1 });
    const { App, C, D, E, F, expectRenderCounts } = createComponents(state);

    F.template = xml`<p t-out="state.f" />`;

    E.template = xml`<div><p t-out="state.e" /><F /></div>`;
    E.components = { F };

    D.template = xml`<div><p t-out="state.d" /><E /></div>`;
    D.components = { E };

    C.template = xml`<div><p t-out="state.c" /><D /></div>`;
    C.components = { D };

    App.template = xml`<div><C /></div>`;
    App.components = { C };

    await mount(App, fixture);
    expectRenderCounts({ App: 1, C: 1, D: 1, E: 1, F: 1 });

    updateA(state, 1);
    await nextTick();
    // App doesn't depend on the state, therefore it doesn't re-render
    expectRenderCounts({ App: 0, C: 1, D: 1, E: 1, F: 1 });

    updateB(state, 1);
    await nextTick();
    // changing b doesn't affect d
    expectRenderCounts({ App: 0, C: 1, D: 0, E: 1, F: 0 });

    // Multiple changes should only render once.
    for (let i = 0; i < 10; i++) {
      updateA(state, 1);
    }
    await nextTick();
    expectRenderCounts({ App: 0, C: 1, D: 1, E: 1, F: 1 });
  });

  test("number of compute calls in components", async () => {
    const state = reactive({ a: 1, b: 1 });
    const { App, C, D, E, F } = createComponents(state);

    C.template = xml`<p t-out="state.c" />`;

    D.template = xml`<p t-out="state.d" />`;

    E.template = xml`<p t-out="state.e" />`;

    F.template = xml`<p t-out="state.f" />`;

    App.template = xml`<div><C /><D /><E /><F /></div>`;
    App.components = { C, D, E, F };

    await mount(App, fixture);
    expectComputeCounts({ c: 1, d: 1, e: 1, f: 1 });

    updateA(state, 1);
    await nextTick();
    // everything will be re-computed
    expectComputeCounts({ c: 1, d: 1, e: 1, f: 1 });

    updateB(state, 1);
    await nextTick();
    // only c and e will be re-computed
    expectComputeCounts({ c: 1, d: 0, e: 1, f: 0 });

    // update both
    updateA(state, 1);
    updateB(state, 1);
    await nextTick();
    // all will be re-computed and only once
    expectComputeCounts({ c: 1, d: 1, e: 1, f: 1 });
  });

  test("more complicated compute tree", async () => {
    const state = reactive({ x: 3, y: 2 });

    lazyComputed(state, "b", (self: any) => {
      return self.x + self.y;
    });
    lazyComputed(state, "e", (self: any) => {
      return self.b * self.x;
    });
    lazyComputed(state, "f", (self: any) => {
      return self.e + self.b;
    });

    const renderCounts = { A: 0, C: 0 };
    const expectRenderCounts = (expected: { A: number; C: number }) => {
      expect(renderCounts).toEqual(expected);
      renderCounts.A = 0;
      renderCounts.C = 0;
    };

    class BaseComp extends Component {
      state = useState(state);
    }
    class A extends BaseComp {
      static components = {};
      static template = xml`<p id="A" t-out="state.f" />`;
      setup() {
        super.setup();
        onRendered(() => {
          renderCounts.A++;
        });
      }
    }
    class C extends BaseComp {
      static components = {};
      static template = xml`<p id="C" t-out="state.f" />`;
      setup() {
        super.setup();
        onRendered(() => {
          renderCounts.C++;
        });
      }
    }
    class App extends Component {
      static components = { A, C };
      static template = xml`<div><A /><C /></div>`;
    }

    await mount(App, fixture);
    expect(fixture.innerHTML).toEqual('<div><p id="A">20</p><p id="C">20</p></div>');
    expectRenderCounts({ A: 1, C: 1 });

    state.x = 4;
    await nextTick();
    expect(fixture.innerHTML).toEqual('<div><p id="A">30</p><p id="C">30</p></div>');
    expectRenderCounts({ A: 1, C: 1 });

    // Mutating both should also result to just one re-rendering.
    state.x = 10;
    state.y = 20;
    await nextTick();
    expect(fixture.innerHTML).toEqual('<div><p id="A">330</p><p id="C">330</p></div>');
    expectRenderCounts({ A: 1, C: 1 });

    // Setting without change of value should not re-render.
    state.x = 10;
    await nextTick();
    expect(fixture.innerHTML).toEqual('<div><p id="A">330</p><p id="C">330</p></div>');
    expectRenderCounts({ A: 0, C: 0 });
  });
});
