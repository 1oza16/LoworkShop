let autoSaveTimer = null;
let guardando = false;
let cambiosPendientes = false;
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
            estadoEl.textContent = "Error";
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
    actualizarBarraGuardado("pending");
    clearTimeout(autoSaveTimer);

    autoSaveTimer = setTimeout(() => {
        guardarHoja(false);
    }, AUTO_SAVE_DELAY);
} // marcarComoModificada()

// Guardar hoja 
async function guardarHoja(forzar = true) {
    if (guardando)
        return;

    if (!forzar && !cambiosPendientes)
        return;

    guardando = true;
    actualizarBarraGuardado("saving");

    try {
        const ruta = window.location.pathname;
        const html = document.documentElement.cloneNode(true).outerHTML;
        const clon = document.documentElement.cloneNode(true);

        // Reemplazo inputs para guardado correcto al generar PDF (Debido a limitaciones de WeasyPrint)
        clon.querySelectorAll(".precio-input, .precio-total-input, .info-value").forEach(input => {
            const span = document.createElement("span");

            span.className = input.className;
            span.textContent = input.value;

            span.style.cssText = input.style.cssText;
            input.replaceWith(span);
        });

        const htmlPDF = "<!DOCTYPE html>\n" + clon.outerHTML;

        const resp =
            await fetch(
                '/api/guardar-hoja',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type':
                            'application/json'
                    },
                    body: JSON.stringify({
                        ruta,
                        html,
                        htmlPDF
                    })
                }
            );

        const data = await resp.json();

        if (!data.ok) {
            throw new Error(data.error);
        }
        cambiosPendientes = false;
        actualizarBarraGuardado("saved");

    } catch (err) {
        console.error(err);
    } finally {
        guardando = false;
    }

} // guardarHoja()

// Eventos de guardado automático y actualización de la barra superior
document.addEventListener("DOMContentLoaded", () => {
    actualizarNombreHoja();
    actualizarBarraGuardado("saved");
});

document.addEventListener("input", (e)=>{
    if(e.target.closest(".editable-box"))
        marcarComoModificada();
});

document.addEventListener("change",(e)=>{
    if(
        e.target.matches("input") ||
        e.target.matches("select") ||
        e.target.matches("textarea")
    ){
        marcarComoModificada();
    }
});