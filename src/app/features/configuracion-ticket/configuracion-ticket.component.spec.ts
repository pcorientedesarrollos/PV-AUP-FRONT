import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfiguracionTicket } from './configuracion-ticket';

describe('ConfiguracionTicket', () => {
  let component: ConfiguracionTicket;
  let fixture: ComponentFixture<ConfiguracionTicket>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracionTicket],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfiguracionTicket);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
