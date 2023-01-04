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
function owlDevtools__ParseProperty(prop, type){
  let result = "";
  if (type === 'array'){
    result += "[";
    let first = true;
    for (const value of prop){
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
    for (const [key, value] of Object.entries(prop)) {
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
    result += '"' + prop + '"';
  else 
    result += prop.toString();
  return result;
}
function owlDevtools__GetProperty(props, path){
  let property = props;
  let path_array = path.split('/');
  for (let i = 0; i < path_array.length; i++) {
    if (path_array[i].startsWith('[') && path_array[i].endsWith(']')){
      let index = Number(path_array[i].substring(1, path_array[i].length-1));
      property = property[index];
    }
    else if (property.hasOwnProperty(path_array[i]))
      property = property[path_array[i]];
    else
      return null;
  }
  return property;
};
function owlDevtools__LoadPropsChildren(component_path, props_path, depth, type){
  let [application] = owl.App.apps; 
  let root = application.root;
  let children = [];
  depth = depth + 1;
  let component = owlDevtools__GetComponent(component_path, root);
  let property = owlDevtools__GetProperty(component.props, props_path);
  console.log(property);
  if (type === 'array'){
    property.forEach((element, index) => {
      let child = {
        name: index, 
        propertyType: typeof element === 'object' ? (Array.isArray(element) ? 'array' : 'object') : typeof element,
        depth: depth,
        toggled: false,
        display: true,
        path: props_path + "\/[" + index + "]"
      };
      if (element == null){
        if (child.propertyType === 'undefined')
          child.property = "undefined";
        else
          child.property = "null";
          child.hasChildren = false;
      }
      else{
        child.property = owlDevtools__ParseProperty(element, child.propertyType);
        child.hasChildren = child.propertyType === 'object' ? Object.keys(element).length > 0 : (child.propertyType === 'array' ? element.length > 0 : false);
      }
      child.children = [];
      children.push(child);
    });
  }
  else if (type === 'object'){
    Object.keys(property).forEach(key => {
      let child = {
        name: key, 
        propertyType: typeof property[key] === 'object' ? (Array.isArray(property[key]) ? 'array' : 'object') : typeof property[key],
        depth: depth,
        toggled: false,
        display: true,
        path: props_path + "\/" + key
      };
      if (property[key] == null){
        if (child.propertyType === 'undefined')
          child.property = "undefined";
        else
          child.property = "null";
          child.hasChildren = false;
      }
      else{
        child.property = owlDevtools__ParseProperty(property[key], child.propertyType);
        child.hasChildren = child.propertyType === 'object' ? Object.keys(property[key]).length > 0 : (child.propertyType === 'array' ? property[key].length > 0 : false);
      }
      child.children = [];
      children.push(child);
    });
  }
  return children;
};
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
function owlDevtools__SendComponentDetails(path){ 
  let [application] = owl.App.apps; 
  let root = application.root;
  let component = {};
  if(!path){
    path = owlDevtools__GetInspectedPath(root);
  }
  component.path = path;
  let node = owlDevtools__GetComponent(path, root);
  if(!node)
    return null;
  let filteredProperties = node.props;
  component.properties = {};
  component.name = node.component.constructor.name;
  Object.keys(filteredProperties).forEach(key => {
    let property = {
      name: key, 
      propertyType: typeof filteredProperties[key] === 'object' ? (Array.isArray(filteredProperties[key]) ? 'array' : 'object') : typeof filteredProperties[key],
      depth: 0,
      path: key,
      toggled: false,
      display: true
    };
    if (filteredProperties[key] == null){
      if (property.propertyType === 'undefined')
        property.property = "undefined";
      else
        property.property = "null";
      property.hasChildren = false;
    }
    else{
      property.property = owlDevtools__ParseProperty(filteredProperties[key], property.propertyType);
      property.hasChildren = property.propertyType === 'object' ? Object.keys(filteredProperties[key]).length > 0 : (property.propertyType === 'array' ? filteredProperties[key].length > 0 : false);
    }
    property.children = [];
    component.properties[key] = property;
  });
  return component;
};
function owlDevtools__HighlightComponent(path){
  let [application] = owl.App.apps; 
  let root = application.root;
  // root node (App) is special since it only has a parentEl as attached element
  if(path === "App"){
    owlDevtools__HighlightElement(root.bdom.parentEl, "App");
  }
  else {
    let component = owlDevtools__GetComponent(path, root);
    owlDevtools__HighlightElement(component.bdom.el, component.component.constructor.name);
  }
};
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
function owlDevtools__SearchElement(node, path, element){
  if (node.bdom.el && node.bdom.el.isEqualNode(element)){
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
function owlDevtools__SendTree(inspectedPath){ 
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
    if(!inspectedPath === "App")
      tree.root.selected = true;
  }
  tree.root.children = owlDevtools__FillTree(root, tree.root, inspectedPath);
  return tree;
};

