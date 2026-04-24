# CLAUDE.md — Arasaka Frontend
> Plan completo para Claude Code. Leer entero antes de escribir código.

---

## Contexto

Frontend del sistema de finanzas personales Arasaka. Consume la API Go + Gin en `http://localhost:8080/api`.

Partir desde cero — borrar el contenido actual de `frontend/src/` y reemplazarlo con esta estructura.

---

## Stack

```
React 18 + Vite
Tailwind CSS (sin librería de componentes)
Recharts (gráficos)
React Router v6 (navegación)
```

---

## Estructura de archivos

```
frontend/src/
├── main.jsx
├── App.jsx                  # Router principal
├── api/
│   └── client.js            # fetch wrapper hacia localhost:8080/api
├── pages/
│   ├── Monthly.jsx          # Reporte mensual — PRIORIDAD 1
│   ├── Ledger.jsx           # Ledger de transacciones — PRIORIDAD 2
│   └── Categories.jsx       # Gastos por categoría — PRIORIDAD 3
├── components/
│   ├── Layout.jsx           # Sidebar + contenido
│   ├── Sidebar.jsx          # Navegación lateral
│   ├── BudgetBar.jsx        # Barra gasto vs presupuesto
│   ├── KpiCard.jsx          # Tarjeta de métrica
│   ├── TransactionRow.jsx   # Fila del ledger
│   ├── CategoryBadge.jsx    # Pill de categoría con color
│   └── InsightAlert.jsx     # Alerta de insight (danger/warn/ok)
└── lib/
    ├── formatters.js        # formatCLP, formatDate, formatPct
    └── constants.js         # CATEGORIES, FLOW_TYPES, CATEGORY_COLORS
```

---

## Diseño y estilo

**Paleta de colores para categorías** — definir en `constants.js`:

```js
export const CATEGORY_COLORS = {
  CASA:          { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  PERSONAL:      { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' },
  SALUD:         { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  TRANSPORTE:    { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
  SUSCRIPCIONES: { bg: 'bg-indigo-100', text: 'text-indigo-800', dot: 'bg-indigo-500' },
  GUSTOS:        { bg: 'bg-pink-100',   text: 'text-pink-800',   dot: 'bg-pink-500'   },
  MASCOTA:       { bg: 'bg-orange-100', text: 'text-orange-800', dot: 'bg-orange-500' },
  SEGUROS:       { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  OTROS:         { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: 'bg-gray-400'   },
  SUELDO:        { bg: 'bg-emerald-100',text: 'text-emerald-800',dot: 'bg-emerald-500'},
  DEVOLUCION:    { bg: 'bg-teal-100',   text: 'text-teal-800',   dot: 'bg-teal-500'   },
  INVERSION:     { bg: 'bg-cyan-100',   text: 'text-cyan-800',   dot: 'bg-cyan-500'   },
  REGALO:        { bg: 'bg-rose-100',   text: 'text-rose-800',   dot: 'bg-rose-500'   },
  VACACIONES:    { bg: 'bg-amber-100',  text: 'text-amber-800',  dot: 'bg-amber-500'  },
}
```

**Colores semáforo para presupuesto:**
- Verde (`text-green-600`, `bg-green-100`) → < 80% del límite
- Amarillo (`text-yellow-600`, `bg-yellow-100`) → 80–100%
- Rojo (`text-red-600`, `bg-red-100`) → > 100%

**Tipografía y espaciado:**
- Font: sistema (Tailwind default)
- Sidebar: `w-56`, fondo `bg-gray-900`, texto `text-gray-300`, activo `text-white bg-gray-700`
- Contenido: `max-w-5xl mx-auto px-6 py-8`
- Cards: `bg-white rounded-xl border border-gray-100 shadow-sm`

---

## `api/client.js`

```js
const BASE = 'http://localhost:8080/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

async function put(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PUT ${path} → ${res.status}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

export const api = {
  // Reportes
  monthly: (month, year) => get(`/reports/monthly?month=${month}&year=${year}`),
  kpis:    (year)        => get(`/reports/kpis?year=${year}`),
  trend:   (months)      => get(`/reports/trend?months=${months}`),
  budgetVsActual: (month, year) => get(`/reports/budget-vs-actual?month=${month}&year=${year}`),

  // Transacciones
  transactions: (params = {}) => {
    const q = new URLSearchParams(params).toString()
    return get(`/transactions${q ? '?' + q : ''}`)
  },
  updateTransaction: (id, body) => put(`/transactions/${id}`, body),

  // Presupuestos
  budgets:      (year)  => get(`/budgets?year=${year}`),
  upsertBudget: (body)  => put(`/budgets`, body),

  // Insights
  insights: () => get(`/insights`),

  // Importar banco
  importBank: () => post(`/import/bank`, {}),
}
```

---

## `lib/formatters.js`

```js
// Formatea montos en CLP: 1254440 → "$1.254.440"
export function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(amount)
}

// Formatea fecha ISO a "13 abr 2026"
export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// Formatea porcentaje: 0.823 → "82%"
export function formatPct(ratio) {
  return `${Math.round(ratio * 100)}%`
}

// Nombre de mes: 4 → "Abril"
export function monthName(month) {
  return new Date(2026, month - 1, 1).toLocaleDateString('es-CL', { month: 'long' })
}
```

---

## Página 1: `Monthly.jsx` — Reporte mensual (PRIORIDAD 1)

**Endpoint:** `GET /api/reports/monthly?month=4&year=2026`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  [← Abril 2026 →]                                   │  ← selector mes/año
├──────────┬──────────┬──────────┬────────────────────┤
│ Ingresos │  Gastos  │  Saldo   │  Tasa de ahorro    │  ← 4 KPI cards
├─────────────────────────────────────────────────────┤
│  Gasto vs presupuesto por categoría                 │
│  [barra horizontal por cada categoría]              │
├──────────────────────┬──────────────────────────────┤
│  Por tipo de gasto   │  Top 5 gastos del mes        │
│  FIJO / VAR / DISC   │  (descripción + monto)       │
└──────────────────────┴──────────────────────────────┘
```

**Componente `BudgetBar`:**

```jsx
// props: { category, total, budget, pctUsed, transactions }
// Muestra: label | barra de progreso | monto / límite
// Color de barra según pctUsed: verde < 0.8, amarillo < 1.0, rojo >= 1.0
// Si budget == 0, mostrar solo el monto sin barra (sin límite definido)
```

**Selector de mes:**

```jsx
// Botones ← y → para navegar entre meses
// Estado local: { month, year } inicializado al mes actual
// Al cambiar mes → nuevo fetch a /api/reports/monthly
```

**KPI cards:**
- Ingresos: verde si > 0
- Gastos: mostrar % del ingreso debajo del monto
- Saldo: verde si positivo, rojo si negativo
- Tasa de ahorro: verde si >= 20%, amarillo si >= 10%, rojo si < 10%

---

## Página 2: `Ledger.jsx` — Ledger de transacciones (PRIORIDAD 2)

**Endpoint:** `GET /api/transactions?month=4&year=2026&category=CASA`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  [Mes ▼]  [Categoría ▼]  [Tipo ▼]      [Buscar...]  │  ← filtros
├────────────┬────────────────┬──────────┬────────────┤
│  Fecha     │  Descripción   │ Categoría│   Monto    │
├────────────┼────────────────┼──────────┼────────────┤
│  13 abr    │  Izakaya Sushi │ [GUSTOS] │  $154.220  │
│  13 abr    │  Traspaso de.. │[DEVOLUCI]│  +$77.200  │
│  ...       │  ...           │  ...     │    ...     │
└────────────┴────────────────┴──────────┴────────────┘
│  Total gastos: $X   Total ingresos: $X              │  ← footer resumen
```

**Comportamiento:**
- Ingresos (flow=INCOME) con monto en verde y prefijo `+`
- Gastos (flow=EXPENSE) con monto en rojo sin prefijo
- Click en una fila abre un panel lateral (o modal) para editar categoría y notas
- Filtro de búsqueda filtra localmente sobre los resultados ya cargados
- Filtros de mes/categoría/tipo hacen un nuevo fetch

**Componente `TransactionRow`:**
```jsx
// props: { transaction, onEdit }
// Muestra: date | description (truncado a 40 chars) | CategoryBadge | amount
// Click → llama onEdit(transaction)
```

**Panel de edición (inline, no modal):**
```jsx
// Se abre debajo de la fila seleccionada
// Campos editables: category (select), subtype (select), notes (input)
// Botón "Guardar" → PUT /api/transactions/:id
// Botón "Cancelar" → cierra el panel
```

---

## Página 3: `Categories.jsx` — Gastos por categoría (PRIORIDAD 3)

**Endpoint:** `GET /api/reports/budget-vs-actual?month=4&year=2026`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│  [Mes ▼]  [Año ▼]                                   │
├─────────────────────────────────────────────────────┤
│  Gráfico de barras horizontales (Recharts)          │
│  categoría → monto gastado vs presupuesto           │
├─────────────────────────────────────────────────────┤
│  Grilla de cards por categoría                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  CASA    │ │TRANSPORTE│ │  SALUD   │           │
│  │ $780.000 │ │ $210.000 │ │ $180.000 │           │
│  │ ████░░   │ │ ████░    │ │ ██░░░░   │           │
│  │ 39% lím. │ │ 105% ⚠  │ │ 72%      │           │
│  └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────┘
```

**Gráfico Recharts:**
```jsx
// BarChart horizontal con dos barras por categoría:
//   - Barra azul: monto gastado
//   - Barra gris (fondo): presupuesto límite
// Si no hay presupuesto, mostrar solo la barra de gasto
// Tooltip muestra: categoría, gastado, presupuesto, % usado
```

**Cards de categoría:**
```jsx
// Grid de 3 columnas (md:grid-cols-3)
// Cada card muestra:
//   - Nombre de categoría con color del CATEGORY_COLORS
//   - Monto total gastado (grande)
//   - Mini barra de progreso (color semáforo)
//   - Porcentaje usado / límite
//   - Cantidad de transacciones
// Click en card → navega a /ledger?category=CASA&month=actual
```

---

## `components/Layout.jsx` y `Sidebar.jsx`

```jsx
// Layout: sidebar fijo a la izquierda + contenido a la derecha
// <div class="flex min-h-screen">
//   <Sidebar />
//   <main class="flex-1 bg-gray-50"> {children} </main>
// </div>

// Sidebar: fondo dark (bg-gray-900)
// Links:
//   /monthly     → "Reporte mensual"
//   /ledger      → "Movimientos"
//   /categories  → "Categorías"
// Link activo: bg-gray-700 text-white, redondeado
// Footer del sidebar: botón "Importar banco" → llama api.importBank()
//   Muestra estado: "Importando..." mientras carga, luego resultado
```

---

## `App.jsx` — Rutas

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Monthly from './pages/Monthly'
import Ledger from './pages/Ledger'
import Categories from './pages/Categories'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/monthly" replace />} />
          <Route path="monthly"    element={<Monthly />} />
          <Route path="ledger"     element={<Ledger />} />
          <Route path="categories" element={<Categories />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Dependencias a instalar

```bash
npm install react-router-dom recharts
```

Tailwind ya debe estar configurado. Si no:
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

`tailwind.config.js`:
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

---

## Orden de implementación

1. **Scaffolding** — borrar `src/` actual, crear la estructura de carpetas, instalar dependencias.
2. **`lib/formatters.js` + `lib/constants.js`** — sin dependencias, base de todo.
3. **`api/client.js`** — probar que los endpoints del backend respondan.
4. **`Layout` + `Sidebar`** — estructura visual estática, sin datos.
5. **`Monthly.jsx`** — la más importante. Implementar en este orden:
   - KPI cards con datos reales
   - Selector mes/año
   - BudgetBars
   - Breakdown FIJO/VARIABLE/DISCRECIONAL
6. **`Ledger.jsx`** — tabla con filtros. El panel de edición inline va al final.
7. **`Categories.jsx`** — cards primero, gráfico Recharts después.

---

## Notas importantes

- **Nunca mostrar decimales en montos CLP.** Usar siempre `formatCLP()` — nunca `.toFixed()` directo.
- **Los amounts del API son siempre positivos.** El flow (INCOME/EXPENSE) determina si se muestra en verde o rojo, no el signo del número.
- **Estado de carga.** Cada página debe mostrar un estado de loading (skeleton o spinner simple con Tailwind) mientras espera el fetch.
- **Estado de error.** Si el fetch falla (backend apagado), mostrar mensaje claro: *"No se pudo conectar al servidor"* — nunca una pantalla en blanco.
- **Mes inicial.** Inicializar el selector al mes y año actuales usando `new Date()`.