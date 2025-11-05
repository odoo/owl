import {
  fieldMany2Many,
  fieldMany2One,
  fieldNumber,
  fieldOne2Many,
  fieldText,
} from "../src/runtime/relationalModel/field";
import { formatId, Model, resetIdCounter } from "../src/runtime/relationalModel/model";
import { DataToSave, saveHooks, saveModels } from "../src/runtime/relationalModel/modelData";
import { clearModelRegistry } from "../src/runtime/relationalModel/modelRegistry";
import { destroyStore, setStore } from "../src/runtime/relationalModel/store";
import { InstanceId, ModelId, ManyFn, DraftContext } from "../src/runtime/relationalModel/types";
import { expectSpy, spyEffect, waitScheduler } from "./helpers";

export type RawStore = Record<ModelId, Record<InstanceId, any>>;

let Models!: ReturnType<typeof makeModels>;

export function makeModels() {
  class Partner extends Model {
    static id = "partner";
    static fields = {
      name: fieldText(),
      age: fieldNumber(),
      messages: fieldOne2Many("message"),
      privateMessages: fieldOne2Many("message", { relatedField: "partnerPrivate" }),
      courses: fieldMany2Many("course"),
      company: fieldMany2One("company"),
    };
    name!: string;
    age!: number;
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
      content: fieldText(),
    };
    partner!: Partner | null;
    partnerPrivate!: Partner | null;
    content!: string;
  }
  Message.register();

  class Company extends Model {
    static id = "company";
    static fields = {
      name: fieldText(),
      partners: fieldOne2Many("partner"),
    };
    name!: string;
    partners!: ManyFn<Partner>;
  }
  Company.register();

  class Course extends Model {
    static id = "course";
    static fields = {
      title: fieldText(),
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

let originalOnSaveModel: (data: DataToSave) => void;
let onSaveModel: jest.Mock<void, [DataToSave]>;

beforeEach(() => {
  Models = makeModels();
  resetIdCounter();

  setStore({
    partner: {
      1: {
        name: "Partner 1",
        age: 30,
        messages: [1, 2, 3],
        privateMessages: [5],
        courses: [1, 2],
        company: 1,
      },
      2: {
        name: "Partner 2",
        age: 35,
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
  onSaveModel = jest.fn();
  originalOnSaveModel = saveHooks.onSave;
  saveHooks.onSave = onSaveModel;
});
afterEach(() => {
  destroyStore();
  clearModelRegistry();
  saveHooks.onSave = originalOnSaveModel;
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

  test("create a new partner", async () => {
    const partner = new Models.Partner();
    expect(partner.id).toBe(formatId(1));
    partner.name = "New Partner";
    expect(partner.name).toBe("New Partner");
    expect(partner.changes).toEqual({ name: "New Partner" });
    saveModels();
    expect(onSaveModel).toHaveBeenCalledWith({
      partner: {
        [formatId(1)]: { name: "New Partner" },
      },
    });
    // simulate that the server assigned a new numeric id
    expect(partner.id).toBe(1001);
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
    expect(partner.changes).toEqual({ name: "New Partner 1" });
    saveModels();
    expect(onSaveModel).toHaveBeenCalledWith({
      partner: {
        1: { name: "New Partner 1" },
      },
    });
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
        const message4 = Models.Message.get(4);
        expect(message4.partner).toBe(partner2);
        partner1.messages.add(message4);
        message4.partner = partner1;
        expect(partner1.messages().length).toBe(4);
        expect(partner2.messages().length).toBe(0);
        expect(message4.partner).toBe(partner1);
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          message: {
            4: { partner: 1 },
          },
        });
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
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          message: {
            4: { partner: null },
          },
        });
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
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          message: {
            1: { partner: 2 },
          },
        });
      });
      test("set partner of a message to null", async () => {
        const message = Models.Message.get(1);
        const partner1 = message.partner!;
        expect(partner1.id).toBe(1);
        message.partner = null;
        expect(message.partner).toBe(null);
        // check that the messages list is updated
        expect(partner1.messages().find((m: any) => m.id === message.id)).toBeUndefined();
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          message: {
            1: { partner: null },
          },
        });
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
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          partner: {
            // prettier-ignore
            2: { courses: [[/*delete*/], [1,  /*add*/]] },
          },
          course: {
            // prettier-ignore
            1: { participants: [[/*delete*/], [2,  /*add*/]] },
          },
        });
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
        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          partner: {
            // prettier-ignore
            1: { courses: [[2 /*delete*/], [ /*add*/]] },
          },
          course: {
            // prettier-ignore
            2: { participants: [[1 /*delete*/], [ /*add*/]] },
          },
        });
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

        saveModels();
        expect(onSaveModel).toHaveBeenCalledWith({
          partner: {
            1: {
              company: null,
              // prettier-ignore
              courses: [[2, 1 /*delete*/], [ /*add*/]],
            },
          },
          message: {
            1: { partner: null },
            2: { partner: null },
            3: { partner: null },
            5: { partnerPrivate: null },
          },
          course: {
            // prettier-ignore
            1: { participants: [[1 /*delete*/], [ /*add*/]] },
            // prettier-ignore
            2: { participants: [[1 /*delete*/], [ /*add*/]] },
          },
        });
      });
    });
  });

  describe("draft records", () => {
    test("should create a draft copy of the record for string field", async () => {
      const partner1 = Models.Partner.get(1);
      const partner1Bis = partner1.makeDraft();
      expect(partner1.childRecords).toContain(partner1Bis);

      expect(partner1Bis.id).toBe(partner1.id);
      expect(partner1Bis.name).toBe(partner1.name);
      partner1Bis.name = "Partner 1 Bis";
      expect(partner1.name).toBe("Partner 1");
      expect(partner1Bis.name).toBe("Partner 1 Bis");
      expect(partner1Bis.changes).toEqual({ name: "Partner 1 Bis" });

      expect(partner1.age).toBe(30);
      expect(partner1Bis.age).toBe(30);

      partner1Bis.saveDraft();
      expect(partner1.data.name).toBe("Partner 1");
      expect(partner1.changes).toEqual({ name: "Partner 1 Bis" });
      expect(partner1Bis.changes).toEqual({});
    });
    test("should create a draft copy of the record for one2many field", async () => {
      const partner1 = Models.Partner.get(1);
      const partner2 = Models.Partner.get(2);
      const partner1Bis = partner1.makeDraft();
      expect(partner1.childRecords).toContain(partner1Bis);
      const partner2Message = partner2.messages()[0];

      partner1Bis.withContext(() => {
        const partner2Bis = Models.Partner.get(2);
        expect(partner2Bis).not.toBe(partner2); // should be a draft because we are in a context
        partner1Bis.messages.add(partner2Message);
        expect(partner1Bis.messages().length).toBe(4);
        const partner2MessageBis = partner1Bis.messages()[3];
        // lastMessage should be a draft of partner2Message
        expect(partner2MessageBis).not.toBe(partner2Message);
        expect(partner2MessageBis.id).toBe(partner2Message.id);
        expect(partner2MessageBis.partner).toBe(partner1Bis);
        expect(partner2Message.partner).toBe(partner2Bis);
      });

      expect(partner1.messages().length).toBe(3);
      expect(partner1Bis.messages().length).toBe(4);
      expect(partner2Message.partner).toBe(partner2);

      partner1Bis.saveDraft();

      expect(partner1.messages().length).toBe(4);
      expect(partner1Bis.messages().length).toBe(4);
      expect(partner2Message.partner).toBe(partner1);
    });
    test("should create a draft copy of the record for many2one field", async () => {
      const partner1 = Models.Partner.get(1);
      const partner1Bis = partner1.makeDraft();
      const partner1Bis2 = partner1Bis.makeDraft();
      partner1Bis2.messages.add(Models.Message.get(4));
      partner1Bis2.saveDraft();

      expect(getStoreChanges(partner1Bis.draftContext!.store)).toEqual({
        partner: {
          1: {
            // prettier-ignore
            messages: [[/*delete*/], [4 /*add*/]],
          },
          2: {
            // prettier-ignore
            messages: [[4/*delete*/], [/*add*/]],
          },
        },
        message: {
          4: { partner: 1 },
        },
      });
    });
  });
  describe("partial record list", () => {});
});

export function getStoreChanges(store: DraftContext["store"]) {
  const changes: RawStore = {};
  for (const modelId of Object.keys(store)) {
    changes[modelId] = {};
    const modelStore = store[modelId];
    for (const instanceId of Object.keys(modelStore)) {
      changes[modelId][instanceId] = modelStore[instanceId].changes;
    }
  }
  return changes;
}
