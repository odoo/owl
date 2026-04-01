import { menuItemRegistry, systrayItemRegistry } from "../../core/registries";
import { ClockApp } from "./clock_app";
import { Clock as ClockSystray } from "./clock_systray";

menuItemRegistry.add("clock", { name: "Clock", icon: "🕐", window: ClockApp });
systrayItemRegistry.add("clock", ClockSystray);
