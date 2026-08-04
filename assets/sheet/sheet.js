// Funcionalidad mano de obra (ocultar y desocultar)
function toggleManoObra() {
    const section = document.getElementById('manoObraSection');
    const button = document.querySelector('.toggle-mano-obra-mini');

    if (section.style.display === 'none') {
        section.style.display = 'block';
        button.textContent = 'Ocultar mano de obra';
    } else {
        section.style.display = 'none';
        button.textContent = 'Mostrar mano de obra';
    }
} // toggleManoObra()

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
// function loadData() {
//     document.querySelectorAll('input').forEach((input, index) => {
//         if(!input.id) input.id = 'input_' + index;
//         const saved = localStorage.getItem('taller_' + input.id);
//         if(saved) input.value = saved;
//     });

//     document.querySelectorAll('[contenteditable="true"]').forEach(editable => {
//         const saved = localStorage.getItem('taller_' + editable.id);
//         if(saved) editable.innerHTML = saved;
//     });
// } // loadData()

// Limpiar hoja
async function clearForm() {
    if(await confirmar('Limpiar formulario', '¿Seguro que quieres borrar todos los datos del formulario?')) {
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
    // loadData();
    setupAutoSave();
});