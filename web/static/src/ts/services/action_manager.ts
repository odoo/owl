import { Action } from "./actions";

// export interface Action {
//   id: number;
//   title: string;
//   Widget: Type<Widget<Env>>;
//   default?: boolean;
// }

// const actions: Action[] = [
//   { id: 1, title: "Discuss", Widget: Discuss, default: true },
//   { id: 2, title: "CRM", Widget: CRM }
// ];



export default class ActionManager {
    doAction(action: Action) {
        console.log(action);
        // load data (??)
        // trigger action somewhere
        // upload url with router
    }
}