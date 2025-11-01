import {
  fetchMediaDetails,
  getImageUrl,
  fetchSimilarItems,
  getServerUrl,
} from "@/app/actions";
import { fetchEpisodes } from "@/app/actions/tv-shows";
import { SearchBar } from "@/components/search-component";
import { Badge } from "@/components/ui/badge";
import { VibrantAuroraBackground } from "@/components/vibrant-aurora-background";
import { VibrantLogo } from "@/components/vibrant-logo";
import { SeasonEpisodes } from "@/components/season-episodes";
import { SeriesPlayButton } from "@/components/series-play-button";
import { MediaSection } from "@/components/media-section";
import { Star, Play, TvIcon } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CastScrollArea } from "@/components/cast-scrollarea";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { BackdropImage } from "@/components/media-page/backdrop-image";
import { PosterImage } from "@/components/media-page/poster-image";

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const serverUrl = await getServerUrl();

  try {
    const season = await fetchMediaDetails(id);
    const episodes = await fetchEpisodes(id);

    if (!season) {
      return <div className="p-4">Season not found</div>;
    }

    const primaryImage = await getImageUrl(id, "Primary");
    const backdropImage = await getImageUrl(season.SeriesId || id, "Backdrop");
    const logoImage = await getImageUrl(season.SeriesId || id, "Logo");

    // Fetch similar items and server URL for the More Like This section
    const [similarItems] = await Promise.all([
      fetchSimilarItems(season.SeriesId || id, 12),
    ]);

    return (
      <div className="min-h-screen overflow-hidden md:pr-1 pb-8">
        {/* Aurora background based on backdrop image */}
        <VibrantAuroraBackground
          posterUrl={backdropImage}
          className="fixed inset-0 z-10 pointer-events-none opacity-50"
        />

        {/* Backdrop section */}
        <div className="relative">
          {/* Backdrop image with gradient overlay */}
          <div className="relative h-[50vh] md:h-[70vh] overflow-hidden md:rounded-xl md:mt-2.5">
            <BackdropImage
              movie={season}
              backdropImage={backdropImage}
              className="w-full h-full object-cover"
              width={1920}
              height={1080}
            />
            <VibrantLogo
              src={logoImage}
              alt={`${season.SeriesName} logo`}
              movieName={season.SeriesName || ""}
              width={300}
              height={96}
              className="absolute md:top-4/12 top-4/12 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 max-h-20 md:max-h-24 w-auto object-contain max-w-2/3 invisible md:visible"
            />
            {/* Enhanced gradient overlay for smooth transition to overview */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/30 to-black/90 md:rounded-xl" />
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent md:rounded-xl" />
          </div>

          {/* Search bar positioned over backdrop */}
          <div className="absolute top-8 left-0 right-0 z-20 px-6 flex justify-center">
            <SearchBar />
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 -mt-54 md:pl-6 bg-background/95 dark:bg-background/50 backdrop-blur-xl rounded-2xl mx-4 pb-6">
          <div className="flex flex-col md:flex-row mx-auto">
            {/* Season poster */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 justify-center flex md:block z-50 mt-6">
              <PosterImage
                movie={season}
                posterImage={primaryImage}
                className="w-full h-auto rounded-lg shadow-2xl max-w-1/2 md:max-w-full"
                width={500}
                height={750}
              />
            </div>

            {/* Season information */}
            <div className="w-full md:w-2/3 lg:w-3/4 pt-10 md:pt-8 text-center md:text-start mt-6">
              {/* Back to series button */}
              <div className="mb-4 flex justify-center md:justify-start md:pl-8">
                <Link
                  href={`/series/${season.SeriesId}`}
                  className="flex items-center gap-2 text-foreground/80 hover:underline hover:underline-offset-4"
                >
                  <TvIcon className="w-4 h-4" />
                  {season.SeriesName}
                </Link>
              </div>

              <div className="mb-4 flex justify-center md:justify-start mt-4">
                <span className="text-4xl md:text-5xl font-semibold font-poppins text-foreground md:pl-8 drop-shadow-xl">
                  {season.Name || `Season ${season.IndexNumber || 1}`}
                </span>
              </div>

              {/* Season badges */}
              <div className="flex flex-wrap items-center gap-2 mb-2 justify-center md:justify-start md:pl-8">
                {season.ProductionYear && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {season.ProductionYear}
                  </Badge>
                )}
                {episodes && episodes.length > 0 && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {episodes.length} Episode{episodes.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {season.CommunityRating && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm flex items-center gap-1"
                  >
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {season.CommunityRating.toFixed(1)}
                  </Badge>
                )}
              </div>

              {/* Play button */}
              <div className="flex justify-center md:justify-start md:pl-8 mt-8">
                <SeriesPlayButton series={season} />
              </div>

              <div className="px-8 md:pl-8 md:pt-6 md:pr-16 flex flex-col justify-center md:items-start items-center">
                {season.Overview && (
                  <p className="text-md leading-relaxed mb-6 max-w-4xl">
                    {season.Overview}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Episodes section */}
          <SeasonEpisodes showId={season.SeriesId || id} currentSeasonId={id} />
        </div>

        {/* Cast section */}
        <div className="mt-12 px-6">
          <CastScrollArea people={season.People!} mediaId={id} />
        </div>

        {/* More Like This section */}
        {similarItems && (
          <div className="mt-8 px-6">
            <MediaSection
              sectionName="More Like This"
              mediaItems={similarItems as BaseItemDto[]}
              serverUrl={serverUrl!}
            />
          </div>
        )}
      </div>
    );
  } catch (error: any) {
    // If authentication expired, redirect to login
    if (error.message?.includes("Authentication expired")) {
      redirect("/login");
    }

    // For other errors, show an error page
    console.error("Error loading season:", error);
    return <div className="p-4">Error loading season. Please try again.</div>;
  }
}
