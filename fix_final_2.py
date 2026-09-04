import sys

p = r"src\app\features\productos\productos.component.ts"
with open(p, "r", encoding="utf-8") as f:
    c = f.read()

bad1 = "this.http.get<any[]>(/pos/catalogo-sat/productos?q=).subscribe({"
good1 = "this.http.get<any[]>(\\/pos/catalogo-sat/productos?q=\\).subscribe({"

bad2 = "this.http.get<any[]>(/pos/catalogo-sat/unidades?q=).subscribe({"
good2 = "this.http.get<any[]>(\\/pos/catalogo-sat/unidades?q=\\).subscribe({"

c = c.replace(bad1, good1.replace('\\$', '$'))
c = c.replace(bad2, good2.replace('\\$', '$'))

with open(p, "w", encoding="utf-8") as f:
    f.write(c)
