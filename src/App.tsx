import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { extraerComprobante, type Comprobante } from './receiptExtractor';
import type { Banco, Moneda } from './receiptParser';

type Registro = Omit<Comprobante, 'texto'> & {
  id: number;
  categoria: string;
  revisar: boolean;
};

type Captura = {
  id: number;
  archivo: File;
  preview: string;
  categoria?: string;
  comprobante?: Comprobante;
  error?: string;
  progreso: number;
};

const BANCOS: Banco[] = ['Yape', 'BCP', 'Scotiabank', 'BBVA', 'Falabella', 'Interbank', 'Otro'];
const CATEGORIAS = ['Alimentación', 'Transporte', 'Compras', 'Servicios', 'Salud', 'Educación', 'Otros'];
const CAMPOS_REQUERIDOS = ['fecha', 'hora', 'monto', 'moneda', 'detalle'];

function comprobanteVacio(): Comprobante {
  return {
    fecha: '',
    hora: '',
    monto: null,
    moneda: '',
    detalle: '',
    origen: 'Otro',
    numeroOperacion: '',
    confianza: 0,
    camposFaltantes: [...CAMPOS_REQUERIDOS, 'origen'],
    texto: '',
  };
}

function cargarRegistros(): Registro[] {
  const guardado = localStorage.getItem('scanner-foto-registros');
  if (!guardado) return [];
  try {
    const registros: unknown = JSON.parse(guardado);
    if (!Array.isArray(registros)) throw new Error('El contenido guardado no es una lista.');
    const limpios = registros.map((item) => {
      if (!item || typeof item !== 'object') throw new Error('Hay un comprobante guardado con formato inválido.');
      const { imagen: _imagen, texto: _texto, ...registro } = item as Record<string, unknown>;
      return registro as Registro;
    });
    if (registros.some((item) => item && typeof item === 'object' && ('imagen' in item || 'texto' in item))) {
      try {
        localStorage.setItem('scanner-foto-registros', JSON.stringify(limpios));
      } catch (error) {
        console.error('No se pudieron eliminar datos temporales de las capturas guardadas.', error);
      }
    }
    return limpios;
  } catch (error) {
    console.error('No se pudieron leer los comprobantes guardados.', error);
    return [];
  }
}

function esRevisar(comprobante: Comprobante): boolean {
  return comprobante.camposFaltantes.length > 0 || comprobante.confianza < 0.6;
}

function simbolo(moneda: Moneda): string {
  if (moneda === 'PEN') return 'S/';
  if (moneda === 'CLP' || moneda === 'USD') return '$';
  return '';
}

export default function App() {
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [indiceRevision, setIndiceRevision] = useState(0);
  const [procesando, setProcesando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>(cargarRegistros);
  const [toast, setToast] = useState('');
  const [idsDeshacer, setIdsDeshacer] = useState<number[]>([]);
  const contador = useRef(Date.now());
  const capturasRef = useRef(capturas);
  capturasRef.current = capturas;

  const agregarArchivos = useCallback((archivos: FileList | File[]) => {
    const imagenes = Array.from(archivos).filter((archivo) => archivo.type.startsWith('image/'));
    if (!imagenes.length) return;
    const nuevas = imagenes.map((archivo) => ({
      id: contador.current++,
      archivo,
      preview: URL.createObjectURL(archivo),
      progreso: 0,
    }));
    setCapturas((actuales) => [...actuales, ...nuevas]);
    setToast('');
  }, []);

  useEffect(() => {
    function pegarImagen(evento: ClipboardEvent) {
      const archivos = Array.from(evento.clipboardData?.items ?? [])
        .map((item) => item.getAsFile())
        .filter((archivo): archivo is File => Boolean(archivo?.type.startsWith('image/')));
      if (archivos.length) {
        evento.preventDefault();
        agregarArchivos(archivos);
      }
    }
    window.addEventListener('paste', pegarImagen);
    return () => window.removeEventListener('paste', pegarImagen);
  }, [agregarArchivos]);

  useEffect(() => () => capturasRef.current.forEach((captura) => URL.revokeObjectURL(captura.preview)), []);

  const capturaActual = capturas[indiceRevision];
  const procesadas = capturas.length > 0 && capturas.every((captura) => captura.comprobante);
  const pendientes = capturas.some((captura) => !captura.comprobante);

  function seleccionar(evento: ChangeEvent<HTMLInputElement>) {
    if (evento.target.files) agregarArchivos(evento.target.files);
    evento.target.value = '';
  }

  function soltar(evento: DragEvent<HTMLDivElement>) {
    evento.preventDefault();
    setArrastrando(false);
    agregarArchivos(evento.dataTransfer.files);
  }

  async function analizar() {
    if (!capturas.length || procesando) return;
    setProcesando(true);
    setToast('');
    for (const captura of capturas) {
      if (captura.comprobante) continue;
      try {
        const resultado = await extraerComprobante(captura.archivo, (progreso) => {
          setCapturas((actuales) => actuales.map((item) => item.id === captura.id ? { ...item, progreso } : item));
        });
        const bancoDesconocido = !resultado.texto.trim() || resultado.origen === 'Otro';
        const comprobante = bancoDesconocido
          ? { ...comprobanteVacio(), texto: resultado.texto }
          : resultado;
        setCapturas((actuales) => actuales.map((item) => item.id === captura.id
          ? { ...item, comprobante, progreso: 100 }
          : item));
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : 'Error desconocido al leer la captura.';
        console.error(`No se pudo procesar ${captura.archivo.name}.`, error);
        setCapturas((actuales) => actuales.map((item) => item.id === captura.id
          ? { ...item, comprobante: comprobanteVacio(), error: mensaje, progreso: 0 }
          : item));
      }
    }
    setIndiceRevision(0);
    setProcesando(false);
  }

  function actualizar<K extends keyof Comprobante>(campo: K, valor: Comprobante[K]) {
    if (!capturaActual?.comprobante) return;
    setCapturas((actuales) => actuales.map((item) => item.id === capturaActual.id && item.comprobante
      ? (() => {
        const comprobante = { ...item.comprobante, [campo]: valor };
        const camposFaltantes = [
          !comprobante.fecha && 'fecha',
          !comprobante.hora && 'hora',
          comprobante.monto === null && 'monto',
          !comprobante.moneda && 'moneda',
          !comprobante.detalle && 'detalle',
          comprobante.origen === 'Otro' && 'origen',
        ].filter((faltante): faltante is string => Boolean(faltante));
        return {
          ...item,
          comprobante: {
            ...comprobante,
            camposFaltantes,
            confianza: Number(((6 - camposFaltantes.length) / 6).toFixed(2)),
          },
        };
      })()
      : item));
  }

  function persistir(siguiente: Registro[]) {
    try {
      localStorage.setItem('scanner-foto-registros', JSON.stringify(siguiente));
      setRegistros(siguiente);
      return true;
    } catch (error) {
      console.error('No se pudieron guardar los comprobantes.', error);
      setToast('No se pudieron guardar los comprobantes en este dispositivo.');
      return false;
    }
  }

  function guardarTodo() {
    if (!capturas.length || capturas.some((captura) => !captura.comprobante)) return;
    const nuevos: Registro[] = capturas.map((captura) => {
      const { texto: _texto, ...datos } = captura.comprobante!;
      return {
        ...datos,
        id: captura.id,
        categoria: captura.categoria ?? 'Otros',
        revisar: esRevisar(captura.comprobante!),
      };
    });
    const clavesExistentes = new Set(registros.map((registro) => `${registro.origen}:${registro.detalle.trim().toLowerCase()}`));
    let duplicados = false;
    for (const registro of nuevos) {
      if (!registro.detalle) continue;
      const clave = `${registro.origen}:${registro.detalle.trim().toLowerCase()}`;
      if (clavesExistentes.has(clave)) duplicados = true;
      clavesExistentes.add(clave);
    }
    if (duplicados && !window.confirm('Este comprobante ya fue registrado. ¿Quieres duplicarlo de todas formas?')) return;

    const siguiente = [...nuevos, ...registros];
    if (!persistir(siguiente)) return;
    capturas.forEach((captura) => URL.revokeObjectURL(captura.preview));
    setCapturas([]);
    setIndiceRevision(0);
    setIdsDeshacer(nuevos.map((registro) => registro.id));
    setToast('Gasto registrado');
  }

  function deshacer() {
    if (!idsDeshacer.length) return;
    const ids = new Set(idsDeshacer);
    const siguiente = registros.filter((registro) => !ids.has(registro.id));
    if (persistir(siguiente)) {
      setIdsDeshacer([]);
      setToast('');
    }
  }

  function eliminar(id: number) {
    persistir(registros.filter((registro) => registro.id !== id));
  }

  function cancelarCapturas() {
    capturas.forEach((captura) => URL.revokeObjectURL(captura.preview));
    setCapturas([]);
    setIndiceRevision(0);
    setToast('');
  }

  const lecturaFallida = Boolean(capturaActual && (
    capturaActual.error || !capturaActual.comprobante?.texto.trim() ||
    capturaActual.comprobante.origen === 'Otro'
  ));

  return (
    <main className="contenedor">
      <h1>Scanner-Foto</h1>
      <p className="subtitulo">Extrae los datos de tus comprobantes y revisa antes de guardar.</p>

      <section className="panel">
        <div
          className={`carga${arrastrando ? ' arrastrando' : ''}`}
          onDragOver={(evento) => { evento.preventDefault(); setArrastrando(true); }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
        >
          <label className="selector-archivos">
            Subir captura(s)
            <input type="file" accept="image/*" multiple onChange={seleccionar} />
          </label>
          <p className="ayuda-carga">Elige desde tu galería o arrastra una imagen aquí. También puedes pegarla con Ctrl+V.</p>
          {capturas.length > 0 && <p>{capturas.length} captura(s) seleccionada(s)</p>}
          {procesando && <p role="status">Leyendo captura {capturas.findIndex((item) => !item.comprobante) + 1} de {capturas.length}… {capturas.find((item) => !item.comprobante)?.progreso ?? 0}%</p>}
          <button className="primario" onClick={analizar} disabled={!pendientes || procesando}>
            {procesando ? 'Leyendo imágenes…' : 'Extraer datos'}
          </button>
          {capturas.length > 0 && <button className="secundario" onClick={cancelarCapturas} disabled={procesando}>Cancelar capturas</button>}
        </div>

        {capturaActual?.comprobante && (
          <div className="formulario">
            <div className="encabezado-revision">
              <strong>Captura {indiceRevision + 1} de {capturas.length}</strong>
              {esRevisar(capturaActual.comprobante) && <span className="etiqueta-revisar">Revisar</span>}
            </div>
            <img className="vista" src={capturaActual.preview} alt="Vista previa temporal del comprobante" />
            {lecturaFallida && <p className="aviso-lectura">No pude leer esta captura, complétala manualmente.</p>}
            {capturaActual.error && <p className="error-lectura">OCR: {capturaActual.error}</p>}
            {capturaActual.comprobante.camposFaltantes.length > 0 && (
              <p className="aviso-lectura">Faltan datos: {capturaActual.comprobante.camposFaltantes.join(', ')}.</p>
            )}
            <label>Categoría<select value={capturaActual.categoria ?? 'Otros'} onChange={(e) => {
              const categoria = e.target.value;
              setCapturas((actuales) => actuales.map((item) => item.id === capturaActual.id ? { ...item, categoria } : item));
            }}>
              {CATEGORIAS.map((categoria) => <option key={categoria}>{categoria}</option>)}
            </select></label>
            <label>Origen / banco<select value={capturaActual.comprobante.origen} onChange={(e) => actualizar('origen', e.target.value as Banco)}>
              {BANCOS.map((banco) => <option key={banco}>{banco}</option>)}
            </select></label>
            <label>Fecha<input className={capturaActual.comprobante.camposFaltantes.includes('fecha') ? 'campo-revisar' : ''} type="date" value={capturaActual.comprobante.fecha} onChange={(e) => actualizar('fecha', e.target.value)} /></label>
            <label>Hora<input className={capturaActual.comprobante.camposFaltantes.includes('hora') ? 'campo-revisar' : ''} type="text" value={capturaActual.comprobante.hora} onChange={(e) => actualizar('hora', e.target.value)} placeholder="HH:mm:ss" /></label>
            <label>Monto<input className={capturaActual.comprobante.camposFaltantes.includes('monto') ? 'campo-revisar' : ''} type="number" step="0.01" value={capturaActual.comprobante.monto ?? ''} onChange={(e) => actualizar('monto', e.target.value ? Number(e.target.value) : null)} /></label>
            <label>Moneda<select className={capturaActual.comprobante.camposFaltantes.includes('moneda') ? 'campo-revisar' : ''} value={capturaActual.comprobante.moneda} onChange={(e) => actualizar('moneda', e.target.value as Moneda)}>
              <option value="">Selecciona moneda</option>
              {(['PEN', 'CLP', 'USD'] as const).map((moneda) => <option key={moneda} value={moneda}>{moneda}</option>)}
            </select></label>
            <label>Detalle / identificador de comprobante<input className={capturaActual.comprobante.camposFaltantes.includes('detalle') ? 'campo-revisar' : ''} value={capturaActual.comprobante.detalle} onChange={(e) => {
              actualizar('detalle', e.target.value);
              actualizar('numeroOperacion', e.target.value);
            }} /></label>
            {capturas.length > 1 && <div className="navegacion-revision">
              <button className="secundario" onClick={() => setIndiceRevision(Math.max(0, indiceRevision - 1))} disabled={indiceRevision === 0}>Anterior</button>
              {indiceRevision < capturas.length - 1 && <button className="secundario" onClick={() => setIndiceRevision(indiceRevision + 1)}>Siguiente</button>}
            </div>}
            <button className="guardar" onClick={guardarTodo} disabled={!procesadas}>
              {capturas.length > 1 ? 'Guardar todas' : 'Guardar comprobante'}
            </button>
          </div>
        )}
      </section>

      {toast && <p className="toast" role="status">{toast}{idsDeshacer.length > 0 && <> · <button onClick={deshacer}>Deshacer</button></>}</p>}

      <section>
        <h2>Comprobantes registrados</h2>
        <div className="tabla-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Hora</th><th>Categoría</th><th>Origen</th><th>Monto</th><th>Detalle / Operación</th><th></th></tr></thead>
            <tbody>
              {registros.map((item) => (
                <tr key={item.id}>
                  <td>{item.fecha || '-'}</td><td>{item.hora || '-'}</td><td>{item.categoria || 'Otros'}</td>
                  <td>{item.origen}{item.revisar && <span className="etiqueta-revisar">Revisar</span>}</td>
                  <td>{item.monto === null ? '-' : `${simbolo(item.moneda)} ${item.monto.toFixed(2)} ${item.moneda}`}</td>
                  <td>{item.detalle || item.numeroOperacion || '-'}</td>
                  <td><button className="borrar" onClick={() => eliminar(item.id)}>Eliminar</button></td>
                </tr>
              ))}
              {!registros.length && <tr><td colSpan={7} className="vacio">Aún no hay comprobantes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
