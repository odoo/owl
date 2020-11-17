import { Component, tags } from "@odoo/owl";
import TreeElement from './tree_element'

const TEMPLATE = tags.xml/*xml*/ `
   <div t-name="Tree">
    
        <TreeElement tag="'App'" depth="0" /> 
        <TreeElement tag="'Tab'" depth="1"/> 
        <TreeElement tag="'Tab'" depth="1"/> 
        <TreeElement tag="'Tree'" depth="1"/> 
        <TreeElement tag="'TreeElement'" depth="2"/> 
        <TreeElement tag="'TreeElement'" depth="2"/> 
        <TreeElement tag="'TreeElement'" depth="2"/> 
        <TreeElement tag="'TreeElement'" depth="2"/> 

    </div>
`;

export default class Tree extends Component {
    
    static template = TEMPLATE;

    static components = { TreeElement }

}
