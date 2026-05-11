# CLAUDE.md — Arasaka Design System & UX Guidelines

Este documento define el look-and-feel y patrones de UX del proyecto **Arasaka** (app de control financiero personal). Cualquier elemento nuevo debe seguir estas reglas para mantener la coherencia visual y de interacción.

---

## 1. Filosofía

Arasaka es una app **densa, oscura, minimalista y editorial** — inspirada en interfaces tipo terminal/dashboard financiero pro. Nada de gradientes llamativos, emojis decorativos, ilustraciones, ni AI-slop. La estética es **dorada sobre negro**, con tipografía limpia y mucho uso de monoespaciada para números.

Principios:
- **Densidad informativa controlada**: mucha data, pero respirada con espaciados consistentes.
- **Color con propósito**: el dorado (`--accent`) es el único color cálido; verde/rojo solo para ingresos/egresos o estados.
- **Tipografía como jerarquía**: nunca usar más de 2-3 tamaños por pantalla.
- **Microinteracciones sutiles**: hover states con transiciones 200ms, sin animaciones llamativas.

---

## 2. Tokens (CSS Variables)

```css
:root {
  /* Surfaces */
  --bg:        #0c0c0e;           /* fondo app */
  --surface:   #141416;           /* cards principales */
  --surface2:  #1c1c20;           /* cards anidadas, inputs */
  --border:    #272729;           /* todos los bordes */

  /* Accent (dorado) */
  --accent:     #c9a84c;
  --accent-dim: rgba(201,168,76,.12);

  /* Estados */
  --green: #4caf7d;               /* ingresos, positivo */
  --red:   #e05c5c;               /* egresos, peligro */

  /* Tipografía */
  --text:       #f0ede6;          /* texto principal */
  --text-muted: #88888f;          /* labels, secundario */
  --text-dim:   #44444a;          /* terciario, deshabilitado */

  /* Type families */
  --font: 'Space Grotesk', sans-serif;
  --mono: 'DM Mono', monospace;

  /* Geometría */
  --r: 10px;                      /* border-radius base */
  --t: 200ms ease;                /* transición default */
}
```

**Regla:** nunca inventes colores nuevos. Si necesitas una variante, usa la variable + opacidad hex (`var(--accent) + 28` para 16% alpha, ej. fondos de chips).

### Paleta de categorías (CCOLORS)
Cada categoría tiene un color fijo. No los cambies; reutilízalos para coherencia visual entre vistas:
```js
CASA:'#c9a84c', PERSONAL:'#9b7fd4', SALUD:'#4caf7d', INVERSION:'#4cb8af',
PATRIMONIO:'#af4c8a', TRANSPORTE:'#d4884c', SUSCRIPCIONES:'#80af4c',
GUSTOS:'#e07c5c', OTROS:'#888', SUELDO:'#50b87a', DEVOLUCION:'#4cb8af',
MASCOTA:'#c9784c', REGALO:'#c94c8a', SEGUROS:'#7c9faf', VACACIONES:'#afb04c',
```

---

## 3. Tipografía

- **Body / UI**: `Space Grotesk`, 400/500/600/700.
- **Números, montos, fechas, keys**: `DM Mono`, 300/400/500.
- **Idioma**: español (es-CL). Montos en CLP sin decimales (`new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0})`).

Escalas comunes:
| Uso | Size | Weight |
|---|---|---|
| Hero (patrimonio total) | 48px mono | 700 |
| Page title (`.ph-title`) | 22px | 600 |
| Card title | 11px upper, letter-spacing .07em | 600, `--text-muted` |
| Stat label | 10px upper, letter-spacing .08em | 600, `--text-muted` |
| Stat value | 16-20px mono | 500-700 |
| Body / inputs | 13px | 400-500 |
| Helper text | 11-12px | 400, `--text-muted` o `--text-dim` |
| Micro labels (uppercase chips) | 9-10px, letter-spacing .04-.07em | 700 |

---

## 4. Componentes patrón

### Card
```jsx
<div className="card">
  <div className="card-title">Título En Mayúscula</div>
  {/* contenido */}
</div>
```
- Fondo `--surface`, borde `--border`, radius `--r`, padding 24px.
- Para variantes destacadas: `borderColor: 'rgba(201,168,76,.25)'`.

### Stat tile
```jsx
<div className="stat">
  <div className="stat-lbl">Ingresos</div>
  <div className="stat-val" style={{color:'var(--green)'}}>{clp(amount)}</div>
  <div className="stat-delta up">+12% vs mes anterior</div>
</div>
```

### Tag / chip
- Pequeño (fontSize 10-11px), uppercase, letter-spacing .04em, `fontWeight:700`.
- Fondo: color de categoría + opacidad 28 hex. Borde: color + 44/66 hex. Texto: color sólido.
- Siempre con `<CatIcon cat={tag} size={10-12}/>` al inicio.

### Botones
- **Primario** (`.btn-gold`): fondo `--accent`, texto `#0c0c0e`, peso 700, radius 7px.
- **Ghost** (`.btn-ghost`): transparente, borde `--border`, texto `--text-muted`. Hover → texto `--text`.
- **Destructivo**: fondo `--red`, texto blanco, mismas dimensiones que el gold.
- Padding: `8px 20px` (small) / `9px 24px` (default).
- Nunca uses sombras de elevación en botones planos.

### Inputs
- Fondo `--surface2`, borde `--border`, radius 7px, padding 9px 13px, fontSize 13px.
- Focus: `border-color: var(--accent)`. Sin shadow ni outline.
- Placeholders en `--text-dim`.

### Modal / overlay
- Overlay: `rgba(0,0,0,.75)` + `backdrop-filter: blur(6px)`.
- Modal: fondo `--surface`, radius 14px, padding 32px, max-width 500-720px según contenido.
- Footer con `.mfooter` (flex justify-end gap 10px).
- Esc cierra; Enter confirma cuando aplique.

### Confirmaciones destructivas
Usa el patrón de `<ConfirmDialog>`:
- Ícono en círculo coloreado arriba (48px, color al 18%/55% alpha).
- Título 18px bold.
- Caja `details` con fondo `--surface2`: pares label-valor (valor en mono).
- Banner `warning`: fondo `color + 10`, borde lateral 2px del color, ícono triángulo.
- Botones: Cancelar (ghost) + acción (rojo/dorado).

### Tooltips informativos
Para explicar conceptos (Patrimonio, Tasa de ahorro, etc.):
- Ícono "(i)" 15px circular en `--text-dim` (hover → `--accent`).
- Popover oscura con triangulito apuntando al ícono.
- Header con línea + título uppercase en dorado.
- Contenido: descripción → fórmula en mono (caja `--surface2`) → rangos con dots de color → nota al pie en itálica.
- En mobile: tap toggle (registrar Esc/Enter handlers solo cuando esté abierto).

---

## 5. Layout

- **Sidebar fijo** 224px izquierda. Sección de navegación con `.nav-item` (radius 7px, gap 2px).
  - Hover: `background: --surface2`.
  - Activo: `background: --accent-dim`, `color: --accent`, `border-color: rgba(201,168,76,.18)`.
- **Main**: padding 40px 48px. En tablet 28px, en mobile top-bar fijo + padding 72px 16px 24px.
- **Grids**: usa `display: grid` + `gap` (nunca margins entre cards). Patrones:
  - Stats: `grid-template-columns: repeat(4, 1fr); gap: 14px`.
  - Charts row: `grid-template-columns: 1fr 1fr; gap: 14px`.
  - Cards responsivos: `grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`.

### Responsive breakpoints
- `1100px` → sidebar 200px, stats 2 cols.
- `768px` → sidebar oculto, hamburger top-bar, charts 1 col, modals 1 col.
- `480px` → stats 1 col.

---

## 6. Charts (Chart.js)

Configuración base obligatoria:
```js
{
  plugins: { legend: { labels: { color:'#888', font:{size:11, family:'Space Grotesk'} } } },
  scales: {
    x: { ticks:{color:'#666',font:{size:11}}, grid:{color:'rgba(255,255,255,.04)'} },
    y: { ticks:{color:'#666',font:{size:11}}, grid:{color:'rgba(255,255,255,.04)'} }
  }
}
```
- Border-radius 4px en barras.
- Líneas: `tension: .4`, `pointRadius: 4`, `fill: true` con fondo del color a 22 alpha.
- Donut: `cutout: '62%'`, legend a la derecha.

---

## 7. Iconografía

- **Sin emojis** en UI productiva. Reservados solo para microestados (📄 badge en pagos ligados).
- **Sin librerías de íconos** externas. Usa SVGs inline 24×24, `stroke="currentColor"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`.
- Para categorías, usa el componente `<CatIcon cat={CAT} size={12} color={...}/>`.
- En sidebar, glifos Unicode geométricos (`⬡ ◫ ◈ ◧ ≡ ◎ ⇄ ◉`) en `--text-muted`.

---

## 8. Microinteracciones

- **Transiciones**: siempre `var(--t)` (200ms ease). Nunca uses spring/bounce.
- **Hover en cards**: `border-color` cambia a tono del acento al 25-99%.
- **Hover en filas de tabla**: `background: --surface2`.
- **Animación de entrada**: aplica `className="fade"` para fade-in 260ms con translateY(5px → 0).
- **Sin hover scale** ni shadows dramáticas. Solo color shifts y border highlights.

---

## 9. Convenciones de código

- **Stack**: React 18 + JSX inline via Babel (`<script type="text/babel">`). Sin bundler.
- **Persistencia**: `localStorage` via helpers `ls(key, default)` y `ss(key, value)` (en `shared.jsx`).
- **Estilos**: mayormente inline (`style={{...}}`) salvo clases compartidas en el `<style>` de `Arasaka v2.html`.
- **Componentes globales**: cada `*.jsx` registra sus exports en `window` con `Object.assign(window, {...})` al final.
- **Helpers compartidos** (todos en `shared.jsx`):
  - `clp(n)` → formato moneda CLP
  - `fmtK(n)` → 12.5k, 1.2M (para charts)
  - `fmtDate(ds)` → "Hoy" / "Ayer" / "lunes, 5 de mayo"
  - `today()` → ISO YYYY-MM-DD
  - `pct(a,b)` → porcentaje redondeado
  - `withBalance(movs, init)` → arr con `saldo` acumulado
  - `getMonthMovs(movs, y, m)`, `sumType`, `sumCat`, `sumCatTags`
  - `getMovTags(m)`, `getMovColor(m)`, `getMovPrimary(m)` — backward-compat con `categoria` legacy

---

## 10. Patrones de UX

### Selección de período
Toggle 3-state: **Mes / Año / Todo**. Botones `.tbtn` adentro de `.toggle`. Estado activo con color verde (`ti`) o rojo (`te`).

### Navegación temporal
Flechas `‹ ›` con clase `.nav-arrow` (32×32, radius 6, borde sutil, hover dorado). Label centrado entre flechas, `fontSize:13-14, fontWeight:600, minWidth:100`.

### Edición inline vs modal
- **Modales** para crear/editar registros completos (movimientos, cuentas, deudas, importación TC).
- **Inline** para tweaks rápidos: presupuestos por categoría se editan al hacer hover/click en la fila.

### Estados vacíos
```jsx
<div className="empty">
  <h3>Título sin signos de exclamación</h3>
  <p>Una línea explicando qué falta.</p>
  <button className="btn-gold">CTA primario</button>
</div>
```
- Centrados, padding 72px 40px. Sin ilustraciones.

### Drill-downs
Patrón: lista clickeable → fila se expande con borde y bg tintado del color de la categoría → card de detalle aparece abajo con `className="fade"` y key dinámico para re-animar.

### Tablas
- Header: `.surface2`, uppercase 10px, letter-spacing .07em.
- Filas: `border-bottom: 1px solid rgba(39,39,41,.7)`, padding 11px 16px.
- Fila completa clickeable (cursor pointer) cuando lleva a edición.
- Columna de monto: alineada derecha, mono, color por signo.

---

## 11. Tweaks panel

Cualquier nueva configuración global va en el panel `<Tweaks>` (bottom-right, 240px). Sigue el protocolo:
- Escucha `__activate_edit_mode` / `__deactivate_edit_mode`.
- Posta `__edit_mode_available` al montar.
- Usa `.tweak-row` con `.tweak-lbl` + control.

---

## 12. Anti-patrones (NO HACER)

- ❌ Gradientes de fondo, glassmorphism, neumorphism.
- ❌ Sombras grandes (`box-shadow: 0 20px 60px`).
- ❌ Emojis decorativos en labels o títulos.
- ❌ Inventar colores fuera de las variables CSS.
- ❌ Animaciones con bounce, spring o duraciones >300ms.
- ❌ Texto centrado en cards (solo en estados vacíos o números hero).
- ❌ Border-radius grandes (>14px). El máximo es 14 en modales, 10 en cards, 7 en inputs/botones, 6 en chips/badges.
- ❌ Iconos a color sin propósito. Si es decorativo, fuera.
- ❌ Capitalizar oraciones completas. Solo labels micro van en uppercase.

---

## 13. Checklist al entregar un componente nuevo

- [ ] Usa solo variables CSS del tema (no hex hardcoded fuera de CCOLORS).
- [ ] Tipografía respeta la escala (mono para números, sans para texto).
- [ ] Padding/gap múltiplos de 4 o 8.
- [ ] Hover con transición `var(--t)` y cambio de border-color (no scale).
- [ ] Estado de loading/vacío contemplado.
- [ ] Responsive verificado en 768px y 480px.
- [ ] Esc cierra modales; Enter confirma cuando aplique.
- [ ] Funciona con `localStorage` persistente.
- [ ] Sin console errors.
- [ ] Texto en español (es-CL); montos con `clp()`.
