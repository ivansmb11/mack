---
name: mack-factory
description: Diseñar y crear un Domain Specific Agent (DSA) nuevo en el Factory de Mack. Úsala cuando Iván pida un agente nuevo o cuando un dominio se repita sin DSA que lo cubra.
version: 1.0.0
metadata:
  hermes:
    tags: [mack, factory, agents]
    related_skills: [writing-for-agents, grilling, mack-ledger]
---

# Factory de DSAs

## Cuándo usarla
- Iván pide "crea un agente de X".
- Llevas 3 o más tareas del mismo dominio sin un DSA que lo cubra. Propónlo y no lo crees hasta que Iván confirme.

## Procedimiento
1. `factory_list`: revisa si ya existe un DSA o una plantilla que lo cubra. Si una plantilla sirve, usa `factory_instantiate_template`.
2. Aterriza el dominio con la skill `grilling`, máximo 3 preguntas: qué decide el DSA, qué NO debe hacer y qué entrega.
3. Redacta el spec:
   - `name`: kebab-case corto (`viajes`, `salud`, `legal-mx`).
   - `description`: una línea con el dominio y lo que entrega.
   - `domains`: entre 8 y 20 palabras clave en español e inglés, sin acentos ni mayúsculas. Matrix enruta con ellas.
   - `model`: `claude-sonnet-5-5` por defecto. Usa `claude-opus-5-5` solo si el dominio exige razonamiento profundo.
   - `packs`: `matt-pocock-engineering` si el DSA toca código; `matt-pocock-thinking` casi siempre.
   - `budget.monthlyTokens`: entre 5M y 15M salvo que Iván diga otra cosa.
   - `soul`: escríbelo siguiendo la skill `writing-for-agents`. Incluye identidad, reglas duras, formato de salida y límites (qué no hace).
4. Muéstrale el spec a Iván en un bloque YAML y pide confirmación.
5. `factory_create_dsa` con el spec. Luego `matrix_health` para confirmar que el DSA quedó arriba.

## Errores comunes
- Dominios demasiado genéricos ("ayuda", "tarea") roban tareas a otros DSAs.
- El SOUL ya trae el contrato con Matrix (respuesta final, sección "Necesito", `FUERA_DE_DOMINIO`). No lo repitas.
