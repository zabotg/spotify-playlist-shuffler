import { PlaylistView } from './_components/playlist-view';

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = await params;
  return <PlaylistView playlistId={id} />;
}
