function fillChildren(app_node, tree_node){
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
        Object.keys(app_child.props).forEach((prop) => {
            try {
                JSON.stringify(app_child.props[prop]);
                child.properties[prop] = app_child.props[prop];
            }
            catch (e) {}
        });
        child.path = tree_node.path + "\/" + child.name + child.key;
        child.children = fillChildren(app_child, child);
        children.push(child);
    }
    return children;
};
function sendTree(){ 
    let [application] = owl.App.apps; 
    let tree = {};
    tree.root = {
        name: "App",
        properties: {},
        path: "App",
        key: "",
        depth: 0,
        display: true,
        toggled: true,
        selected: false,
        highlighted: false
    };
    let root = application.root;
    console.log(root);
    tree.root.children = fillChildren(root, tree.root);
    return tree;
};
sendTree();