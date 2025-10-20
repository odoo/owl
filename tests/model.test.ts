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
      privateMessages: fieldOne2Many("message", { relatedField: "partnerPrivate" }),
      courses: fieldMany2Many("course"),
      company: fieldMany2One("company"),
    };
    name!: string;
    messages!: ManyFn<Message>;
    privateMessages!: ManyFn<Message>;
    courses!: ManyFn<Course>;
  }
  Partner.register();

  class Message extends Model {
    static id = "message";
    static fields = {
      partner: fieldMany2One("partner"),
      partnerPrivate: fieldMany2One("partner"),
      content: fieldString(),
    };
    partner!: Partner | null;
    partnerPrivate!: Partner | null;
    content!: string;
  }
  Message.register();

  class Company extends Model {
    static id = "company";
    static fields = {
      name: fieldString(),
      partners: fieldOne2Many("partner"),
    };
    name!: string;
    partners!: ManyFn<Partner>;
  }
  Company.register();

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
    Course,
    Company,
  };
}

beforeEach(() => {
  Models = makeModels();

  setStore({
    partner: {
      1: {
        name: "Partner 1",
        messages: [1, 2, 3],
        privateMessages: [5],
        courses: [1, 2],
        company: 1,
      },
      2: {
        name: "Partner 2",
        messages: [4],
        privateMessages: [],
        courses: [2],
        company: 1,
      },
    },
    message: {
      1: { partner: 1, partnerPrivate: null },
      2: { partner: 1, partnerPrivate: null },
      3: { partner: 1, partnerPrivate: null },
      4: { partner: 2, partnerPrivate: null },
      5: { partner: null, partnerPrivate: 1, content: "Private message for Partner 1" },
    },
    course: {
      1: { title: "Course 1", participants: [1] },
      2: { title: "Course 2", participants: [1, 2] },
    },
    company: {
      1: {
        name: "Company 1",
        partners: [1, 2],
      },
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
        const partner1 = Models.Partner.get(1);
        const courses = partner1.courses();
        expect(courses.length).toBe(2);
        expect(courses[0].title).toBe("Course 1");
        expect(courses[1].title).toBe("Course 2");
      });
      test("add a course to a partner", async () => {
        const partner1 = Models.Partner.get(1);
        expect(partner1.courses().length).toBe(2);
        const partner2 = Models.Partner.get(2);
        expect(partner2.courses().length).toBe(1);
        const course1 = partner1.courses()[0];
        partner2.courses.add(course1);
        expect(partner2.courses().length).toBe(2);
        expect(partner1.courses().length).toBe(2);
        // check inverse
        const participants = course1.participants();
        expect(participants.find((p) => p.id === partner2.id)).toBe(partner2);
      });
      test("delete a course from a partner", async () => {
        const partner1 = Models.Partner.get(1);
        expect(partner1.courses().length).toBe(2);
        const partner2 = Models.Partner.get(2);
        expect(partner2.courses().length).toBe(1);
        const course2 = partner1.courses()[1];
        partner1.courses.delete(course2);
        expect(partner1.courses().length).toBe(1);
        expect(partner2.courses().length).toBe(1);
        // check inverse
        const participants = course2.participants();
        expect(participants.find((p) => p.id === partner1.id)).toBeUndefined();
      });
    });
    describe("delete()", () => {
      test("delete should also remove all related fields", async () => {
        // delete many2many, one2many, many2one relations
        const partner1 = Models.Partner.get(1);
        expect(partner1.courses().length).toBe(2);
        expect(partner1.messages().length).toBe(3);
        const message1 = Models.Message.get(1);
        expect(message1.partner).toBe(partner1);
        const company1 = Models.Company.get(1);
        expect(company1.partners().find((p) => p.id === partner1.id)).toBe(partner1);

        partner1.delete();

        // check many2many
        const course1 = Models.Course.get(1);
        const participants1 = course1.participants();
        expect(participants1.find((p) => p.id === partner1.id)).toBeUndefined();
        const course2 = Models.Course.get(2);
        const participants2 = course2.participants();
        expect(participants2.find((p) => p.id === partner1.id)).toBeUndefined();

        // check one2many and many2one
        expect(partner1.messages().length).toBe(0);
        expect(message1.partner).toBe(null);

        // check company one2many
        expect(company1.partners().find((p) => p.id === partner1.id)).toBeUndefined();
      });
    });
  });

  describe("draft records", () => {});
  describe("partial record list", () => {});
});
