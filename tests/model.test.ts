import { fieldMany2One, fieldOne2Many, fieldString } from "../src/runtime/relationalModel/field";
import { Model } from "../src/runtime/relationalModel/model";
import { clearModelRegistry } from "../src/runtime/relationalModel/modelRegistry";
import { destroyStore, setStore } from "../src/runtime/relationalModel/store";
import { InstanceId, ModelId, One2Many } from "../src/runtime/relationalModel/types";
import { expectSpy, spyEffect, waitScheduler } from "./helpers";

export type RawStore = Record<ModelId, Record<InstanceId, any>>;

let Models!: ReturnType<typeof makeModels>;

function makeModels() {
  class Partner extends Model {
    static id = "partner";
    static fields = {
      name: fieldString(),
      messages: fieldOne2Many("message"),
    };
    name!: string;
    messages!: One2Many<Message>;
  }
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

  return {
    Partner,
    Message,
  };
}

beforeEach(() => {
  Models = makeModels();

  setStore({
    partner: {
      1: {
        name: "Partner 1",
        messages: [1, 2, 3],
      },
      2: { name: "Partner 2", messages: [4] },
    },
    message: {
      1: { partner: 1 },
      2: { partner: 1 },
      3: { partner: 1 },
      4: { partner: 2 },
    },
  });
});
afterEach(() => {
  destroyStore();
  clearModelRegistry();
});

describe("model", () => {
  test("get a partner by id", async () => {
    const partner = Models.Partner.get(1);
    expect(partner.name).toBe("Partner 1");
    const effect1 = spyEffect(() => {
      return partner.name;
    });
    effect1();
    expectSpy(effect1.spy, 1);
  });

  // set partner name and check reactivity
  test("set partner name", async () => {
    const partner = Models.Partner.get(1);
    expect(partner.name).toBe("Partner 1");
    const effect1 = spyEffect(() => {
      return partner.name;
    });
    effect1();
    expectSpy(effect1.spy, 1);

    partner.name = "New Partner 1";
    await waitScheduler();
    expect(partner.name).toBe("New Partner 1");
    expectSpy(effect1.spy, 2);
  });

  test("getAll partners", async () => {
    const partners = Models.Partner.getAll();
    expect(partners.length).toBe(2);
    expect(partners[0].name).toBe("Partner 1");
    expect(partners[1].name).toBe("Partner 2");
  });

  describe("relations", () => {
    describe("one2many", () => {
      test("get messages of a partner", async () => {
        const partner = Models.Partner.get(1);
        const messages = partner.messages();
        expect(messages.length).toBe(3);
        expect(messages[0].partner()).toBe(partner);
      });
      test("configure related field", async () => {});
      test("delete() a message", async () => {
        const partner = Models.Partner.get(1);
        const messages = partner.messages();
        expect(messages.length).toBe(3);
        const message1 = messages[0];
        message1.delete();
        const messagesAfterDelete = partner.messages();
        expect(messagesAfterDelete.length).toBe(2);
        expect(messagesAfterDelete[0]).toBe(messages[1]);

        partner.messages()[0].delete();
        expect(partner.messages().length).toBe(1);

        // delete last message
        partner.messages()[0].delete();
        expect(partner.messages().length).toBe(0);
      });
      test("add a Message to a partner", async () => {
        const partner1 = Models.Partner.get(1);
        const partner2 = Models.Partner.get(2);
        expect(partner1.messages().length).toBe(3);
        expect(partner2.messages().length).toBe(1);
        const message = Models.Message.get(4);
        expect(message.partner()).toBe(partner2);
        partner1.messages.push(message);
        console.warn(`partner1.messages().length:`, partner1.messages().length);
        expect(partner1.messages().length).toBe(4);
        expect(partner2.messages().length).toBe(0);
        expect(message.partner()).toBe(partner1);
      });
    });
    describe("many2one", () => {});
    describe("many2many", () => {});
  });

  describe("draft records", () => {});
  describe("partial record list", () => {});
});
