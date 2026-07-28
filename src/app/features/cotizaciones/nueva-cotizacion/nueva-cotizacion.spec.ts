import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NuevaCotizacion } from './nueva-cotizacion';

describe('NuevaCotizacion', () => {
  let component: NuevaCotizacion;
  let fixture: ComponentFixture<NuevaCotizacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NuevaCotizacion],
    }).compileComponents();

    fixture = TestBed.createComponent(NuevaCotizacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
