let rootDatabase = null;
let controllerDatabase = null;
let databaseTables = [];
let tableData = null;
let currentTable = null;
let visibleRecords = [];
let databaseHistory = [{ table: null }];
let databaseHistoryPosition = 0;
let databaseRequestId = 0;
let indicatorDatabase = null;

const recordDisplayColumns = {
    modelos: { marca_uuid: "nombre_marca" },
    fichas: {
        cliente_uuid: "nombre_cliente",
        modelo_uuid: "nombre_modelo"
    }
};
const recordHiddenColumns = {
    fichas: ["nombre_ficha"]
};

const recordRelationFields = {
    modelos: {
        marca_uuid: {
            table: "marcas",
            valueKey: "uuid",
            textKey: "nombre",
            label: "Marca"
        }
    }
};

let relationRecordsCache = {};

function Database() {

    function mount(root) {
        rootDatabase = root;
        controllerDatabase = new AbortController();
        indicatorDatabase = root.querySelector(".indicator");

        root.querySelector("#back").addEventListener(
            "click",
            () => navigateDatabase(-1),
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#forward").addEventListener(
            "click",
            () => navigateDatabase(1),
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#home").addEventListener(
            "click",
            () => openDatabaseHome(true),
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#new-item").addEventListener(
            "click",
            () => openRecordModal("create"),
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#buscador").addEventListener(
            "input",
            filterDatabase,
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#database-record-form").addEventListener(
            "submit",
            saveDatabaseRecord,
            { signal: controllerDatabase.signal }
        );

        root.addEventListener(
            "click",
            manageDatabaseClick,
            { signal: controllerDatabase.signal }
        );
        
        window.addEventListener(
            "mouseup",
            manageDatabaseMouseButton,
            { signal: controllerDatabase.signal }
        );

        root.querySelector("#grid").innerHTML = `
            <div class="estado-vacio">Cargando tablas...</div>
        `;
        loadDatabaseTables();
    }

    function unmount() {
        controllerDatabase?.abort();
        databaseRequestId++;
        controllerDatabase = null;
        rootDatabase = null;
        tableData = null;
        currentTable = null;
        visibleRecords = [];
        relationRecordsCache = {};
        databaseHistory = [{ table: null }];
        databaseHistoryPosition = 0;
        indicatorDatabase = null;
    }

    return {
        mount,
        unmount
    };
}

async function loadDatabaseTables() {
    const root = rootDatabase;
    const requestId = databaseRequestId;

    try {
        const response = await API.getDatabaseTables();
        if (rootDatabase !== root) {
            return;
        }
        databaseTables = response.tables;

        if (requestId === databaseRequestId && !currentTable) {
            renderDatabaseTables();
        }
    } catch (error) {
        if (rootDatabase !== root || requestId !== databaseRequestId) {
            return;
        }
        console.error("Error cargando las tablas:", error);
        showDatabaseError("No se pudieron cargar las tablas.", "tables");
    }
}

async function loadDatabaseRecords(table, requestId = ++databaseRequestId) {
    currentTable = table;
    tableData = null;
    visibleRecords = [];
    updateDatabaseNavigation();
    updateDatabaseHeader();
    updateCreateRecordButton();
    rootDatabase.querySelector("#grid").innerHTML = `
        <div class="estado-vacio">Cargando registros...</div>
    `;

    try {
        const response = await API.getDatabaseRecords(table);
        if (!rootDatabase || requestId !== databaseRequestId) {
            return;
        }

        tableData = response;
        rootDatabase.querySelector("#buscador").value = "";
        rootDatabase.querySelector("#buscador").placeholder = `Buscar en ${table}...`;
        renderDatabaseRecords();
    } catch (error) {
        if (!rootDatabase || requestId !== databaseRequestId) {
            return;
        }

        console.error(`Error cargando la tabla ${table}:`, error);
        showDatabaseError(
            `No se pudo cargar la tabla ${table}.`,
            "records"
        );
    }
}

function renderDatabaseTables() {
    updateDatabaseNavigation();
    updateDatabaseHeader();
    updateCreateRecordButton();
    rootDatabase.querySelector("#buscador").placeholder = "Buscar por nombre de tabla...";

    const query = rootDatabase.querySelector("#buscador").value.toLowerCase().trim();
    const tables = databaseTables.filter(table =>
        table.name.toLowerCase().includes(query)
    );
    const grid = rootDatabase.querySelector("#grid");
    grid.innerHTML = "";

    if (tables.length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay tablas que coincidan con la búsqueda.
            </div>
        `;
        return;
    }

    tables.forEach(table => {
        const card = document.createElement("button");
        card.className = "database-table-card";
        card.type = "button";
        card.dataset.table = table.name;
        card.innerHTML = `
            <span class="database-table-name"></span>
            <span class="database-table-count"></span>
        `;
        card.querySelector(".database-table-name").textContent = capitalize(table.name);
        card.querySelector(".database-table-count").textContent =
            `${table.count} ${table.count === 1 ? "registro" : "registros"}`;
        grid.appendChild(card);
    });
}

function renderDatabaseRecords() {
    if (!tableData) {
        return;
    }

    const query = rootDatabase.querySelector("#buscador").value.toLowerCase().trim();
    visibleRecords = tableData.records.filter(record =>
        Object.values(record).some(value =>
            String(value ?? "").toLowerCase().includes(query)
        )
    );

    const grid = rootDatabase.querySelector("#grid");
    grid.innerHTML = "";

    if (visibleRecords.length === 0) {
        grid.innerHTML = `
            <div class="estado-vacio">
                No hay registros que coincidan con la búsqueda.
            </div>
        `;
        return;
    }

    const primaryKeys = tableData.columns.filter(column => column.primaryKey);
    const primaryKey = primaryKeys.length === 1 ? primaryKeys[0] : null;
    const relatedColumns = recordDisplayColumns[currentTable] || {};
    const hiddenColumns = recordHiddenColumns[currentTable] || [];
    const displayColumns = tableData.columns
        .filter(column => !hiddenColumns.includes(column.name))
        .map(column => {
            const name = relatedColumns[column.name];
            return {
                ...column,
                name: name || column.name,
                label: name ? name.replaceAll("_", " ") : column.name
            };
        });
    const wrapper = document.createElement("div");
    wrapper.className = "database-records-wrap";
    const table = document.createElement("table");
    table.className = "database-records";

    const header = document.createElement("thead");
    const headerRow = document.createElement("tr");
    displayColumns.forEach(column => {
        const cell = document.createElement("th");
        cell.textContent = capitalize(column.label);
        headerRow.appendChild(cell);
    });
    if (primaryKey) {
        const actionsHeader = document.createElement("th");
        actionsHeader.textContent = "Acciones";
        actionsHeader.className = "database-actions-heading";
        headerRow.appendChild(actionsHeader);
    }
    header.appendChild(headerRow);
    table.appendChild(header);

    const body = document.createElement("tbody");
    visibleRecords.forEach((record, index) => {
        const row = document.createElement("tr");
        row.dataset.recordIndex = index;

        displayColumns.forEach(column => {
            const cell = document.createElement("td");
            cell.textContent = record[column.name] == null
                ? "—"
                : String(record[column.name]);
            row.appendChild(cell);
        });

        if (primaryKey) {
            const actionsCell = document.createElement("td");
            actionsCell.className = "database-record-actions";
            const actions = document.createElement("div");
            actions.innerHTML = `
                <button class="btn-hoja" type="button" data-record-action="edit">Editar</button>
                <button class="btn-hoja eliminar" type="button" data-record-action="delete">Eliminar</button>
            `;
            actionsCell.appendChild(actions);
            row.appendChild(actionsCell);
        }

        body.appendChild(row);
    });
    table.appendChild(body);
    wrapper.appendChild(table);
    grid.appendChild(wrapper);
}

function filterDatabase() {
    if (currentTable) {
        if (tableData) {
            renderDatabaseRecords();
        }
        return;
    }

    renderDatabaseTables();
}

function manageDatabaseClick(event) {
    if (event.target.closest("[data-database-home]")) {
        openDatabaseHome(true);
        return;
    }

    const tableCard = event.target.closest("[data-table]");
    if (tableCard) {
        openDatabaseTable(tableCard.dataset.table, true);
        return;
    }

    const retry = event.target.closest("[data-database-retry]");
    if (retry) {
        retryDatabaseLoad();
        return;
    }

    const action = event.target.closest("[data-record-action]");
    if (!action) {
        return;
    }

    const row = action.closest("[data-record-index]");
    const record = visibleRecords[Number(row.dataset.recordIndex)];
    if (!record) {
        return;
    }
    if (action.dataset.recordAction === "edit") {
        openRecordModal("update", record);
    } else {
        deleteDatabaseRecord(record);
    }
}

function manageDatabaseMouseButton(event) {
    if (event.button === 3) {
        navigateDatabase(-1);
    } else if (event.button === 4) {
        navigateDatabase(1);
    }
}

function openDatabaseTable(table, saveHistory) {
    if (saveHistory) {
        saveDatabaseHistory(table);
    }
    loadDatabaseRecords(table);
}

function openDatabaseHome(saveHistory) {
    if (saveHistory && currentTable) {
        saveDatabaseHistory(null);
    }
    databaseRequestId++;
    currentTable = null;
    tableData = null;
    visibleRecords = [];
    rootDatabase.querySelector("#buscador").value = "";
    renderDatabaseTables();
}

function navigateDatabase(direction) {
    const nextPosition = databaseHistoryPosition + direction;
    if (nextPosition < 0 || nextPosition >= databaseHistory.length) {
        return;
    }

    databaseHistoryPosition = nextPosition;
    const state = databaseHistory[databaseHistoryPosition];
    if (state.table) {
        openDatabaseTable(state.table, false);
    } else {
        openDatabaseHome(false);
    }
}

function saveDatabaseHistory(table) {
    databaseHistory = databaseHistory.slice(0, databaseHistoryPosition + 1);
    databaseHistory.push({ table });
    databaseHistoryPosition++;
}

function updateDatabaseNavigation() {
    if (!rootDatabase) {
        return;
    }

    const back = rootDatabase.querySelector("#back");
    const forward = rootDatabase.querySelector("#forward");
    back.disabled = databaseHistoryPosition <= 0;
    forward.disabled = databaseHistoryPosition >= databaseHistory.length - 1;

    if (!currentTable) {
        indicatorDatabase.innerHTML = `
            <span class="breadcrumb-item active">Tablas</span>
        `;
        return;
    }

    indicatorDatabase.innerHTML = `
        <a class="breadcrumb-item link" data-database-home>Tablas</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item active"></span>
    `;
    indicatorDatabase.querySelector(".breadcrumb-item.active").textContent = currentTable;
}

function updateDatabaseHeader() {
    const header = rootDatabase.querySelector("#database-header");
    header.textContent = currentTable
        ? `REGISTROS: ${currentTable.toUpperCase()}`
        : "TABLAS";
}

function updateCreateRecordButton() {
    const button = rootDatabase.querySelector("#new-item");
    button.hidden = !currentTable;
    button.querySelector("span").textContent = "Nuevo registro";
}

async function openRecordModal(mode, record = {}) {
    if (!tableData) {
        return;
    }

    const table = currentTable;
    const data = tableData;
    const relationOptions = {};
    try {
        for (const column of data.columns) {
            const relation = recordRelationFields[table]?.[column.name];
            if (relation) {
                relationOptions[column.name] = await getRelationRecords(
                    relation.table
                );
            }
        }
    } catch (error) {
        console.error("Error cargando opciones de relaciones:", error);
        toast(error.message || "No se pudieron cargar las opciones.", true);
        return;
    }
    if (currentTable !== table || tableData !== data) {
        return;
    }

    const form = rootDatabase.querySelector("#database-record-form");
    const fields = rootDatabase.querySelector("#database-record-fields");
    const title = rootDatabase.querySelector("#database-record-title");
    form.dataset.mode = mode;
    title.textContent = mode === "create"
        ? `NUEVO REGISTRO: ${currentTable.toUpperCase()}`
        : `EDITAR REGISTRO: ${currentTable.toUpperCase()}`;
    openModal("database-record");
    fields.innerHTML = "";
    if (mode === "update") {
        form.dataset.recordIndex = String(visibleRecords.indexOf(record));
    } else {
        delete form.dataset.recordIndex;
    }

    data.columns.forEach(column => {
        if ((recordHiddenColumns[table] || []).includes(column.name)) {
            return;
        }
        if (column.primaryKey && (mode === "update" || column.name === "uuid")) {
            return;
        }

        const relation = recordRelationFields[table]?.[column.name];
        const group = document.createElement("div");
        group.className = "campo-grupo";
        const label = document.createElement("label");
        label.className = "campo-label";
        label.textContent = relation
            ? relation.label.toUpperCase()
            : column.name;

        const input = document.createElement(relation ? "select" : "input");
        input.className = "campo-input";
        input.name = column.name;
        input.required = column.notNull
            && !(mode === "create" && column.default !== null);
        if (relation) {
            const placeholder = document.createElement("option");
            placeholder.value = "";
            placeholder.textContent = `-- Seleccionar ${relation.label.toLowerCase()} --`;
            input.appendChild(placeholder);

            const options = [...relationOptions[column.name]].sort(
                (first, second) =>
                    String(first[relation.textKey]).localeCompare(
                        String(second[relation.textKey]),
                        "es",
                        { sensitivity: "base" }
                    )
            );
            options.forEach(optionRecord => {
                const option = document.createElement("option");
                option.value = optionRecord[relation.valueKey];
                option.textContent = optionRecord[relation.textKey];
                input.appendChild(option);
            });
        } else {
            input.dataset.columnType = column.type;
            input.type = getDatabaseInputType(column.type);
            if (input.type === "number") {
                input.step = /INT/i.test(column.type) ? "1" : "any";
            }
            if (mode === "create" && column.default !== null) {
                input.placeholder = `Por defecto: ${column.default}`;
            }
        }
        input.value = record[column.name] ?? "";

        label.htmlFor = `database-field-${column.name}`;
        input.id = label.htmlFor;
        group.append(label, input);
        fields.appendChild(group);
    });

    fields.querySelector("input, select")?.focus();
}

async function getRelationRecords(tableName) {
    if (!relationRecordsCache[tableName]) {
        const response = await API.getDatabaseRecords(tableName);
        relationRecordsCache[tableName] = response.records;
    }
    return relationRecordsCache[tableName];
}

function getDatabaseInputType(type) {
    if (/INT|REAL|FLOAT|DOUBLE|NUMERIC|DECIMAL/i.test(type)) {
        return "number";
    }
    if (/DATE/i.test(type)) {
        return "date";
    }
    return "text";
}

async function saveDatabaseRecord(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = form.querySelector('[type="submit"]');
    const data = {};

    form.querySelectorAll("[name]").forEach(input => {
        const value = input.value.trim();
        if (form.dataset.mode === "create" && value === "" && input.placeholder) {
            return;
        }
        if (value === "") {
            data[input.name] = null;
        } else if (input.type === "number") {
            data[input.name] = Number(value);
        } else {
            data[input.name] = value;
        }
    });

    submitButton.disabled = true;
    try {
        if (form.dataset.mode === "create") {
            await API.createDatabaseRecord(currentTable, data);
        } else {
            const primaryKey = tableData.columns.find(column => column.primaryKey);
            const record = form.dataset.recordIndex !== undefined
                ? visibleRecords[Number(form.dataset.recordIndex)]
                : null;
            await API.updateDatabaseRecord(
                currentTable,
                primaryKey.name,
                record[primaryKey.name],
                data
            );
        }

        closeModal("database-record");
        toast(form.dataset.mode === "create"
            ? "Registro creado."
            : "Registro actualizado.");
        await refreshDatabaseTable();
    } catch (error) {
        console.error("Error guardando el registro:", error);
        toast(error.message || "No se pudo guardar el registro.", true);
    } finally {
        submitButton.disabled = false;
    }
}

async function deleteDatabaseRecord(record) {
    const primaryKey = tableData.columns.find(column => column.primaryKey);
    const confirmed = await confirmar(
        "Eliminar registro",
        `¿Seguro que deseas eliminar este registro de ${currentTable}?`
    );
    if (!confirmed) {
        return;
    }

    try {
        await API.deleteDatabaseRecord(
            currentTable,
            primaryKey.name,
            record[primaryKey.name]
        );
        toast("Registro eliminado.");
        await refreshDatabaseTable();
    } catch (error) {
        console.error("Error eliminando el registro:", error);
        toast(error.message || "No se pudo eliminar el registro.", true);
    }
}

async function refreshDatabaseTable() {
    relationRecordsCache = {};
    await loadDatabaseTables();
    await loadDatabaseRecords(currentTable);
}

function showDatabaseError(message, retryType) {
    const grid = rootDatabase.querySelector("#grid");
    grid.innerHTML = `
        <div class="estado-vacio database-error">
            <span></span>
            <button class="btn-hoja" type="button" data-database-retry>
                Reintentar
            </button>
        </div>
    `;
    grid.querySelector("span").textContent = message;
    rootDatabase.dataset.retryDatabaseLoad = retryType;
}

function retryDatabaseLoad() {
    if (rootDatabase.dataset.retryDatabaseLoad === "tables") {
        loadDatabaseTables();
    } else if (currentTable) {
        loadDatabaseRecords(currentTable);
    }
}
