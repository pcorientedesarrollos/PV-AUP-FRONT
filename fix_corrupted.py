import sys

p = r"src\app\features\productos\productos.component.ts"
with open(p, "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "this.http.get<any[]>(/pos/catalogo-sat" in line:
        # It's corrupted!
        lines[i] = line.replace("", "$""{environment.apiUrl}")
        lines[i] = lines[i].replace("?q=).subscribe", "?q=$""{q}).subscribe")
        lines[i] = lines[i].replace("?q=).s", "?q=$""{q}).s") # fallback
        lines[i] = lines[i].replace("this.http.get<any[]>(", "this.http.get<any[]>(") # just in case
        
with open(p, "w", encoding="utf-8") as f:
    f.writelines(lines)
