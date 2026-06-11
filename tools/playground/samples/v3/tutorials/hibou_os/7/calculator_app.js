import { Component, xml, signal } from "@odoo/owl";

export class CalculatorApp extends Component {
    static template = xml`
      <div class="calculator">
        <div class="calc-display" t-out="this.display()"/>
        <div class="calc-buttons">
          <t t-foreach="this.buttons" t-as="btn" t-key="btn">
            <button t-on-click="() => this.press(btn)" t-out="btn"/>
          </t>
        </div>
      </div>`;

    display = signal("0");
    buttons = ["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+","C"];

    press(btn) {
        if (btn === "C") {
            this.display.set("0");
        } else if (btn === "=") {
            try {
                this.display.set(String(eval(this.display())));
            } catch {
                this.display.set("Error");
            }
        } else {
            const current = this.display();
            this.display.set(current === "0" ? btn : current + btn);
        }
    }
}
