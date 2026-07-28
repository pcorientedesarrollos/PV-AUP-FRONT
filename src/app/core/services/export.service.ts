import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  /**
   * Exporta datos a un archivo Excel
   * @param data Arreglo de objetos a exportar
   * @param fileName Nombre del archivo (sin extensión)
   */
  exportToExcel(data: any[], fileName: string): void {
    if (!data || data.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const workbook: XLSX.WorkBook = { Sheets: { 'Datos': worksheet }, SheetNames: ['Datos'] };
    XLSX.writeFile(workbook, `${fileName}_${new Date().getTime()}.xlsx`);
  }

  /**
   * Exporta datos a un archivo PDF usando jsPDF y jspdf-autotable
   * @param headers Arreglo de cadenas para la cabecera de la tabla
   * @param data Arreglo de arreglos (filas) con los datos a mostrar
   * @param title Título del documento PDF
   * @param fileName Nombre del archivo (sin extensión)
   * @param orientation Orientación de la página (portrait o landscape)
   */
  exportToPdf(headers: string[], data: any[][], title: string, fileName: string, orientation: 'p' | 'l' = 'p'): void {
    if (!data || data.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }
    const doc = new jsPDF(orientation, 'pt', 'a4');
    
    // Título
    doc.setFontSize(18);
    doc.text(title, 40, 40);
    
    // Fecha
    doc.setFontSize(10);
    const dateStr = new Date().toLocaleString();
    doc.text(`Fecha de exportación: ${dateStr}`, 40, 60);

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 70,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [245, 158, 11] }, // amber-500
      alternateRowStyles: { fillColor: [245, 247, 250] } // slate-50
    });

    doc.save(`${fileName}_${new Date().getTime()}.pdf`);
  }
}
