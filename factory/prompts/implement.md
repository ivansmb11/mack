# Tarea

{{TASK}}

# Cómo trabajar

Trabajas solo, sin humano disponible, en la rama `{{BRANCH}}` de este repo. En `~/.claude/skills` tienes cargadas las skills de Matt Pocock (ingeniería y pensamiento). Úsalas en lugar de improvisar tu propio método.

0. **Configura el repo para las skills.** Si no existe `docs/agents/issue-tracker.md`, abre `~/.claude/skills/setup-matt-pocock-skills/SKILL.md` y síguelo de principio a fin. No hay nadie a quien preguntarle, así que en cada pregunta toma la opción recomendada:
   - Issue tracker: GitHub si `git remote -v` apunta a github.com, GitLab si apunta a GitLab, y markdown local en `.scratch/` en cualquier otro caso.
   - Etiquetas de triage: las de default.
   - Docs de dominio: single-context, salvo que el repo sea un monorepo.
   - Archivo de agente: edita `CLAUDE.md` si existe; si no, `AGENTS.md`; si no existe ninguno, crea `CLAUDE.md`.
   - No crees etiquetas remotas ni hagas push. Haz commit de esa configuración en un commit propio (`chore: configure Matt Pocock skills`).
1. Si la tarea es un link o número de issue, léelo completo con `gh issue view <n> --repo <owner/repo> --comments` (`GH_TOKEN` ya está en el entorno). Si `gh` falla, dilo en el resumen en vez de adivinar el ticket por el historial de git. Si el issue ya está cerrado o el trabajo ya está en `{{BASE}}`, no reimplementes: verifícalo, resúmelo y termina.
2. Lee `CLAUDE.md`, `AGENTS.md`, `docs/agents/*.md` y `GLOSSARY.md` si existen (skill `domain-modeling`).
3. Si la tarea es un spec o un ticket, sigue la skill `implement`. En todos los casos implementa con la skill `tdd`: escribe un test que falle, luego el mínimo código que lo pase, luego refactoriza.
4. Si encuentras un bug que no entiendes, usa `diagnosing-bugs` y reprodúcelo antes de intentar arreglarlo.
5. Diseña con `codebase-design`: módulos profundos con interfaces pequeñas.
6. Corre la suite de tests y el typecheck del proyecto antes de cada commit. No hagas commit si algo falla.
7. Haz commits pequeños con mensajes claros. No hagas push, no cambies de rama y no toques otras ramas.

# Cuándo terminar

Cuando la tarea esté completa y pasen los tests y el typecheck, escribe un resumen de 3 a 5 líneas de lo que hiciste y luego exactamente:

<promise>COMPLETE</promise>

Si estás bloqueado (falta información, la tarea es ambigua o hay una dependencia rota), explica el bloqueo en el resumen y termina igual con la señal. No inventes requisitos.
