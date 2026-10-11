export interface FeedReport{
    id: number,
    reported_by:string,
    reported_by_id: string,  // user id of the reporter (for showing "Delete")
    date_reported:string,
    description:string,
    latitude: number,
    longitude: number,
    status: string,
    image: string,      // cover photo (first of images)
    images: string[]    // all photos, cover first
}