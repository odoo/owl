import { App } from "@odoo/owl";

App.registerTemplate("devtools.tree", function devtools_tree(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  const comp1 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp2 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp3 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp4 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp5 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp6 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp7 = app.createComponent(`TreeElement`, true, false, false, false);
  const comp8 = app.createComponent(`TreeElement`, true, false, false, false);
  
  let block1 = createBlock(`<div><block-child-0/><block-child-1/><block-child-2/><block-child-3/><block-child-4/><block-child-5/><block-child-6/><block-child-7/></div>`);
  
  return function template(ctx, node, key = "") {
    const b2 = comp1({tag: 'App',depth: 0}, key + `__1`, node, this, null);
    const b3 = comp2({tag: 'Tab',depth: 1}, key + `__2`, node, this, null);
    const b4 = comp3({tag: 'Tab',depth: 1}, key + `__3`, node, this, null);
    const b5 = comp4({tag: 'Tree',depth: 1}, key + `__4`, node, this, null);
    const b6 = comp5({tag: 'TreeElement',depth: 2}, key + `__5`, node, this, null);
    const b7 = comp6({tag: 'TreeElement',depth: 2}, key + `__6`, node, this, null);
    const b8 = comp7({tag: 'TreeElement',depth: 2}, key + `__7`, node, this, null);
    const b9 = comp8({tag: 'TreeElement',depth: 2}, key + `__8`, node, this, null);
    return block1([], [b2, b3, b4, b5, b6, b7, b8, b9]);
  }
});

App.registerTemplate("devtools.tree_element", function devtools_tree_element(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<div class="cursor-pointer hover:bg-indigo-100 mx-2 rounded-sm px-2 py-1 text-sm"><block-text-0/></div>`);
  
  return function template(ctx, node, key = "") {
    let txt1 = ctx['props'].tag;
    return block1([txt1]);
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
  
  let block1 = createBlock(`<div class="row justify-content-center mt-4"><div class="col-8"><block-child-0/><div class="form-group row mb-4"><div class="col-lg-2 col-8 col-md-4"><input class="form-control" type="text" placeholder="Add a Todo" value="" block-handler-0="keyup"/></div></div><block-child-1/><block-child-2/></div></div>`);
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
  
  let block2 = createBlock(`<nav class="flex navbar navbar-light bg-light"><div class="container-fluid"><block-child-0/><block-child-1/><block-child-2/></div></nav>`);
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
  
  let block1 = createBlock(`<a class="navbar-brand" block-attribute-0="class" block-handler-1="click"><block-text-2/></a>`);
  
  return function template(ctx, node, key = "") {
    let attr1 = ctx['props'].active?'text-indigo-700 bg-indigo-100 focus:text-indigo-800 focus:bg-indigo-200':'text-gray-500 hover:text-gray-700 focus:text-indigo-600 focus:bg-indigo-50';
    let hdlr1 = [ctx['selectTab'], ctx];
    let txt1 = ctx['props'].name;
    return block1([attr1, hdlr1, txt1]);
  }
});

App.registerTemplate("popup.popup_app", function popup_popup_app(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<div class="flex justify-center"><h1>Insane popup</h1></div>`);
  
  return function template(ctx, node, key = "") {
    return block1();
  }
});
