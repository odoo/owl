/* eslint-disable quotes */
/* eslint-disable prefer-template */
const readStringFromDom = (documentRoot) => {
    let html = '';
    let node = documentRoot.firstChild;
    while (node) {
        switch (node.nodeType) {
            case Node.ELEMENT_NODE:
                html = html + node.outerHTML;
                break;
            case Node.TEXT_NODE:
                html = html + node.nodeValue;
                break;
            case Node.CDATA_SECTION_NODE:
                // html = `${html}"<![CDATA[${node.nodeValue}]]>"`;
                html = html + ("<![CDATA[" + node.nodeValue + "]]>");
                break;
            case Node.COMMENT_NODE:
                // html = `${html}"<!--" ${node.nodeValue} "-->"`;
                html = html + ("<!--" + node.nodeValue + "-->");
                break;
            case Node.DOCUMENT_TYPE_NODE:
                // (X)HTML documents are identified by public identifiers
                html = html + ('<!DOCTYPE ' + node.name + (node.publicId ? " PUBLIC '" + node.publicId + "'" : "") +
                    (!node.publicId && node.systemId ? ' SYSTEM' : '') + (node.systemId ? " '" + node.systemId + "'" : "") + ">\n");
                break;
            default:
                console.error('This is went into default case.');
        }
        node = node.nextSibling;
    }
    return html;
};

chrome.runtime.sendMessage({
    action: 'getSource',
    source: readStringFromDom(document)
});
