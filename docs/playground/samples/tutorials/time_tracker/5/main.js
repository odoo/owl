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

mount(TimeTracker, document.body, { templates: TEMPLATES, dev: true });
