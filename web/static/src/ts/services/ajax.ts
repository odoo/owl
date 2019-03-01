export type RPC = (route: string, params: any) => Promise<any>;

export const rpc: RPC = async function(route, params) {
  return (<any>window).demoData.mockAjax(route, params);
};
