import os

with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = "<div>\n          <label class=\"block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1\">Tipo de Cambio (MXN/USD)</label>"
end_marker = "<div>\n          <label class=\"block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1\">Utilidad General %</label>"

if start_marker in content and end_marker in content:
    start_idx = content.find(start_marker)
    end_idx = content.find(end_marker)
    
    # We want to remove everything from start_marker to just before end_marker
    new_content = content[:start_idx] + content[end_idx:]
    
    with open('src/app/features/cotizaciones/nueva-cotizacion/nueva-cotizacion.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Removed Tipo de Cambio block")
else:
    print("Could not find markers")
