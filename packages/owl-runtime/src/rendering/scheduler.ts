import { getId, isDebugEnabled, logEvent } from "@odoo/owl-core";
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
  tasks: Set<RootFiber> = new Set();
  requestAnimationFrame: Window["requestAnimationFrame"];
  frame: number = 0;
  delayedRenders: Fiber[] = [];
  cancelledNodes: Set<ComponentNode> = new Set();
  processing = false;

  constructor() {
    this.requestAnimationFrame = Scheduler.requestAnimationFrame;
    this.processTasks = this.processTasks.bind(this);
  }

  addFiber(fiber: Fiber) {
    if (isDebugEnabled()) {
      logEvent("scheduler:addFiber", {
        rootFiberId: getId(fiber.root!),
        nodeId: getId(fiber.root!.node),
        name: fiber.root!.node.componentName,
        tasksSize: this.tasks.size,
      });
    }
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
      if (isDebugEnabled()) {
        logEvent("scheduler:tick-skip", { reason: "already-processing" });
      }
      return;
    }
    if (isDebugEnabled()) {
      logEvent("scheduler:tick-start", {
        tasksSize: this.tasks.size,
        cancelledNodes: this.cancelledNodes.size,
      });
    }
    this.processing = true;
    this.frame = 0;
    for (let node of this.cancelledNodes) {
      node._destroy();
    }
    this.cancelledNodes.clear();
    if (isDebugEnabled()) {
      logEvent("scheduler:commit-start", { tasksSize: this.tasks.size });
    }
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
      }
    }
    for (let task of this.tasks) {
      if (task.node.status === STATUS.DESTROYED) {
        this.tasks.delete(task);
      }
    }
    this.processing = false;
    if (isDebugEnabled()) {
      logEvent("scheduler:tick-end", { tasksSize: this.tasks.size });
    }
  }
}
