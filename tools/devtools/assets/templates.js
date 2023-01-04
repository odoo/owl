import { App } from "@odoo/owl";

App.registerTemplate("devtools.components_tree", function devtools_components_tree(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { bind } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, true, false);
  const comp2 = app.createComponent(`DetailsWindow`, true, false, false, false);
  
  let block1 = createBlock(`<div id="container" block-handler-0="mouseover.stop" block-handler-1="mouseout.stop"><div class="split-screen-container"><div class="split-screen-left" block-attribute-2="style"><div class="details-panel my-1"> Search bar </div><div class="horizontal-border"/><block-child-0/></div><div class="split-screen-border" block-attribute-3="style" block-handler-4="mousedown" block-handler-5="mouseup"/><div class="split-screen-right" block-attribute-6="style"><block-child-1/></div></div></div>`);
  
  return function template(ctx, node, key = "") {
    let hdlr1 = ["stop", ctx['removeHighlight'], ctx];
    let hdlr2 = ["stop", ctx['removeHighlight'], ctx];
    let attr1 = `width:calc(${ctx['state'].splitPosition}% - 1px);`;
    const b2 = comp1(Object.assign({}, ctx['root'], {updateComponent: bind(this, ctx['updateTree']),selectComponent: bind(this, ctx['selectComponent'])}), key + `__1`, node, this, null);
    let attr2 = `left:calc(${ctx['state'].splitPosition}% - 1px);`;
    let hdlr3 = [ctx['handleMouseDown'], ctx];
    let hdlr4 = [ctx['handleMouseUp'], ctx];
    let attr3 = `width:calc(${100-ctx['state'].splitPosition}%);`;
    const b3 = comp2({activeComponent: ctx['activeComponent'],updateProperty: bind(this, ctx['updateProperties'])}, key + `__2`, node, this, null);
    return block1([hdlr1, hdlr2, attr1, attr2, hdlr3, hdlr4, attr3], [b2, b3]);
  }
});

App.registerTemplate("devtools.details_window", function devtools_details_window(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`Property`, true, false, true, false);
  
  let block1 = createBlock(`<div class="details_window my-1"><div id="details_window_head" class="details-panel my-1"><div class="name_wrapper"><b><block-text-0/></b></div></div><div class="horizontal-border"/><div id="props" class="details-panel my-1"><b>props</b><block-child-0/></div><div class="horizontal-border"/><div id="hooks" class="details-panel my-1"><b>hooks</b></div><!-- <div class="horizontal-border">
      </div>
      <div id="rendered_by" class="details-panel my-1">
        <b>rendered by</b>
      </div> --></div>`);
  
  return function template(ctx, node, key = "") {
    let txt1 = ctx['componentName'];
    ctx = Object.create(ctx);
    const [k_block2, v_block2, l_block2, c_block2] = prepareList(ctx['activeProperties']);;
    for (let i1 = 0; i1 < l_block2; i1++) {
      ctx[`key`] = v_block2[i1];
      const key1 = ctx['key'];
      c_block2[i1] = withKey(comp1(Object.assign({}, ctx['activeProperties'][ctx['key']], {updateProperty: ctx['props'].updateProperty}), key + `__1__${key1}`, node, this, null), key1);
    }
    ctx = ctx.__proto__;
    const b2 = list(c_block2);
    return block1([txt1], [b2]);
  }
});

App.registerTemplate("devtools.property", function devtools_property(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { safeOutput, prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`Property`, true, false, true, false);
  
  let block2 = createBlock(`<div class="my-0 p-0 property-line" block-attribute-0="style" block-handler-1="click"><div block-attribute-2="style"><block-child-0/><block-child-1/><block-child-2/>: <div class="property-content"><block-child-3/></div></div></div>`);
  let block3 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style"/>`);
  let block4 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style"/>`);
  
  return function template(ctx, node, key = "") {
    let b3,b4,b5,b6;
    let attr1 = `display: ${ctx['props'].display?'flex':'none'}`;
    let hdlr1 = [ctx['toggleDisplay'], ctx];
    let attr2 = `transform: translateX(calc(${ctx['props'].depth} * 0.8rem + 0.3rem))`;
    if (ctx['props'].hasChildren) {
      let attr3 = `cursor: pointer;${ctx['props'].toggled?'transform: rotate(90deg);':''}`;
      b3 = block3([attr3]);
    } else {
      let attr4 = `cursor: pointer; visibility: hidden;`;
      b4 = block4([attr4]);
    }
    b5 = safeOutput(ctx['props'].name);
    b6 = safeOutput(ctx['content']);
    const b2 = block2([attr1, hdlr1, attr2], [b3, b4, b5, b6]);
    ctx = Object.create(ctx);
    const [k_block7, v_block7, l_block7, c_block7] = prepareList(ctx['props'].children);;
    for (let i1 = 0; i1 < l_block7; i1++) {
      ctx[`child`] = v_block7[i1];
      const key1 = ctx['child'].name;
      c_block7[i1] = withKey(comp1(Object.assign({}, ctx['child'], {updateProperty: ctx['props'].updateProperty}), key + `__1__${key1}`, node, this, null), key1);
    }
    const b7 = list(c_block7);
    return multi([b2, b7]);
  }
});

App.registerTemplate("devtools.tree_element", function devtools_tree_element(app, bdom, helpers
) {
  let { text, createBlock, list, multi, html, toggler, comment } = bdom;
  let { safeOutput, prepareList, withKey } = helpers;
  const comp1 = app.createComponent(`TreeElement`, true, false, true, false);
  
  let block2 = createBlock(`<div block-attribute-0="id" class="tree_component my-0 p-0" block-attribute-1="class" block-attribute-2="style" block-handler-3="mouseover.stop" block-handler-4="click.stop"><div class="component_wrapper" block-attribute-5="style"><block-child-0/><block-child-1/><div class="name_wrapper"><block-text-6/> <block-child-2/></div></div></div>`);
  let block3 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style" block-handler-1="click.stop"/>`);
  let block4 = createBlock(`<i class="fa fa-caret-right mx-1" block-attribute-0="style"/>`);
  
  return function template(ctx, node, key = "") {
    let b3,b4,b5;
    let attr1 = `tree_element/${ctx['props'].path}`;
    let attr2 = {'component_selected':ctx['props'].selected,'component_highlighted':ctx['props'].highlighted};
    let attr3 = `display: ${ctx['props'].display?'flex':'none'}`;
    let hdlr1 = ["stop", ctx['hoverComponent'], ctx];
    let hdlr2 = ["stop", ctx['toggleComponent'], ctx];
    let attr4 = `transform: translateX(calc(${ctx['props'].depth} * 0.8rem))`;
    if (ctx['props'].children.length>0) {
      let attr5 = `cursor: pointer;${ctx['props'].toggled?'transform: rotate(90deg);':''}`;
      let hdlr3 = ["stop", ctx['toggleDisplay'], ctx];
      b3 = block3([attr5, hdlr3]);
    } else {
      let attr6 = `cursor: pointer; visibility: hidden;`;
      b4 = block4([attr6]);
    }
    let txt1 = ctx['props'].name;
    b5 = safeOutput(this.getMinimizedKey());
    const b2 = block2([attr1, attr2, attr3, hdlr1, hdlr2, attr4, txt1], [b3, b4, b5]);
    ctx = Object.create(ctx);
    const [k_block6, v_block6, l_block6, c_block6] = prepareList(ctx['props'].children);;
    for (let i1 = 0; i1 < l_block6; i1++) {
      ctx[`child`] = v_block6[i1];
      const key1 = ctx['child'].key;
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
