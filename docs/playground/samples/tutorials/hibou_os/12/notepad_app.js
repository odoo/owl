import { Component, xml, plugin } from "@odoo/owl";
import { NotepadPlugin } from "./notepad_plugin";

export class NotepadApp extends Component {
    static template = xml`
      <textarea class="notepad" placeholder="Start typing..." t-model="this.notepad.text"/>`;

    notepad = plugin(NotepadPlugin);
}
