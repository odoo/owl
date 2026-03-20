import { Component, mount, xml, signal, computed, useEffect } from "@odoo/owl";

// Accessing the dom is done in two steps:
// 1. creating a signal (see here line 18)
// 2. giving the signal to the target element with t-ref (see line 12)
// Whenever owl creates or remove an element, it will set the signal
// accordingly

class CanvasPaint extends Component {
  static template = xml`
        <p>click on the canvas to draw</p>
        <canvas t-ref="this.canvas"
            width="500" height="400"
            style="border:1px solid #333;"
            t-on-click="this.handleClick"/>`;

  points = signal.Array([]);
  canvas = signal(); // empty for now

  setup() {
    // the draw method will read the canvas signal, so the effect
    // will rerun whenever it is set
    useEffect(() => this.draw());
  }

  handleClick(ev) {
    const rect = this.canvas().getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    this.points().push({ x, y });
  }

  draw() {
    if (!this.canvas()) return;
    const ctx = this.canvas().getContext("2d");
    ctx.clearRect(0, 0, ctx.width, ctx.height);
    for (const pt of this.points()) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = "cornflowerblue";
      ctx.fill();
      ctx.stroke();
    }
  }
}

mount(CanvasPaint, document.body, { templates: TEMPLATES, dev: true });
