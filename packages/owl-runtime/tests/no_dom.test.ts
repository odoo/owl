// @vitest-environment node

// This suite runs in a Node environment (no `document`/`window`). It guards
// the contract that owl can be imported and its non-rendering APIs used
// without a DOM, so the base reactivity and type-validation primitives work
// server-side. See https://github.com/odoo/owl/issues/1952.

import { describe, expect, test } from "vitest";
import { App, computed, effect, proxy, signal, types as t, validateType } from "../src/index";

describe("owl without a DOM", () => {
  test("the environment really has no document/window", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });

  test("reactivity primitives work", async () => {
    const count = signal(1);
    const double = computed(() => count() * 2);
    expect(double()).toBe(2);

    const seen: number[] = [];
    effect(() => seen.push(count()));
    count.set(5);
    await Promise.resolve();
    expect(double()).toBe(10);
    expect(seen).toEqual([1, 5]);

    const state = proxy({ a: 1 });
    const sum = computed(() => state.a + 1);
    expect(sum()).toBe(2);
    state.a = 10;
    expect(sum()).toBe(11);
  });

  test("the type system works", () => {
    expect(validateType("hello", t.string())).toEqual([]);
    expect(validateType(42, t.string())).not.toEqual([]);
  });

  test("an App can be constructed", () => {
    const app = new App();
    expect(app).toBeInstanceOf(App);
    app.destroy();
  });
});
