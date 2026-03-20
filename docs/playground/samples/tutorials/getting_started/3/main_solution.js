import { Component, mount, xml } from "@odoo/owl";
import { ProductCard } from "./product_card";

class Root extends Component {
    static components = { ProductCard };
    static template = xml`
      <div class="product-grid">
        <ProductCard name="this.headphone.name" description="this.headphone.description" price="this.headphone.price" image="this.headphone.image"/>
        <ProductCard name="this.keyboard.name" description="this.keyboard.description" price="this.keyboard.price" image="this.keyboard.image"/>
        <ProductCard name="this.webcam.name" description="this.webcam.description" price="this.webcam.price" image="this.webcam.image"/>
      </div>`;

    headphone = {
        name: "Wireless Headphones",
        description: "Noise-cancelling over-ear headphones",
        price: 79.99,
        image: "🎧",
    };
    keyboard = {
        name: "Mechanical Keyboard",
        description: "RGB backlit mechanical keyboard",
        price: 129.99,
        image: "⌨️",
    };
    webcam = {
        name: "Webcam HD",
        description: "1080p webcam with microphone",
        price: 59.99,
        image: "📷",
    };
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
