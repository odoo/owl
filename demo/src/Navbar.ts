import Widget from "../../src/core/widget";

const template = `
    <div class="o_navbar">
        <span class="title">Odoo</span>
        <ul>
            <li t-foreach="state.items" t-as="item">
                <a href="someaction"><t t-esc="item.title"/></a>
            </li>
        </ul>
    </div>
`;

export default class Navbar extends Widget {
  name = "navbar";
  template = template;
  state = {
    items: [{title: 'Discuss'}, {title: 'CRM'}]
  };
}
