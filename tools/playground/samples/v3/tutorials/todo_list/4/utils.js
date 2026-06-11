import { onMounted } from "@odoo/owl";

export function useAutofocus(ref) {
    onMounted(() => {
        ref()?.focus();
    });
}
