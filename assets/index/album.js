let rootAlbum = null;
let controllerAlbum = null;
let indexCars = null;
let indexCovers = null;
let actualBrand = null;
let actualModel = null;
let coverReturnState = null;
let renameTarget = null;
let imageModalContext = {
    type: null,
    brand: null,
    model: null
};
let historyAlbum = [ { brand: null, model: null } ]; 
let historyPosition = 0; 

let indicator = null;
let urlInp = null;
let previewCover = null;

function Album() {

    function mount(root) {
        rootAlbum = root;
        controllerAlbum = new AbortController();

        indicator = root.querySelector(".indicator");
        urlInp = rootAlbum.querySelector("#image-url");
        previewCover = rootAlbum.querySelector("#image-preview");
        const backArrowBtn = root.querySelector("#back");
        const forwardArrowBtn = root.querySelector("#forward");
        const homeBtn = root.querySelector("#home");

        const fileInp = rootAlbum.querySelector("#image-file");
        const localBtn = rootAlbum.querySelector("#image-local-btn");
        const modalImageBtn = root.querySelector("#image-save-btn");
        const modalRenameBtn = root.querySelector("#rename-btn");
        const newItemBtn = root.querySelector("#new-item");
        const createItemBtn = root.querySelector("#create-item-btn");

        modalRenameBtn.addEventListener(
            "click",
            renameAlbumItem,
            { signal: controllerAlbum.signal }
        );

        backArrowBtn.addEventListener(
            "click",
            back,
            { signal: controllerAlbum.signal }
        );

        forwardArrowBtn.addEventListener(
            "click",
            forward,
            { signal: controllerAlbum.signal }
        );

        homeBtn.addEventListener(
            "click",
            renderBrands,
            { signal: controllerAlbum.signal }
        );

        urlInp.addEventListener(
            'input',
            previewUrl,
            { signal: controllerAlbum.signal }
        );

        fileInp.addEventListener(
            'change',
            previewFile,
            { signal: controllerAlbum.signal }
        );

        localBtn.addEventListener(
            'click',
            openSelectorFile,
            { signal: controllerAlbum.signal }
        );

        modalImageBtn.addEventListener(
            "click",
            () => {
                if (imageModalContext.type === "cover") {
                    saveCover(imageModalContext);
                    return;
                }

                savePhoto(imageModalContext);
            },
            { signal: controllerAlbum.signal }
        );

        window.addEventListener(
            "mouseup",
            manageMouseButton,
            { signal: controllerAlbum.signal }
        );

        API.subscribe(
            "album",
            reloadCurrentAlbumView,
            controllerAlbum.signal
        );

        newItemBtn.addEventListener(
            "click",
            () => {
                const context = getCreateContext();

                if (context.modalType === "image") {
                    openImageModal("photo", {
                        brand: context.brand,
                        model: context.model
                    });
                    return;
                }

                openModal("new-folder");
            },
            { signal: controllerAlbum.signal }
        );

        createItemBtn.addEventListener(
            "click",
            createFolder,
            { signal: controllerAlbum.signal }
        );

        document.addEventListener(
            "dropdownAction",
            (event) => {
                const { action, container } = event.detail;

                const card = container?.closest(".card");
                const currentName = card?.querySelector(".card-nombre")?.textContent?.trim() || "";

                if (action === "cover") {
                    coverReturnState = {
                        brand: actualBrand,
                        model: actualModel
                    };

                    actualBrand = card?.dataset.marca ?? null;
                    actualModel = card?.dataset.modelo ?? null;
                    openImageModal("cover", {
                        brand: actualBrand,
                        model: actualModel
                    });
                }

                if (action === "rename") {
                    renameTarget = getRenameTarget(card, currentName);
                    openModal(action);

                    const actualNameInp = rootAlbum.querySelector("#actual-name");
                    actualNameInp.value = renameTarget.oldName;

                    const newNameInp = rootAlbum.querySelector("#new-name");
                    newNameInp.value = "";
                    newNameInp.focus();
                }

                if(action === "eliminate-cover") {
                    eliminateCover(
                        card?.dataset.marca ?? null,
                        card?.dataset.modelo ?? null,
                        currentName
                    );
                }

                if(action === "eliminate-image") {
                    eliminateImage(
                        card?.dataset.imageId ?? null,
                        currentName
                    );
                }

                if (action === "eliminate-folder") {
                    eliminateFolder(card, currentName);
                }
            },
            { signal: controllerAlbum.signal }
        );

        loadAlbum();
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

function manageMouseButton(e) {
    if (e.button === 3) {
        back();
    }

    if (e.button === 4) {
        forward();
    }
}

//#region Render

async function loadAlbum() {

    try {
        await loadAlbumIndexes();
        renderBrands();
    } catch (error) {
        console.error("Error cargando datos del álbum:", error);
    }
} // loadAlbum()

async function loadAlbumIndexes() {
    const [cars, covers] = await Promise.all([
        API.getIndexCars(),
        API.getIndexCovers()
    ]);

    indexCars = cars;
    indexCovers = covers;
}

async function reloadCurrentAlbumView() {
    const root = rootAlbum;
    const brand = actualBrand;
    const model = actualModel;

    try {
        await loadAlbumIndexes();
        if (rootAlbum !== root) {
            return;
        }

        if (brand && indexCars?.[brand]) {
            if (model && indexCars[brand][model]) {
                renderImages(brand, model, false);
            } else {
                renderModels(brand, false);
            }
            return;
        }

        renderBrands();
    } catch (error) {
        console.error("Error actualizando el álbum:", error);
    }
}

function getCreateContext() {
    if (!actualBrand && !actualModel) {
        return { action: "brand", modalType: "new-folder" };
    }

    if (actualBrand && !actualModel) {
        return { action: "model", modalType: "new-folder", brand: actualBrand };
    }

    return { action: "photo", modalType: "image", brand: actualBrand, model: actualModel };
}

function updateCreateButton() {
    if (!rootAlbum) {
        return;
    }

    const button = rootAlbum.querySelector("#new-item");
    const context = getCreateContext();
    const labels = {
        brand: "Nueva marca",
        model: "Nuevo modelo",
        photo: "Nueva foto"
    };

    if (!button) {
        return;
    }

    const label = button.querySelector("span");
    if (label) {
        label.textContent = labels[context.action] || "Nuevo";
    }
}

function renderBrands() {
    actualBrand = null;
    actualModel = null;
    updateBreadcrumbs();
    const grid = rootAlbum.querySelector("#grid");

    grid.innerHTML = "";

    if (!indexCars || Object.keys(indexCars).length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay marcas disponibles.
            </div>
        `;
        updateCreateButton();
        return;
    }

    Object.keys(indexCars).forEach(brand => {

        const card = document.createElement("div");

        card.className = "card";
        card.dataset.marca = brand;

        card.innerHTML = `
            <div class="card-imagen">
                <img src="" alt="${brand}" class="card-imagen-img">
            </div>
            <div class="card-info">
                <div class="card-nombre">${capitalize(brand)}</div>
                <div class="dropdown-menu-container">
                    <button class="btn-options" type="button">
                        <img src="img/icons/options.png" alt="Options" class="icon">
                    </button>
                    <div class="dropdown-menu">
                        <span class="dropdown-title">Opciones de carpeta</span>
                        <button class="dropdown-item" data-action="rename">
                            <span>Renombrar</span>
                        </button>
                        <button class="dropdown-item" data-action="cover">
                            <span>Agregar portada</span>
                        </button>
                        <button class="dropdown-item" data-action="eliminate-cover">
                            <span>Eliminar portada</span>
                        </button>
                        <button class="dropdown-item" data-action="eliminate-folder">
                            <span>Eliminar carpeta</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const image = card.querySelector(".card-imagen-img");
        const cover = indexCovers?.[brand]?.portada;
        
        if (cover) {
            image.src = cover;
        } else {
            image.src = "img/icons/folder.png";
        }

        card.addEventListener(
            "click",
            (e) => {
                if (e.target.closest(".dropdown-menu-container")) {
                    return;
                }

                renderModels(brand);
            },
            { signal: controllerAlbum.signal }
        );

        grid.appendChild(card);
    });

    updateCreateButton();
}

function renderModels(brand, guardarHistorial = true) {
    actualBrand = brand;
    actualModel = null;
    updateBreadcrumbs(brand);

    if (guardarHistorial) {
        saveStateHistory(brand, null);
    }

    const models = indexCars?.[brand];
    const grid = rootAlbum.querySelector("#grid");

    if (!models || models.length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay modelos disponibles de la marca ${capitalize(brand)}.
            </div>
        `;
        updateCreateButton();
        return;
    }

    grid.innerHTML = "";

    Object.keys(models).forEach(model => {
        const card = document.createElement("div");

        card.className = "card";
        card.dataset.marca = brand;
        card.dataset.modelo = model;

        card.innerHTML = `
            <div class="card-imagen">
                <img src="" alt="${model}" class="card-imagen-img">
            </div>
            <div class="card-info">
                <div class="card-nombre">${capitalize(model)}</div>
                <div class="dropdown-menu-container">
                    <button class="btn-options" type="button">
                        <img src="img/icons/options.png" alt="Options" class="icon">
                    </button>
                    <div class="dropdown-menu">
                        <span class="dropdown-title">Opciones de carpeta</span>
                        <button class="dropdown-item" data-action="rename">
                            <span>Renombrar</span>
                        </button>
                        <button class="dropdown-item" data-action="cover">
                            <span>Agregar portada</span>
                        </button>
                        <button class="dropdown-item" data-action="eliminate-cover">
                            <span>Eliminar portada</span>
                        </button>
                        <button class="dropdown-item" data-action="eliminate-folder">
                            <span>Eliminar carpeta</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        const image = card.querySelector(".card-imagen-img");
        const conver = indexCovers?.[brand]?.modelos?.[model];

        if (conver) {
            image.src = conver;
        } else {
            image.src = "img/icons/folder.png";
        }

        card.addEventListener(
            "click",
            (e) => {
                if (e.target.closest(".dropdown-menu-container")) {
                    return;
                }

                renderImages(brand, model);
            },
            { signal: controllerAlbum.signal }
        );

        grid.appendChild(card);
    });

    updateCreateButton();
}

function renderImages(brand, model, guardarHistorial = true) {
    actualBrand = brand;
    actualModel = model;
    updateBreadcrumbs(brand, model);

    if (guardarHistorial) {
        saveStateHistory(brand, model);
    }

    const images = indexCars?.[brand]?.[model];
    const grid = rootAlbum.querySelector("#grid");

    if (!images || Object.keys(images).length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay imagenes disponibles del modelo ${capitalize(model)}.
            </div>
        `;
        updateCreateButton();
        return;
    }

    grid.innerHTML = "";

    images.forEach(image => {

        const card = document.createElement("div");

        card.className = "card";
        card.dataset.imageId = image.id;

        card.innerHTML = `

            <div class="card-imagen">
                <img src="${API.getImage(image.id)}" alt="${image.nombre}" class="card-imagen-img">
            </div>
            <div class="card-info">
                <div class="card-nombre">${image.nombre}</div>
                <div class="dropdown-menu-container">
                    <button class="btn-options" type="button">
                        <img src="img/icons/options.png" alt="Options" class="icon">
                    </button>
                    <div class="dropdown-menu">
                        <span class="dropdown-title">Opciones de imagen</span>
                        <button class="dropdown-item" data-action="rename">
                            <span>Renombrar</span>
                        </button>
                        <button class="dropdown-item" data-action="eliminate-image">
                            <span>Eiminar imagen</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    updateCreateButton();
}
//#endregion

//#region Folder

async function createFolder() {
    const nameInput = rootAlbum.querySelector("#new-folder-name");
    const name = nameInput.value.trim();
    const context = getCreateContext();
    const type = context.action === "model" ? "model" : "brand";
    const brand = context.brand || null;
    const model = context.model || null;

    if (!name) {
        toast("El nombre de la carpeta no puede estar vacío.", true);
        nameInput.focus();
        return;
    }

    try {
        try {
            await API.createAlbumFolder(type, brand, name);
        } catch (error) {
            if (!error.conflict) {
                throw error;
            }

            const overwrite = await confirmar(
                "SOBREESCRIBIR CARPETA",
                `La carpeta "${name}" ya existe. Si continúas, se eliminarán sus fotos, subcarpetas y portadas. ¿Deseas reemplazarla?`
            );

            if (!overwrite) {
                nameInput.focus();
                return;
            }

            await API.createAlbumFolder(type, brand, name, true);
        }

        [indexCars, indexCovers] = await Promise.all([
            API.getIndexCars(),
            API.getIndexCovers()
        ]);

        if (type === "model") {
            renderModels(brand, false);
        } else if (brand) {
            renderModels(brand, false);
        } else {
            renderBrands();
        }

        closeModal("new-folder");
        toast(`Carpeta ${name} creada correctamente.`);
    } catch (error) {
        console.error("Error creando carpeta:", error);
        toast(error.message || "No se pudo crear la carpeta.", true);
    }
}

async function eliminateFolder(card, folderName) {
    const type = card?.dataset.modelo ? "model" : "brand";
    const brand = card?.dataset.marca ?? null;
    const model = card?.dataset.modelo ?? null;
    const currentBrand = actualBrand;

    if (!brand) {
        toast("No se pudo identificar la carpeta que se va a eliminar.", true);
        return;
    }

    const contents = type === "brand"
        ? "Se eliminará la marca, modelos fotos, y portada."
        : "Se eliminará el modelo, sus fotos y portada.";

    const confirmed = await confirmar(
        "ELIMINAR CARPETA",
        `¿Deseas eliminar "${folderName}"? ${contents}`
    );

    if (!confirmed) {
        return;
    }

    try {
        await API.eliminateAlbumFolder(type, brand, model);

        [indexCars, indexCovers] = await Promise.all([
            API.getIndexCars(),
            API.getIndexCovers()
        ]);

        if (currentBrand) {
            renderModels(currentBrand, false);
        } else {
            renderBrands();
        }

        toast(`Carpeta ${folderName} eliminada correctamente.`);
    } catch (error) {
        console.error("Error eliminando carpeta:", error);
        toast(error.message || "No se pudo eliminar la carpeta.", true);
    }
}

//#endregion

//#region Covers

async function prepareImagePayload() {
    const url = urlInp.value.trim();
    const file = rootAlbum.querySelector("#image-file").files[0];

    if (url) {
        const extension = getImageExtensionFromUrl(url);
        if (!extension) {
            throw new Error("La URL no tiene una extensión válida.");
        }

        return {
            source: "url",
            value: url,
            extension
        };
    }

    if (file) {
        const extension = getImageExtensionFromName(file.name);
        if (!extension) {
            throw new Error("El archivo debe tener una extensión válida (.jpg, .jpeg, .png, .webp o .gif).");
        }

        return {
            source: "base64",
            value: await fileToBase64(file),
            extension,
            contentType: file.type || ""
        };
    }

    throw new Error("Selecciona una imagen o introduce una URL válida.");
}

async function saveCover(context = imageModalContext) {
    const brand = context?.brand ?? actualBrand;
    const model = context?.model ?? actualModel;
    const tipo = model === null || model === undefined ? "marca" : "modelo";

    try {
        const imagen = await prepareImagePayload();

        if (!brand) {
            throw new Error("No se ha podido identificar la marca de la portada.");
        }

        await API.saveCover(tipo, brand, model || "", {
            origen: imagen.source,
            valor: imagen.value,
            extension: imagen.extension,
            content_type: imagen.contentType || ""
        });

        indexCovers = await API.getIndexCovers();

        const state = coverReturnState;
        coverReturnState = null;

        if (!state?.brand) {
            renderBrands();
        } else if (state.model === null) {
            renderModels(state.brand, false);
        } else {
            renderImages(state.brand, state.model, false);
        }

        closeModal("image");
        toast(`Nueva portada de ${tipo} guardada.`);
    } catch (error) {
        console.error("Error guardando portada:", error);
        toast(error.message || "No se ha podido guardar la portada", true);
    }
}

async function savePhoto(context = imageModalContext) {
    const brand = context?.brand ?? actualBrand;
    const model = context?.model ?? actualModel;
    const nameInput = rootAlbum.querySelector("#image-name");
    const baseName = (nameInput?.value || "").trim();

    if (!baseName) {
        toast("El nombre de la imagen es obligatorio.", true);
        nameInput?.focus();
        return;
    }

    if (!brand || !model) {
        toast("No se pudo identificar el modelo donde guardar la foto.", true);
        return;
    }

    try {
        const image = await prepareImagePayload();
        const payloadName = baseName.replace(/\.[^.]+$/, "");
        const imagePayload = {
            origen: image.source,
            valor: image.value,
            extension: image.extension
        };

        try {
            await API.savePhoto(brand, model, payloadName, imagePayload, false);
        } catch (error) {
            if (!error.conflict) {
                throw error;
            }

            const overwrite = await confirmar(
                "SOBREESCRIBIR IMAGEN",
                `La imagen "${payloadName}${image.extension}" ya existe. ¿Deseas reemplazarla?`
            );

            if (!overwrite) {
                nameInput.focus();
                return;
            }

            await API.savePhoto(brand, model, payloadName, imagePayload, true);
        }

        [indexCars, indexCovers] = await Promise.all([
            API.getIndexCars(),
            API.getIndexCovers()
        ]);

        renderImages(brand, model, false);
        closeModal("image");
        toast("Foto guardada correctamente.");
    } catch (error) {
        console.error("Error guardando foto:", error);
        toast(error.message || "No se pudo guardar la foto.", true);
    }
}

async function eliminateCover(brand, model, currentName) {
    const state = {
        brand: actualBrand,
        model: actualModel
    };

    let confirm = await confirmar(`BORRAR PORTADA`, `¿Estas seguro que deseas borrar la portada de ${currentName}?`);

    if(!confirm) {
        return;
    }

    const type = model === null ? "marca" : "modelo";

    
    try {
        await API.eliminateCover(type, brand, model || "");
        indexCovers = await API.getIndexCovers();

        if (!state.brand) {
            renderBrands();
        } else if (state.model === null) {
            renderModels(state.brand, false);
        } else {
            renderImages(state.brand, state.model, false);
        }

        toast("Portada eliminada correctamente");
    } catch (error) {
        console.error("Error eliminando portada:", error);
        toast("No se ha podido eliminar la portada", true);
    }
}

async function eliminateImage(imageId, imageName) {
    const state = {
        brand: actualBrand,
        model: actualModel
    };

    const confirm = await confirmar("ELIMINAR IMAGEN", `¿Deseas eliminar la imagen "${imageName}"?`);

    if (!confirm)
        return;

    try {
        if (!imageId || !state.brand || !state.model) {
            throw new Error("No se pudo identificar la imagen que se va a eliminar.");
        }

        await API.eliminateImage(imageId);
        indexCars = await API.getIndexCars();
        renderImages(state.brand, state.model, false);

        toast("Imagen eliminada correctamente.");

    } catch (error) {
        console.error(error);
        toast("No se pudo eliminar la imagen.", true);
    }
}

//#endregion

//#region Rename

async function renameAlbumItem() {
    const newNameInp = rootAlbum.querySelector("#new-name");
    const newName = newNameInp.value.trim();

    if (!newName) {
        toast("El nuevo nombre no puede estar vacío.", true);
        newNameInp.focus();
        return;
    }

    if (!renameTarget) {
        toast("No se pudo identificar el elemento que se va a renombrar.", true);
        return;
    }

    try {
        const renamed = await sendRename(renameTarget, newName);
        
        if (!renamed) {
            newNameInp.focus();
            return;
        }

        [indexCars, indexCovers] = await Promise.all([
            API.getIndexCars(),
            API.getIndexCovers()
        ]);

        updateRenameHistory(renameTarget, renamed.newName);

        if (renameTarget.type === "brand") {
            renderBrands();
        } else if (renameTarget.type === "model") {
            renderModels(renameTarget.brand, false);
        } else {
            renderImages(renameTarget.brand, renameTarget.model, false);
        }

        renameTarget = null;
        closeModal("rename");
        toast("Elemento renombrado correctamente.");
    } catch (error) {
        console.error("Error renombrando elemento:", error);
        toast(error.message || "No se pudo renombrar el elemento.", true);
    }
}

function getRenameTarget(card, oldName) {
    const type = card.dataset.imageId
        ? "image"
        : card.dataset.modelo ? "model" : "brand";

    return {
        type,
        brand: card.dataset.marca || actualBrand,
        model: card.dataset.modelo || actualModel,
        imageId: card.dataset.imageId || null,
        oldName
    };
}

async function sendRename(target, newName) {
    try {
        return await API.renameAlbumItem(
            target.type, target.brand, target.model, target.imageId, newName
        );
    } catch (error) {
        if (!error.conflict) {
            throw error;
        }

        const overwrite = await confirmar(
            "SOBREESCRIBIR ELEMENTO",
            `Ya existe un elemento llamado "${newName}". ¿Deseas reemplazarlo?`
        );

        if (!overwrite) {
            return null;
        }

        return API.renameAlbumItem(
            target.type, target.brand, target.model, target.imageId, newName, true
        );
    }
}

function updateRenameHistory(target, newName) {
    historyAlbum.forEach(entry => {
        if (target.type === "brand" && entry.brand === target.brand) {
            entry.brand = newName;
        }

        if (
            target.type === "model"
            && entry.brand === target.brand
            && entry.model === target.model
        ) {
            entry.model = newName;
        }
    });
}

//#endregion

//#region Navegation

function back() {
    if (historyPosition <= 0) {
        return;
    }

    historyPosition--;

    const estado = historyAlbum[historyPosition];

    actualBrand = estado.brand;
    actualModel = estado.model;

    if (estado.brand === null) {
        renderBrands();
    }
    else if (estado.model === null) {
        renderModels(estado.brand, false);
    } else {
        renderImages(estado.brand, estado.model, false);
    }
}

function forward() {
    if (historyPosition >= historyAlbum.length - 1) {
        return;
    }

    historyPosition++;

    const state = historyAlbum[historyPosition];

    actualBrand = state.brand;
    actualModel = state.model;

    if (state.brand === null) {
        renderBrands();
    }
    else if (state.model === null) {
        renderModels(state.brand, false);
    } else {
        renderImages(state.brand, state.model, false);
    }
}

// Pendiente de usar
function backToBrands() {
    actualBrand = null;
    actualModel = null;
    historyAlbum = [];
    historyPosition = -1;

    renderBrands();
}

function saveStateHistory(brand, model) {
    const state = {
        brand,
        model
    };

    historyAlbum = historyAlbum.slice(0, historyPosition + 1);

    historyAlbum.push(state);
    historyPosition++;
} // saveStateHistory()

function updateBreadcrumbs(brand = null, model = null) {
    if (!indicator) return;

    if (!brand) {
        indicator.innerHTML = `<span class="breadcrumb-item active">Inicio</span>`;
        return;
    }

    if (!model) {
        indicator.innerHTML = `
            <a class="breadcrumb-item link" data-nav="home">Inicio</a>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">${capitalize(brand)}</span>
        `;
    } else {
        indicator.innerHTML = `
            <a class="breadcrumb-item link" data-nav="home">Inicio</a>
            <span class="breadcrumb-separator">/</span>
            <a class="breadcrumb-item link" data-nav="brand">${capitalize(brand)}</a>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item active">${capitalize(model)}</span>
        `;
    }

    const homeLink = indicator.querySelector('[data-nav="home"]');
    if (homeLink) {
        homeLink.addEventListener(
            "click",
            (e) => {
                e.preventDefault();
                renderBrands();
            },
            { signal: controllerAlbum?.signal }
        );
    }

    const brandLink = indicator.querySelector('[data-nav="brand"]');
    if (brandLink) {
        brandLink.addEventListener(
            "click",
            (e) => {
                e.preventDefault();
                renderModels(brand);
            },
            { signal: controllerAlbum?.signal }
        );
    }
}

//#endregion

//#region Modals

function previewUrl() {
    const url = urlInp.value.trim();

    if (!url) {
        previewCover.innerHTML = '<span>Selecciona una imagen</span>';
        return;
    }

    const validExtension = getImageExtensionFromUrl(url);
    previewCover.innerHTML = validExtension
        ? `<img src="${url}" alt="">`
        : '<span>La URL no tiene una extensión válida.</span>';
} // previewUrl()

function previewFile(event) {
    const file = event.target.files[0];

    if (!file) {
        previewCover.innerHTML = '<span>Selecciona una imagen</span>';
        return;
    }

    if (!getImageExtensionFromName(file.name)) {
        toast("El archivo debe tener una extensión válida (.jpg, .jpeg, .png, .webp o .gif)", true);
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        previewCover.innerHTML = `<img src="${e.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);

    urlInp.value = ``;
} // previewFile()

function openSelectorFile() {
    rootAlbum.querySelector("#image-file").click();
} // openSelectorFile()

function openImageModal(type, options = {}) {
    imageModalContext = {
        type,
        brand: options.brand ?? actualBrand ?? null,
        model: options.model ?? actualModel ?? null
    };

    const modal = rootAlbum.querySelector("#overlay-image");
    const title = rootAlbum.querySelector("#image-modal-title");
    const nameGroup = rootAlbum.querySelector("#image-name-group");
    const nameInput = rootAlbum.querySelector("#image-name");
    const saveBtn = rootAlbum.querySelector("#image-save-btn");

    if (!modal || !title || !nameGroup || !nameInput || !saveBtn) {
        return;
    }

    urlInp.value = "";
    rootAlbum.querySelector("#image-file").value = "";
    nameInput.value = "";
    previewCover.innerHTML = '<span>Selecciona una imagen</span>';

    if (type === "cover") {
        title.textContent = "PORTADA DE CARPETA";
        nameGroup.style.display = "none";
        saveBtn.textContent = "Usar portada";
    } else {
        title.textContent = "NUEVA FOTO";
        nameGroup.style.display = "block";
        saveBtn.textContent = "Guardar foto";
    }

    modal.classList.add("visible");
    if (type === "photo") {
        nameInput.focus();
    } else {
        urlInp.focus();
    }
}

//#endregion
