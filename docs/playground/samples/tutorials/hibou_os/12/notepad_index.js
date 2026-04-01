import { NotepadApp } from "./notepad_app";
import { NotepadPlugin } from "./notepad_plugin";

export const notepad = {
    name: "Notepad",
    icon: "📝",
    window: NotepadApp,
    plugins: [NotepadPlugin],
};
