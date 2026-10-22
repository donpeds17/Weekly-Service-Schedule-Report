const STORAGE_KEY = "weekly-service-schedule-v1";
const HOURS_START = 6;
const HOURS_END = 22;
const HOUR_HEIGHT = 52;
const DAY_MS = 86400000;

const $ = (id) => document.getElementById(id);
const calendar = $("calendar");
const dialog = $("eventDialog");
const form = $("eventForm");
let weekStart = getMonday(new Date());
let selectedDay = 0;
let events = loadEvents();

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function getMonday(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function plusDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function formatDate(date, opts = { month: "short", day: "numeric" }) {
  return date.toLocaleDateString("en-US", opts);
}
function timeToMinutes(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
}
function prettyTime(value) {
  return new Date(`2000-01-01T${value}:00`).toLocaleTimeString("en-US", {hour:"numeric", minute:"2-digit"});
}
function loadEvents() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) { console.warn("Could not load saved schedule", e); }
  // Example appointments inspired by the photographed whiteboard; edit or replace these.
  const monday = getMonday(new Date());
  return [
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,0)), name:"Day Off — Gilbert", category:"personal", start:"10:00", end:"12:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,1)), name:"Travel back to Bohol", category:"personal", start:"10:00", end:"12:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,1)), name:"Yomie Paroa Residence", category:"pest", start:"14:00", end:"15:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,2)), name:"Pest Control Seminar Training", category:"meeting", start:"09:00", end:"10:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,2)), name:"Slaughter House", category:"pest", start:"13:00", end:"15:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,3)), name:"Bigno Residence", category:"pest", start:"14:00", end:"15:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,4)), name:"Gilbert — Day Off", category:"personal", start:"10:00", end:"12:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,5)), name:"Padel at Palms", category:"personal", start:"10:00", end:"11:00", notes:""},
    {id:crypto.randomUUID(), day:dateKey(plusDays(monday,5)), name:"The Italian", category:"personal", start:"12:00", end:"13:00", notes:""}
  ];
}
function saveEvents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}
function render() {
  const dayMode = $("viewSelect").value === "day";
  calendar.classList.toggle("day-view", dayMode);
  calendar.innerHTML = "";
  const dates = dayMode ? [plusDays(weekStart, selectedDay)] : Array.from({length:7}, (_,i) => plusDays(weekStart,i));
  const endWeek = plusDays(weekStart, 6);
  $("weekLabel").textContent = `${formatDate(weekStart, {month:"short",day:"numeric",year:"numeric"})} – ${formatDate(endWeek,{month:"short",day:"numeric",year:"numeric"})}`;

  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = "TIME";
  calendar.appendChild(corner);
  const todayKey = dateKey(new Date());
  dates.forEach((date) => {
    const head = document.createElement("div");
    head.className = "day-head" + (dateKey(date) === todayKey ? " is-today" : "");
    head.innerHTML = `<div class="day-name">${date.toLocaleDateString("en-US",{weekday:"short"})}</div><div class="day-number">${date.getDate()}</div>`;
    calendar.appendChild(head);
  });

  for (let hour = HOURS_START; hour < HOURS_END; hour++) {
    const label = document.createElement("div");
    label.className = "time-label";
    label.textContent = new Date(2000,0,1,hour).toLocaleTimeString("en-US",{hour:"numeric"});
    calendar.appendChild(label);
    dates.forEach((date) => {
      const column = document.createElement("div");
      column.className = "day-column";
      column.dataset.day = dateKey(date);
      column.addEventListener("dblclick", (e) => {
        const rect = column.getBoundingClientRect();
        const minuteOffset = Math.max(0, Math.floor((e.clientY - rect.top) / HOUR_HEIGHT * 60));
        const total = Math.min((HOURS_END-1)*60, hour*60 + minuteOffset);
        openNew(dateKey(date), minutesToTime(Math.floor(total/15)*15));
      });
      calendar.appendChild(column);
    });
  }

  const query = $("searchInput").value.trim().toLowerCase();
  const visibleEvents = events.filter(ev => dates.some(d => dateKey(d) === ev.day))
    .filter(ev => !query || `${ev.name} ${ev.notes || ""} ${ev.category}`.toLowerCase().includes(query));

  visibleEvents.forEach(ev => {
    const dayIndex = dates.findIndex(d => dateKey(d) === ev.day);
    if (dayIndex < 0) return;
    const columns = calendar.querySelectorAll(".day-column");
    const column = columns[dayIndex];
    const start = timeToMinutes(ev.start), end = timeToMinutes(ev.end);
    const top = ((start - HOURS_START*60) / 60) * HOUR_HEIGHT;
    const height = Math.max(32, ((end - start) / 60) * HOUR_HEIGHT - 4);
    const card = document.createElement("button");
    card.type = "button";
    card.className = `event ${ev.category}`;
    card.style.top = `${Math.max(2,top)}px`;
    card.style.height = `${Math.max(31,height)}px`;
    card.title = ev.notes ? `${ev.name}\n${ev.notes}` : ev.name;
    card.innerHTML = `<strong>${escapeHtml(ev.name)}</strong><small>${prettyTime(ev.start)}–${prettyTime(ev.end)}</small>`;
    card.addEventListener("click", () => openEdit(ev.id));
    column.appendChild(card);
  });
  if (!visibleEvents.length && query) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.gridColumn = "1 / -1";
    empty.textContent = "No appointments match your search.";
    calendar.appendChild(empty);
  }
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function fillDayOptions() {
  $("eventDay").innerHTML = "";
  for (let i=0;i<7;i++) {
    const date = plusDays(weekStart,i);
    const option = document.createElement("option");
    option.value = dateKey(date);
    option.textContent = date.toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
    $("eventDay").appendChild(option);
  }
}
function openNew(day = dateKey(weekStart), start = "09:00") {
  fillDayOptions();
  $("dialogTitle").textContent = "Add appointment";
  $("eventId").value = "";
  $("eventName").value = "";
  $("eventDay").value = day;
  $("eventCategory").value = "pest";
  $("eventStart").value = start;
  $("eventEnd").value = minutesToTime(Math.min(timeToMinutes(start)+60, HOURS_END*60));
  $("eventNotes").value = "";
  $("deleteBtn").hidden = true;
  dialog.showModal();
}
function openEdit(id) {
  const ev = events.find(item => item.id === id);
  if (!ev) return;
  fillDayOptions();
  // If the appointment is outside the current week, move the displayed week to it.
  const eventDate = new Date(`${ev.day}T12:00:00`);
  weekStart = getMonday(eventDate);
  fillDayOptions();
  $("dialogTitle").textContent = "Edit appointment";
  $("eventId").value = ev.id;
  $("eventName").value = ev.name;
  $("eventDay").value = ev.day;
  $("eventCategory").value = ev.category;
  $("eventStart").value = ev.start;
  $("eventEnd").value = ev.end;
  $("eventNotes").value = ev.notes || "";
  $("deleteBtn").hidden = false;
  render();
  dialog.showModal();
}
function closeDialog() { dialog.close(); }

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const start = $("eventStart").value, end = $("eventEnd").value;
  if (timeToMinutes(end) <= timeToMinutes(start)) {
    alert("End time must be later than start time.");
    return;
  }
  const id = $("eventId").value || crypto.randomUUID();
  const item = {
    id, day: $("eventDay").value, name: $("eventName").value.trim(),
    category: $("eventCategory").value, start, end, notes: $("eventNotes").value.trim()
  };
  if (!item.name) return;
  const index = events.findIndex(ev => ev.id === id);
  if (index >= 0) events[index] = item; else events.push(item);
  saveEvents();
  weekStart = getMonday(new Date(`${item.day}T12:00:00`));
  selectedDay = Math.max(0, Math.round((new Date(`${item.day}T12:00:00`) - weekStart)/DAY_MS));
  closeDialog();
  render();
});
$("deleteBtn").addEventListener("click", () => {
  const id = $("eventId").value;
  if (!id || !confirm("Delete this appointment?")) return;
  events = events.filter(ev => ev.id !== id);
  saveEvents(); closeDialog(); render();
});
$("addBtn").addEventListener("click", () => openNew(dateKey(plusDays(weekStart, selectedDay))));
$("closeDialog").addEventListener("click", closeDialog);
$("cancelBtn").addEventListener("click", closeDialog);
$("prevWeek").addEventListener("click", () => { weekStart = plusDays(weekStart,-7); render(); });
$("nextWeek").addEventListener("click", () => { weekStart = plusDays(weekStart,7); render(); });
$("todayBtn").addEventListener("click", () => { weekStart = getMonday(new Date()); selectedDay = (new Date().getDay()+6)%7; render(); });
$("searchInput").addEventListener("input", render);
$("viewSelect").addEventListener("change", render);
render();
