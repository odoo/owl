import {
  buildData,
  startMeasure,
  stopMeasure,
  formatNumber
} from "../shared/utils.js";

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
    return { messages: [], multipleFlag: false, clearAfterFlag: false };
  },
  mounted() {
    this.log(`Benchmarking Vue v${Vue.version}`);
  },
  methods: {
    addMessages(n) {
      this.benchmark("add " + n, () => {
        const newMessages = buildData(n);
        this.messages.push.apply(this.messages, newMessages);
      });
    },

    clear() {
      this._benchmark("clear", () => {
        this.messages = [];
      });
    },

    clearLog() {
      this.$refs.log.innerHTML = "";
    },

    updateSomeMessages() {
      this.benchmark("update every 10th", () => {
        const messages = this.messages;
        for (let i = 0; i < this.messages.length; i += 10) {
          messages[i].author += "!!!";
        }
      });
    },

    removeMessage(id) {
      startMeasure("remove message");
      const index = this.messages.findIndex(m => m.id === id);
      this.messages.splice(index, 1);
      stopMeasure();
    },
    log(str, isBold) {
      const div = document.createElement("div");
      if (isBold) {
        div.classList.add("bold");
      }
      div.textContent = `> ${str}`;
      this.$refs.log.appendChild(div);
      this.$refs.log.scrollTop = this.$refs.log.scrollHeight;
    },
    benchmark(message, fn, callback) {
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

          if (this.clearAfterFlag) {
            this._benchmark(
              "clear",
              () => {
                this.messages = [];
              },
              finalize,
              false
            );
          } else {
            finalize();
          }
        };
        this._benchmark(message, fn, cb);
      } else {
        this._benchmark(message, fn, callback);
      }
    },

    _benchmark(message, fn, cb, log = true) {
      setTimeout(() => {
        startMeasure(message);
        fn();
        stopMeasure(info => {
          if (log) {
            this.log(info.msg);
          }
          if (cb) {
            cb(info);
          }
        });
      }, 10);
    }
  },
  template: `
    <div class="main">
        <div class="left-thing">
            <div class="title">Actions</div>
            <div class="panel">
                <button @click="addMessages(100)">Add 100 messages</button>
                <button @click="addMessages(1000)">Add 1k messages</button>
                <button @click="addMessages(10000)">Add 10k messages</button>
                <button @click="addMessages(30000)">Add 30k messages</button>
                <button @click="updateSomeMessages">Update every 10th message</button>
                <button @click="clear">Clear</button>
            </div>
            <div class="flags">
                <div>
                    <input type="checkbox" id="multipleflag" v-model="multipleFlag"/>
                    <label for="multipleflag">Do it 20x</label>
                </div>
                <div>
                    <input type="checkbox" id="clearFlag" v-model="clearAfterFlag"/>
                    <label for="clearFlag">Clear after</label>
                </div>
            </div>
            <div class="info">Number of messages: {{messages.length}}</div>
            <hr/>
            <div class="title">Log <span class="clear-log" @click="clearLog">(clear)</span></div>
            <div class="log">
                <div class="log-content" ref="log"/>
            </div>
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
