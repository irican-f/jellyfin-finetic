import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { ProgressiveBlur } from "@/components/motion-primitives/progressive-blur";
import { JellyfinItem } from "@/types/jellyfin";
import { formatRuntime } from "@/lib/utils";

interface PlayerOverlayProps {
    visible: boolean;
    mediaDetails: JellyfinItem | null;
    currentMediaName: string;
    serverUrl: string;
    backdropImageLoaded: boolean;
    blurDataUrl: string | null;
    onClose: () => void;
    onBackdropLoad: () => void;
    formatEndTime: (currentSeconds: number, durationSeconds: number) => string;
}

export function PlayerOverlay({
    visible,
    mediaDetails,
    currentMediaName,
    serverUrl,
    backdropImageLoaded,
    blurDataUrl,
    onClose,
    onBackdropLoad,
    formatEndTime,
}: PlayerOverlayProps) {
    if (!visible) return null;

    // Helper to convert ticks to seconds locally if needed, but formatRuntime usually handles ticks
    // formatEndTime expects seconds, so we need to convert ticks
    const ticksToSeconds = (ticks: number) => ticks / 10000000;

    return (
        <div className="fixed inset-0 bg-black z-[1000000]">
            <Button
                variant="ghost"
                className="fixed left-4 top-4 z-10 hover:backdrop-blur-md"
                onClick={onClose}
            >
                <ArrowLeft className="h-4 w-4" />
                Go Back
            </Button>

            {mediaDetails ? (
                <div className="relative w-full h-full">
                    {!backdropImageLoaded && (
                        <div
                            className={`w-full h-full object-cover brightness-50 absolute inset-0 transition-opacity duration-300 ${blurDataUrl ? "" : "bg-gray-800"
                                }`}
                            style={
                                blurDataUrl
                                    ? {
                                        backgroundImage: `url(${blurDataUrl})`,
                                        backgroundSize: "cover",
                                        backgroundPosition: "center",
                                        filter: "brightness(0.5)",
                                    }
                                    : undefined
                            }
                        />
                    )}

                    <img
                        src={`${serverUrl}/Items/${mediaDetails?.Type === "Episode" && mediaDetails?.SeriesId
                            ? mediaDetails.SeriesId
                            : mediaDetails.Id
                            }/Images/Backdrop?maxHeight=1080&maxWidth=1920&quality=95`}
                        alt={currentMediaName}
                        className={`w-full h-full object-cover brightness-50 transition-opacity duration-300 ${backdropImageLoaded ? "opacity-100" : "opacity-0"
                            }`}
                        onLoad={onBackdropLoad}
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                        }}
                        ref={(img) => {
                            if (img && img.complete && img.naturalHeight !== 0) {
                                onBackdropLoad();
                            }
                        }}
                    />
                    <ProgressiveBlur
                        direction="bottom"
                        blurLayers={2}
                        blurIntensity={0.3}
                        className="absolute inset-0"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
            ) : (
                <div className="w-full h-full bg-black" />
            )}

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute bottom-8 left-8 right-8"
            >
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.5 }}
                    className="flex flex-col w-full gap-1.5 pb-2"
                >
                    {mediaDetails?.SeriesName && (
                        <motion.div
                            className="text-sm text-white/70 truncate font-medium"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            {mediaDetails.SeriesName}
                        </motion.div>
                    )}

                    <div className="flex items-center justify-between w-full">
                        <motion.h2
                            className="text-3xl font-semibold text-white truncate font-poppins"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                        >
                            {mediaDetails?.Type === "Episode" &&
                                mediaDetails?.IndexNumber
                                ? `${mediaDetails.IndexNumber}. ${mediaDetails.Name || currentMediaName}`
                                : mediaDetails?.Name || currentMediaName}
                        </motion.h2>

                        {mediaDetails?.RunTimeTicks && (
                            <motion.div
                                className="text-sm text-white/70 ml-4 whitespace-nowrap"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.5 }}
                            >
                                Ends at{" "}
                                {formatEndTime(
                                    0,
                                    ticksToSeconds(mediaDetails.RunTimeTicks)
                                )}
                            </motion.div>
                        )}
                    </div>

                    <motion.div
                        className="flex items-center gap-3 text-sm text-white/60"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                    >
                        {mediaDetails?.Type === "Episode" && (
                            <div className="space-x-1">
                                {mediaDetails?.ParentIndexNumber && (
                                    <span>S{mediaDetails.ParentIndexNumber}</span>
                                )}
                                <span>•</span>
                                {mediaDetails?.IndexNumber && (
                                    <span>E{mediaDetails.IndexNumber}</span>
                                )}
                            </div>
                        )}

                        {mediaDetails?.RunTimeTicks && (
                            <span>{formatRuntime(mediaDetails.RunTimeTicks)}</span>
                        )}

                        {mediaDetails?.ProductionYear && (
                            <span>{mediaDetails.ProductionYear}</span>
                        )}
                    </motion.div>

                    <motion.div
                        className="flex items-center gap-2 mt-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span className="text-sm text-white/70">Loading...</span>
                    </motion.div>
                </motion.div>
            </motion.div>
        </div>
    );
}

