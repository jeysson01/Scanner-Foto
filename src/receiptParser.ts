export type Banco = 'Yape' | 'BCP' | 'Scotiabank' | 'BBVA' | 'Falabella' | 'Interbank' | 'Otro';
export type Moneda = 'PEN' | 'CLP' | 'USD' | '';

export type Comprobante = {
  fecha: string;
  hora: string;
  monto: number | null;
  moneda: Moneda;
  detalle: string;
  origen: Banco;
  numeroOperacion: string;
  confianza: number;
  camposFaltantes: string[];
  texto: string;
};

const MESES: Record<string, string> = {
  ene: '01', enero: '01',
  feb: '02', febrero: '02',
  mar: '03', marzo: '03',
  abr: '04', abril: '04',
  may: '05', mayo: '05',
  jun: '06', junio: '06',
  jul: '07', julio: '07',
  ago: '08', agosto: '08',
  sep: '09', sept: '09', septiembre: '09',
  oct: '10', octubre: '10',
  nov: '11', noviembre: '11',
  dic: '12', diciembre: '12',
};

function fechaValida(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return '';
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function extraerFecha(texto: string, ahora: Date): string {
  const numerica = texto.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (numerica) {
    const anio = Number(numerica[3].length === 2 ? `20${numerica[3]}` : numerica[3]);
    return fechaValida(anio, Number(numerica[2]), Number(numerica[1]));
  }

  const escrita = texto.match(/\b(\d{1,2})\s+([a-záéíóú]+)\.?\s*(\d{4})?\b/i);
  if (!escrita) return '';
  const mes = MESES[escrita[2].toLocaleLowerCase('es')];
  if (!mes) return '';
  return fechaValida(Number(escrita[3] ?? ahora.getFullYear()), Number(mes), Number(escrita[1]));
}

function extraerHora(texto: string): string {
  const coincidencia = texto.match(/\b(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|h)?\b/i);
  if (!coincidencia) return '';

  let hora = Number(coincidencia[1]);
  const minuto = Number(coincidencia[2]);
  const segundo = Number(coincidencia[3] ?? 0);
  const sufijo = coincidencia[4]?.replace(/[.\s]/g, '').toLowerCase();
  if (sufijo === 'pm' && hora < 12) hora += 12;
  if (sufijo === 'am' && hora === 12) hora = 0;
  if (hora > 23 || minuto > 59 || segundo > 59 || (sufijo && sufijo !== 'am' && sufijo !== 'pm' && sufijo !== 'h')) return '';
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:${String(segundo).padStart(2, '0')}`;
}

function detectarOrigen(texto: string): Banco {
  const valor = texto.toLocaleLowerCase('es').normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (valor.includes('yape') || valor.includes('yapeaste')) return 'Yape';
  if (valor.includes('scotiabank')) return 'Scotiabank';
  if (valor.includes('falabella') || valor.includes('cmr')) return 'Falabella';
  if (valor.includes('bbva')) return 'BBVA';
  if (valor.includes('interbank')) return 'Interbank';
  if (/\bbcp\b/.test(valor) || valor.includes('banco de credito')) return 'BCP';
  return 'Otro';
}

function extraerOperacion(texto: string): string {
  const patrones = [
    /(?:n[úu]m(?:ero)?\.?|nro\.?|n[º°]|folio|solicitud|operaci[oó]n|transferencia|transacci[oó]n)\s*(?:de\s*)?(?:operaci[oó]n|solicitud|transferencia|transacci[oó]n)?\s*[:#.-]?\s*([A-Z0-9][A-Z0-9.-]{5,24})/gi,
    /\b(\d{9,16})\b/g,
  ];

  for (const patron of patrones) {
    const coincidencia = [...texto.matchAll(patron)].at(-1)?.[1];
    if (coincidencia) return coincidencia.replace(/[.,-]+$/, '');
  }
  return '';
}

function interpretarNumero(valor: string, moneda: Moneda): number | null {
  let numero = valor.replace(/\s/g, '').replace(/[.,]+$/, '');
  const comas = [...numero.matchAll(/,/g)].length;
  const puntos = [...numero.matchAll(/\./g)].length;

  if (comas && puntos) {
    const decimalEsPunto = numero.lastIndexOf('.') > numero.lastIndexOf(',');
    const separadorDecimal = decimalEsPunto ? '.' : ',';
    const separadorMiles = decimalEsPunto ? ',' : '.';
    numero = numero.replaceAll(separadorMiles, '').replace(separadorDecimal, '.');
  } else if (comas || puntos) {
    const separador = comas ? ',' : '.';
    const partes = numero.split(separador);
    const decimales = partes.at(-1)?.length ?? 0;
    if (partes.length > 2 || decimales === 3 || (moneda === 'CLP' && decimales > 0)) {
      numero = partes.join('');
    } else if (decimales > 0) {
      numero = `${partes.slice(0, -1).join('')}.${partes.at(-1)}`;
    }
  }

  const cantidad = Number(numero);
  return Number.isFinite(cantidad) ? cantidad : null;
}

function extraerMonto(texto: string, origen: Banco): { monto: number | null; moneda: Moneda } {
  const expresion = /(?:S\s*\.?\s*[\/\\]|5\s*[\/\\]|PEN\b|CLP\b|USD\b|\$)\s*((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)/i;
  const coincidencia = texto.match(expresion);
  if (!coincidencia) {
    const etiquetado = texto.match(/\b(?:monto|total|importe)\b\s*[:=-]?\s*((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)/i);
    return { monto: etiquetado ? interpretarNumero(etiquetado[1], '') : null, moneda: '' };
  }

  const prefijo = coincidencia[0].slice(0, coincidencia[0].indexOf(coincidencia[1])).toUpperCase().replace(/\s/g, '');
  const simboloPEN = /^(?:S\s*\.?\s*[\/\\]|5\s*[\/\\])/i.test(coincidencia[0]);
  const moneda: Moneda = simboloPEN || prefijo === 'PEN'
    ? 'PEN'
    : prefijo === 'CLP' || (prefijo === '$' && origen === 'Falabella')
      ? 'CLP'
      : prefijo === '$' || prefijo === 'USD'
        ? 'USD'
        : '';
  const monto = interpretarNumero(coincidencia[1], moneda);
  return { monto, moneda };
}

export function parsearComprobante(textoOCR: string, ahora = new Date()): Comprobante {
  const texto = textoOCR.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const origen = detectarOrigen(texto);
  const { monto, moneda } = extraerMonto(texto, origen);
  const fecha = extraerFecha(texto, ahora);
  const hora = extraerHora(texto);
  const numeroOperacion = extraerOperacion(texto);
  const detalle = numeroOperacion;
  const camposFaltantes = [
    !fecha && 'fecha',
    !hora && 'hora',
    monto === null && 'monto',
    !moneda && 'moneda',
    !detalle && 'detalle',
    origen === 'Otro' && 'origen',
  ].filter((campo): campo is string => Boolean(campo));

  return {
    fecha,
    hora,
    monto,
    moneda,
    detalle,
    origen,
    numeroOperacion,
    confianza: Number(((6 - camposFaltantes.length) / 6).toFixed(2)),
    camposFaltantes,
    texto,
  };
}
