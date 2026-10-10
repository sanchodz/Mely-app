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
