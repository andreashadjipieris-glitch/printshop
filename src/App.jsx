import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";

const supabase = createClient(
  "https://uuwnlpaznvvorbmvthvh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d25scGF6bnZ2b3JibXZ0aHZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyNjMxMjksImV4cCI6MjA5MjgzOTEyOX0.DWYsfL06lTeBM0DKyIwPJ2aoe83X2YFaFLJIkFEf4K0"
);
const TABS = ["Dashboard", "Pelates", "Paraggellies", "Leads", "Timologia", "Exoda", "Tasks", "Calculator"];

const DTF_PRICE_PER_M2 = 7.2;
const SIZES_M2 = { "A5": 0.031, "A4": 0.062, "A3": 0.125, "A2": 0.25 };
const SHIRT_PRICES = {
  white: { normal: 2.06, big: 2.42 },
  color: { normal: 2.42, big: 2.96 }
};

function getSalePrice(qty) {
  if (qty >= 100) return 6;
  if (qty >= 30) return 7;
  if (qty >= 20) return 8;
  return 10;
}

function getPriority(task) {
  if (task.completed) return 3;
  if (!task.due_date) return 2;
  const diff = (new Date(task.due_date) - new Date()) / 3600000;
  if (diff < 0) return 0;
  if (diff < 24) return 0;
  if (diff < 72) return 1;
  return 2;
}

function getPriorityLabel(task) {
  const p = getPriority(task);
  if (p === 0) return { label: "EPIGON", color: "#ef4444" };
  if (p === 1) return { label: "KANONIKO", color: "#f59e0b" };
  return { label: "XAMILO", color: "#22c55e" };
}
function generatePDF(inv, items) {
  const doc = new jsPDF();
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("PrintShop - Hadjipieris", 20, 20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Type: ${inv.type}`, 20, 32);
  doc.text(`Customer: ${inv.customers?.name || inv.guest_name || "Perastikos"}`, 20, 42);
  doc.text(`Date: ${new Date(inv.created_at).toLocaleDateString("en-GB")}`, 20, 52);
  doc.line(20, 58, 190, 58);
  doc.setFont("helvetica", "bold");
  doc.text("Description", 20, 67);
  doc.text("Qty", 120, 67);
  doc.text("Price", 145, 67);
  doc.text("Total", 168, 67);
  doc.line(20, 70, 190, 70);
  doc.setFont("helvetica", "normal");
  let y = 80;
  (items || []).forEach(item => {
    doc.text(String(item.description || ""), 20, y);
    doc.text(String(item.quantity || ""), 120, y);
    doc.text(`€${item.unit_price}`, 145, y);
    doc.text(`€${item.total || (item.quantity * item.unit_price)}`, 168, y);
    y += 10;
  });
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: €${inv.total}`, 140, y);
  doc.save(`${inv.type}-${inv.id?.slice(0, 8)}.pdf`);
}
export default function App() {
  const [tab, setTab] = useState("Dashboard");
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [leads, setLeads] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    const { data: c } = await supabase.from("customers").select("*").order("name");
    const { data: o } = await supabase.from("orders").select("*, customer_id, customers(name)").order("created_at", { ascending: false });
    const { data: l } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    const { data: inv } = await supabase.from("invoices").select("*, customer_id, customers(name)").order("created_at", { ascending: false });
    const { data: exp } = await supabase.from("expenses").select("*").order("created_at", { ascending: false });
    setCustomers(c || []);
    setOrders(o || []);
    setLeads(l || []);
    setInvoices(inv || []);
    setExpenses(exp || []);
  }

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <span style={styles.logo}>🖨️ PrintShop</span>
      </div>
      <div style={styles.tabs}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...styles.tab, ...(tab === t ? styles.tabActive : {}) }}>
            {t}
          </button>
        ))}
      </div>
      <div style={styles.content}>
        {tab === "Dashboard" && <Dashboard orders={orders} customers={customers} leads={leads} expenses={expenses} invoices={invoices} />}
        {tab === "Pelates" && <Customers customers={customers} orders={orders} invoices={invoices} refresh={fetchAll} />}
        {tab === "Paraggellies" && <Orders orders={orders} customers={customers} refresh={fetchAll} />}
        {tab === "Leads" && <LeadsTab leads={leads} refresh={fetchAll} />}
        {tab === "Timologia" && <Invoices customers={customers} invoices={invoices} refresh={fetchAll} />}
        {tab === "Exoda" && <Expenses expenses={expenses} orders={orders} invoices={invoices} refresh={fetchAll} />}
        {tab === "Tasks" && <Tasks />}
        {tab === "Calculator" && <Calculator />}
      </div>
    </div>
  );
}
function MonthlyChart({ orders, invoices }) {
  const months = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαι", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
  const now = new Date();
  const currentYear = now.getFullYear();

  const last6 = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(currentYear, now.getMonth() - i, 1);
    last6.push({ month: d.getMonth(), year: d.getFullYear(), label: months[d.getMonth()] });
  }

  const data = last6.map(({ month, year, label }) => {
    const orderTotal = orders
      .filter(o => {
        const d = new Date(o.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((s, o) => s + (o.total || 0), 0);

    const invoiceTotal = invoices
      .filter(inv => {
        const d = new Date(inv.created_at);
        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((s, inv) => s + (inv.total || 0), 0);

    return { label, value: Math.max(orderTotal, invoiceTotal) };
  });

  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>📊 Μηνιαίες Πωλήσεις</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
        {data.map(({ label, value }) => {
          const heightPct = (value / max) * 100;
          const isCurrentMonth = label === months[now.getMonth()];
          return (
            <div key={label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>
                {value > 0 ? `€${value.toFixed(0)}` : ""}
              </div>
              <div style={{
                width: "100%",
                height: `${Math.max(heightPct, 4)}%`,
                background: isCurrentMonth ? "#1e293b" : "#3b82f6",
                borderRadius: "4px 4px 0 0",
                minHeight: 4
              }} />
              <div style={{ fontSize: 10, color: "#888", fontWeight: isCurrentMonth ? 700 : 400 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Dashboard({ orders, customers, leads, expenses, invoices }) {
  const pending = orders.filter(o => o.status !== "Paradothike").length;
  const todayLeads = leads.filter(l => l.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const profit = totalSales - totalExpenses;

  return (
    <div>
      <h2 style={styles.title}>Kalimera 👋</h2>
      <div style={styles.cards}>
        <Card label="Synolo Poliseon" value={`€${totalSales.toFixed(2)}`} color="#22c55e" />
        <Card label="Ekkremes Paraggellies" value={pending} color="#f59e0b" />
        <Card label="Pelates" value={customers.length} color="#3b82f6" />
        <Card label="Leads Simera" value={todayLeads} color="#a855f7" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderTop: "4px solid #ef4444" }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#ef4444" }}>€{totalExpenses.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Synolo Exodon</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderTop: `4px solid ${profit >= 0 ? "#22c55e" : "#ef4444"}` }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: profit >= 0 ? "#22c55e" : "#ef4444" }}>€{profit.toFixed(2)}</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Katharo Kerdos</div>
        </div>
      </div>
      <MonthlyChart orders={orders} invoices={invoices} />
      <h3 style={styles.subtitle}>Teleutaies Paraggellies</h3>
      {orders.slice(0, 5).map(o => (
        <div key={o.id} style={styles.row}>
          <span>{o.customers?.name || "—"}</span>
          <span style={statusColor(o.status)}>{o.status}</span>
          <span>€{o.total}</span>
        </div>
      ))}
    </div>
  );
}

function Card({ label, value, color }) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{label}</div>
    </div>
  );
}
function CustomerProfile({ customer, orders, invoices, onBack }) {
  const customerOrders = orders.filter(o => o.customer_id === customer.id);
  const customerInvoices = invoices.filter(inv => inv.customer_id === customer.id);
  const totalSales = customerOrders.reduce((s, o) => s + (o.total || 0), 0);
  const totalInvoiced = customerInvoices.reduce((s, i) => s + (i.total || 0), 0);

  return (
    <div>
      <button onClick={onBack} style={{ ...styles.btnSmall, marginBottom: 16 }}>← Back</button>
      <div style={{ background: "white", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{customer.name}</div>
        <div style={{ fontSize: 14, color: "#888", marginTop: 4 }}>
          {customer.phone}{customer.email ? ` · ${customer.email}` : ""}
        </div>
        {customer.notes && <div style={{ fontSize: 13, color: "#64748b", marginTop: 8 }}>{customer.notes}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={() => window.open(`https://wa.me/${customer.phone?.replace(/\D/g, '')}`, '_blank')} style={styles.btnWhatsapp}>💬 WhatsApp</button>
          {customer.email && <button onClick={() => window.open(`mailto:${customer.email}`, '_blank')} style={styles.btnEmail}>✉️ Email</button>}
        </div>
      </div>
      <div style={styles.cards}>
        <Card label="Synolo Paraggellion" value={`€${totalSales.toFixed(2)}`} color="#3b82f6" />
        <Card label="Synolo Timologion" value={`€${totalInvoiced.toFixed(2)}`} color="#22c55e" />
      </div>
      <h3 style={styles.subtitle}>📦 Paraggellies ({customerOrders.length})</h3>
      {customerOrders.length === 0
        ? <div style={{ color: "#888", fontSize: 14, marginBottom: 8 }}>Kamia paraggelia akoma</div>
        : customerOrders.map(o => (
          <div key={o.id} style={styles.row}>
            <div>
              <div style={{ fontWeight: 600 }}>€{o.total}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{o.created_at?.slice(0, 10)}</div>
              {o.notes && <div style={{ fontSize: 12, color: "#64748b" }}>{o.notes}</div>}
            </div>
            <span style={statusColor(o.status)}>{o.status}</span>
          </div>
        ))
      }
      <h3 style={styles.subtitle}>🧾 Timologia ({customerInvoices.length})</h3>
      {customerInvoices.length === 0
        ? <div style={{ color: "#888", fontSize: 14 }}>Kanena timologio akoma</div>
        : customerInvoices.map(inv => (
          <div key={inv.id} style={styles.row}>
            <div>
              <div style={{ fontWeight: 600 }}>{inv.type}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{inv.created_at?.slice(0, 10)}</div>
            </div>
            <span style={{ fontWeight: 700, color: "#22c55e" }}>€{inv.total}</span>
          </div>
        ))
      }
    </div>
  );
}
function Customers({ customers, orders, invoices, refresh }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState(null);

  async function addCustomer() {
    if (!form.name) return;
    await supabase.from("customers").insert([form]);
    setForm({ name: "", phone: "", email: "", notes: "" });
    setAdding(false);
    refresh();
  }

  async function deleteCustomer(id) {
    if (!confirm("Diagrafi pelati;")) return;
    await supabase.from("customers").delete().eq("id", id);
    refresh();
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || "").includes(search)
  );

  if (selected) {
    return (
      <CustomerProfile
        customer={selected}
        orders={orders}
        invoices={invoices}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.title}>Pelates</h2>
        <button style={styles.btn} onClick={() => setAdding(!adding)}>+ Neos</button>
      </div>
      {adding && (
        <div style={styles.form}>
          <input style={styles.input} placeholder="Onoma *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input style={styles.input} placeholder="Tilefono" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <input style={styles.input} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input style={styles.input} placeholder="Simeiosis" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button style={styles.btn} onClick={addCustomer}>💾 Save</button>
        </div>
      )}
      <input style={{ ...styles.input, marginBottom: 12 }} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
      {filtered.map(c => {
        const customerOrders = orders.filter(o => o.customer_id === c.id);
        const total = customerOrders.reduce((s, o) => s + (o.total || 0), 0);
        return (
          <div key={c.id} style={{ ...styles.row, cursor: "pointer" }} onClick={() => setSelected(c)}>
            <div>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
              {total > 0 && <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>€{total.toFixed(2)} synolo</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => window.open(`https://wa.me/${c.phone?.replace(/\D/g, '')}`, '_blank')} style={styles.btnWhatsapp}>💬</button>
              {c.email && <button onClick={() => window.open(`mailto:${c.email}`, '_blank')} style={styles.btnEmail}>✉️</button>}
              <button onClick={() => deleteCustomer(c.id)} style={styles.btnDelete}>🗑️</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function Orders({ orders, customers, refresh }) {
  const [form, setForm] = useState({ customer_id: "", status: "Se anamoni", total: "", notes: "" });
  const [adding, setAdding] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  async function addOrder() {
    if (!form.customer_id) return;
    await supabase.from("orders").insert([{ ...form, total: parseFloat(form.total) || 0 }]);
    setForm({ customer_id: "", status: "Se anamoni", total: "", notes: "" });
    setAdding(false);
    refresh();
  }

  async function updateStatus(id, status) {
    await supabase.from("orders").update({ status }).eq("id", id);
    refresh();
  }

  async function deleteOrder(id) {
    if (!confirm("Diagrafi paraggelias;")) return;
    await supabase.from("orders").delete().eq("id", id);
    refresh();
  }

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.title}>Paraggellies</h2>
        <button style={styles.btn} onClick={() => setAdding(!adding)}>+ Nea</button>
      </div>
      {adding && (
        <div style={styles.form}>
          <select style={styles.input} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Epilexe Pelati</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={styles.input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {["Se anamoni", "Se ektiposi", "Etoimo", "Paradothike"].map(s => <option key={s}>{s}</option>)}
          </select>
          <button style={{ ...styles.btnSmall, marginBottom: 10 }} onClick={() => setShowCalc(!showCalc)}>
            🧮 {showCalc ? "Kleise" : "Anoixe"} Calculator
          </button>
          {showCalc && <MiniCalculator onSelect={total => { setForm({ ...form, total: total.toString() }); setShowCalc(false); }} />}
          <input style={styles.input} placeholder="Synolo €" type="number" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} />
          <input style={styles.input} placeholder="Simeiosis" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button style={styles.btn} onClick={addOrder}>💾 Save</button>
        </div>
      )}
      {orders.map(o => (
        <div key={o.id} style={styles.row}>
          <div>
            <div style={{ fontWeight: 600 }}>{o.customers?.name || "—"}</div>
            <div style={{ fontSize: 13, color: "#888" }}>€{o.total} · {o.created_at?.slice(0, 10)}</div>
            {o.notes && <div style={{ fontSize: 12, color: "#64748b" }}>{o.notes}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)}
              style={{ border: "none", background: "transparent", fontWeight: 600, fontSize: 13 }}>
              {["Se anamoni", "Se ektiposi", "Etoimo", "Paradothike"].map(s => <option key={s}>{s}</option>)}
            </select>
            <button onClick={() => deleteOrder(o.id)} style={styles.btnDelete}>🗑️</button>
          </div>
        </div>
      ))}
    </div>
  );
}
function Invoices({ customers, invoices, refresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ customer_id: "", type: "Apodeixi", discount: 0 });
  const [items, setItems] = useState([{ description: "", quantity: 1, unit_price: 0 }]);
  const [showCalc, setShowCalc] = useState(false);
  const [form, setForm] = useState({ customer_id: "", type: "Apodeixi", discount: 0, guest_name: "" });

  function updateItem(i, field, value) {
    const updated = [...items];
    updated[i][field] = value;
    updated[i].total = updated[i].quantity * updated[i].unit_price;
    setItems(updated);
  }

  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const total = subtotal - (form.discount || 0);

  async function saveInvoice() {
    if (!form.customer_id && !form.guest_name) return;
    const { data: inv } = await supabase.from("invoices").insert([{ ...form, total }]).select().single();
    await supabase.from("invoice_items").insert(items.map(i => ({ ...i, invoice_id: inv.id })));
    setAdding(false);
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
    refresh();
  }

  async function deleteInvoice(id) {
    if (!confirm("Diagrafi timologiou;")) return;
    await supabase.from("invoices").delete().eq("id", id);
    refresh();
  }

  async function fetchAndPrint(inv) {
    const { data: invItems } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
    generatePDF(inv, invItems || []);
  }

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.title}>Timologia</h2>
        <button style={styles.btn} onClick={() => setAdding(!adding)}>+ Neo</button>
      </div>
      {adding && (
        <div style={styles.form}>
          <select style={styles.input} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
            <option value="">Epilexe Pelati (prosaireto)</option>
          </select>
          <input style={styles.input} placeholder="Onoma Perati (an den einai pelatis)" value={form.guest_name || ""} onChange={e => setForm({ ...form, guest_name: e.target.value })} />
          <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="Apodeixi">Apodeixi</option>
            <option value="Timologio">Timologio</option>
            <option value="Prosfora">Prosfora</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input style={styles.input} placeholder="Onoma Perati (an den einai pelatis)" value={form.guest_name || ""} onChange={e => setForm({ ...form, guest_name: e.target.value })} />
            <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="Apodeixi">Apodeixi</option>
            <option value="Timologio">Timologio</option>
            <option value="Prosfora">Prosfora</option>
          </select>
          <button style={{ ...styles.btnSmall, marginBottom: 10 }} onClick={() => setShowCalc(!showCalc)}>
            🧮 {showCalc ? "Kleise" : "Anoixe"} Calculator
          </button>
          {showCalc && (
            <MiniCalculator onSelect={t => {
              setItems([{ description: "Faneles DTF", quantity: 1, unit_price: t, total: t }]);
              setShowCalc(false);
            }} />
          )}
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Proionta:</div>
          {items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input style={{ ...styles.input, marginBottom: 0, flex: 2 }} placeholder="Perigrafi" value={item.description} onChange={e => updateItem(i, "description", e.target.value)} />
              <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} type="number" placeholder="Pos." value={item.quantity} onChange={e => updateItem(i, "quantity", parseInt(e.target.value) || 0)} />
              <input style={{ ...styles.input, marginBottom: 0, flex: 1 }} type="number" placeholder="€" value={item.unit_price} onChange={e => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} />
            </div>
          ))}
          <button style={styles.btnSmall} onClick={() => setItems([...items, { description: "", quantity: 1, unit_price: 0 }])}>+ Grammi</button>
          <div style={{ marginTop: 12, fontWeight: 600 }}>Yposynolo: €{subtotal.toFixed(2)}</div>
          <input style={styles.input} type="number" placeholder="Ekptosi €" value={form.discount} onChange={e => setForm({ ...form, discount: parseFloat(e.target.value) || 0 })} />
          <div style={{ fontWeight: 700, fontSize: 18, color: "#22c55e" }}>Synolo: €{total.toFixed(2)}</div>
          <button style={{ ...styles.btn, marginTop: 12 }} onClick={saveInvoice}>💾 Save</button>
        </div>
      )}
      {invoices.map(inv => (
        <div key={inv.id} style={styles.row}>
          <div>
            <div style={{ fontWeight: 600 }}>{inv.customers?.name || inv.guest_name || "Perastikos"}</div>
            <div style={{ fontSize: 13, color: "#888" }}>{inv.type} · {inv.created_at?.slice(0, 10)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#22c55e" }}>€{inv.total}</span>
            <button onClick={() => fetchAndPrint(inv)} style={styles.btnSmall}>📄 PDF</button>
            <button onClick={() => deleteInvoice(inv.id)} style={styles.btnDelete}>🗑️</button>
          </div>
        </div>
      ))}
    </div>
  );
}
const EXPENSE_CATEGORIES = ["Ylika DTF", "Faneles", "Autokollita", "Michanima", "Aravio", "Logariasmos", "Allo"];

function Expenses({ expenses, orders, invoices, refresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "Allo", date: new Date().toISOString().slice(0, 10) });

  async function addExpense() {
    if (!form.description || !form.amount) return;
    await supabase.from("expenses").insert([{ ...form, amount: parseFloat(form.amount) }]);
    setForm({ description: "", amount: "", category: "Allo", date: new Date().toISOString().slice(0, 10) });
    setAdding(false);
    refresh();
  }

  async function deleteExpense(id) {
    if (!confirm("Diagrafi exodou;")) return;
    await supabase.from("expenses").delete().eq("id", id);
    refresh();
  }

  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const revenue = Math.max(totalSales, totalInvoiced);
  const profit = revenue - totalExpenses;
  const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

  const byCategory = EXPENSE_CATEGORIES.map(cat => ({
    cat,
    total: expenses.filter(e => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0)
  })).filter(x => x.total > 0);

  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.title}>💸 Exoda & Kerdos</h2>
        <button style={styles.btn} onClick={() => setAdding(!adding)}>+ Neo</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div style={{ background: "white", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderTop: "4px solid #3b82f6", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#3b82f6" }}>€{revenue.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Esoda</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderTop: "4px solid #ef4444", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#ef4444" }}>€{totalExpenses.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Exoda</div>
        </div>
        <div style={{ background: "white", borderRadius: 12, padding: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)", borderTop: `4px solid ${profit >= 0 ? "#22c55e" : "#ef4444"}`, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: profit >= 0 ? "#22c55e" : "#ef4444" }}>€{profit.toFixed(0)}</div>
          <div style={{ fontSize: 11, color: "#888" }}>Kerdos ({margin}%)</div>
        </div>
      </div>
      {byCategory.length > 0 && (
        <div style={{ background: "white", borderRadius: 12, padding: 14, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>📂 Ana Katigoria</div>
          {byCategory.map(({ cat, total }) => {
            const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
            return (
              <div key={cat} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 600 }}>€{total.toFixed(2)} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 4, height: 6 }}>
                  <div style={{ background: "#ef4444", width: `${pct}%`, height: 6, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {adding && (
        <div style={styles.form}>
          <input style={styles.input} placeholder="Perigrafi *" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input style={styles.input} type="number" placeholder="Poso € *" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
          <select style={styles.input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={styles.label}>Imerominia:</label>
          <input style={styles.input} type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <button style={styles.btn} onClick={addExpense}>💾 Save</button>
        </div>
      )}
      <h3 style={styles.subtitle}>Ola ta Exoda ({expenses.length})</h3>
      {expenses.length === 0 && <div style={{ color: "#888", fontSize: 14 }}>Kanena exodo akoma</div>}
      {expenses.map(e => (
        <div key={e.id} style={styles.row}>
          <div>
            <div style={{ fontWeight: 600 }}>{e.description}</div>
            <div style={{ fontSize: 13, color: "#888" }}>{e.category} · {e.date?.slice(0, 10) || e.created_at?.slice(0, 10)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "#ef4444" }}>€{e.amount}</span>
            <button onClick={() => deleteExpense(e.id)} style={styles.btnDelete}>🗑️</button>
          </div>
        </div>
      ))}
    </div>
  );
}
function MiniCalculator({ onSelect }) {
  const [qty, setQty] = useState(100);
  const [printSize, setPrintSize] = useState("A4");
  const [shirtType, setShirtType] = useState("color");
  const shirtCost = SHIRT_PRICES[shirtType]["normal"];
  const dtfCost = SIZES_M2[printSize] * DTF_PRICE_PER_M2;
  const salePrice = getSalePrice(qty);
  const totalSale = salePrice * qty;
  return (
    <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, marginBottom: 10, border: "1px solid #e2e8f0" }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>🧮 Quick Calculator</div>
      <select style={styles.input} value={shirtType} onChange={e => setShirtType(e.target.value)}>
        <option value="white">White/Ash</option>
        <option value="color">Color</option>
      </select>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {Object.keys(SIZES_M2).map(s => (
          <button key={s} onClick={() => setPrintSize(s)} style={{ ...styles.btnSmall, ...(printSize === s ? { background: "#1e293b", color: "white" } : {}) }}>{s}</button>
        ))}
      </div>
      <input style={styles.input} type="number" placeholder="Posotita" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
      <div style={{ fontSize: 13, marginBottom: 8 }}>
        Kostos/tem: €{(shirtCost + dtfCost).toFixed(2)} | Timi: <strong>€{salePrice}/tem</strong> | Synolo: <strong style={{ color: "#22c55e" }}>€{totalSale.toFixed(2)}</strong>
      </div>
      <button style={styles.btn} onClick={() => onSelect(totalSale)}>✅ Xrisi €{totalSale.toFixed(2)}</button>
    </div>
  );
}

function Calculator() {
  const [mode, setMode] = useState("shirts");
  const [qty, setQty] = useState(100);
  const [printSize, setPrintSize] = useState("A4");
  const [shirtType, setShirtType] = useState("color");
  const [isBig, setIsBig] = useState(false);
  const [stickerM2, setStickerM2] = useState(1);
  const [withInstall, setWithInstall] = useState(false);
  const shirtCost = SHIRT_PRICES[shirtType][isBig ? "big" : "normal"];
  const dtfCost = SIZES_M2[printSize] * DTF_PRICE_PER_M2;
  const costPerShirt = shirtCost + dtfCost;
  const totalCost = costPerShirt * qty;
  const salePrice = getSalePrice(qty);
  const totalSale = salePrice * qty;
  const profit = totalSale - totalCost;
  const margin = ((profit / totalSale) * 100).toFixed(1);
  const stickerPrice = stickerM2 <= 1 ? 45 : stickerM2 * 17.5;
  const installPrice = withInstall ? stickerM2 * 20 : 0;
  const stickerTotal = stickerPrice + installPrice;
  return (
    <div>
      <h2 style={styles.title}>🧮 Calculator</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setMode("shirts")} style={{ ...styles.btn, ...(mode !== "shirts" ? { background: "#e2e8f0", color: "#1e293b" } : {}) }}>👕 Faneles</button>
        <button onClick={() => setMode("stickers")} style={{ ...styles.btn, ...(mode !== "stickers" ? { background: "#e2e8f0", color: "#1e293b" } : {}) }}>🏷️ Autokollita</button>
      </div>
      {mode === "shirts" && (
        <div style={styles.form}>
          <label style={styles.label}>Xroma fanelas:</label>
          <select style={styles.input} value={shirtType} onChange={e => setShirtType(e.target.value)}>
            <option value="white">White / Ash (€2.06)</option>
            <option value="color">Color (€2.42)</option>
          </select>
          <label style={styles.label}>Megethos:</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setIsBig(false)} style={{ ...styles.btnSmall, ...(!isBig ? { background: "#1e293b", color: "white" } : {}) }}>Normal (XS-XL)</button>
            <button onClick={() => setIsBig(true)} style={{ ...styles.btnSmall, ...(isBig ? { background: "#1e293b", color: "white" } : {}) }}>BIG (2XL-5XL)</button>
          </div>
          <label style={styles.label}>Megethos DTF:</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {Object.keys(SIZES_M2).map(s => (
              <button key={s} onClick={() => setPrintSize(s)} style={{ ...styles.btnSmall, ...(printSize === s ? { background: "#1e293b", color: "white" } : {}) }}>{s}</button>
            ))}
          </div>
          <label style={styles.label}>Posotita:</label>
          <input style={styles.input} type="number" value={qty} onChange={e => setQty(parseInt(e.target.value) || 1)} />
          <div style={{ background: "#f1f5f9", borderRadius: 10, padding: 16 }}>
            <div style={styles.calcRow}><span>Kostos fanelas:</span><span>€{shirtCost.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Kostos DTF ({printSize}):</span><span>€{dtfCost.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Kostos/tem:</span><span style={{ fontWeight: 700 }}>€{costPerShirt.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Synoliko kostos:</span><span>€{totalCost.toFixed(2)}</span></div>
            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
            <div style={styles.calcRow}><span>Timi polisis/tem:</span><span style={{ color: "#3b82f6", fontWeight: 700 }}>€{salePrice.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Synolo polisis:</span><span style={{ color: "#3b82f6", fontWeight: 700 }}>€{totalSale.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Kerdos:</span><span style={{ color: "#22c55e", fontWeight: 700 }}>€{profit.toFixed(2)}</span></div>
            <div style={styles.calcRow}><span>Perithorio:</span><span style={{ color: "#22c55e", fontWeight: 700 }}>{margin}%</span></div>
          </div>
          <div style={{ marginTop: 12, padding: 10, background: "#fef9c3", borderRadius: 8, fontSize: 13 }}>
            💡 {qty >= 100 ? "100+ tem → €6/tem" : qty >= 30 ? "30-99 tem → €7/tem" : qty >= 20 ? "20-29 tem → €8/tem" : "1-19 tem → €10/tem"}
          </div>
        </div>
      )}
      {mode === "stickers" && (
        <div style={styles.form}>
          <label style={styles.label}>Tetragwnika metra:</label>
          <input style={styles.input} type="number" step="0.1" value={stickerM2} onChange={e => setStickerM2(parseFloat(e.target.value) || 0)} />
          <label style={styles.label}>Topothesia:</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <button onClick={() => setWithInstall(false)} style={{ ...styles.btnSmall, ...(!withInstall ? { background: "#1e293b", color: "white" } : {}) }}>Xoris</button>
            <button onClick={() => setWithInstall(true)} style={{ ...styles.btnSmall, ...(withInstall ? { background: "#1e293b", color: "white" } : {}) }}>Me topothesia (+€20/m²)</button>
          </div>
          <div style={{ background: "#f1f5f9", borderRadius: 10, padding: 16 }}>
            <div style={styles.calcRow}><span>Autokollito ({stickerM2}m²):</span><span>€{stickerPrice.toFixed(2)}</span></div>
            {withInstall && <div style={styles.calcRow}><span>Topothesia:</span><span>€{installPrice.toFixed(2)}</span></div>}
            <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", margin: "8px 0" }} />
            <div style={styles.calcRow}><span style={{ fontWeight: 700 }}>Synolo:</span><span style={{ color: "#22c55e", fontWeight: 700, fontSize: 20 }}>€{stickerTotal.toFixed(2)}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: "", due_date: "", type: "Ektiposi" });
  useEffect(() => { fetchTasks(); }, []);
  async function fetchTasks() {
    const { data } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
    setTasks(data || []);
  }
  async function addTask() {
    if (!form.title) return;
    await supabase.from("tasks").insert([form]);
    setForm({ title: "", due_date: "", type: "Ektiposi" });
    setAdding(false);
    fetchTasks();
  }
  async function toggleComplete(id, completed) {
    await supabase.from("tasks").update({ completed: !completed }).eq("id", id);
    fetchTasks();
  }
  async function deleteTask(id) {
    if (!confirm("Diagrafi task;")) return;
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks();
  }
  const sorted = [...tasks].sort((a, b) => getPriority(a) - getPriority(b));
  const pending = sorted.filter(t => !t.completed);
  const completed = sorted.filter(t => t.completed);
  const urgent = pending.filter(t => getPriority(t) === 0).length;
  return (
    <div>
      <div style={styles.rowBetween}>
        <h2 style={styles.title}>Tasks & Reminders</h2>
        <button style={styles.btn} onClick={() => setAdding(!adding)}>+ Neo</button>
      </div>
      {urgent > 0 && (
        <div style={{ background: "#fee2e2", border: "1px solid #ef4444", borderRadius: 10, padding: "10px 16px", marginBottom: 16, color: "#ef4444", fontWeight: 600 }}>
          ⚠️ Exeis {urgent} epigon task{urgent > 1 ? "s" : ""} simera!
        </div>
      )}
      {adding && (
        <div style={styles.form}>
          <input style={styles.input} placeholder="Titlos *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <select style={styles.input} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            {["Ektiposi", "Paradosi", "Follow-up", "Allo"].map(s => <option key={s}>{s}</option>)}
          </select>
          <label style={{ fontSize: 13, color: "#888", marginBottom: 4, display: "block" }}>Deadline:</label>
          <input style={styles.input} type="datetime-local" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
          <button style={styles.btn} onClick={addTask}>💾 Save</button>
        </div>
      )}
      <h3 style={styles.subtitle}>⏳ Pending ({pending.length})</h3>
      {pending.map(t => {
        const { label, color } = getPriorityLabel(t);
        return (
          <div key={t.id} style={{ ...styles.row, borderLeft: `4px solid ${color}` }}>
            <div>
              <div style={{ fontWeight: 600 }}>{t.title}</div>
              <div style={{ fontSize: 13, color: "#888" }}>{t.type} · <span style={{ color }}>{label}</span></div>
              {t.due_date && <div style={{ fontSize: 12, color: "#888" }}>📅 {new Date(t.due_date).toLocaleString("el-GR")}</div>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => toggleComplete(t.id, t.completed)} style={styles.btnSmall}>✅</button>
              <button onClick={() => deleteTask(t.id)} style={styles.btnDelete}>🗑️</button>
            </div>
          </div>
        );
      })}
      {completed.length > 0 && (
        <>
          <h3 style={{ ...styles.subtitle, color: "#888" }}>✅ Completed ({completed.length})</h3>
          {completed.map(t => (
            <div key={t.id} style={{ ...styles.row, opacity: 0.5 }}>
              <div style={{ fontWeight: 600, textDecoration: "line-through" }}>{t.title}</div>
              <button onClick={() => deleteTask(t.id)} style={styles.btnDelete}>🗑️</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function statusColor(status) {
  const map = {
    "Neo": { color: "#3b82f6" },
    "Se epikoinonia": { color: "#f59e0b" },
    "Ekleise": { color: "#22c55e" },
    "Xathike": { color: "#ef4444" },
    "Se anamoni": { color: "#f59e0b" },
    "Se ektiposi": { color: "#3b82f6" },
    "Etoimo": { color: "#22c55e" },
    "Paradothike": { color: "#888" },
  };
  return map[status] || {};
}

const styles = {
  app: { fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "0 auto", background: "#f8fafc", minHeight: "100vh" },
  header: { background: "#1e293b", color: "white", padding: "16px 20px" },
  logo: { fontSize: 20, fontWeight: 700 },
  tabs: { display: "flex", background: "white", borderBottom: "1px solid #e2e8f0", overflowX: "auto" },
  tab: { flex: 1, padding: "12px 8px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "#64748b", whiteSpace: "nowrap" },
  tabActive: { color: "#1e293b", fontWeight: 700, borderBottom: "2px solid #1e293b" },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: 700, margin: "0 0 16px" },
  subtitle: { fontSize: 16, fontWeight: 600, margin: "16px 0 8px" },
  cards: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
  card: { background: "white", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "white", borderRadius: 10, padding: "12px 16px", marginBottom: 8, boxShadow: "0 1px 2px rgba(0,0,0,0.06)" },
  rowBetween: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  form: { background: "white", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  input: { width: "100%", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 15, marginBottom: 10, boxSizing: "border-box" },
  label: { fontSize: 13, color: "#64748b", marginBottom: 4, display: "block", fontWeight: 600 },
  btn: { background: "#1e293b", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSmall: { background: "#e2e8f0", color: "#1e293b", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  btnDelete: { background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 16, cursor: "pointer" },
  btnWhatsapp: { background: "#dcfce7", color: "#16a34a", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 16, cursor: "pointer" },
  btnEmail: { background: "#dbeafe", color: "#2563eb", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 16, cursor: "pointer" },
  calcRow: { display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 14 },
};