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
let extensionPendiente = '';
let imagenPendiente = null;
let modoGestion = null;

function cerrarModalCoches() {
    document.getElementById('modalCoches').classList.remove('open');
} // cerrarModalCoches()

function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
} // capitalizar()

// Abrir selector de archivo para subir a biblioteca
function abrirSelectorArchivo() {
    document.getElementById('inputArchivoBiblioteca').click();
} // abrirSelectorArchivo()

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

// Subida de fotos locales a la biblioteca
async function subirFotoBiblioteca() {
    const marca = document.getElementById('gestionMarca').value.trim();
    const modelo = document.getElementById('gestionModelo').value.trim();
    const nombre = document.getElementById('gestionNombre').value.trim();
    const archivo = document.getElementById('gestionArchivo').files[0];
    const extension = archivo.name.substring(archivo.name.lastIndexOf('.'));
    
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
    
    // Reset tabs
    document.querySelectorAll('.modal-tab').forEach(tab =>
            tab.classList.remove('active')
        );

    document.querySelectorAll('.modal-tab-content').forEach(tab =>
            tab.classList.remove('active')
        );

    if (boton) {
        boton.classList.add('active');
    }

    const titulo = document.getElementById('modalTitulo');
    const btnCancelar =document.getElementById('btnSecundarioModal');
    const btnMedio = document.getElementById('btnMedioModal');
    const btnPrincipal = document.getElementById('btnPrincipalModal');

    // Biblioteca
    if (nombre === 'biblioteca') {
        document.getElementById('tabBiblioteca').classList.add('active');

        titulo.textContent = 'Biblioteca de vehículos';
        btnCancelar.style.display = 'inline-block';
        btnMedio.style.display = 'inline-block';
        btnPrincipal.style.display = 'inline-block';
        btnCancelar.textContent = 'Cancelar';
        btnMedio.textContent = 'Añadir archivo local';
        btnPrincipal.textContent = 'Usar imagen';
        btnCancelar.onclick = cerrarModalCoches;
        btnMedio.onclick = abrirSelectorArchivo;
        btnPrincipal.onclick = confirmarSeleccionFoto;
        return;
    }

    // Url
    if (nombre === 'url') {
        document.getElementById('tabUrl').classList.add('active');

        titulo.textContent ='Imagen desde URL';
        btnCancelar.style.display ='inline-block';
        btnMedio.style.display ='inline-block';
        btnPrincipal.style.display ='inline-block';
        btnCancelar.textContent ='Cancelar';
        btnMedio.textContent ='Añadir foto URL';
        btnPrincipal.textContent ='Usar imagen';
        btnCancelar.onclick =cerrarModalCoches;
        btnMedio.onclick =prepararUrlBiblioteca;
        btnPrincipal.onclick =usarImagenUrl;
        return;
    }

    // Gestion
    if (nombre === 'gestion') {
        document.getElementById('vistaGestionBiblioteca').classList.add('active');

        titulo.textContent = 'Guardar imagen en biblioteca';
        btnCancelar.style.display = 'inline-block';
        btnMedio.style.display = 'none';
        btnPrincipal.style.display = 'inline-block';
        btnCancelar.textContent = 'Cancelar';
        btnPrincipal.textContent = 'Guardar en biblioteca';
        btnCancelar.onclick = cancelarGestionBiblioteca;
        btnPrincipal.onclick = guardarImagenBiblioteca;
        return;
    }

}
// cambiarTab()

// Previsualizacion de imagenes URL
function previsualizarUrl() {
    const url = document.getElementById('urlImagen').value.trim();

    if (!url) return;

    document.getElementById('urlPreview').innerHTML = `<img src="${url}" alt="">`;

    // const preview = document.getElementById('urlPreview');
    // preview.innerHTML = '';

    // const img = document.createElement('img');
    // img.src = url;
    // preview.appendChild(img);
} // previsualizarUrl()

// Uso de imagen URL en modelImg
function usarImagenUrl() {
    const url = document.getElementById('urlImagen').value.trim();

    if (!url) {
        alert('Introduce una URL')
        return;
    }

    document.getElementById('modelImg').src = url;

    cerrarModalCoches();
} // usarImagenUrl()

// Funcion para obtener la extensión de la imagen desde la URL
function obtenerExtensionDesdeUrl(url) {

    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);

        if (match) {
            return '.' +
                match[1]
                .toLowerCase();
        }
    } catch {}

    return '.jpg';
} // obtenerExtensionDesdeUrl()


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

// Preparar archivo para subir a biblioteca
function prepararArchivoBiblioteca(event) {
    const archivo = event.target.files[0];

    if (!archivo) return;

    imagenPendiente = archivo;
    modoGestion = 'archivo';
    extensionPendiente = archivo.name.substring(archivo.name.lastIndexOf('.'));

    mostrarGestionBiblioteca();
} // prepararArchivoBiblioteca()

// Preparar foto URL para subir a biblioteca
function prepararUrlBiblioteca() {
    const url = document.getElementById('urlImagen').value.trim();

    if (!url) {
        alert(
            'Introduce una URL'
        );
        return;
    }

    imagenPendiente = url;
    modoGestion = 'url';
    extensionPendiente = obtenerExtensionDesdeUrl(url);

    mostrarGestionBiblioteca();
} // prepararUrlBiblioteca()

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

// Mostrar la vista de gestión de biblioteca
function mostrarGestionBiblioteca() {
    cambiarTab('gestion');
    document.getElementById('modalTitulo').textContent = 'Guardar imagen en biblioteca';

    cargarMarcasGestion();

    document.getElementById('gestionNombre').value = '';

    const preview = document.getElementById('gestionPreview');

    if (modoGestion === 'url') {
        preview.innerHTML = `<img src="${imagenPendiente}">`;
    }

    if (modoGestion === 'archivo') {
        preview.innerHTML = `<img src="${URL.createObjectURL(imagenPendiente)}">`;
    }
} // mostrarGestionBiblioteca()

// Cancelar la gestión de biblioteca y volver a la vista principal
function cancelarGestionBiblioteca() {
    cambiarTab('biblioteca', document.querySelectorAll('.modal-tab')[0]);
} // cancelarGestionBiblioteca()

// Cargar marcas en el select de gestión
function cargarMarcasGestion() {
    const select = document.getElementById('gestionMarca');
    select.innerHTML = '';

    Object.keys(indiceCoches)
        .forEach(marca => {
            const opt =
                document.createElement(
                    'option'
                );

            opt.value = marca;
            opt.textContent =
                capitalizar(marca);

            select.appendChild(opt);
        });

    const nueva = document.createElement('option');

    nueva.value = '__NUEVA_MARCA__';

    nueva.textContent = '+ Nueva marca';
    select.appendChild(nueva);

    onGestionMarcaChange();
} // cargarMarcasGestion()

// Cambios en el select de marca en la gestión de biblioteca
function onGestionMarcaChange() {
    const marca = document.getElementById('gestionMarca').value;
    const nuevaMarca = document.getElementById('contenedorMarcaNueva');
    const selectModelo = document.getElementById('gestionModelo');
    selectModelo.innerHTML = '';

    if (marca === '__NUEVA_MARCA__') {
        nuevaMarca.style.display = 'block';
    } else {
        nuevaMarca.style.display = 'none';

        Object.keys(
            indiceCoches[marca] || {}
        ).forEach(modelo => {
            const opt =
                document.createElement(
                    'option'
                );

            opt.value = modelo;
            opt.textContent =
                capitalizar(modelo);

            selectModelo.appendChild(opt);
        });
    }

    const nuevo = document.createElement('option');

    nuevo.value = '__NUEVO_MODELO__';
    nuevo.textContent = '+ Nuevo modelo';
    selectModelo.appendChild(nuevo);

    onGestionModeloChange();
} // onGestionMarcaChange()

// Cambios en el select de modelo en la gestión de biblioteca
function onGestionModeloChange() {
    const modelo = document.getElementById('gestionModelo').value;

    document.getElementById('contenedorModeloNuevo').style.display = modelo === '__NUEVO_MODELO__' ? 'block' : 'none';
} // onGestionModeloChange()

// Guardar imagen en biblioteca (ya sea desde URL o archivo)
async function guardarImagenBiblioteca() {
    let marca = document.getElementById('gestionMarca').value;
    let modelo = document.getElementById('gestionModelo').value;
    const nombre = document.getElementById('gestionNombre').value.trim();

    // Nueva marca

    if (marca === '__NUEVA_MARCA__') {
        marca = document.getElementById('gestionMarcaNueva').value.trim();
    }

    // Nuevo modelo

    if (modelo === '__NUEVO_MODELO__') {
        modelo = document.getElementById('gestionModeloNuevo').value.trim();
    }

    // Validaciones

    if (!marca || !modelo || !nombre) {
        alert(
            'Completa todos los campos'
        );
        return;
    }

    const nombreFinal = nombre + extensionPendiente;

    try {

        // Url

        if (modoGestion === 'url') {
            const resp =
                await fetch(
                    '/api/guardar-url',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body: JSON.stringify({
                            marca,
                            modelo,
                            nombre: nombreFinal,
                            url: imagenPendiente
                        })
                    }
                );

            const data = await resp.json();

            if (!data.ok) {
                throw new Error(data.error);
            }
        }

        // Archivo

        if (modoGestion === 'archivo') {

            const base64 = await archivoABase64(imagenPendiente);

            const resp =
                await fetch(
                    '/api/subir-foto',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type':
                                'application/json'
                        },
                        body: JSON.stringify({
                            marca,
                            modelo,
                            nombre: nombreFinal,
                            imagen: base64
                        })
                    }
                );

            const data = await resp.json();

            if (!data.ok) {
                throw new Error(data.error);
            }

        }

        // Recargar indice de coches 

        indiceCoches = null;
        await cargarIndiceCoches();

        alert('Imagen guardada correctamente');
        cancelarGestionBiblioteca();
    } catch (err) {
        console.error(err);
        alert('Error guardando imagen');
    }

} // guardarImagenBiblioteca()

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