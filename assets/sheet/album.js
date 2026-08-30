let indiceCoches = null;
let imagenSeleccionada = null;
let extensionPendiente = '';
let imagenPendiente = null;
let modoGestion = null;

const modelImg = document.getElementById('modelImg');
const preview = document.getElementById('modalPreview');

function actualizarEstadoModelImg() {
    
    const boton = document.querySelector('.thumb-action');
    const texto = document.getElementById('changeModelImg');

    if (!modelImg || !boton || !texto) {
        return;
    }

    const hayImagen = Boolean(modelImg.getAttribute('src'));
    boton.style.display = hayImagen ? 'flex' : 'none';
    texto.style.display = hayImagen ? 'none' : 'block';
} // actualizarEstadoModelImg()

// Cambio de foto modelImg
function changeLogo(event) {
    const file = event.target.files[0]; 
    if (file) {
        const reader = new FileReader(); 
        reader.onload = function(e) {
            modelImg.src = e.target.result;
            modelImg.dataset.imageId = '';
            actualizarEstadoModelImg();
        };
        reader.readAsDataURL(file);  
    }
} // changeLogo()

function quitarImagen(event) {
    if (event) {
        event.stopPropagation();
    }

    if (!modelImg) {
        return;
    }

    modelImg.src = '';
    modelImg.dataset.imageId = '';
    actualizarEstadoModelImg();
    marcarComoModificada();
} // quitarImagen()

function cerrarModalCoches() {
    document.getElementById('modalCoches').classList.remove('visible');
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
        indiceCoches = await API.getIndexCars();
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

    // Reset
    selectMarca.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    selectModelo.disabled = true;
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    imagenSeleccionada = null;

    const marcas = Object.keys(datos);
    if (marcas.length === 0) {
        thumbs.innerHTML = '<div class="modal-empty-msg">Añade fotos en el album para poder usar las imágenes</div>';
    } else {
        marcas.forEach(marca => {
            const opt = document.createElement('option');
            opt.value = marca;
            opt.textContent = capitalizar(marca);
            selectMarca.appendChild(opt);
        });
    }

    document.getElementById('modalCoches').classList.add('visible');
    cambiarTab('biblioteca',document.querySelector('.modal-tab'));
} // abrirModalCoches()

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

        titulo.textContent = 'BIBLIOTECA DE VEHÍCULOS';
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

        titulo.textContent ='IMAGEN DESDE URL';
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

        titulo.textContent = 'GUARDAR IMAGEN EN LA BIBLIOTECA';
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
} // previsualizarUrl()

// Uso de imagen URL en modelImg
function usarImagenUrl() {
    const url = document.getElementById('urlImagen').value.trim();

    if (!url) {
        toast('Introduce una URL', true)
        return;
    }

    modelImg.src = url;
    modelImg.dataset.imageId = '';
    actualizarEstadoModelImg();

    cerrarModalCoches();
    marcarComoModificada();
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
        toast('Introduce una URL', true);
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
    // const btnSeleccionar = document.getElementById('btnSeleccionarFoto');

    selectModelo.innerHTML = '<option value="">-- Selecciona --</option>';
    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';
    // btnSeleccionar.disabled = true; 

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
async function onModeloChange() {
    await cargarIndiceCoches();
    const marca = document.getElementById('selectMarca').value;
    const modelo = document.getElementById('selectModelo').value;
    const thumbs = document.getElementById('modalThumbs');

    thumbs.innerHTML = '';
    preview.innerHTML = '<span>imagen</span>';

    if (!marca || !modelo) return;

    const imagenes = indiceCoches[marca][modelo] || [];
    if (imagenes.length === 0) {
        thumbs.innerHTML = '<div class="modal-empty-msg">No se encuentran imágenes para este modelo.</div>';
        return;
    }

    imagenes.forEach(imagen => {
        const item = document.createElement("div");
        item.className = "thumb-item";

        const thumb = document.createElement("img");
        thumb.className = "thumb";
        thumb.src = API.getImage(imagen.id);
        thumb.alt = imagen.nombre;
        thumb.onclick = () => seleccionarImagen(imagen);

        const borrar = document.createElement("button");
        borrar.className = "thumb-delete";

        const icono = document.createElement("img");
        icono.src = "../img/icons/delete.png";

        borrar.onclick = (e) => {
            e.stopPropagation();
            eliminarImagenBiblioteca(imagen);
        };

        item.append(thumb, borrar);
        borrar.appendChild(icono)
        thumbs.appendChild(item);
});
} // onModeloChange()

// Mostrar miniatura en grande tras seleccionarla
function seleccionarImagen(imagen) {
    imagenSeleccionada = imagen;

    preview.innerHTML = '';
    const img = document.createElement('img');
    img.src = API.getImage(imagen.id);
    preview.appendChild(img);
} // seleccionarThumb()

function confirmarSeleccionFoto() {
    if (!imagenSeleccionada) 
        return;

    modelImg.dataset.imageId = imagenSeleccionada.id;
    modelImg.src = API.getImage(imagenSeleccionada.id);
    actualizarEstadoModelImg();

    cerrarModalCoches();
    marcarComoModificada();
} // confirmarSeleccionFoto()

// Mostrar la vista de gestión de biblioteca
function mostrarGestionBiblioteca() {
    cambiarTab('gestion');
    document.getElementById('modalTitulo').textContent = 'GUARDAR IMAGEN EN LA BIBLIOTECA';

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
        toast('Completa todos los campos', true);
        return;
    }

    const nombreFinal = nombre + extensionPendiente;

    try {

        // Url
        if (modoGestion === 'url') {
            const resp = API.postUrlImage(marca, modelo, nombreFinal, imagenPendiente);
        }
        
        // Archivo
        if (modoGestion === 'archivo') {
            const base64 = await archivoABase64(imagenPendiente);
            const resp = API.postLocalImage(marca, modelo, nombreFinal, base64)
        }

        // Recargar indice de coches 

        indiceCoches = null;
        // await cargarIndiceCoches();

        toast('Imagen guardada correctamente');
        cancelarGestionBiblioteca();

        // Recargar las miniaturas del modelo actual
        onModeloChange()
    } catch (err) {
        console.error(err);
        toast('Error guardando imagen', true);
    }

} // guardarImagenBiblioteca()

async function eliminarImagenBiblioteca(imagen) {

    const confirm = await confirmar("Eliminar imagen", `¿Deseas eliminar la imagen "${imagen.nombre}"?`);

    if (!confirm)
        return;

    try {
        await API.eliminateImage(imagen.id);

        toast("Imagen eliminada correctamente.");

        // Si era la imagen seleccionada, limpiar preview
        if (
            imagenSeleccionada && imagenSeleccionada.id === imagen.id) {
            imagenSeleccionada = null;
            preview.src = "";
        }

        // Recargar las miniaturas del modelo actual
        onModeloChange();

    } catch (error) {
        console.error(error);
        toast("No se pudo eliminar la imagen.", true);
    }

}
