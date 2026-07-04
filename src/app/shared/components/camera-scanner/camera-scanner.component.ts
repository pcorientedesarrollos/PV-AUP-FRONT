import { Component, OnDestroy, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { Html5QrcodeScanner, Html5QrcodeScanType } from 'html5-qrcode';

@Component({
  selector: 'app-camera-scanner',
  standalone: true,
  templateUrl: './camera-scanner.component.html'
})
export class CameraScannerComponent implements AfterViewInit, OnDestroy {
  @Output() codeScanned = new EventEmitter<string>();
  
  private html5QrcodeScanner!: Html5QrcodeScanner;

  ngAfterViewInit(): void {
    this.html5QrcodeScanner = new Html5QrcodeScanner(
      "reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        rememberLastUsedCamera: true,
      },
      false
    );

    this.html5QrcodeScanner.render(
      this.onScanSuccess.bind(this),
      this.onScanFailure.bind(this)
    );
  }

  private lastScannedCode = '';
  private lastScannedTime = 0;

  onScanSuccess(decodedText: string, decodedResult: any) {
    const now = Date.now();
    // Prevenir lectura duplicada del MISMO código en menos de 2.5 segundos
    if (decodedText === this.lastScannedCode && now - this.lastScannedTime < 2500) {
      return;
    }
    
    this.lastScannedCode = decodedText;
    this.lastScannedTime = now;
    
    this.playBeep();
    this.codeScanned.emit(decodedText);
  }

  private playBeep() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.value = 800; // Tono agudo tipo escáner
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
      
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Ignorar si el navegador bloquea el audio
    }
  }

  onScanFailure(error: any) {
    // Generalmente ocurre muchas veces por segundo cuando no detecta código.
    // Lo ignoramos silenciosamente para no saturar la consola.
  }

  ngOnDestroy(): void {
    if (this.html5QrcodeScanner) {
      try {
        this.html5QrcodeScanner.clear();
      } catch (e) {
        console.error("Error clearing scanner", e);
      }
    }
  }
}
