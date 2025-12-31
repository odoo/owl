import { DiscussRecord, fields } from "../src/runtime/relationalModel/discussModel";
import { DManyFn } from "../src/runtime/relationalModel/discussModelTypes";
import { clearModelRegistry } from "../src/runtime/relationalModel/modelRegistry";
import { InstanceId, ModelId } from "../src/runtime/relationalModel/types";

export type RawStore = Record<ModelId, Record<InstanceId, any>>;

let Models!: ReturnType<typeof makeModels>;

export function makeModels() {
  class Partner extends DiscussRecord {
    // static id = "partner";
    static fields = {
      name: fields.Attr(""),
      age: fields.Attr(""),
      messages: fields.Many("message", { inverse: "partner" }),
      privateMessages: fields.Many("message", { inverse: "partnerPrivate" }),
      courses: fields.Many("course"),
      company: fields.One("company"),
    };
    // name!: string;
    // age!: number;
    // messages!: DManyFn<Message>;
    // privateMessages!: DManyFn<Message>;
    // courses!: DManyFn<Course>;
  }
  Partner.register();

  class Message extends DiscussRecord {
    static id = "message";
    static fields = {
      partner: fields.One("partner"),
      partnerPrivate: fields.One("partner"),
      content: fields.Attr(""),
    };
    partner!: Partner | null;
    partnerPrivate!: Partner | null;
    content!: string;
  }
  Message.register();

  class Company extends DiscussRecord {
    static id = "company";
    static fields = {
      name: fields.Attr(""),
      partners: fields.One("partner"),
    };
    name!: string;
    partners!: DManyFn<Partner>;
  }
  Company.register();

  class Course extends DiscussRecord {
    static id = "course";
    static fields = {
      title: fields.Attr(""),
      participants: fields.Many("partner"),
    };
    title!: string;
    participants!: DManyFn<Partner>;
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
});
afterEach(() => {
  clearModelRegistry();
});

describe.skip("model", () => {
  test("get a partner by id", async () => {
    const john = Models.Partner.insert({ id: 1, name: "John" });
    expect(john.name).toBe("John");
    john.name = "Johnny";
    expect(john.name).toBe("Johnny");
  });

  test("create a new partner", async () => {});

  test("set partner name", async () => {});

  test("getAll partners", async () => {});

  describe("relations", () => {
    describe("one2many", () => {
      describe("with custom inverse field", () => {});
      test("get messages of a partner", async () => {});
      test("add a Message to a partner", async () => {});
      test("delete a Message from a partner", async () => {});
    });
    describe("many2one", () => {
      test("get partner of a message", async () => {});
      test("reset partner of a message", async () => {});
      test("set partner of a message to null", async () => {});
    });
    describe("many2many", () => {
      test("get courses of a partner", async () => {});
      test("add a course to a partner", async () => {});
      test("delete a course from a partner", async () => {});
    });
    describe("delete()", () => {
      test("delete should also remove all related fields", async () => {});
    });
  });

  describe("draft records", () => {
    test("should create a draft copy of the record for string field", async () => {});
    test("should create a draft copy of the record for one2many field", async () => {});
  });
  describe("partial record list", () => {});
});
