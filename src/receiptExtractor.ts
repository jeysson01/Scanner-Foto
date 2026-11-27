import Tesseract from 'tesseract.js';

export type Comprobante = {
  origen: string;
  monto: number | null;
  fecha: string;
  hora: string;
  numeroOperacion: string;
  detalle: string;
  texto: string;
};

function normalizarFecha(valor: string) {
  const partes = valor.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!partes) return valor;
  const dia = partes[1].padStart(2, '0');
  const mes = partes[2].padStart(2, '0');
  let anio = partes[3];
  if (anio.length === 2) anio = `20${anio}`;
  return `${anio}-${mes}-${dia}`;
}

function extraerMonto(texto: string): number | null {
  const patrones = [
    /(?:S\/|PEN|soles?)\s*[:.-]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2}))/gi,
    /(?:monto|pagaste|pagaste\s+s\/?)\s*[:.-]?\s*([0-9]+[.,][0-9]{1,2})/gi,
  ];
  for (const patron of patrones) {
    const coincidencia = [...texto.matchAll(patron)].at(-1);
    if (coincidencia?.[1]) {
      let valor = coincidencia[1].replace(/,/g, '.');
      if (/\.\d{3}$/.test(valor)) valor = valor.replace(/\.\d{3}$/, '');
      const numero = Number(valor);
      if (Number.isFinite(numero)) return numero;
    }
  }
  return null;
}

function extraerFecha(texto: string) {
  const coincidencia = texto.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
  return coincidencia ? normalizarFecha(coincidencia[1]) : '';
}

function extraerHora(texto: string) {
  const coincidencia = texto.match(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?)\b/i);
  if (!coincidencia) return '';
  let hora = coincidencia[1].replace(/\s/g, '').toLowerCase();
  const formato12 = hora.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(a|p)m?\.?$/);
  if (formato12) {
    let h = Number(formato12[1]);
    if (formato12[4] === 'p' && h < 12) h += 12;
    if (formato12[4] === 'a' && h === 12) h = 0;
    hora = `${String(h).padStart(2, '0')}:${formato12[2]}:${formato12[3] ?? '00'}`;
  } else if (!hora.includes(':')) {
    return '';
  }
  return hora.match(/^\d{2}:\d{2}(?::\d{2})?$/) ? hora : '';
}

function detectarOrigen(texto: string) {
  const valor = texto.toLowerCase();
  if (valor.includes('yape')) return 'Yape';
  if (valor.includes('plin')) return 'Plin';
  if (valor.includes('bcp')) return 'BCP';
  if (valor.includes('bbva')) return 'BBVA';
  if (valor.includes('scotiabank')) return 'Scotiabank';
  if (valor.includes('falabella') || valor.includes('cmr')) return 'Banco Falabella';
  if (valor.includes('interbank')) return 'Interbank';
  if (valor.includes('banco estado')) return 'Banco Estado';
  return 'Desconocido';
}

function extraerOperacion(texto: string) {
  const patrones = [
    /(?:n[uú]mero|nro|nro\.?|c[oó]digo|operaci[oó]n|constancia|solicitud)\s*(?:de\s*)?(?:operaci[oó]n|transacci[oó]n|seguridad)?\s*[:.-]?\s*([A-Z0-9][A-Z0-9 .-]{5,30})/gi,
    /\b(\d{9,16})\b/g,
  ];
  for (const patron of patrones) {
    const coincidencia = [...texto.matchAll(patron)].at(-1);
    if (coincidencia?.[1]) {
      const valor = coincidencia[1].replace(/\s/g, '').replace(/\.$/, '').trim();
      if (/[A-Z0-9]/.test(valor)) return valor;
    }
  }
  return '';
}

function extraerDetalle(texto: string, numero: string) {
  const linea = texto.split('\n').find((item) =>
    /detalle|motivo|concepto|descripci[oó]n|folio|destinatario/i.test(item)
  );
  if (!linea) return numero ? `Operación ${numero}` : '';
  const valor = linea.replace(/^(detalle|motivo|concepto|descripci[oó]n|folio|destinatario)\s*[:.-]?\s*/i, '').trim();
  return valor || (numero ? `Operación ${numero}` : '');
}

export async function extraerComprobante(archivo: File, progreso?: (porcentaje: number) => void): Promise<Comprobante> {
  const resultado = await Tesseract.recognize(archivo, 'spa', {
    logger: (mensaje) => {
      if (mensaje.status === 'recognizing text' && progreso) progreso(Math.round(mensaje.progress * 100));
    },
  });
  const texto = resultado.data.text.replace(/\r/g, '').trim();
  const numeroOperacion = extraerOperacion(texto);
  return {
    origen: detectarOrigen(texto),
    monto: extraerMonto(texto),
    fecha: extraerFecha(texto),
    hora: extraerHora(texto),
    numeroOperacion,
    detalle: extraerDetalle(texto, numeroOperacion),
    texto,
  };
}
