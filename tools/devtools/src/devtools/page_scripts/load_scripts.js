// Ensure the scripts are loaded only once per page
if(!window.owlDevtoolsScriptsLoaded){
  // Draws a highlighting rectangle on the specified html element and displays the specified name and its dimension in a box
  function owlDevtools__HighlightElement(element, name) {
    owlDevtools__RemoveHighlights();
  
    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    const top = rect.top + scrollTop;
    const left = rect.left + scrollLeft;
    const width = rect.width;
    const height = rect.height;
    
    const marginTop = parseInt(getComputedStyle(element).marginTop);
    const marginRight = parseInt(getComputedStyle(element).marginRight);
    const marginBottom = parseInt(getComputedStyle(element).marginBottom);
    const marginLeft = parseInt(getComputedStyle(element).marginLeft);
    
    const highlight = document.createElement('div');
    highlight.className = 'owl-devtools-highlight';
    highlight.style.top = `${top}px`;
    highlight.style.left = `${left}px`;
    highlight.style.width = `${width}px`;
    highlight.style.height = `${height}px`;
    highlight.style.position = 'absolute';
    highlight.style.backgroundColor = 'rgba(63, 134, 228, 0.4)'
    highlight.style.zIndex = '1000';
    highlight.style.pointerEvents = 'none';
    const highlightMargins = document.createElement('div');
    highlightMargins.className = 'owl-devtools-highlight';
    highlightMargins.style.top = `${top - marginTop}px`;
    highlightMargins.style.left = `${left - marginLeft}px`;
    highlightMargins.style.width = `${width + marginLeft + marginRight}px`;
    highlightMargins.style.height = `${height + marginBottom + marginTop}px`;
    highlightMargins.style.position = 'absolute';
    highlightMargins.style.backgroundColor = 'rgba(241, 219, 147, 0.4)'
    highlightMargins.style.zIndex = '1000';
    highlightMargins.style.pointerEvents = 'none';
    
    document.body.appendChild(highlightMargins);
    document.body.appendChild(highlight);
    
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
    let detailsBoxTop = top + height + 5;
    let detailsBoxLeft = left;
    if (detailsBoxTop + detailsBoxRect.height > viewportHeight) {
      detailsBoxTop = top - detailsBoxRect.height - 5;
      if (detailsBoxTop < 0) {
        detailsBoxTop = top;
      }
    }
    if (detailsBoxLeft + detailsBoxRect.width > viewportWidth) {
      detailsBoxLeft = left - detailsBoxRect.width - 5;
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
  // function owlDevtools__DeepCopyAndRemoveCircular(obj) {
  //   const seenObjects = new WeakSet();
  //   const copy = JSON.parse(JSON.stringify(obj, function(key, value) {
  //     if (typeof value === 'object' && value !== null) {
  //       if (seenObjects.has(value)) {
  //         return;
  //       }
  //       seenObjects.add(value);
  //     }
  //     return value;
  //   }));
  //   return copy;
  // };
  // Returns a shortened version of the property as a string
  function owlDevtools__ParseContent(obj, type){
    let result = "";
    if (type === 'array'){
      result += "[";
      let first = true;
      for (const value of obj){
        if (!first)
          result += ", ";
        else{
          first = false;
        }
        if (result.length > 30)
          break;
        if (typeof value === 'array'){
          result += "Array("+value.length+")";
        }
        else if (typeof value === 'object'){
          if (value == null)
            result += "null";
          else
            result += "{...}";
        }
        else if (typeof value === 'undefined'){
          result += "undefined";
        }
        else
          result += value.toString();
      }
      result += "]";
    }
    else if (type === 'object'){
      result += "{";
      let first = true;
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
        if (typeof value === 'array'){
          result += "Array("+value.length+")";
        }
        else if (typeof value === 'object'){
          if (value == null)
            result += "null";
          else
            result += "{...}";
        }
        else if (typeof value === 'undefined'){
          result += "undefined";
        }
        else
          result += value.toString();
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
    for (let i = 0; i < path_array.length; i++) {
      try {
        obj = obj[path_array[i]];
      } catch (error) {
        return null;
      }
    }
    return obj;
  };
  // Returns a parsed version of the children properties of the specified component's property given its path. 
  function owlDevtools__LoadObjectChildren(component_path, obj_path, depth, type, obj_type, expandBag){
    if (typeof expandBag === 'string'){
      expandBag = JSON.parse(expandBag);
    }
    let [application] = owl.App.apps; 
    let root = application.root;
    let children = [];
    depth = depth + 1;
    let component = owlDevtools__GetComponent(component_path, root);
    let obj;
    if (obj_type === 'props')
      obj = owlDevtools__GetObject(component.props, obj_path);
    else if (obj_type === 'subscription') {
      let index, new_path;
      if(obj_path.includes('/')){
        index = obj_path.substring(0, obj_path.indexOf('/'));
        new_path = obj_path.substring(obj_path.indexOf("/") + 1);
      }
      else {
        index = obj_path;
        new_path = "";
      }
      let top_parent = component.subscriptions[index].target;
      obj = owlDevtools__GetObject(top_parent, new_path);
    }
    if (type === 'array'){
      obj.forEach((element, index) => {
        let child = {
          name: index, 
          contentType: typeof element === 'object' ? (Array.isArray(element) ? 'array' : 'object') : typeof element,
          depth: depth,
          toggled: false,
          display: true,
          path: obj_path + "\/" + index,
          objectType: obj_type
        };
        if (expandBag.hasOwnProperty(child.path)){
          child.toggled = expandBag[child.path].toggled;
          child.display = expandBag[child.path].display;
        }
        if (element == null){
          if (child.contentType === 'undefined')
          child.content = "undefined";
          else
          child.content = "null";
          child.hasChildren = false;
        }
        else{
          child.content = owlDevtools__ParseContent(element, child.contentType);
          child.hasChildren = child.contentType === 'object' ? Object.keys(element).length > 0 : (child.contentType === 'array' ? element.length > 0 : false);
        }
        child.children = [];
        if(child.toggled && child.display){
          child.children = owlDevtools__LoadObjectChildren(component_path, child.path, child.depth, child.contentType, obj_type, expandBag);
        }
        children.push(child);
      });
    }
    else if (type === 'object'){
      Object.keys(obj).forEach(key => {
        let child = {
          name: key, 
          contentType: typeof obj[key] === 'object' ? (Array.isArray(obj[key]) ? 'array' : 'object') : typeof obj[key],
          depth: depth,
          toggled: false,
          display: true,
          path: obj_path + "\/" + key,
          objectType: obj_type
        };
        if (expandBag.hasOwnProperty(child.path)){
          child.toggled = expandBag[child.path].toggled;
          child.display = expandBag[child.path].display;
        }
        if (obj[key] == null){
          if (child.contentType === 'undefined')
            child.content = "undefined";
          else
            child.content = "null";
            child.hasChildren = false;
        }
        else{
          child.content = owlDevtools__ParseContent(obj[key], child.contentType);
          child.hasChildren = child.contentType === 'object' ? Object.keys(obj[key]).length > 0 : (child.contentType === 'array' ? obj[key].length > 0 : false);
        }
        child.children = [];
        if(child.toggled && child.display){
          child.children = owlDevtools__LoadObjectChildren(component_path, child.path, child.depth, child.contentType, obj_type, expandBag);
        }
        children.push(child);
      });
    }
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
  // Returns the component's details given its path
  function owlDevtools__SendComponentDetails(path = null, expandBag = "{}"){ 
    let [application] = owl.App.apps; 
    let root = application.root;
    let component = {};
    expandBag = JSON.parse(expandBag);
    if(!path){
      path = owlDevtools__GetInspectedPath(root);
    }
    component.path = path;
    let node = owlDevtools__GetComponent(path, root);
    if(!node)
      node = root;
    let filteredProperties = node.props;
    component.properties = {};
    component.name = node.component.constructor.name;
    Object.keys(filteredProperties).forEach(key => {
      let property = {
        name: key, 
        contentType: typeof filteredProperties[key] === 'object' ? (Array.isArray(filteredProperties[key]) ? 'array' : 'object') : typeof filteredProperties[key],
        depth: 0,
        path: key,
        toggled: false,
        display: true,
        objectType: "props"
      };
      if (expandBag.hasOwnProperty(property.path)){
        property.toggled = expandBag[property.path].toggled;
      }
      if (filteredProperties[key] == null){
        if (property.contentType === 'undefined')
          property.content = "undefined";
        else
          property.content = "null";
        property.hasChildren = false;
      }
      else{
        property.content = owlDevtools__ParseContent(filteredProperties[key], property.contentType);
        property.hasChildren = property.contentType === 'object' ? Object.keys(filteredProperties[key]).length > 0 : (property.contentType === 'array' ? filteredProperties[key].length > 0 : false);
      }
      property.children = [];
      if(property.toggled){
        property.children = owlDevtools__LoadObjectChildren(component.path, property.path, property.depth, property.contentType, property.objectType, expandBag);
      }
      component.properties[key] = property;
    });
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
      if (expandBag.hasOwnProperty(subscription.target.path)){
        subscription.target.toggled = expandBag[subscription.target.path].toggled;
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
    if(component.bdom.hasOwnProperty("el"))
      owlDevtools__HighlightElement(component.bdom.el, component.component.constructor.name);
    else if(component.bdom.hasOwnProperty("parentEl"))
      owlDevtools__HighlightElement(component.bdom.parentEl, component.component.constructor.name);
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
        highlighted: false,
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
  function owlDevtools__EditReactiveState(component_path, subscription_path, value){
    let index, new_path;
    if(subscription_path.includes('/')){
      index = Number(subscription_path.substring(0, subscription_path.indexOf('/')));
      new_path = subscription_path.substring(subscription_path.indexOf("/") + 1);
    }
    else {
      return;
    }
    let path_array = new_path.split('/');
    let [application] = owl.App.apps; 
    let root = application.root;
    let component = owlDevtools__GetComponent(component_path, root);
    let target = owl.reactive(component.subscriptions[index].target);
    path_array.reduce((acc, curr, idx, arr) => {
      if (idx === arr.length - 1) {
        acc[curr] = value;
      }
      return acc[curr];
    }, target);
  };
  // Recursively checks if the given html element corresponds to a component in the components tree.
  // Immediatly returns the path of the first component which matches the element
  function owlDevtools__SearchElement(node, path, element){
    if (node.bdom.el && node.bdom.el.isEqualNode(element)){
      return path;
    }
    else if (node.bdom.parentEl && node.bdom.parentEl.isEqualNode(element)){
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
  function owlDevtools__GetInspectedPath(root){
    let inspectedElement = $0;
    if(inspectedElement){
      let parentsList = [inspectedElement];
      if(inspectedElement.tagName !== 'BODY'){
        while (inspectedElement.parentElement.tagName !== 'BODY'){
          inspectedElement = inspectedElement.parentElement;
          parentsList.push(inspectedElement);
        }
      }
      for (let i = 0; i < parentsList.length; i++) {
        inspectedPath = owlDevtools__SearchElement(root, 'App',parentsList[i]);
        if(inspectedPath)
          return inspectedPath;
      }
    }
    return "App";
  }
  // Returns the tree of components of the inspected page in a parsed format
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
    if(!inspectedPath){
      inspectedPath = owlDevtools__GetInspectedPath(root);
      if(inspectedPath === "App")
        tree.root.selected = true;
    }
    tree.root.children = owlDevtools__FillTree(root, tree.root, inspectedPath);
    return tree;
  };
  // Add a functionnality to the flush function which sends a message to the window every time it is triggered.
  // This message is intercepted by the content script which informs the background script to ask the devtools app tree to be refreshed.
  const originalFlush = [...owl.App.apps][0].scheduler.flush;
  [...owl.App.apps][0].scheduler.flush = function() {
    originalFlush.call(this, ...arguments);
    window.postMessage({type: "Flush"});
  };
  window.owlDevtoolsScriptsLoaded = true;
}


