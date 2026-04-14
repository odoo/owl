# Time Tracker Tutorial

Build a Pomodoro-style time tracker step by step, learning Owl's core concepts incrementally. Each step introduces one clear concept and builds on the previous one.

## Prerequisites

- Basic JavaScript knowledge
- Familiarity with Owl's `Component` and `mount` basics

---

## Step 1: Static Display

**Goal:** Mount a component that renders a hardcoded timer value.

```javascript
import { Component, mount, xml } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">25:00</div>
    </div>
  `;
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- Basic component structure
- Inline `xml` template
- Mounting to the DOM

---

## Step 2: Reactive State

**Goal:** Replace the hardcoded value with a signal and computed formatting.

```javascript
import { Component, mount, xml, signal, computed } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
    </div>
  `;

  remainingSeconds = signal(25 * 60); // 25 minutes in seconds

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- `signal()` for reactive state
- `computed()` for derived values
- Calling signals as functions in computed

---

## Step 3: Start/Pause Controls

**Goal:** Add a button that starts/pauses the timer with proper lifecycle cleanup.

```javascript
import { Component, mount, xml, signal, computed, onWillUnmount } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
      <button t-on-click="this.toggleTimer">
        <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
      </button>
    </div>
  `;

  remainingSeconds = signal(25 * 60);
  isRunning = signal(false);
  intervalId = null;

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });

  toggleTimer() {
    if (this.isRunning()) {
      // Pause
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      // Start
      this.intervalId = setInterval(() => {
        if (this.remainingSeconds() > 0) {
          this.remainingSeconds.set(this.remainingSeconds() - 1);
        } else {
          clearInterval(this.intervalId);
          this.intervalId = null;
          this.isRunning.set(false);
        }
      }, 1000);
    }
    this.isRunning.set(!this.isRunning());
  }

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- Event handlers with `t-on-click`
- Conditional rendering in templates
- `onWillUnmount` for cleanup
- Managing side effects

---

## Step 4: Reset Functionality

**Goal:** Add a reset button with configurable duration.

```javascript
import { Component, mount, xml, signal, computed, onWillUnmount } from "@odoo/owl";

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker">
      <h1>Time Tracker</h1>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
      <div class="controls">
        <button t-on-click="this.toggleTimer">
          <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
        </button>
        <button t-on-click="this.reset">Reset</button>
      </div>
    </div>
  `;

  duration = signal(25 * 60);
  remainingSeconds = signal(25 * 60);
  isRunning = signal(false);
  intervalId = null;

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });

  toggleTimer() {
    if (this.isRunning()) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      this.intervalId = setInterval(() => {
        if (this.remainingSeconds() > 0) {
          this.remainingSeconds.set(this.remainingSeconds() - 1);
        } else {
          clearInterval(this.intervalId);
          this.intervalId = null;
          this.isRunning.set(false);
        }
      }, 1000);
    }
    this.isRunning.set(!this.isRunning());
  }

  reset() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.remainingSeconds.set(this.duration());
  }

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- Multiple signals for different concerns
- Resetting state to initial values
- Coordinating multiple state updates

---

## Step 5: Work/Break Phases

**Goal:** Switch between work (25 min) and break (5 min) phases automatically.

```javascript
import { Component, mount, xml, signal, computed, onWillUnmount } from "@odoo/owl";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker" t-att-class="this.phaseClass()">
      <h1>Time Tracker</h1>
      <div class="phase-label">
        <t t-out="this.isWorkPhase() ? 'Work Session' : 'Break Time'"/>
      </div>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
      <div class="controls">
        <button t-on-click="this.toggleTimer">
          <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
        </button>
        <button t-on-click="this.reset">Reset</button>
        <button t-on-click="this.skipPhase">Skip</button>
      </div>
    </div>
  `;

  isWorkPhase = signal(true);
  remainingSeconds = signal(WORK_DURATION);
  isRunning = signal(false);
  intervalId = null;

  get duration() {
    return this.isWorkPhase() ? WORK_DURATION : BREAK_DURATION;
  }

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });

  phaseClass = computed(() => (this.isWorkPhase() ? "work-phase" : "break-phase"));

  toggleTimer() {
    if (this.isRunning()) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      this.intervalId = setInterval(() => {
        if (this.remainingSeconds() > 0) {
          this.remainingSeconds.set(this.remainingSeconds() - 1);
        } else {
          // Switch phases when timer reaches zero
          this.switchPhase();
        }
      }, 1000);
    }
    this.isRunning.set(!this.isRunning());
  }

  switchPhase() {
    this.isWorkPhase.set(!this.isWorkPhase());
    this.remainingSeconds.set(this.duration);
  }

  skipPhase() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.switchPhase();
  }

  reset() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.remainingSeconds.set(this.duration);
  }

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- Conditional rendering with ternary operators
- Dynamic CSS classes with `t-att-class`
- State machine pattern for phase transitions

---

## Step 6: Progress Bar

**Goal:** Add a visual progress indicator.

```javascript
import { Component, mount, xml, signal, computed, onWillUnmount } from "@odoo/owl";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker" t-att-class="this.phaseClass()">
      <h1>Time Tracker</h1>
      <div class="phase-label">
        <t t-out="this.isWorkPhase() ? 'Work Session' : 'Break Time'"/>
      </div>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" t-att-style="this.progressStyle()"/>
      </div>
      <div class="controls">
        <button t-on-click="this.toggleTimer">
          <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
        </button>
        <button t-on-click="this.reset">Reset</button>
        <button t-on-click="this.skipPhase">Skip</button>
      </div>
    </div>
  `;

  isWorkPhase = signal(true);
  remainingSeconds = signal(WORK_DURATION);
  isRunning = signal(false);
  intervalId = null;

  get duration() {
    return this.isWorkPhase() ? WORK_DURATION : BREAK_DURATION;
  }

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });

  phaseClass = computed(() => (this.isWorkPhase() ? "work-phase" : "break-phase"));

  progress = computed(() => {
    const total = this.duration;
    const remaining = this.remainingSeconds();
    return ((total - remaining) / total) * 100;
  });

  progressStyle = computed(() => `width: ${this.progress()}%`);

  toggleTimer() {
    if (this.isRunning()) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      this.intervalId = setInterval(() => {
        if (this.remainingSeconds() > 0) {
          this.remainingSeconds.set(this.remainingSeconds() - 1);
        } else {
          this.switchPhase();
        }
      }, 1000);
    }
    this.isRunning.set(!this.isRunning());
  }

  switchPhase() {
    this.isWorkPhase.set(!this.isWorkPhase());
    this.remainingSeconds.set(this.duration);
  }

  skipPhase() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.switchPhase();
  }

  reset() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.remainingSeconds.set(this.duration);
  }

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

Add CSS for the progress bar:

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-fill {
  height: 100%;
  background: #4caf50;
  transition: width 1s linear;
}

.work-phase .progress-fill {
  background: #f44336;
}

.break-phase .progress-fill {
  background: #4caf50;
}
```

**Concepts learned:**

- Computed values for visual properties
- Dynamic inline styles with `t-att-style`
- Connecting reactivity to visual feedback

---

## Step 7: Session History

**Goal:** Track completed work sessions.

```javascript
import { Component, mount, xml, signal, computed, onWillUnmount } from "@odoo/owl";

const WORK_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

class TimeTracker extends Component {
  static template = xml`
    <div class="time-tracker" t-att-class="this.phaseClass()">
      <h1>Time Tracker</h1>
      <div class="phase-label">
        <t t-out="this.isWorkPhase() ? 'Work Session' : 'Break Time'"/>
      </div>
      <div class="timer-display">
        <t t-out="this.formattedTime()"/>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" t-att-style="this.progressStyle()"/>
      </div>
      <div class="controls">
        <button t-on-click="this.toggleTimer">
          <t t-out="this.isRunning() ? 'Pause' : 'Start'"/>
        </button>
        <button t-on-click="this.reset">Reset</button>
        <button t-on-click="this.skipPhase">Skip</button>
      </div>
      <div class="sessions" t-if="this.sessions().length">
        <h3>Completed Sessions</h3>
        <ul>
          <t t-foreach="this.sessions()" t-as="session" t-key="session.id">
            <li>
              <t t-out="session.completedAt"/>
            </li>
          </t>
        </ul>
      </div>
    </div>
  `;

  isWorkPhase = signal(true);
  remainingSeconds = signal(WORK_DURATION);
  isRunning = signal(false);
  sessions = signal.Array([]);
  sessionId = 0;
  intervalId = null;

  get duration() {
    return this.isWorkPhase() ? WORK_DURATION : BREAK_DURATION;
  }

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });

  phaseClass = computed(() => (this.isWorkPhase() ? "work-phase" : "break-phase"));

  progress = computed(() => {
    const total = this.duration;
    const remaining = this.remainingSeconds();
    return ((total - remaining) / total) * 100;
  });

  progressStyle = computed(() => `width: ${this.progress()}%`);

  toggleTimer() {
    if (this.isRunning()) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    } else {
      this.intervalId = setInterval(() => {
        if (this.remainingSeconds() > 0) {
          this.remainingSeconds.set(this.remainingSeconds() - 1);
        } else {
          this.completePhase();
        }
      }, 1000);
    }
    this.isRunning.set(!this.isRunning());
  }

  completePhase() {
    // Only record completed work sessions
    if (this.isWorkPhase()) {
      this.sessions.push({
        id: this.sessionId++,
        completedAt: new Date().toLocaleTimeString(),
      });
    }
    this.switchPhase();
  }

  switchPhase() {
    this.isWorkPhase.set(!this.isWorkPhase());
    this.remainingSeconds.set(this.duration);
  }

  skipPhase() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.switchPhase();
  }

  reset() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.remainingSeconds.set(this.duration);
  }

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES });
```

**Concepts learned:**

- `signal.Array` for reactive arrays
- List rendering with `t-foreach`
- Push operations on reactive arrays

---

## Concepts Summary

| Step | Owl Concepts                                      |
| ---- | ------------------------------------------------- |
| 1    | Component, xml template, mount                    |
| 2    | signal(), computed(), reactive state              |
| 3    | Event handlers, onWillUnmount, side effects       |
| 4    | Multiple signals, state coordination              |
| 5    | Conditional rendering, t-att-class, state machine |
| 6    | Computed + styling, t-att-style                   |
| 7    | signal.Array, t-foreach, list rendering           |

Each step produces a working application. You can stop at any step and still have a useful timer!
