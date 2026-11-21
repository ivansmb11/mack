---
name: mack-matrix
description: Delegar trabajo a los DSAs a través de Matrix, el orquestador. Úsala para cualquier tarea que caiga en el dominio de un DSA o que se pueda paralelizar.
version: 1.0.0
metadata:
  hermes:
    tags: [mack, matrix, orchestration]
    related_skills: [mack-dsa, mack-factory, mack-ledger, handoff]
---

# Matrix

## Matrix vs. delegate_task
- **Matrix (`matrix_*`)**: cuando hace falta un experto persistente, con su propio SOUL, skills, memoria y presupuesto.
- **`delegate_task` de Hermes**: subtareas efímeras y genéricas que no necesitan un DSA.

## Procedimiento
1. `matrix_route` con la tarea. Si `agent` es null, ningún DSA la cubre: resuélvela tú.
2. Reescribe la tarea para que sea autocontenida. El DSA no ve tu conversación con Iván. Incluye objetivo, datos, restricciones y formato esperado.
3. Para una sola tarea, `matrix_dispatch`. Para varias independientes, `matrix_fanout`, todas en una sola llamada.
4. Revisa el `status`:
   - `ok`: integra el resultado y preséntalo.
   - `out_of_domain`: resuélvelo tú o usa `mack-dsa`.
   - `error`: díselo a Iván tal cual. Si dice "Budget exceeded", aplica `mack-ledger`.

## Verificación
Nunca afirmes que un DSA hizo algo que no aparece en su `content`.
