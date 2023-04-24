import { loadFile } from "@odoo/owl";

for (const [className, type] of [["xml", "xml"], ["javascript", "js"]]) {
    loadFile(`./counter.${type}`).then(code => {
        const el = document.querySelector(`code.${className}`);
        el.textContent = code;
        hljs.highlightBlock(el);
    })
}
