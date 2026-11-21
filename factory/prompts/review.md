# Revisión

Otro agente implementó esta tarea en la rama `{{BRANCH}}` (base: `{{BASE}}`):

{{TASK}}

Sigue la skill `code-review` sobre `git diff {{BASE}}...HEAD`, en sus dos ejes:
- **Standards:** ¿respeta las convenciones documentadas del repo?
- **Spec:** ¿hace exactamente lo que pide la tarea, ni más ni menos?

Corrige tú mismo cada hallazgo que sea un problema real, con la skill `tdd` cuando falten tests. Corre los tests y el typecheck, y haz commit de las correcciones. No hagas push.

Al final escribe un resumen de los hallazgos y lo que corregiste (o "sin hallazgos"), y luego exactamente:

<promise>COMPLETE</promise>
