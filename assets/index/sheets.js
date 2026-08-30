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

        // Listeners
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
    const grid = rootSheets.querySelector("#lista-hojas");

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
        card.className = "hoja-card";

        card.innerHTML = `
            <div class="hoja-card-imagen">
                <img src="" alt="Imagen del vehículo" class="hoja-card-imagen-img">
            </div>

            <div class="hoja-card-info">
                <div class="hoja-card-nombre">${sheet.nombre}</div>
                <div class="hoja-card-meta">Modificado: ${formatDate(sheet.fecha)}</div>
                <div class="hoja-card-acciones">
                    <button class="btn-hoja" type="button" data-open-sheet="${sheet.nombre}">Abrir</button>
                    <button class="btn-hoja eliminar" type="button" data-eliminate-sheet="${sheet.nombre}">Eliminar</button>
                </div>
            </div>
        `;

        const image = card.querySelector(".hoja-card-imagen-img");

        if (sheet.imageId) {
            image.src = API.getImage(sheet.imageId);
        }

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "img/icons/without-photo.png";
        });

        grid.appendChild(card);
    });
}

// function filterSheets() {
//     const query = rootSheets.querySelector("#buscador-sheets").value.toLowerCase().trim();

//     const filteredSheets = allSheets.filter(sheet =>
//         sheet.nombre.toLowerCase().includes(query)
//     );

//     renderSheets(filteredSheets);
// }

// function formatDate(date) {
//     if (!date) return "—";
    
//     const d = new Date(date);
//     const day = String(d.getDate()).padStart(2, "0");
//     const month = String(d.getMonth() + 1).padStart(2, "0");
//     const year = d.getFullYear();
    
//     return `${day}/${month}/${year}`;
// }

// function manageClick(event) {
//     const openBtn = event.target.closest("[data-open-sheet]");
//     const eliminateBtn = event.target.closest("[data-eliminate-sheet]");

//     if (openBtn) {
//         const sheetName = openBtn.dataset.openSheet;
//         openSheet(sheetName);
//     }

//     if (eliminateBtn) {
//         const sheetName = eliminateBtn.dataset.eliminateSheet;
//         eliminateSheet(sheetName);
//     }
// }

// function openSheet(name) {
//     // Esto debería navegar a la vista de editor de hoja
//     window.location.hash = `#/sheet/${encodeURIComponent(name)}`;
// }

// async function eliminateSheet(name) {
//     const confirmed = confirm(`¿Eliminar la hoja "${name}"?`);

//     if (!confirmed) return;

//     try {
//         await API.eliminateSheet(name);
//         loadSheets();
//     } catch (error) {
//         console.error("Error al eliminar hoja:", error);
//         alert("Error al eliminar la hoja");
//     }
// }