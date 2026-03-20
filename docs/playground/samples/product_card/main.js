import { Component, mount, xml } from "@odoo/owl";
import { ProductCard } from "./product_card";

class Root extends Component {
  static components = { ProductCard };
  static template = xml`
        <div class="product-grid">
          <t t-foreach="this.products" t-as="p" t-key="p.id">
            <ProductCard name="p.name" price="p.price" image="p.image"/>
          </t>
        </div>`;

  products = [
    { id: 1, name: "Wireless Headphones", price: 79.99, image: "🎧" },
    { id: 2, name: "Mechanical Keyboard", price: 129.99, image: "⌨️" },
    { id: 3, name: "USB-C Hub", price: 49.99 },
    { id: 4, name: "Webcam HD", price: 59.99, image: "📷" },
  ];
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
