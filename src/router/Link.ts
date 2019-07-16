import { Component } from "../component/component";
import { Destination, RouterEnv } from "./plugin";

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
  href: string = this.env.router.info.destToUrl(this.props);

  async willUpdateProps(nextProps) {
    this.href = this.env.router.info.destToUrl(nextProps);
  }

  get isActive() {
    if (this.env.router.info.mode === "hash") {
      return document.location.hash === this.href;
    }
    return document.location.pathname === this.href;
  }

  navigate() {
    this.env.router.navigate(this.props);
  }
}
