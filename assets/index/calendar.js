let calendarInstance = null;

function Calendar() {
    let root = null;
    let controller = null;
    let eventTrigger = null;
    let currentBreakpoint = null;

    function mount(viewRoot) {
        root = viewRoot;
        root.classList.add("calendar-page");
        controller = new AbortController();
        currentBreakpoint = getCalendarBreakpoint(window.innerWidth);

        const calendarElement = root.querySelector("#calendar-view");
        const eventOverlay = root.querySelector("#overlay-calendar-event");
        let touchStart = null;

        root.addEventListener("click", (event) => {
            if (
                event.target === eventOverlay ||
                event.target.closest(".btn-cancel")
            ) {
                closeEventDetails(eventTrigger);
            }
        }, { signal: controller.signal });

        root.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && eventOverlay.classList.contains("visible")) {
                closeEventDetails(eventTrigger);
            }
        }, { signal: controller.signal });

        calendarElement.addEventListener("touchstart", (event) => {
            if (
                currentBreakpoint === "desktop" ||
                event.touches.length !== 1 ||
                !(event.target instanceof Element) ||
                event.target.closest(".fc-toolbar, .fc-event, .fc-button, .fc-more-link")
            ) {
                touchStart = null;
                return;
            }

            const touch = event.touches[0];
            touchStart = { x: touch.clientX, y: touch.clientY };
        }, { passive: true, signal: controller.signal });

        calendarElement.addEventListener("touchend", (event) => {
            if (!touchStart)
                return;

            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStart.x;
            const deltaY = touch.clientY - touchStart.y;
            touchStart = null;

            if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25)
                return;

            if (deltaX < 0)
                calendarInstance.prev();
            else
                calendarInstance.next();
        }, { passive: true, signal: controller.signal });

        calendarElement.addEventListener("touchcancel", () => {
            touchStart = null;
        }, { signal: controller.signal });

        calendarInstance = new FullCalendar.Calendar(calendarElement, {
            locale: "es",
            initialView: getCalendarViewForBreakpoint(currentBreakpoint),
            headerToolbar: {
                left: "prev,next today",
                center: "title",
                right: "timeGridDay,timeGridWeek,dayGridMonth"
            },
            buttonText: {
                today: "Hoy",
                month: "Mes",
                week: "Semana",
                day: "Día"
            },
            dayMaxEvents: true,
            events: createSampleCalendarEvents(),
            eventContent: (info) => {
                const content = document.createElement("span");
                content.className = "calendar-event-content";

                const time = document.createElement("span");
                time.className = "calendar-event-time";
                time.textContent = info.timeText;

                const title = document.createElement("span");
                title.className = "calendar-event-title";
                title.textContent = info.event.title;

                const plate = document.createElement("span");
                plate.className = "calendar-event-plate";
                plate.textContent = info.event.extendedProps.vehicle
                    ?.split(" · ")
                    .pop() || info.event.title.split(" · ").pop();

                content.append(time, title, plate);
                return { domNodes: [content] };
            },
            eventClick: (info) => {
                info.jsEvent.preventDefault();
                eventTrigger = info.el;
                showEventDetails(info.event, eventOverlay);
            }
        });

        calendarInstance.render();

        window.addEventListener("resize", () => {
            const nextBreakpoint = getCalendarBreakpoint(window.innerWidth);
            if (nextBreakpoint === currentBreakpoint)
                return;

            currentBreakpoint = nextBreakpoint;
            calendarInstance.changeView(
                getCalendarViewForBreakpoint(currentBreakpoint),
                calendarInstance.getDate()
            );
        }, { signal: controller.signal });
    } // mount()

    function unmount() {
        controller?.abort();
        calendarInstance?.destroy();
        root?.classList.remove("calendar-page");

        calendarInstance = null;
        controller = null;
        eventTrigger = null;
        currentBreakpoint = null;
        root = null;
    } // unmount()

    return {
        mount,
        unmount
    };
} // Calendar()

function getCalendarBreakpoint(width) {
    if (width <= 520)
        return "mobile";
    if (width <= 767)
        return "tablet";
    return "desktop";
} // getCalendarBreakpoint()

function getCalendarViewForBreakpoint(breakpoint) {
    if (breakpoint === "mobile")
        return "timeGridDay";
    if (breakpoint === "tablet")
        return "timeGridWeek";
    return "dayGridMonth";
} // getCalendarViewForBreakpoint()

function createSampleCalendarEvents() {
    return [
        {
            title: "Revisión y cambio de aceite · 2468 ABC",
            start: createCalendarDate(0, 9),
            end: createCalendarDate(0, 11),
            backgroundColor: "var(--azul)",
            extendedProps: {
                type: "Revisión",
                client: "Lucía Martín",
                vehicle: "Seat León · 2468 ABC",
                description: "Revisión general y cambio de aceite."
            }
        },
        {
            title: "Diagnóstico de motor · 1357 DEF",
            start: createCalendarDate(0, 14),
            end: createCalendarDate(0, 15, 30),
            backgroundColor: "var(--rojo)",
            extendedProps: {
                type: "Diagnóstico",
                client: "Marcos Ruiz",
                vehicle: "Ford Focus · 1357 DEF",
                description: "Comprobar el testigo de avería del motor."
            }
        },
        {
            title: "Entrega de vehículo · 9753 GHT",
            start: createCalendarDate(1, 10),
            end: createCalendarDate(1, 10, 30),
            backgroundColor: "var(--verde)",
            extendedProps: {
                type: "Entrega",
                client: "Elena Torres",
                vehicle: "Toyota Corolla · 9753 GHT",
                description: "Entrega prevista tras finalizar la reparación."
            }
        },
        {
            title: "Recepción de vehículo · 8642 BCD",
            start: createCalendarDate(2),
            allDay: true,
            backgroundColor: "var(--azul-osc)",
            extendedProps: {
                type: "Recepción",
                client: "Daniel Pérez",
                vehicle: "Volkswagen Golf · 8642 BCD",
                description: "Recepción del vehículo para valorar los daños."
            }
        },
        {
            title: "Reparación de frenos · 7531 FGH",
            start: createCalendarDate(-2, 12),
            end: createCalendarDate(-2, 14),
            backgroundColor: "var(--rojo-osc)",
            extendedProps: {
                type: "Reparación",
                client: "Carmen López",
                vehicle: "Renault Clio · 7531 FGH",
                description: "Sustitución de pastillas de freno delanteras."
            }
        },
        {
            title: "Revisión pre-ITV · 6420 JKL",
            start: createCalendarDate(5, 9, 30),
            end: createCalendarDate(5, 11),
            backgroundColor: "var(--verde-osc)",
            extendedProps: {
                type: "Revisión",
                client: "Javier Sánchez",
                vehicle: "Peugeot 308 · 6420 JKL",
                description: "Comprobación de los puntos principales para ITV."
            }
        }
    ];
} // createSampleCalendarEvents()

function createCalendarDate(dayOffset, hours = 0, minutes = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hours, minutes, 0, 0);

    const pad = (value) => String(value).padStart(2, "0");
    const datePart = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");

    return hours === 0 && minutes === 0
        ? datePart
        : `${datePart}T${pad(hours)}:${pad(minutes)}:00`;
} // createCalendarDate()

function showEventDetails(event, overlay) {
    const dateFormatter = new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
    const timeFormatter = new Intl.DateTimeFormat("es-ES", {
        hour: "2-digit",
        minute: "2-digit"
    });
    const start = event.start;
    const end = event.end;
    const timeLabel = event.allDay
        ? "Todo el día"
        : start && end
            ? `De ${timeFormatter.format(start)} a ${timeFormatter.format(end)}`
            : start
                ? timeFormatter.format(start)
                : "Hora no definida";
    const dateLabel = start
        ? `${dateFormatter.format(start)} · ${timeLabel}`
        : "Fecha no definida";
    const details = event.extendedProps;

    overlay.querySelector("#calendar-event-title").textContent = event.title;
    overlay.querySelector("#calendar-event-type").textContent = details.type;
    overlay.querySelector("#calendar-event-date").textContent = dateLabel;
    overlay.querySelector("#calendar-event-client").textContent = details.client;
    overlay.querySelector("#calendar-event-vehicle").textContent = details.vehicle;
    overlay.querySelector("#calendar-event-description").textContent =
        details.description;
    openModal("calendar-event");
    overlay.querySelector(".btn-cancel").focus();
} // showEventDetails()

function closeEventDetails(trigger) {
    closeModal("calendar-event");
    trigger?.focus();
}