---
name: mack-factory
description: Mandar trabajo de código al Factory, donde agentes Claude Code AFK corren en sandboxes Docker (Sandcastle) con las skills de Matt Pocock. Úsala cuando Iván pida implementar, arreglar o refactorizar algo en uno de sus repos.
version: 1.0.0
metadata:
  hermes:
    tags: [mack, factory, sandcastle, code]
    related_skills: [mack-matrix, mack-ledger, handoff]
---

# Factory (Sandcastle)

## Qué es
Cada trabajo es un agente Claude Code que corre solo dentro de un contenedor Docker, en su propia rama `mack/<job>` del repo. Trae montadas las skills de ingeniería de Matt Pocock (`tdd`, `implement`, `code-review`…). Nunca hace push ni toca la rama donde está Iván. El merge lo decide Iván.

## Cuándo usar Factory y cuándo el DSA `dev`
- **DSA `dev` (vía Matrix):** pensar. Aterrizar una idea (`to-spec`), partirla en tickets (`to-tickets`), revisar diseño, diagnosticar.
- **Factory:** ejecutar. Cada ticket ya claro se convierte en un trabajo.

## Procedimiento
1. Asegúrate de tener la ruta absoluta del repo (bajo `~/repos`). Si no la sabes, pregúntala.
2. Si la tarea es vaga, pásala primero por `dev` con `matrix_dispatch` y pídele un spec y tickets.
3. Por cada ticket independiente, llama a `factory_build` con:
   - `task`: el ticket completo y autocontenido, con sus criterios de aceptación. El agente no ve esta conversación.
   - `workflow`: `implement-review` (default) para que un segundo pase con `code-review` revise y corrija; `implement` para cambios triviales.
   - `setupCommand` si el repo lo necesita (`npm ci`, `pnpm i --frozen-lockfile`…).
4. Avísale a Iván qué trabajos encolaste (id y rama). No esperes en silencio.
5. Revisa con `factory_jobs`:
   - `done`: reporta la rama y los commits, más el resumen del final de `output`.
   - `incomplete`: se agotaron las iteraciones. Reporta lo que alcanzó y propón reintentar con más `maxIterations` o con un ticket más chico.
   - `failed`: reporta el `error` tal cual.

## Errores comunes
- Tickets que dependen entre sí, encolados en paralelo: termina uno antes de mandar el siguiente.
- Varios trabajos tocando los mismos archivos: generan conflictos al hacer merge. Mejor hazlos en secuencia.
