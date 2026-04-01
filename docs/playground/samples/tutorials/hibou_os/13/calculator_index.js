import { menuItemRegistry } from "../../core/registries";
import { CalculatorApp } from "./calculator_app";

menuItemRegistry.add("calculator", { name: "Calculator", icon: "🧮", window: CalculatorApp });
