/** @odoo-module **/

import { Component, onWillRender, onRendered, onMounted, markup} from "@odoo/owl";

export default class TreeElement extends Component {
    setup(){
    }

    
    static template = "devtools.tree_element";

    static props = ['name', 'properties', 'children', 'path', 'key', 'display', 'toggled', 'depth', 'selected', 'highlighted'];

    static components = { TreeElement };

    toggleDisplay(ev){
        ev.stopPropagation();
        ev.target.classList.toggle("caret-down");
        this.props.toggled = !this.props.toggled;
        this.props.children.forEach(child => {
            this.swapDisplay(child, this.props.toggled, this.props.toggled)
        });
        this.props.updateComponent(this.props);
    }

    getMinimizedKey(){
        let split = this.props.key.split("__");
        let key;
        if (split.length > 2){
            key = this.props.key.substring(4 + split[1].length, this.props.key.length);
            key = markup('<div class="text-warning" style="display:inline;">key</div>="' + key + '"');
        }
        else{
            key = "";
        }
        return key;
    }

    swapDisplay(element, toggled, display){
        if(!display){
            element.display = false;
        }
        else if(toggled){
            element.display = true;
        }
        element.children.forEach(child => {
            this.swapDisplay(child, element.toggled, element.display)
        });
    }

    toggleComponent(ev){
        ev.stopPropagation();
        if(!this.props.selected){
            this.props.selectComponent(this.props);
        }
    }
}
