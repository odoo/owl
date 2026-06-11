import { Component, signal, onMounted, onWillUnmount } from "@odoo/owl";

export class Clock extends Component {
    static template = "hibou.Clock";

    time = signal("");

    setup() {
        let intervalId;
        const updateTime = () => {
            this.time.set(new Date().toLocaleTimeString());
        };
        updateTime();
        onMounted(() => {
            intervalId = setInterval(updateTime, 1000);
        });
        onWillUnmount(() => {
            clearInterval(intervalId);
        });
    }
}
