# Cada número del plan, y de dónde sale

Tres estados, y solo tres:

- **Medido** — lo comprobamos en una fuente primaria y se puede volver a
  comprobar. Lleva el enlace.
- **Reportado** — alguien nos lo dijo. Encuestas, entrevistas, visitas. Es
  real como dato de lo que la gente *dice*, no como medida de lo que hace.
- **Supuesto** — no tenemos nada. Lo pusimos porque hacía falta un número.

Un supuesto bien etiquetado no es una debilidad del plan: es la lista de lo
que hay que ir a averiguar, en orden. Lo que hunde un plan es el supuesto
disfrazado de medida.

---

## El mercado

| Número | Qué dice | Estado | De dónde |
|---|---|---|---|
| 99,1 % | Impacto socioeconómico de IE en Segovia | **Medido** | Informe PwC 2025, encargado por IE University, curso 2023-24. No es nuestro |
| 4.000 estudiantes | Los dos campus de Segovia | **Reportado** | Cifra que manejan las universidades; no la hemos verificado contra matrícula oficial |
| 418 locales | Negocios de ocio en Segovia | **Supuesto** | No consta de dónde salió. Hay que rehacerlo o quitarlo |
| 42 negocios | Visitados a pie | **Medido** | Los visitamos nosotros |
| 31 de 42 | Ya hacen precio de estudiante, informalmente | **Medido** | De esas mismas visitas |

## Lo que dicen los estudiantes

Todo esto viene del mismo sitio: 312 cuestionarios en los dos campus entre
septiembre y noviembre, más 23 entrevistas. **Es investigación de campo hecha
por estudiantes, no una muestra representativa.** Léase como la forma de un
problema, no como una medición.

| Número | Qué dice | Estado |
|---|---|---|
| 87 % | No sabe nombrar tres sitios con descuento de estudiante | **Reportado** — está en nuestra web, atribuido a esta investigación |
| €142/mes | Gasto medio en salir | **Reportado** — ídem |

### Tres números que circulan y no son nuestros

Esto lo comprobé al escribir esta tabla, y es la razón de escribirla. El
**92 %** que cancela planes, el techo de **€7,40** y el **4 %** que pagaría más
de €15 aparecen en el documento de lanzamiento como si fueran base del
proyecto. **No están en ningún material nuestro**: ni en la web, ni en las tres
páginas de idioma, ni en la investigación. Los busqué uno por uno.

| Número | Estado |
|---|---|
| 92 % cancela planes | **Procedencia desconocida** — no consta en nuestra investigación |
| €7,40 de techo | **Procedencia desconocida**. El documento dice *declarado*, que es la palabra correcta si salió de una encuesta: lo que alguien dice que pagaría y lo que paga son dos números, y el segundo solo se sabe cobrando |
| 4 % pagaría >€15 | **Procedencia desconocida** |

Pueden venir perfectamente de los datos de clase o de otro equipo. Pero hasta
que alguien diga de cuál, no se puede construir un modelo de ingresos encima:
el €7,40 es precisamente el número del que cuelga toda la decisión de a quién
cobrar.

Y ninguno de los que sí son nuestros se ha vuelto a medir desde noviembre.

## Lo que hay en la ciudad hoy

Esto sí está medido, porque fuimos a las tarifas oficiales una por una. Está
entero en [la investigación](../investigacion/descuentos-estudiante-segovia.md),
con sus once huecos marcados como tales.

| Número | Qué dice | Estado |
|---|---|---|
| 5 € / 8 € | Entrada reducida del Alcázar | **Medido** — tarifario oficial |
| 3 € | Catedral, reducida, menores de 25 | **Medido** — web oficial |
| 0,27 € | Bono joven del autobús urbano (−77 %) | **Medido** el precio; **supuesta** la edad y el documento que piden: la web municipal no lo dice |
| 5 comercios | Segovianos nombrables en el Carné Joven | **Medido**, con la advertencia de que solo pude leer una de tres páginas |
| 0 | Hostelería con menú de estudiante publicado | **Medido** en internet, **no verificado a pie de calle**. Es el hueco más importante y el único que no se resuelve desde un navegador |
| 0 | Convenios publicados por IE o la UVa | **Medido** — revisadas ambas webs |

## El plan de lanzamiento

Aquí casi todo es supuesto, y conviene que se vea.

| Número | Qué dice | Estado |
|---|---|---|
| 150 personas | Densidad mínima para que una cohorte no parezca vacía | **Supuesto** |
| 162 señales | El umbral que usó Hungrie | **Medido** por ellos, **supuesto** como umbral nuestro: su negocio era un local físico con un coste de apertura, y el nuestro no |
| 2 meses | Ventana en la que la segunda vez es la métrica | **Supuesto** |
| Semana de Orientación | Única ventana de arranque del año | **Reportado** — es el calendario académico, pero no hemos confirmado acceso ni permisos |
| Quién paga | Negocio, universidad o marca | **Supuesto**, y es el supuesto más caro de la lista: no hay ni una carta de intenciones firmada |

## Lo que la app mide de verdad hoy

| Número | Estado |
|---|---|
| Segunda vez (`/api/mod/second-plan`) | **Instrumentado**, visible en la consola de moderación. Los datos de la demo son inventados, y la pantalla lo dice |
| Reseñas publicadas / pendientes | **Medido** sobre datos de demostración |
| Umbral de cohorte (5 personas) | **Medido**: la API se niega a describir un grupo menor |

## Lo que haría a continuación, en este orden

1. **Pisar la calle para el punto de la hostelería.** Es el único dato que
   decide si la premisa se sostiene, y no está en internet.
2. **Reconstruir o retirar los 418 locales.** Está publicado en la web y no
   sabemos de dónde viene.
3. **Firmar a alguien del lado que paga** antes de escribir más producto.
4. **Convertir el €7,40 declarado en un €X cobrado**, aunque sea a diez
   personas. Es la única forma de saberlo.
