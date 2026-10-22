
"use strict";

const STORAGE_KEY = "weekly-service-schedule-v2";
const NOTIFIED_KEY = "weekly-service-schedule-notified-v2";
const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 52;

const $ = (id) => document.getElementById(id);

const ui = {
  calendar: $("calendar"),
  weekTitle: $("weekTitle"),
  totalCount: $("totalCount"),
  pestCount: $("pestCount"),
  meetingCount: $("meetingCount"),
  upcomingCount: $("upcomingCount"),
  alarmList: $("alarmList"),
  categoryFilter: $("categoryFilter"),
  searchInput: $("searchInput"),
  dialog: $("appointmentDialog"),
  form: $("appointmentForm"),
  dialogTitle: $("dialogTitle"),
  appointmentId: $("appointmentId"),
  titleInput: $("titleInput"),
  categoryInput: $("categoryInput"),
  locationInput: $("locationInput"),
  dateInput: $("dateInput"),
  startInput: $("startInput"),
  endInput: $("endInput"),
  notesInput: $("notesInput"),
  formError: $("formError"),
  deleteBtn: $("deleteBtn"),
  toast: $("toast")
};

let currentWeek = startOfWeek(new Date());
let events = loadEvents();
let notified = loadNotified();
let chart = null;
let toastTimer;

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const offset = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}

function addDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function formatDate(date, options = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-PH", options).format(date);
}

function minutes(time) {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function formatTime(time) {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function categoryLabel(category) {
  return {
    pest: "Pest Control",
    meeting: "Meeting",
    personal: "Personal"
  }[category] || "Other";
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function createSamples() {
  const monday = startOfWeek(new Date());

  const samples = [
    [0, "Day Off — Gilbert", "personal", "10:00", "12:00", "", "Personal day off."],
    [1, "Travel back to Bohol", "personal", "10:00", "12:00", "Bohol", ""],
    [1, "Yomie Paroa Residence", "pest", "14:00", "15:00", "Paroa", "Pest control service visit."],
    [2, "Pest Control Seminar Training", "meeting", "09:00", "10:00", "", "Training / seminar."],
    [2, "Slaughter House", "pest", "13:00", "15:00", "", "Pest control service visit."],
    [3, "Bigno Residence", "pest", "14:00", "15:00", "", "Pest control service visit."],
    [4, "Gilbert — Day Off", "personal", "10:00", "12:00", "", "Personal day off."],
    [5, "Padel at Palms", "personal", "10:00", "11:00", "The Palms", ""],
    [5, "The Italian", "personal", "12:00", "13:00", "", ""]
  ];

  return samples.map((item, index) => ({
    id: `sample-${Date.now()}-${index}`,
    date: dateKey(addDays(monday, item[0])),
    title: item[1],
    category: item[2],
    start: item[3],
    end: item[4],
    location: item[5],
    notes: item[6]
  }));
}

function loadEvents() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (error) {
    console.error("Could not load appointments:", error);
  }

  const samples = createSamples();
  saveEventsToStorage(samples);
  return samples;
}

function saveEventsToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch (error) {
    console.error("Could not save appointments:", error);
    showToast("Could not save. Check your browser storage settings.");
    return false;
  }
}

function saveEvents() {
  return saveEventsToStorage(events);
}

function loadNotified() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]");
    return new Set(Array.isArray(saved) ? saved : []);
  } catch {
    return new Set();
  }
}

function saveNotified() {
  try {
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
  } catch (error) {
    console.warn("Could not save notification history:", error);
  }
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 2800);
}

function weekDates() {
  return Array.from({ length: 7 }, (_, index) => addDays(currentWeek, index));
}

function weeklyEvents() {
  const start = dateKey(currentWeek);
  const end = dateKey(addDays(currentWeek, 6));
  return events.filter((event) => event.date >= start && event.date <= end);
}

function filteredEvents() {
  const query = ui.searchInput.value.trim().toLowerCase();
  const category = ui.categoryFilter.value;

  return events.filter((event) => {
    const categoryMatches = category === "all" || event.category === category;
    const searchable = [
      event.title,
      event.location,
      event.notes,
      categoryLabel(event.category)
    ].join(" ").toLowerCase();

    return categoryMatches && (!query || searchable.includes(query));
  });
}

function render() {
  renderWeekTitle();
  renderStats();
  renderCalendar();
  renderAlarms();
  renderChart();
}

function renderWeekTitle() {
  const end = addDays(currentWeek, 6);
  const startText = formatDate(currentWeek, { month: "short", day: "numeric" });
  const endText = formatDate(end, { month: "short", day: "numeric", year: "numeric" });
  ui.weekTitle.textContent = `${startText} – ${endText}`;
}

function renderStats() {
  const list = weeklyEvents();

  ui.totalCount.textContent = list.length;
  ui.pestCount.textContent = list.filter((e) => e.category === "pest").length;
  ui.meetingCount.textContent = list.filter((e) => e.category === "meeting").length;

  const today = parseDate(dateKey(new Date()));
  ui.upcomingCount.textContent = events.filter((event) => {
    const difference = Math.round(
      (parseDate(event.date) - today) / 86400000
    );
    return difference >= 0 && difference <= 5;
  }).length;
}

function renderCalendar() {
  const dates = weekDates();
  const list = filteredEvents();
  const byDate = new Map();

  list.forEach((event) => {
    if (!byDate.has(event.date)) byDate.set(event.date, []);
    byDate.get(event.date).push(event);
  });

  let html = '<div class="calendar-head"></div>';

  dates.forEach((date) => {
    const today = dateKey(date) === dateKey(new Date());
    html += `
      <div class="calendar-head ${today ? "today" : ""}">
        <span class="day-name">${formatDate(date, { weekday: "short" })}</span>
        <span class="day-number">${date.getDate()}</span>
      </div>`;
  });

  html += '<div class="time-rail">';

  for (let hour = START_HOUR; hour < END_HOUR; hour++) {
    const temp = new Date();
    temp.setHours(hour, 0, 0, 0);
    const label = new Intl.DateTimeFormat("en-PH", {
      hour: "numeric"
    }).format(temp);

    html += `<div class="time-label"><span>${label}</span></div>`;
  }

  html += "</div>";

  dates.forEach((date) => {
    const key = dateKey(date);
    const today = key === dateKey(new Date());
    const dayEvents = (byDate.get(key) || [])
      .slice()
      .sort((a, b) => a.start.localeCompare(b.start));

    html += `<div class="day-column ${today ? "today-column" : ""}" data-date="${key}">`;

    dayEvents.forEach((event) => {
      const start = minutes(event.start);
      const end = minutes(event.end);

      if (end <= START_HOUR * 60 || start >= END_HOUR * 60) return;

      const top = Math.max(0, (start - START_HOUR * 60) * HOUR_HEIGHT / 60);
      const bottom = Math.min(
        (END_HOUR - START_HOUR) * HOUR_HEIGHT,
        (end - START_HOUR * 60) * HOUR_HEIGHT / 60
      );
      const height = Math.max(27, bottom - top);

      html += `
        <button type="button"
          class="event-card ${escapeHTML(event.category || "personal")}"
          style="top:${top}px;height:${height}px"
          data-event-id="${escapeHTML(event.id)}"
          title="${escapeHTML(event.title)}">
          <strong>${escapeHTML(event.title)}</strong>
          <span>${formatTime(event.start)}–${formatTime(event.end)}</span>
          ${event.location ? `<span>${escapeHTML(event.location)}</span>` : ""}
        </button>`;
    });

    html += "</div>";
  });

  if (!list.length) {
    html += '<div class="calendar-empty">No appointments match your search or filter.</div>';
  }

  ui.calendar.innerHTML = html;

  ui.calendar.querySelectorAll("[data-event-id]").forEach((button) => {
    button.addEventListener("click", () => editAppointment(button.dataset.eventId));
  });
}

function renderAlarms() {
  const today = parseDate(dateKey(new Date()));

  const upcoming = events.map((event) => ({
    ...event,
    daysLeft: Math.round((parseDate(event.date) - today) / 86400000)
  }))
    .filter((event) => event.daysLeft >= 0 && event.daysLeft <= 5)
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  if (!upcoming.length) {
    ui.alarmList.innerHTML = `
      <div class="empty-state">
        No appointments in the next five days.<br>
        Add an appointment to see reminders here.
      </div>`;
    return;
  }

  ui.alarmList.innerHTML = upcoming.slice(0, 12).map((event) => {
    const date = parseDate(event.date);
    let label = `${event.daysLeft} DAYS LEFT`;

    if (event.daysLeft === 0) label = "DUE TODAY";
    if (event.daysLeft === 1) label = "1 DAY LEFT";

    const dayText = event.daysLeft === 0
      ? "Today"
      : event.daysLeft === 1
        ? "Tomorrow"
        : `In ${event.daysLeft} days`;

    return `
      <article class="alarm-item">
        <div class="alarm-date">
          <strong>${date.getDate()}</strong>
          <span>${formatDate(date, { month: "short" })}</span>
        </div>
        <div class="alarm-details">
          <strong>${escapeHTML(event.title)}</strong>
          <p>${dayText} · ${formatTime(event.start)} · ${categoryLabel(event.category)}
            ${event.location ? ` · ${escapeHTML(event.location)}` : ""}
          </p>
          <span class="alarm-badge">${label}</span>
        </div>
      </article>`;
  }).join("");
}

function renderChart() {
  const canvas = $("categoryChart");
  const message = $("chartMessage");
  const counts = ["pest", "meeting", "personal"].map((category) =>
    weeklyEvents().filter((event) => event.category === category).length
  );

  if (typeof Chart === "undefined") {
    message.hidden = false;
    return;
  }

  message.hidden = true;

  if (chart) chart.destroy();

  chart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Pest Control", "Meeting", "Personal"],
      datasets: [{
        data: counts,
        backgroundColor: ["#16856b", "#5578d9", "#d28a38"],
        borderColor: "#ffffff",
        borderWidth: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 8,
            padding: 15,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

function openDialog() {
  if (typeof ui.dialog.showModal === "function") {
    ui.dialog.showModal();
  } else {
    ui.dialog.setAttribute("open", "");
  }
  ui.titleInput.focus();
}

function closeDialog() {
  if (typeof ui.dialog.close === "function") {
    ui.dialog.close();
  } else {
    ui.dialog.removeAttribute("open");
  }
}

function addAppointment(date = new Date()) {
  ui.form.reset();
  ui.appointmentId.value = "";
  ui.dialogTitle.textContent = "Add Appointment";
  ui.categoryInput.value = "pest";
  ui.dateInput.value = dateKey(date);
  ui.startInput.value = "09:00";
  ui.endInput.value = "10:00";
  ui.formError.textContent = "";
  ui.deleteBtn.hidden = true;
  openDialog();
}

function editAppointment(id) {
  const event = events.find((item) => item.id === id);
  if (!event) return;

  ui.appointmentId.value = event.id;
  ui.dialogTitle.textContent = "Edit Appointment";
  ui.titleInput.value = event.title;
  ui.categoryInput.value = event.category || "pest";
  ui.locationInput.value = event.location || "";
  ui.dateInput.value = event.date;
  ui.startInput.value = event.start;
  ui.endInput.value = event.end;
  ui.notesInput.value = event.notes || "";
  ui.formError.textContent = "";
  ui.deleteBtn.hidden = false;
  openDialog();
}

function handleSave(event) {
  event.preventDefault();

  const title = ui.titleInput.value.trim();
  const date = ui.dateInput.value;
  const start = ui.startInput.value;
  const end = ui.endInput.value;

  if (!title || !date || !start || !end) {
    ui.formError.textContent = "Please complete all required fields.";
    return;
  }

  if (minutes(end) <= minutes(start)) {
    ui.formError.textContent = "End time must be later than start time.";
    return;
  }

  const id = ui.appointmentId.value ||
    `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const appointment = {
    id,
    title,
    category: ui.categoryInput.value,
    location: ui.locationInput.value.trim(),
    date,
    start,
    end,
    notes: ui.notesInput.value.trim()
  };

  const index = events.findIndex((item) => item.id === id);

  if (index >= 0) {
    events[index] = appointment;
  } else {
    events.push(appointment);
  }

  if (!saveEvents()) return;

  closeDialog();
  render();
  showToast(index >= 0 ? "Appointment updated." : "Appointment saved.");
  checkNotifications();
}

function deleteAppointment() {
  const id = ui.appointmentId.value;
  const event = events.find((item) => item.id === id);
  if (!event) return;

  if (!confirm(`Delete "${event.title}"?`)) return;

  events = events.filter((item) => item.id !== id);
  saveEvents();
  closeDialog();
  render();
  showToast("Appointment deleted.");
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    ui.toast.classList.remove("show");
  }, 2800);
}

function checkNotifications() {
  const today = parseDate(dateKey(new Date()));
  let changed = false;

  events.forEach((event) => {
    const daysLeft = Math.round((parseDate(event.date) - today) / 86400000);

    // Notify once when an appointment is 5, 3, 1, or 0 days away.
    if (![5, 3, 1, 0].includes(daysLeft)) return;

    const key = `${event.id}:${event.date}:${daysLeft}`;
    if (notified.has(key)) return;

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Schedule reminder: ${event.title}`, {
          body: `${daysLeft === 0 ? "Scheduled for today" : `Scheduled in ${daysLeft} days`} at ${formatTime(event.start)}${event.location ? `. Location: ${event.location}` : ""}`,
          tag: key
        });
      } catch (error) {
        console.warn("Notification could not be displayed:", error);
      }
    }

    // Record the reminder to avoid repeating it every minute.
    notified.add(key);
    changed = true;
  });

  if (changed) {
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...notified]));
    } catch (error) {
      console.warn("Could not save notification history:", error);
    }
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    showToast("This browser does not support notifications.");
    return;
  }

  if (Notification.permission === "granted") {
    showToast("Notifications are already enabled.");
    checkNotifications();
    return;
  }

  if (Notification.permission === "denied") {
    showToast("Notifications are blocked in browser settings.");
    return;
  }

  const permission = await Notification.requestPermission();
  showToast(permission === "granted"
    ? "Notifications enabled."
    : "Notifications were not enabled.");

  if (permission === "granted") checkNotifications();
}

// Main controls
$("addBtn").addEventListener("click", () => addAppointment());
$("todayBtn").addEventListener("click", () => {
  currentWeek = startOfWeek(new Date());
  render();
});
$("prevBtn").addEventListener("click", () => {
  currentWeek = addDays(currentWeek, -7);
  render();
});
$("nextBtn").addEventListener("click", () => {
  currentWeek = addDays(currentWeek, 7);
  render();
});

ui.categoryFilter.addEventListener("change", renderCalendar);
ui.searchInput.addEventListener("input", renderCalendar);
ui.form.addEventListener("submit", handleSave);
$("closeBtn").addEventListener("click", closeDialog);
$("cancelBtn").addEventListener("click", closeDialog);
ui.deleteBtn.addEventListener("click", deleteAppointment);

ui.dialog.addEventListener("click", (event) => {
  if (event.target === ui.dialog) closeDialog();
});

// Add an appointment for a day by double-clicking an empty area in that day.
ui.calendar.addEventListener("dblclick", (event) => {
  if (event.target.closest(".event-card")) return;
  const column = event.target.closest(".day-column");
  if (!column) return;
  addAppointment(parseDate(column.dataset.date));
});

// Add notification control to the header.
const notificationBtn = document.createElement("button");
notificationBtn.type = "button";
notificationBtn.className = "btn btn-light";
notificationBtn.textContent = "Enable Notifications";
notificationBtn.addEventListener("click", enableNotifications);
document.querySelector(".header-actions").insertBefore(
  notificationBtn,
  $("addBtn")
);

render();
checkNotifications();
setInterval(checkNotifications, 60000);
