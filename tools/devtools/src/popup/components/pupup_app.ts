import { Component, tags } from "@odoo/owl";

const TEMPLATE = tags.xml/*xml*/ `
    <div t-name="PopUpApp">
      Hello popup !
    </div>
`;

export class PopUpApp extends Component {
    static template = TEMPLATE;
}
