import { Component, tags, useState } from "@odoo/owl";

const TEMPLATE = tags.xml/*xml*/ `
   <div 
    t-name="TreeElement"
    class="cursor-pointer hover:bg-indigo-100 mx-2 rounded-sm px-2 py-1 text-sm"
   >
        <t t-esc="props.tag" /> 

    </div>
`;

export default class TreeElement extends Component {
    
    static template = TEMPLATE;

    static props = ['tag', 'depth']

}
