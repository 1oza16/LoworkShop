let autoSaveTimer = null;
let guardando = false;
let cambiosPendientes = false;
let modifiedHeaderData = false;
let changeRevision = 0;
let headerRevision = 0;
let savedHeaderValues = null;
const AUTO_SAVE_DELAY = 800;

// Actualizar la barra de guardado según el estado
function actualizarBarraGuardado(estado){
    const estadoEl = document.getElementById("saveState");
    const horaEl = document.getElementById("saveTime");

    estadoEl.className = "save-state " + estado;

    switch(estado){
        case "saved":
            estadoEl.textContent = "Guardado";
            horaEl.textContent = obtenerHoraActual();
            break;

        case "saving":
            estadoEl.textContent = "Guardando...";
            break;

        case "pending":
            estadoEl.textContent = "Cambios pendientes";
            break;

        case "error":
            estadoEl.textContent = "Error en guardado";
            break;
    }

} // actualizarBarraGuardado()

function obtenerHoraActual(){
    return new Date().toLocaleTimeString(
        "es-ES",
        {
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit"
        }
    );
} // obtenerHoraActual()

function actualizarNombreHoja(){
    let nombre = window.location.pathname.split('/').pop();
    nombre = decodeURIComponent(nombre.replace(/\.html$/i, ""));

    document.getElementById("saveFileName").textContent = nombre || "Nueva hoja";
} // actualizarNombreHoja()

function marcarComoModificada() {
    cambiosPendientes = true;
    changeRevision++;
    actualizarBarraGuardado("pending");
    clearTimeout(autoSaveTimer);

    autoSaveTimer = setTimeout(() => {
        guardarHoja(false);
    }, AUTO_SAVE_DELAY);
} // marcarComoModificada()

function marcarCabeceraComoModificada() {
    modifiedHeaderData = true;
    headerRevision++;
    marcarComoModificada();
}

function capturarDatosCabecera() {
    return {
        cliente: document.getElementById("cliente")?.value || "",
        marca: document.getElementById("marca")?.value || "",
        modelo: document.getElementById("modelo")?.value || "",
        matricula: document.getElementById("matricula")?.value || "",
        fecha: document.getElementById("fecha")?.value || "",
        kilometraje: document.getElementById("kilometraje")?.value || "",
        unidadKilometraje: document.getElementById("unidadKilometraje")?.value || "km"
    };
}

function restaurarDatosCabecera(values) {
    if (!values) {
        return;
    }
    document.getElementById("cliente").value = values.cliente;
    const brand = document.getElementById("marca");
    brand.value = values.marca;
    brand.dispatchEvent(new Event("change", { bubbles: true }));
    document.getElementById("modelo").value = values.modelo;
    document.getElementById("matricula").value = values.matricula;
    document.getElementById("fecha").value = values.fecha;
    document.getElementById("kilometraje").value = values.kilometraje;
    document.getElementById("unidadKilometraje").value = values.unidadKilometraje;
}

// Guardar hoja 
async function guardarHoja(forzar = true) {
    if (guardando)
        return;

    if (!forzar && !cambiosPendientes)
        return;

    guardando = true;
    actualizarBarraGuardado("saving");
    const savedRevision = changeRevision;
    const savedHeaderRevision = headerRevision;

    try {
        const nombre = decodeURIComponent(
            window.location.pathname.split("/").pop()
        ).replace(/\.html$/i, "");
        const clonHTML = document.documentElement.cloneNode(true);
        const infoGridOriginal = document.querySelector(".info-grid");
        const infoGridClone = clonHTML.querySelector(".info-grid");

        infoGridOriginal?.querySelectorAll("input").forEach(input => {
            infoGridClone.querySelector(`#${input.id}`)
                ?.setAttribute("value", input.value);
        });
        infoGridOriginal?.querySelectorAll("select").forEach(select => {
            const clone = infoGridClone.querySelector(`#${select.id}`);
            clone?.querySelectorAll("option").forEach(option => {
                option.toggleAttribute("selected", option.value === select.value);
            });
        });

        const html = clonHTML.outerHTML;
        const clon = clonHTML.cloneNode(true);

        clon.querySelectorAll(".precio-input, .precio-total-input, .info-value").forEach(input => {
            const span = document.createElement("span");
            span.className = input.className;
            span.textContent = input instanceof HTMLSelectElement
                ? input.selectedOptions[0]?.textContent || ""
                : input.value;
            span.style.cssText = input.style.cssText;
            input.replaceWith(span);
        });

        const htmlPDF = "<!DOCTYPE html>\n" + clon.outerHTML;
        const datosCabecera = modifiedHeaderData
            ? {
                uuid: document.querySelector('meta[name="ficha-uuid"]')?.content,
                clienteUuid: document.getElementById("cliente").value,
                modeloUuid: document.getElementById("modelo").value,
                matricula: document.getElementById("matricula").value.trim(),
                fecha: document.getElementById("fecha").value,
                kilometraje: document.getElementById("kilometraje").value
            }
            : null;
        let resp;
        try {
            resp = await API.saveSheet(nombre, html, htmlPDF, datosCabecera);
        } catch (error) {
            if (!error.conflict) {
                throw error;
            }
            const overwrite = await confirmar(
                "Sobrescribir hoja",
                `La hoja "${error.newName}" ya existe. ¿Deseas reemplazarla?`
            );
            if (!overwrite) {
                restaurarDatosCabecera(savedHeaderValues);
                modifiedHeaderData = false;
                headerRevision++;
                cambiosPendientes = true;
                changeRevision++;
                actualizarBarraGuardado("pending");
                return;
            }
            resp = await API.saveSheet(
                nombre,
                html,
                htmlPDF,
                datosCabecera,
                true
            );
        }

        if (!resp.ok) {
            throw new Error(resp.error);
        }

        if (savedHeaderRevision === headerRevision) {
            modifiedHeaderData = false;
            savedHeaderValues = capturarDatosCabecera();
        }
        if (savedRevision === changeRevision) {
            cambiosPendientes = false;
            actualizarBarraGuardado("saved");
        }
        if (resp.renamed) {
            window.history.replaceState(null, "", resp.newUrl);
            document.getElementById("saveFileName").textContent =
                resp.newName.replace(/\.html$/i, "");
            document.title = resp.title;
        }

    } catch (err) {
        console.error(err);
        actualizarBarraGuardado("error");
    } finally {
        guardando = false;
        if (savedRevision !== changeRevision) {
            clearTimeout(autoSaveTimer);
            autoSaveTimer = setTimeout(() => guardarHoja(false), AUTO_SAVE_DELAY);
        }
    }

} // guardarHoja()

// Eventos de guardado automático y actualización de la barra superior
document.addEventListener("DOMContentLoaded", () => {
    actualizarNombreHoja();
    actualizarBarraGuardado("saved");
    savedHeaderValues = capturarDatosCabecera();
});

document.addEventListener("sheet-header-loaded", () => {
    savedHeaderValues = capturarDatosCabecera();
});

document.addEventListener("input", (e)=>{
    if (e.target.closest(".info-grid") && e.target.matches("input")) {
        if (["cliente", "marca", "modelo", "matricula", "fecha", "kilometraje"]
            .includes(e.target.id)) {
            marcarCabeceraComoModificada();
        } else {
            marcarComoModificada();
        }
    } else if(e.target.closest(".editable-box")) {
        marcarComoModificada();
    }
});

document.addEventListener("change",(e)=>{
    if (e.target.closest(".info-grid")) {
        if (["cliente", "marca", "modelo", "matricula", "fecha", "kilometraje"]
            .includes(e.target.id)) {
            marcarCabeceraComoModificada();
        } else {
            marcarComoModificada();
        }
    } else if (
        e.target.matches("input") ||
        e.target.matches("select") ||
        e.target.matches("textarea")
    ){
        marcarComoModificada();
    }
});