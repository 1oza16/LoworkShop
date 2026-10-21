let rootStatistics = null;
let controllerStatistics = null;
let statisticsRecords = [];
let statisticsCharts = [];

const statisticsNumberFormat = new Intl.NumberFormat("es-ES");

function Statistics() {

    function mount(root) {
        rootStatistics = root;
        root.classList.add("statistics-content");
        controllerStatistics = new AbortController();
        const signal = controllerStatistics.signal;
        const year = new Date().getFullYear();

        root.querySelector("#statistics-date-from").value = `${year}-01-01`;
        root.querySelector("#statistics-date-to").value = `${year}-12-31`;
        root.querySelector("#statistics-brand").addEventListener(
            "change",
            () => {
                updateStatisticsModelOptions(true);
                updateStatistics();
            },
            { signal }
        );

        root.querySelectorAll(
            "#statistics-date-from, #statistics-date-to, " +
            "#statistics-model, #statistics-client"
        ).forEach((input) => {
            input.addEventListener("change", updateStatistics, { signal });
        });

        loadStatistics(signal);
    } // mount()

    function unmount() {
        controllerStatistics?.abort();
        destroyStatisticsCharts();

        rootStatistics?.classList.remove("statistics-content");
        controllerStatistics = null;
        rootStatistics = null;
        statisticsRecords = [];
    } // unmount()

    return {
        mount,
        unmount
    };

} // Statistics()

async function loadStatistics(signal) {
    const root = rootStatistics;

    try {
        const response = await API.getStatisticsData(signal);
        if (signal.aborted || rootStatistics !== root) {
            return;
        }

        statisticsRecords = response.records;
        populateStatisticsFilters();
        root.querySelector("#statistics-state").textContent =
            `${statisticsNumberFormat.format(statisticsRecords.length)} fichas cargadas`;
        updateStatistics();
    } catch (error) {
        if (signal.aborted) {
            return;
        }

        console.error("Error cargando las estadísticas:", error);
        root.querySelector("#statistics-state").textContent =
            "No se pudieron cargar las estadísticas.";
    }
}

function populateStatisticsFilters() {
    const brands = new Map();
    const clients = new Map();

    statisticsRecords.forEach((record) => {
        if (record.marca_uuid && record.marca) {
            brands.set(record.marca_uuid, record.marca);
        }
        if (record.cliente_uuid && record.cliente) {
            clients.set(record.cliente_uuid, record.cliente);
        }
    });

    setStatisticsOptions(
        rootStatistics.querySelector("#statistics-brand"),
        brands,
        "Todas las marcas"
    );
    setStatisticsOptions(
        rootStatistics.querySelector("#statistics-client"),
        clients,
        "Todos los clientes"
    );
    updateStatisticsModelOptions(false);
}

function setStatisticsOptions(select, options, defaultLabel) {
    select.replaceChildren(new Option(defaultLabel, ""));

    [...options.entries()]
        .sort((first, second) => first[1].localeCompare(second[1], "es"))
        .forEach(([value, label]) => {
            select.add(new Option(label, value));
        });
}

function updateStatisticsModelOptions(resetSelection) {
    const brandId = rootStatistics.querySelector("#statistics-brand").value;
    const models = new Map();

    statisticsRecords.forEach((record) => {
        if (
            record.modelo_uuid &&
            record.modelo &&
            (!brandId || record.marca_uuid === brandId)
        ) {
            models.set(
                record.modelo_uuid,
                brandId ? record.modelo : `${record.marca || "Sin marca"} · ${record.modelo}`
            );
        }
    });

    const select = rootStatistics.querySelector("#statistics-model");
    setStatisticsOptions(select, models, "Todos los modelos");
    if (resetSelection) {
        select.value = "";
    }
}

function updateStatistics() {
    if (!rootStatistics) {
        return;
    }

    const filters = {
        dateFrom: rootStatistics.querySelector("#statistics-date-from").value,
        dateTo: rootStatistics.querySelector("#statistics-date-to").value,
        brand: rootStatistics.querySelector("#statistics-brand").value,
        model: rootStatistics.querySelector("#statistics-model").value,
        client: rootStatistics.querySelector("#statistics-client").value
    };
    const records = statisticsRecords.filter((record) => {
        const date = String(record.fecha || "").slice(0, 10);
        return (
            (!filters.dateFrom || (date && date >= filters.dateFrom)) &&
            (!filters.dateTo || (date && date <= filters.dateTo)) &&
            (!filters.brand || record.marca_uuid === filters.brand) &&
            (!filters.model || record.modelo_uuid === filters.model) &&
            (!filters.client || record.cliente_uuid === filters.client)
        );
    });

    updateStatisticsKpis(records);
    renderStatisticsCharts(records);
}

function updateStatisticsKpis(records) {
    const clients = new Set(
        records.map((record) => record.cliente_uuid).filter(Boolean)
    );
    const vehicles = new Set(
        records
            .map((record) => String(record.matricula || "").trim().toUpperCase())
            .filter(Boolean)
    );
    const mileages = records
        .map((record) => Number(record.kilometraje))
        .filter((value, index) => (
            records[index].kilometraje !== null &&
            records[index].kilometraje !== "" &&
            Number.isFinite(value)
        ));
    const average = mileages.length
        ? mileages.reduce((sum, value) => sum + value, 0) / mileages.length
        : null;

    rootStatistics.querySelector("#statistics-record-count").textContent =
        statisticsNumberFormat.format(records.length);
    rootStatistics.querySelector("#statistics-client-count").textContent =
        statisticsNumberFormat.format(clients.size);
    rootStatistics.querySelector("#statistics-vehicle-count").textContent =
        statisticsNumberFormat.format(vehicles.size);
    rootStatistics.querySelector("#statistics-average-mileage").textContent =
        average === null
            ? "—"
            : `${statisticsNumberFormat.format(Math.round(average))} km`;
}

function renderStatisticsCharts(records) {
    destroyStatisticsCharts();

    const monthlyCounts = new Map();
    const brandCounts = new Map();
    const modelCounts = new Map();
    const mileages = [];

    records.forEach((record) => {
        const month = String(record.fecha || "").slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(month)) {
            monthlyCounts.set(month, (monthlyCounts.get(month) || 0) + 1);
        }

        const brand = record.marca || "Sin marca";
        brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);

        const model = record.modelo
            ? `${record.marca || "Sin marca"} · ${record.modelo}`
            : "Sin modelo";
        modelCounts.set(model, (modelCounts.get(model) || 0) + 1);

        const mileage = Number(record.kilometraje);
        if (
            record.kilometraje !== null &&
            record.kilometraje !== "" &&
            Number.isFinite(mileage)
        ) {
            mileages.push(mileage);
        }
    });

    const months = [...monthlyCounts.keys()].sort();
    createStatisticsChart("statistics-monthly-chart", "line", {
        labels: months.map((month) => {
            const [year, number] = month.split("-").map(Number);
            return new Date(year, number - 1, 1).toLocaleDateString(
                "es-ES",
                { month: "short", year: "numeric" }
            );
        }),
        datasets: [{
            label: "Fichas",
            data: months.map((month) => monthlyCounts.get(month)),
            borderColor: "#1e5aa8",
            backgroundColor: "rgba(30, 90, 168, 0.15)",
            fill: true,
            tension: 0.25
        }]
    });

    const brands = [...brandCounts.entries()].sort((first, second) =>
        second[1] - first[1]
    );
    createStatisticsChart("statistics-brand-chart", "doughnut", {
        labels: brands.map(([name]) => name),
        datasets: [{
            data: brands.map(([, count]) => count),
            backgroundColor: [
                "#1e5aa8", "#2d5016", "#c41e3a", "#e7a928",
                "#6f42c1", "#18a2a8", "#6c757d", "#e0833b"
            ]
        }]
    });

    const models = [...modelCounts.entries()].sort((first, second) =>
        second[1] - first[1]
    );
    const topModels = models.slice(0, 8);
    if (models.length > 8) {
        topModels.push([
            "Otros",
            models.slice(8).reduce((sum, [, count]) => sum + count, 0)
        ]);
    }
    createStatisticsChart("statistics-model-chart", "bar", {
        labels: topModels.map(([name]) => name),
        datasets: [{
            label: "Fichas",
            data: topModels.map(([, count]) => count),
            backgroundColor: "#1e5aa8"
        }]
    }, {
        indexAxis: "y"
    });

    const mileageCounts = new Map();
    mileages.forEach((mileage) => {
        const range = mileage < 0
            ? -1
            : Math.floor(mileage / 25000);
        mileageCounts.set(range, (mileageCounts.get(range) || 0) + 1);
    });
    const mileageRanges = [...mileageCounts.keys()].sort((first, second) =>
        first - second
    );
    createStatisticsChart("statistics-mileage-chart", "bar", {
        labels: mileageRanges.map((range) => (
            range < 0
                ? "Menos de 0 km"
                : `${statisticsNumberFormat.format(range * 25000)}–` +
                  `${statisticsNumberFormat.format((range + 1) * 25000 - 1)} km`
        )),
        datasets: [{
            label: "Fichas",
            data: mileageRanges.map((range) => mileageCounts.get(range)),
            backgroundColor: "#2d5016"
        }]
    });
}

function createStatisticsChart(id, type, data, extraOptions = {}) {
    const valueAxis = extraOptions.indexAxis === "y" ? "x" : "y";
    const chart = new Chart(rootStatistics.querySelector(`#${id}`), {
        type,
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                [valueAxis]: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0,
                        stepSize: 1
                    }
                }
            },
            ...extraOptions
        }
    });
    statisticsCharts.push(chart);
}

function destroyStatisticsCharts() {
    statisticsCharts.forEach((chart) => chart.destroy());
    statisticsCharts = [];
}