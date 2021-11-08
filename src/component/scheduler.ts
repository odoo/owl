import { Fiber, RootFiber } from "./fibers";
import { handleError, fibersInError } from "./error_handling";
import { STATUS } from "./status";

// -----------------------------------------------------------------------------
//  Scheduler
// -----------------------------------------------------------------------------

export class Scheduler {
  tasks: Set<RootFiber> = new Set();
  isRunning: boolean = false;
  requestAnimationFrame: Window["requestAnimationFrame"];

  constructor(requestAnimationFrame: Window["requestAnimationFrame"]) {
    this.requestAnimationFrame = requestAnimationFrame;
  }

  start() {
    this.isRunning = true;
    this.scheduleTasks();
  }

  stop() {
    this.isRunning = false;
  }

  addFiber(fiber: Fiber) {
    this.tasks.add(fiber.root);
    if (!this.isRunning) {
      this.start();
    }
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
    this.tasks.forEach((fiber) => {
      if (fiber.root !== fiber) {
        // this is wrong! should be something like
        // if (this.tasks.has(fiber.root)) {
        //   // parent rendering has completed
        //   fiber.resolve();
        //   this.tasks.delete(fiber);
        // }
        this.tasks.delete(fiber);
        return;
      }
      const hasError = fibersInError.has(fiber);
      if (hasError && fiber.counter !== 0) {
        this.tasks.delete(fiber);
        fiber.reject(fibersInError.get(fiber));
        return;
      }
      if (fiber.node.status === STATUS.DESTROYED) {
        this.tasks.delete(fiber);
        return;
      }

      if (fiber.counter === 0) {
        if (!hasError) {
          try {
            fiber.complete();
            fiber.resolve();
          } catch (e) {
            handleError(fiber.node, e);
            fiber.reject(e);
          }
        }
        this.tasks.delete(fiber);
      }
    });
    if (this.tasks.size === 0) {
      this.stop();
    }
  }

  scheduleTasks() {
    this.requestAnimationFrame(() => {
      this.flush();
      if (this.isRunning) {
        this.scheduleTasks();
      }
    });
  }
}
