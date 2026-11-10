import { STATUS } from "@odoo/owl-core";
import { fibersInError } from "./error_handling";
import { APPLIED_TO_DOM, Fiber, RootFiber } from "./fibers";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

let requestAnimationFrame: Window["requestAnimationFrame"];
if (typeof window !== "undefined") {
  requestAnimationFrame = window.requestAnimationFrame.bind(window);
}
// captured early for the same reason as requestAnimationFrame (see below)
const setTimeout = globalThis.setTimeout.bind(globalThis);

export class Scheduler {
  // capture the value of requestAnimationFrame as soon as possible, to avoid
  // interactions with other code, such as test frameworks that override them
  static requestAnimationFrame = requestAnimationFrame;
  tasks: Set<RootFiber> = new Set();
  requestAnimationFrame: Window["requestAnimationFrame"];
  frame: number = 0;
  delayedRenders: Fiber[] = [];
  processing = false;
  // fibers recycled by makeRootFiber since the last task boundary, see
  // trackRecycle
  recycled: Fiber[] = [];

  constructor() {
    this.requestAnimationFrame = Scheduler.requestAnimationFrame;
    this.processTasks = this.processTasks.bind(this);
  }

  addFiber(fiber: Fiber) {
    this.tasks.add(fiber.root!);
  }

  /**
   * Called each time makeRootFiber recycles an uncommitted fiber. A render
   * loop (#1968) is driven by microtasks only, so the timeout scheduled here
   * cannot run while it spins, and the recycle count climbs until it is
   * detected. Updates coming from separate tasks (timers, network) while
   * commits are on hold, e.g. in a hidden tab where rAF does not run (#2062),
   * let the timeout run in between and reset the count.
   */
  trackRecycle(fiber: Fiber) {
    if (!this.recycled.length) {
      setTimeout(() => {
        for (let f of this.recycled) {
          f.renderState &= APPLIED_TO_DOM; // clear the recycle count
        }
        this.recycled = [];
      });
    }
    this.recycled.push(fiber);
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
    if (this.delayedRenders.length) {
      let renders = this.delayedRenders;
      this.delayedRenders = [];
      for (let f of renders) {
        if (f.root && f.node.status !== STATUS.DESTROYED && f.node.fiber === f) {
          f.render();
        }
      }
    }

    if (this.frame === 0) {
      this.frame = this.requestAnimationFrame(this.processTasks);
    }
  }

  processTasks() {
    if (this.processing) {
      return;
    }
    this.processing = true;
    this.frame = 0;
    for (let fiber of this.tasks) {
      if (fiber.root !== fiber) {
        this.tasks.delete(fiber);
        continue;
      }
      const hasError = fibersInError.has(fiber);
      if (hasError && fiber.counter !== 0) {
        this.tasks.delete(fiber);
        continue;
      }
      if (fiber.node.status === STATUS.DESTROYED) {
        this.tasks.delete(fiber);
        continue;
      }
      if (fiber.counter === 0) {
        if (!hasError) {
          fiber.complete();
        }
        // at this point, the fiber should have been applied to the DOM, so we can
        // remove it from the task list. If it is not the case, it means that there
        // was an error and an error handler triggered a new rendering that recycled
        // the fiber, so in that case, we actually want to keep the fiber around,
        // otherwise it will just be ignored.
        if (fiber.renderState & APPLIED_TO_DOM) {
          this.tasks.delete(fiber);
        }
      }
    }
    for (let task of this.tasks) {
      if (task.node.status === STATUS.DESTROYED) {
        this.tasks.delete(task);
      }
    }
    this.processing = false;
  }
}
