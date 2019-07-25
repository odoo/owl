import { Component } from "../component/component";
import { Destination, RouterEnv } from "./Router";

export const LINK_TEMPLATE_NAME = "__owl__-router-link";
export const LINK_TEMPLATE = `
    <a  t-att-class="{'router-link-active': isActive }"
        t-att-href="href"
        t-on-click.prevent="navigate">
        <t t-slot="default"/>
    </a>`;

type Props = Destination;

export class Link<Env extends RouterEnv> extends Component<Env, Props, {}> {
  template = LINK_TEMPLATE_NAME;
  href: string = this.env.router.destToUrl(this.props);

  async willUpdateProps(nextProps) {
    this.href = this.env.router.destToUrl(nextProps);
  }

  get isActive() {
    if (this.env.router.mode === "hash") {
      return (<any>document.location).hash === this.href;
    }
    return (<any>document.location).pathname === this.href;
  }

  navigate() {
    this.env.router.navigate(this.props);
  }
}
