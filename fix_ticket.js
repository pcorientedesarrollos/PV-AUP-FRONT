const fs = require('fs');
const file = 'src/app/core/services/ticket-printer.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const descGlobal = descGlobalRaw > 0 ? descGlobalRaw * 1.16 : 0; // Asumiendo IVA 16% global", "const descGlobal = descGlobalRaw > 0 ? descGlobalRaw * (1 + ((config.ivaPorDefecto || 16) / 100)) : 0;");

fs.writeFileSync(file, content, 'utf8');
