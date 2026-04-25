import { processEffects } from "@odoo/owl-core";
import type { ComponentNode } from "../component_node";
import { fibersInError } from "./error_handling";
import { Fiber, RootFiber } from "./fibers";
import { STATUS } from "../status";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

export class Scheduler {
  // Per-tick work budget. Once exceeded inside processTasks, the scheduler
  // yields and resumes on the next tick. Keeps the main thread responsive
  // when many independent root fibers commit in the same turn (e.g. a batch
  // of kanban cards each reacting to their own signal). Not a true
  // time-slicer: individual fiber.complete() calls are still atomic.
  // Set to Infinity to disable (drain in one pass, the pre-budgeting behavior).
  static frameBudgetMs = 5;
  tasks: Set<RootFiber> = new Set();
  scheduled: boolean = false;
  delayedRenders: Fiber[] = [];
  cancelledNodes: Set<ComponentNode> = new Set();
  processing = false;

  constructor() {
    this.processTasks = this.processTasks.bind(this);
  }

  addFiber(fiber: Fiber) {
    this.tasks.add(fiber.root!);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(this.processTasks);
    }
  }

  scheduleDestroy(node: ComponentNode) {
    this.cancelledNodes.add(node);
    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(this.processTasks);
    }
  }

  /**
   * Ensure pending tasks will be processed at the next microtask. Also
   * drains any renders deferred by the ancestor-walk in Fiber.render. Called
   * from setCounter when a root reaches counter 0, and from the async
   * resumption of initiateRender — both are paths that complete *outside* the
   * scheduler's own microtask tick. When called from inside processTasks (e.g. a
   * sub-fiber render brings the root counter to 0), this is a no-op: the
   * commit pass in the same tick will pick it up.
   */
  flush() {
    if (this.processing) {
      return;
    }
    if (this.delayedRenders.length) {
      let renders = this.delayedRenders;
      this.delayedRenders = [];
      for (let f of renders) {
        if (f.root && f.node.status !== STATUS.DESTROYED && f.node.fiber === f) {
          f.render();
        }
      }
    }

    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(this.processTasks);
    }
  }

  processTasks() {
    if (this.processing) {
      return;
    }
    this.processing = true;
    this.scheduled = false;

    // Drain renders that were deferred by the ancestor-walk in Fiber.render.
    if (this.delayedRenders.length) {
      let renders = this.delayedRenders;
      this.delayedRenders = [];
      for (let f of renders) {
        if (f.root && f.node.status !== STATUS.DESTROYED && f.node.fiber === f) {
          f.render();
        }
      }
    }

    // Render pass: produce a fresh bdom for every pending root that hasn't
    // been rendered yet this tick. Sub-fibers (children created during a
    // root's render) render synchronously from inside fiber.render itself,
    // as they always have. willStart-having children remain async and
    // resume after this microtask tick — they then call flush() to schedule
    // the next tick for their commit.
    //
    // Render+drain loop: a render that writes a signal queues observer
    // effects via the reactive batcher (microtask). Calling processEffects()
    // synchronously drains those observers right here — they invoke
    // node.render which adds new fibers to `tasks`, and we re-iterate to
    // render them in the same tick. The safety bound prevents a runaway
    // feedback loop where every render triggers another.
    let safety = 0;
    while (safety++ < 10) {
      let renderedAny = false;
      for (let fiber of this.tasks) {
        if (fiber.root !== fiber) continue;
        if (fiber.node.status === STATUS.DESTROYED) continue;
        if (fibersInError.has(fiber)) continue;
        // Skip fibers still waiting on willStart — initiateRender will clear
        // `pending` and call flush() once it resolves; we'll catch them on a
        // subsequent tick.
        if ((fiber as any).pending) continue;
        if (fiber.bdom === null) {
          fiber.render();
          renderedAny = true;
        }
      }
      processEffects();
      if (!renderedAny) {
        break;
      }
    }

    // Destroy cancelled nodes after the render pass. willDestroy hooks may
    // throw and trigger onError → state change → another render, but that
    // re-render is scheduled for the *next* tick; the bdoms produced this
    // tick still reflect pre-error state, matching the old microtask-render
    // ordering tests rely on.
    for (let node of this.cancelledNodes) {
      node._destroy();
    }
    this.cancelledNodes.clear();

    // Commit pass: apply ready fibers to the DOM.
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
        // Yield once we've exhausted the per-tick budget — but only *after*
        // completing a fiber, so each tick always makes progress. Use >= so
        // budget=0 (force-yield mode) works even if a fast fiber didn't
        // advance performance.now() past the deadline.
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
    if (yielded && this.tasks.size > 0 && !this.scheduled) {
      this.scheduled = true;
      queueMicrotask(this.processTasks);
    }
  }
}
