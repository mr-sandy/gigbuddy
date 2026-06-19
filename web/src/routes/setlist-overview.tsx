import { useParams } from 'react-router';

/*
 * Setlist overview — STUB for Story 3.2.
 *
 * Story 3.2 adds the `/setlists/:setlistId` route so GigCard tap targets
 * have a valid destination, but the real surface (Setlist sections, songs
 * with per-gig annotations, etc.) lands in Story 3.3. This component only
 * renders a placeholder heading using the path param so router wiring
 * works end-to-end and Sandy never lands on a 404.
 */
export function SetlistOverview() {
  const { setlistId } = useParams<{ setlistId: string }>();
  return <h1>Setlist {setlistId}</h1>;
}
