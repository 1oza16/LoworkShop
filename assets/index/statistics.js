let rootStatistics = null;
let controllerStatistics = null;

function Statistics() {

    function mount(root) {
        rootStatistics = root;
        controllerStatistics = new AbortController();

    } // mount()

    function unmount() {
        controllerStatistics?.abort();

        controllerStatistics = null;
        rootStatistics = null;
    } // unmount()

    return {
        mount,
        unmount
    };

} // Statistics()