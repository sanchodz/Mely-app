# Tienda FINDY — planes, beneficios y pendientes

Fecha: 2026-10-10. Base: código de este repo (`src/components/store/`).

## Qué cambió en la Tienda

Orden de lectura nuevo, de arriba hacia abajo:

1. **Tu plan** (`CurrentPlanPanel`): plan actual, vencimiento, saldo, lo incluido
   con su cupo restante (`GET /shop/perks`) y bono diario.
2. **Planes** (`PlansSection`):
   - **Tu próximo paso**: el escalón siguiente al plan actual, con lo que *suma*
     a lo que ya tenés. Reemplaza al "Más popular" fijo, que no tenía datos detrás.
   - **Otros planes**: tarjetas con precio, duración, costo por día y "Todo lo de X, y además…".
   - **Compará los planes**: tabla real Gratis / Plus / Gold / Black.
   - **Ahorro de Black**: solo aparece si los precios reales de `/shop` lo confirman
     (Black frente a 3 × Gold). Si no hay ahorro, no se muestra nada.
3. **Poderes** (`PowersSection`): estado claro de cada uno (activo con tiempo restante,
   incluido en tu plan con usos restantes, o precio en coins).
4. **Coins** (`CoinsSection`): paquetes con aviso de demo visible, cómo ganar coins
   (motivos reales del ledger, sin inventar montos), código promocional y movimientos.
5. **Confirmación** (`PurchaseDialog`): qué obtenés, precio, saldo y cuánto te queda
   o te falta. Si no alcanza, ofrece ir a Coins. Sin contadores ni urgencia.

No se tocaron contratos de API, la paleta ni Descubrir, Matches o Chats.

## Ronda 2 (2026-10-14): de lista de features a decisión de compra

- **Beneficio → resultado**: cada beneficio de plan dice qué es y para qué te sirve
  (`PlanBenefit` en `storeCatalog.ts`). Mismos beneficios que antes, sin agregar ninguno.
- **Una tarjeta para todos los planes**: la destacada (próximo paso) sube primera en
  mobile; en desktop los tres planes van en fila (Plus → Gold → Black) y la tabla a lo ancho.
  Un plan inferior al tuyo baja al final en mobile.
- **Saldo frente a precio antes de decidir**: "Te alcanza con tu saldo" / "Te faltan N coins".
- **Confirmación con fecha**: "Vence el …" o "Nuevo vencimiento" (renovar suma días).
- **Poderes**: "para cuándo conviene" + "Incluido desde Gold: ilimitado →" leído de la
  tabla comparativa (`includedFrom`, una sola fuente).
- **Coins con valor**: cada paquete dice qué alcanza a comprar (plan o N usos del poder
  más barato) y cuántas coins más por dólar da frente al más chico (solo si es > 0).
- **Sin coins no se corta la compra**: "Conseguir coins" lleva a Coins con un aviso de
  cuánto falta y marca el paquete más chico que lo cubre; al recargar, el recibo ofrece
  "Continuar con <plan>" y reabre la confirmación.
- **Recibo con destino**: después de comprar, "Ir a Descubrir" / "Ver quién te dio like".
- **Estados**: saldo en skeleton (antes mostraba 0), skeleton/errores de paquetes e
  historial (antes decía "sin movimientos" mientras cargaba), spinner por paquete,
  canje y bono. Tabs con flechas/Inicio/Fin (patrón WAI-ARIA).
- **Desktop**: la Tienda usa `.app-page--wide` (1040px desde 1024px) y el header la acompaña.

## Analítica (instrumentada, sin proveedor)

`src/components/store/storeAnalytics.ts` emite `window` `CustomEvent('findy:analytics')`
sin datos personales. Falta conectar un proveedor.

| Evento | Cuándo | Para medir |
|---|---|---|
| `store_viewed` | entrar a la tienda (con saldo cargado) | denominador de todo el embudo |
| `store_tab_changed` | cambio de pestaña | qué decisión buscan |
| `store_compare_viewed` | la tabla entra en pantalla | si la decisión no fue obvia |
| `store_item_selected` | abrir confirmación (`source`: featured/card/power, `affordable`) | peso del "próximo paso" |
| `store_purchase_confirmed` / `_succeeded` / `_failed` / `_cancelled` | confirmación | conversión y errores |
| `store_insufficient_coins` | "Conseguir coins" | fricción por saldo |
| `store_pack_selected` (`recommended`) / `store_recharge_succeeded` | recarga | valor de la recomendación de paquete |
| `store_resume_after_recharge` | "Continuar con …" | recuperación de compras cortadas |
| `store_daily_bonus_claimed` / `store_promo_redeemed` | ganar coins gratis | engagement |

Métricas: `item_selected / viewed`, `purchase_succeeded / item_selected`,
`resume_after_recharge / insufficient_coins`, ingreso en coins por usuario activo.

## Experimentos propuestos

1. **Pestaña inicial**: Planes (hoy) vs. Poderes para usuarios Gratis sin compras previas.
   Métrica: primera compra en 7 días.
2. **Resultado vs. feature**: beneficios con `outcome` (hoy) vs. solo título. Métrica: `item_selected / viewed`.
3. **Paquete recomendado**: marcar el que cubre lo que falta (hoy) vs. no marcar. Métrica:
   `resume_after_recharge / insufficient_coins`.
4. **Black con ahorro arriba**: mostrar el ahorro real en la tarjeta destacada para usuarios Gold.

Sin métricas reales no se puede afirmar que la conversión subió: estos son los cortes para saberlo.

## Matriz de beneficios (lo que muestra la UI)

| Beneficio | Gratis | Plus (7 d) | Gold (30 d) | Black (90 d) |
|---|---|---|---|---|
| Historias por día | cupo base | +20 | casi sin límite | casi sin límite |
| Perfil destacado | — | ✓ | ✓ | ✓ |
| Ver quién te dio like | con coins | ✓ | ✓ | ✓ |
| Boost | con coins | 1/semana | 1/semana | 1/semana |
| Deshacer pass | con coins | con coins | ilimitado | ilimitado |
| Super Spark | con coins | con coins | 3/mes | 3/mes |
| Reactivar match | con coins | con coins | 1/mes | 1/mes |
| Coins por cita verificada | normal | normal | normal | doble |
| Coins de bienvenida | — | — | — | 300 |
| Sello Black y temas de chat | — | — | — | ✓ |
| Bono diario | ✓ | ✓ | ✓ | ✓ |

⚠️ **Dependencia**: esta matriz vive en `src/components/store/storeCatalog.ts` y tiene
que coincidir con `MEMBERSHIP_PERKS` y `membershipDiscoverBonus` del backend. El
frontend no puede verificarlo solo: si el backend cambia, hay que actualizar ese archivo.

## Propuestas que requieren backend (NO implementadas)

| Propuesta | Por qué | Qué hace falta |
|---|---|---|
| Beneficios y duración desde `/shop` | Eliminar la copia manual en el frontend (riesgo de que difiera) | Agregar `durationDays` y `benefits[]` a cada ítem de `GET /shop` |
| Cobro real de coins | Hoy las recargas son demo | Pasarela de pago y webhooks (ver worktree `link-de-pago`) |
| "Más popular" con datos | Solo se puede afirmar con datos | Conteo de compras por plan expuesto por la API |
| Monedas mensuales incluidas | Valor recurrente por plan | Crédito periódico por tier en el backend |
| Super Sparks en Plus | Diferenciar mejor Plus de Gratis | Ajustar `MEMBERSHIP_PERKS` |
| Precios de miembro en Poderes | Beneficio exclusivo dentro de la tienda | Precio por tier en `/shop` y validación en `/shop/purchase` |

Descartado a propósito: cobrar los filtros que hoy son gratis (solo verificados, con
audio). Quitar algo gratis para venderlo es el tipo de patrón que FINDY evita.
