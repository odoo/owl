import { Component, mount, xml } from "@odoo/owl";

class Root extends Component {
    static template = xml`<div>hello owl</div>`;

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
    };
}

mount(Root, document.body, { templates: TEMPLATES, dev: true });
