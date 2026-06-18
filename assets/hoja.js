// ── TOGGLE MANO DE OBRA ──────────────────────────
function toggleManoObra() {
    const s = document.getElementById('manoObraSection');
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

// ── CAMBIAR FOTO DE MODELO ───────────────────────
function changeLogo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('modelImg').src = e.target.result;
            localStorage.setItem('lw_modelImg', e.target.result);
        };
        reader.readAsDataURL(file);
    }
}

// ── AUTO-GUARDAR ─────────────────────────────────
function setupAutoSave() {
    document.querySelectorAll('input').forEach((input, i) => {
        if (!input.id) input.id = 'input_' + i;
        input.addEventListener('input', function () {
            localStorage.setItem('lw_' + this.id, this.value);
        });
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        el.addEventListener('input', function () {
            localStorage.setItem('lw_' + this.id, this.innerHTML);
        });
    });
}

// ── CARGAR DATOS GUARDADOS ───────────────────────
function loadData() {
    // Imagen de modelo
    const imgGuardada = localStorage.getItem('lw_modelImg');
    if (imgGuardada) document.getElementById('modelImg').src = imgGuardada;

    document.querySelectorAll('input').forEach((input, i) => {
        if (!input.id) input.id = 'input_' + i;
        const saved = localStorage.getItem('lw_' + input.id);
        if (saved) input.value = saved;
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
        const saved = localStorage.getItem('lw_' + el.id);
        if (saved) el.innerHTML = saved;
    });
}

// ── LIMPIAR FORMULARIO ───────────────────────────
function clearForm() {
    if (confirm('¿Seguro que quieres borrar todos los datos del formulario?')) {
        Object.keys(localStorage)
            .filter(k => k.startsWith('lw_'))
            .forEach(k => localStorage.removeItem(k));
        location.reload();
    }
}

// ── INIT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupAutoSave();
});
