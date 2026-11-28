import { parsearComprobante, type Comprobante } from './receiptParser';

export type { Comprobante } from './receiptParser';

type Progreso = (porcentaje: number) => void;
type WorkerOCR = import('tesseract.js').Worker;

let workerOCR: Promise<WorkerOCR> | null = null;
let progresoActivo: Progreso | undefined;

async function decodificarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(archivo);
    } catch {
      // Some browser decoders reject formats their image element can still display.
    }
  }

  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('El navegador no pudo abrir esta imagen.'));
    };
    imagen.src = url;
  });
}

function obtenerWorker(): Promise<WorkerOCR> {
  if (!workerOCR) {
    workerOCR = (async () => {
      const { createWorker } = await import('tesseract.js');
      return createWorker('spa', undefined, {
        logger: (mensaje) => {
          if (mensaje.status === 'recognizing text') progresoActivo?.(Math.round(mensaje.progress * 100));
        },
      });
    })();
  }
  return workerOCR.catch((error: unknown) => {
    workerOCR = null;
    throw error;
  });
}

async function preprocesarImagen(archivo: File): Promise<HTMLCanvasElement> {
  const imagen = await decodificarImagen(archivo);
  const escala = Math.min(1500 / imagen.width, 2400 / imagen.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(imagen.width * escala));
  canvas.height = Math.max(1, Math.round(imagen.height * escala));
  const contexto = canvas.getContext('2d', { willReadFrequently: true });
  if (!contexto) throw new Error('No fue posible preparar la imagen para leerla.');

  contexto.drawImage(imagen, 0, 0, canvas.width, canvas.height);
  if ('close' in imagen) imagen.close();
  const pixeles = contexto.getImageData(0, 0, canvas.width, canvas.height);
  const datos = pixeles.data;
  let brilloPromedio = 0;

  for (let indice = 0; indice < datos.length; indice += 4) {
    const gris = Math.round(datos[indice] * 0.299 + datos[indice + 1] * 0.587 + datos[indice + 2] * 0.114);
    brilloPromedio += gris;
  }
  brilloPromedio /= datos.length / 4;

  const invertir = brilloPromedio < 110;
  for (let indice = 0; indice < datos.length; indice += 4) {
    const gris = Math.round(datos[indice] * 0.299 + datos[indice + 1] * 0.587 + datos[indice + 2] * 0.114);
    const contraste = Math.max(0, Math.min(255, (gris - 128) * 1.25 + 128));
    const valor = Math.round(invertir ? 255 - contraste : contraste);
    datos[indice] = valor;
    datos[indice + 1] = valor;
    datos[indice + 2] = valor;
  }
  contexto.putImageData(pixeles, 0, 0);
  return canvas;
}

export async function extraerComprobante(archivo: File, progreso?: Progreso): Promise<Comprobante> {
  progresoActivo = progreso;
  try {
    const [worker, canvas] = await Promise.all([obtenerWorker(), preprocesarImagen(archivo)]);
    const resultado = await worker.recognize(canvas);
    progreso?.(100);
    return parsearComprobante(resultado.data.text);
  } finally {
    progresoActivo = undefined;
  }
}
