// Ensure the scripts are loaded only once per page
if(!window.owlDevtools__ScriptsLoaded){
  // Draws a highlighting rectangle on the specified html element and displays the specified name and its dimension in a box
  function owlDevtools__HighlightElements(elements, name) {
    owlDevtools__RemoveHighlights();
  
    
    let minTop = Number.MAX_SAFE_INTEGER;
    let minLeft = Number.MAX_SAFE_INTEGER;
    let maxBottom = Number.MIN_SAFE_INTEGER;
    let maxRight = Number.MIN_SAFE_INTEGER;
    
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      const top = rect.top + scrollTop;
      const left = rect.left + scrollLeft;
      const bottom = top + rect.height;
      const right = left + rect.width;

      const marginTop = parseInt(getComputedStyle(element).marginTop);
      const marginRight = parseInt(getComputedStyle(element).marginRight);
      const marginBottom = parseInt(getComputedStyle(element).marginBottom);
      const marginLeft = parseInt(getComputedStyle(element).marginLeft);
      
      minTop = Math.min(minTop, top);
      minLeft = Math.min(minLeft, left);
      maxBottom = Math.max(maxBottom, bottom);
      maxRight = Math.max(maxRight, right);

      const width = right - left;
      const height = bottom - top;

      const highlightMargins = document.createElement('div');
      highlightMargins.className = 'owl-devtools-highlight';
      highlightMargins.style.top = `${top - marginTop}px`;
      highlightMargins.style.left = `${left - marginLeft}px`;
      highlightMargins.style.width = `${width + marginLeft + marginRight}px`;
      highlightMargins.style.height = `${height + marginBottom + marginTop}px`;
      highlightMargins.style.position = 'absolute';
      highlightMargins.style.backgroundColor = 'rgba(241, 179, 121, 0.4)'
      highlightMargins.style.zIndex = '1000';
      highlightMargins.style.pointerEvents = 'none';
      
      document.body.appendChild(highlightMargins);
      const highlight = document.createElement('div');
      highlight.className = 'owl-devtools-highlight';
      highlight.style.top = `${top}px`;
      highlight.style.left = `${left}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;
      highlight.style.position = 'absolute';
      highlight.style.backgroundColor = 'rgba(40, 123, 231, 0.4)'
      highlight.style.zIndex = '1000';
      highlight.style.pointerEvents = 'none';
      document.body.appendChild(highlight);
      
    }
    
    const width = maxRight - minLeft;
    const height = maxBottom - minTop;
    
    const detailsBox = document.createElement('div');
    detailsBox.className = 'owl-devtools-detailsBox';
    detailsBox.innerHTML = `
    <div style="color: #ffc107; display: inline;">${name} </div><div style="color: white; display: inline;">${width.toFixed(2)}px x ${height.toFixed(2)}px</div>
    `;
    detailsBox.style.position = 'absolute';
    detailsBox.style.backgroundColor = 'black';
    detailsBox.style.padding = '5px';
    detailsBox.style.zIndex = '1000';
    detailsBox.style.pointerEvents = 'none';
    detailsBox.style.display = 'inline';
    document.body.appendChild(detailsBox);
    
    const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
    const detailsBoxRect = detailsBox.getBoundingClientRect();
    let detailsBoxTop = minTop + height + 5;
    let detailsBoxLeft = minLeft;
    if (detailsBoxTop + detailsBoxRect.height > viewportHeight) {
      detailsBoxTop = minTop - detailsBoxRect.height - 5;
      if (detailsBoxTop < 0) {
        detailsBoxTop = minTop;
      }
    }
    if (detailsBoxLeft + detailsBoxRect.width > viewportWidth) {
      detailsBoxLeft = minLeft - detailsBoxRect.width - 5;
    }
    detailsBox.style.top = `${detailsBoxTop}px`;
    detailsBox.style.left = `${detailsBoxLeft + 5}px`;
  };
  // Remove all elements drawn by the HighlightElement function
  function owlDevtools__RemoveHighlights(){
    const highlights = document.querySelectorAll('.owl-devtools-highlight');
    highlights.forEach(highlight => highlight.remove());
    const details = document.querySelectorAll('.owl-devtools-detailsBox');
    details.forEach(highlight => highlight.remove());
  };

  var owlDevtools__CurrentSelectedElement = null;

  var owlDevtools__HTMLSelector = function(ev){
    let target = ev.target;
    if (!owlDevtools__CurrentSelectedElement || !(target.isEqualNode(owlDevtools__CurrentSelectedElement))){
      let [application] = owl.App.apps;
      let root = application.root;
      let path = owlDevtools__GetElementPath(target, root);
      owlDevtools__HighlightComponent(path);
      owlDevtools__CurrentSelectedElement = target;
      window.postMessage({type: "owlDevtools__SelectElement", path: path});
    }
  }
  function owlDevtools__EnableHTMLSelector(){
    document.addEventListener("mousemove", owlDevtools__HTMLSelector);
    document.addEventListener("click", owlDevtools__DisableHTMLSelector, true);
    document.addEventListener("mouseout", owlDevtools__RemoveHighlights);
  }
  function owlDevtools__DisableHTMLSelector(event = undefined){
    if(event)
      event.stopPropagation();
    owlDevtools__RemoveHighlights();
    document.removeEventListener("mousemove", owlDevtools__HTMLSelector);
    document.removeEventListener("click", owlDevtools__DisableHTMLSelector);
    document.removeEventListener("mouseout", owlDevtools__RemoveHighlights);
    window.postMessage({type: "owlDevtools__StopSelector"});
  }

  function owlDevtools__ParseItem(value){
    if (typeof value === 'array'){
      return "Array("+value.length+")";
    }
    else if (typeof value === 'object'){
      if (value == null)
        return "null";
      else
        return "{...}";
    }
    else if (typeof value === 'undefined'){
      return "undefined";
    }
    else
      return value.toString();
  }
  // Returns a shortened version of the property as a string
  function owlDevtools__ParseContent(obj, type){
    let result = "";
    let first = true;
    if (type === 'array'){
      result += "[";
      for (const value of obj){
        if (!first)
          result += ", ";
        else{
          first = false;
        }
        if (result.length > 30){
          result+= "...";
          break;
        }
        result += owlDevtools__ParseItem(value);
      }
      result += "]";
    }
    else if (type === 'object'){
      result += "{";
      for (const [key, value] of Object.entries(obj)) {
        if (!first)
          result += ", " + key + ": ";
        else{
          first = false;
          result += key + ": "
        }
        if (result.length > 30){
          result+= "...";
          break;
        }
        result += owlDevtools__ParseItem(value);
      }
      result += "}";
    }
    else if (type === 'string')
      result += '"' + obj + '"';
    else 
      result += obj.toString();
    return result;
  }
  // Returns the object specified by the path given the top parent object
  function owlDevtools__GetObject(top_parent, path){
    let obj = top_parent;
    if(path.length === 0)
      return obj;
    let path_array = path.split('/');
    for (const key of path_array) {
      if(obj.hasOwnProperty(key))
        obj = obj[key];
      else if(key === "[[Prototype]]")
        obj = Object.getPrototypeOf(obj);
      else if(key.includes('Symbol(')){
        let symbol;
        Object.getOwnPropertySymbols(obj).forEach((sym) => {
          if (sym.toString() === key){
            symbol = sym;
          }
        })
        if(symbol)
          obj = obj[symbol];
        else
          return null
      }
    }
    return obj;
  };

  function owlDevtools__GetParsedObjectChild(componentPath, parentObj, key, depth, type, path, expandBag){
    let obj;
    if(key === "[[Prototype]]")
      obj = Object.getPrototypeOf(parentObj);
    else
      obj = parentObj[key];
    let child = {
      name: key, 
      contentType: typeof obj === 'object' ? (Array.isArray(obj) ? 'array' : 'object') : typeof obj,
      depth: depth,
      toggled: false,
      display: true,
      objectType: type
    };
    if(typeof key === 'symbol'){
      child.name = key.toString();
      child.path = key.toString();
    }
    else
      child.path = path.length > 0 ? path + "\/" + key : key;
    if (expandBag.hasOwnProperty(child.path)){
      child.toggled = expandBag[child.path].toggled;
      child.display = expandBag[child.path].display;
    }
    if (obj == null){
      if (child.contentType === 'undefined')
        child.content = "undefined";
      else
        child.content = "null";
        child.hasChildren = false;
    }
    else{
      if(key === "[[Prototype]]")
        child.content = typeof parentObj === 'object' ? (Array.isArray(parentObj) ? 'Array(0)' : 'Object') : typeof parentObj;
      else
        child.content = owlDevtools__ParseContent(obj, child.contentType);
      child.hasChildren = child.contentType === 'object' ? Reflect.ownKeys(obj).length > 0 : (child.contentType === 'array' ? obj.length > 0 : false);
    }
    child.children = [];
    if(child.toggled && child.display){
      child.children = owlDevtools__LoadObjectChildren(componentPath, child.path, child.depth, child.contentType, child.objectType, expandBag);
    }
    return child;
  }
  // Returns a parsed version of the children properties of the specified component's property given its path. 
  function owlDevtools__LoadObjectChildren(componentPath, objPath, depth, type, objType, expandBag){
    if (typeof expandBag === 'string'){
      expandBag = JSON.parse(expandBag);
    }
    let [application] = owl.App.apps; 
    let root = application.root;
    let children = [];
    depth = depth + 1;
    let component = owlDevtools__GetComponent(componentPath, root);
    let obj;
    if (objType === 'props')
      obj = owlDevtools__GetObject(component.props, objPath);
    if (objType === 'env')
      obj = owlDevtools__GetObject(component.component.env, objPath);
    else if (objType === 'subscription') {
      let index, new_path;
      if(objPath.includes('/')){
        index = objPath.substring(0, objPath.indexOf('/'));
        new_path = objPath.substring(objPath.indexOf("/") + 1);
      }
      else {
        index = objPath;
        new_path = "";
      }
      let top_parent = component.subscriptions[index].target;
      obj = owlDevtools__GetObject(top_parent, new_path);
    }
    if(!obj)
      return [];
    if (type === 'array'){
      for(let index = 0; index < obj.length; index++){
        const child = owlDevtools__GetParsedObjectChild(componentPath, obj, index, depth, objType, objPath, expandBag)
        children.push(child);
      };
    }
    else if (type === 'object'){
      Reflect.ownKeys(obj).forEach(key => {
        const child = owlDevtools__GetParsedObjectChild(componentPath, obj, key, depth, objType, objPath, expandBag)
        children.push(child);
      });
    }
    const prototype = owlDevtools__GetParsedObjectChild(componentPath, obj, "[[Prototype]]", depth, objType, objPath, expandBag)
    children.push(prototype);
    return children;
  };
  // Returns the Component given its path and the root component
  function owlDevtools__GetComponent(path, root){
    let component = root;
    let path_array = path.split('/');
    for (let i = 1; i < path_array.length; i++) {
      if (component.children.hasOwnProperty(path_array[i]))
        component = component.children[path_array[i]];
      else
        return null;
    }
    return component;
  };

  function owlDevtools__RefreshComponent(path){
    const [application] = owl.App.apps;
    const root = application.root;
    let component = owlDevtools__GetComponent(path, root);
    component.render(true);
  }
  // Returns the component's details given its path
  function owlDevtools__SendComponentDetails(path = null, expandBag = '{"props":{},"env":{},"subscription":{}}'){ 
    let [application] = owl.App.apps; 
    let root = application.root;
    let component = {};
    expandBag = JSON.parse(expandBag);
    if(!path){
      path = owlDevtools__GetElementPath($0, root);
    }
    component.path = path;
    let node = owlDevtools__GetComponent(path, root);
    if(!node)
      node = root;
    // Load props of the component
    let props = node.props;
    component.properties = {};
    component.name = node.component.constructor.name;
    Reflect.ownKeys(props).forEach(key => {
      let property = owlDevtools__GetParsedObjectChild(path, props, key, 0, 'props', '', expandBag);
      if(typeof key === 'symbol')
        component.properties[key.toString()] = property;
      else
        component.properties[key] = property;
    });
    const propsPrototype = owlDevtools__GetParsedObjectChild(path, props, "[[Prototype]]", 0, 'props', '', expandBag);
    component.properties["[[Prototype]]"] = propsPrototype;
    // Load env of the component
    let env = node.component.env;
    component.env = {};
    Reflect.ownKeys(env).forEach(key => {
      let envElement = owlDevtools__GetParsedObjectChild(path, env, key, 0, 'env', '', expandBag);
      if(typeof key === 'symbol')
        component.env[key.toString()] = envElement;
      else
        component.env[key] = envElement;
    });
    const envPrototype = owlDevtools__GetParsedObjectChild(path, env, "[[Prototype]]", 0, 'env', '', expandBag);
    component.env["[[Prototype]]"] = envPrototype;
    // Load subscriptions of the component
    let raw_subscriptions = node.subscriptions;
    component.subscriptions = [];
    raw_subscriptions.forEach((raw_subscription, index) => {
      let subscription = {
        keys: [],
        target: {
          name: "target", 
          contentType: typeof raw_subscription.target === 'object' ? (Array.isArray(raw_subscription.target) ? 'array' : 'object') : raw_subscription.target,
          depth: 0,
          path: index.toString(),
          toggled: false,
          display: true,
          objectType: "subscription"
        },
        keysExpanded: false
      }
      if (expandBag.subscription.hasOwnProperty(subscription.target.path)){
        subscription.target.toggled = expandBag.subscription[subscription.target.path].toggled;
      }
      raw_subscription.keys.forEach(key => {
        if (typeof key === "symbol")
          subscription.keys.push(key.toString());
        else
          subscription.keys.push(key);
      });
      if (raw_subscription.target == null){
        if (subscription.target.contentType === 'undefined')
          subscription.target.content = "undefined";
        else
          subscription.target.content = "null";
        subscription.target.hasChildren = false;
      }
      else{
        subscription.target.content = owlDevtools__ParseContent(raw_subscription.target, subscription.target.contentType);
        subscription.target.hasChildren = subscription.target.contentType === 'object' ? Object.keys(raw_subscription.target).length > 0 : (subscription.target.contentType === 'array' ? raw_subscription.target.length > 0 : false);
      }
      subscription.target.children = [];
      if(subscription.target.toggled){
        subscription.target.children = owlDevtools__LoadObjectChildren(component.path, subscription.target.path, subscription.target.depth, subscription.target.contentType, subscription.target.objectType, expandBag);
      }
      component.subscriptions.push(subscription);
    });
    component.expandBag = expandBag;
    return component;
  };
  // Triggers the highlight effect around the specified component.
  function owlDevtools__HighlightComponent(path){
    let [application] = owl.App.apps; 
    let root = application.root;
    // root node (App) is special since it only has a parentEl as attached element
    let component = owlDevtools__GetComponent(path, root);
    if(!component){
      path = "App";
      component = root;
    }
    if(component.bdom.hasOwnProperty("el")){
      owlDevtools__HighlightElements([component.bdom.el], component.component.constructor.name);
      return;
    }
    if(component.bdom.hasOwnProperty("child") && component.bdom.child.hasOwnProperty("el")){
      owlDevtools__HighlightElements([component.bdom.child.el], component.component.constructor.name);
      return;
    }
    if(component.bdom.hasOwnProperty("children") && component.bdom.children.length > 0){
      let elements = [];
      for(const child of component.bdom.children){
        if(child && child.hasOwnProperty("el"))
          elements.push(child.el);
      }
      if (elements.length > 0){
        owlDevtools__HighlightElements(elements, component.component.constructor.name);
        return;
      }
    }
    if(component.bdom.hasOwnProperty("parentEl"))
      owlDevtools__HighlightElements([component.bdom.parentEl], component.component.constructor.name);
  };
  // Recursively fills the components tree as a parsed version
  function owlDevtools__FillTree(app_node, tree_node, inspectedPath){
    let children = [];
    for (const [key, app_child] of Object.entries(app_node.children)){
      let child = {
        name: app_child.component.constructor.name,
        key: key,
        depth: tree_node.depth + 1,
        display: true,
        toggled: true,
        selected: false,
        highlighted: false
      };
      child.path = tree_node.path + "\/" + child.key;
      if (child.path === inspectedPath){
        child.selected = true;
      }
      else if (child.path.includes(inspectedPath)){
        child.highlighted = true;
      }
      child.children = owlDevtools__FillTree(app_child, child, inspectedPath);
      children.push(child);
    }
    return children;
  };
  // Edit a reactive state property with the provided value of the given component (path) and the subscription path
  function owlDevtools__EditObject(componentPath, object_path, value, object_type){
    let [application] = owl.App.apps; 
    let root = application.root;
    let component = owlDevtools__GetComponent(componentPath, root);
    let path_array;
    if(object_type === "subscription"){
      let index, new_path;
      if(object_path.includes('/')){
        index = Number(object_path.substring(0, object_path.indexOf('/')));
        new_path = object_path.substring(object_path.indexOf("/") + 1);
      }
      else {
        return;
      }
      path_array = new_path.split('/');
      let target = owl.reactive(component.subscriptions[index].target);
      path_array.reduce((acc, curr, idx, arr) => {
        if (idx === arr.length - 1) {
          acc[curr] = value;
        }
        return acc[curr];
      }, target);
    }
    else{
      let obj;
      let key, path;
      if (object_path.includes('/')){
        const index = object_path.lastIndexOf('/');
        key = object_path.substring(index + 1);
        path = object_path.substring(0, index);
      }
      else {
        key = object_path;
        path = "";
      }
      if (object_type === 'props')
        obj = owlDevtools__GetObject(component.props, path);
      else if (object_type === 'env')
        obj = owlDevtools__GetObject(component.component.env, path);
      if(!obj) 
        return;
      obj[key] = value;
      if(object_type === 'props')
        component.render(true);
      else if (object_type === 'env')
        root.render(true);
    }

  };
  // Recursively checks if the given html element corresponds to a component in the components tree.
  // Immediatly returns the path of the first component which matches the element
  function owlDevtools__SearchElement(node, path, element){
    // If the component is directly linked to the html element
    if (node.bdom.hasOwnProperty("el") && node.bdom.el.isEqualNode(element)){
      return path;
    }
    // If the component has only one child html element and it corresponds to the target element
    if (node.bdom.hasOwnProperty("child") && node.bdom.child.hasOwnProperty("el") && node.bdom.child.el.isEqualNode(element)){
      return path;
    }
    // If the component has several children and one of them is the target
    if(node.bdom.hasOwnProperty("children") && node.bdom.children.length > 0){
      for(const child of node.bdom.children){
        if(child && child.hasOwnProperty("el") && child.el.isEqualNode(element))
          return path;
      }
    }
    // Finally check if the target is parent of the component
    if (node.bdom.parentEl && node.bdom.parentEl.isEqualNode(element)){
      return path;
    }
    for (const [key, child] of Object.entries(node.children)){
      const result = owlDevtools__SearchElement(child, path + "\/" + key, element);
      if (result){
        return result;
      }
    }
    return null;
  }
  // Returns the path to the component which is currently being inspected
  function owlDevtools__GetElementPath(element, root){
    if(element){
      // Create an array with the html element and all its successive parents 
      let parentsList = [element];
      if(element.tagName !== 'BODY'){
        while (element.parentElement.tagName !== 'BODY'){
          element = element.parentElement;
          parentsList.push(element);
        }
      }
      // Try to find a correspondance between the elements in the array and the owl component, stops at first result found
      for (let i = 0; i < parentsList.length; i++) {
        inspectedPath = owlDevtools__SearchElement(root, 'App',parentsList[i]);
        if(inspectedPath)
          return inspectedPath;
      }
    }
    // If nothing was found, return the root component path
    return "App";
  }
  // Returns the tree of components of the inspected page in a parsed format
  // Use inspectedPath to specify the path of the selected component
  function owlDevtools__SendTree(inspectedPath = null){ 
    let [application] = owl.App.apps; 
    let root = application.root;
    let tree = {};
    tree.root = {
      name: root.component.constructor.name,
      path: "App",
      key: "",
      depth: 0,
      display: true,
      toggled: true,
      selected: false,
      highlighted: false,
    };
    // If no path is provided, it defaults to the target of the inspect element action
    if(!inspectedPath){
      inspectedPath = owlDevtools__GetElementPath($0, root);
    }
    if(inspectedPath === "App")
      tree.root.selected = true;
    tree.root.children = owlDevtools__FillTree(root, tree.root, inspectedPath);
    return tree;
  };

  function owlDevtools__GetComponentPath(component){
    if(component.parentKey){
      let path = "/" + component.parentKey;
      while(component.parent && component.parent.parentKey){
        component = component.parent;
        path = "/" + component.parentKey + path;
      }
      path = "App" + path;
      return path;
    }
    return "App";
  }
  let owlDevtools__FibersMap = new WeakMap();
  const owlDevtools__originalFlush = [...owl.App.apps][0].scheduler.flush;
  [...owl.App.apps][0].scheduler.flush = function() {
    let pathArray = [];
    [...this.tasks].map((fiber) => {
      if (fiber.counter === 0 && !owlDevtools__FibersMap.has(fiber)){
        owlDevtools__FibersMap.set(fiber, "");
        const path = owlDevtools__GetComponentPath(fiber.node);
        pathArray.push(path);
      }
    });
    owlDevtools__originalFlush.call(this, ...arguments);
    // Add a functionnality to the flush function which sends a message to the window every time it is triggered.
    // This message is intercepted by the content script which informs the background script to ask the devtools app tree to be refreshed.
    window.postMessage({type: "owlDevtools__Flush", paths: pathArray});
  };
  window.owlDevtools__ScriptsLoaded = true;
}
