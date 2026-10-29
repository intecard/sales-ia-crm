# INTECA: operación de publicaciones orgánicas premium v6

## Calendario, hora República Dominicana (UTC-4)

| Hora | Material | Programa | Plataformas |
|---|---|---|---|
| 09:00 a. m. | Flyer premium | Técnico en Oficial de Autorizaciones Médicas | Facebook e Instagram |
| 05:00 p. m. | Flyer premium | Programa diferente seleccionado con rotación pseudoaleatoria | Facebook e Instagram |
| 08, 10, 12, 14, 16, 18, 20 h | 7 reels | Guiones específicos de los cursos | No se publican hasta existir MP4 revisado |
| 19:30 | Video de valor | Guion del curso rotativo | No se publica hasta existir MP4 revisado |

El plan programa 30 días, con hasta 840 trabajos (incluye duplicación por canal). La selección de la tarde recorre todos los cursos diferentes del TAM antes de repetir y evita días consecutivos con el mismo curso. En cada día los flyers AM/PM son distintos. El mismo arte puede usarse entre Facebook e Instagram.

## Seguridad académica

- Única fuente de precio/duración/contenidos: archivo oficial de catálogo en Supabase.
- TAM: 5 meses (aunque la fotografía de referencia del propietario tenga un error de 4 meses).
- Solo competencias propias de cada curso: prohibido vender TAM con contenido del curso de Atención al Usuario/Paciente.
- Pre-certificaciones, Servicio al Usuario, Farmacología, Enfermería, Promotor de Seguros, Promotor de Salud, Máster y Facturación tienen vocabulario y preguntas propios.
- Si no se pueden confirmar datos obligatorios o tema académico, el flyer se bloquea. No inventar matrícula, horario, descuentos, avales, cupos ni pasantías.

## Estilo premium

- Foto coherente, completa, sin recortar cabezas, manos o uniforme (contener, no recortar); si falta foto acorde, ilustración original del tema.
- Formato 1080×1350, identidad azul y verde de INTECA, acentos dorados, tipografía legible, títulos grandes.
- Título oficial, 1-3 competencias comprobadas, duración, inscripción, mensualidad, WhatsApp **809-643-5502**, sitio web y correo.
- Pregunta de valor y CTA directo para contactar, guardar o compartir. Composición, ilustración y mensaje cambian cada día.
- Para fotos verdaderamente nuevas todos los días se debe ampliar la biblioteca o instalar generador; por ahora existen 3 fotografías temáticas licenciadas.

## Continuidad y protección

- Planificador v6 con slots por separado de 9:00 a. m. y 5:00 p. m.; no vuelve a publicar piezas anteriores verificadas.
- GitHub Actions despierta Render Free a las 09:07, 10:07, 17:07 y 18:07 RD. Los cron gratuitos pueden retrasarse.
- Hasta 2 horas de tolerancia para el flyer correspondiente; no publicar por error a medianoche piezas vencidas.
- Estados reales: published con URL es publicación comprobada; queued es pendiente; blocked exige corregir datos; review_required exige reconciliar resultado incierto.
- Publicaciones orgánicas gratuitas, sin gastos publicitarios por este proceso.

## Video y crecimiento

- El CRM prepara 7 guiones de reels y un video diarios con INTEQUITO y preguntas sobre Ley 87-01, PDSS y las competencias del curso seleccionado; no se inventan publicaciones de MP4.
- Para producir videos reales siguen pendientes proveedor de video o GPU y imagen oficial, además de audio, subtítulos, revisión y licencias.
- YouTube no puede recibir flyers JPEG por el publicador de videos actual.
- Crecimiento en 30 días es objetivo, no garantía. Medir seguidores, interacciones, visualizaciones, conversaciones por WhatsApp y matrículas reales, sin generar datos falsos.

## Pruebas antes de desplegar

Revisar que GitHub Actions apruebe compilación, coherencia de TAM vs servicio al usuario, rotación sin repeticiones, programación futura, originalidad de JPEG y controles contra la sustitución de temario. Aplicar migración v6 en Supabase y verificar la tabla de trabajos.
