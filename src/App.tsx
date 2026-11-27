import { useRef, useState } from 'react';
import { Comprobante, extraerComprobante } from './receiptExtractor';

type Registro = Comprobante & { id: number; imagen: string };

export default function App() {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [actual, setActual] = useState<Comprobante | null>(null);
  const [registros, setRegistros] = useState<Registro[]>(() => {
    const guardado = localStorage.getItem('scanner-foto-registros');
    return guardado ? JSON.parse(guardado) : [];
  });
  const contador = useRef(Date.now());

  function seleccionar(event: React.ChangeEvent<HTMLInputElement>) {
    const imagen = event.target.files?.[0];
    if (!imagen) return;
    setArchivo(imagen);
    setPreview(URL.createObjectURL(imagen));
    setActual(null);
  }

  async function analizar() {
    if (!archivo) return;
    setProcesando(true);
    setProgreso(0);
    try {
      setActual(await extraerComprobante(archivo, setProgreso));
    } finally {
      setProcesando(false);
    }
  }

  function actualizar<K extends keyof Comprobante>(campo: K, valor: Comprobante[K]) {
    if (actual) setActual({ ...actual, [campo]: valor });
  }

  function guardar() {
    if (!actual) return;
    const nuevo: Registro = { ...actual, id: contador.current++, imagen: preview };
    const siguiente = [nuevo, ...registros];
    setRegistros(siguiente);
    localStorage.setItem('scanner-foto-registros', JSON.stringify(siguiente));
    setArchivo(null);
    setPreview('');
    setActual(null);
  }

  function eliminar(id: number) {
    const siguiente = registros.filter((item) => item.id !== id);
    setRegistros(siguiente);
    localStorage.setItem('scanner-foto-registros', JSON.stringify(siguiente));
  }

  return (
    <main className="contenedor">
      <h1>Scanner-Foto</h1>
      <p class="subtitulo">Extrae los datos de tus comprobantes y revisa antes de guardar.</p>

      <section className="panel">
        <div className="carga">
          <input type="file" accept="image/*" capture="environment" onChange={seleccionar} />
          {preview && <img className="vista" src={preview} alt="Captura seleccionada" />}
          <button className="primario" onClick={analizar} disabled={!archivo || procesando}>
            {procesando ? `Leyendo imagen... ${progreso}%` : 'Extraer datos'}
          </button>
        </div>

        {actual && (
          <div className="formulario">
            <label>Origen / banco<select value={actual.origen} onChange={(e) => actualizar('origen', e.target.value)}>
              {['Yape', 'Plin', 'BCP', 'BBVA', 'Scotiabank', 'Banco Falabella', 'Interbank', 'Banco Estado', 'Desconocido'].map((b) => <option key={b}>{b}</option>)}
            </select></label>
            <label>Fecha<input type="date" value={actual.fecha} onChange={(e) => actualizar('fecha', e.target.value)} /></label>
            <label>Hora<input type="text" value={actual.hora} onChange={(e) => actualizar('hora', e.target.value)} placeholder="HH:mm:ss" /></label>
            <label>Monto (S/)<input type="number" step="0.01" value={actual.monto ?? ''} onChange={(e) => actualizar('monto', e.target.value ? Number(e.target.value) : null)} /></label>
            <label>Número de comprobante / operación<input value={actual.numeroOperacion} onChange={(e) => actualizar('numeroOperacion', e.target.value)} /></label>
            <label>Detalle<input value={actual.detalle} onChange={(e) => actualizar('detalle', e.target.value)} /></label>
            <button className="guardar" onClick={guardar}>Guardar comprobante</button>
          </div>
        )}
      </section>

      <section>
        <h2>Comprobantes registrados</h2>
        <div className="tabla-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Hora</th><th>Origen</th><th>Monto</th><th>Detalle / Operación</th><th></th></tr></thead>
            <tbody>
              {registros.map((item) => (
                <tr key={item.id}><td>{item.fecha || '-'}</td><td>{item.hora || '-'}</td><td>{item.origen}</td><td>S/ {item.monto?.toFixed(2) ?? '-'}</td><td>{item.detalle || item.numeroOperacion || '-'}</td><td><button className="borrar" onClick={() => eliminar(item.id)}>Eliminar</button></td></tr>
              ))}
              {!registros.length && <tr><td colSpan={6} className="vacio">Aún no hay comprobantes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
