import os

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Add cargarTipoCambio method
tipo_cambio_method = """
  cargarTipoCambio() {
    this.http.get<any>('https://open.er-api.com/v6/latest/USD').subscribe({
      next: (data) => {
        if (data && data.rates && data.rates.MXN) {
          this.tipoCambio.set(data.rates.MXN);
          this.actualizarFila();
          this.toast.show('Tipo de cambio actualizado (' + data.rates.MXN.toFixed(2) + ')', 'success');
        }
      },
      error: (err) => {
        console.error('Error fetching exchange rate', err);
        this.toast.show('Error al obtener el tipo de cambio', 'error');
      }
    });
  }
"""

if 'cargarTipoCambio()' not in content:
    content = content.replace('cargarCatalogo() {', tipo_cambio_method + '\n  cargarCatalogo() {')
    content = content.replace('this.cargarCatalogo();', 'this.cargarCatalogo();\n    this.cargarTipoCambio();')

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated TS")
