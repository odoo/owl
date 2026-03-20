import { Component, xml, props, types as t } from "@odoo/owl";

export class ProductCard extends Component {
    static template = xml`
      <div class="product-card">
        <span t-out="this.props.image or '📦'"/>
        <div>
          <div t-out="this.props.name"/>
          <div t-out="this.props.description"/>
          <div>$<t t-out="this.props.price.toFixed(2)"/></div>
        </div>
      </div>`;

    props = props({
        name: t.string,
        description: t.string,
        price: t.number,
        "image?": t.string,
    });
}
