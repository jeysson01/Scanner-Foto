import { describe, expect, it } from 'vitest';
import { parsearComprobante } from './receiptParser';

const ahora = new Date('2026-11-27T12:00:00Z');

describe('parsearComprobante', () => {
  it('lee un comprobante Yape con fecha en español y hora de 12 horas', () => {
    const resultado = parsearComprobante(
      '¡Yapeaste! S/12, 02 nov. 2026, 07:59 p. m. Nro. de operación 32307209',
      ahora,
    );

    expect(resultado).toMatchObject({
      origen: 'Yape',
      fecha: '2026-11-02',
      hora: '19:59:00',
      monto: 12,
      moneda: 'PEN',
      detalle: '32307209',
    });
  });

  it('asume el año actual para Scotiabank y conserva los puntos del número de operación', () => {
    const resultado = parsearComprobante(
      'Scotiabank Pagaste S/100 09 mar. 05:00 p. m. Número de operación 728.234.234.2345',
      ahora,
    );

    expect(resultado).toMatchObject({
      origen: 'Scotiabank',
      fecha: '2026-03-09',
      hora: '17:00:00',
      monto: 100,
      moneda: 'PEN',
      detalle: '728.234.234.2345',
    });
  });

  it('lee fecha escrita, miles con coma y hora de 24 horas en BBVA', () => {
    const resultado = parsearComprobante(
      'BBVA Transferencia exitosa 8 febrero 2023 09:49:47 h $3,000.00 Folio 4838587078',
      ahora,
    );

    expect(resultado).toMatchObject({
      origen: 'BBVA',
      fecha: '2023-02-08',
      hora: '09:49:47',
      monto: 3000,
      moneda: 'USD',
      detalle: '4838587078',
    });
  });

  it('interpreta punto de miles y moneda CLP en Falabella', () => {
    const resultado = parsearComprobante(
      'Banco Falabella Transferencia Realizada 30/07/2025 20:18:11 $37.500 Nº de Solicitud 109846378601',
      ahora,
    );

    expect(resultado).toMatchObject({
      origen: 'Falabella',
      fecha: '2025-07-30',
      hora: '20:18:11',
      monto: 37500,
      moneda: 'CLP',
      detalle: '109846378601',
    });
  });

  it('normaliza separadores decimales y ruido OCR sin confundir la coma con fecha', () => {
    const resultado = parsearComprobante(
      'Yapeaste S/ 12,50 2 nov 2026 12:05 a. m. Nro. operación 32307209',
      ahora,
    );

    expect(resultado).toMatchObject({
      fecha: '2026-11-02',
      hora: '00:05:00',
      monto: 12.5,
      moneda: 'PEN',
    });
  });

  it('interpreta 5/ como una lectura OCR errónea del símbolo S/', () => {
    const resultado = parsearComprobante(
      '¡Yapeaste! 5/12, 02 nov. 2026, 07:59 p. m. Nro. de operación 32307209',
      ahora,
    );

    expect(resultado).toMatchObject({ monto: 12, moneda: 'PEN', origen: 'Yape' });
  });

  it('marca campos ausentes y fechas imposibles para revisión', () => {
    const resultado = parsearComprobante('BCP pago S/20 31/02/2025', ahora);

    expect(resultado.fecha).toBe('');
    expect(resultado.camposFaltantes).toContain('fecha');
    expect(resultado.camposFaltantes).toContain('detalle');
    expect(resultado.confianza).toBeLessThan(0.6);
  });

  it('usa la extracción genérica para Interbank cuando el monto viene etiquetado', () => {
    const resultado = parsearComprobante(
      'Interbank transferencia 12/04/2026 14:30:10 Monto: 45.90 Nro. de operación 99887766',
      ahora,
    );

    expect(resultado).toMatchObject({
      origen: 'Interbank',
      fecha: '2026-04-12',
      hora: '14:30:10',
      monto: 45.9,
      moneda: '',
      detalle: '99887766',
    });
    expect(resultado.camposFaltantes).toContain('moneda');
  });
});
