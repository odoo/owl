import { Component, PureComponent } from "../../../../../src/component";
import { Env } from "./env";

//------------------------------------------------------------------------------
// Widget classes
//------------------------------------------------------------------------------

export class Widget<P, S> extends Component<Env, P, S> {}

export class PureWidget<P, S> extends PureComponent<Env, P, S> {}
