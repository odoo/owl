import { Fiber } from "./fiber";

/**
 * Owl Scheduler Class
 *
 * The scheduler is the part of Owl that will effectively apply a rendering
 * whenever a fiber is ready.
 *
 * Briefly, it can be used to register root fibers.  Whenever there is an
 * active root fiber, it will poll continuously each animation frame (so, about
 * once every 16ms) and whenever a root fiber is ready, it will apply it.
 */

interface Task {
  fiber: Fiber;
  callback: (err?: Error) => void;
}

export class Scheduler {
  tasks: Task[] = [];
  isRunning: boolean = false;
  requestAnimationFrame: typeof window.requestAnimationFrame;

  constructor(requestAnimationFrame) {
    this.requestAnimationFrame = requestAnimationFrame;
  }

  addFiber(fiber, callback) {
    this.tasks.push({ fiber, callback });
    if (this.isRunning) {
      return;
    }
    this.scheduleTasks();
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
    let tasks = this.tasks;
    this.tasks = [];
    tasks = tasks.filter(task => {
      if (task.fiber.isCancelled) {
        return false;
      }
      if (task.fiber.counter === 0) {
        task.callback(task.fiber.error);
        return false;
      }
      return true;
    });
    this.tasks = tasks.concat(this.tasks);
  }

  scheduleTasks() {
    this.isRunning = true;
    this.requestAnimationFrame(() => {
      this.flush();
      if (this.tasks.length > 0) {
        this.scheduleTasks();
      } else {
        this.isRunning = false;
      }
    });
  }
}
