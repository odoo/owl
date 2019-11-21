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

  addFiber(fiber): Promise<void> {
    // if the fiber was remapped into a larger rendering fiber, it may not be a
    // root fiber.  But we only want to register root fibers
    fiber = fiber.root;
    return new Promise((resolve, reject) => {
      if (fiber.error) {
        return reject(fiber.error);
      }
      this.tasks.push({
        fiber,
        callback: () => {
          if (fiber.error) {
            return reject(fiber.error);
          }
          resolve();
        }
      });
      if (!this.isRunning) {
        this.scheduleTasks();
      }
    });
  }

  /**
   * Process all current tasks. This only applies to the fibers that are ready.
   * Other tasks are left unchanged.
   */
  flush() {
    let tasks = this.tasks;
    this.tasks = [];
    tasks = tasks.filter(task => {
      if (task.fiber.isCompleted) {
        task.callback();
        return false;
      }
      if (task.fiber.counter === 0) {
        if (!task.fiber.error) {
          try {
            task.fiber.complete();
          } catch (e) {
            task.fiber.handleError(e);
          }
        }
        task.callback();
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

const raf = window.requestAnimationFrame.bind(window);
export const scheduler = new Scheduler(raf);
