import { Component, xml } from "@odoo/owl";

export class NotepadApp extends Component {
    static template = xml`
      <textarea class="notepad" placeholder="Start typing..."/>`;
}
