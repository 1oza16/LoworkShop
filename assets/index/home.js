let rootHome = null;
let controllerHome = null;
let sheets = [];

let client = null;
let plate = null;
let model = null;
let date = null;
let preview = null;

//#region Mount - Unmount

function Home() {

    function mount(root) {
        rootHome = root;
        controllerHome = new AbortController();

        client = rootHome.querySelector("#inp-cliente");
        plate = rootHome.querySelector("#inp-matricula");
        model = rootHome.querySelector("#inp-modelo");
        date = rootHome.querySelector("#inp-fecha");
        preview = rootHome.querySelector("#preview-nombre");

        // Cálculo de fecha actual para insertar dinámicamente en date 
        if (!date.value) {
            const today = new Date();
                
            date.value = [
                today.getFullYear(),
                String(today.getMonth() + 1).padStart(2, "0"),
                String(today.getDate()).padStart(2, "0")
            ].join("-");
        }

        // Canal para indicar cambio de foto en hoja de reparacion y cargarla 
        if ("BroadcastChannel" in window) {
            const sheetsChannel = new BroadcastChannel("loworkshop-sheets");

            sheetsChannel.addEventListener(
                "message",
                event => {
                    if (event.data?.type === "sheet-saved") {
                        loadSheets();
                    }
                },
                { signal: controllerHome.signal }
            );
        
            controllerHome.signal.addEventListener(
                "abort",
                () => sheetsChannel.close(),
                { once: true }
            );
        }

        const tracker = root.querySelector("#buscador");
        const reloadBtn = root.querySelector("#btn-recargar");
        const openModalBtn = root.querySelector("#btn-abrir-modal");
        const closeModalBtn = root.querySelector("#btn-cerrar-modal");
        const overlay = root.querySelector("#overlay");
        const createSheetBtn = root.querySelector("#btn-crear-hoja"); 
        const clientInp = client; 
        const plateInp = plate; 
        const modelInp = model; 
        const dateInp = date; 
        const sheetsSectionHeader = root.querySelector("#sheets"); 
        const statisticsSectionHeader = root.querySelector("#summary"); 
        
        rootHome.addEventListener(
            "click",
            manageClick,
            { signal: controllerHome.signal }
        );

        tracker.addEventListener(
            "input",
            filterSheets,
            { signal: controllerHome.signal }
        );

        reloadBtn.addEventListener(
            "click",
            reloadSheets,
            { signal: controllerHome.signal }
        );

        openModalBtn.addEventListener(
            "click",
            openModal,
            { signal: controllerHome.signal }
        );

        closeModalBtn.addEventListener(
            "click",
            closeModal,
            { signal: controllerHome.signal }
        );

        overlay.addEventListener(
            "click",
            closeModalOut,
            { signal: controllerHome.signal }
        );

        createSheetBtn.addEventListener(
            "click",
            createSheet,
            { signal: controllerHome.signal }
        );

        clientInp.addEventListener(
            "input",
            updatePreview,
            { signal: controllerHome.signal }
        );

        plateInp.addEventListener(
            "input",
            updatePreview,
            { signal: controllerHome.signal }
        );

        modelInp.addEventListener(
            "input",
            updatePreview,
            { signal: controllerHome.signal }
        );

        dateInp.addEventListener(
            "input",
            updatePreview,
            { signal: controllerHome.signal }
        );

        sheetsSectionHeader.addEventListener(
            "click",
            () => changeView("sheets"),
            { signal: controllerHome.signal }
        );

        statisticsSectionHeader.addEventListener(
            "click",
            () => changeView("statistics"),
            { signal: controllerHome.signal }
        );

        loadSheets();
    } // mount()


    function unmount() {
        controllerHome?.abort();

        controllerHome = null;
        rootHome = null;
    } // unmount()

    return {
        mount,
        unmount
    };

} // Home()

function manageClick(e) {
    const open = e.target.closest("[data-open-sheet]");

    if (open) {
        openSheet(open.dataset.openSheet);
        return;
    }

    const eliminate = e.target.closest("[data-eliminate-sheet]");

    if (eliminate) {
        eliminateSheet(eliminate.dataset.eliminateSheet);
    }
}

//#endregion

//#region Modal

function openModal() {
    client.value = '';
    plate.value = '';
    model.value = '';
    preview.textContent = '';
    rootHome.querySelector("#overlay").classList.add('visible');

    setTimeout(() => rootHome.querySelector("#inp-cliente").focus(), 80);
} // openModal()

function closeModal() { 
    rootHome.querySelector("#overlay").classList.remove('visible'); 
} // closeModal()

function closeModalOut(e) { 
    if (e.target.id === 'overlay') 
        closeModal(); 
} // closeModalOut()

function updatePreview() {
    const clientInp = client.value.trim();
    const plateInp = plate.value.trim();
    const modelInp = model.value.trim();
    const dateInp = date.value.trim();

    const name = generateName(clientInp, plateInp, modelInp, dateInp);

    preview.textContent = name ? `Nombre del archivo: ${name}.html` : '';
} // updatePreview()

function generateName(client, plate, model, date) {
    const changeFormat = value => value
        .trim()
        .replace(/[<>:"/\\|?*]/g, '')
        .toUpperCase();

    const clientData = changeFormat(client);
    const plateData = changeFormat(plate);
    const modelData = changeFormat(model);

    if (!clientData || !plateData || !modelData || !date)
        return '';

    // Equivalente a %Y-%m-%d_%H-%M-%S del backend.
    const fechaObj = new Date(`${date}T00:00:00`);
    const fechaStr = [
        fechaObj.getFullYear(),
        String(fechaObj.getMonth() + 1).padStart(2, '0'),
        String(fechaObj.getDate()).padStart(2, '0')
    ].join('-');

    return `${clientData}_${plateData}_${modelData}_${fechaStr}`;
} // generateName()

//#endregion

//#region Sheets

async function createSheet() {
    const clientValue = client.value.trim();
    const plateValue = plate.value.trim();
    const modelValue = model.value.trim();
    const dateValue = date.value.trim();

    if (!clientValue || !plateValue || !modelValue || !dateValue) {
        toast("Completa todos los campos.", true);
        return;
    }

    const nameSheet = generateName(clientValue, plateValue, modelValue, dateValue);
    const exists = sheets.some(
        sheet => sheet.nombre === `${nameSheet}.html`
    );

    if (exists) {
        const confirm = await confirmar(`Sobreescribir hoja`, `La hoja "${nameSheet}" ya existe. ¿Deseas sobrescribirla?`);

        if (!confirm)
            return;
    }

    try {
        openSpinner();
        const resp = await API.createSheet(clientValue, plateValue, modelValue, dateValue);
        console.log("Hoja creada:", resp);
        toast(`Hoja "${nameSheet}" creada.`);

        closeModal();
        await loadSheets();
        openSheet(resp.nombre);
    } catch (error) {
        console.error("Error creando hoja:", error);
        toast(`No se pudo crear la hoja. "${nameSheet}"`);
    }
    finally {
        closeSpinner();
    }
} // createSheet()

async function openSheet(name) {
    try {
        const data = await API.loadSheet(name);
        window.open(data.url, "_blank");
    } catch (error) {
        console.error("Error abriendo hoja:", error);
        toast(`No se pudo abrir la hoja "${name}"`, true);
    }
} // openSheet()

async function eliminateSheet(name) {
    const confirm = await confirmar(`Eliminar hoja`, `¿Seguro que quieres eliminar la hoja "${name}"?`);

    if (!confirm)
        return;

    try {
        await API.eliminateSheet(name);
        await loadSheets();
        toast(`Hoja "${name}" eliminada correctamente`);
    } catch (error) {
        console.error("Error eliminando hoja:", error);
        toast(`No se pudo eliminar la hoja "${name}"`, true);
    }
} // eliminateSheet()

async function loadSheets() {
    try {
        const data = await API.listSheets();
        sheets = data.hojas;

        if (rootHome) {
            reloadStatistics(data.estadisticas);
            renderSheetsHome(sheets);
            return;
        }

        if (rootSheets) {
            renderSheets(sheets);
        }
    } catch (error) {
        console.error("Error cargando hojas:", error);

        const root = rootHome || rootSheets;
        const list = root?.querySelector("#lista-hojas");
            
        if (list) {
            list.innerHTML = `
                <div class="estado-vacio">
                    No se pudieron cargar las hojas.
                </div>
            `;
        }
    }
} // loadSheets()

function reloadStatistics(statistics) {
    const total = rootHome.querySelector("#stat-total");
    const month = rootHome.querySelector("#stat-mes");
    const lastSheet = rootHome.querySelector("#stat-ultima");

    total.textContent = statistics.total;
    month.textContent = statistics.modificadasEsteMes;

    if (statistics.ultimaModificacion) {
        const fecha = new Date(statistics.ultimaModificacion);

        lastSheet.textContent = fecha.toLocaleDateString(
            "es-ES",
            {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            }
        );
    } else {
        lastSheet.textContent = "—";
    }
} // reloadStatistics()

function renderSheetsHome(sheets) {
    const list = rootHome.querySelector("#lista-hojas");

    list.innerHTML = "";

    if (!sheets || sheets.length === 0) {
        list.innerHTML = `
            <div class="estado-vacio">
                No hay hojas creadas.
            </div>
        `;
        return;
    }

    sheets.forEach(sheet => {

        const item = document.createElement("div");

        item.className = "hoja-item";

        item.innerHTML = `
            <div class="hoja-imagen">
                <img src="" alt="" class="hoja-imagen-contenido">
            </div>

            <div class="hoja-contenido">
                <div class="hoja-info">
                    <div class="hoja-nombre">${sheet.nombre}</div>
                    <div class="hoja-meta">Modificado: ${formatDate(sheet.fecha)}</div>
                </div>

                <div class="hoja-acciones">
                    <button class="btn-hoja" type="button" data-open-sheet="${sheet.nombre}">↗ Abrir</button>
                    <button class="btn-hoja eliminar" type="button" data-eliminate-sheet="${sheet.nombre}">✕ Eliminar</button>
                </div>
            </div>
        `;

        const image = item.querySelector(".hoja-imagen-contenido");
        image.alt = "Imagen del vehículo";

        if (sheet.imageId) {
            image.src = API.getImage(sheet.imageId);
        }

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "img/icons/without-photo.png";
        });

        list.appendChild(item);
    });
} // renderSheets()

function filterSheets() {
    const root = rootHome || rootSheets;
    const tracker = root?.querySelector("#buscador");
    const query = tracker.value.toLowerCase().trim();

    const filteredSheets = sheets.filter(sheet =>
        sheet.nombre.toLowerCase().includes(query)
    );

    if (rootHome) {
        renderSheetsHome(filteredSheets);
    }

    if (rootSheets) {
        renderSheets(filteredSheets);
    }
} // filterSheets()

async function reloadSheets() {
    await loadSheets();
    toast('Lista actualizada');
} // reloadSheets()

//#endregion

function formatDate(date) {
    if (!date)
        return "—";

    const fechaObj = new Date(date);

    return fechaObj.toLocaleString(
        "es-ES",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
} // formatDate()

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    // if (e.key === 'Enter' && document.getElementById('overlay').classList.contains('visible')) crearHoja();
});

// ----------------------------------------------------------

// NUEVA ESTRUCTURA Home.js:

// home.js
// │
// ├── mount(root)
// │     ├── preparar eventos
// │     └── loadSheets()
// │
// ├── unmount()
// │
// ├── loadSheets()
// │     └── API.listarHojas()
// │
// ├── renderizarHojas()
// │
// ├── filtrarHojas()
// │
// ├── crearHoja()
// │     └── API.crearHoja()
// │
// ├── eliminarHoja()
// │     └── API.eliminarHoja()
// │
// ├── abrirHoja()
// │     └── API.retornarHoja()
// │
// └── actualizarPreview()

// formatearFecha()
