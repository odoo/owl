import type { ComponentNode } from "../component_node";
import { fibersInError } from "./error_handling";
import { Fiber, RootFiber } from "./fibers";
import { STATUS } from "../status";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

export class Scheduler {
  // capture the value of requestAnimationFrame as soon as possible, to avoid
  // interactions with other code, such as test frameworks that override them
  static requestAnimationFrame = window.requestAnimationFrame.bind(window);
  tasks: Set<RootFiber> = new Set();
  requestAnimationFrame: Window["requestAnimationFrame"];
  frame: number = 0;
  delayedRenders: Fiber[] = [];
  cancelledNodes: Set<ComponentNode> = new Set();
  processing = false;

  constructor() {
    this.requestAnimationFrame = Scheduler.requestAnimationFrame;
  }

  addFiber(fiber: Fiber) {
    this.tasks.add(fiber.root!);
  }

  scheduleDestroy(node: ComponentNode) {
    this.cancelledNodes.add(node);
    if (this.frame === 0) {
      this.frame = this.requestAnimationFrame(() => this.processTasks());
    }
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
      this.frame = this.requestAnimationFrame(() => this.processTasks());
    }
  }

  processTasks() {
    if (this.processing) {
      return;
    }
    this.processing = true;
    this.frame = 0;

    // Destroy cancelled nodes
    for (let node of this.cancelledNodes) {
      node._destroy();
    }
    this.cancelledNodes.clear();

    // Collect ready fibers
    const readyFibers: RootFiber[] = [];
    for (let task of this.tasks) {
      if (task.root !== task) {
        this.tasks.delete(task);
        continue;
      }
      if (fibersInError.has(task) && task.counter !== 0) {
        this.tasks.delete(task);
        continue;
      }
      if (task.node.status === STATUS.DESTROYED) {
        this.tasks.delete(task);
        continue;
      }
      if (task.counter === 0 && !fibersInError.has(task)) {
        readyFibers.push(task);
      }
    }

    if (readyFibers.length === 1) {
      // Fast path: single fiber, call complete() directly (no sorting needed)
      readyFibers[0].complete();
      if (readyFibers[0].appliedToDom) {
        this.tasks.delete(readyFibers[0]);
      }
    } else if (readyFibers.length > 1) {
      // Sort by cached depth: shallower first (for outside-in willPatch)
      readyFibers.sort((a, b) => (a.node.depthFlags >> 1) - (b.node.depthFlags >> 1));

      // Phase 1: all pre-hooks (outside-in order)
      for (let fiber of readyFibers) fiber.callWillPatch();

      // Phase 2: all DOM operations
      for (let fiber of readyFibers) fiber.applyPatch();

      // Phase 3: all post-hooks (inside-out = reversed order)
      for (let i = readyFibers.length - 1; i >= 0; i--) {
        readyFibers[i].callPostPatchHooks();
      }

      // Cleanup
      for (let fiber of readyFibers) {
        if (fiber.appliedToDom) {
          this.tasks.delete(fiber);
        }
      }
    }

    // Cleanup destroyed
    for (let task of this.tasks) {
      if (task.node.status === STATUS.DESTROYED) {
        this.tasks.delete(task);
      }
    }
    this.processing = false;
  }
}
