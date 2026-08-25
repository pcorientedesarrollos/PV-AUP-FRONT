const fs = require('fs');
const file = 'src/app/features/produccion/produccion.component.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Comod\ufffdn/g, 'Comodín');
content = content.replace("next: (data) => { \r\n        this.productos.set(data || []);", "next: (res: any) => { \r\n        const data = res.data || res || []; \r\n        this.productos.set(data);");
content = content.replace("next: (data) => { \n        this.productos.set(data || []);", "next: (res: any) => { \n        const data = res.data || res || []; \n        this.productos.set(data);");

fs.writeFileSync(file, content, 'utf8');
