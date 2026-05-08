// DOM access via `t-ref` and `useEffect`.
// 1. Create a signal: `canvas = signal()`.
// 2. Bind it to an element with `t-ref="this.canvas"`.
//    Owl writes the element into the signal when it mounts, and clears it on unmount.
// 3. Read `this.canvas()` inside `useEffect` — the effect re-runs whenever
//    a signal it reads changes, so any state that affects the drawing triggers
//    a redraw automatically.
//
// Try: change the brush colour or radius, draw on the canvas.
import { Component, mount, signal, useEffect, xml } from "@odoo/owl";

class CanvasPaint extends Component {
  static template = xml`
    <p>Click on the canvas to draw.</p>
    <canvas t-ref="this.canvas"
            width="500" height="400"
            style="border:1px solid #333;cursor:crosshair"
            t-on-click="this.handleClick"/>`;

  canvas = signal();
  points = signal.Array([]);

  setup() {
    useEffect(() => this.draw());
  }

  handleClick(ev) {
    const rect = this.canvas().getBoundingClientRect();
    this.points().push({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
  }

  draw() {
    const canvas = this.canvas();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "cornflowerblue";
    for (const pt of this.points()) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
  }
}

mount(CanvasPaint, document.body, { templates: TEMPLATES, dev: true });
