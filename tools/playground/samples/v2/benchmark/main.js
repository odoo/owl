import { Component, mount, useState, onPatched} from "@odoo/owl";

// -----------------------------------------------------------------------------
// Data generation
// -----------------------------------------------------------------------------

let idCounter = 1;
const adjectives = [
    "pretty", "large", "big", "small", "tall", "short", "long", "handsome", "plain",
    "quaint", "clean", "elegant", "easy", "angry", "crazy", "helpful", "mushy", "odd",
    "unsightly", "adorable", "important", "inexpensive", "cheap", "expensive", "fancy"];
const colours = ["red", "yellow", "blue", "green", "pink", "brown", "purple", "brown", "white", "black", "orange"];
const nouns = ["table", "chair", "house", "bbq", "desk", "car", "pony", "cookie", "sandwich", "burger", "pizza", "mouse", "keyboard"];

function _random (max) { return Math.round(Math.random() * 1000) % max; };

function buildData(count) {
    const data = new Array(count);
    for (let i = 0; i < count; i++) {
        const label = `${adjectives[_random(adjectives.length)]} ${colours[_random(colours.length)]} ${nouns[_random(nouns.length)]}`;
        data[i] = {
            id: idCounter++,
            label,
        };
    }
    return data;
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------
class Button extends Component {
  static template = "Button";
}


class Row extends Component {
  static template = "Row";
}

class Root extends Component {
  static template = "Root";
  static components = { Button, Row };

  setup() {
      this.state = useState({
          rows: [],
          selectedRowId: null
      });
      this.benchmarking = false;
      onPatched(() => {
          if (this.benchmarking) {
              this.stop();
          }
      });
    }
    
    start(descr) {
        this.benchmarking = `[${descr}]`;
        console.time(this.benchmarking);
    }
    stop() {
        console.timeEnd(this.benchmarking);
        this.benchmarking = false;  
    }

    run() {
        this.start('add1000');
        this.state.rows = buildData(1000);
        this.state.selectedRowId = null;
    }
    
    runLots() {
        this.start('add10_000');
        this.state.rows = buildData(10_000);
        this.state.selectedRowId = null;
    }
    
    add() {
        this.start('append1000');
        this.state.rows = this.state.rows.concat(buildData(1000));
    }
    
    update() {
        this.start('update1/10th');
        let index = 0;
        const rows = this.state.rows;
        while (index < rows.length) {
            rows[index].label = rows[index].label + " !!!";
            index += 10;
        }
    }
    
    clear() {
        this.start('clear');
        this.state.rows = [];
        this.state.selectedRowId = null;
    }
    
    swapRows() {
        this.start('swap');
        const rows = this.state.rows;
        if (rows.length > 998) {
            let tmp = rows[1];
            rows[1] = rows[998];
            rows[998] = tmp;
        }
    }
    
    selectRow(id) {
        this.start('select');
        this.state.selectedRowId = id;
    }
    
    removeRow(id) {
        this.start('remove1');
        const rows = this.state.rows;
        rows.splice(rows.findIndex(row => row.id === id), 1);
    }
}


// dev=false for benchmarking. we don't want to benchmark dev code!
mount(Root, document.body, { templates: TEMPLATES, dev: false });
