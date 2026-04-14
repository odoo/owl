import { Component, signal, computed, proxy, useEffect, xml } from "@odoo/owl";

class ShoppingCart extends Component {
  static template = "example.ShoppingCart";

  query = signal("");

  products = proxy([
    { id: 1, name: "Phone", price: 500, qty: 1 },
    { id: 34, name: "Laptop", price: 1200, qty: 0 },
    { id: 42, name: "Headphones", price: 100, qty: 2 },
  ]);

  filteredProducts = computed(() => {
    const q = this.query().toLowerCase();
    return this.products.filter((p) => p.name.toLowerCase().includes(q));
  });

  total = computed(() => {
    return this.products.reduce((sum, p) => {
      return sum + p.price * p.qty;
    }, 0);
  });

  setup() {
    useEffect(() => {
      console.log("Total updated:", this.total());
    });
  }

  increase(product, increment) {
    product.qty += increment;
  }
}

export { ShoppingCart };
