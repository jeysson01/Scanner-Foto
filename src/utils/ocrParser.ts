import Tesseract from 'tesseract.js';
import { preprocesarImagenOCR } from './imagePreprocessor';

export interface DatosComprobante {
  fecha: string;
  hora: string;
  origen: 'Falabella' | 'Yape' | 'BCP' | 'Scotiabank' | 'Desconocido';
  monto: number | null;
  detalle: string;
  textoCrudo: string;
}

const MESES_ES: Record<string, string> = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', set: '09', septiembre: '09', setiembre: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12',
};

function detectarBanco(texto: string): DatosComprobante['origen'] {
  const t = texto.toLowerCase();
  if (t.includes('falabella') || t.includes('cmr') || t.includes('banco falabella')) {
    return 'Falabella';
  }
  if (t.includes('yape') || t.includes('yapeaste')) {
    return 'Yape';
  }
  if (t.includes('scotiabank') || t.includes('scotia')) {
    return 'Scotiabank';
  }
  if (t.includes('bcp') || t.includes('banco de crédito') || t.includes('credito del peru')) {
    return 'BCP';
  }
  return 'Desconocido';
}

function extraerMonto(texto: string): number | null {
  // Busca patrones como S/ 23.00, S/23,00, S/. 150.50
  const regexMonto = /S\/?\.?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?)/i;
  const match = texto.match(regexMonto);
  if (!match || !match[1]) return null;

  let valorStr = match[1];
  // Normalizar separadores de miles y decimales
  if (valorStr.includes(',') && valorStr.includes('.')) {
    valorStr = valorStr.replace(/,/g, '');
  } else if (valorStr.includes(',')) {
    valorStr = valorStr.replace(',', '.');
  }

  const numero = parseFloat(valorStr);
  return isNaN(numero) ? null : numero;
}

function extraerFecha(texto: string): string {
  // 1. Formato numérico: DD/MM/YYYY o DD-MM-YYYY
  const matchNumerico = texto.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (matchNumerico) {
    const dia = matchNumerico[1].padStart(2, '0');
    const mes = matchNumerico[2].padStart(2, '0');
    const anio = matchNumerico[3].length === 2 ? `20${matchNumerico[3]}` : matchNumerico[3];
    return `${anio}-${mes}-${dia}`;
  }

  // 2. Formato texto (común en Falabella / Yape): "27 nov. 2026" o "27 de noviembre de 2026"
  const matchTexto = texto.match(
    /(\d{1,2})\s*(?:de\s+)?([a-zA-Z]{3,10})\.?\s*(?:de\s+|del\s+)?(\d{4})/i
  );
  if (matchTexto) {
    const dia = matchTexto[1].padStart(2, '0');
    const mesNombre = matchTexto[2].toLowerCase().replace('.', '');
    const mes = MESES_ES[mesNombre];
    const anio = matchTexto[3];
    if (mes) {
      return `${anio}-${mes}-${dia}`;
    }
  }

  // Fallback: fecha actual en formato YYYY-MM-DD
  return new Date().toISOString().split('T')[0];
}

function extraerHora(texto: string): string {
  // Busca 13:33, 13:33:00 o 01:33 pm / a.m.
  const matchHora = texto.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!matchHora) return '00:00:00';

  let horas = parseInt(matchHora[1], 10);
  const minutos = matchHora[2];
  const segundos = matchHora[3] || '00';
  const meridiano = matchHora[4]?.toLowerCase().replace(/\./g, '');

  if (meridiano === 'pm' && horas < 12) horas += 12;
  if (meridiano === 'am' && horas === 12) horas = 0;

  return `${String(horas).padStart(2, '0')}:${minutos}:${segundos}`;
}

function extraerDetalle(texto: string, origen: DatosComprobante['origen']): string {
  const lineas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  // Intentar capturar comercio o destinatario según etiquetas frecuentes
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].toLowerCase();
    if (
      linea.includes('comercio') ||
      linea.includes('empresa') ||
      linea.includes('destino') ||
      linea.includes('pagaste a') ||
      linea.includes('transferiste a')
    ) {
      // Si el valor está en la misma línea después de ":"
      const partes = lineas[i].split(':');
      if (partes.length > 1 && partes[1].trim().length > 1) {
        return partes[1].trim();
      }
      // Si el valor está en la línea siguiente
      if (lineas[i + 1]) {
        return lineas[i + 1];
      }
    }
  }

  return origen !== 'Desconocido' ? `Pago ${origen}` : '-';
}

export async function procesarComprobante(
  archivo: File,
  onProgreso?: (porcentaje: number) => void
): Promise<DatosComprobante> {
  const imagenProcesada = await preprocesarImagenOCR(archivo);

  const resultado = await Tesseract.recognize(imagenProcesada, 'spa', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgreso) {
        onProgreso(Math.round(m.progress * 100));
      }
    },
  });

  const textoCrudo = resultado.data.text;
  const origen = detectarBanco(textoCrudo);
  const monto = extraerMonto(textoCrudo);
  const fecha = extraerFecha(textoCrudo);
  const hora = extraerHora(textoCrudo);
  const detalle = extraerDetalle(textoCrudo, origen);

  return {
    fecha,
    hora,
    origen,
    monto,
    detalle,
    textoCrudo,
  };
}
