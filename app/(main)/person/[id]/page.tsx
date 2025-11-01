import {
  fetchPersonDetails,
  fetchPersonFilmography,
  getImageUrl,
} from "@/app/actions";
import { SearchBar } from "@/components/search-component";
import { Badge } from "@/components/ui/badge";
import { VibrantAuroraBackground } from "@/components/vibrant-aurora-background";
import { redirect } from "next/navigation";
import Link from "next/link";
import { BaseItemKind } from "@jellyfin/sdk/lib/generated-client/models/base-item-kind";
import { ExternalLinkIcon, Calendar, MapPin } from "lucide-react";
import { ImdbIcon } from "@/components/icons/imdb";
import { TmdbIcon } from "@/components/icons/tmdb";
import { Button } from "@/components/ui/button";
import { MediaCard } from "@/components/media-card";
import { getAuthData } from "@/app/actions/utils";
import { BiographySection } from "@/components/biography-section";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  try {
    const { serverUrl } = await getAuthData();
    const person = await fetchPersonDetails(id);

    if (!person) {
      return <div className="p-4">Person not found</div>;
    }

    const primaryImage = await getImageUrl(id, "Primary");

    // Fetch filmography using ItemsApi with PersonIds
    const filmography = await fetchPersonFilmography(id);

    // Helper function to format dates
    const formatDate = (dateString: string | null | undefined) => {
      if (!dateString) return null;
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    // Helper function to calculate age
    const calculateAge = (
      birthDate: string | null | undefined,
      deathDate?: string | null | undefined
    ) => {
      if (!birthDate) return null;
      const birth = new Date(birthDate);
      const end = deathDate ? new Date(deathDate) : new Date();
      const age = end.getFullYear() - birth.getFullYear();
      const monthDiff = end.getMonth() - birth.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && end.getDate() < birth.getDate())
      ) {
        return age - 1;
      }
      return age;
    };

    // Helper function to get external link icon and name
    const getExternalLinkInfo = (name: string) => {
      const lowerName = name.toLowerCase();
      if (lowerName.includes("imdb"))
        return { name: "IMDb", icon: <ImdbIcon size={16} /> };
      if (lowerName.includes("tmdb") || lowerName.includes("themoviedb"))
        return { name: "TMDb", icon: <TmdbIcon size={16} /> };
      if (lowerName.includes("wikipedia"))
        return { name: "Wikipedia", icon: "📖" };
      if (lowerName.includes("instagram"))
        return { name: "Instagram", icon: "📸" };
      if (lowerName.includes("twitter")) return { name: "Twitter", icon: "🐦" };
      if (lowerName.includes("facebook"))
        return { name: "Facebook", icon: "👥" };
      return { name: name, icon: "🔗" };
    };

    return (
      <div className="min-h-screen overflow-hidden md:pr-1 pb-16">
        {/* Aurora background */}
        <VibrantAuroraBackground
          posterUrl={primaryImage}
          className={`fixed inset-0 z-0 pointer-events-none opacity-30`}
        />

        {/* Backdrop section */}
        <div className="relative">
          {/* Search bar positioned over backdrop */}
          <div className="absolute top-8 left-0 right-0 z-20 px-6 flex justify-center">
            <SearchBar />
          </div>
        </div>

        {/* Content section */}
        <div className="relative z-10 mt-32 md:pl-8">
          <div className="flex flex-col md:flex-row mx-auto">
            {/* Person photo */}
            <div className="w-full md:w-1/3 lg:w-1/4 flex-shrink-0 justify-center flex md:block z-50">
              <img
                className="w-full h-auto rounded-lg shadow-2xl max-w-1/2 md:max-w-full"
                src={primaryImage}
                alt={person.Name || "Person Photo"}
                width={500}
                height={750}
              />
            </div>

            {/* Person information */}
            <div className="w-full md:w-2/3 lg:w-3/4 pt-10 md:pt-8 text-center md:text-start">
              <div className="mb-4 flex justify-center md:justify-start">
                <h1 className="text-4xl md:text-5xl font-semibold font-poppins text-foreground md:pl-8">
                  {person.Name}
                </h1>
              </div>

              {/* Person Details */}
              <div className="px-8 md:pl-8 md:pt-2 md:pr-16">
                {/* Birth and Death Information */}
                <div className="mb-6 space-y-3">
                  {person.PremiereDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Born:</span>
                      <span>
                        {formatDate(person.PremiereDate)} (age{" "}
                        {calculateAge(person.PremiereDate, person.EndDate)})
                      </span>
                    </div>
                  )}
                  {person.EndDate && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Died:</span>
                      <span>{formatDate(person.EndDate)}</span>
                    </div>
                  )}
                  {person.ProductionLocations &&
                    person.ProductionLocations.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          Birth Place:
                        </span>
                        <span>{person.ProductionLocations.join(", ")}</span>
                      </div>
                    )}
                </div>

                {/* Biography */}
                {person.Overview && (
                  <BiographySection
                    biography={person.Overview}
                    personName={person.Name || undefined}
                  />
                )}
                {/* External Links */}
                {person.ExternalUrls && person.ExternalUrls.length > 0 && (
                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {person.ExternalUrls.map((url, index) => {
                        const linkInfo = getExternalLinkInfo(url.Name || "");
                        return (
                          <Link
                            key={index}
                            href={url.Url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            draggable="false"
                          >
                            <Button variant="secondary" className="font-mono">
                              {linkInfo.icon}
                              {linkInfo.name}
                            </Button>
                            {/* <ExternalLinkIcon className="w-3 h-3" /> */}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Filmography Section */}
          {filmography.length > 0 && (
            <div className="mt-10">
              <h3 className="text-3xl font-semibold mb-8 font-poppins">
                Filmography
              </h3>
              <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                {filmography.map((item) => (
                  <MediaCard key={item.Id} item={item} serverUrl={serverUrl} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } catch (error: any) {
    // If authentication expired, redirect to login
    if (error.message?.includes("Authentication expired")) {
      redirect("/login");
    }

    // For other errors, show an error page
    console.error("Error loading person:", error);
    return <div className="p-4">Error loading person. Please try again.</div>;
  }
}
