let rootAlbum = null;
let controllerAlbum = null;

function Album() {

    function mount(root) {
        rootAlbum = root;
        controllerAlbum = new AbortController();

    } // mount()

    function unmount() {
        controllerAlbum?.abort();

        controllerAlbum = null;
        rootAlbum = null;
    } // unmount()

    return {
        mount,
        unmount
    };

} // Album()