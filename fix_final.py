import sys, re

p = r"src\app\features\productos\productos.component.ts"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

bad_prod_pattern = r"onSatProductSearch\(showDefault = false\) \{.*?error: \(err\) => \(function\(\.\.\.args: any\[\]\)\{\}\)\('Error searching SAT products', err\)\s*\}\);\s*\}, 300\);\s*\}"

good_prod = """  onSatProductSearch(showDefault = false) {
    clearTimeout(this.searchTimeout);
    if (!this.satProductQuery && !showDefault) {
      this.satProductsResults = [];
      return;
    }
    this.searchTimeout = setTimeout(() => {
      const q = this.satProductQuery ? encodeURIComponent(this.satProductQuery) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/productos?q=).subscribe({
        next: (data) => this.satProductsResults = data || [],
        error: (err) => console.error('Error searching SAT products', err)
      });
    }, 300);
  }"""

c = re.sub(bad_prod_pattern, good_prod, c, flags=re.DOTALL)

bad_unit_pattern = r"onSatUnitSearch\(showDefault = false\) \{.*?error: \(err\) => \(function\(\.\.\.args: any\[\]\)\{\}\)\('Error searching SAT units', err\)\s*\}\);\s*\}, 300\);\s*\}"

good_unit = """  onSatUnitSearch(showDefault = false) {
    clearTimeout(this.searchTimeout);
    if (!this.satUnitQuery && !showDefault) {
      this.satUnitsResults = [];
      return;
    }
    this.searchTimeout = setTimeout(() => {
      const q = this.satUnitQuery ? encodeURIComponent(this.satUnitQuery) : '';
      this.http.get<any[]>(${environment.apiUrl}/pos/catalogo-sat/unidades?q=).subscribe({
        next: (data) => this.satUnitsResults = data || [],
        error: (err) => console.error('Error searching SAT units', err)
      });
    }, 300);
  }"""

c = re.sub(bad_unit_pattern, good_unit, c, flags=re.DOTALL)

with open(p, "w", encoding="utf-8") as f:
    f.write(c)
