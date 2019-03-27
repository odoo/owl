import { Component, PureComponent } from "./component";
import { EventBus } from "./event_bus";
import { QWeb } from "./qweb";
import { Registry } from "./registry";
import { connect, Store } from "./store";
import * as utils from "./utils";

export const core = {
  QWeb,
  EventBus,
  Component,
  PureComponent,
  utils
};

export const extras = {
  Store,
  connect,
  Registry
};
