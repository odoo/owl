import { Component, xml, useProps, t } from "@odoo/owl";

export class ProductCard extends Component {
    static template = xml`
      <div class="product-card">
        <span t-out="this.props.image"/>
        <div>
          <div t-out="this.props.name"/>
          <div t-out="this.props.description"/>
          <div>$<t t-out="this.props.price.toFixed(2)"/></div>
        </div>
      </div>`;

    props = useProps({
        name: t.string(),
        description: t.string(),
        price: t.number(),
        image: t.string().optional("📦"),
    });
}
