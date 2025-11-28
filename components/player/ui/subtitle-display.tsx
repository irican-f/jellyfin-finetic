import React from "react";

export const SubtitleDisplay = React.memo(({ subtitle }: { subtitle: { text: string; positionTop: boolean } | null }) => {
    if (!subtitle) return null;

    return (
        <div
            className={`fixed left-1/2 transform -translate-x-1/2 z-[100] text-white text-center bg-black/20 px-4 py-2 rounded text-3xl font-medium shadow-xl backdrop-blur-md ${subtitle.positionTop ? "top-[15%]" : "bottom-[10%]"
                }`}
            dangerouslySetInnerHTML={{ __html: subtitle.text }}
        />
    );
});

SubtitleDisplay.displayName = "SubtitleDisplay";

