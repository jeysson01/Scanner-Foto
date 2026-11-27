# Módulo OCR de Comprobantes (Tesseract.js) para Registro-Finance

Este paquete contiene el código listo para integrar lectura automática de comprobantes (**Banco Falabella, Yape, BCP y Scotiabank**) directamente en el navegador sin costo ni API keys.

## Estructura incluida

- `src/utils/imagePreprocessor.ts`: Preprocesa la imagen con HTML5 Canvas (escala de grises, aumento de contraste e inversión automática de colores para capturas en **modo oscuro**).
- `src/utils/ocrParser.ts`: Ejecuta `Tesseract.recognize` en español (`spa`) y extrae `fecha`, `hora`, `origen` (banco), `monto` y `detalle` mediante expresiones regulares.
- `src/components/ModalSubirCaptura.tsx`: Componente React/Next.js idéntico al modal de tu interfaz con barra de progreso, vista previa editable de los datos extraídos y botón **Registrar comprobante**.

## Instalación en tu proyecto Next.js

1. Instala la dependencia en la carpeta raíz de tu proyecto:
   ```bash
   npm install tesseract.js
   ```
   *(o `pnpm add tesseract.js`)*

2. Copia la carpeta `src/` dentro de tu proyecto (o mueve los archivos dentro de `utils/` y `components/` según tu estructura).

3. Importa el modal en tu vista de **Movimientos**:
   ```tsx
   import { ModalSubirCaptura } from '@/components/ModalSubirCaptura';

   // Dentro de tu componente:
   <ModalSubirCaptura
     isOpen={modalAbierto}
     onClose={() => setModalAbierto(false)}
     onRegistrarGasto={async (nuevoGasto) => {
       // Aquí guardas en Supabase o actualizas el estado de tu tabla
       console.log('Gasto listo para guardar:', nuevoGasto);
     }}
   />
   ```
