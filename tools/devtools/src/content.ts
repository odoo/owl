console.log("content script loaded.")

function detectOwl() {

    // here's source to get an idea on how to do it:
    // https://stackoverflow.com/questions/48546366/how-to-determine-if-vue-js-is-used-in-a-site-or-web-app
    // https://github.com/vuejs/vue-devtools/blob/24812e5542bb359a06a3e62379fd8c8633ae6034/shells/chrome/src/detector.js#L9

    const all = document.querySelectorAll('*')
    for (let i = 0; i < all.length; i++) {
        if ((all[i] as any).__owl_devtools__) {
            return true;
        }
    }

    return false;

}

const isOwlDetectedOnThePage = detectOwl();

if (isOwlDetectedOnThePage) {
    alert('Owl has been detected on this page.')
}

