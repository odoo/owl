import { Model } from "../src/runtime/relationalModel/model";
import { setStore } from "../src/runtime/relationalModel/store";
import { InstanceId, ModelId, One2Many } from "../src/runtime/relationalModel/types";
import { fieldMany2One, fieldOne2Many, fieldString } from "../src/runtime/relationalModel/field";

export type RawStore = Record<ModelId, Record<InstanceId, any>>;

// class PluginManager {
//   // registry = new registry()
// }

// class PluginA {
//   resources: {
//     a: ['foo', 'test'],
//   }
//   setup() {
//     this.getResources('a') // => ['foo', 'test', 'foo2']
//   }
// }

// class PluginB {
//   resources: {
//     a: derived(()=>{
//       //...
//     }),

//     setup() {
//       this.state = reactive({value: []})
//     }
//   }
//   setup() {
//     // this.registry.add('a', '')
//   }
// }

// const store = reactive({ arr: [{ v: 1 }, { v: 2 }, { v: 3 }] });
// const arr = derived(() => {
//   return map(store.arr, (i) => i.v * 3);
// });

// function map(arr, fn) {
//   const previous = [];

//   const recompute = () => {
//     const toRemove = new Set(set);
//     set.clear();
//     let i = 0;
//     for (const item of arr) {
//       set.add(fn(item));
//       toRemove.delete(item);
//     }
//     for (const item of toRemove) {
//       // cleanup if needed
//       previous.splice(item)
//     }
//   };
//   return derived(() => {
//     recompute();
//     return Array.from(set);
//   });
// }

describe("model", () => {
  test("1", async () => {
    class Partner extends Model {
      static id = "partner";
      static fields = {
        name: fieldString(),
        messages: fieldOne2Many("message"),
      };
      name!: string;
      messages!: One2Many<Message>;
    }

    // const [originalName, setOriginalName] = signal(0)
    // const [formName, setFormName] = signal(0)
    // const [computedName, setComputedName] = derived(()=>{
    //   if (formName() && formName() !== EmptySymbol) return formName()
    //   return originalName()
    // })

    // const [form2Name, setForm2Name] = signal(0)
    // const [computed2Name, setComputed2Name] = derived(()=>{
    //   if (form2Name() && form2Name() !== EmptySymbol) return form2Name()
    //   return computedName()
    // })

    Partner.register();

    class Message extends Model {
      static id = "message";
      static fields = {
        partner: fieldMany2One("partner"),
        content: fieldString(),
      };
      partner!: () => Partner;
      content!: string;
    }
    Message.register();

    setStore({
      partner: {
        1: {
          name: "Partner 1",
          messages: [1, 2, 3],
        },
        2: { name: "Partner 2", messages: [] },
      },
      message: {
        1: { partner: 1 },
        2: { partner: 1 },
        3: { partner: 1 },
      },
    });

    const partner = Partner.get(1);
    const partner2 = Partner.get(2);
    const messages = partner.messages();
    console.log(messages);
    expect(messages.length).toBe(3);
    expect(messages[0].partner()).toBe(partner);
    expect(messages[1].partner()).toBe(partner);

    // delete first message
    const message1 = messages[0];
    const message2 = messages[1];
    const message3 = messages[2];
    message1.delete();
    const messagesAfterDelete = partner.messages();
    expect(messagesAfterDelete.length).toBe(2);
    expect(messagesAfterDelete[0]).toBe(message2);
    partner.messages()[0].delete();
    expect(partner.messages().length).toBe(1);

    // add Message
    partner2.messages.push(message3);
    expect(partner2.messages().length).toBe(1);
  });
});
