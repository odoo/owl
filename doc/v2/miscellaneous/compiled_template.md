# 🦉 Notes On Owl Compiled Templates 🦉

This page will explain what an Owl compiled template look like. This is a
technical document intended for developers interested in understanding how Owl
works internally.

Broadly speaking, Owl compiles templates into a javascript function (a closure)
that returns a function (the "render" function). The point of the closure is to
have a place to store all values specific to the template (in particular, "blocks").
Once a template is compiled, its closure function is called once to get the
render function, and from then on, only the render function is used.

The render function takes some context (and some additional information) and
return a virtual dom representation of the rendered template, as a block tree.
A block tree is a very light weight representation that only contains the dynamic
part of the template, and its structure. It is actually independant of the
static part of the templates (which are contained in the blocks captured by the
closure). This means that the work performed at render time is only to collect
dynamic data, and to describe the block structure of the result.

It looks like this, in pseudo code:

```js
function closure(bdom, helpers) {
    // here is some place to put stuff specific to the template, such as
    // blocks
    ...

    return function render(context, node, key) {
        // only build here all dynamic parts of the template
        // build a block tree
        return tree;
    }
}
```

Now, let us see an example. Consider the following template:

```xml
<div class="some-class">
    <div class="blabla">
        <span><t t-esc="state.value"/></span>
    </div>
    <t t-if="state.info">
        <p class="info" t-att-class="someAttribute">
            <t t-esc="state.info"/>
        </p>
    </t>
    <SomeComponent value="value"/>
</div>
```

If you look carefully, there are 5 dynamic things:

- a text value (the first `t-esc`),
- a sub block (the `t-if`),
- a dynamic attribute (the `t-att-class` attribute),
- another text value (the second `t-esc`),
- and finally, a sub component

Here is the compiled code for this template:

```js
function closure(bdom, helpers) {
  let { text, createBlock, list, multi, html, toggler, component, comment } = bdom;

  let block1 = createBlock(
    `<div class="some-class"><div class="blabla"><span><block-text-0/></span></div><block-child-0/><block-child-1/></div>`
  );
  let block2 = createBlock(`<p class="info" block-attribute-0="class"><block-text-1/></p>`);

  return function render(ctx, node, key = "") {
    let b2, b3;
    let txt1 = ctx["state"].value;
    if (ctx["state"].info) {
      let attr1 = ctx["someAttribute"];
      let txt2 = ctx["state"].info;
      b2 = block2([attr1, txt2]);
    }
    b3 = component(`SomeComponent`, { value: ctx["value"] }, key + `__1`, node, ctx);
    return block1([txt1], [b2, b3]);
  };
}
```

The values captured in the closure capture the static part of the template: we
define here two blocks (which contains a template node, that can be deep cloned
whenever a block is mounted). Then the render function only describes the block
tree structure of the result, depending on the context. This means that we
minimize the amount of work done at render time.

Then, when we want to patch the dom, Owl will uses the `patch` function from
blockdom, which then will diff the block tree, and deep clone new blocks whenever
a new block is inserted, keep track of dynamic parts of each block, and update
them accordingly.

With this design, the cost of rendering a template is proportional to the number
of dynamic values, and not to the size of the template.
