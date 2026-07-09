import { Component, xml, signal, useProps, t, onMounted, onWillUnmount } from "@odoo/owl";

export class Timer extends Component {
    static template = xml`
      <div class="timer">
        <span t-out="this.value()"/>
      </div>`;

    props = useProps({
        increment: t.number(),
    });

    value = signal(0);

    setup() {
        let intervalId;
        onMounted(() => {
            intervalId = setInterval(() => {
                this.value.set(this.value() + this.props.increment);
            }, 1000);
        });
        onWillUnmount(() => {
            clearInterval(intervalId);
        });
    }
}
