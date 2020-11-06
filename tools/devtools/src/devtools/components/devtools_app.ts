import { Component, tags } from "@odoo/owl";

const TEMPLATE = tags.xml/*xml*/ `
    <div t-name="DevtoolsApp">
        Hello devtools app !
    </div>
`;

export class DevtoolsApp extends Component {
    static template = TEMPLATE;
}
