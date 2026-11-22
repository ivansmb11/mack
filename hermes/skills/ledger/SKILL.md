---
name: mack-ledger
description: Consultar y gestionar tokens, presupuestos por agente y suscripciones (Claude, OpenAI, OpenRouter…). Úsala cuando Iván pregunte cuánto gasta, registre una suscripción o cuando un DSA exceda su presupuesto.
version: 1.0.0
metadata:
  hermes:
    tags: [mack, ledger, costs]
---

# Ledger

## Herramientas
| Necesidad | Tool |
|---|---|
| ¿Cuánto llevo este mes? | `ledger_summary` |
| Alta o cambio de una suscripción | `ledger_upsert_subscription` |
| Subir o bajar el límite de un agente | `ledger_set_budget` |

## Procedimiento ante "Budget exceeded"
1. Avísale a Iván qué agente lo excedió y cuánto lleva (`ledger_summary`).
2. Ofrécele opciones: subir el presupuesto, hacer la tarea tú o esperar al mes siguiente.
3. Solo ejecuta `ledger_set_budget` si Iván lo pide explícitamente.

## Respuesta a "¿cuánto llevo?"
Primero el total del mes en USD, luego el desglose en una o dos líneas (suscripciones vs. gasto medido por agente). Texto plano, sin tablas.

## Revisa la coherencia de las suscripciones
Compara cada fecha de renovación con la fecha de hoy (viene en el contexto de la sesión) y con la periodicidad. Una suscripción mensual que renueva en más de ~31 días suele tener mal capturado el año: señálalo, propón la fecha corregida y aplica `ledger_upsert_subscription` solo cuando Iván confirme.

## Reporte mensual
Cuando te pidan un reporte: total del mes (medido + suscripciones), top de agentes por tokens, suscripciones que se renuevan en los próximos 7 días y tokens "unpriced" (modelos sin precio en `mack.config.yaml`).
