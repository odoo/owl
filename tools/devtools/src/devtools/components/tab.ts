import { Component, tags } from "@odoo/owl";

const TEMPLATE = tags.xml/*xml*/ `
   <div 
    t-name="Tab"
    class="cursor-pointer px-3 py-2 font-medium text-sm leading-5 rounded-md ml-4 focus:outline-none"
    t-att-class="props.active 
                ? 'text-indigo-700 bg-indigo-100 focus:text-indigo-800 focus:bg-indigo-200'
                : 'text-gray-500 hover:text-gray-700 focus:text-indigo-600 focus:bg-indigo-50'"
    >
        <t t-esc="props.name" />
    </div>
`;

export default class Tab extends Component {

    static props = ['name', 'active']
    
    static template = TEMPLATE;

}
