import re

p = r"src\app\features\productos\productos.component.ts"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

bad_prod = """    this.searchTimeout = setTimeout(() => {
      const q = this.satProductQuery ? encodeURIComponent(this.satProductQuery) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/productos?q=).subscribe({"""

good_prod = """    this.searchTimeout = setTimeout(() => {
      let searchStr = this.satProductQuery;
      // Si ya hay una opciǭn seleccionada y el usuario hace clic (showDefault), mostramos el catǭlogo completo
      if (showDefault && searchStr.includes(' - ')) {
        searchStr = '';
      } else if (searchStr.includes(' - ')) {
        // Si estǭ escribiendo pero aǧn tiene el guiǭn, buscamos por la clave pura
        searchStr = searchStr.split(' - ')[0];
      }
      const q = searchStr ? encodeURIComponent(searchStr) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/productos?q=).subscribe({"""

c = c.replace(bad_prod, good_prod)

bad_unit = """    this.searchTimeout = setTimeout(() => {
      const q = this.satUnitQuery ? encodeURIComponent(this.satUnitQuery) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/unidades?q=).subscribe({"""

good_unit = """    this.searchTimeout = setTimeout(() => {
      let searchStr = this.satUnitQuery;
      if (showDefault && searchStr.includes(' - ')) {
        searchStr = '';
      } else if (searchStr.includes(' - ')) {
        searchStr = searchStr.split(' - ')[0];
      }
      const q = searchStr ? encodeURIComponent(searchStr) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/unidades?q=).subscribe({"""

c = c.replace(bad_unit, good_unit)

with open(p, "w", encoding="utf-8") as f:
    f.write(c)

print("Fixed search string extraction")
