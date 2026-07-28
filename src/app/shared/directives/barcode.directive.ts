import { Directive, ElementRef, Input, OnChanges, SimpleChanges, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import JsBarcode from 'jsbarcode';

@Directive({
  selector: '[appBarcode]',
  standalone: true
})
export class BarcodeDirective implements OnChanges {
  @Input('appBarcode') barcodeValue!: string;
  @Input() barcodeOptions: any = {};

  constructor(private el: ElementRef, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (isPlatformBrowser(this.platformId) && this.barcodeValue) {
      try {
        JsBarcode(this.el.nativeElement, this.barcodeValue, {
          format: "CODE128",
          lineColor: "#1e293b",
          background: "transparent",
          width: 1.5,
          height: 40,
          displayValue: true,
          fontSize: 12,
          margin: 0,
          ...this.barcodeOptions
        });
      } catch(e) {
        (function(...args: any[]){})('Error generating barcode', e);
      }
    }
  }
}
