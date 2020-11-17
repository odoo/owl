import { Component, tags, useState } from "@odoo/owl";
import Tab from './tab'
import Tree from './tree'
import Events from './events'

const TEMPLATE = tags.xml/*xml*/ `
    <div t-name="DevtoolsApp" t-on-tab-clicked="changePage">

        <nav class="flex py-1 border-b-2 border-gray-200">
            
            <Tab componentName="'Tree'" active="state.page == 'Tree'" name="'Component Tree'" />
            <Tab componentName="'Events'" active="state.page == 'Events'" name="'Events'" />

        </nav>

        <div class="mt-2">
        
            <t t-component="{{state.page}}" t-key="state.page" />

        </div>

    </div>
`;

export class DevtoolsApp extends Component {
    static template = TEMPLATE;

    static components = { Tab, Tree, Events }

    state = useState({
        page: 'Tree'
    })

    private changePage({detail}) {
        this.state.page = detail.component
    }

}
