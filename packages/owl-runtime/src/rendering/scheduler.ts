import { processEffects } from "@odoo/owl-core";
import type { ComponentNode } from "../component_node";
import { fibersInError } from "./error_handling";
import { Fiber, RootFiber } from "./fibers";
import { STATUS } from "../status";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

export class Scheduler {
  // Per-tick work budget for the commit pass. Once exceeded inside
  // processTasks, the scheduler yields *to the browser* (paint, input,
  // scroll handlers, etc.) and resumes on the following macrotask.
  // 5ms is React's Scheduler default and Chrome Aurora's recommendation:
  // leaves room in a 16ms frame for the browser's own work, keeps
  // Interaction-to-Next-Paint in the snappy zone, and the per-yield
  // MessageChannel overhead stays well under 1% of total time even for
  // heavy commits. Not a true time-slicer: individual fiber.complete()
  // calls are still atomic. Set to Infinity to disable (drain in one
  // pass) or 0 to force-yield after every fiber.
  static frameBudgetMs = 5;
  tasks: Set<RootFiber> = new Set();
  scheduled: boolean = false;
  cancelledNodes: Set<ComponentNode> = new Set();
  processing = false;
  // Number of component_node.render calls that are currently between
  // addFiber and their `await Promise.resolve()` continuation. Each one
  // owes the scheduler a fiber.render() that decrements counters and may
  // orphan-cancel siblings. processTasks defers itself one microtask while
  // any are pending so it doesn't commit unrelated roots prematurely.
  pendingFiberRenders = 0;
  // Lazily-initialised MessageChannel used for budget-exhaustion yields.
  // postMessage queues a real macrotask, unlike queueMicrotask, so the
  // browser gets a chance to paint and dispatch input between batches.
  // Using MessageChannel (not setTimeout) avoids the 4ms minimum-delay
  // clamp that nested setTimeouts incur — same trick React's Scheduler
  // uses.
  private _yieldChannel: MessageChannel | null = null;

  constructor() {
    this.processTasks = this.processTasks.bind(this);
  }

  private _yieldToBrowser() {
    if (typeof MessageChannel !== "undefined") {
      if (!this._yieldChannel) {
        this._yieldChannel = new MessageChannel();
        this._yieldChannel.port1.onmessage = this.processTasks;
      }
      this._yieldChannel.port2.postMessage(null);
    } else {
      // Non-browser environment (older Node test runner, SSR). Fall back to
      // setTimeout — slower (4ms clamp) but ensures the continuation fires.
      setTimeout(this.processTasks);
    }
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
   * Ensure pending tasks will be processed at the next microtask. Called
   * from setCounter when a root reaches counter 0, and from the async
   * resumption of initiateRender — both are paths that complete *outside*
   * the scheduler's own microtask tick. When called from inside processTasks
   * (e.g. a sub-fiber render brings the root counter to 0), this is a no-op:
   * the commit pass in the same tick will pick it up.
   */
  flush() {
    if (this.processing) {
      return;
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
    if (this.pendingFiberRenders > 0) {
      // A component_node.render is mid-await: its fiber.render() hasn't run
      // yet, so any counter decrements / orphan-cancels that render owes
      // haven't happened. Re-queue and let those microtasks fire first.
      queueMicrotask(this.processTasks);
      return;
    }
    this.processing = true;
    this.scheduled = false;

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
    // render them in the same tick. processEffects sorts observers by
    // priority (component depth) so ancestor renders fire before descendant
    // renders within a single drain — this is the ordering invariant that
    // lets fibers.ts's orphan-scan correctly invalidate descendants whose
    // template branch was removed by the parent's re-render. The safety
    // bound prevents a runaway feedback loop where every render triggers
    // another.
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
    // flush() (typically an async completer). Budget yields need the
    // scheduler itself to resume — and they yield via MessageChannel
    // (macrotask) rather than queueMicrotask, so the browser can paint,
    // process input, and run scroll/IntersectionObserver callbacks between
    // commit batches. That's the whole point of the budget mechanism;
    // microtask-based yields would never let the browser breathe.
    if (yielded && this.tasks.size > 0 && !this.scheduled) {
      this.scheduled = true;
      this._yieldToBrowser();
    }
  }
}
