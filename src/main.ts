import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    if (regs.length === 0) return;
    Promise.all(regs.map((r) => r.unregister()))
      .then(() =>
        'caches' in window
          ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          : undefined,
      )
      .then(() => location.reload());
  });
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
