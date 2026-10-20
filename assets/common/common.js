let resolverConfirmacion = null;
let spinner = null;

function getPath() {
    const ruta = window.location.pathname.toLowerCase();
    if (ruta.includes("/stencil/") || ruta.includes("/notas/"))
        return "../";
    return "";
}

// Conversor a Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => { resolve(reader.result.split(',')[1]); };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        }
    );
} // fileToBase64()

//#region Toast

function crearToast(){
    if(document.getElementById("toast"))
        return;
    document.body.insertAdjacentHTML(
        "beforeend",
        `<div id="toast"></div>`
    );
}

function toast(msg, error = false) {
    crearToast();
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'visible' + (error ? ' error' : '');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.className = '', 3000);
} // toast()

//#endregion

//#region Modals

function openModal(modalType) {
    const modal = document.querySelector(`#overlay-${modalType}`);
    if (modal) {
        modal.classList.add('visible');
        
        const textInputs = modal.querySelectorAll('input[type="text"]');
        textInputs.forEach(input => input.value = '');
        
        const fileInputs = modal.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => input.value = '');
        
        if (previewCover) {
            previewCover.innerHTML = '<span>Selecciona una imagen</span>';
        }
    }
} // openModal()

function closeModal(modalType) {
    const modal = document.querySelector(`#overlay-${modalType}`);
    if (modal) {
        modal.classList.remove('visible');
    }
} // closeModal()

// Cerrar modal al presionar .btn-cancel o su overlay
document.addEventListener('click', (e) => {
    const modal = e.target.closest('.modal-overlay');
    if (modal) {
        // Si clickeaste en el overlay (fondo) o en botón cancelar
        if (e.target === modal || e.target.closest('.btn-cancel')) {
            const modalType = modal.id.replace('overlay-', '');
            closeModal(modalType);
        }
    }
});

//#endregion

//#region Panel de confirmacion 

function crearConfirmDialog() {
    if (document.getElementById("confirmOverlay"))
        return;

    const path = getPath();

    document.body.insertAdjacentHTML(
        "beforeend",
        `
<div class="modal-overlay" id="confirmOverlay">
    <div class="modal-box confirm-box">

        <div class="modal-header">
            <div class="marco-icono">
                <img id="confirmIcon" src="${path}img/favicon.ico" class="icon">
            </div>
            <h3 id="confirmTitle">Confirmar acción</h3>
        </div>

        <div class="modal-body">
            <p id="confirmMessage">¿Seguro que deseas continuar?</p>

            <div class="modal-footer">
                <button class="btn-cancel" id="confirmNo">No</button>
                <button class="btn-primary" id="confirmYes">Sí</button>
            </div>
        </div>

    </div>
</div>
`
    );

    inicializarConfirmDialog();

}

function confirmar(titulo, mensaje) {
    crearConfirmDialog();

    return new Promise(resolve => {
        resolverConfirmacion = resolve;
        document.getElementById("confirmTitle").textContent = titulo;
        document.getElementById("confirmMessage").textContent = mensaje;
        document.getElementById("confirmOverlay").classList.add("visible");
    });
} // confirmar()

function cerrarConfirmacion(resultado) {
    document.getElementById("confirmOverlay").classList.remove("visible");

    if (resolverConfirmacion) {
        resolverConfirmacion?.(resultado);
        resolverConfirmacion = null;
    }
}

// Inicializacion de eventos del panel de confirmacion
function inicializarConfirmDialog() {
    document.getElementById("confirmYes").addEventListener("click",()=>{
        cerrarConfirmacion(true);
    });

    document.getElementById("confirmNo").addEventListener("click",()=>{
        cerrarConfirmacion(false);
    });

    document.getElementById("confirmOverlay").addEventListener("click",(e)=>{
        if (e.target.id === "confirmOverlay")
            cerrarConfirmacion(false);
    });
}

//#endregion

//#region Spinner de carga

function createSpinner(inMainContent = false) {
    if (spinner)
        return spinner;

    const path = getPath();

    spinner = document.createElement("div");
    spinner.className = "spinner-overlay";
    if (inMainContent)
        spinner.classList.add("main-content");
    spinner.innerHTML = `
        <div class="spinner-box">
            <img src="${path}img/favicon.ico" alt="Cargando">
        </div>
    `;

    return spinner;
}

function openSpinner(inMainContent = false) {
    if (document.querySelector(".spinner-overlay"))
        return;

    const contenedor = inMainContent
        ? document.getElementById("mainContent")
        : null;

    const destino = contenedor || document.body;

    destino.appendChild(createSpinner(Boolean(contenedor)));
}

function closeSpinner() {
    spinner?.remove();
    spinner = null;
}

//#endregion

//#region Dropdown Menu

function iniciateDropdowns() {
    document.addEventListener("click", (e) => {
        const btnOptions = e.target.closest(".btn-options");
        
        // Cerrar todos los dropdowns excepto el actual
        document.querySelectorAll(".dropdown-menu").forEach(menu => {
            const container = menu.closest(".dropdown-menu-container");
            const btn = container ? container.querySelector(".btn-options") : null;
            if (!btn || !btn.contains(e.target)) {
                menu.classList.remove("visible");
                if (container) container.classList.remove("active");
            }
        });

        // Abrir/cerrar el dropdown del botón clickeado
        if (btnOptions) {
            const container = btnOptions.closest(".dropdown-menu-container");
            const menu = container.querySelector(".dropdown-menu");

            const isVisible = menu.classList.toggle("visible");
            container.classList.toggle("active", isVisible);

            if (isVisible) {
                // Resetear max-height y overflow previos para medición correcta
                menu.style.maxHeight = "";
                menu.style.overflowY = "";

                const buttonRect = btnOptions.getBoundingClientRect();
                const menuHeight = menu.offsetHeight;
                const menuWidth = menu.offsetWidth;
                const viewportHeight = window.innerHeight;
                const viewportWidth = window.innerWidth;

                // Posicionamiento vertical inteligente (auto-flip hacia arriba si no hay espacio abajo)
                const spaceBelow = viewportHeight - buttonRect.bottom;
                const spaceAbove = buttonRect.top;

                if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                    let topPos = buttonRect.top - menuHeight - 4;
                    if (topPos < 10) {
                        topPos = 10;
                        menu.style.maxHeight = `${buttonRect.top - 14}px`;
                        menu.style.overflowY = "auto";
                    }
                    menu.style.top = `${topPos}px`;
                } else {
                    let topPos = buttonRect.bottom + 4;
                    if (topPos + menuHeight > viewportHeight - 10) {
                        menu.style.maxHeight = `${viewportHeight - topPos - 10}px`;
                        menu.style.overflowY = "auto";
                    }
                    menu.style.top = `${topPos}px`;
                }

                // Posicionamiento horizontal inteligente
                let leftPos = buttonRect.right - menuWidth;
                if (leftPos < 10) {
                    leftPos = 10;
                } else if (leftPos + menuWidth > viewportWidth - 10) {
                    leftPos = viewportWidth - menuWidth - 10;
                }
                menu.style.left = `${leftPos}px`;
            }
        }
    });

    // Manejo de acciones del dropdown
    document.addEventListener("click", (e) => {
        const dropdownItem = e.target.closest(".dropdown-item");
        if (dropdownItem) {
            const action = dropdownItem.dataset.action;
            const container = dropdownItem.closest(".dropdown-menu-container");
            const menu = container.querySelector(".dropdown-menu");
            
            // Cerrar dropdown
            menu.classList.remove("visible");
            if (container) container.classList.remove("active");
            
            // Emitir evento personalizado para que otros scripts lo escuchen
            const event = new CustomEvent("dropdownAction", {
                detail: { action, container }
            });
            document.dispatchEvent(event);
        }
    });

    // Cerrar dropdowns al hacer scroll fuera de ellos
    document.addEventListener("scroll", (e) => {
        document.querySelectorAll(".dropdown-menu.visible").forEach(menu => {
            if (!menu.contains(e.target)) {
                menu.classList.remove("visible");
                const container = menu.closest(".dropdown-menu-container");
                if (container) container.classList.remove("active");
            }
        });
    }, { capture: true, passive: true });
}

// Inicializar dropdowns cuando el DOM esté listo
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciateDropdowns);
} else {
    iniciateDropdowns();
}

//#endregion

//#region Album extensions

function getValidImageExtensions() {
    return [".jpg", ".jpeg", ".png", ".webp", ".gif"];
}

function getImageExtensionFromName(name) {
    if (!name || typeof name !== "string") {
        return "";
    }

    const match = name.match(/\.([a-z0-9]+)$/i);
    if (!match) {
        return "";
    }

    const extension = `.${match[1].toLowerCase()}`;
    return getValidImageExtensions().includes(extension) ? extension : "";
}

function getImageExtensionFromUrl(url) {
    if (!url || typeof url !== "string") {
        return "";
    }

    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.([a-z0-9]+)$/i);

        if (!match) {
            return ".jpg";
        }

        const extension = `.${match[1].toLowerCase()}`;
        return getValidImageExtensions().includes(extension) ? extension : "";
    } catch (error) {
        return "";
    }
}

//#endregion

//#region Capitalize

function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
} // capitalize()

//#endregion