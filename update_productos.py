import sys

file_path = r'src/app/features/productos/productos.component.ts'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'const min = Number(p.stockMinimo) > 0 ? Number(p.stockMinimo) : 5;',
    'const min = p.stockMinimo != null && p.stockMinimo !== \'\' ? Number(p.stockMinimo) : 5;'
)

content = content.replace(
    'const min = Number(prod.stockMinimo || 5);',
    'const min = prod.stockMinimo != null && prod.stockMinimo !== \'\' ? Number(prod.stockMinimo) : 5;'
)

validation_code = '''
  // Validaciones en tiempo real
  duplicadoNombre = computed(() => {
    if (!this.nuevoProducto?.nombre) return false;
    const nombre = this.nuevoProducto.nombre.toLowerCase().trim();
    return this.productos().some(p => p.nombre.toLowerCase().trim() === nombre && p.idProducto !== this.nuevoProducto.idProducto);
  });
  
  duplicadoCodigo = computed(() => {
    if (!this.nuevoProducto?.codigoBarras) return false;
    const codigo = this.nuevoProducto.codigoBarras.toLowerCase().trim();
    return this.productos().some(p => p.codigoBarras?.toLowerCase().trim() === codigo && p.idProducto !== this.nuevoProducto.idProducto);
  });

  formularioInvalido = computed(() => {
    return !this.nuevoProducto?.nombre?.trim() || this.duplicadoNombre() || this.duplicadoCodigo();
  });
'''
if 'duplicadoNombre =' not in content:
    content = content.replace(
        '  categorias = signal<any[]>([]);',
        '  categorias = signal<any[]>([]);\n' + validation_code
    )

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Success')
