import { Component, useProps, t } from "@odoo/owl";

export class ProductCard extends Component {
    static template = "example.ProductCard";

    props = useProps({
        name: t.string(),
        price: t.number(),
        image: t.string().optional(),
    });
}
