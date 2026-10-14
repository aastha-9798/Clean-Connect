import { MatDialogConfig } from '@angular/material/dialog';

// Size of the report and drive detail dialogs. The 'cc-dialog' panel class (styles.css)
// lifts Material's 560px width cap and makes only the dialog's content scroll,
// with the footer always visible.
export const DETAIL_DIALOG_CONFIG: MatDialogConfig = {
  width: '760px',
  maxWidth: 'calc(100vw - 24px)',
  maxHeight: '90vh',
  panelClass: 'cc-dialog'
};
