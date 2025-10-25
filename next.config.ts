import type {NextConfig} from "next";

const nextConfig: NextConfig = {
    /* config options here */
    distDir: '.next',
    output: 'standalone',
    images: {
        unoptimized: true,
    },
    logging: {
        fetches: {
            fullUrl: true,
        },
    }
};

export default nextConfig;
