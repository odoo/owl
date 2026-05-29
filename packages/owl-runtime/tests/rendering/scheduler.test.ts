import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { App, Component, signal, xml } from "../../src";
import { Scheduler } from "../../src/rendering/scheduler";
import { makeTestFixture, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  Scheduler.frameBudgetMs = Infinity;
});

// Mount a single App with N sibling Child components, each reading its own
// signal. Signal updates on independent children produce independent root
// fibers in the app's single scheduler — the shape frame-budgeting addresses.
async function mountSiblings(n: number) {
  const signals = Array.from({ length: n }, () => signal(0));

  const children = signals.map((s) => {
    return class Child extends Component {
      static template = xml`<div class="leaf" t-out="this.s()"/>`;
      s = s;
    };
  });

  class Root extends Component {
    static template = xml`<div><t t-foreach="this.children" t-as="C" t-key="C_index"><t t-component="C"/></t></div>`;
    children = children;
  }

  const app = new App();
  await app.createRoot(Root).mount(fixture);
  return { app, signals, scheduler: app.scheduler };
}

// Budget-yield path: the scheduler yields via MessageChannel.postMessage
// (a real macrotask), so the browser can paint and process input between
// commit batches. The normal addFiber/flush paths still use queueMicrotask
// for low-latency sync work; only the post-budget continuation goes through
// the macrotask. These tests drive processTasks manually, so they exercise
// the queue-management and `scheduled` flag transitions regardless of which
// primitive does the actual yielding.
describe("scheduler frame budgeting", () => {
  test("budget disabled: all fibers drain in one processTasks call", async () => {
    Scheduler.frameBudgetMs = Infinity;
    const { app, signals, scheduler } = await mountSiblings(5);

    // Block auto-processing so we can observe the queued-but-not-yet-rendered
    // state. addFiber checks `scheduled` and only schedules a microtask when
    // it's false, so flipping it pre-emptively traps fibers in tasks until we
    // drive processTasks manually below.
    scheduler.scheduled = true;
    signals.forEach((s) => s.set(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.tasks.size).toBe(5);

    scheduler.scheduled = false;
    scheduler.processTasks();
    expect(scheduler.tasks.size).toBe(0);
    expect(scheduler.scheduled).toBe(false); // no continuation scheduled

    await nextTick();
    const values = Array.from(fixture.querySelectorAll(".leaf")).map((d) => d.textContent);
    expect(values).toEqual(["1", "1", "1", "1", "1"]);
    app.destroy();
  });

  test("budget=0: each processTasks pass completes one fiber and schedules a continuation", async () => {
    Scheduler.frameBudgetMs = Infinity;
    const { app, signals, scheduler } = await mountSiblings(5);

    Scheduler.frameBudgetMs = 0;
    scheduler.scheduled = true; // see comment in previous test
    signals.forEach((s) => s.set(1));
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.tasks.size).toBe(5);

    // First pass: one fiber drained, continuation queued via MessageChannel.
    scheduler.scheduled = false;
    scheduler.processTasks();
    expect(scheduler.tasks.size).toBe(4);
    expect(scheduler.scheduled).toBe(true);

    // Force subsequent passes manually by clearing the scheduled flag each time.
    for (let i = 0; i < 10 && scheduler.tasks.size > 0; i++) {
      scheduler.scheduled = false;
      scheduler.processTasks();
    }
    expect(scheduler.tasks.size).toBe(0);

    Scheduler.frameBudgetMs = Infinity;
    await nextTick();
    const values = Array.from(fixture.querySelectorAll(".leaf")).map((d) => d.textContent);
    expect(values).toEqual(["1", "1", "1", "1", "1"]);
    app.destroy();
  });

  test("budget=0: each pass still completes at least one fiber (progress guarantee)", async () => {
    // Guards the invariant: deadline is checked *after* completing a fiber,
    // not before. Otherwise budget=0 would yield on iteration 1 and deadlock.
    Scheduler.frameBudgetMs = Infinity;
    const { app, signals, scheduler } = await mountSiblings(1);

    Scheduler.frameBudgetMs = 0;
    scheduler.scheduled = true; // see comment in first test
    signals[0].set(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(scheduler.tasks.size).toBe(1);

    scheduler.scheduled = false;
    scheduler.processTasks();
    expect(scheduler.tasks.size).toBe(0);
    expect(fixture.querySelector(".leaf")?.textContent).toBe("1");

    app.destroy();
  });
});
