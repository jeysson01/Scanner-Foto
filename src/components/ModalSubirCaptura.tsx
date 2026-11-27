'use client';

import React, { useState } from 'react';
import { procesarComprobante, DatosComprobante } from '../utils/ocrParser';

interface ModalSubirCapturaProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistrarGasto: (gasto: {
    fecha: string;
    hora: string;
    categoria: string;
    detalle: string;
    origen: string;
    monto: number;
  }) => Promise<void> | void;
}

export function ModalSubirCaptura({
  isOpen,
  onClose,
  onRegistrarGasto,
}: ModalSubirCapturaProps) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [datosExtraidos, setDatosExtraidos] = useState<DatosComprobante | null>(null);
  const [categoria, setCategoria] = useState('Caprichos');
  const [detalleEditado, setDetalleEditado] = useState('');
  const [montoEditado, setMontoEditado] = useState('');
  const [origenEditado, setOrigenEditado] = useState('Falabella');
  const [fechaEditada, setFechaEditada] = useState('');
  const [horaEditada, setHoraEditada] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const manejarSeleccionArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setArchivo(file);
    setError(null);
    setProcesando(true);
    setProgreso(0);

    try {
      const resultado = await procesarComprobante(file, (pct) => setProgreso(pct));
      setDatosExtraidos(resultado);
      setFechaEditada(resultado.fecha);
      setHoraEditada(resultado.hora);
      setOrigenEditado(resultado.origen);
      setDetalleEditado(resultado.detalle);
      setMontoEditado(resultado.monto !== null ? resultado.monto.toFixed(2) : '');
    } catch (err) {
      console.error(err);
      setError('No se pudo leer la imagen. Intenta con otra captura.');
    } finally {
      setProcesando(false);
    }
  };

  const manejarSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const montoNumerico = parseFloat(montoEditado);

    if (isNaN(montoNumerico) || montoNumerico <= 0) {
      setError('Por favor verifica que el monto sea válido.');
      return;
    }

    await onRegistrarGasto({
      fecha: fechaEditada,
      hora: horaEditada,
      categoria,
      detalle: detalleEditado || '-',
      origen: origenEditado,
      monto: montoNumerico,
    });

    // Limpiar y cerrar
    setArchivo(null);
    setDatosExtraidos(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Subir captura</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <p className="mt-1 text-sm text-gray-500">
          Comparte o elige la foto del voucher. La leeremos y registraremos el gasto.
        </p>

        <form onSubmit={manejarSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Captura del comprobante
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={manejarSeleccionArchivo}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </div>

          {procesando && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-600">
                <span>Analizando comprobante con OCR...</span>
                <span>{progreso}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-black transition-all duration-200"
                  style={{ width: `${progreso}%` }}
                />
              </div>
            </div>
          )}

          {datosExtraidos && !procesando && (
            <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">Datos detectados (puedes editarlos):</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Banco / Origen</label>
                  <select
                    value={origenEditado}
                    onChange={(e) => setOrigenEditado(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  >
                    <option value="Falabella">Falabella</option>
                    <option value="Yape">Yape</option>
                    <option value="BCP">BCP</option>
                    <option value="Scotiabank">Scotiabank</option>
                    <option value="Desconocido">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-500">Monto (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={montoEditado}
                    onChange={(e) => setMontoEditado(e.target.value)}
                    placeholder="0.00"
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Fecha</label>
                  <input
                    type="date"
                    value={fechaEditada}
                    onChange={(e) => setFechaEditada(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Hora</label>
                  <input
                    type="text"
                    value={horaEditada}
                    onChange={(e) => setHoraEditada(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">Categoría</label>
                  <input
                    type="text"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-500">Detalle</label>
                  <input
                    type="text"
                    value={detalleEditado}
                    onChange={(e) => setDetalleEditado(e.target.value)}
                    className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!archivo || procesando}
            className="w-full rounded-full bg-black py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {procesando ? 'Leyendo voucher...' : 'Registrar comprobante'}
          </button>
        </form>
      </div>
    </div>
  );
}
