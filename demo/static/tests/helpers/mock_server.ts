import { TestData } from "./test_data";

export class MockServer {
  data: TestData;

  constructor(data: TestData) {
    this.data = data;
  }

  rpc(route: string, params: any): Promise<any> {
    if (route === "web/action/load") {
      const action = this.data.actions.find(a => a.id === params.action_id);
      return Promise.resolve(action);
    }
    return Promise.resolve(true);
  }
}
