# Scanner-Foto

Extractor de comprobantes desde capturas. Tesseract.js y el idioma español se cargan en el navegador cuando se inicia la lectura; las imágenes solo se mantienen en memoria para el OCR y la vista previa. Se pueden seleccionar varias capturas, arrastrarlas o pegarlas, revisar los campos y guardar los resultados en el almacenamiento local del navegador.

## Desarrollo

```bash
npm install
npm run dev
```

## Pruebas

```bash
npm run test:parsers
npm run build
```

## Agregar un banco

1. Añade el nombre y sus alias en `detectarOrigen` en `src/receiptParser.ts`.
2. Si el recibo usa formatos particulares, agrega la extracción específica en `parsearComprobante` o sus funciones auxiliares y conserva el formato común `YYYY-MM-DD`, `HH:MM:SS` y moneda ISO.
3. Añade un caso de texto OCR en `src/receiptParser.test.ts` que compruebe origen, fecha, hora, monto, moneda e identificador.
4. Añade el banco a `BANCOS` en `src/App.tsx` para que se pueda corregir manualmente en la revisión.

## Pruebas manuales

- Probar capturas Yape (tema oscuro y ruido OCR `5/`), Scotiabank sin año, BBVA con `$3,000.00` y Falabella con `$37.500`.
- Seleccionar varias imágenes desde móvil/escritorio; verificar progreso, navegación, edición, categoría y guardado conjunto.
- Probar arrastrar y pegar una imagen; confirmar que una imagen que no pueda leerse abre el formulario manual.
- Repetir un identificador ya registrado y comprobar que pide confirmación; guardar y usar **Deshacer**.
- Recargar la página y comprobar que los datos siguen disponibles y que las imágenes no se persistieron.
