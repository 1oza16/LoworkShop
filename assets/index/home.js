let rootHome = null;
let controllerHome = null;
let sheets = [];
let client = null;
let brand = null;
let plate = null;
let model = null;
let mileage = null;
let mileageUnit = null;
let date = null;
let previewNameSheet = null;
let sheetClients = [];
let sheetBrands = [];
let sheetModels = [];
let editingSheet = null;

//#region Mount - Unmount

function Home() {

    function mount(root) {
        rootHome = root;
        controllerHome = new AbortController();
        API.subscribe(
            "sheets",
            () => loadSheets(),
            controllerHome.signal
        );

        client = rootHome.querySelector("#inp-cliente");
        brand = rootHome.querySelector("#inp-marca");
        plate = rootHome.querySelector("#inp-matricula");
        model = rootHome.querySelector("#inp-modelo");
        mileage = rootHome.querySelector("#inp-kilometraje");
        mileageUnit = rootHome.querySelector("#unidadKilometraje");
        date = rootHome.querySelector("#inp-fecha");
        previewNameSheet = rootHome.querySelector("#preview-nombre");

        // Cálculo de fecha actual para insertar dinámicamente en date 
        if (!date.value) {
            const today = new Date();
                
            date.value = [
                today.getFullYear(),
                String(today.getMonth() + 1).padStart(2, "0"),
                String(today.getDate()).padStart(2, "0")
            ].join("-");
        }

        const tracker = root.querySelector("#buscador");
        const reloadBtn = root.querySelector("#btn-recargar");
        const openModalBtn = root.querySelector("#btn-abrir-modal");
        // const closeModalBtn = root.querySelector("#btn-cerrar-modal");
        // const overlay = root.querySelector("#overlay-");
        const createSheetBtn = root.querySelector("#btn-crear-hoja"); 
        const clientInp = client; 
        const brandInp = brand;
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
            () => openModal("new-sheet"),
            { signal: controllerHome.signal }
        );

        createSheetBtn.addEventListener(
            "click",
            createSheet,
            { signal: controllerHome.signal }
        );

        clientInp.addEventListener(
            "change",
            updatePreview,
            { signal: controllerHome.signal }
        );

        brandInp.addEventListener(
            "change",
            event => {
                updateHomeModelOptions(event.currentTarget.value);
                updatePreview();
            },
            { signal: controllerHome.signal }
        );

        plateInp.addEventListener(
            "input",
            updatePreview,
            { signal: controllerHome.signal }
        );

        modelInp.addEventListener(
            "change",
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

        loadSheetOptions();
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
    const edit = e.target.closest('[data-action="edit"]');
    if (edit) {
        const card = edit.closest("[data-sheet-name]");
        if (card) {
            editSheetMetadata(card.dataset.sheetName);
        }
        return;
    }

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

function updatePreview() {
    const clientInp = client.selectedOptions[0]?.textContent.trim() || "";
    const plateInp = plate.value.trim();
    const modelInp = model.selectedOptions[0]?.textContent.trim() || "";
    const dateInp = date.value.trim();

    const name = client.value && model.value
        ? generateName(clientInp, plateInp, modelInp, dateInp)
        : "";

    previewNameSheet.textContent = name ? `Nombre del archivo: ${name}.html` : '';
} // updatePreview()

async function loadSheetOptions() {
    const root = rootHome;

    try {
        const [clientsResponse, brandsResponse, modelsResponse] = await Promise.all([
            API.getDatabaseRecords("clientes"),
            API.getDatabaseRecords("marcas"),
            API.getDatabaseRecords("modelos")
        ]);
        if (rootHome !== root) {
            return;
        }

        sheetClients = clientsResponse.records;
        sheetBrands = brandsResponse.records;
        sheetModels = modelsResponse.records;
        setSheetSelectOptions(client, sheetClients, "uuid", "nombre", "cliente");
        setSheetSelectOptions(brand, sheetBrands, "uuid", "nombre", "marca");
    } catch (error) {
        if (rootHome !== root) {
            return;
        }
        console.error("Error cargando opciones de la hoja:", error);
        toast("No se pudieron cargar clientes, marcas y modelos.", true);
    }
}

async function editSheetMetadata(name) {
    try {
        const [clientsResponse, brandsResponse, modelsResponse, fichasResponse] =
            await Promise.all([
                API.getDatabaseRecords("clientes"),
                API.getDatabaseRecords("marcas"),
                API.getDatabaseRecords("modelos"),
                API.getDatabaseRecords("fichas")
            ]);
        const ficha = fichasResponse.records.find(
            record => record.nombre_ficha === name
        );
        if (!ficha) {
            throw new Error("No se encontraron los datos de esta ficha.");
        }

        sheetClients = clientsResponse.records;
        sheetBrands = brandsResponse.records;
        sheetModels = modelsResponse.records;
        const modal = getSheetMetadataModal();
        const form = modal.querySelector("form");
        form.dataset.sheetName = name;
        form.dataset.uuid = ficha.uuid;
        editingSheet = {
            clienteUuid: ficha.cliente_uuid,
            modeloUuid: ficha.modelo_uuid,
            matricula: ficha.matricula || "",
            kilometraje: ficha.kilometraje ?? "",
            fecha: ficha.fecha || ""
        };

        openModal("sheet-metadata");
        setSheetSelectOptions(
            modal.querySelector("#edit-sheet-client"),
            sheetClients,
            "uuid",
            "nombre",
            "cliente"
        );
        setSheetSelectOptions(
            modal.querySelector("#edit-sheet-brand"),
            sheetBrands,
            "uuid",
            "nombre",
            "marca"
        );
        modal.querySelector("#edit-sheet-client").value = ficha.cliente_uuid;
        const selectedModel = sheetModels.find(
            record => record.uuid === ficha.modelo_uuid
        );
        const selectedBrand = selectedModel?.marca_uuid || "";
        modal.querySelector("#edit-sheet-brand").value = selectedBrand;
        updateMetadataModelOptions(selectedBrand, ficha.modelo_uuid);
        modal.querySelector("#edit-sheet-plate").value = editingSheet.matricula;
        modal.querySelector("#edit-sheet-mileage").value = editingSheet.kilometraje;
        modal.querySelector("#edit-sheet-date").value = editingSheet.fecha;
    } catch (error) {
        console.error("Error cargando datos de la ficha:", error);
        toast(error.message || "No se pudieron cargar los datos de la ficha.", true);
    }
}

function getSheetMetadataModal() {
    let modal = document.getElementById("overlay-sheet-metadata");
    if (modal) {
        return modal;
    }

    document.body.insertAdjacentHTML("beforeend", `
        <div class="modal-overlay" id="overlay-sheet-metadata">
            <div class="modal-box">
                <div class="modal-header">
                    <div class="marco-icono">
                        <img src="img/favicon.ico" alt="isologo" width="30px">
                    </div>

                    <h3>CAMBIAR DATOS DE LA HOJA</h3>
                </div>
                <div class="modal-body">
                    <form id="sheet-metadata-form">
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-client">Cliente</label>
                            <select class="campo-input" id="edit-sheet-client" required></select>
                        </div>
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-brand">Marca</label>
                            <select class="campo-input" id="edit-sheet-brand" required></select>
                        </div>
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-model">Modelo</label>
                            <select class="campo-input" id="edit-sheet-model" required></select>
                        </div>
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-plate">Matrícula</label>
                            <input class="campo-input" id="edit-sheet-plate" type="text" required>
                        </div>
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-mileage">Kilometraje</label>
                            <input class="campo-input" id="edit-sheet-mileage" type="number" min="0" step="1">
                        </div>
                        <div class="campo-grupo">
                            <label class="campo-label" for="edit-sheet-date">Fecha</label>
                            <input class="campo-input" id="edit-sheet-date" type="date" required>
                        </div>
                        <div class="modal-footer">
                            <button class="btn-cancel" type="button">Cancelar</button>
                            <button class="btn-primary" type="submit">Guardar cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `);
    modal = document.getElementById("overlay-sheet-metadata");
    modal.querySelector("#edit-sheet-brand").addEventListener("change", event => {
        updateMetadataModelOptions(event.currentTarget.value);
    });
    modal.querySelector("form").addEventListener("submit", saveSheetMetadata);
    return modal;
}

function updateMetadataModelOptions(brandUuid, selectedModelUuid = "") {
    const modelSelect = document.querySelector("#edit-sheet-model");
    setSheetModelOptions(
        modelSelect,
        sheetModels,
        brandUuid,
        selectedModelUuid
    );
}

async function saveSheetMetadata(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const headerData = {
        uuid: form.dataset.uuid,
        clienteUuid: form.querySelector("#edit-sheet-client").value,
        modeloUuid: form.querySelector("#edit-sheet-model").value,
        matricula: form.querySelector("#edit-sheet-plate").value.trim(),
        kilometraje: form.querySelector("#edit-sheet-mileage").value,
        fecha: form.querySelector("#edit-sheet-date").value
    };

    if (!form.reportValidity()) {
        return;
    }

    submitButton.disabled = true;
    try {
        const response = await updateSheetMetadataWithConfirmation(
            form.dataset.sheetName,
            headerData,
            () => restoreMetadataForm(form)
        );
        if (!response) {
            closeModal("sheet-metadata");
            return;
        }

        closeModal("sheet-metadata");
        await loadSheets();
        toast(`Hoja actualizada: ${response.newName}`);
    } catch (error) {
        console.error("Error actualizando datos de la hoja:", error);
        toast(error.message || "No se pudieron actualizar los datos.", true);
    } finally {
        submitButton.disabled = false;
    }
}

function restoreMetadataForm(form) {
    if (!editingSheet) {
        return;
    }
    form.querySelector("#edit-sheet-client").value = editingSheet.clienteUuid;
    const model = sheetModels.find(
        record => record.uuid === editingSheet.modeloUuid
    );
    const brandUuid = model?.marca_uuid || "";
    form.querySelector("#edit-sheet-brand").value = brandUuid;
    updateMetadataModelOptions(brandUuid, editingSheet.modeloUuid);
    form.querySelector("#edit-sheet-plate").value = editingSheet.matricula;
    form.querySelector("#edit-sheet-mileage").value = editingSheet.kilometraje;
    form.querySelector("#edit-sheet-date").value = editingSheet.fecha;
}

function updateHomeModelOptions(brandUuid) {
    setSheetModelOptions(model, sheetModels, brandUuid);
}

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
    const clientUuid = client.value;
    const clientValue = client.selectedOptions[0]?.textContent.trim() || "";
    const modelUuid = model.value;
    const modelValue = model.selectedOptions[0]?.textContent.trim() || "";
    const plateValue = plate.value.trim();
    const mileageValue = mileage.value.trim();
    const mileageNumber = mileageValue ? Number(mileageValue) : null;
    const mileageUnitValue = mileageUnit.value;
    const dateValue = date.value.trim();

    if (!clientUuid || !modelUuid || !plateValue || !dateValue) {
        toast("Completa todos los campos.", true);
        return;
    }
    if (mileageNumber !== null
        && (!Number.isSafeInteger(mileageNumber) || mileageNumber < 0)) {
        toast("El kilometraje no es válido.", true);
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
        const resp = await API.createSheet({
            clientUuid,
            modelUuid,
            client: clientValue,
            model: modelValue,
            plate: plateValue,
            mileage: mileageNumber,
            mileageUnit: mileageUnitValue,
            date: dateValue
        });
        toast(`Hoja "${nameSheet}" creada.`);

        closeModal("new-sheet");
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
        }

        if (rootHome || rootSheets) {
            filterSheets();
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
        item.dataset.sheetName = sheet.nombre;

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

        const image = item.querySelector(".hoja-imagen-contenido");
        image.alt = "Imagen del vehículo";

        if (sheet.imageId) {
            image.src = API.getImage(sheet.imageId);
        }

        image.addEventListener("error", () => {
            image.onerror = null;
            image.src = "img/icons/camara.png";
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
