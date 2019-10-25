import { Fiber } from "./fiber";

// scheduler
interface Task {
  fiber: Fiber;
  callback: () => void;
}

export const scheduler = {
  tasks: [] as Task[],
  isRunning: false,

  addFiber(fiber, callback) {
    this.tasks.push({ fiber, callback });
    if (this.isRunning) {
      return;
    }
    this.scheduleTasks();
  },
  flush() {
    let tasks = this.tasks;
    this.tasks = [];
    tasks = tasks.filter(task => {
      if (task.fiber.isCancelled) {
        return false;
      }
      if (task.fiber.counter === 0) {
        task.callback();
        return false;
      }
      return true;
    });
    this.tasks = tasks.concat(this.tasks);
  },
  processTasks() {
    this.flush();
    if (this.tasks.length > 0) {
      this.scheduleTasks();
    } else {
      this.isRunning = false;
    }
  },

  scheduleTasks() {
    this.isRunning = true;
    this.requestAnimationFrame(() => this.processTasks());
  },

  requestAnimationFrame: requestAnimationFrame.bind(window)
};
