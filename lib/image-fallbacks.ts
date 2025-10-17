/**
 * Generate fallback URLs for Jellyfin images when the primary image type fails
 */

export function generateImageFallbacks(
    serverUrl: string,
    itemId: string,
    primaryImageType: string,
    maxHeight?: number,
    maxWidth?: number,
    quality?: number
): string[] {
    const fallbackTypes = getImageTypeFallbacks(primaryImageType);
    const params = new URLSearchParams();

    if (maxHeight) params.set('maxHeight', maxHeight.toString());
    if (maxWidth) params.set('maxWidth', maxWidth.toString());
    if (quality) params.set('quality', quality.toString());

    const queryString = params.toString();
    const baseUrl = `${serverUrl}/Items/${itemId}/Images`;

    return fallbackTypes.map(type => {
        const url = `${baseUrl}/${type}`;
        return queryString ? `${url}?${queryString}` : url;
    });
}

/**
 * Get fallback image types based on the primary type
 * Ordered by preference (most similar first)
 */
function getImageTypeFallbacks(primaryType: string): string[] {
    const fallbackMap: Record<string, string[]> = {
        'Thumb': ['Primary', 'Backdrop', 'Banner', 'Logo'],
        'Primary': ['Thumb', 'Backdrop', 'Banner', 'Logo'],
        'Backdrop': ['Primary', 'Thumb', 'Banner', 'Logo'],
        'Banner': ['Primary', 'Thumb', 'Backdrop', 'Logo'],
        'Logo': ['Primary', 'Thumb', 'Backdrop', 'Banner'],
    };

    return fallbackMap[primaryType] || ['Primary', 'Thumb', 'Backdrop', 'Banner'];
}
