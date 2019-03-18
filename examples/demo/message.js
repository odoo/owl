const template = `
    <div class="message">
        <span class="author"><t t-esc="props.author"/></span>
        <span class="msg"><t t-esc="props.msg"/></span>
        <button class="remove" t-on-click="removeMessage">Remove</button>
    </div>`;

export class Message extends odoo.core.Component {
  constructor(parent, props) {
    super(parent, props);
    this.inlineTemplate = template;
  }

  removeMessage() {
    this.trigger("remove_message", {
      id: this.props.id
    });
  }
}
