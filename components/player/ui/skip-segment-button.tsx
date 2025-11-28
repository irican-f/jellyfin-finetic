import React from "react";
import { Button } from "@/components/ui/button";
import { FastForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface SkipSegmentButtonProps {
    show: boolean;
    onSkip: () => void;
    label?: string;
}

export function SkipSegmentButton({ show, onSkip, label = "Skip Intro" }: SkipSegmentButtonProps) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.8 }}
                    transition={{
                        type: "spring",
                        damping: 20,
                        stiffness: 100,
                        duration: 0.8,
                    }}
                    className="fixed bottom-24 right-6 z-[1000000] backdrop-blur-md rounded-lg"
                >
                    <Button
                        onClick={onSkip}
                        className="text-white text-center bg-black/30 rounded-lg text-lg py-6 px-6! font-medium shadow-xl hover:bg-black/40 transition"
                    >
                        <FastForward className="w-4 h-4 fill-white scale-110 mr-1.5" />
                        {label}
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

