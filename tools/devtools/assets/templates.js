import { App } from "@odoo/owl";

App.registerTemplate("devtools.components_tree", function devtools_components_tree(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { bind } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, true, false);
  
  let block1 = createBlock(`<div id="container"><div class="split-screen-container"><div class="split-screen-left" block-attribute-0="style"><block-child-0/></div><div class="split-screen-border" block-attribute-1="style" block-handler-2="mousedown" block-handler-3="mouseup"/><div class="split-screen-right" block-attribute-4="style"><div class="container"> It works </div></div></div></div>`);
  
  return function template(ctx, node, key = "") {
    let attr1 = `width:calc(${ctx['state'].splitPosition}% - 1px);`;
    const b2 = comp1(Object.assign({}, ctx['root'], {updateComponent: bind(this, ctx['updateTree']),selectComponent: bind(this, ctx['selectComponent'])}), key + `__1`, node, this, null);
    let attr2 = `left:calc(${ctx['state'].splitPosition}% - 1px);`;
    let hdlr1 = [ctx['handleMouseDown'], ctx];
    let hdlr2 = [ctx['handleMouseUp'], ctx];
    let attr3 = `width:calc(${100-ctx['state'].splitPosition}%);`;
    return block1([attr1, attr2, hdlr1, hdlr2, attr3], [b2]);
  }
});

App.registerTemplate("devtools.details_window", function devtools_details_window(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { safeOutput, prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, true, false);
  
  let block2 = createBlock(`<div class="tree_component my-0 p-0" block-attribute-0="class" block-attribute-1="style" block-handler-2="click"><div class="component_wrapper" block-attribute-3="style"><block-child-0/><!-- <t t-esc="props.name"/> <t t-if="props.key"><div class="text-warning" style="display:inline;">key</div>="<t t-esc="props.key" style="display:inline;"/>"</t> --><block-text-4/> <block-child-1/></div></div>`);
  let block3 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style" block-handler-1="click"/>`);
  
  return function template(ctx, node, key = "") {
    let b3,b4;
    let attr1 = {'component_selected':ctx['props'].selected,'component_highlighted':ctx['props'].highlighted};
    let attr2 = `display: ${ctx['props'].display?'flex':'none'}`;
    let hdlr1 = [ctx['toggleComponent'], ctx];
    let attr3 = `transform: translateX(calc(${ctx['props'].depth} * 0.8rem))`;
    if (ctx['props'].children.length>0) {
      let attr4 = `cursor: pointer;${ctx['props'].toggled?'transform: rotate(90deg);':''}`;
      let hdlr2 = [ctx['toggleDisplay'], ctx];
      b3 = block3([attr4, hdlr2]);
    }
    let txt1 = ctx['props'].name;
    b4 = safeOutput(this.getMinimizedKey());
    const b2 = block2([attr1, attr2, hdlr1, attr3, txt1], [b3, b4]);
    ctx = Object.create(ctx);
    const [k_block5, v_block5, l_block5, c_block5] = prepareList(ctx['props'].children);;
    for (let i1 = 0; i1 < l_block5; i1++) {
      ctx[`child`] = v_block5[i1];
      const key1 = ctx['child'].key;
      c_block5[i1] = withKey(comp1(Object.assign({}, ctx['child'], {updateComponent: ctx['props'].updateComponent,selectComponent: ctx['props'].selectComponent}), key + `__1__${key1}`, node, this, null), key1);
    }
    const b5 = list(c_block5);
    return multi([b2, b5]);
  }
});

App.registerTemplate("devtools.property", function devtools_property(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  return function template(ctx, node, key = "") {
    return text(``);
  }
});

App.registerTemplate("devtools.tree_element", function devtools_tree_element(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { safeOutput, prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, true, false);
  
  let block2 = createBlock(`<div class="tree_component my-0 p-0" block-attribute-0="class" block-attribute-1="style" block-handler-2="click"><div class="component_wrapper" block-attribute-3="style"><block-child-0/><block-child-1/><block-text-4/> <block-child-2/></div></div>`);
  let block3 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style" block-handler-1="click"/>`);
  let block4 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style"/>`);
  
  return function template(ctx, node, key = "") {
    let b3,b4,b5;
    let attr1 = {'component_selected':ctx['props'].selected,'component_highlighted':ctx['props'].highlighted};
    let attr2 = `display: ${ctx['props'].display?'flex':'none'}`;
    let hdlr1 = [ctx['toggleComponent'], ctx];
    let attr3 = `transform: translateX(calc(${ctx['props'].depth} * 0.8rem))`;
    if (ctx['props'].children.length>0) {
      let attr4 = `cursor: pointer;${ctx['props'].toggled?'transform: rotate(90deg);':''}`;
      let hdlr2 = [ctx['toggleDisplay'], ctx];
      b3 = block3([attr4, hdlr2]);
    } else {
      let attr5 = `cursor: pointer; visibility: hidden;`;
      b4 = block4([attr5]);
    }
    let txt1 = ctx['props'].name;
    b5 = safeOutput(this.getMinimizedKey());
    const b2 = block2([attr1, attr2, hdlr1, attr3, txt1], [b3, b4, b5]);
    ctx = Object.create(ctx);
    const [k_block6, v_block6, l_block6, c_block6] = prepareList(ctx['props'].children);;
    for (let i1 = 0; i1 < l_block6; i1++) {
      ctx[`child`] = v_block6[i1];
      const key1 = ctx['child'].name;
      c_block6[i1] = withKey(comp1(Object.assign({}, ctx['child'], {updateComponent: ctx['props'].updateComponent,selectComponent: ctx['props'].selectComponent}), key + `__1__${key1}`, node, this, null), key1);
    }
    const b6 = list(c_block6);
    return multi([b2, b6]);
  }
});

App.registerTemplate("devtools.events", function devtools_events(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  
  let block1 = createBlock(`<div id="container"> Events page </div>`);
  
  return function template(ctx, node, key = "") {
    return block1();
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
    if (ctx['status'].value=='not_found') {
      b2 = block2();
    }
    if (ctx['status'].value=='enabled') {
      b3 = block3();
    }
    return block1([], [b2, b3]);
  }
});
