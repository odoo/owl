import {
  buildData,
  startMeasure,
  stopMeasure,
  formatNumber
} from "../shared/utils.js";

odoo.define("app", function(require) {
  const Widget = require("web.Widget");
  var core = require("web.core");
  var dom = require("web.dom");

  //----------------------------------------------------------------------------
  // Likes Counter Widget
  //----------------------------------------------------------------------------
  var Counter = Widget.extend({
    template: "counter",
    events: {
      "click .o_increment": "_onIncrement"
    },
    init: function(parent) {
      this._super(parent);
      this.value = 0;
    },
    start: function() {
      this.updateCounter();
    },
    on_attach_callback: function() {},
    on_detach_callback: function() {},
    updateCounter: function() {
      this.$(".o_increment").html("Value: " + this.value);
    },
    _onIncrement: function(ev) {
      ev.stopPropagation();
      this.value += 1;
      this.updateCounter();
    }
  });

  //----------------------------------------------------------------------------
  // Message Widget
  //----------------------------------------------------------------------------
  var Message = Widget.extend({
    template: "message",
    events: {
      "click .remove": "_onRemove"
    },

    init: function(parent, message) {
      this._super(parent);
      this.author = message.author;
      this.msg = message.msg;
      this.id = message.id;
    },
    willStart: function() {
      this.counter = new Counter(this);
      return this.counter.appendTo($("<div>"));
    },

    start: function() {
      this.$msg = this.$(".msg");
      dom.append(this.$el, this.counter.$el, {
        in_DOM: this.isInDom,
        callbacks: [{ widget: this.counter }]
      });
    },
    on_attach_callback: function() {
      this.isInDom = true;
      if (this.counter) {
        this.counter.on_attach_callback();
      }
    },
    on_detach_callback: function() {
      this.isInDom = true;
      if (this.counter) {
        this.counter.on_detach_callback();
      }
    },

    _onRemove: function() {
      this.trigger_up("remove_message", { id: this.id });
    },

    update: function() {
      this.msg += "!!!";
      this.$msg.text(this.msg);
    }
  });

  //----------------------------------------------------------------------------
  // Root Widget
  //----------------------------------------------------------------------------
  var App = Widget.extend({
    template: "root",
    events: {
      "click .o_btn_msg.100": function() {
        this.addMessages(100);
      },
      "click .o_btn_msg.1000": function() {
        this.addMessages(1000);
      },
      "click .o_btn_msg.10000": function() {
        this.addMessages(10000);
      },
      "click .o_btn_msg.30000": function() {
        this.addMessages(30000);
      },
      "click .updateSomeMessages": function() {
        this.updateSomeMessages();
      },
      "click .clear": function() {
        this.clear();
      },
      "click .o_multiple": function() {
        this.multipleFlag = !this.multipleFlag;
      },
      "click .o_clear": function() {
        this.clearFlag = !this.clearFlag;
      },
      "click .clear-log": function() {
        this.$log[0].innerHTML = "";
      }
    },
    custom_events: {
      remove_message: "_onRemoveMessage"
    },

    init: function(parent) {
      this._super(parent);
      this.widgets = {};
      this.isInDom = false;
      this.messageCount = 0;
      this.multipleFlag = false;
      this.clearFlag = false;
    },

    start: function() {
      this.$content = this.$(".content");
      this.$msgCount = this.$(".message_count");
      this.$log = this.$(".log-content");
      this.log("Benchmarking odoo widgets, 12.3");
    },
    on_attach_callback: function() {
      this.isInDom = true;
      for (let widget of Object.values(this.widgets)) {
        if (widget.on_attach_callback) {
          widget.on_attach_callback();
        }
      }
    },
    on_detach_callback: function() {
      this.isInDom = true;
      for (let widget of Object.values(this.widgets)) {
        if (widget.on_detach_callback) {
          widget.on_detach_callback();
        }
      }
    },

    updateMessageCount() {
      this.$msgCount.text("Number of msg: " + this.messageCount);
    },

    addMessages: function(n) {
      const self = this;
      this.benchmark("add " + n, () => {
        const defs = [];
        const messages = buildData(n);
        for (let message of messages) {
          const widget = new Message(this, message);
          this.widgets[message.id] = widget;
          defs.push(widget.appendTo("<div>"));
        }
        return $.when
          .apply($, defs)
          .then(function() {
            for (let message of messages) {
              let widget = self.widgets[message.id];
              dom.append(self.$content, widget.$el, {
                in_DOM: this.isInDom,
                callbacks: [{ widget: widget }]
              });
            }
          })
          .then(function() {
            self.messageCount += n;
            self.updateMessageCount();
          });
      });
    },
    clear: function() {
      startMeasure("clear");
      this._clear();
      stopMeasure(info => {
        this.log(info.msg);
      });
    },

    _clear: function() {
      this.$content.empty();
      for (let key in this.widgets) {
        this.widgets[key].destroy();
        delete this.widgets[key];
      }
      this.messageCount = 0;
      this.updateMessageCount();
    },
    updateSomeMessages: function() {
      this.benchmark("update every 10th", () => {
        const widgets = Object.values(this.widgets);
        for (let i = 0; i < widgets.length; i += 10) {
          widgets[i].update();
        }
      });
    },
    _onRemoveMessage: function(ev) {
      startMeasure("remove message");
      ev.target.destroy();
      delete this.widgets[ev.data.id];
      this.messageCount--;
      this.updateMessageCount();
      stopMeasure();
    },

    benchmark: function(message, fn, callback) {
      if (this.multipleFlag) {
        const N = 20;
        let n = N;
        let total = 0;
        let cb = info => {
          let finalize = () => {
            n--;
            total += info.delta;
            if (n === 0) {
              const avg = total / N;
              this.log(`Average: ${formatNumber(avg)}ms`, true);
              if (callback) {
                callback();
              }
            } else {
              this._benchmark(message, fn, cb);
            }
          };

          if (this.clearFlag) {
            this._benchmark("clear", this._clear.bind(this), finalize, false);
          } else {
            finalize();
          }
        };
        this._benchmark(message, fn, cb);
      } else {
        this._benchmark(message, fn, callback);
      }
    },

    _benchmark: function(message, fn, cb, log = true) {
      setTimeout(() => {
        startMeasure(message);
        const benchmark = fn();
        (benchmark && benchmark.then ? benchmark : $.when()).then(() => {
          stopMeasure(info => {
            if (log) {
              this.log(info.msg);
            }
            if (cb) {
              cb(info);
            }
          });
        }, 10);
      });
    },

    log: function(str, isBold) {
      const div = document.createElement("div");
      if (isBold) {
        div.classList.add("bold");
      }
      div.textContent = `> ${str}`;
      this.$log[0].appendChild(div);
      this.$log[0].scrollTop = this.$log[0].scrollHeight;
    }
  });

  //------------------------------------------------------------------------------
  // Application initialization
  //------------------------------------------------------------------------------
  async function start() {
    // prepare QWeb
    const templates = await fetch("templates.xml");
    let strTemplates = await templates.text();
    strTemplates = strTemplates.replace(/<!--[\s\S]*?-->/g, "");
    core.qweb.add_template(strTemplates);

    // prepare app
    const app = new App();
    await app.appendTo(document.body);
  }

  start();
});
