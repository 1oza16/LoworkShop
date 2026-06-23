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
let indiceCoches = null;
let rutaSeleccionada = null; // ruta completa de la foto elegida en el modal

// Añadir indice de los coches a indiceCoches mediante el fichero (fotos_coches/index.json)
async function cargarIndiceCoches() {
    try {
        const resp = await fetch(
            "/api/coches",
            { cache: "no-store" }
        );

        if (!resp.ok) {
            throw new Error("No se pudo cargar catálogo");
        }
        indiceCoches = await resp.json();
    } catch (err) {
        console.error(err);
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
    // const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    // Reset
    selectMarca.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.disabled = true;
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    // btnSeleccionar.disabled = true; --- IGNORE ---
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
    cambiarTab('biblioteca',document.querySelector('.modal-tab')
);
} // abrirModalCoches()

function cerrarModalCoches() {
    document.getElementById('modalCoches').classList.remove('open');
} // cerrarModalCoches()

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Subida de fotos locales a la biblioteca
async function subirFotoBiblioteca() {
    const marca = document.getElementById('gestionMarca').value.trim();
    const modelo = document.getElementById('gestionModelo').value.trim();
    const nombre = document.getElementById('gestionNombre').value.trim();
    const archivo = document.getElementById('gestionArchivo').files[0];

    if (!marca || !modelo || !nombre || !archivo) {
        alert("Completa todos los campos");
        return;
    }

    const base64 = await archivoABase64(archivo);

    const resp =
        await fetch(
            "/api/subir-foto",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    marca,
                    modelo,
                    nombre,
                    imagen: base64
                })
            }
        );

    const resultado = await resp.json();

    if (!resultado.ok) {
        alert(resultado.error || "Error al guardar");
        return;
    }

    indiceCoches = null;

    await cargarIndiceCoches();

    alert(
        "Imagen añadida correctamente"
    );
} // subirFotoBiblioteca()

// Cambios de pestañas entre biblioteca, URL y gestionar
function cambiarTab(nombre, boton) {

    // Tabs
    document.querySelectorAll('.modal-tab').forEach(tab =>
            tab.classList.remove('active')
        );

    document.querySelectorAll('.modal-tab-content').forEach(tab =>
            tab.classList.remove('active')
        );

    boton.classList.add('active');

    const titulo = document.getElementById('modalTitulo');
    const btn = document.getElementById('btnAccionPrincipal');

    // Pestaña biblioteca
    if (nombre === 'biblioteca') {
        document.getElementById('tabBiblioteca').classList.add('active');
        titulo.textContent = 'Biblioteca de vehículos';
        btn.textContent = 'Usar imagen';
        btn.disabled = !rutaSeleccionada;
        btn.onclick = confirmarSeleccionFoto;
    }

    // Pestaña URL
    if (nombre === 'url') {
        document.getElementById('tabUrl').classList.add('active');
        titulo.textContent = 'Imagen desde URL';
        btn.textContent = 'Guardar en biblioteca';
        btn.disabled = false;
        btn.onclick = guardarImagenUrl;
    }
    // Pestaña gestionar
    if (nombre === 'gestionar') {
        document.getElementById('tabGestionar').classList.add('active');
        titulo.textContent = 'Gestión de biblioteca';
        btn.textContent = 'Guardar en biblioteca';
        btn.disabled = false;
        btn.onclick = subirFotoBiblioteca;
    }
} // cambiarTab()

// Previsualizacion de imagenes URL
function previsualizarUrl() {
    const url = document.getElementById('urlImagen').value.trim();

    if (!url) return;

    const preview = document.getElementById('urlPreview');
    preview.innerHTML = '';

    const img = document.createElement('img');
    img.src = url;
    preview.appendChild(img);
} // previsualizarUrl()

// Guardado de imagenes URL en biblioteca local
async function guardarImagenUrl() {
    const marca = document.getElementById('urlMarca').value.trim();
    const modelo = document.getElementById('urlModelo').value.trim();
    const nombre = document.getElementById('urlNombre').value.trim();
    const url = document.getElementById('urlImagen').value.trim();

    if ( !marca || !modelo || !nombre || !url) {
        alert("Completa todos los campos");
        return;
    }

    const resp = await fetch(
        "/api/guardar-url",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                marca,
                modelo,
                nombre,
                url
            })
        }
    );

    const resultado = await resp.json();

    if (!resultado.ok) {
        alert(resultado.error || "Error guardando imagen");
        return;
    }

    indiceCoches = null;

    await cargarIndiceCoches();

    alert("Imagen añadida correctamente");
} // guardarImagenUrl()

// Conversor a Base64
function archivoABase64(file) {
    return new Promise(
        (resolve, reject) => {
            const reader =
                new FileReader();
            reader.onload = () => {
                resolve(
                    reader.result
                    .split(',')[1]
                );
            };

            reader.onerror = reject;

            reader.readAsDataURL(file);
        }
    );
} // archivoABase64()

// Funcion para rellenar el <select> de modelos una vez seleccionas la marca
function onMarcaChange() {
    const marca = document.getElementById('selectMarca').value;
    const selectModelo = document.getElementById('selectModelo');
    const thumbs = document.getElementById('modalThumbs');
    const preview = document.getElementById('modalPreview');
    // const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    // btnSeleccionar.disabled = true; 
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
    // const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    // btnSeleccionar.disabled = true;
    rutaSeleccionada = null;

    if (!marca || !modelo) return;

    const imagenes = indiceCoches[marca][modelo] || [];
    if (imagenes.length === 0) {
        thumbs.innerHTML = '<div class="modal-empty-msg">Sin imágenes para este modelo.</div>';
        return;
    }

    imagenes.forEach(nombreArchivo => {
        const ruta = `${"../fotos_coches"}/${marca}/${modelo}/${nombreArchivo}`;
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
    const btn = document.getElementById('btnAccionPrincipal');
    const tabBiblioteca = document.getElementById('tabBiblioteca');

    if (tabBiblioteca.classList.contains('active')) {
        btn.disabled = false;
    }
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