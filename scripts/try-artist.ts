import { createTicketmasterProvider } from '@/lib/providers/ticketmaster';

const artistName = process.argv[2];

if (!artistName) {
  console.error('Usage: npm run try:artist -- "Artist Name"');
  process.exitCode = 1;
} else {
  const provider = createTicketmasterProvider();
  const artistId = await provider.resolveArtist(artistName);

  if (!artistId) {
    console.log(`No exact Ticketmaster attraction match found for "${artistName}".`);
  } else {
    const events = await provider.fetchEventsForArtist(artistId);
    console.log(JSON.stringify(events, null, 2));
  }
}
