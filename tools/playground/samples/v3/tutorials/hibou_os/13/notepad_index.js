import { menuItemRegistry, pluginRegistry } from "../../core/registries";
import { NotepadApp } from "./notepad_app";
import { NotepadPlugin } from "./notepad_plugin";

menuItemRegistry.add("notepad", { name: "Notepad", icon: "📝", window: NotepadApp });
pluginRegistry.add("notepad", NotepadPlugin);
