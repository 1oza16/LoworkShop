let rootSettings = null;
let controllerSettigs = null;

function Settings() {

    function mount(root) {
        rootSettings = root;
        controllerSettigs = new AbortController();

    } // mount()

    function unmount() {
        controllerSettigs?.abort();

        controllerSettigs = null;
        rootSettings = null;
    } // unmount()

    return {
        mount,
        unmount
    };

} // Settings()