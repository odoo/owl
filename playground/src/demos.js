export const HELLO_WORLD = `class HelloWorld extends owl.core.Component {
  inlineTemplate = \`<div>Hello <t t-esc="props.name"/></div>\`;
}

const env = {
    qweb: new owl.core.QWeb()
};

const hello = new HelloWorld(env, { name: "World" });
hello.mount(document.body);
`;
