import { RootFiber } from "./fibers";

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

  addFiber(fiber: RootFiber) {
    this.tasks.add(fiber); // no check for unicity. need to be careful here
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
      if (fiber.counter === 0) {
        if (!fiber.error) {
          fiber.complete();
        }
        fiber.resolve();
        this.tasks.delete(fiber);
      }
    });

    // let tasks = this.tasks.[...this.tasks];
    // this.tasks = [];
    // console.log(this.tasks)
    // tasks = tasks.filter((fiber) => {
    //   if (fiber.counter === 0) {
    //     if (!fiber.error) {
    //       fiber.complete();
    //     }
    //     fiber.resolve();
    //     return false;
    //   }
    //   return true;
    // });
    // this.tasks = tasks.concat(this.tasks);
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
