let rootSheets = null;
let controllerSheets = null;

function Sheets() {

    function mount(root) {
        rootSheets = root;
        controllerSheets = new AbortController();

        const tracker = rootSheets.querySelector("#buscador");
        
        // Canal para indicar cambio de hoja guardada
        if ("BroadcastChannel" in window) {
            const sheetsChannel = new BroadcastChannel("loworkshop-sheets");

            sheetsChannel.addEventListener(
                "message",
                event => {
                    if (event.data?.type === "sheet-saved") {
                        loadSheets();
                    }
                },
                { signal: controllerSheets.signal }
            );
        
            controllerSheets.signal.addEventListener(
                "abort",
                () => sheetsChannel.close(),
                { once: true }
            );
        }

        rootSheets.addEventListener(
            "click",
            manageClick,
            { signal: controllerSheets.signal }
        );

        tracker.addEventListener(
            "input",
            filterSheets,
            { signal: controllerSheets.signal }
        );

        // Poner eventos dropdowns
        
        loadSheets();
    } // mount()

    function unmount() {
        controllerSheets?.abort();

        controllerSheets = null;
        rootSheets = null;
    } // unmount()

    return {
        mount,
        unmount
    };

} // Sheets()

function renderSheets(sheets) {
    const grid = rootSheets.querySelector("#grid");

    grid.innerHTML = "";

    if (!sheets || sheets.length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay hojas creadas.
            </div>
        `;
        return;
    }

    sheets.forEach(sheet => {
        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div class="card-imagen">
                <img src="" alt="Imagen del vehículo" class="card-imagen-img">
            </div>

            <div class="card-info">
                <div class="card-nombre">${sheet.nombre}</div>
                <div class="card-meta">Modificado: ${formatDate(sheet.fecha)}</div>
                <div class="card-acciones">
                    <button class="btn-hoja" type="button" data-open-sheet="${sheet.nombre}">Abrir</button>
                    <button class="btn-hoja eliminar" type="button" data-eliminate-sheet="${sheet.nombre}">Eliminar</button>
                    <div class="dropdown-menu-container">
                        <button class="btn-options" type="button">
                            <img src="img/icons/options.png" alt="Options" class="icon">
                        </button>
                        <div class="dropdown-menu">
                            <span class="dropdown-title">Mas opciones</span>
                            <button class="dropdown-item" data-action="edit">
                                <span>Cambiar datos</span>
                            </button>
                            <button class="dropdown-item" data-action="duplicate">
                                <span>Compartir</span>
                            </button>
                            <button class="dropdown-item" data-action="download">
                                <span>Ver PDF</span>
                            </button>
                            <button class="dropdown-item" data-action="download">
                                <span>Imprimir</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const image = card.querySelector(".card-imagen-img");

        if (sheet.imageId) {
            image.src = API.getImage(sheet.imageId);
        }

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "img/icons/camara.png";
        });

        grid.appendChild(card);
    });
}