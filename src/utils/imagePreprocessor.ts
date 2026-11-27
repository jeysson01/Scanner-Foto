/**
 * Preprocesa la imagen de un comprobante antes de pasarla a Tesseract.js.
 * Convierte a escala de grises, aumenta el contraste e invierte colores si el fondo
 * es oscuro (modo oscuro de Yape, Falabella, BCP, Scotiabank).
 */
export async function preprocesarImagenOCR(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo inicializar el contexto 2D del canvas.'));
        return;
      }

      // Escalar ligeramente si es muy pequeña para mejorar la lectura de números
      const escala = img.width < 800 ? 1.5 : 1;
      canvas.width = img.width * escala;
      canvas.height = img.height * escala;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calcular brillo promedio para detectar modo oscuro
      let sumaBrillo = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        sumaBrillo += gris;
      }
      const brilloPromedio = sumaBrillo / (data.length / 4);
      const esModoOscuro = brilloPromedio < 128;

      // Aplicar escala de grises, inversión (si es oscuro) y contraste
      const contraste = 1.35; // Factor de contraste
      const intercepto = 128 * (1 - contraste);

      for (let i = 0; i < data.length; i += 4) {
        let gris = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (esModoOscuro) {
          gris = 255 - gris;
        }
        gris = gris * contraste + intercepto;
        gris = Math.max(0, Math.min(255, gris));

        data[i] = gris;
        data[i + 1] = gris;
        data[i + 2] = gris;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo cargar la imagen del comprobante.'));
    };

    img.src = url;
  });
}
