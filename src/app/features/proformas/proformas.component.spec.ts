import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Proformas } from './proformas';

describe('Proformas', () => {
  let component: Proformas;
  let fixture: ComponentFixture<Proformas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Proformas],
    }).compileComponents();

    fixture = TestBed.createComponent(Proformas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
