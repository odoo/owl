import type { ComponentNode } from "../component_node";
import { fibersInError } from "./error_handling";
import { Fiber, RootFiber } from "./fibers";
import { STATUS } from "../status";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

let requestAnimationFrame: Window["requestAnimationFrame"];
if (typeof window !== "undefined") {
  requestAnimationFrame = window.requestAnimationFrame.bind(window);
}

export class Scheduler {
  // capture the value of requestAnimationFrame as soon as possible, to avoid
  // interactions with other code, such as test frameworks that override them
  static requestAnimationFrame = requestAnimationFrame;
  // Per-frame work budget. Once exceeded inside processTasks, the scheduler
  // yields via RAF and resumes on the next frame. Keeps the main thread
  // responsive when many independent root fibers commit in the same tick
  // (e.g. a batch of kanban cards each reacting to their own signal). Not a
  // true time-slicer: individual fiber.complete() calls are still atomic.
  // Set to Infinity to disable (drain in one pass, the pre-budgeting behavior).
  static frameBudgetMs = 5;
  tasks: Set<RootFiber> = new Set();
  requestAnimationFrame: Window["requestAnimationFrame"];
  frame: number = 0;
  cancelledNodes: Set<ComponentNode> = new Set();
  processing = false;

  constructor() {
    this.requestAnimationFrame = Scheduler.requestAnimationFrame;
    this.processTasks = this.processTasks.bind(this);
  }

  addFiber(fiber: Fiber) {
    this.tasks.add(fiber.root!);
  }

  scheduleDestroy(node: ComponentNode) {
    this.cancelledNodes.add(node);
    if (this.frame === 0) {
      this.frame = this.requestAnimationFrame(this.processTasks);
    }
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
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
    for (let node of this.cancelledNodes) {
      node._destroy();
    }
    this.cancelledNodes.clear();
    const deadline = performance.now() + Scheduler.frameBudgetMs;
    let yielded = false;
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
        if (fiber.appliedToDom) {
          this.tasks.delete(fiber);
        }
        // Yield to the browser once we've exhausted the per-frame budget — but
        // only *after* completing a fiber, so each tick always makes progress.
        // Use >= so budget=0 (force-yield mode) works even if a fast fiber
        // didn't advance performance.now() past the deadline.
        if (performance.now() >= deadline) {
          yielded = true;
          break;
        }
      }
    }
    for (let task of this.tasks) {
      if (task.node.status === STATUS.DESTROYED) {
        this.tasks.delete(task);
      }
    }
    this.processing = false;
    // Ready fibers still in the queue only re-run when someone else calls
    // flush() (typically an async completer). But budget yields and incomplete
    // counters need the scheduler itself to resume — schedule a continuation.
    if (yielded && this.tasks.size > 0 && this.frame === 0) {
      this.frame = this.requestAnimationFrame(this.processTasks);
    }
  }
}
