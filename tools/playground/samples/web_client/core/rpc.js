export async function rpc(route, params) {
  console.log(`[rpc] ${route}`);
  switch (route) {
    case "load_menus":
      return MOCK_MENUS.slice();
    case "load_action":
      return MOCK_ACTIONS.find((a) => a.id === params.id);
    case "call_kw/task/read":
      return MOCK_TASKS.find((t) => t.id === params.id);
    case "call_kw/task/search_read":
      return MOCK_TASKS.slice();
    case "call_kw/partner/read":
      return MOCK_TASKS.find((t) => t.id === params.id);
    case "call_kw/partner/search_read":
      return MOCK_TASKS.slice();
    case "load_messaging":
      return MOCK_MESSAGING.slice();
    default:
      throw new Error("Unsupported request...");
  }
}

// Mock Data
const MOCK_MENUS = [
  { id: 12, title: "Discuss", action_id: "discuss" },
  { id: 24, title: "Tasks", action_id: 32 },
  { id: 25, title: "Contacts", action_id: 53 },
];

const MOCK_ACTIONS = [
  {
    id: 32,
    model: "task",
    views: ["list", "form"],
    fields: {
      description: "char",
      is_done: "boolean",
    },
    archs: {
      list: `<field name="description"/><field name="is_done"/>`,
      form: `
                <div>Description: <field name="description"/></div>
                <div>Status: <field name="is_done"/></div>`,
    },
  },
  {
    id: 53,
    model: "partner",
    views: ["list", "form"],
    fields: {
      name: "char",
      adress: "char",
      info: "char",
    },
    archs: {
      list: `<field name="name"/><field name="adress"/>`,
      form: `
                <div>Name: <field name="name"/></div>
                <div>Adress: <field name="adress"/></div>
                <div>Info: <field name="info"/></div>`,
    },
  },
];

const MOCK_TASKS = [
  { id: 3, description: "buy milk", is_done: false },
  { id: 3, description: "make dinner", is_done: true },
];

const MOCK_PARTNERS = [
  { id: 34, name: "George", adress: "some adress", info: "" },
  { id: 35, name: "Robert", adress: "some other adress", info: "" },
];

const MOCK_MESSAGING = {
  channels: [
    { id: 3, name: "general" },
    { id: 5, name: "team" },
  ],
  messages: [
    { id: 342, channel: 3, author: "AAB", content: "js" },
    { id: 3414, channel: 5, author: "MCM", content: "owl 3" },
    { id: 3416, channel: 5, author: "LPE", content: "studio" },
  ],
  unread_messages: [3414, 3416],
};
