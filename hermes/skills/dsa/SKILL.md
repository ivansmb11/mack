---
name: mack-dsa
description: Diseñar y crear un Domain Specific Agent (DSA) nuevo. Úsala cuando Iván pida un agente nuevo o cuando un dominio se repita sin DSA que lo cubra.
version: 1.0.0
metadata:
  hermes:
    tags: [mack, dsa, agents]
    related_skills: [writing-for-agents, grilling, mack-ledger, mack-factory]
---

# Creación de DSAs

## Cuándo usarla
- Iván pide "crea un agente de X".
- Llevas 3 o más tareas del mismo dominio sin un DSA que lo cubra. Propónlo y no lo crees hasta que Iván confirme.

## Procedimiento
Las tools `dsa_*` y `matrix_*` son diferidas: carga su schema con `tool_describe` y llámalas con `tool_call`.

1. `dsa_list`: revisa si ya existe un DSA o una plantilla que lo cubra. Vuelve a correrlo justo antes de crear (paso 5): el agente puede haberse instanciado ya desde otra sesión. Si existe con ese nombre, no crees otro; verifica que esté arriba y díselo a Iván con la hora de creación.
   - Si hay plantilla: resúmela en lenguaje llano (enfoque, modelo y tope de tokens, reglas del soul, límites como toolsets deshabilitados), haz las 3 preguntas de ajuste y ofrece el atajo "dime créalo y lo creo tal cual; luego ajustamos". Iván suele aceptar la plantilla sin contestar las preguntas: si confirma, `dsa_instantiate_template` sin overrides y salta al paso 5.
2. Sin plantilla: aterriza el dominio con la skill `grilling`, máximo 3 preguntas: qué decide el DSA, qué NO debe hacer y qué entrega.
3. Redacta el spec:
   - `name`: kebab-case corto (`viajes`, `salud`, `legal-mx`).
   - `description`: una línea con el dominio y lo que entrega.
   - `domains`: entre 8 y 20 palabras clave en español e inglés, sin acentos ni mayúsculas. Matrix enruta con ellas.
   - `model`: `claude-sonnet-5-5` por defecto. Usa `claude-opus-5-5` solo si el dominio exige razonamiento profundo.
   - `packs`: `matt-pocock-engineering` si el DSA toca código; `matt-pocock-thinking` casi siempre.
   - `budget.monthlyTokens`: entre 5M y 15M salvo que Iván diga otra cosa.
   - `soul`: escríbelo siguiendo la skill `writing-for-agents`. Incluye identidad, reglas duras, formato de salida y límites (qué no hace).
   - `avatar` y `color`: su cara en el dashboard. Si Iván pidió una forma o color, ponlos. Si no, omítelos: Mack recomienda una forma según los dominios (bull para finanzas, witch-hat para código, shield para legal…) y un color que ningún otro bot tenga con esa forma. Formas: bull, witch-hat, cloud, shield, brain, magnifier, book, rocket, chat, lightbulb, paint-brush, palette, camera, barbell, egg, mug, sprout, watering-can, cat, bunny, controller, star, ghost.
4. Muéstrale el spec a Iván y pide confirmación. En canales de texto plano (api_server) usa prosa y líneas "Campo: valor", no bloques YAML ni markdown.
5. `dsa_create` con el spec (o la instanciación de plantilla). Luego `matrix_health` para confirmar que el DSA quedó arriba y un `matrix_dispatch` corto de prueba ("preséntate: qué haces y qué datos necesitas para empezar"); no digas "listo" sin ambos. La respuesta de prueba da la lista de datos a pedirle a Iván y los tokens que gastó.
6. Cierra en corto: qué quedó creado, qué temas le vas a enrutar y el siguiente paso concreto. Si el DSA depende de datos de Iván (estados de cuenta, Sheets, XML, repos), pídele la primera fuente y propón la primera tarea; sin datos solo da consejo genérico.
7. Aclara cómo se usa: el DSA ya aparece como bot en el dashboard, con su propio chat continuo; Iván puede escribirle directo, meterlo a un grupo y mencionarlo con @nombre, o seguir pidiéndole cosas a Mack, que enruta. Cuando Mack despacha, el DSA no ve esta conversación, así que todo dato que Iván comparta se reenvía íntegro.
8. Primera toma de datos: cuando Iván diga "sí", pide una lista numerada corta (máx. 3-5 rubros) con ejemplos de formato libre ("renta 12,000, luz 600") y aclara que aproximado sirve; Mack ordena y despacha. No despaches hasta tener datos.

## Errores comunes
- Dominios demasiado genéricos ("ayuda", "tarea") roban tareas a otros DSAs.
- El SOUL ya trae el contrato con Matrix (respuesta final, sección "Necesito", `FUERA_DE_DOMINIO`). No lo repitas.
