// Funcionalidad mano de obra (ocultar y desocultar)
function toggleManoObra() {
    const section = document.getElementById('manoObraSection');
    if (section.style.display === 'none') {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
} // toggleManoObra()

//#region Funciones album fotos coches
const RUTA_FOTOS_COCHES = '../fotos_coches';
let indiceCoches = null;
let rutaSeleccionada = null; // ruta completa de la foto elegida en el modal

// Añadir indice de los coches a indiceCoches mediante el fichero (fotos_coches/index.json)
async function cargarIndiceCoches() {
    if (indiceCoches) return indiceCoches;
    try {
        const resp = await fetch(`${RUTA_FOTOS_COCHES}/index.json`, { cache: 'no-store' });
        if (!resp.ok) throw new Error('No se pudo leer index.json');
        indiceCoches = await resp.json();
    } catch (err) {
        console.error('Error cargando biblioteca de vehículos:', err);
        indiceCoches = {};
    }
    return indiceCoches;
} // cargarIndiceCoches()

// Apertura del modal y carga del indice 
async function abrirModalCoches() {
    const datos = await cargarIndiceCoches();
    const selectMarca = document.getElementById('selectMarca');
    const selectModelo = document.getElementById('selectModelo');
    const thumbs = document.getElementById('modalThumbs');
    const preview = document.getElementById('modalPreview');
    const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    // Reset
    selectMarca.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.disabled = true;
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    btnSeleccionar.disabled = true;
    rutaSeleccionada = null;

    const marcas = Object.keys(datos);
    if (marcas.length === 0) {
        thumbs.innerHTML = '<div class="modal-empty-msg">No hay fotos en fotos_coches/. Añade imágenes y regenera index.json.</div>';
    } else {
        marcas.forEach(marca => {
            const opt = document.createElement('option');
            opt.value = marca;
            opt.textContent = capitalizar(marca);
            selectMarca.appendChild(opt);
        });
    }

    document.getElementById('modalCoches').classList.add('open');
} // abrirModalCoches()

function cerrarModalCoches() {
    document.getElementById('modalCoches').classList.remove('open');
} // cerrarModalCoches()

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Funcion para rellenar el <select> de modelos una vez seleccionas la marca
function onMarcaChange() {
    const marca = document.getElementById('selectMarca').value;
    const selectModelo = document.getElementById('selectModelo');
    const thumbs = document.getElementById('modalThumbs');
    const preview = document.getElementById('modalPreview');
    const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    btnSeleccionar.disabled = true;
    rutaSeleccionada = null;

    if (!marca || !indiceCoches[marca]) {
        selectModelo.disabled = true;
        return;
    }

    Object.keys(indiceCoches[marca]).forEach(modelo => {
        const opt = document.createElement('option');
        opt.value = modelo;
        opt.textContent = capitalizar(modelo);
        selectModelo.appendChild(opt);
    });
    selectModelo.disabled = false;
} // onMarcaChange()

// Pintado de las miniaturas del modelo seleccionado 
function onModeloChange() {
    const marca = document.getElementById('selectMarca').value;
    const modelo = document.getElementById('selectModelo').value;
    const thumbs = document.getElementById('modalThumbs');
    const preview = document.getElementById('modalPreview');
    const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    btnSeleccionar.disabled = true;
    rutaSeleccionada = null;

    if (!marca || !modelo) return;

    const imagenes = indiceCoches[marca][modelo] || [];
    if (imagenes.length === 0) {
        thumbs.innerHTML = '<div class="modal-empty-msg">Sin imágenes para este modelo.</div>';
        return;
    }

    imagenes.forEach(nombreArchivo => {
        const ruta = `${RUTA_FOTOS_COCHES}/${marca}/${modelo}/${nombreArchivo}`;
        const thumb = document.createElement('img');
        thumb.src = ruta;
        thumb.alt = nombreArchivo;
        thumb.onclick = () => seleccionarThumb(thumb, ruta);
        thumbs.appendChild(thumb);
    });
} // onModeloChange()

// Mostrar miniatura en grande tras seleccionarla
function seleccionarThumb(thumbEl, ruta) {
    document.querySelectorAll('.modal-thumbs img').forEach(img => img.classList.remove('selected'));
    thumbEl.classList.add('selected');

    const preview = document.getElementById('modalPreview');
    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = ruta;
    preview.appendChild(img);

    rutaSeleccionada = ruta;
    document.getElementById('btnSeleccionarFoto').disabled = false;
} // seleccionarThumb()

function confirmarSeleccionFoto() {
    if (!rutaSeleccionada) return;
    document.getElementById('modelImg').src = rutaSeleccionada;
    cerrarModalCoches();
} // confirmarSeleccionFoto()

//#endregion

// Cambio de foto modelImg
function changeLogo(event) {
    const file = event.target.files[0];  // Obtiene el archivo seleccionado
    if (file) {
        const reader = new FileReader();  // Crea un lector de archivos
        reader.onload = function(e) {
            document.getElementById('modelImg').src = e.target.result;  // Cambia el src del img
        };
        reader.readAsDataURL(file);  // Lee el archivo como Data URL (base64)
    }
} // changeLogo()

// Auto-guardar cada cambio
function setupAutoSave() {
    // IDs que necesitan ser únicos para cada input
    document.querySelectorAll('input').forEach((input, index) => {
        if(!input.id) input.id = 'input_' + index;

        input.addEventListener('input', function() {
            localStorage.setItem('taller_' + this.id, this.value);
        });
    });

    // Guardar áreas editables
    document.querySelectorAll('[contenteditable="true"]').forEach(editable => {
        editable.addEventListener('input', function() {
            localStorage.setItem('taller_' + this.id, this.innerHTML);
        });
    });
} // setupAutoSave()

// Cargar datos guardados
function loadData() {
    document.querySelectorAll('input').forEach((input, index) => {
        if(!input.id) input.id = 'input_' + index;
        const saved = localStorage.getItem('taller_' + input.id);
        if(saved) input.value = saved;
    });

    document.querySelectorAll('[contenteditable="true"]').forEach(editable => {
        const saved = localStorage.getItem('taller_' + editable.id);
        if(saved) editable.innerHTML = saved;
    });
} // loadData()

// Limpiar hoja
function clearForm() {
    if(confirm('¿Seguro que quieres borrar todos los datos del formulario?')) {
        // Limpiar localStorage
        Object.keys(localStorage).forEach(key => {
            if(key.startsWith('taller_')) {
                localStorage.removeItem(key);
            }
        });
        location.reload();
    }
} // clearForm()

// Inicializar
window.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupAutoSave();
});