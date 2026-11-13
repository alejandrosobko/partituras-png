# Partituras a PNG

Extensión de navegador (Brave/Chrome) que baja una partitura de MuseScore como un PDF con todas las páginas, o cada página como PNG del ancho que elijas (1200 px por defecto). Todo se dibuja directo desde el SVG para que quede nítido.

## Instalar (una sola vez)

1. Abrir `brave://extensions`.
2. Activar **Modo de desarrollador** (arriba a la derecha).
3. **Cargar extensión sin empaquetar** → elegir esta carpeta.
4. Fijarla en la barra: ícono de pieza de rompecabezas → pin.

Si se cambia algo del código: en `brave://extensions`, botón de recargar de la extensión.

## Usar

1. Abrir la partitura en musescore.com y esperar a que cargue.
2. Tocar el botón de la extensión. Recorre la partitura sola (para que carguen todas las páginas) y abre una pestaña con las páginas.
3. **Descargar PDF** baja la partitura completa en un solo archivo (`Descargas/<título>.pdf`, 300 dpi, tamaño de hoja original).
4. Para una página suelta: ajustar el ancho si hace falta y tocar **Descargar** en esa página (queda en `Descargas/<título>/`).

Los links de MuseScore vencen a los 5 minutos: si una página falla, volver a la partitura y tocar el botón de nuevo.
