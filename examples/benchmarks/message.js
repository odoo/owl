import { Counter } from "./counter.js";

export class Message extends owl.core.Component {
  inlineTemplate = `
    <div class="message">
        <span class="author"><t t-esc="props.author"/></span>
        <span class="msg"><t t-esc="props.msg"/></span>
        <button class="remove" t-on-click="removeMessage">Remove</button>
        <t t-widget="Counter" t-props="{initialState: props.id}"/>
    </div>`;

  constructor(parent, props) {
    super(parent, props);
    this.widgets = { Counter };
  }

  removeMessage() {
    this.trigger("remove_message", {
      id: this.props.id
    });
  }
}
