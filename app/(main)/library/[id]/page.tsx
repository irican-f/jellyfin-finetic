import { fetchLibraryItems, getLibraryById } from "@/app/actions";
import { getAuthData } from "@/app/actions/utils";
import { LibraryMediaListVirtual } from "@/components/library-media-list-virtual";
import { SearchBar } from "@/components/search-component";
import { ScanLibraryButton } from "@/components/scan-library-button";

export default async function LibraryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const authData = await getAuthData();
  const { serverUrl, user } = authData;

  // Fetch both library details and initial items (first page only)
  const [libraryDetails, initialLibraryItems] = await Promise.all([
    getLibraryById(id),
    fetchLibraryItems(id, 50, 0), // Load first 50 items only
  ]);

  console.log(`Initial items: ${initialLibraryItems.items.length}`);
  console.log(`Total count: ${initialLibraryItems.totalRecordCount}`);

  const libraryName = libraryDetails?.Name || "Library";

  return (
    <div className="relative px-4 py-6 max-w-full overflow-hidden">
      {/* Main content with higher z-index */}
      <div className="relative z-10">
        <div className="relative z-[9999] mb-8">
          <div className="mb-6 flex justify-center">
            <SearchBar />
          </div>
        </div>
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-3xl font-semibold text-foreground font-poppins">
              {libraryName}
            </h2>
            <ScanLibraryButton libraryId={id} />
          </div>
          <span className="font-mono text-muted-foreground">
            {initialLibraryItems.totalRecordCount} items
          </span>
        </div>

        <LibraryMediaListVirtual
          libraryId={id}
          mediaItems={initialLibraryItems.items}
          totalCount={initialLibraryItems.totalRecordCount}
          serverUrl={serverUrl}
        />
      </div>
    </div>
  );
}
