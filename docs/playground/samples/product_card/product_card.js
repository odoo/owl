import { Component, props, types as t } from "@odoo/owl";

export class ProductCard extends Component {
    static template = "example.ProductCard";
    
    props = props({ name: t.string, price: t.number, "image?": t.string });
}
