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

  remainingSeconds = signal(25 * 60);

  formattedTime = computed(() => {
    const total = this.remainingSeconds();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  });
}

mount(TimeTracker, document.body, { templates: TEMPLATES, dev: true });
