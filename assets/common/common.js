let resolverConfirmacion = null;
let spinner = null;

function getPath() {
    const ruta = window.location.pathname.toLowerCase();
    if (ruta.includes("/stencil/") || ruta.includes("/notas/"))
        return "../";
    return "";
}

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

