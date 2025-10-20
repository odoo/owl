import {
  fieldMany2Many,
  fieldMany2One,
  fieldOne2Many,
  fieldString,
} from "../src/runtime/relationalModel/field";
import { Model } from "../src/runtime/relationalModel/model";
import { clearModelRegistry } from "../src/runtime/relationalModel/modelRegistry";
import { destroyStore, setStore } from "../src/runtime/relationalModel/store";
import { InstanceId, ModelId, ManyFn } from "../src/runtime/relationalModel/types";
import { expectSpy, spyEffect, waitScheduler } from "./helpers";

export type RawStore = Record<ModelId, Record<InstanceId, any>>;

let Models!: ReturnType<typeof makeModels>;

function makeModels() {
  class Partner extends Model {
    static id = "partner";
    static fields = {
      name: fieldString(),
      messages: fieldOne2Many("message"),
      courses: fieldMany2Many("course"),
    };
    name!: string;
    messages!: ManyFn<Message>;
    courses!: ManyFn<Course>;
  }
  Partner.register();

  class Message extends Model {
    static id = "message";
    static fields = {
      partner: fieldMany2One("partner"),
      content: fieldString(),
    };
    partner!: Partner | null;
    content!: string;
  }
  Message.register();

  class Course extends Model {
    static id = "course";
    static fields = {
      title: fieldString(),
      participants: fieldMany2Many("partner"),
    };
    title!: string;
    participants!: ManyFn<Partner>;
  }
  Course.register();

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
        courses: [1, 2],
      },
      2: {
        name: "Partner 2",
        messages: [4],
        courses: [2],
      },
    },
    message: {
      1: { partner: 1 },
      2: { partner: 1 },
      3: { partner: 1 },
      4: { partner: 2 },
    },
    course: {
      1: { title: "Course 1", participants: [1] },
      2: { title: "Course 2", participants: [1, 2] },
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
      describe("with custom inverse field", () => {});
      test("get messages of a partner", async () => {
        const partner = Models.Partner.get(1);
        const messages = partner.messages();
        expect(messages.length).toBe(3);
        expect(messages[0].partner).toBe(partner);
      });
      test("add a Message to a partner", async () => {
        const partner1 = Models.Partner.get(1);
        const partner2 = Models.Partner.get(2);
        expect(partner1.messages().length).toBe(3);
        expect(partner2.messages().length).toBe(1);
        const message = Models.Message.get(4);
        expect(message.partner).toBe(partner2);
        partner1.messages.add(message);
        expect(partner1.messages().length).toBe(4);
        expect(partner2.messages().length).toBe(0);
        expect(message.partner).toBe(partner1);
      });
      test("delete a Message from a partner", async () => {
        const partner1 = Models.Partner.get(1);
        const partner2 = Models.Partner.get(2);
        expect(partner1.messages().length).toBe(3);
        expect(partner2.messages().length).toBe(1);
        const message = Models.Message.get(4);
        expect(message.partner).toBe(partner2);
        partner2.messages.delete(message);
        expect(partner1.messages().length).toBe(3);
        expect(partner2.messages().length).toBe(0);
        expect(message.partner).toBe(null);
      });
    });
    describe("many2one", () => {
      test("get partner of a message", async () => {
        const message = Models.Message.get(1);
        const partner = message.partner!;
        expect(partner.id).toBe(1);
        expect(partner.name).toBe("Partner 1");
      });
      test("reset partner of a message", async () => {
        const message = Models.Message.get(1);
        const partner1 = message.partner!;
        expect(partner1.id).toBe(1);
        const partner2 = Models.Partner.get(2);
        message.partner = partner2;
        expect(message.partner.id).toBe(2);
        // check that the messages lists are updated
        expect(partner1.messages().find((m: any) => m.id === message.id)).toBeUndefined();
        expect(partner2.messages().find((m: any) => m.id === message.id)).toBe(message);
      });
      test("set partner of a message to null", async () => {
        const message = Models.Message.get(1);
        const partner1 = message.partner!;
        expect(partner1.id).toBe(1);
        message.partner = null;
        expect(message.partner).toBe(null);
        // check that the messages list is updated
        expect(partner1.messages().find((m: any) => m.id === message.id)).toBeUndefined();
      });
    });
    describe("many2many", () => {
      test("get courses of a partner", async () => {
        const partner = Models.Partner.get(1);
        const courses = partner.courses();
        expect(courses.length).toBe(2);
        expect(courses[0].title).toBe("Course 1");
        expect(courses[1].title).toBe("Course 2");
      });
    });
    describe("delete()", () => {
      test("delete should also remove all related fields", async () => {
        const partner = Models.Partner.get(1);
        const messages = partner.messages();
        expect(messages.length).toBe(3);
        const message1 = messages[0];
        message1.delete();
        // check there is no partner
        expect(message1.partner).toBe(null);
        const messagesAfterDelete = partner.messages();
        expect(messagesAfterDelete.length).toBe(2);
        expect(messagesAfterDelete[0]).toBe(messages[1]);

        partner.messages()[0].delete();
        expect(partner.messages().length).toBe(1);

        // delete last message
        partner.messages()[0].delete();
        expect(partner.messages().length).toBe(0);
      });
    });
  });

  describe("draft records", () => {});
  describe("partial record list", () => {});
});
