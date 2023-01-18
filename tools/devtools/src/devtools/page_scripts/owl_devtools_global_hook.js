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
      window.postMessage({type: "owlDevtools__SelectElement", path: path});
    }
  }
  enableHTMLSelector(){
    document.addEventListener("mousemove", (ev) => this.HTMLSelector(ev));
    document.addEventListener("click", (ev) => this.disableHTMLSelector(ev), true);
    document.addEventListener("mouseout", this.removeHighlights);
  }
  disableHTMLSelector(event = undefined){
    if(event)
      event.stopPropagation();
    this.removeHighlights();
    document.removeEventListener("mousemove", (ev) => this.HTMLSelector(ev));
    document.removeEventListener("click", (ev) => this.disableHTMLSelector(ev));
    document.removeEventListener("mouseout", this.removeHighlights);
    window.postMessage({type: "owlDevtools__StopSelector"});
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
    else if (type === 'map'){
      result += "Map("+obj.size+"){";
      for (const [key, value] of obj.entries()) {
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
    else if (type === 'set'){
      result += "Set("+obj.size+"){";
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
      result += "}";
    }
    else if (type === 'string')
      result += '"' + obj + '"';
    else 
      result += obj.toString();
    return result;
  }
  // Returns the object specified by the path given the top parent object
  getObject(topParent, path){
    let obj = topParent;
    if(path.length === 0)
      return obj;
    const pathArray = path.split('/');
    for (const key of pathArray) {
      if(obj instanceof Map) 
        obj = obj.get(key);
      else if (obj instanceof Set)
        obj = Array.from(obj)[key];
      else if(obj.hasOwnProperty(key))
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
      obj = owl.toRaw(obj);
    }
    return obj;
  };

  getParsedObjectChild(componentPath, parentObj, key, depth, type, path, expandBag){
    console.log(parentObj, key)
    let obj;
    let child = {
      name: key,
      depth: depth,
      toggled: false,
      display: true,
      objectType: type
    };
    if(typeof key === 'symbol'){
      child.name = key.toString();
      child.path = path.length > 0 ? path + "\/" + key.toString() : key.toString();
    }
    else
      child.path = path.length > 0 ? path + "\/" + key : key;
    if (expandBag.hasOwnProperty(child.path)){
      child.toggled = expandBag[child.path].toggled;
      child.display = expandBag[child.path].display;
    }
    if(key === "[[Prototype]]")
      obj = Object.getPrototypeOf(parentObj);
    else{
      try{
        if(parentObj instanceof Map)
          obj = parentObj.get(key);
        else if (parentObj instanceof Set)
          obj = Array.from(parentObj)[key];
        else
          obj = parentObj[key]
      } catch(e){
        return null;
      }
    }
    console.log(obj);
    if (obj == null){
      if (typeof obj === 'undefined'){
        child.content = "undefined";
        child.contentType = "undefined";
      }
      else{
        child.content = "null";
        child.contentType = "object";
      }
      child.hasChildren = false;
    }
    else{
      obj = owl.toRaw(obj);
      switch(true) {
        case obj instanceof Map:
          child.contentType = "map";
          child.hasChildren = obj.size > 0;
          break;
        case obj instanceof Set:
          child.contentType = "set";
          child.hasChildren = obj.size > 0;
          break;
        case obj instanceof Array:
          child.contentType = "array";
          child.hasChildren = obj.length > 0;
          break;
        case typeof obj === 'function':
          child.contentType = "function";
          child.hasChildren = Reflect.ownKeys(obj).length > 0
          break;
        case obj instanceof Object:
          child.contentType = "object";
          child.hasChildren = Reflect.ownKeys(obj).length > 0
          break;
        default:
          child.contentType = typeof obj;
          child.hasChildren = false;
      }
      if(key === "[[Prototype]]"){
        switch(true){
          case parentObj instanceof Map:
            child.content = "Map";
            break;
          case parentObj instanceof Set:
            child.content = "Set";
            break;
          case parentObj instanceof Array:
            child.content = "Array(0)";
            break;
          case typeof parentObj === 'function':
            child.content = "Function";
            break;
          default:
            child.content = "Object"
        }
      }
      else
        child.content = this.parseContent(obj, child.contentType);
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
    const componentNode = this.getComponentNode(componentPath);
    let obj;
    if (objType === 'subscription') {
      let index, newPath;
      newPath = objPath.replace("subscription/", "");
      if(newPath.includes('/')){
        index = newPath.substring(0, newPath.indexOf('/'));
        newPath = newPath.substring(newPath.indexOf("/") + 1);
      }
      else {
        index = newPath;
        newPath = "";
      }
      const topParent = componentNode.subscriptions[index].target;
      obj = this.getObject(topParent, newPath);
    }
    else{
      obj = this.getObject(componentNode.component, objPath);
    }
    if(!obj)
      return [];
    if (type === 'array'){
      for(let index = 0; index < obj.length; index++){
        const child = this.getParsedObjectChild(componentPath, obj, index, depth, objType, objPath, expandBag)
        if(child)
          children.push(child);
      };
    }
    else if (type === 'map'){
      for (let key of obj.keys()) {
        const child = this.getParsedObjectChild(componentPath, obj, key, depth, objType, objPath, expandBag)
        if(child)
          children.push(child);
      };
    }
    else if (type === 'set'){
      for(let index = 0; index < obj.size; index++){
        const child = this.getParsedObjectChild(componentPath, obj, index, depth, objType, objPath, expandBag)
        if(child)
          children.push(child);
      };
    }
    else if (type === 'object' || type === 'function'){
      Reflect.ownKeys(obj).forEach(key => {
        const child = this.getParsedObjectChild(componentPath, obj, key, depth, objType, objPath, expandBag)
        if(child)
          children.push(child);
      });
    }
    const prototype = this.getParsedObjectChild(componentPath, obj, "[[Prototype]]", depth, objType, objPath, expandBag)
    children.push(prototype);
    return children;
  };
  // Returns the Component given its path and the root component
  getComponentNode(path){
    let component = this.root;
    const pathArray = path.split('/');
    for (let i = 1; i < pathArray.length; i++) {
      if (component.children.hasOwnProperty(pathArray[i]))
        component = component.children[pathArray[i]];
      else
        return null;
    }
    return component;
  };

  refreshComponent(path){
    const componentNode = this.getComponentNode(path);
    componentNode.render(true);
  }
  // Returns the component's details given its path
  getComponentDetails(path = null, expandBag = '{}'){ 
    let component = {};
    expandBag = JSON.parse(expandBag);
    if(!path){
      path = this.getElementPath($0);
    }
    component.path = path;
    let node = this.getComponentNode(path);
    if(!node)
      node = this.root;
    // Load props of the component
    const props = node.component.props;
    component.props = {};
    component.name = node.component.constructor.name;
    Reflect.ownKeys(props).forEach(key => {
      const property = this.getParsedObjectChild(path, props, key, 0, 'props', 'props', expandBag);
      if(property){
        if(typeof key === 'symbol')
          component.props[key.toString()] = property;
        else
          component.props[key] = property;
      }
    });
    // const propsPrototype = this.getParsedObjectChild(path, props, "[[Prototype]]", 0, 'props', 'props', expandBag);
    // component.props["[[Prototype]]"] = propsPrototype;
    // Load env of the component
    const env = node.component.env;
    component.env = {};
    Reflect.ownKeys(env).forEach(key => {
      const envElement = this.getParsedObjectChild(path, env, key, 0, 'env', 'env', expandBag);
      if(envElement){
        if(typeof key === 'symbol')
          component.env[key.toString()] = envElement;
        else
          component.env[key] = envElement;
      }
    });
    const envPrototype = this.getParsedObjectChild(path, env, "[[Prototype]]", 0, 'env', 'env', expandBag);
    component.env["[[Prototype]]"] = envPrototype;
    // Load instance of the component
    const instance = node.component;
    component.instance = {};
    Reflect.ownKeys(instance).forEach(key => {
      if(!["env", "props"].includes(key)){
        const instanceElement = this.getParsedObjectChild(path, instance, key, 0, 'instance', '', expandBag);
        if (instanceElement){
          if(typeof key === 'symbol')
            component.instance[key.toString()] = instanceElement;
          else
            component.instance[key] = instanceElement;
        }
      }
    });
    const instancePrototype = this.getParsedObjectChild(path, instance, "[[Prototype]]", 0, 'instance', '', expandBag);
    component.instance["[[Prototype]]"] = instancePrototype;

    // Load subscriptions of the component
    const rawSubscriptions = node.subscriptions;
    component.subscriptions = [];
    rawSubscriptions.forEach((rawSubscription, index) => {
      let subscription = {
        keys: [],
        target: {
          name: "target", 
          contentType: typeof rawSubscription.target === 'object' ? (Array.isArray(rawSubscription.target) ? 'array' : 'object') : rawSubscription.target,
          depth: 0,
          path: "subscription/" + index.toString(),
          toggled: false,
          display: true,
          objectType: "subscription"
        },
        keysExpanded: false
      }
      if (expandBag.hasOwnProperty(subscription.target.path)){
        subscription.target.toggled = expandBag[subscription.target.path].toggled;
      }
      rawSubscription.keys.forEach(key => {
        if (typeof key === "symbol")
          subscription.keys.push(key.toString());
        else
          subscription.keys.push(key);
      });
      if (rawSubscription.target == null){
        if (subscription.target.contentType === 'undefined')
          subscription.target.content = "undefined";
        else
          subscription.target.content = "null";
        subscription.target.hasChildren = false;
      }
      else{
        subscription.target.content = this.parseContent(rawSubscription.target, subscription.target.contentType);
        subscription.target.hasChildren = subscription.target.contentType === 'object' ? Object.keys(rawSubscription.target).length > 0 : (subscription.target.contentType === 'array' ? rawSubscription.target.length > 0 : false);
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
    let component = this.getComponentNode(path);
    if(!component){
      path = "App";
      component = this.root;
    }
    const elements = this.getDOMElementsOfComponent(component);
    this.highlightElements(elements, component.component.constructor.name);
  };
  // Recursively fills the components tree as a parsed version
  fillTree(appNode, treeNode, inspectedPath){
    let children = [];
    for (const [key, appChild] of Object.entries(appNode.children)){
      let child = {
        name: appChild.component.constructor.name,
        key: key,
        depth: treeNode.depth + 1,
        display: true,
        toggled: true,
        selected: false,
        highlighted: false
      };
      child.path = treeNode.path + "\/" + child.key;
      if (child.path === inspectedPath){
        child.selected = true;
      }
      else if (child.path.includes(inspectedPath)){
        child.highlighted = true;
      }
      child.children = this.fillTree(appChild, child, inspectedPath);
      children.push(child);
    }
    return children;
  };
  // Edit a reactive state property with the provided value of the given component (path) and the subscription path
  editObject(componentPath, objectPath, value, objectType){
    const componentNode = this.getComponentNode(componentPath);
    let pathArray;
    if(objectType === "subscription"){
      let index, newPath;
      objectPath = objectPath.replace("subscription/", "");
      if(objectPath.includes('/')){
        index = Number(objectPath.substring(0, objectPath.indexOf('/')));
        newPath = objectPath.substring(objectPath.indexOf("/") + 1);
      }
      else {
        return;
      }
      pathArray = newPath.split('/');
      const target = owl.reactive(componentNode.subscriptions[index].target);
      pathArray.reduce((acc, curr, idx, arr) => {
        if (idx === arr.length - 1) {
          acc[curr] = value;
        }
        return acc[curr];
      }, target);
    }
    else{
      const index = objectPath.lastIndexOf('/');
      const key = objectPath.substring(index + 1);
      const path = objectPath.substring(0, index);
      const obj = this.getObject(componentNode.component, path);
      if(!obj) 
        return;
      obj[key] = value;
      if(objectType === 'props' || objectType === 'instance')
        componentNode.render(true);
      else if (objectType === 'env')
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
    const componentNode = this.getComponentNode(componentPath);
    let index = 1;
    while(window["temp" + index] !== undefined)
      index++;
    switch(objectType){
      case "component":
        window["temp" + index] = componentNode;
        break;
      case "props":
        window["temp" + index] = componentNode.component.props;
        break;
      case "env":
        window["temp" + index] = componentNode.component.env;
        break;
      case "instance":
        window["temp" + index] = componentNode.component;
        break;
      case "subscription":
        window["temp" + index] = componentNode.subscriptions;
        break;
    }
    console.log("temp" + index + " = ", window["temp" + index]);
  }

  inspectComponentDOM(componentPath){
    const componentNode = this.getComponentNode(componentPath);
    const elements = this.getDOMElementsOfComponent(componentNode);
    inspect(elements[0]);
  }

  inspectComponentSource(componentPath){
    const componentNode = this.getComponentNode(componentPath);
    inspect(componentNode.component.constructor);
  }
}