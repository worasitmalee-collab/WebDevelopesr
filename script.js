// --- ฐานข้อมูลนักศึกษาจำลอง (สำหรับลิงก์ตรวจสอบ 11 หลัก) ---
const STUDENTS_DB = {
    "65312345671": { name: "นายสมชาย ใจดี", dept: "เทคโนโลยีสารสนเทศ" },
    "65312345672": { name: "นางสาวสมหญิง รักเรียน", dept: "วิทยาการคอมพิวเตอร์" },
    "65312345673": { name: "นาย องอาจ เก่งมาก", dept: "คอมพิวเตอร์ธุรกิจ" },
    "65312345674": { name: "นางสาวกcร 11หลัก", dept: "เทคโนโลยีคอมพิวเตอร์" },
    "12345678901": { name: "ทดสอบ ระบบ", dept: "เทคโนโลยีสารสนเทศ" }
};

let currentStudent = null; //// เก็บข้อมูลนักศึกษาที่ล็อกอินอยู่
// หมวดหมู่เลือกเครื่อง
const ZONES = { 
    vip: { name: "หน้า", rows: "ABC" },
    std: { name: "กลาง", rows: "DEF" },
    eco: { name: "หลัง", rows: "GHI" }};
// รวมช่อง a-h จำนวนเเถว เวลา 
const ROWS = "ABCDEFGHI";
const COLS = 10;// ปรับให้คำนวณ 80 เครื่อง (9 แถวๆ ละ 10 เครื่องโดยประมาณ หรือจัดสรรตามโครงสร้าง)
const AISLE = 5;
const BROKEN = ["", "", ""]; //เเก้ไขได้ทำให้เลือกไม่ได้  // เครื่องเสีย (ถ้ามีใส่รหัสเช่น "A3")
const TIMES = ["8:00","11:30","13:00", "16:30"];
const BUSY = {
  "8:00":  [""],
  "11:30": [""],
  "13:00": [""],
  "16:30": [""]
};
// เครื่องที่ไม่ว่าง แยกตามเวลา (สะกดเวลาให้ตรงกับ TIMES)
const state = {
    time: TIMES[0],
    count: 1,
    zone: "all",
    sel: [],
    booked: {},
    seatOwners: [],// เก็บข้อมูลว่าที่นั่งไหนใครจอง { "08:00": { "A1": {id, studentId, name, dept, timeStr} } }
    bookings: [],
};
let nextId = 1;

// คำสั่งกดหนดที่นั้ง
TIMES.forEach((t) => {
  state.booked[t] = new Set(BUSY[t] || []);
});

const $ = (id) => document.getElementById(id);
const zoneOf = (r) => Object.keys(ZONES).find((k) => ZONES[k].rows.includes(r));

function chips(el, items, key, cb) {
  el.innerHTML = "";
  items.forEach(([v, label]) => {
    const b = document.createElement("button");
    b.className = "chip";
    b.textContent = label;
    b.setAttribute("aria-pressed", state[key] === v);
    b.onclick = () => {
      state[key] = v;
      cb();
    };
    el.appendChild(b);
  });
}

function render() {
  chips(
    $("times"),
    TIMES.map((t) => [t, t + " น."]),
    "time",
    () => {
      state.sel = [];
      render();
    }
  );
  chips(
    $("zones"),
    [
      ["all", "ทุกโซน"],
      ...Object.entries(ZONES).map(([k, z]) => [k, z.name]),
    ],
    "zone",
    render
  );
  $("cnt").textContent = state.count;

  const g = $("grid");
  g.innerHTML = "";
  ROWS.split("").forEach((r) => {
    const row = document.createElement("div");
    row.className = "row";
    row.insertAdjacentHTML("beforeend", `<span class="rl">${r}</span>`);
    for (let c = 1; c <= COLS; c++) {
      if (c === AISLE + 1) {
        const a = document.createElement("span");
        a.className = "aisle";
        row.appendChild(a);
      }
      const id = r + c;
      const z = zoneOf(r);
      const b = document.createElement("button");
      const booked = state.booked[state.time].has(id);
      const broken = BROKEN.includes(id);
      const sel = state.sel.includes(id);
      const mine = state.bookings.some(
        (k) => k.time === state.time && k.seats.includes(id)
      );
      b.className = `seat ${z}${booked ? " booked" : ""}${broken ? " broken" : ""}${mine ? " mine" : ""}${
        sel ? " sel" : ""
      }${state.zone !== "all" && state.zone !== z && !sel ? " dim" : ""}`;
      b.textContent = c;
      b.disabled = booked || broken;
      if (mine) b.title = "ที่นั่งของคุณ";
      b.setAttribute(
        "aria-label",
        `ที่นั่ง ${id} ${ZONES[z].name}${
          broken ? " ใช้งานไม่ได้" : booked ? " ไม่ว่าง" : ""
        }`
      );
      b.onclick = () => toggle(id);
      row.appendChild(b);
    }
    g.appendChild(row);
  });

  $("legend").innerHTML =
    Object.values(ZONES)
      .map(
        (z, i) =>
          `<span><i style="background:var(--${Object.keys(ZONES)[i]})"></i>${
            z.name
          }</span>`
      )
      .join("") +
    `<span><i style="background:var(--sel)"></i>ที่เลือก</span><span><i style="background:var(--accent);border:2px solid var(--text)"></i>ของฉัน</span><span><i style="background:var(--booked)"></i>ไม่ว่าง</span><span><i style="border:2px dashed var(--line)"></i>ใช้งานไม่ได้</span>`;

  summary();
  renderBookings();
}

function toggle(id) {
  if (BROKEN.includes(id)) return;
  const z = zoneOf(id[0]);
  if (state.zone !== "all" && state.zone !== z && !state.sel.includes(id)) return;
  const i = state.sel.indexOf(id);
  if (i > -1) {
    state.sel.splice(i, 1);
  } else {
    if (state.sel.length >= state.count) state.sel.shift();
    state.sel.push(id);
  }
  render();
}

function summary() {
  const s = [...state.sel].sort();
  $("info").textContent = `รอบ ${state.time} น. • ${state.count} ที่นั่ง`;
  $("list").innerHTML = s
    .map((id) => {
      const z = ZONES[zoneOf(id[0])];
      return `<li><span>${id} · ${z.name}</span></li>`;
    })
    .join("");
  const ok = s.length === state.count;
  $("go").disabled = !ok;
  $("hint").textContent = ok ? "" : `เลือกอีก ${state.count - s.length} ที่นั่ง`;
}

$("minus").onclick = () => {
  if (state.count > 1) {
    state.count--;
    state.sel = state.sel.slice(0, state.count);
    render();
  }
};

$("plus").onclick = () => {
  if (state.count < 8) {
    state.count++;
    render();
  }
};

$("go").onclick = () => {
  const s = [...state.sel].sort();
  s.forEach((id) => state.booked[state.time].add(id));
  state.bookings.push({ id: nextId++, time: state.time, seats: s,  });
  $("done").textContent = `รอบ ${state.time} น. ที่นั่ง ${s.join(", ")}`;
  state.sel = [];
  $("modal").classList.add("on");
  render();
};

$("close").onclick = () => $("modal").classList.remove("on");

render();

function renderBookings() {
  const box = $("bookings");
  if (!state.bookings.length) {
    box.innerHTML = '<div class="empty">ยังไม่มีการจอง</div>';
    return;
  }
  box.innerHTML = state.bookings
    .map(
      (k) =>
        `<div class="bk"><div class="bk-top"><div><b>รอบ ${k.time} น.</b><br><small>ที่นั่ง ${k.seats.join(", ")}</small></div><button class="bk-cancel" data-id="${
          k.id
        }">ยกเลิก</button></div></div>`
    )
    .join("");
  box
    .querySelectorAll(".bk-cancel")
    .forEach((b) => (b.onclick = () => cancelBooking(Number(b.dataset.id))));
}

function cancelBooking(id) {
  const k = state.bookings.find((x) => x.id === id);
  if (
    !k ||
    !confirm(`ยกเลิกการจองรอบ ${k.time} น. ที่นั่ง ${k.seats.join(", ")} ใช่ไหม?`)
  )
    return;
  k.seats.forEach((s) => state.booked[k.time].delete(s));
  state.bookings = state.bookings.filter((x) => x.id !== id);
  render();
}