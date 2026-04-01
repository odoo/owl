import { menuItemRegistry } from "../../core/registries";
import { BrowserApp } from "./browser_app";

menuItemRegistry.add("browser", { name: "Browser", icon: "🌐", window: BrowserApp, width: 800, height: 600 });
