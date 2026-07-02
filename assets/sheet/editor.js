let formatoCopiado = null;
let pincelActivo = false;
let tamanoFuenteActual = 14;

// Copiar formato de texto seleccionado
function copiarFormato() {
    const seleccion =window.getSelection();

    if (!seleccion.rangeCount) return;

    let nodo = seleccion.anchorNode;

    if (nodo.nodeType === 3) {
        nodo = nodo.parentElement;
    }

    formatoCopiado = {
        fontWeight: getComputedStyle(nodo).fontWeight,
        fontStyle: getComputedStyle(nodo).fontStyle,
        textDecoration: getComputedStyle(nodo).textDecoration,
        fontSize: getComputedStyle(nodo).fontSize
    };

    document.getElementById('btnCopiarFormato').classList.add('toolbar-active');
} // copiarFormato()

// Aplicar formato copiado al texto seleccionado
function aplicarFormatoCopiado() {
    if (!formatoCopiado) return;

    const seleccion = window.getSelection();

    if (!seleccion.rangeCount) return;

    const range = seleccion.getRangeAt(0);

    if (range.collapsed) return;

    const span = document.createElement('span');

    span.style.fontWeight = formatoCopiado.fontWeight;
    span.style.fontStyle = formatoCopiado.fontStyle;
    span.style.textDecoration = formatoCopiado.textDecoration;
    span.style.fontSize = formatoCopiado.fontSize;

    try {
        range.surroundContents(
            span
        );
    } catch {
        document.execCommand(
            'insertHTML',
            false,
            `<span
                style="
                font-weight:${formatoCopiado.fontWeight};
                font-style:${formatoCopiado.fontStyle};
                text-decoration:${formatoCopiado.textDecoration};
                font-size:${formatoCopiado.fontSize};
                ">
                ${range.toString()}
            </span>`
        );
    }
} // aplicarFormatoCopiado()

// Función que decide si copiar o aplicar formato
function accionCopiarFormato() {
    if (!pincelActivo) {
        copiarFormato();

        pincelActivo = true;
        document.getElementById('btnCopiarFormato').classList.add('toolbar-active');
    } else {
        pincelActivo = false;
        document.getElementById('btnCopiarFormato').classList.remove('toolbar-active');
    }
} // accionCopiarFormato()

// Aplicar formato copiado si el pincel está activo
function aplicarPincelSiActivo() {
    if (!pincelActivo) return;

    const seleccion = window.getSelection();

    if (!seleccion.rangeCount) return;

    const range = seleccion.getRangeAt(0);

    if (range.collapsed) return;

    aplicarFormatoCopiado();
} // aplicarPincelSiActivo()

// Actualizar estado de los botones del toolbar según el estilo del texto seleccionado
function actualizarEstadoToolbar() {
    actualizarBoton('btnBold', 'bold');
    actualizarBoton('btnItalic','italic');
    actualizarBoton('btnUnderline','underline');
    actualizarBoton('btnLista','insertUnorderedList');
    actualizarBoton('btnListaNumerada','insertOrderedList');
} // actualizarEstadoToolbar()

// Actualizar el estado de un botón según el comando de edición
function actualizarBoton(idBoton, comando) {
    const boton = document.getElementById(idBoton);

    if (!boton) return;

    try {
        if (document.queryCommandState(comando)) {
            boton.classList.add('active');
        } else {
            boton.classList.remove('active');
        }
    } catch {}
} // actualizarBoton()

// Cambiar tamaño de fuente del texto seleccionado
function cambiarTamanoSeleccion(delta) {
    const seleccion = window.getSelection();

    if (!seleccion.rangeCount) return;

    const range = seleccion.getRangeAt(0);

    if (range.collapsed) return;

    const nuevoTamano = tamanoFuenteActual + delta;

    const span = document.createElement('span');

    span.style.fontSize = `${nuevoTamano}px`;

    try {
        range.surroundContents(span);
    } catch {
        document.execCommand('insertHTML', false, `<span style="font-size:${nuevoTamano}px">${range.toString()}</span>`);
    }

    tamanoFuenteActual = nuevoTamano;
    actualizarTamanoToolbar();
} // cambiarTamanoSeleccion()

// Obtener tamaño de fuente del texto seleccionado
function obtenerTamanoFuenteSeleccion() {
    const seleccion = window.getSelection();

    if (!seleccion.rangeCount) return 14;

    let nodo = seleccion.anchorNode;

    if (!nodo) return 14;

    if (nodo.nodeType === 3) {
        nodo = nodo.parentElement;
    }

    const editable = nodo.closest?.('.editable-box');

    if (!editable) return 14;

    const tamano = parseFloat(getComputedStyle(nodo).fontSize);
    return Math.round(tamano);
} // obtenerTamanoFuenteSeleccion()

// Actualizar tamaño de fuente en el toolbar
function actualizarTamanoToolbar() {
    tamanoFuenteActual = obtenerTamanoFuenteSeleccion();
    document.getElementById('fontSizeDisplay').textContent = tamanoFuenteActual;
} // actualizarTamanoToolbar()

// Actualizar estado del toolbar al cambiar el texto seleccionado
document.addEventListener('selectionchange', () => {
        actualizarEstadoToolbar();
        actualizarTamanoToolbar();
    }
);