# Generador local de fotografías de INTECA

Desde **Community Manager → Generador local de fotos**, el administrador enlaza una computadora de INTECA. El CRM prepara dos piezas diarias, una para Autorizaciones Médicas y otra para un curso del catálogo. El equipo ejecuta SDXL localmente para crear la escena. El CRM añade logo, texto y precios verificados, y usa el mismo archivo para la misma pieza en Facebook e Instagram. Los reels, el WhatsApp comercial y Dirección tienen flujos separados.

## Instalación en Windows 64 bits (x86)

1. Usa una computadora que pueda permanecer encendida y conectada. Se recomiendan 16 GB de RAM, un procesador compatible con la distribución de stable-diffusion.cpp y al menos 8 GB libres. La primera descarga ronda los 7 GB. Puedes usar CPU; una distribución compatible con GPU puede acelerar el trabajo.
2. Instala Python 3.10 o superior desde [python.org](https://www.python.org/downloads/windows/).
3. Pulsa **Descargar generador** y **Crear código de enlace** en el panel del CRM.
4. En PowerShell, ve a la carpeta de la descarga y ejecuta:

   ```powershell
   py -3 .\inteca_fotos.py --install --pair
   ```

5. Cuando lo solicite la ventana, pega el código privado. No lo compartas por chat o correo. Deja la ventana abierta y evita la suspensión del equipo.
6. En el panel verifica **Equipo conectado**, y luego **Flyer con foto listo**. Después de reiniciar el equipo basta con `py -3 .\inteca_fotos.py`; el código se guarda en la carpeta privada del usuario.

Para generar una muestra sin conectar al CRM usa `py -3 .\inteca_fotos.py --preview muestra.png` después de instalar. En Linux y macOS, instala el binario compatible de [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/releases) y descarga el [modelo SDXL en formato safetensors](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0). Ejecuta `python3 inteca_fotos.py --bin /ruta/sd-cli --model /ruta/sd_xl_base_1.0.safetensors --pair`. Consulta las licencias de [SDXL](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/main/LICENSE.md) y del motor antes de redistribuir el modelo o los binarios.

## Operación

- La estación consulta el CRM por HTTPS y prepara los flyers de las próximas 42 horas. No necesita puertos entrantes. El código solo permite recibir instrucciones de imagen para el calendario y devolverlas; no sirve para iniciar sesión ni para operar redes sociales o acceder a contactos.
- Si una foto llega tarde, el calendario espera solo dentro de la ventana de dos horas. Si falta la foto, no publica el flyer con un icono. No se vuelve a publicar lo que ya salió. No se vuelve a usar una foto casi idéntica; quedan hasta dos intentos locales antes de omitir el flyer sin foto.
- La función no llama a Gemini, OpenAI u otro proveedor de pago. El costo de cómputo es el consumo propio del equipo. La aplicación de Render arma el flyer y publica la pieza, sin cargar el modelo.
- **Desconectar equipo** invalida su código. Las fotos ya preparadas se conservan. Para mover el generador a otra máquina crea un código nuevo.

El arte se arma en el CRM, con logo oficial de INTECA y una foto alusiva al curso en los flyers. El nombre completo, la duración, la inscripción y la mensualidad se imprimen en la imagen y en cada escena de los reels y videos automáticos. Los precios provienen del catálogo publicado. Si no se pueden verificar o falta el logo oficial, el calendario no envía la pieza incompleta. Los archivos de una composición anterior no se reutilizan para piezas pendientes.

En **IA Marketing & Ads → Estudio de flyers fotográficos**, selecciona curso y formato y pulsa **Generar foto nueva**. Requiere la PC enlazada. También puedes cargar una foto propia de al menos 640 × 360 y hasta 4 MB. La detección de similitud se comparte con el calendario; los resultados del estudio se guardan como borradores privados para descargar y nunca se publican solos.
