// Variables globales
let dirHandle  = null;
let todasHojas = [];
const DB_NAME = 'loworkshop-db';
const STORE_NAME = 'config';

async function abrirDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);

        req.onupgradeneeded = () => {
            req.result.createObjectStore(STORE_NAME);
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function guardarRootHandle(handle) {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');

        tx.objectStore(STORE_NAME).put(handle, 'rootFolder');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function obtenerRootHandle() {
    const db = await abrirDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get('rootFolder');

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}
async function obtenerPlantilla() {
    const rootHandle = await obtenerRootHandle();
    const plantillasDir = await rootHandle.getDirectoryHandle("stencil");
    const plantillaHandle = await plantillasDir.getFileHandle("loworkshop_sheet.html");
    const archivo = await plantillaHandle.getFile();
    return await archivo.text();
}

// ── INIT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    if (!('showDirectoryPicker' in window)) {
        document.getElementById('aviso-navegador').style.display = 'block';
        return;
    }

    try {
        const rootHandle = await obtenerRootHandle();
        if (!rootHandle)
            return;

        let permiso =
            await rootHandle.queryPermission({
                mode: 'readwrite'
            });
        
        if (permiso !== 'granted') {
            permiso =
                await rootHandle.requestPermission({
                    mode: 'readwrite'
                });
        }

        if (permiso === 'granted') {
            await conectarCarpetaRaiz(rootHandle);
        }

    } catch (e) {
        console.warn(e);
    }
});

async function conectarCarpetaRaiz(rootHandle) {
    dirHandle =
        await rootHandle.getDirectoryHandle(
            'notas',
            { create: true }
        );

    document.getElementById('btn-conectar').textContent ='↺ Cambiar carpeta';
    document.getElementById('btn-recargar').disabled = false;
    document.getElementById('buscador').disabled = false;

    await cargarHojas();
}

// ── CARPETA ───────────────────────────────────────
async function seleccionarCarpeta() {
    if (!('showDirectoryPicker' in window)) {
        toast('Usa Chrome o Edge.', true);
        return;
    }

    try {
        const rootHandle =
            await window.showDirectoryPicker({
                mode: 'readwrite'
            });

        await guardarRootHandle(rootHandle);
        await conectarCarpetaRaiz(rootHandle);
    }
    catch (e) {
        if (e.name !== 'AbortError')
            toast('No se pudo acceder a la carpeta.',true);
    }
}
async function cargarHojas() {
    todasHojas = [];

    try {
        for await (const [nombre, handle] of dirHandle.entries()) {
            if (handle.kind === 'file' && nombre.endsWith('.html')) {
                const file = await handle.getFile();
                todasHojas.push({ nombre, handle, fecha: new Date(file.lastModified) });
            }
        }

        todasHojas.sort((a, b) => b.fecha - a.fecha);
        actualizarStats();
        renderHojas(todasHojas);
    } catch (e) { 
        toast('Error leyendo la carpeta.', true); 
    }
}

async function recargarHojas() {
    if (!dirHandle) 
        return;

    await cargarHojas();
    toast('Lista actualizada');
}

// ── STATS ─────────────────────────────────────────
function actualizarStats() {
    const ahora = new Date();
    const esMes = h => h.fecha.getMonth() === ahora.getMonth()
                    && h.fecha.getFullYear() === ahora.getFullYear();
    document.getElementById('stat-total').textContent  = todasHojas.length;
    document.getElementById('stat-mes').textContent    = todasHojas.filter(esMes).length;
    document.getElementById('stat-ultima').textContent = todasHojas.length
        ? todasHojas[0].fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
        : '—';
}

// ── RENDER ────────────────────────────────────────
function renderHojas(lista) {
    const c = document.getElementById('lista-hojas');

    if (!lista.length) {
        c.innerHTML = `<div class="estado-vacio">No se encontraron hojas en esta carpeta.</div>`;
        return;
    }

    c.innerHTML = lista.map(h => {
        const n   = h.nombre.replace('.html','').replace(/_/g,' ');
        const f   = h.fecha.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
        return `
        <div class="hoja-item">
            <div class="hoja-info">
                <div class="hoja-nombre">${n}</div>
                <div class="hoja-meta">Modificado: ${f}</div>
            </div>
            <div class="hoja-acciones">
                <button class="btn-hoja" onclick="abrirHoja('${h.nombre}')">↗ Abrir</button>
                <button class="btn-hoja eliminar" onclick="eliminarHoja('${h.nombre}')">✕ Eliminar</button>
            </div>
        </div>`;
    }).join('');
}

// ── ABRIR ─────────────────────────────────────────
function abrirHoja(nombreArchivo) {
    window.open(
        `notas/${encodeURIComponent(nombreArchivo)}`,
        "_blank"
    );
}

// ── ELIMINAR ──────────────────────────────────────
async function eliminarHoja(nombre) {
    if (!await confirmar(`Eliminar ${nombre.replace('.html','').replace(/_/g,' ')}`, "¿Seguro que deseas eliminar esta hoja?")) return;
    try {
        await dirHandle.removeEntry(nombre);
        todasHojas = todasHojas.filter(h => h.nombre !== nombre);

        actualizarStats();
        filtrarHojas();
        toast('Hoja eliminada');
    } catch (e) { 
        toast('No se pudo eliminar.', true); 
    }
}

// ── BUSCADOR ──────────────────────────────────────
function filtrarHojas() {
    const q = document.getElementById('buscador').value.toLowerCase().trim();
    renderHojas(q ? todasHojas.filter(h => h.nombre.toLowerCase().includes(q)) : todasHojas);
}

// ── MODAL ─────────────────────────────────────────
function abrirModal() {
    if (!dirHandle) { 
        toast('Primero selecciona la carpeta de hojas.', true); 
        return; 
    }

    document.getElementById('inp-cliente').value   = '';
    document.getElementById('inp-matricula').value = '';
    document.getElementById('preview-nombre').textContent = '';
    document.getElementById('overlay').classList.add('visible');

    setTimeout(() => document.getElementById('inp-cliente').focus(), 80);
}

function cerrarModal() { document.getElementById('overlay').classList.remove('visible'); }

function cerrarModalFuera(e) { if (e.target.id === 'overlay') cerrarModal(); }

function actualizarPreview() {
    const n = generarNombre(
        document.getElementById('inp-cliente').value.trim(),
        document.getElementById('inp-matricula').value.trim()
    );

    document.getElementById('preview-nombre').textContent = n ? `Nombre del archivo: ${n}.html` : '';
}

function generarNombre(cliente, matricula) {
    const limpiar = s => s
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toUpperCase();

    const c = limpiar(cliente), m = limpiar(matricula);

    if (!c && !m) return '';
    return (c && m) ? `${c}_${m}` : (c || m);
}

// ── CREAR ─────────────────────────────────────────
async function crearHoja() {
    const cliente   = document.getElementById('inp-cliente').value.trim();
    const matricula = document.getElementById('inp-matricula').value.trim();
    const modelo    = document.getElementById('inp-modelo').value.trim();
    const nombre    = generarNombre(cliente, matricula);

    if (!nombre) { 
        toast('Introduce al menos el nombre o la matrícula.', true); 
        return; 
    }
    
    const archivo   = nombre + '.html';
    const fechaHoy  = new Date().toISOString().split('T')[0];
    let contenido = await obtenerPlantilla();
    contenido = contenido
        .replace(/{CLIENTE}/g, cliente)
        .replace(/{MATRICULA}/g, matricula)
        .replace(/{FECHA}/g, fechaHoy)
        .replace(/{MODELO}/g, modelo);

    try {
        try {
            await dirHandle.getFileHandle(archivo);
            
            if (!await confirmar(`"${archivo}" ya existe. ¿Sobreescribir?`, "¿Seguro que desea sobreescribir el archivo?")) 
                return;
        } catch (_) {}
        const fh = await dirHandle.getFileHandle(archivo, { create: true });
        const wr = await fh.createWritable();
        await wr.write(contenido);
        await wr.close();
        cerrarModal();
        await cargarHojas();
        toast(`Hoja "${archivo}" creada`);
        setTimeout(() => abrirHoja(archivo), 400);
    } catch (e) {
        toast('No se pudo crear la hoja.', true);
        console.error(e);
    }
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarModal();
    if (e.key === 'Enter' && document.getElementById('overlay').classList.contains('visible')) crearHoja();
});