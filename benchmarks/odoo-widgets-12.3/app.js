import { buildData, startMeasure, stopMeasure } from "../shared/utils.js";

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
      "click .o_btn_msg.50000": function() {
        this.addMessages(50000);
      },
      "click .updateSomeMessages": function() {
        this.updateSomeMessages();
      },
      "click .clear": function() {
        this.clear();
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
    },

    start: function() {
      this.$content = this.$(".content");
      this.$msgCount = this.$(".message_count");
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
      var self = this;
      startMeasure("add " + n);
      const defs = [];
      const messages = buildData(n);
      for (let message of messages) {
        const widget = new Message(this, message);
        this.widgets[message.id] = widget;
        defs.push(widget.appendTo("<div>"));
      }
      $.when
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
          stopMeasure();
        });
    },
    clear: function() {
      startMeasure("clear");
      this.$content.empty();
      for (let key in this.widgets) {
        this.widgets[key].destroy();
        delete this.widgets[key];
      }
      this.messageCount = 0;
      this.updateMessageCount();
      stopMeasure();
    },
    updateSomeMessages: function() {
      startMeasure("update every 10th");
      const widgets = Object.values(this.widgets);
      for (let i = 0; i < widgets.length; i += 10) {
        widgets[i].update();
      }
      stopMeasure();
    },
    _onRemoveMessage: function(ev) {
      startMeasure("remove message");
      ev.target.destroy();
      delete this.widgets[ev.data.id];
      this.messageCount--;
      this.updateMessageCount();
      stopMeasure();
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
