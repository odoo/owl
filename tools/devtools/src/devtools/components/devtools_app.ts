import { Component, tags } from "@odoo/owl";
import Tab from './tab'

const TEMPLATE = tags.xml/*xml*/ `
    <div t-name="DevtoolsApp">

        <nav class="flex py-1 border-b-2 border-gray-200">
            
            <Tab active="true" name="'Component Tree'" />
            <Tab active="false" name="'Events'" />

        </nav>

    </div>
`;

export class DevtoolsApp extends Component {
    static template = TEMPLATE;

    static components = { Tab }

}
