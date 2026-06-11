import { ClockApp } from "./clock_app";
import { Clock as ClockSystray } from "./clock_systray";

export const clock = {
    name: "Clock",
    icon: "🕐",
    window: ClockApp,
    systrayItems: [ClockSystray],
};
