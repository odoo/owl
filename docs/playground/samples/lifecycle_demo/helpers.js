import { onMounted, onPatched, onWillDestroy, onWillPatch, onWillStart, onWillUnmount } from "@odoo/owl";

export function useLog(name) {
    console.log(`${name}: setup`);
    onWillStart(async () => {
        console.log(`${name}: willStart`)
    });
    onMounted(() => console.log(`${name}: mounted`));
    onWillPatch(() => console.log(`${name}: willPatch`));
    onPatched(() => console.log(`${name}: patched`));
    onWillUnmount(() => console.log(`${name}: willUnmount`));
    onWillDestroy(() => console.log(`${name}: willDestroy`));
}
