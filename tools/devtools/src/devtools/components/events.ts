import { Component, tags } from "@odoo/owl";

const TEMPLATE = tags.xml/*xml*/ `
   <div t-name="Events">

        Events page

    </div>
`;

export default class Events extends Component {
    
    static template = TEMPLATE;


}
