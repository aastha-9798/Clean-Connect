// what the logged-in user can do on a drive (GET /drives/{id}/me)
export interface MyDriveState {
  is_organizer: boolean;
  is_participant: boolean;
  checked_in: boolean;
  my_photo_count: number;
}

export interface DriveAttendee {
  user_id: string;
  username: string;
  checked_in: boolean;
  is_organizer: boolean;
}
