export interface RPC {
  model: string;
  method: string;
  args: any;
}
export interface IAjax {
  rpc(rpc: RPC): Promise<any>;
}

export class Ajax implements IAjax {
  rpc(rpc: RPC): Promise<any> {
    return Promise.resolve(1);
  }
}
