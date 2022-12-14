import { App } from "@odoo/owl";

App.registerTemplate("devtools.tree", function devtools_tree(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  const comp1 = app.createComponent(`TreeElement`, true, false, false, false);
  
  let block1 = createBlock(`<ul><block-child-0/></ul>`);
  
  return function template(ctx, node, key = "") {
    const b2 = comp1({name: ctx['root'].name,attributes: ctx['root'].attributes,path: ctx['root'].path,children: ctx['root'].children}, key + `__1`, node, this, null);
    return block1([], [b2]);
  }
});

App.registerTemplate("devtools.tree_element", function devtools_tree_element(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, false, false);
  
  let block3 = createBlock(`<li><block-child-0/><block-child-1/></li>`);
  let block5 = createBlock(`<span class="caret" block-handler-0="click"><block-text-1/></span>`);
  let block6 = createBlock(`<ul class="nested"><block-child-0/></ul>`);
  
  return function template(ctx, node, key = "") {
    const b2 = comment(` <div class="accordion" t-attf-id="accordion_{{props.path}}">
      <div class="accordion-item">
        <h2 class="accordion-header" t-attf-id="heading_{{props.path}}">
          <button class="accordion-button" type="button" t-attf-data-bs-toggle="collapse" t-attf-data-bs-target="#collapse_{{props.path}}" aria-expanded="true" t-attf-aria-controls="collapse_{{props.path}}">
            <t t-esc="props.name"/>
          </button>
        </h2>
        <div t-attf-id="collapse_{{props.path}}" class="accordion-collapse collapse show" t-attf-aria-labelledby="heading_{{props.path}}">
          <div class="accordion-body p-1">
            <table class="table table-striped m-0">
              <colgroup>
                <col className="col-6"/>
                <col className="col-6"/>
              </colgroup>
              <tbody>
                <tr>
                  <td>Element type:</td>
                  <td><t t-esc="props.name"/></td>
                </tr>
                <t t-foreach="props.attributes" t-as="attribute" t-key="props.path + ' ' + attribute">
                  <tr>
                    <td>Element <t t-esc="attribute"/>:</td>
                    <td><t t-esc="props.attributes[attribute]"/></td>
                  </tr>
                </t>
                <t t-foreach="props.children" t-as="child" t-key="child.name">
                  <tr>
                    <td colSpan="2" class="p-0">
                      <TreeElement name="child.name" path="child.path" attributes="child.attributes" children="child.children"/>
                    </td>
                  </tr>
                </t>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div> `);
    let b4,b9;
    if (ctx['props'].children.length>0) {
      let hdlr1 = [ctx['toggleEvent'], ctx];
      let txt1 = ctx['props'].name;
      const b5 = block5([hdlr1, txt1]);
      ctx = Object.create(ctx);
      const [k_block7, v_block7, l_block7, c_block7] = prepareList(ctx['props'].children);;
      for (let i1 = 0; i1 < l_block7; i1++) {
        ctx[`child`] = v_block7[i1];
        const key1 = ctx['child'].name;
        c_block7[i1] = withKey(comp1({name: ctx['child'].name,path: ctx['child'].path,attributes: ctx['child'].attributes,children: ctx['child'].children}, key + `__1__${key1}`, node, this, null), key1);
      }
      ctx = ctx.__proto__;
      const b7 = list(c_block7);
      const b6 = block6([], [b7]);
      b4 = multi([b5, b6]);
    } else {
      b9 = text(ctx['props'].name);
    }
    const b3 = block3([], [b4, b9]);
    return multi([b2, b3]);
  }
});

App.registerTemplate("devtools.card", function devtools_card(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { callSlot } = helpers;
  
  let block1 = createBlock(`<div class="card" style="width: 18rem;"><div class="card-body"><block-child-0/><p class="card-text"><block-child-1/></p><a href="#" class="btn btn-primary">Go somewhere</a></div></div>`);
  let block2 = createBlock(`<h5 class="card-title"><block-child-0/></h5>`);
  
  return function template(ctx, node, key = "") {
    let b2,b4;
    if (ctx['props'].slots.title) {
      const b3 = callSlot(ctx, node, key, 'title', false, {});
      b2 = block2([], [b3]);
    }
    b4 = callSlot(ctx, node, key, 'default', false, {});
    return block1([], [b2, b4]);
  }
});

App.registerTemplate("devtools.counter", function devtools_counter(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block2 = createBlock(`<p>Counter: <block-text-0/></p>`);
  let block3 = createBlock(`<p><button class="btn btn-primary mt-2" block-handler-0="click">Increment</button></p>`);
  
  return function template(ctx, node, key = "") {
    let txt1 = ctx['state'].count;
    const b2 = block2([txt1]);
    let hdlr1 = [ctx['increment'], ctx];
    const b3 = block3([hdlr1]);
    return multi([b2, b3]);
  }
});

App.registerTemplate("devtools.dashboard", function devtools_dashboard(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { prepareList, bind, withKey, markRaw } = helpers;
  const comp1 = app.createComponent(`Counter`, true, false, false, true);
  const comp2 = app.createComponent(`Todo`, true, false, false, false);
  const comp3 = app.createComponent(`Card`, true, true, false, true);
  
  let block1 = createBlock(`<div class="row justify-content-center mt-4"><div class="col-8"><block-child-0/><div class="form-group row mb-4"><div class="col-lg-4 col-8 col-md-6"><input class="form-control" type="text" placeholder="Add a Todo" value="" block-handler-0="keyup"/></div></div><block-child-1/><block-child-2/></div></div>`);
  let block4 = createBlock(`<p><block-child-0/></p>`);
  
  function slot1(ctx, node, key = "") {
    return text(`Bonjour`);
  }
  
  function slot2(ctx, node, key = "") {
    return text(` Bienvenue à tous `);
  }
  
  return function template(ctx, node, key = "") {
    const b2 = comp1({}, key + `__1`, node, this, null);
    let hdlr1 = [ctx['addTodo'], ctx];
    ctx = Object.create(ctx);
    const [k_block3, v_block3, l_block3, c_block3] = prepareList(ctx['todos']);;
    for (let i1 = 0; i1 < l_block3; i1++) {
      ctx[`todo`] = v_block3[i1];
      const key1 = ctx['todo'].id;
      const b5 = comp2({todo: ctx['todo'],toggleState: bind(this, ctx['toggleTodo']),removeState: bind(this, ctx['removeTodo'])}, key + `__2__${key1}`, node, this, null);
      c_block3[i1] = withKey(block4([], [b5]), key1);
    }
    ctx = ctx.__proto__;
    const b3 = list(c_block3);
    const b8 = comp3({slots: markRaw({'title': {__render: slot1.bind(this), __ctx: ctx}, 'default': {__render: slot2.bind(this), __ctx: ctx}})}, key + `__3`, node, this, null);
    return block1([hdlr1], [b2, b3, b8]);
  }
});

App.registerTemplate("devtools.todo", function devtools_todo(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<div class="form-check"><input class="form-check-input" type="checkbox" block-attribute-0="id" block-attribute-1="checked" block-handler-2="click"/><label class="form-check-label" block-attribute-3="class"><block-text-4/>. <block-text-5/></label><span class="fa fa-remove mx-2" block-handler-6="click"/></div>`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['props'].todo.id;
    let attr2 = new Boolean(ctx['props'].todo.done);
    let hdlr1 = [ctx['checkEvent'], ctx];
    let attr3 = ctx['props'].todo.done?'text-decoration-line-through text-muted':'';
    let txt1 = ctx['props'].todo.id;
    let txt2 = ctx['props'].todo.description;
    let hdlr2 = [ctx['removeEvent'], ctx];
    return block1([attr1, attr2, hdlr1, attr3, txt1, txt2, hdlr2]);
  }
});

App.registerTemplate("devtools.devtools_app", function devtools_devtools_app(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { bind } = helpers;
  const comp1 = app.createComponent(`Tab`, true, false, false, false);
  const comp2 = app.createComponent(`Tab`, true, false, false, false);
  const comp3 = app.createComponent(`Tab`, true, false, false, false);
  const comp4 = app.createComponent(null, false, false, false, true);
  
  let block2 = createBlock(`<nav class="navbar navbar-light bg-light sticky-top"><div class="container-fluid"><block-child-0/><block-child-1/><block-child-2/></div></nav>`);
  let block6 = createBlock(`<div class="mt-2"><block-child-0/></div>`);
  
  return function template(ctx, node, key = "") {
    const b3 = comp1({componentName: 'Tree',active: ctx['state'].page==='Tree',name: 'Component Tree',switchTab: bind(this, ctx['switchTab'])}, key + `__1`, node, this, null);
    const b4 = comp2({componentName: 'Events',active: ctx['state'].page==='Events',name: 'Events',switchTab: bind(this, ctx['switchTab'])}, key + `__2`, node, this, null);
    const b5 = comp3({componentName: 'Dashboard',active: ctx['state'].page==='Dashboard',name: 'Dashboard',switchTab: bind(this, ctx['switchTab'])}, key + `__3`, node, this, null);
    const b2 = block2([], [b3, b4, b5]);
    const Comp1 = ctx['selectPage'];
    const b7 = toggler(Comp1, comp4({}, key + `__4`, node, this, Comp1));
    const b6 = block6([], [b7]);
    return multi([b2, b6]);
  }
});

App.registerTemplate("devtools.events", function devtools_events(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  return function template(ctx, node, key = "") {
    return text(` Events page `);
  }
});

App.registerTemplate("devtools.tab", function devtools_tab(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<a class="btn btn-outline-primary" block-attribute-0="class" block-handler-1="click"><block-text-2/></a>`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['props'].active?'text-white bg-primary':'text-dark';
    let hdlr1 = [ctx['selectTab'], ctx];
    let txt1 = ctx['props'].name;
    return block1([attr1, hdlr1, txt1]);
  }
});

App.registerTemplate("popup.popup_app", function popup_popup_app(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<div class="container m-0 p-4 text-white bg-dark" style="width: 370px"><block-child-0/><block-child-1/></div>`);
  let block2 = createBlock(`<p> Owl is not detected on this page. </p>`);
  let block3 = createBlock(`<p> Owl is detected on this page. Open DevTools and look for the Owl panel. </p>`);
  
  return function template(ctx, node, key = "") {
    let b2,b3;
    if (ctx['state'].status=='not_found') {
      b2 = block2();
    }
    if (ctx['state'].status=='enabled') {
      b3 = block3();
    }
    return block1([], [b2, b3]);
  }
});
