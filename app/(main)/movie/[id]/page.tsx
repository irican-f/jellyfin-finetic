import {
  fetchMediaDetails,
  getImageUrl,
  fetchSimilarItems,
  getServerUrl,
} from "@/app/actions";
import { MediaActions } from "@/components/media-actions";
import { SearchBar } from "@/components/search-component";
import { Badge } from "@/components/ui/badge";
import { CastScrollArea } from "@/components/cast-scrollarea";
import { MediaSection } from "@/components/media-section";
import { VibrantAuroraBackground } from "@/components/vibrant-aurora-background";
import { VibrantLogo } from "@/components/vibrant-logo";
import { VibrantBackdrop } from "@/components/vibrant-backdrop";
import { RottenTomatoesIcon } from "@/components/icons/rotten-tomatoes";
import { TextAnimate } from "@/components/magicui/text-animate";
import { Star } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BaseItemDto } from "@jellyfin/sdk/lib/generated-client/models";
import { TextScramble } from "@/components/motion-primitives/text-scramble";
import { BackdropImage } from "@/components/media-page/backdrop-image";
import { PosterImage } from "@/components/media-page/poster-image";

export default async function Movie({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const movie = await fetchMediaDetails(id);

    if (!movie) {
      return <div className="p-4">Movie not found</div>;
    }

    const primaryImage = await getImageUrl(id, "Primary");
    const backdropImage = await getImageUrl(id, "Backdrop");
    const logoImage = await getImageUrl(id, "Logo");

    // Fetch similar items and server URL for the More Like This section
    const [similarItems, serverUrl] = await Promise.all([
      fetchSimilarItems(id, 12),
      getServerUrl(),
    ]);

    return (
      <div className="min-h-screen overflow-hidden md:pr-1 pb-8">
        {/* Aurora background based on poster colors */}
        <VibrantAuroraBackground
          posterUrl={primaryImage}
          className="fixed inset-0 z-10 pointer-events-none opacity-50"
        />

        {/* Backdrop section */}
        <div className="relative">
          {/* Backdrop image with gradient overlay */}
          <div className="relative h-[50vh] md:h-[70vh] overflow-hidden md:rounded-xl md:mt-2.5">
            <BackdropImage
              movie={movie}
              backdropImage={backdropImage}
              className="w-full h-full object-cover"
              width={1920}
              height={1080}
            />
            <VibrantLogo
              src={logoImage}
              alt={`${movie.Name} logo`}
              movieName={movie.Name || ""}
              width={300}
              height={96}
              className="absolute md:top-5/12 top-4/12 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10 max-h-20 md:max-h-24 w-auto object-contain max-w-2/3 invisible md:visible"
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
            {/* Movie poster */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 justify-center flex md:block z-50 mt-6">
              <PosterImage
                movie={movie}
                posterImage={primaryImage}
                className="w-full h-auto rounded-lg shadow-2xl max-w-1/2 md:max-w-full"
                width={500}
                height={750}
              />
            </div>

            {/* Movie information */}
            {/* <div className="h-screen absolute left-0 right-0 bg-white backdrop-blur-3xl -z-10 mt-4 invisible md:visible"></div> */}
            <div className="w-full md:w-2/3 lg:w-3/4 pt-10 md:pt-8 text-center md:text-start mt-8">
              <div className="mb-4 flex justify-center md:justify-start">
                <TextAnimate
                  as="h1"
                  className="text-4xl md:text-5xl font-semibold font-poppins text-foreground md:pl-8 drop-shadow-xl"
                  animation="blurInUp"
                  by="character"
                  once
                >
                  {movie.Name || ""}
                </TextAnimate>
              </div>

              {/* Movie badges */}
              <div className="flex flex-wrap items-center gap-2 mb-2 justify-center md:justify-start md:pl-8">
                {movie.ProductionYear && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {movie.ProductionYear}
                  </Badge>
                )}
                {movie.OfficialRating && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {movie.OfficialRating}
                  </Badge>
                )}
                {movie.RunTimeTicks && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm"
                  >
                    {Math.round(movie.RunTimeTicks / 600000000)} min
                  </Badge>
                )}
                {movie.CommunityRating && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm flex items-center gap-1"
                  >
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {movie.CommunityRating.toFixed(1)}
                  </Badge>
                )}
                {movie.CriticRating && (
                  <Badge
                    variant="outline"
                    className="bg-background/90 backdrop-blur-sm flex items-center gap-1"
                  >
                    <RottenTomatoesIcon size={12} />
                    {movie.CriticRating}%
                  </Badge>
                )}
              </div>

              <div className="px-8 md:pl-8 md:pt-4 md:pr-16 flex flex-col justify-center md:items-start items-center">
                <MediaActions movie={movie} />

                {movie.Taglines && (
                  <TextScramble
                    className="text-lg text-muted-foreground mb-4 max-w-4xl text-center md:text-left font-poppins drop-shadow-md"
                    duration={1.2}
                  >
                    {movie.Taglines[0]}
                  </TextScramble>
                )}

                <span className="text-md leading-relaxed mb-6 max-w-4xl">
                  {movie.Overview}
                </span>

                {/* Additional movie information */}
                <div className="space-y-3 mb-6 max-w-4xl">
                  {/* Genres */}
                  {movie.Genres && movie.Genres.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground min-w-fit">
                        Genres:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {movie.Genres.map((genre, index) => (
                          <Badge
                            key={genre}
                            variant="secondary"
                            className="text-xs"
                          >
                            {genre}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Director */}
                  {movie.People &&
                    movie.People.filter((person) => person.Type === "Director")
                      .length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground min-w-fit">
                          Director:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {movie.People.filter(
                            (person) => person.Type === "Director"
                          ).map((director, index, array) => (
                            <span key={director.Id} className="text-sm">
                              <Link
                                href={`/person/${director.Id}`}
                                className="hover:underline cursor-pointer"
                              >
                                {director.Name}
                              </Link>
                              {index < array.length - 1 && ", "}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Writers */}
                  {movie.People &&
                    movie.People.filter((person) => person.Type === "Writer")
                      .length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground min-w-fit">
                          Writers:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {movie.People.filter(
                            (person) => person.Type === "Writer"
                          ).map((writer, index, array) => (
                            <span key={writer.Id} className="text-sm">
                              <Link
                                href={`/person/${writer.Id}`}
                                className="hover:underline cursor-pointer"
                              >
                                {writer.Name}
                              </Link>
                              {index < array.length - 1 && ", "}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Studios */}
                  {movie.Studios && movie.Studios.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground min-w-fit">
                        Studio:
                      </span>
                      <span className="text-sm">
                        {movie.Studios.map(
                          (studio: any) => studio.Name || studio
                        ).join(", ")}
                      </span>
                    </div>
                  )}
                </div>
                {/* Media actions */}
              </div>
            </div>
          </div>
        </div>
        {/* Cast section */}
        <div className="mt-12 px-6">
          <CastScrollArea people={movie.People!} mediaId={id} />
        </div>

        {similarItems && (
          <div className="mt-8 px-6">
            <MediaSection
              sectionName="More Like This"
              mediaItems={similarItems as BaseItemDto[]}
              serverUrl={serverUrl!}
            />
          </div>
        )}
        {/* More Like This section */}
      </div>
    );
  } catch (error: any) {
    // If authentication expired, redirect to login
    if (error.message?.includes("Authentication expired")) {
      redirect("/login");
    }

    // For other errors, show an error page
    console.error("Error loading movie:", error);
    return <div className="p-4">Error loading movie. Please try again.</div>;
  }
}
