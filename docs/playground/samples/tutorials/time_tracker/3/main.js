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

  setup() {
    onWillUnmount(() => {
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
    });
  }
}

mount(TimeTracker, document.body, { templates: TEMPLATES, dev: true });
