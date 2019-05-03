import { buildData, startMeasure, stopMeasure } from "../shared/utils.js";

//------------------------------------------------------------------------------
// Counter Widget
//------------------------------------------------------------------------------
Vue.component("likes-counter", {
  data: function() {
    return {
      counter: 0
    };
  },
  methods: {
    increment() {
      this.counter++;
    }
  },
  template: `
    <div>
      <button @click="increment">Value: {{counter}}</button>
    </div>`
});

//------------------------------------------------------------------------------
// Message Widget
//------------------------------------------------------------------------------
Vue.component("my-message", {
  props: ["msg"],
  methods: {
    removeMessage() {
      this.$emit("removeMessage", this.msg.id);
    }
  },
  template: `
    <div class="message">
        <span class="author">{{msg.author}}</span>
        <span class="msg">{{msg.msg}}</span>
        <button class="remove" @click="removeMessage">Remove</button>
        <likes-counter></likes-counter>
    </div>`
});

//------------------------------------------------------------------------------
// Root Widget
//------------------------------------------------------------------------------
const App = {
  name: "App",
  data() {
    return { messages: [] };
  },
  methods: {
    addMessages(n) {
      startMeasure("add " + n);
      const newMessages = buildData(n);
      this.messages.push.apply(this.messages, newMessages);
      stopMeasure();
    },

    clear() {
      startMeasure("clear");
      this.messages = [];
      stopMeasure();
    },

    updateSomeMessages() {
      startMeasure("update every 10th");
      const messages = this.messages;
      for (let i = 0; i < this.messages.length; i += 10) {
        messages[i].author += "!!!";
      }
      stopMeasure();
    },

    removeMessage(id) {
      startMeasure("remove message");
      const index = this.messages.findIndex(m => m.id === id);
      this.messages.splice(index, 1);
      stopMeasure();
    }
  },
  template: `
    <div class="main">
        <div class="left-thing">
            <div>Number of msg: {{messages.length}}</div>
            <button @click="addMessages(100)">Add 100 messages</button>
            <button @click="addMessages(1000)">Add 1000 messages</button>
            <button @click="addMessages(10000)">Add 10000 messages</button>
            <button @click="addMessages(50000)">Add 50000 messages</button>
            <button @click="updateSomeMessages">Update every 10th message</button>
            <button @click="clear">Clear</button>
        </div>
        <div class="right-thing">
            <div class="content">
                <my-message v-for="msg in messages" v-bind:key="msg.id" v-bind:msg="msg" @removeMessage="removeMessage"></my-message>
            </div>
        </div>
    </div>
  `
};

//------------------------------------------------------------------------------
// Application initialization
//------------------------------------------------------------------------------

new Vue({
  render: h => h(App)
}).$mount(`#main`);
