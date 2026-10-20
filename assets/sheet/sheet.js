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

async function loadSheetHeaderOptions() {
    const client = document.getElementById("cliente");
    const brand = document.getElementById("marca");
    const model = document.getElementById("modelo");
    const uuid = document.querySelector('meta[name="ficha-uuid"]')?.content;
    const currentNames = {
        client: client.options[0]?.textContent.trim(),
        brand: brand.options[0]?.textContent.trim(),
        model: model.options[0]?.textContent.trim()
    };

    try {
        const [clientsResponse, brandsResponse, modelsResponse, sheetsResponse] =
            await Promise.all([
                API.getDatabaseRecords("clientes"),
                API.getDatabaseRecords("marcas"),
                API.getDatabaseRecords("modelos"),
                uuid ? API.getDatabaseRecords("fichas") : Promise.resolve(null)
            ]);
        const ficha = sheetsResponse?.records.find(record => record.uuid === uuid);
        const selectedModel = modelsResponse.records.find(
            record => record.uuid === ficha?.modelo_uuid
        );
        const clientUuid = ficha?.cliente_uuid || clientsResponse.records.find(
            record => record.nombre === currentNames.client
        )?.uuid;
        const modelUuid = selectedModel?.uuid || modelsResponse.records.find(
            record => record.nombre === currentNames.model
        )?.uuid;
        const brandUuid = selectedModel?.marca_uuid || brandsResponse.records.find(
            record => record.nombre === currentNames.brand
        )?.uuid || modelsResponse.records.find(
            record => record.uuid === modelUuid
        )?.marca_uuid;

        setSheetOptions(client, clientsResponse.records, "uuid", "nombre");
        setSheetOptions(brand, brandsResponse.records, "uuid", "nombre");
        client.value = clientUuid || "";
        brand.value = brandUuid || "";
        updateSheetModels(modelsResponse.records, brand.value, modelUuid);

        brand.addEventListener("change", () => {
            updateSheetModels(modelsResponse.records, brand.value);
        });
        document.dispatchEvent(new Event("sheet-header-loaded"));
    } catch (error) {
        console.error("Error cargando datos de cabecera:", error);
        toast("No se pudieron cargar los clientes y vehículos.", true);
    }
}

function setSheetOptions(select, records, valueKey, labelKey) {
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Seleccionar --";
    select.replaceChildren(placeholder);

    [...records]
        .sort((first, second) =>
            String(first[labelKey]).localeCompare(
                String(second[labelKey]),
                "es",
                { sensitivity: "base" }
            )
        )
        .forEach(record => {
            const option = document.createElement("option");
            option.value = record[valueKey];
            option.textContent = record[labelKey];
            select.appendChild(option);
        });
}

function updateSheetModels(models, brandUuid, selectedModelUuid = "") {
    const model = document.getElementById("modelo");
    const options = models.filter(record => record.marca_uuid === brandUuid);
    setSheetOptions(model, options, "uuid", "nombre");
    model.disabled = !brandUuid;
    model.value = selectedModelUuid;
}

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
    loadSheetHeaderOptions();
});