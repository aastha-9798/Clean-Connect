import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DriveDialogComponent } from './drive-dialog.component';

describe('DriveDialogComponent', () => {
  let component: DriveDialogComponent;
  let fixture: ComponentFixture<DriveDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriveDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DriveDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
