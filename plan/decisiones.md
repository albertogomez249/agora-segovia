# Decisiones que no se vuelven a discutir

Una decisión sin escribir se vuelve a tomar cada mes, y normalmente al revés.
Aquí van las que ya están tomadas, con lo que cuestan — porque una decisión
cuyo coste no está escrito parece gratis, y entonces alguien la revoca el día
que el coste duele.

---

## Los planes no se publican en un tablón

**Fecha:** 25 de noviembre de 2026.
**Decidido por:** Alberto, contra una recomendación explícita del plan de
lanzamiento.

El plan de lanzamiento propone que el producto mínimo sea un tablón público de
planes concretos a los que les falta gente: *«Fútbol 5v5, jueves 19:00, faltan
2»*. Es una buena recomendación y resuelve un problema real. **No se hace.**

En Ágora un plan es privado y va por código: lo compartes con quien tú eliges,
y nadie más se entera de que vas. Eso no fue un accidente de implementación,
está escrito en el esquema desde el principio:

> La implementación obvia es la equivocada: un grafo de amigos, o «gente como
> tú también fue», significaría contarle a unos estudiantes los movimientos de
> otros, y este producto promete recuentos y nunca nombres.

Un tablón de «faltan 2» es exactamente eso: estudiantes anunciando dónde van a
estar, a gente que no han elegido, en una ciudad de 4.000 donde todos se
cruzan. En una residencia de primer año el coste de eso no lo paga la app, lo
paga quien aparece en el tablón.

### Lo que esta decisión cuesta

No es gratis y conviene no fingir que lo es. El plan de lanzamiento tiene
razón en el diagnóstico: **una app social con densidad baja parece vacía, y
vacío es mortal.** Sin tablón, un estudiante que entra el primer día no ve
señal alguna de que haya alguien más dentro. Ese es el precio.

### La salida que sí cabe dentro de la decisión

Contar sin nombrar. La app ya tiene el mecanismo y ya lo cumple: `_uses()`
devuelve cuánta gente ha usado algo, y **por debajo de cinco no devuelve
nada**, forzado en la capa de consulta para que ninguna pantalla pueda
saltárselo. Hoy mira al pasado («N estudiantes han usado esto»).

Lo mismo mirando adelante da la señal de vida sin romper nada, y **ya está
construido** (25 de noviembre, commit `e7998d6`): a partir de cinco, sin un
solo nombre y sin decir quién. Un recién llegado ve que el sitio está vivo;
nadie queda expuesto.

Dos precisiones que importan más que el número:

- **Un evento tiene fecha, una oferta no.** El recuento de un evento habla de
  verdad de lo que viene. Un plan sobre una oferta es solo «vamos a usar
  esto», así que ahí la ventana son tres semanas y la ficha lo dice con todas
  las letras. Llamarlo «lo que viene» sería una mentira pequeña, y el único
  valor de este número es que se pueda tomar al pie de la letra.
- **El umbral vive en la consulta, no en la pantalla.** Una pantalla puede
  olvidarse; una consulta no. Y la batería de casos de uso no comprueba que el
  número salga: comprueba que no salga nunca cuando sería lo bastante pequeño
  como para adivinar quién, y que no viaje con él ningún identificador.

### Lo que esto no resuelve

La densidad de la cohorte. Si el lanzamiento es en una residencia o en un
curso de primero, el problema de arranque en frío se resuelve por ahí —gente
que ya se cruza a diario— y no por el diseño de la pantalla. Esa parte del
plan de lanzamiento sigue en pie y no depende de esta decisión.
