export type RPC = (route: string, params: any) => Promise<any>;

export const rpc: RPC = async function(route, params) {
  console.log("RPC", route, params);
  const delay = Math.random() * 1000;
  return new Promise(resolve => setTimeout(resolve, delay));
};
