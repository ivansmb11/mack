# Tarea

{{TASK}}

# Cómo trabajar

Trabajas solo, sin humano disponible, en la rama `{{BRANCH}}` de este repo. Tienes instaladas las skills de ingeniería de Matt Pocock: úsalas, no improvises un método propio.

1. Lee primero `CLAUDE.md` / `AGENTS.md` / `CONTEXT.md` si existen, y el `GLOSSARY.md` si hay uno (skill `domain-modeling`).
2. Si la tarea es un spec o un ticket, sigue la skill `implement`. En cualquier caso, implementa con la skill `tdd`: un test que falla → el mínimo código que lo pasa → refactor.
3. Si encuentras un bug que no entiendes, usa `diagnosing-bugs`: primero reprodúcelo.
4. Diseña con `codebase-design`: módulos profundos, interfaces pequeñas.
5. Corre la suite de tests y el typecheck del proyecto antes de cada commit. No hagas commit en rojo.
6. Haz commits pequeños con mensajes claros. No hagas push, no cambies de rama ni toques otras ramas.

# Cuándo terminar

Cuando la tarea esté completa y los tests y el typecheck pasen, escribe un resumen de 3 a 5 líneas de lo que hiciste y luego exactamente:

<promise>COMPLETE</promise>

Si estás bloqueado (falta información, la tarea es ambigua o hay una dependencia rota), explica el bloqueo en el resumen y termina igual con la señal. No inventes requisitos.
