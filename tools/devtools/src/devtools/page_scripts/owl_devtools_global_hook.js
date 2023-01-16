export class OwlDevtoolsGlobalHook {
  currentSelectedElement;
  root;
  fibersMap;

  constructor(){
    const [application] = owl.App.apps;
    this.root = application.root;
    this.fibersMap = new WeakMap();
  }

  // Draws a highlighting rectangle on the specified html element and displays the specified name and its dimension in a box
  highlightElements(elements, name) {
    this.removeHighlights();
  
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
  removeHighlights(){
    const highlights = document.querySelectorAll('.owl-devtools-highlight');
    highlights.forEach(highlight => highlight.remove());
    const details = document.querySelectorAll('.owl-devtools-detailsBox');
    details.forEach(detail => detail.remove());
  };

  HTMLSelector(ev){
    const target = ev.target;
    if (!this.currentSelectedElement || !(target.isEqualNode(this.currentSelectedElement))){
      const path = this.getElementPath(target);
      this.highlightComponent(path);
      this.currentSelectedElement = target;
      window.postMessage({type: "SelectElement", path: path});
    }
  }
  enableHTMLSelector(){
    document.addEventListener("mousemove", this.HTMLSelector);
    document.addEventListener("click", this.disableHTMLSelector, true);
    document.addEventListener("mouseout", this.removeHighlights);
  }
  disableHTMLSelector(event = undefined){
    if(event)
      event.stopPropagation();
    this.removeHighlights();
    document.removeEventListener("mousemove", this.HTMLSelector);
    document.removeEventListener("click", this.disableHTMLSelector);
    document.removeEventListener("mouseout", this.removeHighlights);
    window.postMessage({type: "StopSelector"});
  }

  parseItem(value){
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
  parseContent(obj, type){
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
        result += this.parseItem(value);
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
        result += this.parseItem(value);
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
  getObject(top_parent, path){
    let obj = top_parent;
    if(path.length === 0)
      return obj;
    const path_array = path.split('/');
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

  getParsedObjectChild(componentPath, parentObj, key, depth, type, path, expandBag){
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
        child.content = this.parseContent(obj, child.contentType);
      child.hasChildren = child.contentType === 'object' ? Reflect.ownKeys(obj).length > 0 : (child.contentType === 'array' ? obj.length > 0 : false);
    }
    child.children = [];
    if(child.toggled && child.display){
      child.children = this.loadObjectChildren(componentPath, child.path, child.depth, child.contentType, child.objectType, expandBag);
    }
    return child;
  }
  // Returns a parsed version of the children properties of the specified component's property given its path. 
  loadObjectChildren(componentPath, objPath, depth, type, objType, expandBag){
    if (typeof expandBag === 'string'){
      expandBag = JSON.parse(expandBag);
    }
    let children = [];
    depth = depth + 1;
    const component = this.getComponent(componentPath);
    let obj;
    if (objType === 'props')
      obj = this.getObject(component.props, objPath);
    if (objType === 'env')
      obj = this.getObject(component.component.env, objPath);
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
      const top_parent = component.subscriptions[index].target;
      obj = this.getObject(top_parent, new_path);
    }
    if(!obj)
      return [];
    if (type === 'array'){
      for(let index = 0; index < obj.length; index++){
        const child = this.getParsedObjectChild(componentPath, obj, index, depth, objType, objPath, expandBag)
        children.push(child);
      };
    }
    else if (type === 'object'){
      Reflect.ownKeys(obj).forEach(key => {
        const child = this.getParsedObjectChild(componentPath, obj, key, depth, objType, objPath, expandBag)
        children.push(child);
      });
    }
    const prototype = this.getParsedObjectChild(componentPath, obj, "[[Prototype]]", depth, objType, objPath, expandBag)
    children.push(prototype);
    return children;
  };
  // Returns the Component given its path and the root component
  getComponent(path){
    let component = this.root;
    const path_array = path.split('/');
    for (let i = 1; i < path_array.length; i++) {
      if (component.children.hasOwnProperty(path_array[i]))
        component = component.children[path_array[i]];
      else
        return null;
    }
    return component;
  };

  refreshComponent(path){
    const component = this.getComponent(path);
    component.render(true);
  }
  // Returns the component's details given its path
  sendComponentDetails(path = null, expandBag = '{"props":{},"env":{},"subscription":{}}'){ 
    let component = {};
    expandBag = JSON.parse(expandBag);
    if(!path){
      path = this.getElementPath($0);
    }
    component.path = path;
    let node = this.getComponent(path);
    if(!node)
      node = this.root;
    // Load props of the component
    const props = node.props;
    component.properties = {};
    component.name = node.component.constructor.name;
    Reflect.ownKeys(props).forEach(key => {
      const property = this.getParsedObjectChild(path, props, key, 0, 'props', '', expandBag);
      if(typeof key === 'symbol')
        component.properties[key.toString()] = property;
      else
        component.properties[key] = property;
    });
    const propsPrototype = this.getParsedObjectChild(path, props, "[[Prototype]]", 0, 'props', '', expandBag);
    component.properties["[[Prototype]]"] = propsPrototype;
    // Load env of the component
    const env = node.component.env;
    component.env = {};
    Reflect.ownKeys(env).forEach(key => {
      const envElement = this.getParsedObjectChild(path, env, key, 0, 'env', '', expandBag);
      if(typeof key === 'symbol')
        component.env[key.toString()] = envElement;
      else
        component.env[key] = envElement;
    });
    const envPrototype = this.getParsedObjectChild(path, env, "[[Prototype]]", 0, 'env', '', expandBag);
    component.env["[[Prototype]]"] = envPrototype;
    // Load subscriptions of the component
    const raw_subscriptions = node.subscriptions;
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
        subscription.target.content = this.parseContent(raw_subscription.target, subscription.target.contentType);
        subscription.target.hasChildren = subscription.target.contentType === 'object' ? Object.keys(raw_subscription.target).length > 0 : (subscription.target.contentType === 'array' ? raw_subscription.target.length > 0 : false);
      }
      subscription.target.children = [];
      if(subscription.target.toggled){
        subscription.target.children = this.loadObjectChildren(component.path, subscription.target.path, subscription.target.depth, subscription.target.contentType, subscription.target.objectType, expandBag);
      }
      component.subscriptions.push(subscription);
    });
    component.expandBag = expandBag;
    return component;
  };

  getDOMElementsOfComponent(component){
    if(component.bdom.hasOwnProperty("el"))
      return [component.bdom.el];
    if(component.bdom.hasOwnProperty("child") && component.bdom.child.hasOwnProperty("el"))
      return [component.bdom.child.el];
    if(component.bdom.hasOwnProperty("children") && component.bdom.children.length > 0){
      let elements = [];
      for(const child of component.bdom.children){
        if(child && child.hasOwnProperty("el"))
          elements.push(child.el);
      }
      if (elements.length > 0){
        return elements;
      }
    }
    if(component.bdom.hasOwnProperty("parentEl"))
      return [component.bdom.parentEl];
  }
  // Triggers the highlight effect around the specified component.
  highlightComponent(path){
    // root node (App) is special since it only has a parentEl as attached element
    let component = this.getComponent(path);
    if(!component){
      path = "App";
      component = this.root;
    }
    const elements = this.getDOMElementsOfComponent(component);
    this.highlightElements(elements, component.component.constructor.name);
  };
  // Recursively fills the components tree as a parsed version
  fillTree(app_node, tree_node, inspectedPath){
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
      child.children = this.fillTree(app_child, child, inspectedPath);
      children.push(child);
    }
    return children;
  };
  // Edit a reactive state property with the provided value of the given component (path) and the subscription path
  editObject(componentPath, object_path, value, object_type){
    const component = this.getComponent(componentPath);
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
      const target = owl.reactive(component.subscriptions[index].target);
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
        obj = this.getObject(component.props, path);
      else if (object_type === 'env')
        obj = this.getObject(component.component.env, path);
      if(!obj) 
        return;
      obj[key] = value;
      if(object_type === 'props')
        component.render(true);
      else if (object_type === 'env')
        this.root.render(true);
    }

  };
  // Recursively checks if the given html element corresponds to a component in the components tree.
  // Immediatly returns the path of the first component which matches the element
  searchElement(node, path, element){
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
      const result = this.searchElement(child, path + "\/" + key, element);
      if (result){
        return result;
      }
    }
    return null;
  }
  // Returns the path to the component which is currently being inspected
  getElementPath(element){
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
      for (const elem of parentsList) {
        const inspectedPath = this.searchElement(this.root, 'App', elem);
        if(inspectedPath)
          return inspectedPath;
      }
    }
    // If nothing was found, return the root component path
    return "App";
  }
  // Returns the tree of components of the inspected page in a parsed format
  // Use inspectedPath to specify the path of the selected component
  getComponentsTree(inspectedPath = null){ 
    let tree = {};
    tree.root = {
      name: this.root.component.constructor.name,
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
      inspectedPath = this.getElementPath($0);
    }
    if(inspectedPath === "App")
      tree.root.selected = true;
    tree.root.children = this.fillTree(this.root, tree.root, inspectedPath);
    return tree;
  };

  getComponentPath(component){
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
  // Store the object into a temp window variable and log it to the console
  sendObjectToConsole(componentPath, objectType){
    const component = this.getComponent(componentPath);
    let index = 1;
    while(window["temp" + index] !== undefined)
      index++;
    switch(objectType){
      case "component":
        window["temp" + index] = component;
        break;
      case "props":
        window["temp" + index] = component.props;
        break;
      case "env":
        window["temp" + index] = component.component.env;
        break;
      case "subscription":
        window["temp" + index] = component.subscriptions;
        break;
    }
    console.log("temp" + index + " = ", window["temp" + index]);
  }

  inspectComponent(componentPath){
    const component = this.getComponent(componentPath);
    const elements = this.getDOMElementsOfComponent(component);
    inspect(elements[0]);
  }
}